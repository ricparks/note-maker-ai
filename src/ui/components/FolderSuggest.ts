import { AbstractInputSuggest, App, TFile, TFolder, Vault } from 'obsidian';

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
    const vault = this.app.vault as Vault;
    const root = (vault as any).getRoot?.() as TFolder | undefined;
    const result: string[] = [];
    if (root) {
      const walk = (folder: TFolder) => {
        if (folder.path.startsWith('.obsidian')) return;
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
        const parent = (f as TFile).parent;
        if (parent) {
          const p = parent.path;
          if (!p.startsWith('.obsidian')) set.add(p);
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
