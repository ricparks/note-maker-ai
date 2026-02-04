# NoteMakerAI for Obsidian

**Turn any photo into a structured Obsidian note using AI.**

**Turn any photo into a structured Obsidian note using AI.**

NoteMakerAI helps you manage collections—like Books, Wine, or Albums—by converting photos into rich, structured notes. Define your own "Subjects" using simple YAML files (see the [Subject Definition Guide](docs/Subject-Definition.md)), and let the AI extract metadata, write summaries, and organize your vault.

Features include batch processing, iterative "Redo" with custom instructions, and smart image optimization. **Note**: You must provide your own API key (BYOK) for providers like OpenAI or Gemini. 

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

**Note:** This plugin is currently in open beta.

1.  Install **BRAT** from the Obsidian Community Plugins list.
2.  Open the BRAT settings.
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
2.  **Choose a Subject**: We provide three starter subjects in the `examples/` directory: [Books](examples/BSD.md), [Albums](examples/ASD.md), and [Wine](examples/WSD.md). Copy the Subject Definition File (SDF) for your desired subject into your vault to use it as-is, or use it as a template to define your own custom collection. 
3. **Configure Settings**: You'll need to specify the location of the subject definition file in your vault as well as the target directory for the newly created notes and reduced images.
4.  **Capture**: Drag and drop an image (JPG/PNG) into your Obsidian vault.
5.  **Process**: Open the image note and click the **NoteMakerAI** ribbon icon for your subject on the left sidebar. You can also select multiple images from the files view for batch processing. 
6.  **Result**: Watch the progress modal as the AI analyzes the image. A new note will be created in the designated folder (e.g., `Bases/Books`) with all extracted metadata.


## The Redo Feature

The **Redo** feature allows you to refine or regenerate a note without losing your personal additions. This is useful when the AI output isn't quite right, or if you want to change the style of the content.

### How it works
1.  **Open an existing note** created by NoteMakerAI.
2.  (Optional) Add a `#### Redo Instructions` heading (or `#### RI`) and type instructions for the AI (e.g., "Write the summary in the style of Hunter S. Thompson").
3.  **Click the Ribbon Icon** for the subject (e.g., the Book icon) or run the "Create Note" command again while the note is active.
4.  **Confirm**: The plugin will detect the existing note and ask if you want to **Redo** it.

### What gets preserved?
*   **My Notes**: Sections defined as {{my_notes}}  are never touched. This is where you should write your personal reviews or thoughts.
*   **Protected Properties**: Properties marked as `touch_me_not: true` in the Subject Definition File will not be overwritten if they already exist.
*   **Framework Sections**: The `Redo Instructions` and `Additional Media` sections are preserved.
*   **Unknown Sections**: Any sections not defined in the Subject Definition File (other than My Notes/RI/Media) will be replaced by the AI generation.

## Additional Media

You can use the **Redo** command to automatically process additional images related to your subject (e.g., back covers, inner sleeves, details).

1.  Add a section `#### Additional Media` (or just `#### Media`) **to the bottom of your note**.
2.  Drag and drop your raw images into this section.
3.  Run the **Redo** command.

The plugin will:
*   **Optimize** the images (resize/compress) according to your settings.
*   **Rename** them to match the subject's naming convention (e.g., `BookTitle_2.jpg`).
*   **Move** them to the subject's designated photo folder.
*   **Update the links** in your note to point to the new, clean files.




### Subject Definition Files

NoteMakerAI is built on the concept of **Subject Definition Files (SDFs)**. These are Markdown files that contain YAML to tell the AI what to look for and how to format the result.

For a comprehensive guide, see the [Subject Definition Guide](docs/Subject-Definition.md).


## License

This project is licensed under the [AGPLv3 License](LICENSE).
