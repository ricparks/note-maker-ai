export { type ActiveSubject, type SubjectDefinition, type SubjectInfoBase, type SubjectNoteData, type SubjectExistingNoteContext, type SubjectPromptContext, type SubjectNoteSections } from './types';
import type { ActiveSubject, SubjectDefinition, SubjectInfoBase } from './types';

/**
 * Registry to manage active subject definitions.
 * Now manages a list of configured subjects (ActiveSubject).
 */
export class SubjectRegistry {
    // Map subject name -> ActiveSubject
    private _subjects: Map<string, ActiveSubject> = new Map();

    /**
     * returns all registered subjects
     */
    public get subjects(): ActiveSubject[] {
        return Array.from(this._subjects.values());
    }

    public registerSubject(config: ActiveSubject) {
       this._subjects.set(config.name, config);
    }

    public getSubject(name: string): ActiveSubject | undefined {
        return this._subjects.get(name);
    }
    
    public clear() {
        this._subjects.clear();
    }
}
