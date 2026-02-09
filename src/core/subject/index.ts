/*
 * Copyright (C) 2026 The Application Foundry, LLC 
 *
 * This file is part of NoteMakerAI.
 *
 * NoteMakerAI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NoteMakerAI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * =========================================================================
 *
 * COMMERCIAL LICENSE OPTION
 *
 * If you wish to use this software in a proprietary product or are unable
 * to comply with the terms of the AGPLv3, a commercial license is available.
 *
 * For commercial licensing inquiries, please contact: license@theapplicationfoundry.com 
 *
 * =========================================================================
 */
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
