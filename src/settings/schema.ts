// Versioned settings schema for BaseMaker
// Central place for type definitions and defaults so other modules depend on a stable contract.

export const CURRENT_SETTINGS_VERSION = 2;

export type LlmVendor = 'openai' | 'gemini' | 'openrouter';
export type SubjectId = 'wine' | 'books' | 'travel'; // extended with travel

export interface LlmConfigEntry {
  /** Unique label (max 12 chars, alphanumeric/underscores) that users select elsewhere. */
  label: string;
  vendor: LlmVendor;
  model: string;
  apiKey: string;
}

export interface SubjectSettings {
  id: SubjectId;                 // active subject id
  // Future: per-subject toggles (e.g., enableCoverEmbed for books) could live here
  authorFormatLastFirst: boolean; // only applies to books currently
  warnOnMismatch?: boolean;       // warn if AI predicts a different category (except Travel)
  mismatchThreshold?: number;     // 0..1 threshold for warning
}

export interface SubjectFolderEntry {
  subjectId: SubjectId;
  notesFolder: string;   // vault-relative
  photosFolder: string;  // vault-relative
  llmLabel?: string;     // optional association to a specific LLM config label
  /** Optional association to a Narrative Style label (from settings.narrativeStyles[].label). */
  narrativeStyleLabel?: string;
}

export interface FormattingSettings {
  // Reserved for future generic formatting options
}

export interface ExperimentalSettings {
  // Feature flags for in-progress ideas
  enableDebugLogging: boolean;
}

export interface ImageSettings {
  /** When a large image is resized, keep the original file instead of deleting it. */
  keepOriginalAfterResize: boolean;
}

export interface BaseMakerSettingsV1 {
  version: number;           // schema version
  llm: any;
  subject: SubjectSettings;
  experimental: ExperimentalSettings;
  formatting: FormattingSettings;
  image: ImageSettings;
  subjectFolders?: SubjectFolderEntry[];
  narrativeStyles?: NarrativeStyleEntry[];
}

export interface BaseMakerSettingsV2 {
  version: number;
  llms: LlmConfigEntry[];
  defaultLlmLabel?: string;
  subject: SubjectSettings;
  experimental: ExperimentalSettings;
  formatting: FormattingSettings;
  image: ImageSettings;
  subjectFolders?: SubjectFolderEntry[];
  narrativeStyles?: NarrativeStyleEntry[];
}

export type BaseMakerSettings = BaseMakerSettingsV2;

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
  subject: {
    id: 'travel',
    authorFormatLastFirst: true,
    warnOnMismatch: true,
    mismatchThreshold: 0.7
  },
  experimental: {
    enableDebugLogging: false
  },
  formatting: {
  }
  ,
  image: {
    keepOriginalAfterResize: false // previous behavior: delete original after resize
  },
  subjectFolders: [],
  narrativeStyles: []
};
