import { Plugin, setIcon } from 'obsidian';
import { NoteMakerAISettingTab } from './ui/settings/NoteMakerAISettingTab';
import { SettingsManager } from './settings/SettingsManager';
import type { NoteMakerAISettings } from './settings/schema';
import { RIBBON_ICON, RIBBON_TITLE } from './utils/constants';
import { SubjectRegistry } from './core/subject';
import { NoteMakerCore } from './core/NoteMakerCore';
import * as SubjectLoader from './core/subject/SubjectLoader';
import { registerCommands, registerSubjectCommand } from './commands';

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
             
             // On mobile, the vault may not be fully indexed when layout is ready.
             // Wait for the metadata cache to finish initial indexing.
             await this.waitForVaultReady();
             
             // Load all configured subjects
             await this.loadAllSubjects();
             this.renderRibbons();
        });

        // Register global commands
        registerCommands(this);

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

    /**
     * Wait for the vault/metadata cache to be ready.
     * On mobile, onLayoutReady can fire before the vault is fully indexed.
     * This waits for the 'resolved' event or returns immediately if already resolved.
     */
    private waitForVaultReady(): Promise<void> {
        return new Promise((resolve) => {
            // Check if metadataCache is already resolved
            if ((this.app.metadataCache as any).initialized) {
                console.log("[NoteMakerAI] Metadata cache already initialized.");
                resolve();
                return;
            }
            
            // Otherwise, wait for the 'resolved' event
            const handler = () => {
                console.log("[NoteMakerAI] Metadata cache resolved event fired.");
                resolve();
            };
            
            this.app.metadataCache.on('resolved', handler);
            
            // Also add a timeout fallback in case 'resolved' already fired
            setTimeout(() => {
                console.log("[NoteMakerAI] Vault ready timeout fallback.");
                resolve();
            }, 2000);
        });
    }

    async saveSettings() { await this.settingsManager.save(); }

    private async loadAllSubjects() {
        this.subjectRegistry.clear();
        const subjects = this.settings.subjects || [];
        
        if (subjects.length === 0) {
            console.log("[NoteMakerAI] No subjects configured.");
            new (require('obsidian').Notice)("NoteMaker AI: No Subject Definition File configured. Please set one in Settings.");
            return;
        }

        for (const config of subjects) {
            await this.reloadSubject(config, false); // don't render yet
        }
    }


    public async reloadSubject(config: import('./settings/schema').SubjectConfigEntry, render = true) {
        if (!config.subjectDefinitionPath) return;
        
        // Use static loader
        const definition = await SubjectLoader.parseSubjectDefinitionFile(this.app, config.subjectDefinitionPath, true);
        
        // Register subject regardless of definition load status (lazy validation)
        const active: import('./core/subject').ActiveSubject = {
            name: config.name,
            definition: definition || undefined,
            subjectDefinitionPath: config.subjectDefinitionPath,
            notesDir: config.notesDir,
            photosDir: config.photosDir,
            llmLabel: config.llmLabel 
        };
        this.subjectRegistry.registerSubject(active);
        
        // Only warn if we failed but only if not just partially typed (heuristic?)
        // Actually, user wants deferred validation. So we log info instead of warn to reduce console noise during typing.
        if (!definition) {
            console.log(`[NoteMakerAI] Definition not loaded for ${config.name} at ${config.subjectDefinitionPath} (deferred).`);
        }
        
        this.registerSubjectCommand(active);
        if (render) this.renderRibbons();
    }

    private registerSubjectCommand(subject: import('./core/subject').ActiveSubject) {
        registerSubjectCommand(this, subject);
    }

    // Render ribbon icons for all registered subjects
    public renderRibbons() {
        // Clear existing ribbons
        this.ribbonEls.forEach(el => el.remove());
        this.ribbonEls = [];

        const subjects = this.subjectRegistry.subjects;
        console.log(`[NoteMakerAI] Rendering ribbons for ${subjects.length} subjects.`);
        
        for (const subject of subjects) {
            // Lazy load check: if definition missing, do NOT render a ribbon at all.
            // This prevents "bad" icons or ghost icons for subjects that aren't fully configured.
            if (!subject.definition) continue;

            const icon = subject.definition.ribbonIcon || RIBBON_ICON;
            const title = subject.definition.ribbonTitle || `Create ${subject.name}`;
            
            const ribbonEl = this.addRibbonIcon(icon, title, () => {
                this.core.processSelection(subject);
            });
            this.ribbonEls.push(ribbonEl);
        }
    }
}



