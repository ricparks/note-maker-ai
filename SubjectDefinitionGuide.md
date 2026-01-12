# Creating Custom Subjects in NoteMaker AI

You can define unlimited custom subjects (e.g., *Wine*, *Plants*, *Receipts*) by creating a **Subject Definition File**. This is a simple Markdown file that tells the AI how to interpret your image and what kind of note to create.

To use your custom subject, go to **Settings > NoteMaker AI** and set the **Subject Definition File** path to your file (e.g., `MySubjects/WineDefinition.md`).

---

## File Structure

The file uses a YAML block (like frontmatter) to define the configuration.

```yaml
subject_name: "Wines"
icon: "wine"

# Enable photo verification (optional)
validate_subject: true
validation_threshold: 0.8

naming:
    note: "{{producer}} - {{name}} ({{year}})"
    photo: "{{producer}}_{{name}}_{{year}}"

properties:
    - key: "name"
      instruction: "Name of the wine"
    - key: "producer"
      instruction: "Winery or producer name"
    - key: "year"
      instruction: "Vintage year"
    - key: "is_reviewed"
      default: false
      # If 'default' is present and 'instruction' is omitted, the AI will NOT be asked to extract this field.
      # The value will be automatically inserted into the note properties.

sections:
    - heading: "Tasting Notes"
      instruction: "Describe flavor profile, body, and acidity."

lead_prompt: "You are a sommelier. Analyze the wine label..."
trailing_prompt: "Return valid JSON..."
```

---

## Field Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `subject_name` | String | **Required.** The display name for the subject (e.g., "Wine"). |
| `icon` | String | **Required.** The name of an Obsidian UI icon (e.g., "wine", "book", "camera"). |
| `validate_subject` | Boolean | **Optional.** If `true`, the AI will verify if the image matches the subject before creating a note. |
| `validation_threshold`| Number | **Optional.** Confidence level (0.0 - 1.0) required to trigger a warning. Default is 0.7. |
| `naming` | Object | **Required.** Defines how files are named. |
| `naming.note` | String | Template for the markdown note filename. |
| `naming.photo` | String | Template for the photo filename (saved in the photos folder). |
| `properties` | Array | **Required.** List of Frontmatter properties to extract. |
| `properties[].key` | String | **Required.** The key name of the property. |
| `properties[].instruction` | String | **Optional.** Instruction for the AI. If omitted, `default` must be set. |
| `properties[].default` | Any | **Optional.** Default value to use if AI extraction fails or if instruction is omitted. |
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
