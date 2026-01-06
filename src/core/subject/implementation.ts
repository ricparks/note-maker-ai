import { SubjectDefinition, SubjectInfoBase } from './types';
import { TFile } from 'obsidian';

// --- Book subject literals ---
/** Stable identifier for the Books subject definition. */
export const BOOK_SUBJECT_ID = 'books';
/** Default directory for Book notes inside the vault. */
export const SUBJECT_DIR = 'Bases/Books';
/** Default directory for photos. */
export const SUBJECT_PHOTOS_DIR = 'Bases/Books/photos';
/** Default fallback display name for author. */
export const BOOK_UNKNOWN_AUTHOR = 'Unknown Author';
/** Default fallback display title for book notes. */
export const BOOK_UNTITLED = 'Untitled Book';
/** Photo filename fallbacks and limits. */
export const BOOK_PHOTO_AUTHOR_UNKNOWN = 'unknown';
export const BOOK_PHOTO_TITLE_DEFAULT = 'untitled';
export const BOOK_PHOTO_MAX_TITLE_SLUG = 60;
export const BOOK_PHOTO_FALLBACK_BASENAME = 'image';
/** Section heading labels used in book notes. */
export const BOOK_SECTION_MY_NOTES = 'My Notes';
export const BOOK_SECTION_SUMMARY = 'Summary';
export const BOOK_SECTION_THEMES = 'Themes';

// --- Book subject prompt ---
/** AI prompt for extracting book metadata from a cover image. */
export const BOOK_PROMPT = `
You are a meticulous literary assistant. Analyze the provided book cover image and infer structured metadata.
Search for additional information online if needed. Make an extra effort to find the publication date and ISBN.
If the book is a short story collection, anthology, or magazine, list some representative authors in the summary property.
Include fiction or non-fiction classification in the genres field if possible.
Extract the following fields if possible:
- title: Canonical book title
- author: Primary author name formatted as "Last Name, First Name" (e.g., "Herbert, Frank"). If multiple authors, format each as "Last, First" and separate with "; ".
- subtitle: Subtitle if it exists
- series: Series name (omit volume numbering here)
- volume: Volume number (numeric if present, else 0)
- publisher: Publisher imprint
- publicationDate: Year of publication (string; empty if unknown)
- isbn: ISBN-10 or ISBN-13; prefer ISBN-13 if both are present. Return digits only (remove hyphens and spaces). If unknown, return empty string.
- genres: Comma-separated list of 1-5 genres
- themes: Short comma-separated list of 1-6 thematic concepts
- summary: 2-4 sentence neutral summary (avoid spoilers).

If a field is unknown, use an empty string for text fields and 0 for numeric fields (only 'volume' uses numeric). Do not hallucinate beyond visually / famously verifiable information.
Also include lightweight classification guard fields to help verify the chosen subject without extra requests:
- subject_match: boolean — does this image look like a book cover?
- predicted_category: one of "wine", "book", "travel", or "unknown"
- confidence: number 0..1 — confidence in predicted_category
- reason: short explanation (one sentence max)

Return ONLY valid JSON with these keys.
Example: { "title": "Dune", "author": "Herbert, Frank", "subtitle": "", "series": "Dune", "volume": 1, "publisher": "Chilton", "publicationDate": "1965", "isbn": "9780441172719", "genres": "Science Fiction", "themes": "politics, ecology", "summary": "...", "subject_match": true, "predicted_category": "book", "confidence": 0.95, "reason": "Typography, author name, and publisher imprint present." }
`;

// --- ISBN helpers ---
function normalizeIsbnTo13(raw: any): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 13) {
    return isValidIsbn13(cleaned) ? cleaned : '';
  }
  if (cleaned.length === 10) {
    return isValidIsbn10(cleaned) ? isbn10to13(cleaned) : '';
  }
  return '';
}

function isValidIsbn10(s: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * (s.charCodeAt(i) - 48);
  const checkChar = s.charAt(9);
  const checkVal = checkChar === 'X' ? 10 : (checkChar.charCodeAt(0) - 48);
  sum += checkVal;
  return sum % 11 === 0;
}

function isValidIsbn13(s: string): boolean {
  if (!/^[0-9]{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = s.charCodeAt(i) - 48;
    sum += (i % 2 === 0) ? n : 3 * n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === (s.charCodeAt(12) - 48);
}

function isbn10to13(s10: string): string {
  const core9 = s10.slice(0, 9);
  const base = '978' + core9;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = base.charCodeAt(i) - 48;
    sum += (i % 2 === 0) ? n : 3 * n;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + String(check);
}

/**
 * Parsed shape for the Books subject.
 */
export interface BookSubjectInfo extends SubjectInfoBase {
  fields: SubjectInfoBase['fields'] & {
    author?: string;
    subtitle?: string;
    series?: string;
    volume?: number | string | null;
    publisher?: string;
    publicationDate?: string | number | null; // Accepts legacy numeric year or full date string
    isbn?: string;
    isbnInvalid?: boolean; // true when a value was provided but invalid after normalization
    genres?: string;
    themes?: string;
    summary?: string;
  };
  meta?: {
    subject_match?: boolean;
    predicted_category?: 'wine' | 'book' | 'travel' | 'unknown';
    confidence?: number;
    reason?: string;
  };
}

/** SubjectDefinition for books: prompt, parsing, filename, and templating rules. */
export const bookSubject: SubjectDefinition<BookSubjectInfo> = {
  id: BOOK_SUBJECT_ID,
  prompt: BOOK_PROMPT,
  directory: SUBJECT_DIR,
  ribbonIcon: 'book-open',
  ribbonTitle: 'Create book note',
  
  /**
   * Compute a canonical photo base name for books using author last name, title, and year.
   * - Author uses the first author only (expects "Last, First"; falls back to raw)
   * - Title is normalized to ASCII, lowercased, spaces → underscores, capped at 60 chars
   * - Year extracted as a 4-digit token from publicationDate; falls back to "unknown"
   */
  getPhotoBasename(info) {
    // Author: use first author only, assume "Last, First" or fallback
    const authorRaw = (info.fields.author || info.producer || '').toString();
    let authorLast = BOOK_PHOTO_AUTHOR_UNKNOWN;
    if (authorRaw) {
      const firstAuthor = authorRaw.split(';')[0].trim();
      const lastPart = firstAuthor.split(',')[0]?.trim();
      authorLast = lastPart || 'unknown';
    }

    // Title: normalize to ASCII, lowercase, underscores, max 60 chars
    const titleRaw = (info.title || BOOK_PHOTO_TITLE_DEFAULT).toString();
    const titleAscii = titleRaw.normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/[\s]+/g, ' ').trim();
    let titleSlug = titleAscii.toLowerCase().replace(/[\s]+/g, '_');
    if (titleSlug.length > BOOK_PHOTO_MAX_TITLE_SLUG) titleSlug = titleSlug.slice(0, BOOK_PHOTO_MAX_TITLE_SLUG).replace(/_+$/g, '');

    // Year: try to extract 4-digit year from publicationDate
    const pub = (info.fields.publicationDate || '').toString();
    const match = pub.match(/\b(\d{4})\b/);
    const year = match ? match[1] : 'unknown';

    // Assemble without extension; NoteMakerAI will add .jpg and disambiguator
    const base = `${authorLast}_${titleSlug}_${year}`
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || BOOK_PHOTO_FALLBACK_BASENAME;
  },
  /** Build the note filename (without extension). */
  getNoteFilename(info) {
    const author = (info.fields.author || info.producer || BOOK_UNKNOWN_AUTHOR).toString();
    const title = info.title || BOOK_UNTITLED;
    return `${author} - ${title}`.trim().replace(/\s+/g, ' ');
  },
  /**
   * Render markdown content for a book, including frontmatter and sections.
   * Summary and themes appear as sections (not frontmatter properties).
   */
  buildNote(info, { coverFileName, exifData, llmModel }) {
    const f = info.fields;
    const rawAuthor = (f.author || info.producer || '').toString();
    const coverProp = coverFileName ? `"[[${coverFileName}]]"` : '""';
    const bottomEmbed = coverFileName ? `\n![[${coverFileName}]]\n` : '';
    const llmModelProp = llmModel ? `\nllm-model: "${llmModel}"` : '';
    return `---
title: "${(info.title || '').replace(/"/g, '\\"')}"
author: "${rawAuthor.replace(/"/g, '\\"')}"
author_original: "${rawAuthor.replace(/"/g, '\\"')}"
subtitle: "${(f.subtitle || '').toString().replace(/"/g, '\\"')}"
series: "${(f.series || '').toString().replace(/"/g, '\\"')}"
volume: ${f.volume || ''}
publisher: "${(f.publisher || '').toString().replace(/"/g, '\\"')}"
publicationDate: "${(f.publicationDate || '').toString().replace(/"/g, '\\"')}"
isbn: "${(f.isbn || '').toString().replace(/"/g, '\\"')}"
genres: "${(f.genres || '').toString().replace(/"/g, '\\"')}"
date_read: ""
rating: ""
is_reviewed: 
is_digital: 
photo: ${coverProp}
note_created_by: "Books"${llmModelProp}
---
#### ${BOOK_SECTION_MY_NOTES}

#### ${BOOK_SECTION_SUMMARY}
${f.summary || ''}
#### ${BOOK_SECTION_THEMES}
${f.themes || ''}
${bottomEmbed}`;
  },
  /**
   * Parse AI JSON into BookSubjectInfo with fallbacks for legacy keys.
   */
  parse(aiJson: any): BookSubjectInfo {
    let obj = aiJson;
    if (typeof aiJson === 'string') {
      try { obj = JSON.parse(aiJson); } catch { obj = {}; }
    }
    const title = obj.title || obj.bookTitle || '';
    // Normalize ISBN: prefer 13-digit numeric; convert valid ISBN-10 to ISBN-13; else empty.
    const originalIsbnRaw = obj.isbn || obj.ISBN || '';
    const isbn = normalizeIsbnTo13(originalIsbnRaw);
    const isbnInvalid = typeof originalIsbnRaw === 'string' && originalIsbnRaw.trim() !== '' && isbn === '';
    return {
      title,
      producer: obj.author || '',
      raw: aiJson,
      fields: {
        author: obj.author || '',
        subtitle: obj.subtitle || '',
        series: obj.series || '',
        volume: obj.volume ?? '',
        publisher: obj.publisher || '',
        publicationDate: (obj.publicationDate || obj.publishedYear || ''),
        isbn,
        isbnInvalid,
        genres: obj.genres || '',
        themes: obj.themes || '',
        summary: obj.summary || ''
      },
      meta: {
        subject_match: typeof obj.subject_match === 'boolean' ? obj.subject_match : undefined,
        predicted_category: obj.predicted_category || undefined,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : undefined,
        reason: obj.reason || undefined,
      }
    };
  },
  /**
   * Validate parsed data and return warnings.
   */
  validateParsedData(info) {
    const warnings: string[] = [];
    if (info.fields.isbnInvalid) {
      warnings.push("Warning: The detected ISBN appears invalid and was omitted.");
    }
    return warnings;
  },

  parseExistingNote(note: import('./types').SubjectExistingNoteContext) {
    const properties = note.frontmatter || {};
    const sections: import('./types').SubjectNoteSections = {};
    
    // Regex-based section parser - recognizes any markdown heading level (# through ######)
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
      logSummary: `Parsed book note: "${properties.title || 'Untitled'}"`
    };
  },

  async getPrompt(context) {
    let prompt = BOOK_PROMPT;



    // 2. Append per-note additions (Manual / Redo)
    if (context.noteData) {
      const sections = context.noteData.sections;
      // Check for "Prompt Additions" or alias "PA"
      const additions = sections['Prompt Additions'] || sections['PA'] || sections['pa'];
      if (additions && additions.trim().length > 0) {
        prompt += `\n\nIMPORTANT: The user has provided additional instructions for this request:\n${additions.trim()}`;
      }
    }
    return prompt;
  }
};

// No local reformatting: we trust the LLM to return "Last, First" per prompt.
