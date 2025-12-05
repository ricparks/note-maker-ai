// Subject registry & re-exports.
// Minimal layer so other modules can import from 'core/subject' instead of deep paths.

export { type SubjectDefinition, type SubjectInfoBase, type SubjectNoteData, type SubjectExistingNoteContext, type SubjectPromptContext, type SubjectNoteSections } from './types';
import { bookSubject } from './implementation';

/**
 * The single active subject for this plugin instance.
 */
export const activeSubject = bookSubject;
