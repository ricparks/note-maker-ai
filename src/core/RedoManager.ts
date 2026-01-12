import { TFile, App, Notice } from "obsidian";
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
import { IMAGE_EXTENSIONS } from "../utils/constants";
import { PreparedImage } from "./image/PreparedImage";

// Image dimension limits for processing (Match Core constants)
const NOTE_IMAGE_MAX_WIDTH = 750;
const NOTE_IMAGE_MAX_HEIGHT = 1000;
const AI_IMAGE_MAX_DIM = 512;

const SECTION_HEADING_ALIASES: Record<string, string[]> = {
	"prompt additions": ["pa"],
	pa: ["prompt additions"],
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

export class RedoManager {
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
		console.log(`[NoteMakerAI] Processing active markdown: ${file.name}`);
		const additions = noteData.sections['Prompt Additions'] || noteData.sections['PA'] || noteData.sections['pa'];
		console.log(`[NoteMakerAI] Extracted PA for ${file.name}:`, additions ? additions.slice(0, 50) + "..." : "None");
		
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
		console.log("[NoteMakerAI] Redo raw subject:", resultCtx.data);
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
			console.error("Redo failed to parse subject data", error, raw);
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
		
		const photoLink = this.plugin.app.fileManager
			.generateMarkdownLink(photoFile, file.path)
			.replace(/^!/, "");
		const coverFileName = photoFile.name;

		const baseContent = subject.definition!.buildNote(parsed, {
			photoLink,
			coverFileName,
			exifData,
		});

		const sections = { ...noteData.sections };
		const myNotesKey = this.findSectionKey(sections, "My Notes");
		const promptKey = this.findSectionKey(sections, "Prompt Additions");

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

		const mediaKey = this.findSectionKey(sections, "Additional Media");
		if (mediaKey) {
			const mediaBody = sections[mediaKey] ?? "";
			if (mediaBody.trim().length > 0) {
				updated = `${updated.trimEnd()}\n\n#### Additional Media\n${mediaBody}`;
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
				subjectDir: notesDir,
				photosDir: photosDir,
				maxW: NOTE_IMAGE_MAX_WIDTH,
				maxH: NOTE_IMAGE_MAX_HEIGHT,
				aiMax: AI_IMAGE_MAX_DIM,
				keepOriginal: !!this.plugin.settings.image?.keepOriginalAfterResize,
				orientation: this.plugin.settings.image?.orientation,
				rotationDirection: this.plugin.settings.image?.rotationDirection,
				logger: {
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

    // --- Section Helpers (Duplicated from Core for now to isolate Redo logic) ---

    private sanitizeNoteFilename(name: string): string {
		const raw = (name ?? "")
			.replace(/[\\/:?*"<>|]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return raw.length > 0 ? raw : "NoteMakerAI Note";
	}

	private async renameRedoFileIfNeeded(
		file: TFile,
		parsed: SubjectInfoBase,
		progressModal: ReturnType<typeof createProgressModal>,
		subject: ActiveSubject
	): Promise<TFile> {
		const desiredBaseName = this.sanitizeNoteFilename(
			subject.definition!.getNoteFilename(parsed)
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

    private normalizeSectionSpacing(note: string): string {
		return note.replace(/\n{3,}/g, "\n\n");
	}
}
