subject_name: "Album"
icon: "disc"

validate_subject: true
validation_threshold: 0.8

naming:
    note: "{{artist}} - {{album}} ({{year}})"
    photo: "{{artist}}_{{album}}_{{year}}"

properties:
    - key: "artist"
      instruction: "Artist or Band name"
    - key: "album"
      instruction: "Album title"
    - key: "year"
      instruction: "Release year (YYYY)"
    - key: "label"
      instruction: "Record Label"
    - key: "genre"
      instruction: "Musical Genre(s)"
      type: sequence
    - key: "is_digital"
      instruction: "Leave blank"
    - key: "is_reviewed"
      default: false
      touch_me_not: true

sections:
    - heading: "Track List"
      instruction: "Ordered list of tracks on the album."
    - heading: "Reviews"
      instruction: "Short summary of any reviews you can find for the album, most especially from Pitchfork and AllMusic."

lead_prompt: "You are a music historian and critic. Analyze the provided album cover image and infer structured metadata. Search for additional information online if needed, especially for the track list and reviews."

trailing_prompt: "If a field is unknown, use an empty string. The 'is_digital' and 'is_reviewed' properties must always be empty strings. Do not hallucinate. Also include lightweight classification guard fields to help verify the chosen subject without extra requests: - subject_match: boolean — does this image look like an album cover? - predicted_category: one of \"album\", \"wine\", \"book\", \"travel\", or \"unknown\" - confidence: number 0..1 — confidence in predicted_category - reason: short explanation (one sentence max) Return ONLY valid JSON."
