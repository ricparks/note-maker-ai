import { SubjectDefinition, SubjectInfoBase, SubjectNoteData, SubjectNoteSections, SubjectExistingNoteContext, SubjectPromptContext } from './types';
import { TRAVEL_PROMPT } from '../../utils/prompts';
import {
  TRAVEL_SUBJECT_ID,
  TRAVEL_SUBJECT_DIR,
  TRAVEL_UNKNOWN_PLACE,
  TRAVEL_UNKNOWN_CITY,
  TRAVEL_UNKNOWN_COUNTRY,
  TRAVEL_SECTION_MY_NOTES,
  TRAVEL_SECTION_DESCRIPTION,
  TRAVEL_SECTION_NOTES_OF_INTEREST,
} from '../../utils/constants';

type ExifData = import('../image/PreparedImage').ExifData;

function sanitizeFrontmatter(frontmatter?: Record<string, any>): Record<string, any> {
  if (!frontmatter) return {};
  const { position, ...rest } = frontmatter;
  return { ...rest };
}

function extractSections(content: string): SubjectNoteSections {
  const sections: SubjectNoteSections = {};
  if (!content) return sections;
  const lines = content.split(/\r?\n/);
  let frontmatterBoundaryCount = 0;
  let inFrontmatter = false;
  let current: string | null = null;
  let buffer: string[] = [];

  const commit = () => {
    if (!current) return;
    sections[current] = buffer.join('\n').trimEnd();
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (frontmatterBoundaryCount < 2 && trimmed === '---') {
      frontmatterBoundaryCount++;
      inFrontmatter = frontmatterBoundaryCount === 1;
      continue;
    }

    if (inFrontmatter) continue;

    const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
    if (headingMatch) {
      commit();
      current = headingMatch[1].trim();
      continue;
    }

    if (current) buffer.push(line);
  }

  commit();
  return sections;
}

export interface TravelSubjectInfo extends SubjectInfoBase {
  fields: SubjectInfoBase['fields'] & {
    place_name?: string;
    city?: string;
    state_province?: string;
    country?: string;
    type?: string;
    description?: string;
    notesOfInterest?: string;
    short_label?: string;
  };
}

function toLocalDateTimeParts(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  // date-only (YYYY-MM-DD) and local time (HH:MM) zero-padded
  const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  const time = [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(':');
  return { date, time };
}

function round6(n?: number | null): number | '' {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  return Math.round(n * 1e6) / 1e6;
}

function coerceString(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function findPromptAdditions(sections: SubjectNoteSections): string {
  const entry = Object.entries(sections).find(([heading]) => {
    const normalized = heading.trim().toLowerCase();
    return normalized === 'prompt additions' || normalized === 'pa';
  });
  if (!entry) return '';
  return entry[1].trim();
}

function buildMetadataBlock(properties: Record<string, any>): string {
  const lines: string[] = [];
  const addLine = (key: string, label: string) => {
    const value = coerceString(properties[key]);
    if (value.length === 0) return;
    lines.push(`${label}: ${value}`);
  };

  addLine('place_name', 'Place name');
  addLine('city', 'City');
  addLine('state_province', 'State/Province');
  addLine('country', 'Country');
  addLine('type', 'Location type');
  addLine('date_taken', 'Date taken');
  addLine('time_of_day', 'Time of day');
  addLine('latitude', 'Latitude');
  addLine('longitude', 'Longitude');
  addLine('altitude', 'Altitude');

  if (lines.length === 0) return '';
  return `Existing note metadata:\n${lines.join('\n')}`;
}

export const travelSubject: SubjectDefinition<TravelSubjectInfo> = {
  id: TRAVEL_SUBJECT_ID,
  prompt: TRAVEL_PROMPT,
  directory: TRAVEL_SUBJECT_DIR,
  ribbonIcon: 'map-pin',
  ribbonTitle: 'Create travel note',
  getPrompt(context: SubjectPromptContext = {}) {
    const { exifData, noteData } = context;
    const lat = typeof exifData?.latitude === 'number' ? exifData.latitude : undefined;
    const lon = typeof exifData?.longitude === 'number' ? exifData.longitude : undefined;
    let prompt = TRAVEL_PROMPT;
    if (lat !== undefined && lon !== undefined) {
      const locHint = `\n\nApproximate GPS location (latitude, longitude): ${lat}, ${lon}. Use this as a hint to identify the place. If it conflicts with the image content, prioritize the image.`;
      prompt += locHint;
    }

    if (!noteData) return prompt;

    const metadataBlock = buildMetadataBlock(noteData.properties || {});
    const additions = findPromptAdditions(noteData.sections || {});
    if (metadataBlock) {
      prompt += `\n\n${metadataBlock}`;
    }
    if (additions) {
      prompt += `\n\nFurther instructions: ${additions}`;
    }
    return prompt;
  },

  getNoteFilename(info) {
    const place = (info.fields.place_name || TRAVEL_UNKNOWN_PLACE).toString();
    const city = (info.fields.city || '').toString();
    const stateProv = (info.fields.state_province || '').toString();
    const country = (info.fields.country || '').toString();
    const shortLabel = (info.fields.short_label || '').toString();
    const loc = [city, stateProv, country].filter(Boolean).join(', ');
    const parts = [place, shortLabel, loc].filter(Boolean);
    const name = parts.join(' - ').trim() || 'Travel Photo';
    return name.replace(/\s+/g, ' ');
  },

  getPhotoBasename(info, ctx) {
    const place = (info.fields.place_name || TRAVEL_UNKNOWN_PLACE).toString();
    const city = (info.fields.city || '').toString();
    const { date } = toLocalDateTimeParts((ctx?.exifData?.dateTimeOriginal) ?? null);
    const shortLabel = (info.fields.short_label || '').toString();
    // canonical: place_city_yyyy-mm-dd (lowercase, underscores)
    const baseRaw = [place, city, date, shortLabel].filter(Boolean).join(' ');
    const ascii = baseRaw.normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
    const slug = ascii.toLowerCase().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '');
    return slug || 'travel_photo';
  },

  buildNote(info, { photoLink, coverFileName, exifData, narrativeStyleLabel }) {
    const f = info.fields;
    const { date, time } = toLocalDateTimeParts(exifData?.dateTimeOriginal ?? null);
    const lat = round6(exifData?.latitude ?? null);
    const lon = round6(exifData?.longitude ?? null);
    const alt = round6(exifData?.altitude ?? null);
    const mapLink = (lat !== '' && lon !== '') ? `[Open in Maps](https://maps.google.com/?q=${lat},${lon})` : '';
    const photoBlock = coverFileName ? `![[${coverFileName}]]\n` : '';
    const mapBlock = mapLink ? `${mapLink}\n` : '';
    const leadBlock = photoBlock || mapBlock ? `${photoBlock}${mapBlock}\n` : '';
    return `---
place_name: "${(f.place_name || TRAVEL_UNKNOWN_PLACE).toString().replace(/"/g, '\\"')}"
city: "${(f.city || TRAVEL_UNKNOWN_CITY).toString().replace(/"/g, '\\"')}"
state_province: "${(f.state_province || '').toString().replace(/"/g, '\\"')}"
country: "${(f.country || TRAVEL_UNKNOWN_COUNTRY).toString().replace(/"/g, '\\"')}"
type: "${(f.type || '').toString().replace(/"/g, '\\"')}"
short_label: "${(f.short_label || '').toString().replace(/"/g, '\\"')}"
date_taken: "${date}"
time_of_day: "${time}"
latitude: ${lat === '' ? '' : lat}
longitude: ${lon === '' ? '' : lon}
altitude: ${alt === '' ? '' : alt}
photo: ${coverFileName ? `"[[${coverFileName}]]"` : '""'}
narrative_style: "${(narrativeStyleLabel || '').toString().replace(/"/g, '\\"')}"
note_created_by: "Travel"
---
${leadBlock}#### ${TRAVEL_SECTION_MY_NOTES}

#### ${TRAVEL_SECTION_DESCRIPTION}
${(f.description || '').toString()}

#### ${TRAVEL_SECTION_NOTES_OF_INTEREST}
${(f.notesOfInterest || '').toString()}
`;
  },

  parse(aiJson: any): TravelSubjectInfo {
    let obj = aiJson;
    if (typeof aiJson === 'string') {
      try { obj = JSON.parse(aiJson); } catch { obj = {}; }
    }
    const place = obj.place_name || obj.placeName || obj.title || '';
    // normalize short_label: <= 3 words, trimmed, no excessive punctuation
    const rawShort: string = obj.short_label || obj.shortLabel || '';
    const words = rawShort.trim().split(/\s+/).slice(0, 3);
    const short_label = words.join(' ').slice(0, 30);
    return {
      title: place || TRAVEL_UNKNOWN_PLACE,
      producer: '',
      raw: aiJson,
      fields: {
        place_name: place || '',
        city: obj.city || '',
        state_province: obj.state_province || obj.state || obj.province || '',
        country: obj.country || '',
        type: obj.type || '',
        description: obj.description || '',
        notesOfInterest: obj.notesOfInterest || obj.notes || '',
        short_label,
      }
    };
  },

  async parseExistingNote(note: SubjectExistingNoteContext): Promise<SubjectNoteData> {
    const properties = sanitizeFrontmatter(note.frontmatter);
    const sections = extractSections(note.content);
    const shortLabel = (properties?.short_label ?? '').toString().trim();
    const logSummary = shortLabel
      ? `Parsed travel note (short_label: ${shortLabel})`
      : 'Parsed travel note';
    return {
      properties,
      sections,
      logSummary,
    };
  }
};
