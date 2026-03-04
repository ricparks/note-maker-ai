/*
 * Copyright (C) 2026 The Application Foundry, LLC 
 *
 * This file is part of NoteMakerAI.
 *
 * NoteMakerAI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NoteMakerAI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * =========================================================================
 *
 * COMMERCIAL LICENSE OPTION
 *
 * If you wish to use this software in a proprietary product or are unable
 * to comply with the terms of the AGPLv3, a commercial license is available.
 *
 * For commercial licensing inquiries, please contact: license@theapplicationfoundry.com 
 *
 * =========================================================================
 */

/**
 * NoteMakerAI orchestrates the end-to-end workflow of turning the currently active
 * image file into a structured subject note. It is the glue layer that sequences:
 *  1. Active file acquisition & basic validation (image type checks).
 *  2. Binary -> base64 conversion (delegated to utils).
 *  3. Subject selection. 
 *  4. AI vendor invocation (delegated to ai/ clients returning AiResult).
 *  5. Subject JSON validation & parsing (delegated to the SubjectDefinition).
 *  6. Note creation & duplicate guarding inside the vault.
 *  7. User-facing transient feedback via Notice (temporary strategy).
 *
 * Responsibilities:
 *  - Orchestrate the above steps and short-circuit cleanly on failure.
 *  - Log diagnostic details for unexpected AI / parsing problems.
 *  - Ensure unload safety by not registering its own event listeners directly.
 *
 * Explicitly NOT responsible for:
 *  - Persisting or mutating plugin settings (handled in the main plugin class).
 *  - Low-level HTTP / fetch logic or error classification (ai/ clients).
 *  - Subject-specific schema design, parsing, filename or template rules (SubjectDefinition impls).
 *  - UI elements (settings tab, ribbon, commands) or user configuration surfaces.
 *  - Advanced retry / rate limiting / batching.
 *
 */

// NoteMakerCore.ts
import { TFile, normalizePath, Notice } from "obsidian";
import { createProgressModal } from "../ui/progress/ProgressModal";
import type NoteMakerAI from "../main";
import { PreparedImage } from "./image/PreparedImage";
// Subject system
import { SubjectRegistry } from "./subject";
import type {
	SubjectInfoBase,
	SubjectPromptContext,
} from "./subject";
import {
	SUBJECT_DIR,
	NO_ACTIVE_FILE_NOTICE,
	NOT_IMAGE_NOTICE,
	PROCESSING_NOTICE,
	SUCCESS_FETCHED_SUBJECT,
	FAILED_GET_SUBJECT,
	NOTE_CREATED_NOTICE,
	COULD_NOT_CREATE_NOTE,
	IMAGE_EXTENSIONS,
	UNKNOWN_VENDOR_ERROR,
	NOTE_IMAGE_MAX_WIDTH,
	NOTE_IMAGE_MAX_HEIGHT,
	AI_IMAGE_MAX_DIM,
	MAX_COLLISION_ATTEMPTS,
} from "../utils/constants";
import { sanitizeNoteFilename, normalizeSectionSpacing } from "../utils/noteUtils";
import { callOpenAIClient } from "./ai/openaiClient";
import { callGeminiClient } from "./ai/geminiClient";
import { callOpenRouterClient } from "./ai/openRouterClient";
import { callAnthropicClient } from "./ai/anthropicClient";
import type { AiResult } from "./ai/types";
import { confirm } from "../ui/confirm/ConfirmModal";
import type { LlmConfigEntry } from "../settings/schema";
import { RedoManager } from "./RedoManager";
import { Logger } from "../utils/logger";

type ExifData = import("./image/PreparedImage").ExifData;

export class NoteMakerCore {
	private redoManager: RedoManager;

	constructor(private plugin: NoteMakerAI, private registry: SubjectRegistry) {
		this.redoManager = new RedoManager(plugin, this);
	}

	/**
	 * Helper to get the first available subject if none is provided contextually.
	 * Returns undefined if no subjects are configured.
	 */
	private get firstSubject(): import("./subject").ActiveSubject | undefined {
		if (this.registry.subjects.length > 0) return this.registry.subjects[0];
		return undefined;
	}

	/**
	 * Ensures the subject's definition file is loaded before processing.
	 * If not loaded, triggers a reload and updates the subject reference.
	 * Returns true if ready, false if loading failed.
	 */
	private async ensureSubjectReady(subject: import("./subject").ActiveSubject): Promise<boolean> {
		if (subject.definition) return true;

		new Notice(`Loading definition for ${subject.name}...`);
		// Force reload (which attempts to load definition)
		await this.plugin.reloadSubject(subject, false);

		// Check if successful
		const updated = this.registry.getSubject(subject.name);
		if (updated && updated.definition) {
			// Update the local reference's definition so downstream code works
			subject.definition = updated.definition;
			return true;
		}

		new Notice(`Failed to load definition for ${subject.name}. Check settings.`);
		return false;
	}

	/**
	 * Invoked by UI (Ribbon/Command).
	 * Checks for multiple selected files in the explorer first.
	 * If multiple items (images or markdown) are found, confirms and processes them in batch.
	 * If single or no selection, falls back to processing the active file.
	 */
	async processSelection(explicitSubject?: import("./subject").ActiveSubject): Promise<void> {
		const subject = explicitSubject || this.firstSubject;
		if (!subject) {
			new Notice("No subject definition file configured. Open NoteMakerAI settings to configure one.");
			return;
		}
		
		if (!(await this.ensureSubjectReady(subject))) return;

		// Validate required directories are configured
		if (!subject.notesDir?.trim()) {
			new Notice(`Notes folder not configured for "${subject.name}". Open NoteMakerAI settings to configure it.`);
			return;
		}
		if (!subject.photosDir?.trim()) {
			new Notice(`Photos folder not configured for "${subject.name}". Open NoteMakerAI settings to configure it.`);
			return;
		}

		// 1. Try to detect multiple selection from File Explorer
		const selection = this.getExplorerSelection();
		
		const images = selection.filter(f => IMAGE_EXTENSIONS.includes((f.extension || "").toLowerCase()));
		const markdowns = selection.filter(f => (f.extension || "").toLowerCase() === "md");
		const totalCount = images.length + markdowns.length;

		if (totalCount > 1) {
			// Confirmation message
			const parts: string[] = [];
			if (images.length > 0) parts.push(`${images.length} photo${images.length > 1 ? "s" : ""}`);
			if (markdowns.length > 0) parts.push(`${markdowns.length} note${markdowns.length > 1 ? "s" : ""}`);
			
			const msg = `Process ${parts.join(" and ")}?`;
			const res = await confirm(this.plugin.app, msg);
			if (!res.ok) return;

			// Batch Process
			// We process sequentially to avoid overwhelming the system/UI
			for (const file of images) {
				await this.processImageFile(file, subject);
			}
			for (const file of markdowns) {
				const progressModal = createProgressModal(this.plugin.app);
				await this.processActiveMarkdown(file, progressModal, subject);
			}
			return;
		}

		// 2. Fallback: Standard single-file active processing
		return this.processActiveFile(subject);
	}

	/**
	 * Attempt to obtain the currently selected files from the file explorer view.
	 * Uses heuristics based on internal Obsidian view state (checking css classes).
	 * Returns empty array if detection fails or API is incompatible.
	 */
	private getExplorerSelection(): TFile[] {
		interface ExplorerFileItem {
			file?: unknown;
			titleEl?: HTMLElement;
			selfEl?: HTMLElement;
			el?: HTMLElement;
		}
		interface ExplorerView {
			fileItems?: Record<string, ExplorerFileItem>;
		}

		try {
			const leaves = this.plugin.app.workspace.getLeavesOfType("file-explorer");
			if (leaves.length === 0) return [];
			const view = leaves[0].view as ExplorerView;

			// Heuristic: Iterate fileItems and check for "is-selected" class
			if (view && view.fileItems) {
				const selectedFiles: TFile[] = [];
				// fileItems is usually a map of path -> FileItem
				for (const path in view.fileItems) {
					const item = view.fileItems[path];
					if (!item) continue;

					// Check for selection class on the title/self element
					// 'is-selected' is usually applied to the nav-file-title or specific container
					const el = item.titleEl ?? item.selfEl ?? item.el;
					if (el && el instanceof HTMLElement) {
						if (el.classList.contains("is-selected") && item.file instanceof TFile) {
							selectedFiles.push(item.file);
						}
					}
				}
				return selectedFiles;
			}
		} catch (e) {
			Logger.warn("[NoteMakerAI] Selection detection failed (graceful fallback):", e);
		}
		return [];
	}

	/**
	 * Original entry point, kept for API compatibility and fallback.
	 * Processes the currently active workspace file.
	 */
	async processActiveFile(subject?: import("./subject").ActiveSubject): Promise<void> {
		if (!subject) subject = this.firstSubject;
		if (!subject) return;

		if (!(await this.ensureSubjectReady(subject))) return;

		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (!activeFile) {
			const progressModal = createProgressModal(this.plugin.app);
			progressModal.error(NO_ACTIVE_FILE_NOTICE);
			progressModal.done(false);
			return;
		}

		await this.processFile(activeFile, subject);
	}

	/**
	 * Unified router for processing a single file (Image or Markdown).
	 */
	private async processFile(file: TFile, subject: import("./subject").ActiveSubject): Promise<string | null> {
		const extension = (file.extension || "").toLowerCase();
		const isImage = IMAGE_EXTENSIONS.includes(extension);
		const isMarkdown = extension === "md";

		if (!isImage && !isMarkdown) {
			const progressModal = createProgressModal(this.plugin.app);
			progressModal.error(NOT_IMAGE_NOTICE);
			progressModal.done(false);
			return null;
		}

		if (isMarkdown) {
			const progressModal = createProgressModal(this.plugin.app);
			await this.processActiveMarkdown(file, progressModal, subject);
			return null;
		}

		// Is Image
		return this.processImageFile(file, subject);
	}

	/**
	 * Core logic for processing a single image file.
	 * Returns the base64 string sent to AI, or null on failure.
	 */
	private async processImageFile(file: TFile, subject: import("./subject").ActiveSubject): Promise<string | null> {
		const progressModal = createProgressModal(this.plugin.app);
		progressModal.info(PROCESSING_NOTICE(file.name));

		progressModal.info("Preparing image...");
		const { photosDir, llmLabelOverride } =
			this.resolveSubjectDirsAndLlm(subject);
		const preparedImage = new PreparedImage(this.plugin.app, file, {
			photosDir: photosDir,
			maxW: NOTE_IMAGE_MAX_WIDTH,
			maxH: NOTE_IMAGE_MAX_HEIGHT,
			aiMax: AI_IMAGE_MAX_DIM,
			keepOriginal: !!this.plugin.settings.image?.keepOriginalAfterResize,
			orientation: this.plugin.settings.image?.orientation,
			rotationDirection: this.plugin.settings.image?.rotationDirection,
			progressReporter: {
				info: (m) => progressModal.info(m),
				error: (m) => progressModal.error(m),
			},
		});
		const ok = await preparedImage.ensurePrepared();
		if (!ok) {
			progressModal.done(false);
			return null;
		}
		const noteImageBase64 = preparedImage.getNoteBase64();
		const processedFile = await preparedImage.writeFile();
		// Parse EXIF once and pass to subjects (even if they ignore it)
		let exifData: ExifData | null = null;
		try {
			exifData = await preparedImage.getExifData();
			Logger.info(`[NoteMakerAI] EXIF extraction result: ${exifData ? JSON.stringify(exifData) : 'null (no EXIF found)'}`);
		} catch (exifError) {
			Logger.warn(`[NoteMakerAI] EXIF extraction failed:`, exifError);
			exifData = null;
		}

		// Always create / use a smaller AI-specific version to reduce token/cost.
		progressModal.info("Generating reduced-size image for AI...");
		let aiBase64: string | null = null;
		try {
			aiBase64 = await preparedImage.getAiImageBase64();
		} catch {
			aiBase64 = null;
		}
		const base64ForModel = aiBase64 || noteImageBase64; // fallback to note image if shrinking fails

		Logger.info("Prepared image ready for AI call.");

		progressModal.info("Calling AI vendor...");
		const resultCtx = await this.fetchSubjectJson(
			base64ForModel,
			progressModal,
			exifData || undefined,
			llmLabelOverride,
			subject,
			undefined // No prompt override for new notes
		);
		if (!resultCtx) {
			progressModal.error(FAILED_GET_SUBJECT);
			progressModal.done(false);
			return base64ForModel;
		}

		let parsed: SubjectInfoBase | null = null;
		try {
			// Pass the original file (sourceFile) context for placeholder resolution
			parsed = subject.definition!.parse(resultCtx.data, { 
				originalImage: preparedImage.getPreparedFile() || file // try prepared/moved file, then original
			});
		} catch (e) {
			Logger.error("Failed to parse subject data", e, resultCtx.data);
		}

		if (parsed) {
			progressModal.info(SUCCESS_FETCHED_SUBJECT);
			Logger.debug(parsed);

			// Surface non-blocking warnings for parsed data
			const warnings = subject.definition!.validateParsedData(parsed);
			for (const w of warnings) {
				progressModal.error(w);
			}

			// Validation Guardrail
			try {
				const guard = (parsed.raw as Record<string, unknown>) || {};
				// Additional check: does the subject itself want validation?
				const subjectWantsValidation = !!subject.definition!.validateSubject;

				// Prefer subject-specific threshold, fallback to default (0.7)
				const threshold = subject.definition!.validationThreshold ?? 0.7;

				const predicted = typeof guard.predicted_category === "string" ? guard.predicted_category : undefined;
				const confidence = typeof guard.confidence === "number" ? guard.confidence : undefined;
				const subjectMatch = typeof guard.subject_match === "boolean" ? guard.subject_match : true;
				const reason = typeof guard.reason === "string" ? guard.reason : undefined;

				const isMismatch = subjectMatch === false;

				if (isMismatch && subjectWantsValidation) {
					const confStr = (confidence ?? 0).toFixed(2);
					if ((confidence ?? 0) >= threshold) {
						const msg = `This looks like ${
							predicted ?? "something else"
						} (${confStr}).${
							reason ? " " + reason : ""
						} Continue anyway?`;
						const res = await confirm(this.plugin.app, msg);
						if (!res.ok) {
							progressModal.done(false);
							return null;
						}
					} else {
						progressModal.info(
							`Note: Predicted ${
								predicted ?? "different subject"
							} with confidence ${confStr}.`
						);
					}
				}
			} catch (e) {
				Logger.warn("Guardrail check failed", e);
			}

			// Post-parse: rename photo canonically using subject's naming convention
			let finalPhotoFile = processedFile;
			try {
				const base = subject.definition!.getPhotoBasename(parsed, { exifData: exifData || undefined });
				finalPhotoFile = await preparedImage.renameTo(base);
			} catch (e) {
				Logger.warn("Photo rename skipped/failed:", e);
			}

			const success = await this.createSubjectNote(
				parsed,
				finalPhotoFile,
				progressModal,
				exifData,
				resultCtx.model,
				subject
			);
			
			if (success) {
				if (parsed._usedOriginalImagePlaceholder) {
					// If the subject definition used {{original_image}}, we must keep the file
					if (this.plugin.settings.image?.keepOriginalAfterResize === false) {
						progressModal.info("Note: Original image preserved (referenced by {{original_image}}).");
					}
					// Do not call deleteOriginal
				} else {
					await preparedImage.deleteOriginal();
				}
			}
		} else {
			progressModal.error(FAILED_GET_SUBJECT);
		}
		progressModal.done(!!parsed);
		return base64ForModel;
	}

	private async processActiveMarkdown(
		file: TFile,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: import("./subject").ActiveSubject
	): Promise<void> {
		return this.redoManager.processActiveMarkdown(file, progressModal, subject);
	}


	/**
	 * Resolves output directories and optional LLM override for the current subject.
	 */
	public resolveSubjectDirsAndLlm(subject?: import("./subject").ActiveSubject): {
		notesDir: string;
		photosDir: string;
		llmLabelOverride?: string;
	} {
		if (subject) {
			return {
				notesDir: subject.notesDir,
				photosDir: subject.photosDir,
				llmLabelOverride: subject.llmLabel,
			};
		}

		// No valid subject or directories — fail fast rather. 
		throw new Error("Subject directories not configured. Cannot resolve output locations.");
	}

	private resolveLlmConfig(llmLabelOverride?: string): LlmConfigEntry | null {
		const { llms, defaultLlmLabel } = this.plugin.settings;
		const lookup = (label?: string) =>
			label ? llms.find((entry) => entry.label === label) : undefined;
		const byOverride = lookup(llmLabelOverride?.trim());
		if (byOverride) return byOverride;
		const byDefault = lookup(defaultLlmLabel?.trim());
		if (byDefault) return byDefault;
		return llms[0] ?? null;
	}

	/**
	 * Call the configured AI vendor with the provided base64 image and subject prompt.
	 * Surfaces vendor selection in the progress UI, and returns the parsed JSON (or null on failure).
	 */
	public async fetchSubjectJson(
		base64Image: string,
		progressModal: {
			info: (m: string) => void;
			error: (m: string) => void;
		},
		exifData?: import("./image/PreparedImage").ExifData,
		llmLabelOverride?: string,
		subject?: import("./subject").ActiveSubject,
		promptOverride?: string
	): Promise<{ data: unknown; model: string } | null> {
		let prompt: string;
		if (promptOverride) {
			prompt = promptOverride;
		} else {
			const context: SubjectPromptContext = {};
			Logger.info(`[NoteMakerAI] fetchSubjectJson received exifData: ${exifData ? 'present' : 'undefined/null'}`);
			if (exifData) {
				context.exifData = exifData;
				Logger.info(`[NoteMakerAI] Added EXIF to prompt context: ${JSON.stringify(exifData)}`);
			}
			const { notesDir } = this.resolveSubjectDirsAndLlm(subject);
			context.app = this.plugin.app;

			context.notesDir = notesDir;
			context.logInfo = (m) => progressModal.info(m);

			if (!subject) throw new Error("No subject provided for prompt generation");
			prompt = await subject.definition!.getPrompt(context);
		}

		Logger.info(
			`[NoteMakerAI] Fetching subject JSON (promptOverride=${!!promptOverride}). Prompt length: ${prompt.length}`
		);
		Logger.info(`[NoteMakerAI] Full Prompt: ${prompt}`);

		const llmConfig = this.resolveLlmConfig(llmLabelOverride);
		if (!llmConfig) {
			progressModal.error(
				"No LLM configuration is available. Configure an LLM in settings first."
			);
			return null;
		}

		const { vendor, model, apiKey, label: llmLabel } = llmConfig;
		const effectiveApiKey = apiKey;

		if (!effectiveApiKey) {
			progressModal.error(
				`API Key missing for ${vendor} (model: ${model}). Please configure it in Settings.`
			);
			return null;
		}

		Logger.info(`[NoteMakerAI] Using LLM: ${vendor} / ${model} (${llmLabel})`);

		let result: AiResult;
		if (vendor === "openai") {
			progressModal.info(
				`Using OpenAI model (${llmLabel}): ${model}`
			);
			result = await callOpenAIClient({
				vendor: "openai",
				apiKey: effectiveApiKey,
				model,
				prompt,
				base64Image,
			});
		} else if (vendor === "gemini") {
			progressModal.info(
				`Using Gemini model (${llmLabel}): ${model}`
			);
			result = await callGeminiClient({
				vendor: "gemini",
				apiKey: effectiveApiKey,
				model,
				prompt,
				base64Image,
			});
		} else if (vendor === "openrouter") {
			progressModal.info(
				`Using OpenRouter model (${llmLabel}): ${model}`
			);
			const referer = typeof window !== "undefined" && window.location
				? window.location.origin
				: undefined;
			result = await callOpenRouterClient({
				vendor: "openrouter",
				apiKey: effectiveApiKey,
				model,
				prompt,
				base64Image,
				referer,
				clientTitle: this.plugin.manifest.name,
			});
		} else if (vendor === "anthropic") {
			progressModal.info(
				`Using Anthropic model (${llmLabel}): ${model}`
			);
			result = await callAnthropicClient({
				vendor: "anthropic",
				apiKey: effectiveApiKey,
				model,
				prompt,
				base64Image,
			});
		} else {
			progressModal.error(UNKNOWN_VENDOR_ERROR);
			return null;
		}

		if (!result.ok) {
			// Centralized user feedback 
			progressModal.error(result.error);
			Logger.error("AI call failed", result);
			return null;
		}

		// Success: data is already parsed object (or clean string depending on client, but we normalized to object in client)
		// If data is a string, parse it.
		if (typeof result.data === 'string') {
			try {
				const cleaned = result.data
					.replace(/```json/g, "")
					.replace(/```/g, "")
					.trim();
				return { data: JSON.parse(cleaned), model: result.model || model };
			} catch (e) {
				Logger.error("JSON Parse Error", e, result.data);
				progressModal.error("Failed to parse AI response as JSON.");
				return null;
			}
		}

		return { data: result.data, model: result.model || model };
	}

	/**
	 * Create the subject note file using the subject's filename and template rules,
	 * then open it in a new leaf if creation succeeds.
	 * Guards against duplicate filenames within the subject directory.
	 */
	private async createSubjectNote(
		info: SubjectInfoBase,
		originalPhotoFile: TFile,
		progressModal: {
			info: (m: string) => void;
			error: (m: string) => void;
			done: (success: boolean) => void;
		},
		exifData: import("./image/PreparedImage").ExifData | null | undefined,
		llmModel: string | undefined,
		subject: import("./subject").ActiveSubject
	): Promise<boolean> {
		const fileName = sanitizeNoteFilename(
			subject.definition!.getNoteFilename(info)
		);
		const { notesDir } = this.resolveSubjectDirsAndLlm(subject);
		const dir = notesDir || subject.definition!.directory || SUBJECT_DIR;
		// Ensure notes folder exists (no-op if already present)
		const existingPath = this.plugin.app.vault.getAbstractFileByPath(dir);
		if (!existingPath) {
			try {
				await this.plugin.app.vault.createFolder(dir);
			} catch (e) {
				// Only ignore "folder already exists" errors; re-check to be safe
				const existsNow = this.plugin.app.vault.getAbstractFileByPath(dir);
				if (!existsNow) {
					Logger.error(`[NoteMakerAI] Failed to create folder "${dir}":`, e);
				}
			}
		}
		// Collision-safe note path generation: append numeric suffix if needed
		let basePath = normalizePath(`${dir}/${fileName}.md`);
		let filePath = basePath;
		let n = 2;
		while (this.plugin.app.vault.getAbstractFileByPath(filePath) && n < MAX_COLLISION_ATTEMPTS) {
			filePath = normalizePath(`${dir}/${fileName} ${n}.md`);
			n++;
		}

		const photoLink = this.plugin.app.fileManager
			.generateMarkdownLink(originalPhotoFile, "")
			.replace(/^!/, "");
		const coverFileName = originalPhotoFile.name; // Preserve original filename including extension

		const baseContent = subject.definition!.buildNote(info, {
			photoLink,
			coverFileName,
			exifData: exifData || undefined,
			llmModel,
		});
		const content = normalizeSectionSpacing(baseContent);

		try {
			const newFile = await this.plugin.app.vault.create(
				filePath,
				content
			);
			const createdName = filePath
				.substring(filePath.lastIndexOf("/") + 1)
				.replace(/\.md$/, "");
			progressModal.info(NOTE_CREATED_NOTICE(createdName));
			progressModal.info("Opening note...");
			const leaf = this.plugin.app.workspace.getLeaf(true);
			await leaf.openFile(newFile);
			return true;
		} catch (error) {
			Logger.error("Error creating new note:", error);
			progressModal.error(COULD_NOT_CREATE_NOTE);
			return false;
		}
	}
}
