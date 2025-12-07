import { Plugin, setIcon } from 'obsidian';
import { NoteMakerAISettingTab } from './ui/settings/NoteMakerAISettingTab';
import { SettingsManager } from './settings/SettingsManager';
import type { NoteMakerAISettings } from './settings/schema';
import { RIBBON_ICON, RIBBON_TITLE } from './utils/constants';
import { activeSubject } from './core/subject';
import { NoteMakerCore } from './core/NoteMakerCore';

// Main plugin class kept minimal; business logic lives in NoteMakerCore (core/NoteMakerCore.ts)
export default class NoteMakerAI extends Plugin {
    settings!: NoteMakerAISettings; // provided by manager after load
    settingsManager!: SettingsManager;
    core!: NoteMakerCore;
    private ribbonEl?: HTMLElement;

    // This function runs when your plugin is loaded
    async onload() {
        this.settingsManager = new SettingsManager(this);
        await this.settingsManager.load();
        this.settings = this.settingsManager.data;
        this.core = new NoteMakerCore(this);
        this.addSettingTab(new NoteMakerAISettingTab(this.app, this));
        this.renderRibbon();
    }

    // This function runs when your plugin is disabled
    onunload() {
        // No cleanup needed for this simple version
    }

    async saveSettings() { await this.settingsManager.save(); }

    // Render or re-render the ribbon icon based on the active subject
    private renderRibbon() {
        // Single subject mode: explicit activeSubject
        const subject = activeSubject;
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

