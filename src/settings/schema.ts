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
import { SUBJECT_DIR, SUBJECT_PHOTOS_DIR } from "../utils/constants";

export const CURRENT_SETTINGS_VERSION = 3;

export type LlmVendor = 'openai' | 'gemini' | 'openrouter' | 'anthropic';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export interface LlmConfigEntry {
  /** Unique label (max 12 chars, alphanumeric/underscores) that users select elsewhere. */
  label: string;
  vendor: LlmVendor;
  model: string;
  apiKey: string;
}

export interface FolderSettings {
  notes: string;   // vault-relative
  photos: string;  // vault-relative
  llmLabel?: string;     // optional association to a specific LLM config label
  subjectDefinitionLocation?: string; // optional path to a markdown file defining subject instructions
}

/**
 * Configuration for a single subject type (e.g., Books, Wines, Plants).
 * Each subject has its own output directories and Subject Definition File.
 */
export interface SubjectConfigEntry {
  /** Display name shown in UI and ribbon icons. */
  name: string;
  /** Vault-relative path for generated notes. */
  notesDir: string;
  /** Vault-relative path for photos associated with this subject. */
  photosDir: string;
  /** Path to the Subject Definition File (markdown with YAML frontmatter). */
  subjectDefinitionPath: string;
  /** Optional: override default LLM for this subject. */
  llmLabel?: string;
}

export type ReducedImageOrientation = 'maintain' | 'landscape' | 'portrait';
export type RotationDirection = 'clockwise' | 'counter-clockwise';

/**
 * Settings for image processing during note creation.
 */
export interface ImageSettings {
  /** When a large image is resized, keep the original file instead of deleting it. */
  keepOriginalAfterResize: boolean;
  /** Target orientation for the processed image (landscape, portrait, or maintain original). */
  orientation: ReducedImageOrientation;
  /** Direction to rotate when orientation change is needed (clockwise or counter-clockwise). */
  rotationDirection: RotationDirection;
}

export interface NoteMakerAISettings {
  llms: LlmConfigEntry[];
  defaultLlmLabel?: string;

  folders?: FolderSettings;

  /** Configured subjects (new multi-subject support). */
  subjects: SubjectConfigEntry[];

  /** Global "Keep original after resize" setting. */

  image?: ImageSettings;
  logLevel?: LogLevel;
}

export const DEFAULT_LLM_LABEL = 'default';

export const DEFAULT_SETTINGS: NoteMakerAISettings = {
  llms: [
    {
      label: "gemini3",
      vendor: "gemini",
      model: "gemini-3.1-pro-preview",
      apiKey: process.env.GEMINI_API_KEY || "",
    },
  ],
  defaultLlmLabel: "gemini3",
  folders: {
    notes: SUBJECT_DIR,
    photos: SUBJECT_PHOTOS_DIR,
    subjectDefinitionLocation: "",
  },
  subjects: [],
  image: {
    keepOriginalAfterResize: true,
    orientation: 'maintain',
    rotationDirection: 'clockwise',
  },
  logLevel: 'error',
};
