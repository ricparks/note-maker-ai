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
