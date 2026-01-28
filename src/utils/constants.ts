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
// Centralized constants for UI text, notices, paths, and small templates.

// Ribbon
export const RIBBON_ICON = "diamond-plus";
export const RIBBON_TITLE = "Create subject note";

// Notices / user-facing messages
export const NO_ACTIVE_FILE_NOTICE = "No active file. Please open an image.";
export const NOT_IMAGE_NOTICE = "The active file is not a JPG or PNG image.";

// Generic subject-oriented messages (preferred going forward)
export const SUCCESS_FETCHED_SUBJECT = "Successfully fetched subject data!";
export const FAILED_GET_SUBJECT = "Failed to get subject data from AI.";


export const COULD_NOT_CREATE_NOTE = "Error: Could not create the new note.";
export const UNKNOWN_VENDOR_ERROR = "Error: Unknown LLM vendor selected.";
// Removed unused AI_* parse/structure constants; errors are surfaced directly by AI clients.

// Paths
// Fallback directory if a SubjectDefinition does not specify its own directory.

// Small helper templates for dynamic messages
export const PROCESSING_NOTICE = (fileName: string) => `Processing ${fileName}...`;
export const FAILED_READ_IMAGE_NOTICE = (fileName: string) => `Failed to read the image file: ${fileName}.`;
export const NOTE_CREATED_NOTICE = (fileName: string) => `Successfully created note: ${fileName}.md`;

// Supported image extensions (used for file type detection)
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];

// Default directories
export const SUBJECT_DIR = 'NoteMakerAI';
export const SUBJECT_PHOTOS_DIR = 'NoteMakerAI/photos';

// Image dimension limits for processing
export const NOTE_IMAGE_MAX_WIDTH = 750;
export const NOTE_IMAGE_MAX_HEIGHT = 1000;
export const AI_IMAGE_MAX_DIM = 512;

// Maximum iterations for collision-safe file operations to prevent infinite loops
export const MAX_COLLISION_ATTEMPTS = 100;
