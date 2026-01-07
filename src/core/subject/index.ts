export { type SubjectDefinition, type SubjectInfoBase, type SubjectNoteData, type SubjectExistingNoteContext, type SubjectPromptContext, type SubjectNoteSections } from './types';
import { defaultSubject } from './defaults';
import type { SubjectDefinition, SubjectInfoBase } from './types';

/**
 * Registry to manage the active subject definition.
 * Encapsulates the state that was previously valid as a global singleton.
 */
export class SubjectRegistry {
    private _activeSubject: SubjectDefinition<SubjectInfoBase> = defaultSubject;

    public get activeSubject(): SubjectDefinition<SubjectInfoBase> {
        return this._activeSubject;
    }

    public setActiveSubject(subject: SubjectDefinition<SubjectInfoBase>) {
        this._activeSubject = subject;
    }

    public clearCustomSubject() {
        this._activeSubject = defaultSubject;
    }
}
