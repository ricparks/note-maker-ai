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
export async function parseSubjectDefinitionFile(app: App, filePath: string): Promise<SubjectDefinition<SubjectInfoBase> | null> {
  if (!filePath) return null;

  const file = app.vault.getAbstractFileByPath(filePath);
  
  if (!file || !(file instanceof TFile)) {
    console.warn(`[NoteMakerAI] No subject definition file found at ${filePath}.`);
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
    
    // Basic validation
    if (!parsed.subject_name || !parsed.properties) {
      new Notice(`Invalid subject definition in ${filePath}. Missing required fields.`);
      console.error("[NoteMakerAI] Invalid subject definition:", parsed);
      return null;
    }

    return new FileDefinedSubject(parsed);

  } catch (e) {
    console.error(`[NoteMakerAI] Failed to load subject definition from ${filePath}`, e);
    new Notice(`Failed to load subject definition: ${e}`);
    return null;
  }
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
