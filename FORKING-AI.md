# AI-Assisted Forking Guide

This guide is for developers who want to create a new subject using an AI-enabled IDE (Cursor, VS Code + Copilot, Windsurf, etc.). Just fork, open your IDE, and paste a prompt.

## Prerequisites

1. Fork this repository
2. Clone it locally: `git clone <your-fork-url> my-wine-notes`
3. Open in your AI-enabled IDE
4. Run `npm install`

## The One-Prompt Approach

After opening the project in your IDE, paste this prompt (customize the bracketed sections):

---

### 🍷 Example: Creating a Wine Subject

```
I want to create a Wine subject for this NoteMakerAI plugin. The current implementation 
is for Books. I need you to:

1. Update manifest.json:
   - Change id to "wine-note-maker"
   - Change name to "WineNoteMaker"
   - Update description to "Create wine notes from bottle photos using AI"

2. Update package.json name to "wine-note-maker"

3. Replace src/core/subject/implementation.ts with a Wine implementation:
   - Subject ID: "wine"
   - Directory: "Bases/Wine"
   - Photos directory: "Bases/Wine/photos"
   - Ribbon icon: "wine" (or "grape")
   - Ribbon title: "Create wine note"
   
   AI prompt should extract these fields from a wine bottle photo:
   - name (wine name)
   - producer (winery)
   - vintage (year)
   - region
   - country
   - varietal (grape variety)
   - type (red/white/rosé/sparkling/dessert)
   - abv (alcohol percentage)
   - tastingNotes (2-3 sentences)
   - pairings (food suggestions)
   
   Frontmatter properties should include all the above plus:
   - rating (empty, user fills in)
   - date_tasted (empty, user fills in)
   - photo (the bottle image link)
   - note_created_by: "WineNoteMaker"
   
   Sections in the note (using #### headers):
   - My Notes (empty, for user - REQUIRED for redo feature)
   - Tasting Notes (from AI)
   - Pairings (from AI)
   
   Note filename format: "Producer - Wine Name Vintage"

4. Update src/core/subject/index.ts to export wineSubject instead of bookSubject

5. Build and verify: npm run build

Keep the same patterns used in the Books implementation. Reference src/core/subject/types.ts 
for the SubjectDefinition interface that must be implemented.
```

---

### 📸 Example: Creating a Photo/Travel Subject

```
I want to create a Travel Photo subject for this NoteMakerAI plugin. The current 
implementation is for Books. I need you to:

1. Update manifest.json:
   - Change id to "travel-note-maker"
   - Change name to "TravelNoteMaker"
   - Update description to "Create travel notes from photos using AI and EXIF data"

2. Update package.json name to "travel-note-maker"

3. Replace src/core/subject/implementation.ts with a Travel implementation:
   - Subject ID: "travel"
   - Directory: "Bases/Travel"
   - Photos directory: "Bases/Travel/photos"
   - Ribbon icon: "map-pin"
   - Ribbon title: "Create travel note"
   
   AI prompt should analyze the photo and extract:
   - placeName (specific location name)
   - city
   - country
   - locationType (landmark/restaurant/nature/museum/etc)
   - description (2-3 sentence description of what's in the photo)
   - notesOfInterest (interesting facts about the location)
   
   The getPrompt() function should include EXIF data in the prompt when available,
   especially GPS coordinates and date taken.
   
   Frontmatter should include:
   - place_name, city, country, type
   - latitude, longitude, altitude (from EXIF if available)
   - date_taken, time_of_day (from EXIF if available)
   - photo, rating, note_created_by: "TravelNoteMaker"
   
   Sections:
   - My Notes (empty - REQUIRED for redo)
   - Description (from AI)
   - Notes of Interest (from AI)
   
   Note filename: "PlaceName - City (YYYY-MM-DD)" using EXIF date if available

4. Update src/core/subject/index.ts to export travelSubject

5. Build and verify: npm run build
```

---

### 🌱 Example: Creating a Plant Subject

```
I want to create a Plant subject for this NoteMakerAI plugin. The current implementation 
is for Books. I need you to:

1. Update manifest.json:
   - Change id to "plant-note-maker"  
   - Change name to "PlantNoteMaker"
   - Update description to "Create plant care notes from photos using AI"

2. Update package.json name to "plant-note-maker"

3. Replace src/core/subject/implementation.ts with a Plant implementation:
   - Subject ID: "plants"
   - Directory: "Bases/Plants"
   - Photos directory: "Bases/Plants/photos"
   - Ribbon icon: "leaf"
   - Ribbon title: "Create plant note"
   
   AI prompt should identify the plant and extract:
   - commonName
   - scientificName
   - family (plant family)
   - origin (native region)
   - lightRequirements (low/medium/bright indirect/direct)
   - wateringFrequency
   - humidity (low/medium/high)
   - toxicity (safe/toxic to pets/toxic to humans)
   - careLevel (easy/moderate/difficult)
   - description (2-3 sentences about the plant)
   - careTips (specific care instructions)
   
   Frontmatter:
   - common_name, scientific_name, family, origin
   - light, water, humidity, toxicity, care_level
   - date_acquired (empty), location (empty), photo
   - note_created_by: "PlantNoteMaker"
   
   Sections:
   - My Notes (empty - REQUIRED for redo)
   - Description (from AI)
   - Care Instructions (from AI)
   - Growth Log (empty, for user to track)
   
   Note filename: "CommonName (ScientificName)"

4. Update src/core/subject/index.ts to export plantSubject

5. Build and verify: npm run build
```

---

## Template for Any Subject

Copy and customize this template:

```
I want to create a [SUBJECT] subject for this NoteMakerAI plugin. The current 
implementation is for Books. I need you to:

1. Update manifest.json:
   - Change id to "[subject]-note-maker"
   - Change name to "[Subject]NoteMaker"  
   - Update description to "[Your description]"

2. Update package.json name to "[subject]-note-maker"

3. Replace src/core/subject/implementation.ts with a [Subject] implementation:
   - Subject ID: "[subject]"
   - Directory: "Bases/[Subject]"
   - Photos directory: "Bases/[Subject]/photos"
   - Ribbon icon: "[lucide-icon-name]"
   - Ribbon title: "Create [subject] note"
   
   AI prompt should extract these fields from the image:
   - [field1]: [description]
   - [field2]: [description]
   - [field3]: [description]
   ...
   
   Frontmatter properties:
   - [list your frontmatter fields]
   - note_created_by: "[Subject]NoteMaker"
   
   Sections (using #### headers):
   - My Notes (empty - REQUIRED for redo feature to preserve user content)
   - [Section1] (from AI)
   - [Section2] (from AI)
   
   Note filename format: "[describe pattern]"

4. Update src/core/subject/index.ts to export [subject]Subject instead of bookSubject

5. Build and verify: npm run build

Keep the same patterns used in the Books implementation. Reference src/core/subject/types.ts 
for the SubjectDefinition interface.
```

---

## Tips for Better Results

1. **Be specific about fields**: The more specific you are about what data to extract, the better the AI prompt will be.

2. **Mention the My Notes section**: Always include "My Notes (empty - REQUIRED for redo)" so the AI knows this is a framework requirement.

3. **Reference existing code**: Include "Keep the same patterns used in the Books implementation" to ensure consistency.

4. **One thing at a time**: If the AI struggles, break it into smaller prompts:
   - First: "Show me what implementation.ts should look like for Wine"
   - Then: "Now update the actual file"
   - Then: "Update manifest.json and package.json"
   - Finally: "Update index.ts and build"

5. **Verify the build**: Always end with "Build and verify: npm run build" so the AI checks its work.

---

## Common Lucide Icons

For the `ribbonIcon` field, use these Lucide icon names:

| Subject | Icon Options |
|---------|--------------|
| Wine | `wine`, `grape`, `glass-water` |
| Music/Albums | `disc`, `music`, `headphones` |
| Plants | `leaf`, `flower`, `sprout` |
| Travel | `map-pin`, `plane`, `camera` |
| Recipes | `chef-hat`, `utensils`, `cookie` |
| Art | `palette`, `frame`, `brush` |
| Movies | `film`, `clapperboard`, `tv` |
| Games | `gamepad`, `dice`, `puzzle` |

Browse all icons at: https://lucide.dev/icons/

---

## After the AI is Done

1. **Build**: `npm run build`
2. **Test**: Copy files to your vault and try it
3. **Iterate**: If something's wrong, describe the issue to the AI

That's it! The AI should handle the TypeScript details - you just need to describe what you want.
