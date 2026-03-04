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
import { stringifyYaml, TFile } from 'obsidian';
import { Logger } from '../../utils/logger';
import { SubjectDefinition, SubjectInfoBase, SubjectNoteData, SubjectExistingNoteContext, SubjectPromptContext } from './types';
import { SubjectDefinitionFile } from './file_schema';

/**
 * A generic SubjectDefinition that configures itself at runtime based on
 * a parsed schema file (SubjectDefinitionFile).
 */
export class FileDefinedSubject implements SubjectDefinition<SubjectInfoBase> {
  public id: string;
  /** Cached base prompt built in constructor; accessed via getPrompt() which adds context */
  public prompt: string;
  public ribbonIcon: string;
  public ribbonTitle: string;
  public validateSubject: boolean;
  public validationThreshold?: number;

  constructor(private definition: SubjectDefinitionFile) {
    this.id = definition.id || this.sanitizeId(definition.subject_name);
    this.ribbonIcon = definition.icon || 'star';
    this.ribbonTitle = `Create ${definition.subject_name} note`;
    this.validateSubject = definition.validate_subject ?? false;
    this.validationThreshold = definition.validation_threshold;

    // We construct the static part of the prompt here or in getPrompt
    this.prompt = this.buildBasePrompt();
  }

  private sanitizeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  /**
   * Constructs the full system prompt by combining lead_prompt, properties,
   * sections, and trailing_prompt from the definition.
   */
  private buildBasePrompt(): string {
    const { lead_prompt, properties, sections, trailing_prompt } = this.definition;

    // prompt properties: strictly exclude ones that have a default.
    // If a default is set, we use it locally. We never ask the AI for it, even if an instruction is present.
    const promptProperties = properties.filter(p => p.default === undefined && p.instruction);

    const propsList = promptProperties.map(p => {
      let instr = p.instruction || "Extract value";
      if (p.type === 'sequence' || p.type === 'list' || p.type === 'array') {
        instr += " (as a list)";
      }
      return `- ${p.key}: ${instr}`;
    }).join('\n');

    // Filter out sections that are marked as user-only via {{my_notes}}
    const promptSections = sections.filter(s => !s.instruction?.includes('{{my_notes}}'));
    const sectionsList = promptSections.map(s => `- ${s.heading}: ${s.instruction}`).join('\n');

    // We also construct a robust JSON example dynamically to help the LLM structure correctly
    const exampleObj: Record<string, unknown> = {};
    promptProperties.forEach(p => {
      if (p.type === 'sequence' || p.type === 'list' || p.type === 'array') {
        exampleObj[p.key] = ["...", "..."];
      } else {
        exampleObj[p.key] = "...";
      }
    });
    promptSections.forEach(s => { exampleObj[s.heading] = "..."; });

    const exampleJson = JSON.stringify(exampleObj, null, 2);

    let base = `${lead_prompt}

Extract these Properties:
${propsList}

Generate content for these Sections:
${sectionsList}

Return your response as JSON matching this exact structure:
${exampleJson}

${trailing_prompt || ''}`;

    if (this.validateSubject) {
      base += `\n\nAlso return a field 'subject_match' (boolean) and 'confidence' (0.0 to 1.0) indicating if this image matches the expected subject. If subject_match is false, provide a short 'reason' string.`;
    }

    return base;
  }

  /**
   * Dynamic prompt generation (allows for context additions like Redo).
   */
  getPrompt(context: SubjectPromptContext): string {
    let finalPrompt = this.prompt;

    // Inject EXIF Metadata if available
    Logger.debug(`[FileDefinedSubject.getPrompt] context.exifData present: ${!!context.exifData}`);
    if (context.exifData) {
      Logger.debug(`[FileDefinedSubject.getPrompt] EXIF data received:`, context.exifData);
      const e = context.exifData;
      const parts: string[] = [];

      if (e.dateTimeOriginal) parts.push(`Date Taken: ${e.dateTimeOriginal}`);

      // Location
      if (e.latitude && e.longitude) {
        parts.push(`GPS Location: ${e.latitude.toFixed(6)}, ${e.longitude.toFixed(6)}`);
        if (e.altitude) parts.push(`Altitude: ${e.altitude.toFixed(1)}m`);
      }

      // Camera Gear
      const camera = [e.make, e.model].filter(Boolean).join(' ');
      if (camera) parts.push(`Camera: ${camera}`);
      if (e.lensModel) parts.push(`Lens: ${e.lensModel}`);

      // Settings
      const settings: string[] = [];
      if (e.focalLength) settings.push(`${e.focalLength}mm`);
      if (e.fNumber) settings.push(`f/${e.fNumber}`);
      if (e.exposureTime) settings.push(`${e.exposureTime}s`);
      if (e.iso) settings.push(`ISO ${e.iso}`);
      if (settings.length > 0) parts.push(`Settings: ${settings.join(' ')}`);

      Logger.debug(`[FileDefinedSubject.getPrompt] EXIF parts to inject:`, parts);
      if (parts.length > 0) {
        const exifBlock = `\n\n[Context Data from Image Metadata]\n${parts.join('\n')}\nWe have provided this metadata to help you be more accurate. You can use it to derive location, time of day, or date context.`;
        Logger.debug(`[FileDefinedSubject.getPrompt] Appending EXIF block to prompt`);
        finalPrompt += exifBlock;
      } else {
        Logger.debug(`[FileDefinedSubject.getPrompt] No EXIF parts generated (all fields empty/undefined)`);
      }
    } else {
      Logger.debug(`[FileDefinedSubject.getPrompt] No EXIF data in context`);
    }

    // Handle Redo / Prompt Additions
    if (context.noteData) {
      const sections = context.noteData.sections;
      const additions = sections['Redo Instructions'] || sections['RI'] || sections['ri'];
      if (additions && additions.trim().length > 0) {
        finalPrompt += `\n\nIMPORTANT: The user has provided additional instructions for this request:\n${additions.trim()}`;
      }
    }
    return finalPrompt;
  }

  /**
   * Simple templating engine: replaces {{key}} with value from info.fields.
   */
  private applyTemplate(template: string, info: SubjectInfoBase, context?: { originalImage?: TFile }): { result: string; usedOriginalImage: boolean } {
    let usedOriginalImage = false;
    const result = template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      // Special case: {{original_image}}
      if (key === 'original_image') {
        if (context?.originalImage) {
          usedOriginalImage = true;
          // Return wiki-link format for the original image
          return `[[${context.originalImage.name}]]`;
        }
        return ''; // Or keep {{original_image}}? For now, empty if not available.
      }

      // Check in fields
      if (key in info.fields) {
        const val = info.fields[key];
        // Ensure we don't treat false or 0 as empty string
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
        return '';
      }
      // Check in base info (title, producer)
      if (key === 'title') return info.title;
      if (key === 'producer') return info.producer || '';
      if (key === 'sdf_version') return this.definition.sdf_version || '';

      return ''; // Fallback to empty
    });
    return { result, usedOriginalImage };
  }

  private slugify(text: string): string {
    return text
      .normalize('NFKD') // split accented characters
      .replace(/[^\p{L}\p{N}\s_-]/gu, '') // remove non-letters/numbers/separators
      .trim()
      .replace(/[\s_]+/g, '_') // collapse spaces/underscores
      .toLowerCase();
  }

  private sanitizeFilename(text: string): string {
    // Conservative filename sanitizer for OS compatibility
    return text.replace(/[\\/:"*?<>|]+/g, '').trim();
  }

  getNoteFilename(info: SubjectInfoBase): string {
    const template = this.definition.naming?.note || "{{title}}";
    const { result: raw } = this.applyTemplate(template, info);
    // Sanitize for file system
    return this.sanitizeFilename(raw) || 'Untitled Note';
  }

  getPhotoBasename(info: SubjectInfoBase): string {
    const template = this.definition.naming?.photo || "image";
    const { result: raw } = this.applyTemplate(template, info);
    // Slugify for photo filenames (convention prefer snake_case/lowercase for assets)
    return this.slugify(raw) || 'image';
  }

  parse(aiJson: unknown, context?: { originalImage?: TFile }): SubjectInfoBase {
    // Pass-through parsing. We trust the keys match what we asked for.
    // We try to identify 'title' and 'producer' (author) for the Base system.
    const jsonObj = aiJson as Record<string, unknown>;

    // Heuristic: finding the "title" property
    // We look for a property explicitly named 'title', or the first property in the list.
    const titleKey = this.definition.properties.find(p => p.key.toLowerCase() === 'title')?.key || 'title';
    const title = jsonObj[titleKey] ?? 'Untitled';

    // Heuristic: finding the "producer" (author) property
    // Look for 'author', 'producer', or just use empty.
    const producerKey = this.definition.properties.find(p =>
      p.key.toLowerCase() === 'author' || p.key.toLowerCase() === 'producer'
    )?.key;
    const producer = producerKey ? jsonObj[producerKey] : '';

    const titleStr = typeof title === 'string' ? title : (title != null ? JSON.stringify(title) : 'Untitled');
    const producerStr = typeof producer === 'string' ? producer : (producer != null ? JSON.stringify(producer) : '');
    const result: SubjectInfoBase = {
      title: titleStr,
      producer: producerStr,
      raw: aiJson,
      fields: { ...jsonObj },
      _usedOriginalImagePlaceholder: false
    };

    // Inject defaults for any missing keys
    for (const prop of this.definition.properties) {
      if (prop.default !== undefined && (result.fields[prop.key] === undefined || result.fields[prop.key] === null || result.fields[prop.key] === "")) {
        let defVal: unknown = prop.default;
        if (typeof defVal === 'string') {
          // Apply templates to the default value (e.g. "{{sdf_version}}", "{{original_image}}")
          const { result: val, usedOriginalImage } = this.applyTemplate(defVal, result, context);
          defVal = val;
          if (usedOriginalImage) {
            result._usedOriginalImagePlaceholder = true;
          }
        }
        result.fields[prop.key] = defVal;
      }
    }

    return result;
  }

  getNoteParts(info: SubjectInfoBase, context: { coverFileName?: string; llmModel?: string }): { frontmatter: Record<string, unknown>; body: string } {
    const { properties, sections } = this.definition;
    const fields = info.fields;

    // 1. Build Frontmatter Object
    const frontmatterObj: Record<string, unknown> = {};

    // Add dynamic properties
    for (const prop of properties) {
      let val: unknown = fields[prop.key];
      // Keep empty strings if that's what we want, or undefined to omit?
      // Legacy behavior: "undefined || null -> ''"
      if (val === undefined || val === null) val = '';

      frontmatterObj[prop.key] = val;
    }

    // Add System Properties (Standard to NoteMakerAI)
    // We format the photo link manually as a string "[[filename]]" to match Obsidian expectations
    if (context.coverFileName) {
      frontmatterObj['photo'] = `[[${context.coverFileName}]]`;
    } else {
      frontmatterObj['photo'] = "";
    }

    // Origin tracker
    frontmatterObj['note_created_by'] = this.definition.subject_name;
    if (context.llmModel) {
      frontmatterObj['llm-model'] = context.llmModel;
    }

    // 2. Build Content Body
    const contentLines: string[] = [];

    // Dynamic Sections from Definition
    for (const sec of sections) {
      const heading = sec.heading;

      // Look for data in fields (AI JSON) using exact match, then case-insensitive match
      let content: unknown = fields[heading];
      if (!content) {
        const lowerHeading = heading.toLowerCase();
        const matchingKey = Object.keys(fields).find(k => k.toLowerCase() === lowerHeading);
        if (matchingKey) {
          content = fields[matchingKey];
        }
      }
      // For {{my_notes}} sections, content from AI will be undefined/empty (excluded from prompt),
      // which is correct (initially empty).
      const contentStr = content == null
        ? ''
        : typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean'
          ? String(content)
          : JSON.stringify(content);

      contentLines.push('');
      contentLines.push(`#### ${heading}`);
      contentLines.push(contentStr.trim());
    }

    // Embed Image at bottom
    if (context.coverFileName) {
      contentLines.push('');
      contentLines.push(`![[${context.coverFileName}]]`);
    }

    return {
      frontmatter: frontmatterObj,
      body: contentLines.join('\n')
    };
  }

  buildNote(info: SubjectInfoBase, context: { coverFileName?: string; llmModel?: string }): string {
    const { frontmatter, body } = this.getNoteParts(info, context);

    // Strategy: Extract boolean values to append manually as "true"/"false" literals,
    // bypassing Obsidian's stringifyYaml which might output "Yes"/"No".
    const booleanFields: Record<string, boolean> = {};

    for (const prop of this.definition.properties) {
      const key = prop.key;
      let val: unknown = frontmatter[key];

      // Check if this property is supposed to be a boolean
      const isBoolType = prop.type === 'boolean' || typeof prop.default === 'boolean';

      if (isBoolType && val !== undefined && val !== null) {
        // Normalize to boolean if it's currently a string "Yes"/"No"/"true"/"false"
        if (typeof val === 'string') {
          const lower = val.toLowerCase();
          if (lower === 'yes' || lower === 'true' || lower === 'on') val = true;
          else if (lower === 'no' || lower === 'false' || lower === 'off') val = false;
        }

        // If we successfully resolved a boolean, save it and remove from main frontmatter
        if (typeof val === 'boolean') {
          booleanFields[key] = val;
          delete frontmatter[key];
        }
      } else if (typeof val === 'boolean') {
        // Also catch implicit booleans not explicitly defined as such (rare but safer)
        booleanFields[key] = val;
        delete frontmatter[key];
      }
    }

    let yamlString = stringifyYaml(frontmatter).trim();

    // Manually append the boolean fields
    // This ensures they are always written as `key: true` or `key: false`
    for (const key in booleanFields) {
      if (yamlString.length > 0) yamlString += '\n';
      yamlString += `${key}: ${booleanFields[key]}`;
    }

    return `---\n${yamlString}\n---\n${body}`;
  }

  // --- Re-used Utilities ---

  parseExistingNote(note: SubjectExistingNoteContext): SubjectNoteData | Promise<SubjectNoteData> {
    const properties = note.frontmatter || {};
    const sections: Record<string, string> = {};

    // Regex-based section parser (Standard markdown headings)
    const lines = note.content.split(/\r?\n/);
    let currentSection: string | null = null;
    let buffer: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        if (currentSection) {
          sections[currentSection] = buffer.join('\n').trim();
        }
        currentSection = match[2].trim();
        buffer = [];
      } else if (currentSection) {
        buffer.push(line);
      }
    }
    if (currentSection) {
      sections[currentSection] = buffer.join('\n').trim();
    }

    return {
      properties,
      sections,
      logSummary: `Read existing note: "${note.file.basename}"`
    };
  }

  validateParsedData(info: SubjectInfoBase): string[] {
    const warnings: string[] = [];
    const fields = info.fields;

    // Check strict adherence to schema
    for (const prop of this.definition.properties) {
      // If a property has a default, we don't care if AI missed it (parse() fills it)
      // But if it has NO default, we expect AI to return it (even if empty string)
      if (prop.default === undefined) {
        if (fields[prop.key] === undefined) {
          warnings.push(`AI response missing expected field: '${prop.key}'`);
        }
      }
    }

    return warnings;
  }

  getPreservedFields(): string[] {
    return this.definition.properties
      .filter(p => p.touch_me_not === true)
      .map(p => p.key);
  }

  getMyNotesSectionHeadings(): string[] {
    return this.definition.sections
      .filter(s => s.instruction?.includes('{{my_notes}}'))
      .map(s => s.heading);
  }

  getPropertyDefinitions(): Array<{ key: string; type?: string; default?: unknown }> {
    return this.definition.properties || [];
  }

}
