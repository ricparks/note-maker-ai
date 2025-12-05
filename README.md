# BaseMaker for Obsidian

Turn a photo into a structured note in Obsidian using AI. Supports multiple subjects (e.g., Books, Wine, Travel), consistent photo handling, and a streamlined UX.

## Development

Prereqs:
- Node.js LTS (18+ recommended)
- npm

Install and build:
- Install deps: `npm install`
- Dev (watch): `npm run dev`
- Production build: `npm run build`

Manual install for testing:
Copy `main.js`, `manifest.json`, and optional `styles.css` to your vault at:
`<Vault>/.obsidian/plugins/basemaker/`

## Usage

- In Obsidian, enable the plugin: Settings → Community plugins → Enable “BaseMaker”.
- Open a JPG/PNG image (book cover or wine bottle) in your vault.
- Click the diamond-plus ribbon icon to process the active image.
- A progress modal will show steps. When done, a new note appears under the subject’s folder (e.g., `Bases/Books`).
	- Configure subject and AI provider in Settings → BaseMaker.
	- Add your API key for the selected provider (OpenAI or Gemini).

### Travel subject

Select the Travel subject to create location-oriented notes for your travel photos. If EXIF metadata is present, date/time and GPS will be captured.

- Frontmatter fields: `place_name`, `city`, `country`, `type`, `date_taken` (local date), `time_of_day` (local HH:MM), `latitude`, `longitude`, `altitude`, `photo`.
- Sections: My Notes (blank), Description (AI narrative), Notes of Interest.
- Files are stored under `Bases/Travel`; photos in `Bases/Travel/photos` with canonical names like `place_city_yyyy-mm-dd.jpg`.

## PreparedImage usage (for contributors)

`PreparedImage` encapsulates image preparation as a stateful object: it loads and measures the source, optionally resizes to JPEG in memory, writes a note-ready photo into `subject/photos`, and provides a small AI base64 for model calls. It runs in Obsidian’s browser-like environment and uses canvas for reliable JPEG generation.

Key points:
- Measure without writing: converts bytes to a temporary object URL and inspects `naturalWidth`/`naturalHeight`.
- Resize to JPEG with SOI/EOI checks and dataURL fallback when needed.
- Write/move via Obsidian vault APIs; optionally delete originals based on settings.
- Convert buffers to base64 for AI ingestion.

### Typical flow: prepare in memory, then write

```ts
import type { App, TFile } from 'obsidian';
import { PreparedImage } from 'src/core/image/PreparedImage';

async function processPhoto(app: App, file: TFile) {
	const preparedImage = new PreparedImage(app, file, {
		subjectDir: 'Bases/Books',
		maxW: 750,
		maxH: 1000,
		keepOriginal: false,
		logger: { info: console.log, error: console.error },
	});
	const ok = await preparedImage.ensurePrepared();
	if (!ok) throw new Error('Failed to prepare image');
	const noteBase64 = preparedImage.getNoteBase64();
	const outFile = await preparedImage.writeFile();
	// Optional: collision-safe rename after you know the canonical base name
	// const renamed = await preparedImage.renameTo('author_title_year');
	return { outFile, noteBase64 };
}
```

### Producing a small AI-specific JPEG (<=512px)

```ts
import type { App, TFile } from 'obsidian';
import { PreparedImage } from 'src/core/image/PreparedImage';

async function makeAiImageBase64(app: App, file: TFile) {
	const preparedImage = new PreparedImage(app, file, { subjectDir: 'Bases/Books' });
	const ok = await preparedImage.ensurePrepared();
	if (!ok) throw new Error('Failed to prepare image');
	return await preparedImage.getAiImageBase64();
}
```

### Notes

- Requires canvas/DOM APIs (works in Obsidian desktop/mobile). If a 2D context isn’t available, writing/resizing will throw.
- JPEG writes use `vault.createBinary` (available at runtime). Ensure destination folders exist.
- Logger object with `info` and `error` is optional.
- EXIF orientation isn’t adjusted yet; could be added inside the resizing step.


