import { FileDefinedSubject } from './FileDefinedSubject';
import { SubjectDefinitionFile } from './file_schema';

// This mirrors the default fallback behavior if no subject definition file is provided.
// It is deliberately generic to work for any photo type (books, coins, wine, events, etc).

export const DEFAULT_GENERIC_DEFINITION: SubjectDefinitionFile = {
  subject_name: "Photo Note",
  icon: "image",
  naming: {
    note: "{{title}}",
    photo: "image_{{title}}"
  },
  properties: [
    { key: "title", instruction: "A definitive title for the subject of this photo" },
    { key: "description", instruction: "A concise one-sentence description" },
    { key: "date", instruction: "Date associated with the subject (event date, creation date, or empty)" },
    { key: "tags", instruction: "Comma separated list of descriptive visual tags" }
  ],
  sections: [
    { heading: "Analysis", instruction: "Detailed analysis of the visual content and significance." }
  ],
  lead_prompt: "Analyze the provided image and extract structured metadata. Identify the main subject clearly.",
  trailing_prompt: "Return ONLY valid JSON. If fields are unknown, use empty strings."
};

export const defaultSubject = new FileDefinedSubject(DEFAULT_GENERIC_DEFINITION);
