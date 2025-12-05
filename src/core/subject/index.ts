// Subject registry & re-exports.
// Minimal layer so other modules can import from 'core/subject' instead of deep paths.

export { type SubjectDefinition, type SubjectInfoBase, type SubjectNoteData, type SubjectExistingNoteContext, type SubjectPromptContext, type SubjectNoteSections } from './types';
export { wineSubject } from './wineSubject';
export { bookSubject } from './bookSubject';
export { travelSubject } from './travelSubject';

import { wineSubject } from './wineSubject';
import { bookSubject } from './bookSubject';
import { travelSubject } from './travelSubject';
import type { SubjectDefinition } from './types';

/** Default subject (now travel). User selection overrides this via settings. */
export const defaultSubject = travelSubject;

/** Simple registry keyed by an identifier; extend as new subjects are added. */
export const subjects: Record<string, SubjectDefinition> = {
  wine: wineSubject,
  books: bookSubject,
  travel: travelSubject,
};

/**
 * Retrieve a SubjectDefinition by stable key (e.g., 'wine', 'books').
 * Falls back to the default subject if key is missing/unknown.
 */
export function getSubject(key?: string): SubjectDefinition {
  if (key && subjects[key]) return subjects[key];
  return defaultSubject;
}
