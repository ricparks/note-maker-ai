# NoteMakerAI for Obsidian

Turn a photo into a structured note in Obsidian using AI. This reference implementation processes book covers, and is designed to be forked and adapted for other subjects (Wine, Albums, Plants, etc.).

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
`<Vault>/.obsidian/plugins/note-maker-ai/`

## Usage

- In Obsidian, enable the plugin: Settings -> Community plugins -> Enable NoteMakerAI.
- Open a JPG/PNG image (e.g., a book cover) in your vault.
- Click the diamond-plus ribbon icon to process the active image.
- A progress modal will show steps. When done, a new note appears under the subject’s folder (e.g., `Bases/Books`).
	- Configure AI provider in Settings -> NoteMakerAI.
	- Add your API key for the selected provider (OpenAI or Gemini).

## Creating a New Subject

This project is designed to be forked and customized for different subjects (Wine, Albums, Plants, etc.).

**Two guides available:**
- **[FORKING.md](./FORKING.md)** - Complete technical guide with code examples
- **[FORKING-AI.md](./FORKING-AI.md)** - Copy-paste prompts for AI-assisted development (Cursor, Copilot, etc.)

Quick overview:
1. Fork this repository
2. Update `manifest.json` with your plugin identity
3. Replace `src/core/subject/implementation.ts` with your subject
4. Update `src/core/subject/index.ts` to export your subject
5. Build and test


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


