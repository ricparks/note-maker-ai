import { App, TFile, parseYaml, Notice } from 'obsidian';
import { FileDefinedSubject } from './FileDefinedSubject';
import { SubjectDefinition, SubjectInfoBase } from './types';
import { SubjectDefinitionFile } from './file_schema';

/**
 * Loads the subject definition from the vault and updates the active subject.
 * Returns true if successful, false otherwise.
 * 
 * @param filePath Vault-relative path to the subject definition file.
 */
export async function parseSubjectDefinitionFile(app: App, filePath: string, suppressLog = false): Promise<SubjectDefinition<SubjectInfoBase> | null> {
  if (!filePath) return null;

  const file = app.vault.getAbstractFileByPath(filePath);
  
  if (!file || !(file instanceof TFile)) {
    if (!suppressLog) console.warn(`[NoteMakerAI] No subject definition file found at ${filePath}.`);
    return null;
  }

  try {
    const content = await app.vault.read(file);
    const yamlContent = extractYamlFromMarkdown(content);
    
    if (!yamlContent) {
      new Notice(`NoteMakerAI: Subject definition file "${filePath}" is empty or invalid.`);
      console.warn(`[NoteMakerAI] ${filePath} is empty or invalid.`);
      return null;
    }

    const parsed = parseYaml(yamlContent) as SubjectDefinitionFile;
    
    // Basic field validation
    const validationErrors = validateSubjectDefinition(parsed);
    if (validationErrors.length > 0) {
      const msg = `Invalid subject definition in ${filePath}:\n- ${validationErrors.join('\n- ')}`;
      console.error(`[NoteMakerAI] ${msg}`);
      new Notice(`NoteMakerAI Error: ${msg}`, 5000); // 5s duration
      return null;
    }

    return new FileDefinedSubject(parsed);

  } catch (e) {
    console.error(`[NoteMakerAI] Failed to load subject definition from ${filePath}`, e);
    // Be explicit if it's our own validation error vs a parsing error
    new Notice(`Failed to load subject definition: ${e}`);
    return null;
  }
}

/**
 * Validates the parsed structure of a Subject Definition File.
 * Returns an array of error messages. Empty array means valid.
 */
function validateSubjectDefinition(def: any): string[] {
  const errors: string[] = [];

  // 1. Required Top-Level Fields
  const requiredFields = [
    'subject_name',
    'icon',
    'naming',
    'properties',
    'sections',
    'lead_prompt',
    'trailing_prompt'
  ];

  for (const field of requiredFields) {
    if (!def[field]) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // Abort if strict structure is missing to avoid crashing below
  if (errors.length > 0) return errors;

  // 2. Validate Naming
  if (typeof def.naming.note !== 'string') errors.push("Field 'naming.note' must be a string template.");
  if (typeof def.naming.photo !== 'string') errors.push("Field 'naming.photo' must be a string template.");

  // 3. Validate Properties
  if (!Array.isArray(def.properties)) {
    errors.push("'properties' must be a list (array).");
  } else {
    const keys = new Set<string>();
    def.properties.forEach((prop: any, index: number) => {
      if (!prop.key) {
        errors.push(`Property at index ${index} is missing 'key'.`);
        return;
      }
      
      // Duplicate key check
      if (keys.has(prop.key)) {
        errors.push(`Duplicate property key found: '${prop.key}'.`);
      }
      keys.add(prop.key);

      // Must have instruction OR default
      const hasInstruction = typeof prop.instruction === 'string' && prop.instruction.trim().length > 0;
      const hasDefault = prop.default !== undefined;

      if (!hasInstruction && !hasDefault) {
        errors.push(`Property '${prop.key}' must have either an 'instruction' or a 'default' value.`);
      }
    });

    // Optional: Check if naming templates use valid keys
    // (Regex to find {{key}})
    const templateVarRegex = /\{\{([^}]+)\}\}/g;
    const checkTemplate = (tmpl: string, loc: string) => {
        let match;
        while ((match = templateVarRegex.exec(tmpl)) !== null) {
            const key = match[1].trim();
            // Allow system keys or property keys
            if (!keys.has(key) && key !== 'title' && key !== 'producer') {
                 // Warn strictly? Or just log? The user requirement says "reporting errors".
                 // A missing key in template leads to "undefined" in filename, which is bad.
                 errors.push(`Template '${loc}' uses unknown variable '{{${key}}}'. Must match a property key.`);
            }
        }
    };
    if (typeof def.naming.note === 'string') checkTemplate(def.naming.note, 'naming.note');
    if (typeof def.naming.photo === 'string') checkTemplate(def.naming.photo, 'naming.photo');
  }

  // 4. Validate Sections
  if (!Array.isArray(def.sections)) {
    errors.push("'sections' must be a list (array).");
  } else {
    def.sections.forEach((sec: any, index: number) => {
      if (!sec.heading) errors.push(`Section at index ${index} is missing 'heading'.`);
      if (!sec.instruction) errors.push(`Section at index ${index} ('${sec.heading || 'unknown'}') is missing 'instruction'.`);
    });
  }

  // 5. Types check for optionals
  if (def.validate_subject !== undefined && typeof def.validate_subject !== 'boolean') {
    errors.push("'validate_subject' must be a boolean.");
  }
  if (def.validation_threshold !== undefined && typeof def.validation_threshold !== 'number') {
    errors.push("'validation_threshold' must be a number.");
  }

  return errors;
}

/**
 * Extracts content from within ``` markdown code blocks, or returns the raw content
 * if no code blocks are found (assuming pure YAML).
 */
function extractYamlFromMarkdown(content: string): string {
  // Look for ```yaml or just ``` blocks
  const match = content.match(/^```(?:yaml)?\s*([\s\S]*?)\s*```/m);
  if (match) {
    return match[1];
  }
  // Fallback: If no code blocks, assume the whole file is the content (unless it looks like prose)
  // For now, simplistically return the content if it looks like key-value pairs
  return content;
}
