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
import { AbstractInputSuggest, App, TFile, TFolder } from 'obsidian';

/**
 * Inline folder suggester attached to an input element. Shows a dropdown of vault folders
 * (excluding .obsidian). Root is represented as ''.
 */
export class FolderSuggest extends AbstractInputSuggest<string> {
  private folders: string[] = [];
  private onPick?: (value: string) => void;
  private inputElRef: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement, onPick?: (value: string) => void) {
    super(app, inputEl);
    this.inputElRef = inputEl;
    this.onPick = onPick;
    this.loadFolders();
  }

  private loadFolders() {
    const vault = this.app.vault;
    const configDir = vault.configDir;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const root = (vault as any).getRoot?.() as TFolder | undefined;
    const result: string[] = [];
    if (root) {
      const walk = (folder: TFolder) => {
        if (folder.path.startsWith(configDir)) return;
        result.push(folder.path);
        for (const child of folder.children) {
          if (child instanceof TFolder) walk(child);
        }
      };
      walk(root);
    } else {
      const files = vault.getAllLoadedFiles();
      const set = new Set<string>();
      for (const f of files) {
        if (!(f instanceof TFile)) continue;
        const parent = f.parent;
        if (parent) {
          const p = parent.path;
          if (!p.startsWith(configDir)) set.add(p);
        }
      }
      result.push(...Array.from(set).sort());
    }
    if (!result.includes('')) result.unshift('');
    this.folders = result;
  }

  getSuggestions(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.folders;
    return this.folders.filter((f) => (f === '' ? '/' : f).toLowerCase().includes(q));
  }

  renderSuggestion(value: string, el: HTMLElement) {
    el.setText(value === '' ? '/' : value);
  }

  selectSuggestion(value: string): void {
    this.inputElRef.value = value;
    this.onPick?.(value);
    // Fire a change event so external handlers can persist
    this.inputElRef.dispatchEvent(new Event('change'));
    this.close();
  }
}
