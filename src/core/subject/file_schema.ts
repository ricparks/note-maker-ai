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

export interface FileDefinedProperty {
  key: string;
  instruction?: string;
  type?: string;
  default?: unknown;
  touch_me_not?: boolean;
}

export interface FileDefinedSection {
  heading: string;
  instruction: string;
}

export interface FileDefinedNaming {
  note: string;  // e.g. "{{author}} - {{title}}"
  photo: string; // e.g. "{{author}}_{{title}}_{{publicationDate}}"
}

/**
 * Represents the structure of the Subject Definition Markdown file
 * parsed from YAML/JSON content blocks.
 */
export interface SubjectDefinitionFile {
  id?: string; // Optional stable identifier
  sdf_version?: string; // Optional version string
  subject_name: string;
  icon: string;
  naming: FileDefinedNaming;
  properties: FileDefinedProperty[];
  sections: FileDefinedSection[];
  lead_prompt: string;
  trailing_prompt?: string;
  validate_subject?: boolean;
  validation_threshold?: number;
}
