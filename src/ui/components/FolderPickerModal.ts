import { App, FuzzyMatch, FuzzySuggestModal, TFile, TFolder, Vault } from 'obsidian';

/**
 * FolderPickerModal presents a fuzzy-searchable list of folders in the vault
 * and resolves with the selected folder path (vault-relative).
 */
export class FolderPickerModal extends FuzzySuggestModal<string> {
  private resolve!: (value: string | null) => void;
  private folders: string[] = [];

  constructor(app: App, private initialPath?: string) {
    super(app);
    this.setPlaceholder('Type to search folders…');
    this.setInstructions([{ command: 'Enter', purpose: 'Select folder' }]);
    this.loadFolders();
  }

  private loadFolders() {
    const vault = this.app.vault as Vault;
    const root = (vault as any).getRoot?.() as TFolder | undefined;
    const result: string[] = [];
    if (root) {
      const walk = (folder: TFolder) => {
        // Exclude hidden/system folders under .obsidian by default
        if (folder.path.startsWith('.obsidian')) return;
        result.push(folder.path);
        folder.children.forEach((child) => {
          if (child instanceof TFolder) walk(child);
        });
      };
      walk(root);
    } else {
      // Fallback: scan all files and collect their parent folders
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
    // Ensure root folder appears as '' (vault root)
    if (!result.includes('')) result.unshift('');
    this.folders = result;
  }

  getItems(): string[] {
    return this.folders;
  }

  getItemText(item: string): string {
    return item === '' ? '/' : item;
  }

  renderSuggestion(value: FuzzyMatch<string>, el: HTMLElement) {
    el.addClass('mod-complex');
    const top = el.createEl('div', { text: value.item === '' ? '/' : value.item });
    top.addClass('suggestion-content');
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent) {
    this.resolve(item);
  }

  /** Opens the modal and resolves with the selected folder path or null if cancelled. */
  async pick(): Promise<string | null> {
    return new Promise<string | null>((res) => {
      this.resolve = res;
      this.open();
    });
  }
}
