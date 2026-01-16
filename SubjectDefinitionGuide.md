# Creating Custom Subjects in NoteMaker AI

You can define unlimited custom subjects (e.g., *Wine*, *Plants*, *Receipts*) by creating a **Subject Definition File**. This is a simple Markdown file that tells the AI how to interpret your image and what kind of note to create.

To use your custom subject, go to **Settings > NoteMaker AI** and set the **Subject Definition File** path to your file (e.g., `MySubjects/WineDefinition.md`).

---

## File Structure

The file uses a YAML block (like frontmatter) to define the configuration.

```yaml
subject_name: "Album"
id: "custom_album_v1" # Optional: Stable ID regardless of name changes
icon: "disc"

# Enable photo verification (optional)
validate_subject: true
validation_threshold: 0.8

naming:
    note: "{{artist}} - {{album}} ({{year}})"
    photo: "{{artist}}_{{album}}_{{year}}"

properties:
    - key: "album"
      instruction: "Album title"
    - key: "artist"
      instruction: "Artist or Band name"
    - key: "year"
      instruction: "Release year"
    - key: "genre"
      instruction: "Musical Genre(s)"
      type: sequence # <--- This enforces a list format in the output
    - key: "is_reviewed"
      default: false
    # If 'default' is present and 'instruction' is omitted, the AI will NOT be asked to extract this field.
    # The value will be automatically inserted into the note properties.

sections:
    - heading: "Track List"
      instruction: "Ordered list of tracks on the album."

lead_prompt: "You are a music historian. Analyze the album cover..."
trailing_prompt: "Return valid JSON..."
```

---

## Stable IDs & Renaming Subjects
 
If you decide to rename a subject (e.g., changing `subject_name` from "Wine" to "Vino"), NoteMaker AI might get confused when "Redoing" old notes, because it checks the `note_created_by` field in the frontmatter.
 
To fix this, you can assign a stable `id`.
 
1.  **Original Config:**
    ```yaml
    subject_name: "Wine"
    # implicit id: "wine"
    ```
 
2.  **New Config (Renamed):**
    ```yaml
    subject_name: "Vino"
    id: "wine" # <--- Keeps the internal ID matching the old notes!
    ```
 
By explicitly setting `id: "wine"`, the system knows that "Vino" is just a new label for the same subject, allowing you to use Redo on your old "Wine" notes without safety warnings.
 
---
 
## Field Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `subject_name` | String | **Required.** The display name for the subject (e.g., "Wine"). |
| `id` | String | **Optional.** A stable unique identifier. If omitted, generated from `subject_name`. Use this to safely rename subjects later. |
| `icon` | String | **Required.** The name of an Obsidian UI icon (e.g., "wine", "book", "camera"). |
| `validate_subject` | Boolean | **Optional.** If `true`, the AI will verify if the image matches the subject before creating a note. |
| `validation_threshold`| Number | **Optional.** Confidence level (0.0 - 1.0) required to trigger a warning. Default is 0.7. |
| `naming` | Object | **Required.** Defines how files are named. |
| `naming.note` | String | Template for the markdown note filename. |
| `naming.photo` | String | Template for the photo filename (saved in the photos folder). |
| `properties` | Array | **Required.** List of Frontmatter properties to extract. |
| `properties[].key` | String | **Required.** The key name of the property. |
| `properties[].instruction` | String | **Optional.** Instruction for the AI. If omitted, `default` must be set. |
| `properties[].type` | String | **Optional.** Set to `sequence` (or `list`, `array`) to enforce a list format. |
| `properties[].default` | Any | **Optional.** Default value to use if AI extraction fails or if instruction is omitted. |
| `properties[].touch_me_not` | Boolean | **Optional.** If `true`, this property will NOT be overwritten during a Redo operation, preserving any manual edits. |
| `sections` | Array | **Required.** List of Markdown sections to generate content for. |
| `lead_prompt` | String | **Required.** The opening instruction to the AI (role and goal). |
| `trailing_prompt` | String | **Required.** The closing instruction, usually enforcing JSON format. |

## Naming Templates

In `naming.note` and `naming.photo`, you can use placeholders `{{key}}` which match the keys you defined in the `properties` list.

**Example:**
If you have a property `key: "author"`, you can use `{{author}}` in your filename template.

## Validation & Guardrails

If you enable `validate_subject: true`, you must include instructions in your specialized prompts to ask the AI to perform this check.

**Add this to your `trailing_prompt`:**
> "Also include lightweight classification guard fields:
> - `subject_match`: boolean — does this image look like a [Subject]?
> - `predicted_category`: string — what category is this?
> - `confidence`: number 0..1
> - `reason`: short explanation"

If the AI returns `subject_match: false` and the `confidence` is higher than your `validation_threshold`, NoteMaker AI will warn you.

## Redo Instructions

When you use the **Redo** command on an existing note, you can guide the AI to make specific changes by adding a special section called `#### Redo Instructions` (or alias `#### RI`).

**Example:**
```markdown
#### Redo Instructions
The previous summary was too long. Please make it more concise and focus on the track production details.
```

When NoteMaker AI regenerates the note, it will include these instructions in the prompt. This section is temporary and only used for the generation process; you can delete or update it as needed.
