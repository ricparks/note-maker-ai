import { SUBJECT_DIR, SUBJECT_PHOTOS_DIR } from "../core/subject/implementation";

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

export interface ValidationSettings {
  /** If true, warns when the AI predicts a category other than 'book' (e.g. wine, travel). */
  warnOnMismatch: boolean;
  /** Confidence threshold (0.0 - 1.0) above which to show the warning. */
  mismatchThreshold: number;
}

// ------------------------------------------------------------------
// Settings V3 (Latest)
// ------------------------------------------------------------------
export interface NoteMakerAISettings {
  llms: LlmConfigEntry[];
  defaultLlmLabel?: string;

  folders: FolderSettings;

  /** Global "Keep original after resize" setting. */
  image?: ImageSettings;
  /** Validation guardrails. */
  validation: ValidationSettings;
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
  image: {
    keepOriginalAfterResize: false,
    orientation: 'maintain',
    rotationDirection: 'clockwise',
  },
  validation: {
    warnOnMismatch: true,
    mismatchThreshold: 0.7,
  },
};
