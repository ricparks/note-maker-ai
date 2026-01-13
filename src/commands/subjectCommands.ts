import { Plugin } from 'obsidian';
import type NoteMakerAI from '../main';
import type { ActiveSubject } from '../core/subject';

export function registerSubjectCommand(plugin: NoteMakerAI, subject: ActiveSubject) {
    const safeName = subject.name.toLowerCase().replace(/\s+/g, '-');
    const cmdId = `create-note-subject-${safeName}`;
    
    plugin.addCommand({
        id: cmdId,
        name: `Create note from image (${subject.name})`,
        callback: () => {
            plugin.core.processSelection(subject);
        }
    });
}
