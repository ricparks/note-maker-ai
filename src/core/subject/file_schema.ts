
export interface FileDefinedProperty {
  key: string;
  instruction?: string;
  type?: string;
  default?: any;
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
  trailing_prompt: string;
  validate_subject?: boolean;
  validation_threshold?: number;
}
