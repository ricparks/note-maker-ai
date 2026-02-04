subject_name: "Wine"
id: "wine"
sdf_version: "1.0"
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
      touch_me_not: true
    - key: "storage_spaces"
      default: "" 
      touch_me_not: true
    - key: "is_reviewed"
      default: false

sections:
    - heading: "My Notes"
      instruction: "{{my_notes}}"
    - heading: "Vendor's Notes"
      instruction: "Description and marketing copy from the winemaker/vendor."
    - heading: "Critic's Notes"
      instruction: "Reviews or ratings from critics if found."

lead_prompt: "You are an expert sommelier and wine collector. Analyze the provided wine bottle/label image and infer structured metadata. Search online if needed to fill in details like region or price."

trailing_prompt: "If a field is unknown, use an empty string. The 'storage_space' property must always be empty. Make sure to understand what is written on the label and to fill in the JSON with what you read on the label. If you can't find all the necessary information for a property look on the web. Do an image search if you must. Try hard to get this right. If you get it wrong, the user might lose a lot of money."
