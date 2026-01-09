import { Plugin, setIcon } from 'obsidian';
import { NoteMakerAISettingTab } from './ui/settings/NoteMakerAISettingTab';
import { SettingsManager } from './settings/SettingsManager';
import type { NoteMakerAISettings } from './settings/schema';
import { RIBBON_ICON, RIBBON_TITLE } from './utils/constants';
import { SubjectRegistry } from './core/subject';
import { NoteMakerCore } from './core/NoteMakerCore';
import * as SubjectLoader from './core/subject/SubjectLoader';

// Main plugin class kept minimal; business logic lives in NoteMakerCore (core/NoteMakerCore.ts)
export default class NoteMakerAI extends Plugin {
    settings!: NoteMakerAISettings; // provided by manager after load
    settingsManager!: SettingsManager;
    core!: NoteMakerCore;
    // Registry to manage active subjects
    subjectRegistry!: SubjectRegistry;
    
    // List of active ribbon elements
    private ribbonEls: HTMLElement[] = [];

    // This function runs when your plugin is loaded
    async onload() {
        console.log("[NoteMakerAI] Loading plugin...");
        this.settingsManager = new SettingsManager(this);
        await this.settingsManager.load();
        this.settings = this.settingsManager.data;
        
        // Initialize Registry and Core
        this.subjectRegistry = new SubjectRegistry();
        this.core = new NoteMakerCore(this, this.subjectRegistry);

        this.addSettingTab(new NoteMakerAISettingTab(this.app, this));

        // Use onLayoutReady to ensure mobile UI is ready for ribbons
        this.app.workspace.onLayoutReady(async () => {
             console.log("[NoteMakerAI] Layout ready, loading subjects...");
             // Load all configured subjects
             await this.loadAllSubjects();
             this.renderRibbons();
        });

        // Register global command (uses default subject if available)
        this.addCommand({
            id: 'create-note-from-image-default',
            name: 'Create note from image (Default Subject)',
            callback: () => {
                this.core.processSelection();
            },
        });

        // Watch for changes to any definition file
        this.registerEvent(this.app.vault.on('modify', async (file) => {
            const matched = this.settings.subjects.find(s => s.subjectDefinitionPath === file.path);
            if (matched) {
               console.log(`[NoteMakerAI] Definition modified: ${file.path}, reloading subject.`);
               await this.reloadSubject(matched);
               this.renderRibbons();
            }
        }));
        
        // Also watch for creation (e.g. if user pastes it in)
        this.registerEvent(this.app.vault.on('create', async (file) => {
            const matched = this.settings.subjects.find(s => s.subjectDefinitionPath === file.path);
            if (matched) {
               console.log(`[NoteMakerAI] Definition created: ${file.path}, loading subject.`);
               await this.reloadSubject(matched);
               this.renderRibbons();
            }
        }));
    }

    // This function runs when your plugin is disabled
    onunload() {
        // No cleanup needed for this simple version
    }

    async saveSettings() { await this.settingsManager.save(); }

    private async loadAllSubjects() {
        this.subjectRegistry.clear();
        const subjects = this.settings.subjects || [];
        
        if (subjects.length === 0) {
            console.log("[NoteMakerAI] No subjects configured.");
            return;
        }

        for (const config of subjects) {
            await this.reloadSubject(config, false); // don't render yet
        }
    }

    public async reloadSubject(config: import('./settings/schema').SubjectConfigEntry, render = true) {
        if (!config.subjectDefinitionPath) return;
        
        // Use static loader
        const definition = await SubjectLoader.parseSubjectDefinitionFile(this.app, config.subjectDefinitionPath);
        
        if (definition) {
             const active: import('./core/subject').ActiveSubject = {
                 name: config.name,
                 definition: definition,
                 notesDir: config.notesDir,
                 photosDir: config.photosDir,
                 llmLabel: config.llmLabel 
             };
             this.subjectRegistry.registerSubject(active);
             this.registerSubjectCommand(active);
             if (render) this.renderRibbons();
        } else {
            console.warn(`[NoteMakerAI] Failed to load definition for ${config.name} at ${config.subjectDefinitionPath}`);
        }
    }

    private registerSubjectCommand(subject: import('./core/subject').ActiveSubject) {
        const safeName = subject.name.toLowerCase().replace(/\s+/g, '-');
        const cmdId = `create-note-subject-${safeName}`;
        
        this.addCommand({
            id: cmdId,
            name: `Create note from image (${subject.name})`,
            callback: () => {
                this.core.processSelection(subject);
            }
        });
    }

    // Render ribbon icons for all registered subjects
    public renderRibbons() {
        // Clear existing ribbons
        this.ribbonEls.forEach(el => el.remove());
        this.ribbonEls = [];

        const subjects = this.subjectRegistry.subjects;
        console.log(`[NoteMakerAI] Rendering ribbons for ${subjects.length} subjects.`);
        
        for (const subject of subjects) {
            const icon = subject.definition.ribbonIcon || RIBBON_ICON;
            const title = subject.definition.ribbonTitle || `Create ${subject.name}`;
            
            const ribbonEl = this.addRibbonIcon(icon, title, () => {
                this.core.processSelection(subject);
            });
            this.ribbonEls.push(ribbonEl);
        }
    }
}



