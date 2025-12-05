import type NoteTakerAI from '../main';
import {
  BaseMakerSettings,
  DEFAULT_SETTINGS,
  CURRENT_SETTINGS_VERSION,
  DEFAULT_LLM_LABEL,
  LlmConfigEntry,
  LlmVendor,
  BaseMakerSettingsV2,
} from './schema';

type LegacySettings = {
  llmVendor?: LlmVendor;
  openaiModel?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  subjectId?: string;
  subjectFolders?: Array<{ subjectId: any; notesFolder?: string; photosFolder?: string; llmLabel?: string; narrativeStyleLabel?: string; vendor?: LlmVendor }>;
} & Record<string, any>;

type Version1Settings = {
  version: 1;
  llm: {
    vendor: LlmVendor;
    openaiModel: string;
    geminiModel: string;
    openaiApiKey: string;
    geminiApiKey: string;
  };
  subject: BaseMakerSettings['subject'];
  experimental: BaseMakerSettings['experimental'];
  formatting: BaseMakerSettings['formatting'];
  image: BaseMakerSettings['image'];
  subjectFolders?: Array<{ subjectId: any; notesFolder?: string; photosFolder?: string; llmLabel?: string; narrativeStyleLabel?: string; vendor?: LlmVendor }>;
  narrativeStyles?: BaseMakerSettings['narrativeStyles'];
} & Record<string, any>;

// Simple migration framework (expand as versions evolve)
// Simple migration framework (expand as versions evolve)
function migrate(raw: any): BaseMakerSettings {
  // If there's no version, attempt to map from legacy flat structure.
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS);

  const normalizeLabels = (entries: LlmConfigEntry[]): LlmConfigEntry[] => {
    const seen = new Set<string>();
    return entries
      .map((entry) => ({
        ...entry,
        label: entry.label.trim().slice(0, 12),
        model: entry.model.trim(),
        apiKey: entry.apiKey.trim(),
      }))
      .filter((entry) => {
        if (!entry.label) return false;
        if (seen.has(entry.label)) return false;
        seen.add(entry.label);
        return true;
      });
  };

  const fromLegacy = (legacyRaw: LegacySettings): BaseMakerSettings => {
    const vendor: LlmVendor = legacyRaw.llmVendor || DEFAULT_SETTINGS.llms[0].vendor;
    const llmEntries: LlmConfigEntry[] = [];

    const openaiEntry: LlmConfigEntry = {
      label: 'openai',
      vendor: 'openai',
      model: legacyRaw.openaiModel || 'gpt-4o',
      apiKey: legacyRaw.openaiApiKey || '',
    };
    const geminiEntry: LlmConfigEntry = {
      label: 'gemini',
      vendor: 'gemini',
      model: legacyRaw.geminiModel || 'gemini-2.5-flash',
      apiKey: legacyRaw.geminiApiKey || '',
    };

    llmEntries.push(openaiEntry, geminiEntry);
    const normalized = normalizeLabels(llmEntries);
    const defaultLabel = vendor === 'openai' ? 'openai' : 'gemini';

    const settings: BaseMakerSettings = {
      ...structuredClone(DEFAULT_SETTINGS),
      llms: normalized.length > 0 ? normalized : structuredClone(DEFAULT_SETTINGS.llms),
      defaultLlmLabel: normalized.some((entry) => entry.label === defaultLabel)
        ? defaultLabel
        : DEFAULT_SETTINGS.defaultLlmLabel,
      subject: {
        authorFormatLastFirst: true,
      },
      experimental: structuredClone(DEFAULT_SETTINGS.experimental),
      formatting: structuredClone(DEFAULT_SETTINGS.formatting),
      image: structuredClone(DEFAULT_SETTINGS.image),
      narrativeStyles: legacyRaw.narrativeStyles || structuredClone(DEFAULT_SETTINGS.narrativeStyles),
      folders: structuredClone(DEFAULT_SETTINGS.folders),
      validation: structuredClone(DEFAULT_SETTINGS.validation),
      version: CURRENT_SETTINGS_VERSION,
    };
    return settings;
  };

  if (typeof raw.version !== 'number') {
    return fromLegacy(raw as LegacySettings);
  }

  if (raw.version === 1) {
    // V1 was short-lived; migrating to V3 via V2 logic roughly
    // Just reset to defaults for simplicity as V1 usage is negligible in this context
    return structuredClone(DEFAULT_SETTINGS);
  }

  if (raw.version === 2) {
      const v2 = raw as BaseMakerSettingsV2;
      const merged: BaseMakerSettings = {
          ...structuredClone(DEFAULT_SETTINGS),
          llms: v2.llms || structuredClone(DEFAULT_SETTINGS.llms),
          defaultLlmLabel: v2.defaultLlmLabel || DEFAULT_SETTINGS.defaultLlmLabel,
          experimental: v2.experimental || structuredClone(DEFAULT_SETTINGS.experimental),
          formatting: v2.formatting || structuredClone(DEFAULT_SETTINGS.formatting),
          image: v2.image || structuredClone(DEFAULT_SETTINGS.image),
          narrativeStyles: v2.narrativeStyles || structuredClone(DEFAULT_SETTINGS.narrativeStyles),
          subject: {
              authorFormatLastFirst: v2.subject?.authorFormatLastFirst ?? DEFAULT_SETTINGS.subject.authorFormatLastFirst,
          },
          validation: structuredClone(DEFAULT_SETTINGS.validation),
          version: CURRENT_SETTINGS_VERSION
      };

      // Migrate book folder settings if present
      const bookFolders = v2.subjectFolders?.find(f => f.subjectId === 'books');
      if (bookFolders) {
          merged.folders = {
              notes: bookFolders.notesFolder || DEFAULT_SETTINGS.folders.notes,
              photos: bookFolders.photosFolder || DEFAULT_SETTINGS.folders.photos,
              llmLabel: bookFolders.llmLabel,
              narrativeStyleLabel: bookFolders.narrativeStyleLabel
          };
      }

      return merged;
  }

  // Handle current version (re-merge to ensure new defaults)
  const merged: BaseMakerSettings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...(raw as BaseMakerSettings),
  };

  merged.llms = normalizeLabels(merged.llms || []);
  if (merged.llms.length === 0) {
    merged.llms = structuredClone(DEFAULT_SETTINGS.llms);
  }
  const labels = new Set(merged.llms.map((entry) => entry.label));
  if (!merged.defaultLlmLabel || !labels.has(merged.defaultLlmLabel)) {
    merged.defaultLlmLabel = merged.llms[0]?.label || DEFAULT_LLM_LABEL;
  }
  merged.narrativeStyles = merged.narrativeStyles || structuredClone(DEFAULT_SETTINGS.narrativeStyles);

  return merged;
}

export class SettingsManager {
  private _settings: BaseMakerSettings = DEFAULT_SETTINGS;
  constructor(private plugin: NoteTakerAI) {}

  get data(): BaseMakerSettings { return this._settings; }

  async load() {
    const stored = await this.plugin.loadData();
    this._settings = migrate(stored);
  }

  async save() {
    await this.plugin.saveData(this._settings);
  }

  update<T>(mutator: (draft: BaseMakerSettings) => T): T {
    const result = mutator(this._settings);
    return result;
  }

  async updateAndSave<T>(mutator: (draft: BaseMakerSettings) => T): Promise<T> {
    const res = this.update(mutator);
    await this.save();
    return res;
  }
}
