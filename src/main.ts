import { Plugin, setIcon } from 'obsidian';
import { NoteMakerAISettingTab } from './ui/settings/NoteMakerAISettingTab';
import { SettingsManager } from './settings/SettingsManager';
import type { NoteMakerAISettings } from './settings/schema';
import { RIBBON_ICON, RIBBON_TITLE } from './utils/constants';
import { SubjectRegistry } from './core/subject';
import { NoteMakerCore } from './core/NoteMakerCore';

// Main plugin class kept minimal; business logic lives in NoteMakerCore (core/NoteMakerCore.ts)
export default class NoteMakerAI extends Plugin {
    settings!: NoteMakerAISettings; // provided by manager after load
    settingsManager!: SettingsManager;
    core!: NoteMakerCore;
    // Registry to manage active subjects
    subjectRegistry!: SubjectRegistry;
    
    private ribbonEl?: HTMLElement;

    // This function runs when your plugin is loaded
    async onload() {
        this.settingsManager = new SettingsManager(this);
        await this.settingsManager.load();
        this.settings = this.settingsManager.data;
        
        // Initialize Registry and Core
        this.subjectRegistry = new SubjectRegistry();
        this.core = new NoteMakerCore(this, this.subjectRegistry);

        // Attempt to load custom subject definition if configured
        const defPath = this.settings.folders.subjectDefinitionLocation;
        if (defPath) {
             await import('./core/subject/SubjectLoader').then(m => m.loadSubjectDefinition(this.app, defPath, this.subjectRegistry));
        }

        this.addSettingTab(new NoteMakerAISettingTab(this.app, this));
        this.renderRibbon();

        this.addCommand({
            id: 'create-note-from-image',
            name: 'Create note from image',
            callback: () => {
                this.core.processSelection();
            },
        });

        // Watch for changes to the definition file
        this.registerEvent(this.app.vault.on('modify', async (file) => {
            const currentPath = this.settings.folders.subjectDefinitionLocation;
            if (currentPath && file.path === currentPath) {
                const loader = await import('./core/subject/SubjectLoader');
                const success = await loader.loadSubjectDefinition(this.app, currentPath, this.subjectRegistry);
                if (success) {
                    this.renderRibbon();
                }
            }
        }));
        
        // Also watch for creation (e.g. if user pastes it in)
        this.registerEvent(this.app.vault.on('create', async (file) => {
             const currentPath = this.settings.folders.subjectDefinitionLocation;
             if (currentPath && file.path === currentPath) {
                const loader = await import('./core/subject/SubjectLoader');
                await loader.loadSubjectDefinition(this.app, currentPath, this.subjectRegistry);
                this.renderRibbon();
             }
        }));
    }

    // This function runs when your plugin is disabled
    onunload() {
        // No cleanup needed for this simple version
    }

    async saveSettings() { await this.settingsManager.save(); }

    // Reload the subject definition from the current path setting and refresh the ribbon
    async reloadSubjectDefinition() {
        const defPath = this.settings.folders.subjectDefinitionLocation;
        if (defPath) {
            const loader = await import('./core/subject/SubjectLoader');
            await loader.loadSubjectDefinition(this.app, defPath, this.subjectRegistry);
        } else {
            // If path is cleared, reset to default subject
            this.subjectRegistry.clearCustomSubject();
        }
        this.renderRibbon();
    }

    // Render or re-render the ribbon icon based on the active subject
    private renderRibbon() {
        // Single subject mode: explicit activeSubject from registry
        const subject = this.subjectRegistry.activeSubject;
        const icon = subject.ribbonIcon || RIBBON_ICON;
        const title = subject.ribbonTitle || RIBBON_TITLE;

        // If we already have a ribbon element, just update its icon and tooltip.
        if (this.ribbonEl) {
            try {
                setIcon(this.ribbonEl, icon);
                this.ribbonEl.setAttribute('aria-label', title);
                // Keep tooltip behavior consistent with Obsidian’s addRibbonIcon
                this.ribbonEl.setAttribute('data-tooltip-delay', '50');
            } catch (e) {
                // Fallback: if updating fails for any reason, recreate the element
                try { (this.ribbonEl as any)?.remove?.(); } catch {}
                this.ribbonEl = this.addRibbonIcon(icon, title, () => this.core.processSelection());
            }
            return;
        }

        // First render: create the ribbon icon and register the click handler
        this.ribbonEl = this.addRibbonIcon(icon, title, () => {
            this.core.processSelection();
        });
    }
}

