/*
 * Copyright (C) 2026 The Application Foundry, LLC 
 *
 * This file is part of NoteMakerAI.
 *
 * NoteMakerAI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NoteMakerAI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * =========================================================================
 *
 * COMMERCIAL LICENSE OPTION
 *
 * If you wish to use this software in a proprietary product or are unable
 * to comply with the terms of the AGPLv3, a commercial license is available.
 *
 * For commercial licensing inquiries, please contact: license@theapplicationfoundry.com 
 *
 * =========================================================================
 */
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
      llms: stored?.llms ?? DEFAULT_SETTINGS.llms,
      subjects: stored?.subjects ?? DEFAULT_SETTINGS.subjects,
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
