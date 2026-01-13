import { Plugin } from 'obsidian';
import type NoteMakerAI from '../main';

export function registerDefaultCommand(plugin: NoteMakerAI) {
    plugin.addCommand({
        id: 'create-note-from-image-default',
        name: 'Create note from image',
        callback: () => {
            plugin.core.processSelection();
        },
    });
}
