import { SUBJECT_DIR, SUBJECT_PHOTOS_DIR } from "../utils/constants";

export const CURRENT_SETTINGS_VERSION = 3;

export type LlmVendor = 'openai' | 'gemini' | 'openrouter' | 'anthropic';

export interface LlmConfigEntry {
  /** Unique label (max 12 chars, alphanumeric/underscores) that users select elsewhere. */
  label: string;
  vendor: LlmVendor;
  model: string;
  apiKey: string;
}

export interface FolderSettings {
  notes: string;   // vault-relative
  photos: string;  // vault-relative
  llmLabel?: string;     // optional association to a specific LLM config label
  subjectDefinitionLocation?: string; // optional path to a markdown file defining subject instructions
}

export interface SubjectConfigEntry {
  name: string;
  notesDir: string;
  photosDir: string;
  subjectDefinitionPath: string;
  llmLabel?: string;
}

export type ReducedImageOrientation = 'maintain' | 'landscape' | 'portrait';
export type RotationDirection = 'clockwise' | 'counter-clockwise';

export interface ImageSettings {
  /** When a large image is resized, keep the original file instead of deleting it. */
  keepOriginalAfterResize: boolean;
  /** Orientation behavior for the reduced image. */
  orientation: ReducedImageOrientation;
  /** Direction to rotate when orientation change is needed. */
  rotationDirection: RotationDirection;
}

export interface NoteMakerAISettings {
  llms: LlmConfigEntry[];
  defaultLlmLabel?: string;

  folders?: FolderSettings;

  /** Configured subjects (new multi-subject support). */
  subjects: SubjectConfigEntry[];

  /** Global "Keep original after resize" setting. */

  image?: ImageSettings;
}

export const DEFAULT_LLM_LABEL = 'default';

export const DEFAULT_SETTINGS: NoteMakerAISettings = {
  llms: [
    {
      label: "gemini3",
      vendor: "gemini",
      model: "gemini-3-pro-preview",
      apiKey: process.env.GEMINI_API_KEY || "",
    },
  ],
  defaultLlmLabel: "gemini3",
  folders: {
    notes: SUBJECT_DIR,
    photos: SUBJECT_PHOTOS_DIR,
    subjectDefinitionLocation: "",
  },
  subjects: [],
  image: {
    keepOriginalAfterResize: true,
    orientation: 'maintain',
    rotationDirection: 'clockwise',
  },
};
