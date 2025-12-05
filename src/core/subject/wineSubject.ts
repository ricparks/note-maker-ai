import { SubjectDefinition, SubjectInfoBase } from './types';
import { WINE_PROMPT } from '../../utils/prompts';
import {
  WINE_SUBJECT_ID,
  WINE_SUBJECT_DIR,
  WINE_UNKNOWN_WINERY,
  WINE_UNTITLED,
  WINE_SECTION_MY_NOTES,
  WINE_SECTION_VENDOR_NOTES,
  WINE_SECTION_CRITIC_NOTES,
  WINE_SECTION_PAIRING_SUGGESTIONS
} from '../../utils/constants';

/** Parsed shape for the Wine subject. */
export interface WineSubjectInfo extends SubjectInfoBase {
  raw: any;
  fields: Record<string, string | number | null> & {
    price?: number;
    winery?: string;
    varietal?: string;
    region?: string;
    vintage?: number | string | null;
    vendorNotes?: string;
    criticNotes?: string;
    pairingSuggestions?: string;
  };
  meta?: {
    subject_match?: boolean;
    predicted_category?: 'wine' | 'book' | 'travel' | 'unknown';
    confidence?: number;
    reason?: string;
  };
}

/** SubjectDefinition for wines: prompt, parsing, filename, and templating rules. */
export const wineSubject: SubjectDefinition<WineSubjectInfo> = {
  id: WINE_SUBJECT_ID,
  prompt: WINE_PROMPT,
  directory: WINE_SUBJECT_DIR,
  ribbonIcon: 'wine',
  ribbonTitle: 'Create wine note',
  /** Build the note filename (without extension). */
  getNoteFilename(info) {
    const winery = info.fields.winery || WINE_UNKNOWN_WINERY;
    const title = info.title || WINE_UNTITLED;
    const vintage = info.fields.vintage ? String(info.fields.vintage) : '';
    return `${winery} - ${title} ${vintage}`.trim().replace(/\s+/g, ' ');
  },
  /** Render markdown content for a wine, including frontmatter and sections. */
  buildNote(info, { photoLink, exifData, narrativeStyleLabel }) {
    const f = info.fields;
    return `---
name: "${info.title || ''}"
photo: "${photoLink || ''}"
narrative_style: "${(narrativeStyleLabel || '').toString().replace(/"/g, '\\"')}"
price: ${typeof f.price === 'number' ? f.price : 0}
winery: "${f.winery || ''}"
varietal: "${f.varietal || ''}"
region: "${f.region || ''}"
year: ${f.vintage || ''}
vendorNotes: "${(f.vendorNotes || '').toString().replace(/"/g, '\\"')}"
criticNotes: "${(f.criticNotes || '').toString().replace(/"/g, '\\"')}"
pairingSuggestions: "${(f.pairingSuggestions || '').toString().replace(/"/g, '\\"')}"
note_created_by: "Wine"
---

#### ${WINE_SECTION_MY_NOTES}

#### ${WINE_SECTION_VENDOR_NOTES}
${f.vendorNotes || ''}

#### ${WINE_SECTION_CRITIC_NOTES}
${f.criticNotes || ''}

#### ${WINE_SECTION_PAIRING_SUGGESTIONS}
${f.pairingSuggestions || ''}

${photoLink ? `!${photoLink}` : ''}`;
  },
  /** Parse AI JSON into WineSubjectInfo with fallbacks for legacy keys. */
  parse(aiJson: any): WineSubjectInfo {
    let obj = aiJson;
    if (typeof aiJson === 'string') {
      try { obj = JSON.parse(aiJson); } catch { obj = {}; }
    }
    const title = obj.wineName || obj.title || '';
    return {
      title,
      producer: obj.winery || '',
      raw: aiJson,
      fields: {
        price: typeof obj.price === 'number' ? obj.price : 0,
        winery: obj.winery || '',
        varietal: obj.varietal || '',
        region: obj.region || '',
        vintage: obj.vintage ?? '',
        vendorNotes: obj.vendorNotes || '',
        criticNotes: obj.criticNotes || '',
        pairingSuggestions: obj.pairingSuggestions || ''
      },
      meta: {
        subject_match: typeof obj.subject_match === 'boolean' ? obj.subject_match : undefined,
        predicted_category: obj.predicted_category || undefined,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : undefined,
        reason: obj.reason || undefined,
      }
    };
  }
};
