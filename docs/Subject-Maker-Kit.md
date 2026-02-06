

### Subject Maker Kit for Chatbots

This kit is a collection of files to help you use your selected chatbot to create a Subject Definition File for your own custom subject.

Upload the five included files (README.md, Subject-Definition.md, ASD.md, BSD.md, and WSD.md) to your chatbot and then just ask it to create a Subject Definition File for your custom subject.

Below are suggested prompts to use with your chatbot, ranging from simple requests to highly specific technical instructions.

---

### Broad Intent (Simple)
*Use this prompt when you want the chatbot to make all the design decisions for you.*

"Please make a Subject Definition File (SDF) for a new subject: Wildflowers. Design it for me. You decide what properties and sections it should have and what the prompts should be for everything including a good icon. Use the Books and Albums SDFs as examples to better understand the Subject Definition Guide and the Readme instructions."

### Physical Condition Focus
*Use this prompt for physical collections where condition and grading are important.*

"Create an SDF for **Retro Video Games**.
* **Context**: I am a collector of vintage cartridges (NES, SNES, Genesis).
* **Properties**: I need to track the `platform`, the `region` (NTSC vs PAL), and the `completeness` (Cartridge Only, Boxed, or CIB).
* **Special Request**: Please include a property for `condition_rating`. This should be a `touch_me_not` field because I will grade them myself physically.
* **Naming**: Format it as `Console - Title (Region)`.
* **AI Instruction**: Tell the AI to search MobyGames or Wikipedia to verify the correct release year if it isn't visible on the cartridge label."

### Business Cards
*Use this prompt to turn the AI into a CRM tool.*

"Design a Subject Definition File for **Business Cards**.
* **Goal**: I want to snap a photo of a card and have it create a contact note.
* **Properties**: Extract Name, Job Title, Company, Email, Website, and Phone Number.
* **Naming**: `{{company}} - {{name}}`.
* **Sections**:
    * 'Summary': A brief description of the company's industry based on the logo/design.
    * 'Follow Up': This should be a user-editable section ({{my_notes}}) where I can write where I met them.
* **Icon**: Use the `contact` or `user` icon."

### Location & Safety Focus
*Use this prompt to leverage the GPS/Metadata features.*

"Make an SDF for **Wild Berries**.
* **Key Requirement**: The prompt must explicitly ask the AI to analyze the provided GPS coordinates to help with identification based on regional flora.
* **Properties**: 
    * `common_name`
    * `scientific_name`
    * `safety_status` (Safe, Toxic, Unknown)
    * `location`: The approximate city or region derived specifically from the image GPS coordinates.
* **Safety**: Add a trailing prompt that forces the AI to add a disclaimer in bold text if it cannot positively identify the berry as safe.
* **Naming**: `{{common_name}} - {{date}}`."

### High Detail
*Use this prompt when you know exactly what metadata keys and file naming conventions you want, and you just need the chatbot to write the YAML syntax for you.*

"Please write a Subject Definition File for **Receipts**. I have very specific requirements for how this should work:
* **ID**: `expense_receipt`
* **Icon**: `receipt`
* **Naming Convention**: The note file should be named `{{date}}_{{merchant}}_{{total}}`. The photo should be named `{{merchant}}_proof_{{date}}`.
* **Properties**:
    * `merchant`: The name of the business.
    * `date`: Format as YYYY-MM-DD.
    * `total`: The final amount paid (numeric).
    * `category`: A sequence/list from these options: [Travel, Meals, Office Supplies, Software, Hardware].
    * `tax_deductible`: A boolean defaulting to `true`.
    * `reimbursed`: A boolean defaulting to `false`, set to `touch_me_not: true`.
* **Sections**:
    * First section: 'Line Items'. Instruction: Extract a markdown table of all items purchased and their individual prices.
    * Second section: 'Justification'. Instruction: {{my_notes}}.
* **Prompts**: The lead prompt should act as a strict corporate accountant. The trailing prompt should explicitly state: 'Do not guess the total. If the total is blurry, leave it blank.'"