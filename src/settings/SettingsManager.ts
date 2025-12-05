import type BaseMakerPlugin from '../main';
import {
  BaseMakerSettings,
  DEFAULT_SETTINGS,
  CURRENT_SETTINGS_VERSION,
  DEFAULT_LLM_LABEL,
  LlmConfigEntry,
  LlmVendor,
  SubjectFolderEntry,
} from './schema';

type LegacySettings = {
  llmVendor?: LlmVendor;
  openaiModel?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  subjectId?: string;
  subjectFolders?: Array<Partial<SubjectFolderEntry> & { vendor?: LlmVendor }>;
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
  subjectFolders?: Array<Partial<SubjectFolderEntry> & { vendor?: LlmVendor }>;
  narrativeStyles?: BaseMakerSettings['narrativeStyles'];
} & Record<string, any>;

// Simple migration framework (expand as versions evolve)
function migrate(raw: any): BaseMakerSettings {
  // If there's no version, attempt to map from legacy flat structure.
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS);

  const ensureDefaultSubjectId = (settings: BaseMakerSettings) => {
    const validIds = new Set(['wine', 'books', 'travel']);
    const currentId = (settings.subject && (settings.subject as any).id) as string | undefined;
    if (!currentId || !validIds.has(currentId)) {
      settings.subject.id = DEFAULT_SETTINGS.subject.id;
    }
  };

  const sanitizeSubjectFolders = (
    entries: SubjectFolderEntry[] | undefined,
    availableLabels: Set<string>
  ): SubjectFolderEntry[] => {
    if (!entries?.length) return [];
    return entries.map((entry) => {
      const cleaned: SubjectFolderEntry = {
        subjectId: entry.subjectId,
        notesFolder: entry.notesFolder || '',
        photosFolder: entry.photosFolder || '',
        narrativeStyleLabel: entry.narrativeStyleLabel,
      };
      if (entry.llmLabel && availableLabels.has(entry.llmLabel)) {
        cleaned.llmLabel = entry.llmLabel;
      }
      return cleaned;
    });
  };

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
        ...structuredClone(DEFAULT_SETTINGS.subject),
        id: (legacyRaw.subjectId as any) || DEFAULT_SETTINGS.subject.id,
        authorFormatLastFirst: true,
      },
      experimental: structuredClone(DEFAULT_SETTINGS.experimental),
      formatting: structuredClone(DEFAULT_SETTINGS.formatting),
      image: structuredClone(DEFAULT_SETTINGS.image),
      subjectFolders: sanitizeSubjectFolders((legacyRaw.subjectFolders as any) || [], new Set()),
      narrativeStyles: legacyRaw.narrativeStyles || structuredClone(DEFAULT_SETTINGS.narrativeStyles),
      version: CURRENT_SETTINGS_VERSION,
    };
    ensureDefaultSubjectId(settings);
    return settings;
  };

  if (typeof raw.version !== 'number') {
    return fromLegacy(raw as LegacySettings);
  }

  if (raw.version === 1) {
    const v1 = raw as Version1Settings;
    const entries: LlmConfigEntry[] = normalizeLabels([
      {
        label: 'openai',
        vendor: 'openai',
        model: v1.llm?.openaiModel || 'gpt-4o',
        apiKey: v1.llm?.openaiApiKey || '',
      },
      {
        label: 'gemini',
        vendor: 'gemini',
        model: v1.llm?.geminiModel || 'gemini-2.5-flash',
        apiKey: v1.llm?.geminiApiKey || '',
      },
    ]);

    const availableLabels = new Set(entries.map((entry) => entry.label));
    const folderEntries = (v1.subjectFolders || []).map((entry) => {
      const { vendor, ...rest } = entry;
      const mapped: SubjectFolderEntry = {
        subjectId: rest.subjectId as any,
        notesFolder: rest.notesFolder || '',
        photosFolder: rest.photosFolder || '',
        narrativeStyleLabel: rest.narrativeStyleLabel,
      };
      if (vendor) {
        const proposed = vendor === 'openai' ? 'openai' : 'gemini';
        if (availableLabels.has(proposed)) {
          mapped.llmLabel = proposed;
        }
      }
      return mapped;
    });

    const defaultLabel = entries.find((entry) => entry.vendor === v1.llm.vendor)?.label;

    const migrated: BaseMakerSettings = {
      version: CURRENT_SETTINGS_VERSION,
      llms: entries.length > 0 ? entries : structuredClone(DEFAULT_SETTINGS.llms),
      defaultLlmLabel: defaultLabel || DEFAULT_SETTINGS.defaultLlmLabel,
      subject: structuredClone(v1.subject),
      experimental: structuredClone(v1.experimental),
      formatting: structuredClone(v1.formatting),
      image: structuredClone(v1.image),
      subjectFolders: folderEntries,
      narrativeStyles: v1.narrativeStyles || structuredClone(DEFAULT_SETTINGS.narrativeStyles),
    };

    ensureDefaultSubjectId(migrated);
    return migrated;
  }

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
  merged.subjectFolders = sanitizeSubjectFolders(merged.subjectFolders, labels);
  merged.narrativeStyles = merged.narrativeStyles || structuredClone(DEFAULT_SETTINGS.narrativeStyles);

  ensureDefaultSubjectId(merged);

  return merged;
}

export class SettingsManager {
  private _settings: BaseMakerSettings = DEFAULT_SETTINGS;
  constructor(private plugin: BaseMakerPlugin) {}

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
