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
    // Simple merge with defaults to ensure all fields exist
    this._settings = Object.assign({}, DEFAULT_SETTINGS, stored);
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
