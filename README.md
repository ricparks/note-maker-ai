# NoteMakerAI for Obsidian

**Turn any photo into a structured Obsidian note using AI.**

NoteMakerAI processes images, for example, book covers, wine labels, album art, or plants and uses your chosen AI provider to generate rich, structured notes in your vault. NoteMakerAI is an ideal way to create bases to manage your collections. It allows you to define your own subject with a simple YAML syntax and convert photos of your collection into notes with standard frontmatter properties based on your definition. It supports group selection for batch processing and allows you to redo individual notes with specific instructions for that single note. You must BYOK (Bring Your Own Key) for your own AI provider. 

## Features

*   **AI-Powered Analysis**: Sends the image to your AI provider to identify titles, authors, descriptions, vintages, and more depending on the subject.
*   **Flexible Subjects**: Comes with built-in support for Books, Albums, and Wine but is designed to be easily extensible for any collection (Coins, Plants, etc.).
*   **Supports Major AI Providers**: Including OpenAI, Google Gemini, Anthropic, and OpenRouter.
*   **Seamless Integration**: Works entirely within Obsidian. Snap a photo, drop it in your vault, and click the button.
*   **Smart Image Handling**: Automatically resizes and optimizes images to minimize the footprint in your vault and LLM tokens used.
*   **Iterative Refinement**: Not happy with the result? Use the "Redo" command to provide specific instructions (e.g., "Use the narrative voice of Hunter S. Thompson.") and regenerate the note.

## Installation

### Beta Installation (via BRAT)
Since this plugin is currently in Beta, the easiest way to install it is using the **BRAT** plugin.

**Note:** During this initial Beta phase, installation requires a GitHub token. Please email `ric@notemakerai.com` to request one.

1.  Install **BRAT** from the Obsidian Community Plugins list.
2.  Open the BRAT settings and enter your token in the "GitHub User Name" / token field if required, or simply ensure you have access.
3.  Click **Add Beta plugin**.
4.  Paste the URL of this repository: `https://github.com/ricparks/note-maker-ai` (or your fork's URL).
5.  Click **Add Plugin**.
6.  Enable **NoteMakerAI** in your Community Plugins list.

### Manual Installation
For users who want to test the latest unreleased changes:
1.  Download the latest release from GitHub.
2.  Extract the files (`main.js`, `manifest.json`, `styles.css`) to `<VaultFolder>/.obsidian/plugins/note-maker-ai/`.
3.  Reload Obsidian.

## Quick Start Information

1.  **Configure AI**: Go to **Settings** > **NoteMakerAI** and enter your API key for your preferred provider (e.g., OpenAI or Gemini) and specify the model to use. Note that you can enter multiple AI vendors and their keys. You might want to use different models for different subjects.
2.  **There are three example subjects in the examples directory**: `Books`, `Albums`, and `Wine`. You can use these as templates for your own subjects or use them as is. Copy the subject definition file for your desired subject to your vault. 
3. **Configure your subject in the plugin settings**: You'll need to specify the location of the subject definition file in your vault as well as the target directory for the newly created notes and reduced images.
4.  **Capture**: Drag and drop an image (JPG/PNG) into your Obsidian vault.
5.  **Process**: Open the image note and click the **NoteMaker** ribbon icon for your subject on the left sidebar. You can also select multiple images from the files view for batch processing. 
6.  **Result**: Watch the progress modal as the AI analyzes the image. A new note will be created in the designated folder (e.g., `Bases/Books`) with all extracted metadata.

## Customization: Subject Definition Files (SDFs)

NoteMakerAI is built on the concept of **Subject Definition Files (SDFs)**. These are Markdown files that contain YAML to tell the AI what to look for and how to format the result.

You can find examples in the `examples/` directory of this repository or create your own. An SDF allows you to:
*   Define specific prompts for the AI.
*   Define the frontmatter properties of the generated note.
*   Set the naming convention for new files.

See `examples/SubjectDefinitionGuide.md` for a complete reference of the SDF format.


## License

This project is licensed under the [AGPLv3 License](LICENSE).
