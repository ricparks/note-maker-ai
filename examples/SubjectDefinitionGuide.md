# Subject Definition Guide

**Subject Definitions** are the core of NoteMaker AI's extensibility. They allow you to define exactly how the AI should interpret an image and what kind of note it should create. 
You can create unlimited custom subjects (e.g., *Wine*, *Plants*, *Receipts*, *Inventory*) by adding simple Markdown files to your vault.

---

## Quick Start

1.  Create a folder in your vault (e.g., `NoteMaker Templates`).
2.  Create a new Markdown file inside it named `RecipeSubject.md`.
3.  Paste the following content into it:

    ```yaml
    subject_name: "Recipe"
    icon: "chef-hat"
    
    naming:
      note: "{{title}}"
      photo: "{{title}}_photo"
    
    properties:
      - key: "title"
        instruction: "Name of the dish"
      - key: "ingredients"
        instruction: "List of ingredients with quantities"
        type: list
      - key: "prep_time"
        instruction: "Preparation time in minutes"
    
    sections:
      - heading: "Instructions"
        instruction: "Step-by-step cooking instructions."
      - heading: "Chef's Notes"
        instruction: "Culinary tips or flavor profile description."
      - heading: "My Variations"
        instruction: "{{my_notes}}"
    
    lead_prompt: "You are an expert chef. Analyze the food in this image..."
    trailing_prompt: "Format the output as valid JSON."
    ```

4.  Go to **Settings > NoteMaker AI** and set the **Subject Definition File** path to `NoteMaker Templates/RecipeSubject.md` and set folders for the locations of the generated notes and images.
5.  Click the chef hat ribbon icon or use the command **NoteMaker AI: Create Recipe note from image**.

---

## Configuration Guide

A Subject Definition File is a standard Markdown file. NoteMaker AI reads the **YAML Frontmatter** (the block between `---` lines or inside a `yaml` code block) to configure the subject.

> [!TIP]
> You can place the configuration inside a ` ```yaml ` code block if you prefer to view it as code in Obsidian.

### 1. Basic Metadata

| Field | Description |
| :--- | :--- |
| `subject_name` | **Required.** The display name used in commands (e.g., "Create **Recipe** note"). |
| `icon` | **Required.** The name of any [Lucide icon](https://lucide.dev/icons) (e.g., `book`, `camera`, `zap`). |
| `id` | **Recommended.** A unique, stable identifier (e.g., `recipe_v1`). See [Advanced Features](#custom-ids--renaming) below. |

### 2. Naming & File Paths

Control how your notes and images are named using the `naming` block. You can use placeholders for any property you defined.

```yaml
naming:
  note: "{{author}} - {{title}}"
  photo: "{{title}}_{{year}}"
```

*   **`naming.note`**: The filename of the generated Markdown file.
*   **`naming.photo`**: The filename (not including extension) for the saved image.

### 3. Properties (Frontmatter)

The `properties` list defines what data the AI should extract for the note's frontmatter.

```yaml
properties:
  - key: "author"
    instruction: "Who wrote this book?"
  
  - key: "tags"
    default: ["book", "reading"] # Auto-inserted, AI is not asked for this
    
  - key: "ingredients"
    instruction: "List of ingredients shown"
    type: list # Forces the output to be a list of strings
    
  - key: "rating"
    instruction: "Star rating visible in the image, or estimate based on condition."
    touch_me_not: true # See Advanced Features
```

*   **`key`**: The name of the property in the output note.
*   **`instruction`**: Tell the AI what to look for. If omitted, you **must** provide a `default`.
*   **`default`**: A value to use if the AI fails or if you don't want the AI to extract it (e.g., static tags).
*   **`type`**: Set to `list`, `sequence`, or `array` to force the AI to return a list of strings.
*   **`touch_me_not`**: Set to `true` to protect this property from being overwritten when you Redo the note (useful for manual user ratings or flags).

### 4. Sections (Content Body)

The `sections` list defines the headings and text content of the note body.

```yaml
sections:
  - heading: "Summary"
    instruction: "A 2-sentence summary of the content."
    
  - heading: "Analysis"
    instruction: "Detailed analysis of the visual elements."

  - heading: "My Findings"
    instruction: "{{my_notes}}"
```

NoteMaker will generate a Markdown note looking like this:

```markdown
#### Summary
The image shows...

#### Analysis
The composition utilizes...

#### My Findings

```


### 5. Prompts

*   **`lead_prompt`**: Sets the role and context.
    *   *Example:* "You are an expert botanist. Identify this plant..."
*   **`trailing_prompt`**: Sets final formatting rules.
    *   *Example:* "If a field is unknown, use an empty string. If you do not have reasonable confidence about idenfying the plant, call it 'Unidentified' and leave all property values blank."
---

## Placeholders

You can use these placeholders in `naming` patterns, `default` property values, and section `instruction` fields.

| Placeholder | Context | Description |
| :--- | :--- | :--- |
| `{{original_image}}` | Default | Resolves to a wiki-link of the original image (e.g., `[[IMG_1234.jpg]]`). |
| `{{sdf_version}}` | Default | Resolves to the version string defined in your file. |
| `{{my_notes}}` | **Section Instruction** | designate the section as **User Notes**. Content in this section is preserved during Redo and excluded from AI generation. |

---

## User Notes & Redo Preservation

By default, "Redo" overwrites the entire note content based on the AI's new output. To allow users to keep their own notes within a Subject note, use the `{{my_notes}}` placeholder.

```yaml
sections:
  - heading: "My Findings"
    instruction: "{{my_notes}}"
```

*   **Preserved**: Whatever the user writes in "My Findings" remains after a Redo.
*   **Safe**: The AI will not attempt to generate text for this section.

### Property Preservation

You can also preserve specific Frontmatter properties (like manual ratings or tags) by adding `touch_me_not: true` to the property definition. See the [Properties](#2-properties-frontmatter) section for details.

---

## Advanced Features

### Custom IDs & Renaming
By default, NoteMaker uses the `subject_name` as an internal ID. If you rename the subject (e.g., "Recipe" -> "Food"), NoteMaker might treat it as a new subject, breaking the "Redo" history for old notes.

**Best Practice:** Explicitly set an `id`.

```yaml
subject_name: "Food"
id: "recipe" # Keeps the internal link to old 'Recipe' notes
```

### Protection (touch_me_not)
If you manually edit a property after generating a note, you don't want a "Redo" command to overwrite your work. Add `touch_me_not: true` to protect specific fields.

```yaml
properties:
  - key: "user_rating"
    instruction: "Predict the rating"
    touch_me_not: true # If I change this manually, Redo won't revert it.
```

### Automatic Validation
Prevent NoteMaker from generating a note if the image doesn't match the subject.

```yaml
validate_subject: true
validation_threshold: 0.8
```

You **must** add details to your `trailing_prompt` ONLY if you want to customize the validation logic. NoteMaker automatically appends the request for `subject_match` and `confidence` when this feature is enabled.

### Versioning
You can version your definition file to track changes in your notes.

1.  Add `sdf_version` to the top level of your YAML.
2.  Add a property to store it using the `{{sdf_version}}` placeholder.

```yaml
subject_name: "Recipe"
sdf_version: "1.2"  <-- Define version here

properties:
  - key: "template_version"
    default: "{{sdf_version}}" # <--- Store it in the note
```
