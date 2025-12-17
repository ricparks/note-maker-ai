// Generic subject typing to allow future expansion beyond wine.

import type { TFile } from 'obsidian';

/**
 * Base shape for parsed subject information returned from a SubjectDefinition.
 */
export interface SubjectInfoBase {
  // Title or main display name for the subject (e.g., wine name, book title)
  title: string;
  // Canonical secondary producer/author/etc.
  producer?: string;
  // Original JSON or object returned by the AI (for debugging or advanced templates)
  raw: any;
  // Arbitrary structured fields (normalized key/value pairs)
  fields: Record<string, string | number | boolean | null>;
}

export interface SubjectNoteSections {
  [heading: string]: string;
}

export interface SubjectNoteData {
  properties: Record<string, any>;
  sections: SubjectNoteSections;
  /** Optional subject-specific summary suitable for logging. */
  logSummary?: string;
}

export interface SubjectExistingNoteContext {
  file: TFile;
  content: string;
  frontmatter?: Record<string, any>;
}

export interface SubjectPromptContext {
  exifData?: import('../image/PreparedImage').ExifData;
  noteData?: SubjectNoteData;
  app?: import('obsidian').App;
  additionalPromptPath?: string;
  notesDir?: string;
  logInfo?: (message: string) => void;
}

/**
 * Contract for implementing a subject (e.g., books, wine). Each subject defines
 * how to prompt the LLM, how to parse its response, how to name files, and how
 * to build the markdown note content.
 */
export interface SubjectDefinition<T extends SubjectInfoBase = SubjectInfoBase> {
  id: string;                 // stable identifier (e.g., 'wine')
  prompt: string;             // AI prompt to send
  /** Optional: Build a prompt dynamically based on context (e.g., EXIF or parsed note data). If provided, takes precedence over 'prompt'. */
  getPrompt?(context: SubjectPromptContext): string | Promise<string>;
  getNoteFilename(info: T): string;  // derive filename (without extension)
  /**
   * Build the complete markdown content for a note, including YAML frontmatter and sections.
   * 
   * ## Framework Sections (for redo support)
   * 
   * To enable the redo feature (regenerating AI content while preserving user edits), 
   * your note template should include these framework-level sections:
   * 
   * - **`#### My Notes`** (required for redo): User content in this section is preserved
   *   when the note is regenerated. Without this section, users lose their personal notes
   *   on redo.
   * 
   * - **`#### Prompt Additions`** (optional, alias: `PA`): If present, content here is
   *   appended to the AI prompt during redo, allowing users to guide regeneration
   *   (e.g., "Focus more on the author's background").
   * 
   * ## Subject-Specific Sections
   * 
   * Beyond the framework sections, define any sections appropriate for your subject.
   * These will be regenerated from AI output on each redo:
   * 
   * - Books: `Summary`, `Themes`
   * - Wine: `Tasting Notes`, `Pairings`
   * - Travel: `Description`, `Points of Interest`
   * 
   * @param info - Parsed subject data from `parse()`
   * @param context - Optional photo/EXIF/LLM context for embedding images and metadata
   * @returns Complete markdown string including frontmatter and all sections
   */
  buildNote(info: T, context: { photoLink?: string; coverFileName?: string; exifData?: import('../image/PreparedImage').ExifData; llmModel?: string }): string;
  parse(aiJson: any): T;      // map AI JSON to typed structure with fallbacks
  // Optional per-subject note directory (relative inside vault). If omitted, fallback constant used.
  directory?: string;
  /** Optional hook to compute a canonical base photo file name (without extension). */
  getPhotoBasename?(info: T, context?: { exifData?: import('../image/PreparedImage').ExifData }): string;
  /** Optional ribbon icon id for this subject (lucide icon id). */
  ribbonIcon?: string;
  /** Optional ribbon title for this subject. */
  ribbonTitle?: string;
  /** Optional hook used during redo to parse an existing markdown note. */
  parseExistingNote?(note: SubjectExistingNoteContext): SubjectNoteData | Promise<SubjectNoteData>;
  /** Optional hook to validate parsed data and return a list of warning messages. */
  validateParsedData?(info: T): string[];
}
