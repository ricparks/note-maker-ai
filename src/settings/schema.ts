// Versioned settings schema for BaseMaker
// Central place for type definitions and defaults so other modules depend on a stable contract.

export const CURRENT_SETTINGS_VERSION = 3;

export type LlmVendor = 'openai' | 'gemini' | 'openrouter';

export interface LlmConfigEntry {
  /** Unique label (max 12 chars, alphanumeric/underscores) that users select elsewhere. */
  label: string;
  vendor: LlmVendor;
  model: string;
  apiKey: string;
}

export interface SubjectSettings {
  // Global subject-specific options (e.g., author format for books)
  authorFormatLastFirst: boolean;
}

export interface FolderSettings {
  notes: string;   // vault-relative
  photos: string;  // vault-relative
  llmLabel?: string;     // optional association to a specific LLM config label
  narrativeStyleLabel?: string; // optional default narrative style
}

export interface ExperimentalSettings {
  // Feature flags for in-progress ideas
  enableDebugLogging: boolean;
}

export interface ImageSettings {
  /** When a large image is resized, keep the original file instead of deleting it. */
  keepOriginalAfterResize: boolean;
}

/** Legacy V2 settings for migration reference */
export interface BaseMakerSettingsV2 {
  version: 2;
  llms: LlmConfigEntry[];
  defaultLlmLabel?: string;
  subject: {
      id: string;
      authorFormatLastFirst: boolean;
      warnOnMismatch?: boolean;
      mismatchThreshold?: number;
  };
  experimental: ExperimentalSettings;
  formatting: {};
  image: ImageSettings;
  subjectFolders?: Array<{
      subjectId: string;
      notesFolder: string;
      photosFolder: string;
      llmLabel?: string;
      narrativeStyleLabel?: string;
  }>;
  narrativeStyles?: NarrativeStyleEntry[];
}

export interface ValidationSettings {
  /** If true, warns when the AI predicts a category other than 'book' (e.g. wine, travel). */
  warnOnMismatch: boolean;
  /** Confidence threshold (0.0 - 1.0) above which to show the warning. */
  mismatchThreshold: number;
}

export interface BaseMakerSettingsV3 {
  version: 3;
  llms: LlmConfigEntry[];
  defaultLlmLabel?: string;
  folders: FolderSettings;
  subject: SubjectSettings;
  validation: ValidationSettings;
  experimental: ExperimentalSettings;
  formatting: {};
  image: ImageSettings;
  narrativeStyles?: NarrativeStyleEntry[];
}

export type BaseMakerSettings = BaseMakerSettingsV3;

// Narrative Style settings entries
export interface NarrativeStyleEntry {
  /** Unique label for narrative style (alphanumeric, max 8 chars). */
  label: string;
  /** Narrative style description (max 60 chars). */
  narrativeStyle: string;
}

export const DEFAULT_LLM_LABEL = 'default';

export const DEFAULT_SETTINGS: BaseMakerSettings = {
  version: CURRENT_SETTINGS_VERSION,
  llms: [
    {
      label: DEFAULT_LLM_LABEL,
      vendor: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: (process.env.GEMINI_API_KEY as string) || ''
    }
  ],
  defaultLlmLabel: DEFAULT_LLM_LABEL,
  folders: {
      notes: 'Bases/Books',
      photos: 'Bases/Books/photos'
  },
  subject: {
    authorFormatLastFirst: true,
  },
  validation: {
    warnOnMismatch: true,
    mismatchThreshold: 0.7
  },
  experimental: {
    enableDebugLogging: false
  },
  formatting: {
  },
  image: {
    keepOriginalAfterResize: false
  },
  narrativeStyles: []
};
