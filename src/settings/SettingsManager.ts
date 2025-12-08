import type NoteMakerAI from '../main';
import {
  NoteMakerAISettings,
  DEFAULT_SETTINGS,
} from './schema';

export class SettingsManager {
  private _settings: NoteMakerAISettings = DEFAULT_SETTINGS;
  constructor(private plugin: NoteMakerAI) {}

  get data(): NoteMakerAISettings { return this._settings; }

  async load() {
    const stored = await this.plugin.loadData();
    // Deep merge with defaults to ensure all nested fields exist
    this._settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      folders: { ...DEFAULT_SETTINGS.folders, ...stored?.folders },
      image: { ...DEFAULT_SETTINGS.image, ...stored?.image },
      validation: { ...DEFAULT_SETTINGS.validation, ...stored?.validation },
      llms: stored?.llms ?? DEFAULT_SETTINGS.llms,
    };
  }

  async save() {
    await this.plugin.saveData(this._settings);
  }

  update<T>(mutator: (draft: NoteMakerAISettings) => T): T {
    const result = mutator(this._settings);
    return result;
  }

  async updateAndSave<T>(mutator: (draft: NoteMakerAISettings) => T): Promise<T> {
    const res = this.update(mutator);
    await this.save();
    return res;
  }
}
