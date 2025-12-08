# Forking Guide: Creating a New Subject

This guide explains how to fork NoteMakerAI and adapt it for a new subject (e.g., Wine, Albums, Plants, Photos).

## Overview

NoteMakerAI is designed as a reference implementation using **Books** as the example subject. All subject-specific code is isolated in `src/core/subject/`, making it straightforward to create new subjects.

## Architecture Quick Reference

```
src/
├── core/
│   ├── subject/           ← YOUR MAIN FOCUS
│   │   ├── types.ts       ← SubjectDefinition interface (don't modify)
│   │   ├── index.ts       ← Export your subject here
│   │   └── implementation.ts  ← Replace with your subject
│   ├── ai/                ← AI clients (subject-agnostic, don't modify)
│   ├── image/             ← Image processing (subject-agnostic, don't modify)
│   └── NoteMakerCore.ts   ← Orchestration (rarely needs changes)
├── settings/              ← Settings schema (minor updates may be needed)
└── ui/                    ← UI components (rarely needs changes)
```

## Step-by-Step Guide

### Step 1: Fork the Repository

```bash
git clone https://github.com/your-org/note-maker-ai.git my-wine-notes
cd my-wine-notes
npm install
```

### Step 2: Update Plugin Identity

Update these files with your plugin's identity:

**`manifest.json`:**
```json
{
  "id": "wine-note-maker",
  "name": "WineNoteMaker",
  "version": "0.1.0",
  "description": "Create wine notes from bottle photos using AI",
  ...
}
```

**`package.json`:**
```json
{
  "name": "wine-note-maker",
  ...
}
```

### Step 3: Create Your Subject Implementation

Replace or modify `src/core/subject/implementation.ts`. Here's a template:

```typescript
import { SubjectDefinition, SubjectInfoBase } from './types';
import { TFile } from 'obsidian';

// --- Wine subject constants ---
export const WINE_SUBJECT_ID = 'wine';
export const SUBJECT_DIR = 'Bases/Wine';
export const SUBJECT_PHOTOS_DIR = 'Bases/Wine/photos';

// --- Wine subject prompt ---
export const WINE_PROMPT = `
You are a wine expert. Analyze the provided wine bottle image and extract:
- name: Wine name
- producer: Winery/producer name
- vintage: Year (numeric or empty string)
- region: Wine region
- country: Country of origin
- varietal: Grape variety (e.g., "Cabernet Sauvignon")
- type: red, white, rosé, sparkling, or dessert
- abv: Alcohol percentage (e.g., "14.5")
- tastingNotes: 2-3 sentence description of flavors
- pairings: Suggested food pairings

Also include classification guard fields:
- subject_match: boolean — does this look like a wine bottle?
- predicted_category: one of "wine", "book", "travel", "unknown"
- confidence: 0..1
- reason: short explanation

Return ONLY valid JSON.
`;

// --- Wine subject info shape ---
export interface WineSubjectInfo extends SubjectInfoBase {
  fields: SubjectInfoBase['fields'] & {
    producer?: string;
    vintage?: string;
    region?: string;
    country?: string;
    varietal?: string;
    type?: string;
    abv?: string;
    tastingNotes?: string;
    pairings?: string;
  };
}

// --- Wine subject definition ---
export const wineSubject: SubjectDefinition<WineSubjectInfo> = {
  id: WINE_SUBJECT_ID,
  prompt: WINE_PROMPT,
  directory: SUBJECT_DIR,
  ribbonIcon: 'wine',  // Lucide icon name
  ribbonTitle: 'Create wine note',

  getNoteFilename(info) {
    const producer = info.fields.producer || 'Unknown';
    const name = info.title || 'Untitled Wine';
    const vintage = info.fields.vintage || '';
    return `${producer} - ${name}${vintage ? ` ${vintage}` : ''}`.trim();
  },

  buildNote(info, { coverFileName }) {
    const f = info.fields;
    const coverProp = coverFileName ? `"[[${coverFileName}]]"` : '""';
    const embed = coverFileName ? `\n![[${coverFileName}]]\n` : '';
    
    return `---
name: "${info.title || ''}"
producer: "${f.producer || ''}"
vintage: "${f.vintage || ''}"
region: "${f.region || ''}"
country: "${f.country || ''}"
varietal: "${f.varietal || ''}"
type: "${f.type || ''}"
abv: "${f.abv || ''}"
photo: ${coverProp}
rating: ""
date_tasted: ""
note_created_by: "WineNoteMaker"
---
#### My Notes

#### Tasting Notes
${f.tastingNotes || ''}

#### Pairings
${f.pairings || ''}
${embed}`;
  },

  parse(aiJson: any): WineSubjectInfo {
    let obj = aiJson;
    if (typeof aiJson === 'string') {
      try { obj = JSON.parse(aiJson); } catch { obj = {}; }
    }
    return {
      title: obj.name || '',
      producer: obj.producer || '',
      raw: aiJson,
      fields: {
        producer: obj.producer || '',
        vintage: obj.vintage || '',
        region: obj.region || '',
        country: obj.country || '',
        varietal: obj.varietal || '',
        type: obj.type || '',
        abv: obj.abv || '',
        tastingNotes: obj.tastingNotes || '',
        pairings: obj.pairings || '',
      },
    };
  },

  getPhotoBasename(info) {
    const producer = (info.fields.producer || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const name = (info.title || 'wine').toLowerCase().replace(/\s+/g, '_').slice(0, 40);
    const vintage = info.fields.vintage || 'nv';
    return `${producer}_${name}_${vintage}`;
  },

  parseExistingNote(note) {
    const properties = note.frontmatter || {};
    const sections: Record<string, string> = {};
    
    const lines = note.content.split(/\r?\n/);
    let currentSection: string | null = null;
    let buffer: string[] = [];
    
    for (const line of lines) {
      const match = line.match(/^####\s+(.*)$/);
      if (match) {
        if (currentSection) sections[currentSection] = buffer.join('\n').trim();
        currentSection = match[1].trim();
        buffer = [];
      } else if (currentSection) {
        buffer.push(line);
      }
    }
    if (currentSection) sections[currentSection] = buffer.join('\n').trim();
    
    return {
      properties,
      sections,
      logSummary: `Parsed wine note: "${properties.name || 'Untitled'}"`
    };
  },
};
```

### Step 4: Export Your Subject

Update `src/core/subject/index.ts`:

```typescript
export { type SubjectDefinition, type SubjectInfoBase, /* ... */ } from './types';
import { wineSubject } from './implementation';

export const activeSubject = wineSubject;
```

### Step 5: Update Default Settings (Optional)

In `src/settings/schema.ts`, update the default directories:

```typescript
import { SUBJECT_DIR, SUBJECT_PHOTOS_DIR } from "../core/subject/implementation";

export const DEFAULT_SETTINGS: NoteMakerAISettings = {
  // ...
  folders: {
    notes: SUBJECT_DIR,      // Now points to your subject's dir
    photos: SUBJECT_PHOTOS_DIR,
    addedPromptLocation: "",
  },
  // ...
};
```

### Step 6: Build and Test

```bash
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder.

---

## Key Concepts

### Framework Sections (Required for Redo)

Your `buildNote()` should include these sections for redo support:

- **`#### My Notes`** - User content preserved during redo
- **`#### Prompt Additions`** (optional) - User instructions for redo

### Subject-Specific Sections

Add any sections relevant to your subject:
- Wine: `Tasting Notes`, `Pairings`
- Albums: `Track List`, `Review`
- Plants: `Care Instructions`, `Growth Log`

### The SubjectDefinition Interface

| Method | Purpose |
|--------|---------|
| `id` | Unique identifier (e.g., `'wine'`) |
| `prompt` | AI prompt for extracting metadata |
| `directory` | Default vault folder for notes |
| `ribbonIcon` | Lucide icon name for ribbon |
| `ribbonTitle` | Tooltip for ribbon icon |
| `getNoteFilename(info)` | Generate note filename |
| `buildNote(info, context)` | Generate complete markdown |
| `parse(aiJson)` | Parse AI response into typed structure |
| `getPhotoBasename(info)` | Generate canonical photo filename |
| `parseExistingNote(note)` | Parse existing note for redo |
| `getPrompt(context)` | (Optional) Dynamic prompt generation |
| `validateParsedData(info)` | (Optional) Return warnings |

---

## Tips

1. **Start simple**: Get basic note creation working before adding redo support.

2. **Test your prompt**: Use the AI provider's web interface to test your prompt before integrating.

3. **Use constants**: Define all subject-specific strings as constants for easy modification.

4. **Preserve the contract**: Don't modify `types.ts` unless absolutely necessary.

5. **Check the original**: Reference `implementation.ts` (Books) for patterns.

---

## Example Subjects

Ideas for new subjects:

| Subject | Key Fields | Sections |
|---------|------------|----------|
| **Wine** | producer, vintage, varietal, region | Tasting Notes, Pairings |
| **Albums** | artist, album, year, label, genre | Track List, Review |
| **Plants** | species, common name, care level | Care Instructions, Growth Log |
| **Recipes** | cuisine, prep time, servings | Ingredients, Instructions |
| **Art** | artist, title, medium, year | Description, Provenance |

---

## Questions?

Refer to the existing Books implementation in `src/core/subject/implementation.ts` as a working reference.
