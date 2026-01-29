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
import { Logger } from "../utils/logger";
import { TFile, App, Notice, MarkdownView, normalizePath, stringifyYaml } from "obsidian";
import { createProgressModal } from "../ui/progress/ProgressModal";
import type NoteMakerAI from "../main";
import type { NoteMakerCore } from "./NoteMakerCore";
import type {
	SubjectInfoBase,
	SubjectNoteData,
	SubjectExistingNoteContext,
	SubjectPromptContext,
	ActiveSubject,
	SubjectNoteSections
} from "./subject";
import type { ExifData } from "./image/PreparedImage";
import { SubjectDefinition } from "./subject/types";
import { confirm } from "../ui/confirm/ConfirmModal";
import {
	IMAGE_EXTENSIONS,
	NOTE_IMAGE_MAX_WIDTH,
	NOTE_IMAGE_MAX_HEIGHT,
	AI_IMAGE_MAX_DIM,
	MAX_COLLISION_ATTEMPTS,
} from "../utils/constants";
import { sanitizeNoteFilename, normalizeSectionSpacing } from "../utils/noteUtils";
import { PreparedImage } from "./image/PreparedImage";

const SECTION_HEADING_ALIASES: Record<string, string[]> = {
	"redo instructions": ["ri"],
	ri: ["redo instructions"],
	"additional media": ["media"],
	media: ["additional media"],
};

type RedoContext = {
	file: TFile;
	noteData: SubjectNoteData;
	markdown: string;
	exifData?: ExifData;
	prompt: string;
	photoFile: TFile;
	photoBase64: string;
	rawSubject?: any;
};

/**
 * RedoManager handles the "redo" workflow for regenerating AI content on existing notes.
 * It extracts preserved sections (My Notes, Redo Instructions, Additional Media),
 * fetches fresh AI data using the original photo, and rebuilds the note while
 * preserving user-maintained content and touch_me_not properties.
 */
export class RedoManager {
	/** Context retained between processActiveMarkdown and updateRedoNote */
	private redoContext: RedoContext | null = null;

    constructor(private plugin: NoteMakerAI, private core: NoteMakerCore) {}

    public async processActiveMarkdown(
		file: TFile,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): Promise<void> {
		this.redoContext = null;
		progressModal.info("Redoing image");
		
		const subjectAny = subject.definition! as unknown as {
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

		// Safety Check: Verify subject matches origin
		// We trust 'note_created_by' in frontmatter if present
		if (frontmatter && frontmatter['note_created_by']) {
			const origin = this.sanitizeId(frontmatter['note_created_by']);
			const target = this.sanitizeId(subject.definition!.id || subject.name);

			if (origin !== target && origin.length > 0) {
				const originName = frontmatter['note_created_by']; // Display name
				const targetName = subject.name; // Display name

				const msg = `Subject Mismatch\n\nThis note was originally created as **${originName}**, but you are about to redo it using the **${targetName}** subject.\n\nThis will likely overwrite properties and sections with incorrect data.\n\nAre you sure you want to proceed?`;
				
				const res = await confirm(this.plugin.app, msg);
				if (!res.ok) {
					progressModal.info("Redo cancelled by user.");
					progressModal.done(false);
					return;
				}
			}
		}

		const exifFromNote = this.extractExifFromProperties(noteData.properties);
		const promptContext: SubjectPromptContext = {};
		if (noteData) {
			promptContext.noteData = noteData;
		}
		if (exifFromNote) {
			promptContext.exifData = exifFromNote;
		}
		
        const { notesDir, llmLabelOverride } = this.core.resolveSubjectDirsAndLlm(subject);
		promptContext.app = this.plugin.app;

		promptContext.notesDir = notesDir;
		promptContext.logInfo = (m) => progressModal.info(m);

		const prompt =
			typeof (subject.definition! as any).getPrompt === "function"
				? await (subject.definition! as any).getPrompt(promptContext)
				: subject.definition!.prompt;
		
		// DEBUG logging for prompt generation
		Logger.info(`[NoteMakerAI] Processing active markdown: ${file.name}`);
		const additions = noteData.sections['Redo Instructions'] || noteData.sections['RI'] || noteData.sections['ri'];
		Logger.debug(`[NoteMakerAI] Extracted RI for ${file.name}:`, additions ? additions.slice(0, 50) + "..." : "None");
		
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
			Logger.error("Failed to read photo for redo", error);
			progressModal.error(
				"Redo failed: could not read the linked photo for this note."
			);
			progressModal.done(false);
			return;
		}

		this.redoContext = {
			file,
			noteData,
			markdown: content,
			exifData: exifFromNote,
			prompt,
			photoFile,
			photoBase64,
		};
		if (noteData.logSummary) {
			progressModal.info(noteData.logSummary);
		} else {
			progressModal.info("Parsed markdown note");
		}

		if (additions) {
			progressModal.info("Prompt updated with your custom instructions");
		}
		
		progressModal.info("Analyzing original photo with AI...");
        
		const resultCtx = await this.core.fetchSubjectJson(
			photoBase64,
			progressModal,
			exifFromNote,
			llmLabelOverride,
			subject,
			prompt // Pass our explicit prompt
		);
		if (!resultCtx) {
			progressModal.error(
				"Redo failed while fetching updated subject data."
			);
			progressModal.done(false);
			return;
		}
		Logger.debug("[NoteMakerAI] Redo raw subject:", resultCtx.data);
		this.redoContext.rawSubject = resultCtx.data;
		progressModal.info("Fetched redo subject data");

		const parsed = this.parseRedoSubject(resultCtx.data, progressModal, subject);
		if (!parsed) {
			this.redoContext = null;
			return;
		}
		progressModal.info("Parsed redo subject data");
		
		await this.processAdditionalMedia(
			this.redoContext.noteData,
			parsed,
			progressModal,
			subject
		);

		await this.updateRedoNote(parsed, progressModal, subject);
	}

    private parseRedoSubject(
		raw: any,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): SubjectInfoBase | null {
		try {
			return subject.definition!.parse(raw);
		} catch (error) {
			Logger.error("Redo failed to parse subject data", error, raw);
			progressModal.error("Redo failed: unable to parse subject data.");
			progressModal.done(false);
			return null;
		}
	}

    private async updateRedoNote(
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): Promise<void> {
		if (!this.redoContext) {
			progressModal.error("Redo failed: missing context.");
			progressModal.done(false);
			return;
		}
		const { noteData, photoFile, exifData } = this.redoContext;
		
        let file = await this.renameRedoFileIfNeeded(
			this.redoContext.file,
			parsed,
			progressModal,
			subject
		);
		this.redoContext.file = file;
		
        // Rename photo if the subject data has changed (e.g. Artist/Album name update)
		const updatedPhoto = await this.renameRedoPhotoIfNeeded(
			photoFile,
			parsed,
			progressModal,
			subject
		);
		this.redoContext.photoFile = updatedPhoto;

		const photoLink = this.plugin.app.fileManager
			.generateMarkdownLink(updatedPhoto, file.path)
			.replace(/^!/, "");
		const coverFileName = updatedPhoto.name;

		// Get components separately: pure markdown body and frontmatter object
		const { frontmatter, body } = subject.definition!.getNoteParts(parsed, {
			photoLink,
			coverFileName,
			exifData,
		});

		// --- Option B: Complete regeneration with selective preservation ---
		
		// Step 1: Get list of preserved (touch_me_not) fields
		const preservedFields = new Set<string>();
		if (typeof (subject.definition! as any).getPreservedFields === "function") {
			const keys = (subject.definition! as any).getPreservedFields() as string[];
			keys.forEach(k => preservedFields.add(k));
		}

		// Step 2: Extract preserved values from OLD frontmatter (noteData.properties)
		const oldProperties = noteData.properties || {};
		for (const key of preservedFields) {
			if (oldProperties[key] !== undefined) {
				// Override the new frontmatter with the preserved old value
				frontmatter[key] = oldProperties[key];
			}
		}

		const sections = { ...noteData.sections };
		
		// My Notes handling
		const myNotesHeadings = typeof (subject.definition! as any).getMyNotesSectionHeadings === "function" 
			? (subject.definition! as any).getMyNotesSectionHeadings() as string[] 
			: [];

		const promptKey = this.findSectionKey(sections, "Redo Instructions");

		// We merge SECTIONS into the BODY logic
		let updatedBody = body;

		// Inject My Notes sections
		for (const myNotesHeading of myNotesHeadings) {
			const myNotesKey = this.findSectionKey(sections, myNotesHeading);
			if (myNotesKey) {
				updatedBody = this.replaceSectionVariants(updatedBody, [myNotesKey, myNotesHeading], sections[myNotesKey] ?? "");
			}
		}

		if (promptKey) {
			const promptBody = sections[promptKey] ?? "";
			const exists = this.sectionExists(updatedBody, promptKey) || this.sectionExists(updatedBody, "Redo Instructions");
			if (exists) {
				updatedBody = this.replaceSectionVariants(updatedBody, [promptKey, "Redo Instructions"], promptBody);
			} else {
				// If promptKey doesn't exist, insert it. Priority: after the first MyNotes section, or just at end?
				// Logic: Insert after the LAST detected MyNotes section, or fall back to "My Notes" alias
				
				let afterCandidates = ["My Notes"];
				if (myNotesHeadings.length > 0) {
					afterCandidates = myNotesHeadings.map(h => this.normalizeHeading(h));
				}
				
				// We need original casing for exact matches in insertSectionAfter, assume myNotesHeadings are correct.
				updatedBody = this.insertSectionAfter(updatedBody, myNotesHeadings.length > 0 ? myNotesHeadings : ["My Notes"], promptKey, promptBody);
			}
		}

		const mediaKey = this.findSectionKey(sections, "Additional Media");
		if (mediaKey) {
			const mediaBody = sections[mediaKey] ?? "";
			if (mediaBody.trim().length > 0) {
				updatedBody = `${updatedBody.trimEnd()}\n\n#### Additional Media\n${mediaBody}`;
			}
		}

		updatedBody = normalizeSectionSpacing(updatedBody);

		try {
			// Step 3: Build complete note content fresh (no preserving old frontmatter block)
			// Use the same YAML serialization approach as FileDefinedSubject.buildNote
			const finalContent = this.buildNoteContent(frontmatter, updatedBody, subject);
			
			await this.plugin.app.vault.modify(file, finalContent);

			progressModal.info("Updated note with regenerated content");
			progressModal.done(true);
			this.redoContext = null;
		} catch (error) {
			Logger.error("Redo failed while writing note", error);
			progressModal.error("Redo failed: could not write the updated note.");
			progressModal.done(false);
		}
	}

	/**
	 * Builds complete note content with frontmatter and body.
	 * Handles boolean serialization to ensure true/false (not Yes/No).
	 */
	private buildNoteContent(
		frontmatter: Record<string, any>,
		body: string,
		subject: ActiveSubject
	): string {
		// Clone frontmatter to avoid mutating the original
		const fm = { ...frontmatter };
		
		// Extract boolean values to append manually as "true"/"false" literals,
		// bypassing Obsidian's stringifyYaml which might output "Yes"/"No".
		const booleanFields: Record<string, boolean> = {};
		const subjectDef = subject.definition! as any;
		
		// Get property definitions if available
		const properties: Array<{ key: string; type?: string; default?: any }> = 
			subjectDef.definition?.properties || [];
		
		for (const prop of properties) {
			const key = prop.key;
			let val = fm[key];
			
			// Check if this property is supposed to be a boolean
			const isBoolType = prop.type === 'boolean' || typeof prop.default === 'boolean';
			
			if (isBoolType && val !== undefined && val !== null) {
				// Normalize to boolean if it's currently a string "Yes"/"No"/"true"/"false"
				if (typeof val === 'string') {
					const lower = val.toLowerCase();
					if (lower === 'yes' || lower === 'true' || lower === 'on') val = true;
					else if (lower === 'no' || lower === 'false' || lower === 'off') val = false;
				}
				
				// If we successfully resolved a boolean, save it and remove from main frontmatter
				if (typeof val === 'boolean') {
					booleanFields[key] = val;
					delete fm[key];
				}
			} else if (typeof val === 'boolean') {
				// Also catch implicit booleans not explicitly defined as such (rare but safer)
				booleanFields[key] = val;
				delete fm[key];
			}
		}

		let yamlString = stringifyYaml(fm).trim();
		
		// Manually append the boolean fields
		// This ensures they are always written as `key: true` or `key: false`
		for (const key in booleanFields) {
			if (yamlString.length > 0) yamlString += '\n';
			yamlString += `${key}: ${booleanFields[key]}`;
		}

		return `---\n${yamlString}\n---\n${body}`;
	}


    private async processAdditionalMedia(
		noteData: SubjectNoteData,
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): Promise<void> {
		const resultCtx = this.redoContext;
		if (!resultCtx) return;

		const mediaKey = this.findSectionKey(
			noteData.sections,
			"Additional Media"
		);
		if (!mediaKey) return;

		const sectionText = noteData.sections[mediaKey];
		if (!sectionText) return;

		// Find all links: [[...]] or ![[...]]
		const linkRegex = /(!?\[\[)([^\]|]+)((?:\|[^\]]*)?]])/g;
		const matches = Array.from(sectionText.matchAll(linkRegex));

		if (matches.length === 0) return;

		progressModal.info(
			`Processing ${matches.length} additional media item${
				matches.length === 1 ? "" : "s"
			}...`
		);

		let newSectionText = sectionText;
		const replacements: {
			start: number;
			end: number;
			newText: string;
		}[] = [];

		const { notesDir, photosDir } = this.core.resolveSubjectDirsAndLlm(subject);
		const baseNameCandidate = (subject.definition! as any).getPhotoBasename
			? (subject.definition! as any).getPhotoBasename(parsed)
			: "image";

		for (const match of matches) {
			const prefix = match[1];
			const linkPath = match[2];
			const suffix = match[3];

			const sourceFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
				linkPath,
				resultCtx.file.path
			);

			if (
				!sourceFile ||
				!IMAGE_EXTENSIONS.includes((sourceFile.extension || "").toLowerCase())
			) {
				continue;
			}

			const prepared = new PreparedImage(this.plugin.app, sourceFile, {
				photosDir: photosDir,
				maxW: NOTE_IMAGE_MAX_WIDTH,
				maxH: NOTE_IMAGE_MAX_HEIGHT,
				aiMax: AI_IMAGE_MAX_DIM,
				keepOriginal: !!this.plugin.settings.image?.keepOriginalAfterResize,
				orientation: this.plugin.settings.image?.orientation,
				rotationDirection: this.plugin.settings.image?.rotationDirection,
				progressReporter: {
					info: (m) => progressModal.info(`[Media] ${m}`),
					error: (m) => progressModal.error(`[Media] ${m}`),
				},
			});

			const ok = await prepared.ensurePrepared();
			if (!ok) continue;

			await prepared.writeFile();

			// Rename using canonical base (handles collisions)
			const finalFile = await prepared.renameTo(
				baseNameCandidate.toString()
			);

			await prepared.deleteOriginal();

			const generated = this.plugin.app.fileManager.generateMarkdownLink(
				finalFile,
				resultCtx.file.path
			);
			// strip [[ and ]] to get the inner path
			const barePath = generated
				.replace(/^!\[\[/, "")
				.replace(/\]\]$/, "")
				.replace(/^\[\[/, "");

			const newLink = `${prefix}${barePath}${suffix}`;
			replacements.push({
				start: match.index!,
				end: match.index! + match[0].length,
				newText: newLink,
			});
		}

		// Apply replacements in reverse order to preserve indices
		replacements.reverse().forEach((rep) => {
			newSectionText =
				newSectionText.slice(0, rep.start) +
				rep.newText +
				newSectionText.slice(rep.end);
		});

		noteData.sections[mediaKey] = newSectionText;
	}
    
    // --- Utils & Helpers ---

    private sanitizeId(name: string): string {
		return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
	}

    private extractExifFromProperties(
		properties?: Record<string, any>
	): ExifData | undefined {
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

		const exif: ExifData = {};
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

    // --- Section Helpers ---

	private async renameRedoFileIfNeeded(
		file: TFile,
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): Promise<TFile> {
		const desiredBaseName = sanitizeNoteFilename(
			subject.definition!.getNoteFilename(parsed)
		);
		if (desiredBaseName === file.basename) {
			return file;
		}

		const dir = file.parent ? file.parent.path : "";
		const buildPath = (attempt: number) => {
			const base = attempt === 0 ? desiredBaseName : `${desiredBaseName} ${attempt + 1}`;
			return normalizePath(dir ? `${dir}/${base}.md` : `${base}.md`);
		};

		let attempt = 0;
		let targetPath = buildPath(attempt);
		while (targetPath !== file.path && attempt < MAX_COLLISION_ATTEMPTS) {
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

	private async renameRedoPhotoIfNeeded(
		photoFile: TFile,
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): Promise<TFile> {
        // If subject definition doesn't support getPhotoBasename, we can't determine the correct name
		if (typeof (subject.definition! as any).getPhotoBasename !== "function") {
			return photoFile;
		}

		const desiredBaseName = (subject.definition! as any).getPhotoBasename(parsed);
        // Current name without extension
        const currentBaseName = photoFile.basename;

		if (desiredBaseName === currentBaseName) {
			return photoFile;
		}

		const dir = photoFile.parent ? photoFile.parent.path : "";
        const ext = photoFile.extension;
		const buildPath = (attempt: number) => {
			const base = attempt === 0 ? desiredBaseName : `${desiredBaseName}_${attempt + 1}`;
			return normalizePath(dir ? `${dir}/${base}.${ext}` : `${base}.${ext}`);
		};

		let attempt = 0;
		let targetPath = buildPath(attempt);
        // Avoid collision with EXISTING files (excluding itself)
		while (targetPath !== photoFile.path && attempt < MAX_COLLISION_ATTEMPTS) {
			const existing = this.plugin.app.vault.getAbstractFileByPath(targetPath);
			if (!existing) break;
			attempt += 1;
			targetPath = buildPath(attempt);
		}

		if (targetPath === photoFile.path) {
			return photoFile;
		}

		await this.plugin.app.fileManager.renameFile(photoFile, targetPath);
		progressModal.info(`Renamed photo to ${targetPath.split('/').pop()}`);
		const updated = this.plugin.app.vault.getAbstractFileByPath(targetPath);
		return updated instanceof TFile ? updated : photoFile;
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
			`^#{1,6}\\s+${this.escapeRegExp(heading)}\\s*$`,
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
		const nextHeadingPattern = /^#{1,6}\s+/gm;
		nextHeadingPattern.lastIndex = contentStart;
		const next = nextHeadingPattern.exec(note);
		const contentEnd = next ? next.index : note.length;
		return { headingStart, contentStart, contentEnd };
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

	private escapeRegExp(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}
