import { stringifyYaml } from 'obsidian';
import { SubjectDefinition, SubjectInfoBase, SubjectNoteData, SubjectExistingNoteContext, SubjectPromptContext } from './types';
import { SubjectDefinitionFile } from './file_schema';

/**
 * A generic SubjectDefinition that configures itself at runtime based on
 * a parsed schema file (SubjectDefinitionFile).
 */
export class FileDefinedSubject implements SubjectDefinition<SubjectInfoBase> {
  public id: string;
  public prompt: string; // Base prompt, though we largely use getPrompt
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

    // prompt properties: exclude ones that have a default AND no instruction
    const promptProperties = properties.filter(p => !p.default || p.instruction);

    const propsList = promptProperties.map(p => {
      let instr = p.instruction || "Extract value";
      if (p.type === 'sequence' || p.type === 'list' || p.type === 'array') {
        instr += " (as a list)";
      }
      return `- ${p.key}: ${instr}`;
    }).join('\n');
    const sectionsList = sections.map(s => `- ${s.heading}: ${s.instruction}`).join('\n');
    
    // We also construct a robust JSON example dynamically to help the LLM structure correctly
    const exampleObj: Record<string, any> = {};
    promptProperties.forEach(p => {
      if (p.type === 'sequence' || p.type === 'list' || p.type === 'array') {
        exampleObj[p.key] = ["...", "..."];
      } else {
        exampleObj[p.key] = "...";
      }
    });
    sections.forEach(s => exampleObj[s.heading] = "...");
    
    // Combine standard meta fields that are always requested in trailing_prompt
    // (Note: trailing_prompt in the file already contains specific JSON requirements/examples, 
    // but we inject the specific fields list to be sure).

    const exampleJson = JSON.stringify(exampleObj, null, 2);
    
  return `${lead_prompt}

Extract these Properties:
${propsList}

Generate content for these Sections:
${sectionsList}

Return your response as JSON matching this exact structure:
${exampleJson}

${trailing_prompt}`;
  }

  /**
   * Dynamic prompt generation (allows for context additions like Redo).
   */
  async getPrompt(context: SubjectPromptContext): Promise<string> {
    let finalPrompt = this.prompt;

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
  private applyTemplate(template: string, info: SubjectInfoBase): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      // Check in fields
      if (key in info.fields) {
        const val = info.fields[key];
        // Ensure we don't treat false or 0 as empty string
        if (val === undefined || val === null) return '';
        return String(val);
      }
      // Check in base info (title, producer)
      if (key === 'title') return info.title;
      if (key === 'producer') return info.producer || '';
      if (key === 'sdf_version') return this.definition.sdf_version || '';
      
      return ''; // Fallback to empty
    });
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
    const raw = this.applyTemplate(template, info);
    // Sanitize for file system
    return this.sanitizeFilename(raw) || 'Untitled Note';
  }

  getPhotoBasename(info: SubjectInfoBase): string {
    const template = this.definition.naming?.photo || "image";
    const raw = this.applyTemplate(template, info);
    // Slugify for photo filenames (convention prefer snake_case/lowercase for assets)
    return this.slugify(raw) || 'image';
  }

  parse(aiJson: any): SubjectInfoBase {
    // Pass-through parsing. We trust the keys match what we asked for.
    // We try to identify 'title' and 'producer' (author) for the Base system.
    
    // Heuristic: finding the "title" property
    // We look for a property explicitly named 'title', or the first property in the list.
    const titleKey = this.definition.properties.find(p => p.key.toLowerCase() === 'title')?.key || 'title';
    const title = aiJson[titleKey] || 'Untitled';

    // Heuristic: finding the "producer" (author) property
    // Look for 'author', 'producer', or just use empty.
    const producerKey = this.definition.properties.find(p => 
      p.key.toLowerCase() === 'author' || p.key.toLowerCase() === 'producer'
    )?.key;
    const producer = producerKey ? aiJson[producerKey] : '';

    const result: SubjectInfoBase = {
      title: String(title),
      producer: String(producer),
      raw: aiJson,
      fields: aiJson
    };

    // Inject defaults for any missing keys
    for (const prop of this.definition.properties) {
      if (prop.default !== undefined && (result.fields[prop.key] === undefined || result.fields[prop.key] === null || result.fields[prop.key] === "")) {
        let defVal = prop.default;
        if (typeof defVal === 'string') {
           // Apply templates to the default value (e.g. "{{sdf_version}}")
           defVal = this.applyTemplate(defVal, result);
        }
        result.fields[prop.key] = defVal;
      }
    }

    return result;
  }

  getNoteParts(info: SubjectInfoBase, context: { coverFileName?: string; llmModel?: string }): { frontmatter: Record<string, any>; body: string } {
    const { properties, sections } = this.definition;
    const fields = info.fields as Record<string, any>;

    // 1. Build Frontmatter Object
    const frontmatterObj: Record<string, any> = {};
    
    // Add dynamic properties
    for (const prop of properties) {
      let val = fields[prop.key];
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

    // Framework Section: My Notes (Must exist for Redo)
    contentLines.push(`#### My Notes`);
    contentLines.push(''); // Empty by default

    // Dynamic Sections from Definition
    for (const sec of sections) {
      const heading = sec.heading;
      
      // Look for data in fields (AI JSON) using exact match, then case-insensitive match
      let content = fields[heading];
      if (!content) {
        const lowerHeading = heading.toLowerCase();
        const matchingKey = Object.keys(fields).find(k => k.toLowerCase() === lowerHeading);
        if (matchingKey) {
          content = fields[matchingKey];
        }
      }
      content = content || '';

      contentLines.push(`#### ${heading}`);
      contentLines.push(String(content).trim());
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
    const yamlString = stringifyYaml(frontmatter).trim();
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
    const fields = info.fields as Record<string, any>;

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
}
