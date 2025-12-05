/**
 * NoteTakerAI orchestrates the end-to-end workflow of turning the currently active
 * image file into a structured subject note. It is the glue layer that sequences:
 *  1. Active file acquisition & basic validation (image type checks).
 *  2. Binary -> base64 conversion (delegated to utils).
 *  3. Subject selection (currently a single book subject implementation).
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
 *  - Advanced retry / rate limiting / batching (future concern).
 *
 * Extension points / future evolution:
 *  - Introduce a registry to select among multiple SubjectDefinitions dynamically.
 *  - Add additional AI vendors by contributing new client modules producing AiResult.
 *  - Replace direct Notice calls with structured result propagation for richer UI.
 *  - Introduce caching or memoization for repeated image processing (if needed).
 */
import { TFile } from "obsidian";
import { createProgressModal } from "../ui/progress/ProgressModal";
import type NoteTakerAI from "../main";
import { PreparedImage } from "./image/PreparedImage";
// Subject system
import { activeSubject } from "./subject";
import type {
	SubjectInfoBase,
	SubjectNoteData,
	SubjectExistingNoteContext,
	SubjectPromptContext,
	SubjectNoteSections,
} from "./subject";

import {
	NO_ACTIVE_FILE_NOTICE,
	NOT_IMAGE_NOTICE,
	PROCESSING_NOTICE,
	SUCCESS_FETCHED_SUBJECT,
	FAILED_GET_SUBJECT,
	NOTE_EXISTS_NOTICE,
	NOTE_CREATED_NOTICE,
	COULD_NOT_CREATE_NOTE,
	BASES_DEFAULT_DIR,
	IMAGE_EXTENSIONS,
	UNKNOWN_VENDOR_ERROR,
} from "../utils/constants";
import { callOpenAIClient } from "./ai/openaiClient";
import { callGeminiClient } from "./ai/geminiClient";
import { callOpenRouterClient } from "./ai/openRouterClient";
import type { AiResult } from "./ai/types";
import { confirm } from "../ui/confirm/ConfirmModal";
import type { LlmConfigEntry } from "../settings/schema";

type ExifData = import("./image/PreparedImage").ExifData;

type RedoContext = {
	file: TFile;
	noteData: SubjectNoteData;
	markdown: string;
	exifData?: ExifData;
	prompt: string;
	photoFile: TFile;
	photoBase64: string;
	mapLink?: string | null;
	rawSubject?: any;
};

const SECTION_HEADING_ALIASES: Record<string, string[]> = {
	"prompt additions": ["pa"],
	pa: ["prompt additions"],
};

export class NoteTakerAICore {
	private redoContext: RedoContext | null = null;

	constructor(private plugin: NoteTakerAI) {}

	/**
	 * Resolve the currently active subject definition.
	 */
	private get subject() {
		return activeSubject;
	}

	/**
	 * Main entry point: processes the active file into a subject note.
	 * Steps (image branch):
	 * 1) Validate that the active file is an image.
	 * 2) Prepare the image (move or resize) and capture base64 for the note.
	 * 3) Produce a shrunk in-memory JPEG for AI (<=512px) to reduce cost.
	 * 4) Call the configured AI vendor and parse result with the subject.
	 * 5) Optionally rename the photo canonically, then create and open the note.
	 * Markdown handling is introduced in the redo feature and branches earlier.
	 * @returns base64 string actually used for the AI call (or null on early failure)
	 */
	async processActiveFile(): Promise<string | null> {
		this.redoContext = null;
		const activeFile = this.plugin.app.workspace.getActiveFile();

		const progressModal = createProgressModal(this.plugin.app);
		if (!activeFile) {
			progressModal.error(NO_ACTIVE_FILE_NOTICE);
			progressModal.done(false);
			return null;
		}

		const extension = (activeFile.extension || "").toLowerCase();
		const isImage = IMAGE_EXTENSIONS.includes(extension);
		const isMarkdown = extension === "md";

		if (!isImage && !isMarkdown) {
			progressModal.error(NOT_IMAGE_NOTICE);
			progressModal.done(false);
			return null;
		}

		if (isMarkdown) {
			await this.processActiveMarkdown(activeFile, progressModal);
			return null;
		}

		progressModal.info(PROCESSING_NOTICE(activeFile.name));

		progressModal.info("Preparing image...");
		const { notesDir, photosDir, llmLabelOverride } =
			this.resolveSubjectDirsAndLlm();
		const preparedImage = new PreparedImage(this.plugin.app, activeFile, {
			subjectDir: notesDir,
			photosDir: photosDir,
			maxW: 750,
			maxH: 1000,
			aiMax: 512,
			keepOriginal: !!this.plugin.settings.image?.keepOriginalAfterResize,
			logger: {
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
		const exifData = await preparedImage.getExifData().catch(() => null);

		// Always create / use a smaller AI-specific version to reduce token/cost.
		progressModal.info("Generating reduced-size image for AI...");
		const aiBase64 = await preparedImage
			.getAiImageBase64()
			.catch(() => null);
		const base64ForModel = aiBase64 || noteImageBase64; // fallback to note image if shrinking fails

		console.log("Prepared image ready for AI call.");

		progressModal.info("Calling AI vendor...");
		const raw = await this.fetchSubjectJson(
			base64ForModel,
			progressModal,
			exifData || undefined,
			llmLabelOverride
		);
		if (!raw) {
			progressModal.error(FAILED_GET_SUBJECT);
			progressModal.done(false);
			return base64ForModel;
		}

		let parsed: SubjectInfoBase | null = null;
		try {
			parsed = this.subject.parse(raw);
		} catch (e) {
			console.error("Failed to parse subject data", e, raw);
		}

		if (parsed) {
			progressModal.info(SUCCESS_FETCHED_SUBJECT);
			console.log(parsed);

			// Surface non-blocking warnings for parsed data
			if (typeof (this.subject as any).validateParsedData === "function") {
				const warnings = (this.subject as any).validateParsedData(parsed);
				if (Array.isArray(warnings)) {
					for (const w of warnings) {
						progressModal.error(w);
					}
				}
			}


			// Validation Guardrail
			try {
				const guard = (parsed as any).meta || {};
				const warnEnabled = this.plugin.settings.validation.warnOnMismatch ?? true;
				const threshold = this.plugin.settings.validation.mismatchThreshold ?? 0.7;
				const predicted = guard.predicted_category as string | undefined;
				const confidence = typeof guard.confidence === "number" ? guard.confidence : undefined;
				const subjectMatch = typeof guard.subject_match === "boolean" ? guard.subject_match : true;
				const reason = guard.reason as string | undefined;
				
				const isMismatch = subjectMatch === false;

				if (isMismatch) {
					const confStr = (confidence ?? 0).toFixed(2);
					if ((confidence ?? 0) >= threshold && warnEnabled) {
						const msg = `This looks like ${
							predicted ?? "something else"
						} (${confStr}).${
							reason ? " " + reason : ""
						} Continue anyway?`;
						const res = await confirm(this.plugin.app, msg);
						if (res.dontShowAgain) {
							this.plugin.settings.validation.warnOnMismatch = false;
							await this.plugin.saveSettings();
						}
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
				console.warn("Guardrail check failed", e);
			}

			// Post-parse: rename photo canonically if subject provides a naming hook
			let finalPhotoFile = processedFile;
			const subjectAny: any = this.subject as any;
			if (typeof subjectAny.getPhotoBasename === "function") {
				try {
					const base = subjectAny.getPhotoBasename(parsed, {
						exifData,
					}) as string;
					finalPhotoFile = await preparedImage.renameTo(base);
				} catch (e) {
					console.warn("Photo rename skipped/failed:", e);
				}
			}

			await this.createSubjectNote(
				parsed,
				finalPhotoFile,
				progressModal,
				exifData
			);
		} else {
			progressModal.error(FAILED_GET_SUBJECT);
		}
		progressModal.done(!!parsed);
		return base64ForModel;
	}

	private async processActiveMarkdown(
		file: TFile,
		progressModal: ReturnType<typeof createProgressModal>
	): Promise<void> {
		this.redoContext = null;
		progressModal.info("Redoing image");
		const subjectAny = this.subject as {
			parseExistingNote?: (
				note: SubjectExistingNoteContext
			) => SubjectNoteData | Promise<SubjectNoteData>;
		};
		if (typeof subjectAny.parseExistingNote !== "function") {
			progressModal.error("Redo is not available for this subject yet.");
			progressModal.done(false);
			return;
		}

		const content = await this.plugin.app.vault.read(file);
		const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		const noteData = await subjectAny.parseExistingNote({
			file,
			content,
			frontmatter,
		});
		const narrativeStyleLabel = this.getNarrativeStyleLabel(noteData.properties);
		if (
			typeof noteData.properties?.narrative_style !== "string" ||
			noteData.properties.narrative_style.trim().length === 0
		) {
			noteData.properties.narrative_style = narrativeStyleLabel;
		}
		const exifFromNote = this.extractExifFromProperties(noteData.properties);
		const promptContext: SubjectPromptContext = {};
		if (noteData) {
			promptContext.noteData = noteData;
		}
		if (exifFromNote) {
			promptContext.exifData = exifFromNote;
		}
		const prompt =
			typeof (this.subject as any).getPrompt === "function"
				? (this.subject as any).getPrompt(promptContext)
				: this.subject.prompt;
		console.log("[NoteTakerAI] Redo prompt:", prompt);
		const photoFile = this.resolveRedoPhoto(noteData, file, content);
		if (!photoFile) {
			progressModal.error(
				"Redo failed: could not locate the linked photo for this note."
			);
			progressModal.done(false);
			return;
		}

		let photoBase64: string;
		try {
			photoBase64 = await this.readFileAsBase64(photoFile);
		} catch (error) {
			console.error("Failed to read photo for redo", error);
			progressModal.error(
				"Redo failed: could not read the linked photo for this note."
			);
			progressModal.done(false);
			return;
		}

		const mapLink = this.extractMapLink(content);

		this.redoContext = {
			file,
			noteData,
			markdown: content,
			exifData: exifFromNote,
			prompt,
			photoFile,
			photoBase64,
			mapLink,
		};
		if (noteData.logSummary) {
			progressModal.info(noteData.logSummary);
		} else {
			progressModal.info("Parsed markdown note");
		}
		progressModal.info(
			narrativeStyleLabel
				? `Prepared redo prompt (style: ${narrativeStyleLabel})`
				: "Prepared redo prompt"
		);

		progressModal.info("Fetching redo subject data...");
		const { llmLabelOverride } = this.resolveSubjectDirsAndLlm();
		const raw = await this.fetchSubjectJson(
			photoBase64,
			progressModal,
			exifFromNote,
			llmLabelOverride
		);
		if (!raw) {
			progressModal.error(
				"Redo failed while fetching updated subject data."
			);
			progressModal.done(false);
			return;
		}
		console.log("[NoteTakerAI] Redo raw subject:", raw);
		this.redoContext.rawSubject = raw;
		progressModal.info("Fetched redo subject data");

		const parsed = this.parseRedoSubject(raw, progressModal);
		if (!parsed) {
			this.redoContext = null;
			return;
		}
		progressModal.info("Parsed redo subject data");
		await this.updateRedoNote(parsed, progressModal);
	}

	private extractExifFromProperties(
		properties?: Record<string, any>
	): import("./image/PreparedImage").ExifData | undefined {
		if (!properties) return undefined;
		const toNumber = (value: any): number | undefined => {
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (typeof value === "string" && value.trim().length > 0) {
				const parsed = Number(value);
				return Number.isFinite(parsed) ? parsed : undefined;
			}
			return undefined;
		};
		const toString = (value: any): string => {
			if (value === undefined || value === null) return "";
			return String(value).trim();
		};

		const latitude = toNumber(properties.latitude);
		const longitude = toNumber(properties.longitude);
		const altitude = toNumber(properties.altitude);
		const dateTaken = toString(properties.date_taken);
		const timeOfDay = toString(properties.time_of_day);
		const dateTimeOriginal = dateTaken
			? timeOfDay
				? `${dateTaken}T${timeOfDay}`
				: dateTaken
			: undefined;

		const exif: import("./image/PreparedImage").ExifData = {};
		if (latitude !== undefined) exif.latitude = latitude;
		if (longitude !== undefined) exif.longitude = longitude;
		if (altitude !== undefined) exif.altitude = altitude;
		if (dateTimeOriginal) exif.dateTimeOriginal = dateTimeOriginal;

		return Object.keys(exif).length > 0 ? exif : undefined;
	}

	private resolveRedoPhoto(
		noteData: SubjectNoteData,
		sourceFile: TFile,
		markdown: string
	): TFile | null {
		const candidates = new Set<string>();
		const photoProp = noteData?.properties?.photo;
		if (typeof photoProp === "string") {
			candidates.add(photoProp);
		} else if (Array.isArray(photoProp)) {
			for (const entry of photoProp) {
				if (typeof entry === "string") candidates.add(entry);
			}
		}

		const embedRegex = /!?\[\[([^\]|]+)(?:\|[^\]]*)?]]/g;
		let match: RegExpExecArray | null;
		while ((match = embedRegex.exec(markdown)) !== null) {
			if (match[1]) candidates.add(match[1]);
		}

		for (const raw of candidates) {
			const link = this.normalizeLinkTarget(raw);
			if (!link) continue;
			const resolved = this.plugin.app.metadataCache.getFirstLinkpathDest(
				link,
				sourceFile.path
			);
			if (resolved && resolved instanceof TFile) {
				const ext = resolved.extension?.toLowerCase() || "";
				if (IMAGE_EXTENSIONS.includes(ext)) {
					return resolved;
				}
			}
		}
		return null;
	}

	private normalizeLinkTarget(raw: any): string | null {
		if (typeof raw !== "string") return null;
		let text = raw.trim();
		if (!text) return null;
		if (
			(text.startsWith("\"") && text.endsWith("\"")) ||
			(text.startsWith("'") && text.endsWith("'"))
		) {
			text = text.slice(1, -1).trim();
		}
		const wikiMatch = /\[\[([^\]]+)]]/.exec(text);
		if (wikiMatch) {
			const target = wikiMatch[1] || "";
			const pipeIndex = target.indexOf("|");
			return (pipeIndex >= 0 ? target.slice(0, pipeIndex) : target).trim();
		}
		return text;
	}

	private async readFileAsBase64(file: TFile): Promise<string> {
		const data = await this.plugin.app.vault.readBinary(file);
		return this.arrayBufferToBase64(data);
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		let binary = "";
		const bytes = new Uint8Array(buffer);
		const chunk = 0x8000;
		for (let i = 0; i < bytes.length; i += chunk) {
			const slice = bytes.subarray(i, i + chunk);
			binary += String.fromCharCode.apply(null, Array.from(slice));
		}
		return btoa(binary);
	}

	private parseRedoSubject(
		raw: any,
		progressModal: ReturnType<typeof createProgressModal>
	): SubjectInfoBase | null {
		try {
			return this.subject.parse(raw);
		} catch (error) {
			console.error("Redo failed to parse subject data", error, raw);
			progressModal.error("Redo failed: unable to parse subject data.");
			progressModal.done(false);
			return null;
		}
	}

	private async updateRedoNote(
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>
	): Promise<void> {
		if (!this.redoContext) {
			progressModal.error("Redo failed: missing context.");
			progressModal.done(false);
			return;
		}
		const { noteData, photoFile, exifData, mapLink } = this.redoContext;
		let file = await this.renameRedoFileIfNeeded(
			this.redoContext.file,
			parsed,
			progressModal
		);
		this.redoContext.file = file;
		const narrativeStyle = this.getNarrativeStyleLabel(noteData.properties);
		const photoLink = this.plugin.app.fileManager
			.generateMarkdownLink(photoFile, file.path)
			.replace(/^!/, "");
		const coverFileName = photoFile.name;
		const baseContent = this.subject.buildNote(parsed, {
			photoLink,
			coverFileName,
			exifData,
			narrativeStyleLabel: narrativeStyle,
		});

		const cleanSection = (body: string | undefined): string => {
			if (!body) return "";
			const targetEmbed = coverFileName ? `![[${coverFileName}]]` : null;
			const trimmedMap = mapLink?.trim();
			const lines = body.split(/\r?\n/);
			const filtered = lines.filter((line) => {
				const trimmed = line.trim();
				if (!trimmed) return true;
				if (targetEmbed && trimmed === targetEmbed) return false;
				if (trimmedMap && trimmed === trimmedMap) return false;
				if (trimmed.startsWith("[Open in Maps](")) return false;
				return true;
			});
			while (filtered.length > 0 && filtered[filtered.length - 1].trim().length === 0) {
				filtered.pop();
			}
			return filtered.join("\n");
		};

		const sections = { ...noteData.sections };
		const myNotesKey = this.findSectionKey(sections, "My Notes");
		const promptKey = this.findSectionKey(sections, "Prompt Additions");
		const notesKey = this.findSectionKey(sections, "Notes of Interest");
		if (notesKey) {
			sections[notesKey] = cleanSection(sections[notesKey]);
		}

		let updated = baseContent;
		if (myNotesKey) {
			updated = this.replaceSectionVariants(updated, [myNotesKey, "My Notes"], sections[myNotesKey] ?? "");
		}
		if (promptKey) {
			const promptBody = sections[promptKey] ?? "";
			const exists = this.sectionExists(updated, promptKey) || this.sectionExists(updated, "Prompt Additions");
			if (exists) {
				updated = this.replaceSectionVariants(updated, [promptKey, "Prompt Additions"], promptBody);
			} else {
				const afterCandidates = myNotesKey ? [myNotesKey, "My Notes"] : ["My Notes"];
				updated = this.insertSectionAfter(updated, afterCandidates, promptKey, promptBody);
			}
		}

		updated = this.normalizeSectionSpacing(updated);

		try {
			await this.plugin.app.vault.modify(file, updated);
			progressModal.info("Updated note with regenerated content");
			progressModal.done(true);
			this.redoContext = null;
		} catch (error) {
			console.error("Redo failed while writing note", error);
			progressModal.error("Redo failed: could not write the updated note.");
			progressModal.done(false);
		}
	}

	private getNarrativeStyleLabel(properties?: Record<string, any>): string {
		if (properties && typeof properties.narrative_style === "string") {
			const label = properties.narrative_style.trim();
			if (label.length > 0) return label;
		}
		
		const label = this.plugin.settings.folders.narrativeStyleLabel?.trim();
		const styles = this.plugin.settings.narrativeStyles || [];
		if (label && label.length > 0) {
			const exists = styles.some(
				(style) => style.label?.trim() === label
			);
			if (exists) {
				return label;
			}
		}
		return "default";
	}

	private sanitizeNoteFilename(name: string): string {
		const raw = (name ?? "")
			.replace(/[\\/:?*"<>|]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return raw.length > 0 ? raw : "NoteTakerAI Note";
	}

	private async renameRedoFileIfNeeded(
		file: TFile,
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>
	): Promise<TFile> {
		const desiredBaseName = this.sanitizeNoteFilename(
			this.subject.getNoteFilename(parsed)
		);
		if (desiredBaseName === file.basename) {
			return file;
		}

		const dir = file.parent ? file.parent.path : "";
		const buildPath = (attempt: number) => {
			const base = attempt === 0 ? desiredBaseName : `${desiredBaseName} ${attempt + 1}`;
			return dir ? `${dir}/${base}.md` : `${base}.md`;
		};

		let attempt = 0;
		let targetPath = buildPath(attempt);
		while (targetPath !== file.path) {
			const existing = this.plugin.app.vault.getAbstractFileByPath(targetPath);
			if (!existing) break;
			attempt += 1;
			targetPath = buildPath(attempt);
		}

		if (targetPath === file.path) {
			return file;
		}

		await this.plugin.app.fileManager.renameFile(file, targetPath);
		const displayName = targetPath.substring(targetPath.lastIndexOf("/") + 1).replace(/\.md$/, "");
		progressModal.info(`Renamed note to ${displayName}`);
		const updated = this.plugin.app.vault.getAbstractFileByPath(targetPath);
		return updated instanceof TFile ? updated : file;
	}

	private findSectionKey(
		sections: SubjectNoteSections,
		heading: string
	): string | undefined {
		const normalizedTarget = this.normalizeHeading(heading);
		const candidates = new Set<string>([normalizedTarget]);
		const targetAliases = SECTION_HEADING_ALIASES[normalizedTarget] || [];
		targetAliases.forEach((alias) => candidates.add(this.normalizeHeading(alias)));
		for (const key of Object.keys(sections)) {
			const normalizedKey = this.normalizeHeading(key);
			if (candidates.has(normalizedKey)) {
				return key;
			}
			const keyAliases = SECTION_HEADING_ALIASES[normalizedKey] || [];
			if (keyAliases.some((alias) => candidates.has(this.normalizeHeading(alias)))) {
				return key;
			}
		}
		return undefined;
	}

	private normalizeHeading(value: string): string {
		return (value ?? "").trim().toLowerCase();
	}

	private collectHeadingCandidates(
		sections: SubjectNoteSections,
		heading: string
	): string[] {
		const set = new Set<string>();
		const key = this.findSectionKey(sections, heading);
		if (key && key.trim().length > 0) set.add(key);
		if (heading.trim().length > 0) set.add(heading);
		return Array.from(set);
	}

	private sectionExists(note: string, heading: string): boolean {
		return !!this.findSectionBounds(note, heading);
	}

	private replaceSectionVariants(
		note: string,
		headings: string[],
		body: string
	): string {
		for (const heading of headings) {
			const replaced = this.replaceSection(note, heading, body);
			if (replaced !== note) {
				return replaced;
			}
		}
		return note;
	}

	private replaceSection(note: string, heading: string, body: string): string {
		const bounds = this.findSectionBounds(note, heading);
		if (!bounds) return note;
		const { headingStart, contentStart, contentEnd } = bounds;
		const before = note.slice(0, headingStart);
		const headingLine = note.slice(headingStart, contentStart);
		const after = note.slice(contentEnd);
		const formatted = this.formatSectionBody(body);
		const normalizedAfter = after.replace(/^\n+/u, "");
		const needsGap = normalizedAfter.length > 0 ? "\n" : "";
		return `${before}${headingLine}${formatted}${needsGap}${normalizedAfter}`;
	}

	private appendLineToSection(
		note: string,
		headings: string[],
		line: string
	): string {
		const trimmed = line.trim();
		if (!trimmed) return note;
		for (const heading of headings) {
			const body = this.getSectionBody(note, heading);
			if (body === null) continue;
			if (body.includes(line)) return note;
			const newBody = body.length > 0 ? `${body}\n${line}` : line;
			return this.replaceSection(note, heading, newBody);
		}
		if (note.includes(line)) return note;
		return `${note.trimEnd()}\n${line}\n`;
	}

	private insertSectionAfter(
		note: string,
		afterHeadings: string[],
		heading: string,
		body: string
	): string {
		const formattedBody = this.formatSectionBody(body);
		const sectionBlock = `#### ${heading}\n${formattedBody}`;
		for (const candidate of afterHeadings) {
			const bounds = this.findSectionBounds(note, candidate);
			if (bounds) {
				const insertPos = bounds.contentEnd;
				const rawBefore = note.slice(0, insertPos);
				const before = rawBefore.replace(/\s*$/u, "");
				const after = note.slice(insertPos);
				const normalizedAfter = after.replace(/^\n+/u, "");
				const prefix = before.length > 0 ? `${before}\n\n` : before;
				const gap = normalizedAfter.length > 0 ? "\n" : "";
				return `${prefix}${sectionBlock}${gap}${normalizedAfter}`;
			}
		}
		const trimmed = note.trimEnd();
		const separator = trimmed.length > 0 ? "\n\n" : "";
		return `${trimmed}${separator}${sectionBlock}`;
	}

	private findSectionBounds(note: string, heading: string):
		| { headingStart: number; contentStart: number; contentEnd: number }
		| null {
		const pattern = new RegExp(
			`^####\\s+${this.escapeRegExp(heading)}\\s*$`,
			"m"
		);
		const match = pattern.exec(note);
		if (!match) return null;
		const headingStart = match.index;
		let contentStart = headingStart + match[0].length;
		if (note.slice(contentStart, contentStart + 2) === "\r\n") {
			contentStart += 2;
		} else if (note.slice(contentStart, contentStart + 1) === "\n") {
			contentStart += 1;
		}
		const nextHeadingPattern = /^####\s+/gm;
		nextHeadingPattern.lastIndex = contentStart;
		const next = nextHeadingPattern.exec(note);
		const contentEnd = next ? next.index : note.length;
		return { headingStart, contentStart, contentEnd };
	}

	private getSectionBody(note: string, heading: string): string | null {
		const bounds = this.findSectionBounds(note, heading);
		if (!bounds) return null;
		const body = note.slice(bounds.contentStart, bounds.contentEnd);
		return body.replace(/\s+$/u, "");
	}

	private formatSectionBody(body: string): string {
		const normalized = (body ?? "")
			.replace(/\r\n/g, "\n")
			.replace(/^\s*\n+/u, "")
			.replace(/\s+$/u, "");
		if (normalized.length === 0) {
			return "";
		}
		return `${normalized}\n`;
	}

	private normalizeSectionSpacing(note: string): string {
		// Ensure max 1 empty line between sections
		return note.replace(/\n{3,}/g, "\n\n");
	}

	private escapeRegExp(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	private extractMapLink(markdown: string): string | null {
		const match = markdown.match(/\[Open in Maps\]\([^)]+\)/);
		return match ? match[0] : null;
	}

	/**
	 * Resolves output directories and optional LLM override for the current subject.
	 */
	private resolveSubjectDirsAndLlm(): {
		notesDir: string;
		photosDir: string;
		llmLabelOverride?: string;
	} {
		const folders = this.plugin.settings.folders;
		const defaultFolder = this.subject.directory || BASES_DEFAULT_DIR;

		const notesDir = folders.notes?.trim() || defaultFolder;
		const photosDir = folders.photos?.trim() || `${notesDir}/photos`;
		const llmLabelOverride = folders.llmLabel?.trim() || undefined;

		return { notesDir, photosDir, llmLabelOverride };
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
	 * Surfaces vendor selection in the progress UI, and returns the raw JSON (or null on failure).
	 * @param base64Image Base64-encoded JPEG sent to the LLM.
	 * @param progressModal Logger interface to show info/error to the user.
	 * @returns Parsed JSON object from the AI client on success, or null on failure.
	 */
	private async fetchSubjectJson(
		base64Image: string,
		progressModal: {
			info: (m: string) => void;
			error: (m: string) => void;
		},
		exifData?: import("./image/PreparedImage").ExifData,
		llmLabelOverride?: string
	): Promise<any> {
		const isRedo = !!this.redoContext && this.redoContext.file.extension === "md";
		let prompt: string;
		if (isRedo && this.redoContext) {
			prompt = this.redoContext.prompt;
		} else {
			const context: SubjectPromptContext = {};
			if (exifData) {
				context.exifData = exifData;
			}
			prompt =
				typeof (this.subject as any).getPrompt === "function"
					? (this.subject as any).getPrompt(context)
					: this.subject.prompt;
		}

		// Resolve narrative style for the active subject (if any)
		const narrativeLabel = isRedo && this.redoContext?.noteData
			? this.getNarrativeStyleLabel(this.redoContext.noteData.properties)
			: this.getNarrativeStyleLabel();
		
		if (narrativeLabel && narrativeLabel !== "default") {
			const styleEntry = (
				this.plugin.settings.narrativeStyles || []
			).find((s) => s.label === narrativeLabel);

			if (styleEntry && styleEntry.narrativeStyle) {
				prompt += `\n\nNARRATIVE STYLE:\n${styleEntry.narrativeStyle}`;
				progressModal.info(`Applied narrative style: ${styleEntry.label}`);
			}
		}

		console.log(
			`[NoteTakerAI] Fetching subject JSON (redo=${isRedo}). Prompt length: ${prompt.length}`
		);

		const llmConfig = this.resolveLlmConfig(llmLabelOverride);
		if (!llmConfig) {
			progressModal.error(
				"No LLM configuration is available. Configure an LLM in settings first."
			);
			return null;
		}

		const { vendor, model, apiKey, label: llmLabel } = llmConfig;
		// Fallback for unset keys if user has them in env (mostly for dev/testing)
		const effectiveApiKey = apiKey; // || process.env[`${vendor.toUpperCase()}_API_KEY`] || "";

		if (!effectiveApiKey) {
			progressModal.error(
				`API Key missing for ${vendor} (model: ${model}). Please configure it in Settings.`
			);
			return null;
		}

		console.log(`[NoteTakerAI] Using LLM: ${vendor} / ${model} (${llmLabel})`);

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
				base64Image
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
				base64Image
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
		} else {
			progressModal.error(UNKNOWN_VENDOR_ERROR);
			return null;
		}

		if (!result.ok) {
			// Centralized user feedback 
			progressModal.error(result.error);
			console.error("AI call failed", result);
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
				return JSON.parse(cleaned);
			} catch (e) {
				console.error("JSON Parse Error", e, result.data);
				progressModal.error("Failed to parse AI response as JSON.");
				return null;
			}
		}

		return result.data;
	}

	/**
	 * Create the subject note file using the subject's filename and template rules,
	 * then open it in a new leaf if creation succeeds.
	 * Guards against duplicate filenames within the subject directory.
	 * @param info Parsed subject info produced by the subject.parse method.
	 * @param originalPhotoFile The processed/renamed photo TFile to link as cover.
	 * @param progressModal Logger to report status and errors.
	 */
	private async createSubjectNote(
		info: SubjectInfoBase,
		originalPhotoFile: TFile,
		progressModal: {
			info: (m: string) => void;
			error: (m: string) => void;
			done: (success: boolean) => void;
		},
		exifData: import("./image/PreparedImage").ExifData | null | undefined
	) {
		const fileName = this.sanitizeNoteFilename(
			this.subject.getNoteFilename(info)
		);
		const { notesDir } = this.resolveSubjectDirsAndLlm();
		const dir = notesDir || this.subject.directory || BASES_DEFAULT_DIR;
		// Ensure notes folder exists (no-op if already present)
		const abstract = this.plugin.app.vault.getAbstractFileByPath(dir);
		if (!abstract) {
			try {
				await this.plugin.app.vault.createFolder(dir);
			} catch {
				/* ignore if exists now */
			}
		}
		// Collision-safe note path generation: append numeric suffix if needed
		let basePath = `${dir}/${fileName}.md`;
		let filePath = basePath;
		let n = 2;
		while (this.plugin.app.vault.getAbstractFileByPath(filePath)) {
			filePath = `${dir}/${fileName} ${n}.md`;
			n++;
		}

		const photoLink = this.plugin.app.fileManager
			.generateMarkdownLink(originalPhotoFile, "")
			.replace(/^!/, "");
		const coverFileName = originalPhotoFile.name; // Preserve original filename including extension

		// Resolve narrative style label associated with the active subject
		const narrativeStyleLabel = this.getNarrativeStyleLabel();

		const baseContent = this.subject.buildNote(info, {
			photoLink,
			coverFileName,
			exifData: exifData || undefined,
			narrativeStyleLabel,
		});
		const content = this.normalizeSectionSpacing(baseContent);

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
		} catch (error) {
			console.error("Error creating new note:", error);
			progressModal.error(COULD_NOT_CREATE_NOTE);
		}
	}
}
