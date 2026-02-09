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

// Utility functions for note processing and formatting.

/**
 * Sanitizes a filename by removing or replacing characters invalid for file systems.
 * Returns a safe filename or a default fallback.
 */
export function sanitizeNoteFilename(name: string): string {
	const raw = (name ?? "")
		.replace(/[\\/:?*"<>|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return raw.length > 0 ? raw : "NoteMakerAI Note";
}

/**
 * Normalizes section spacing in markdown content by collapsing 3+ consecutive
 * newlines into exactly 2 (one blank line between paragraphs/sections).
 */
export function normalizeSectionSpacing(note: string): string {
	return note.replace(/\n{3,}/g, "\n\n");
}
