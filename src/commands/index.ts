import type NoteMakerAI from '../main';
import { registerDefaultCommand } from './defaultCommand';
import { registerSubjectCommand } from './subjectCommands'; // Re-export for use in main.ts logic

// Main registration function for static commands
export function registerCommands(plugin: NoteMakerAI) {
    registerDefaultCommand(plugin);
}

// Re-export the dynamic registrar so main.ts can use it when loading subjects
export { registerSubjectCommand };
