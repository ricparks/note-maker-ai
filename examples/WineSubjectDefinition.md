subject_name: "Wine"
icon: "wine"

# Enable verification to ensure we are processing wine bottles/labels
validate_subject: true
validation_threshold: 0.8

naming:
    note: "{{winery}} - {{name}} ({{year}})"
    photo: "{{winery}}_{{name}}_{{year}}"

properties:
    - key: "name"
      instruction: "Name of the wine (e.g. 'Cabernet Sauvignon Reserve')"
    - key: "winery"
      instruction: "Name of the winery or producer"
    - key: "varietal"
      instruction: "Primary grape varietal(s)"
    - key: "year"
      instruction: "Vintage year (YYYY)"
    - key: "region"
      instruction: "Region of origin (Appellation)"
    - key: "price"
      instruction: "Retail price if visible on label or found online (include currency symbol)"
    - key: "storage_space"
      instruction: "Leave this field empty string"

sections:
    - heading: "Vendor's Notes"
      instruction: "Description and marketing copy from the winemaker/vendor."
    - heading: "Critic's Notes"
      instruction: "Reviews or ratings from critics if found."

lead_prompt: "You are an expert sommelier and wine collector. Analyze the provided wine bottle/label image and infer structured metadata. Search online if needed to fill in details like region or price."

trailing_prompt: "If a field is unknown, use an empty string. The 'storage_space' property must always be empty. Do not hallucinate. Also include lightweight classification guard fields to help verify the chosen subject without extra requests: - subject_match: boolean — does this image look like a wine bottle or label? - predicted_category: one of \"wine\", \"book\", \"travel\", or \"unknown\" - confidence: number 0..1 — confidence in predicted_category - reason: short explanation (one sentence max) Return ONLY valid JSON."
