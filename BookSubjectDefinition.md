```
subject_name: "Books" 
icon: "book-open" 

naming:
    note: "{{author}} - {{title}}"
    photo: "{{author}}_{{title}}_{{publicationDate}}"

validate_subject: true
validation_threshold: 0.8

properties: 
    - key: "title" 
      instruction: "Canonical book title" 
    - key: "author"
      instruction: "Primary author name formatted as 'Last Name, First Name' (e.g., 'Herbert, Frank'). If multiple authors, format each as 'Last, First' and separate with '; '."
    - key: "subtitle" 
      instruction: "Subtitle if it exists" 
    - key: "series"
      instruction: "Series name (omit volume numbering here)"
    - key: "volume"
      instruction: "Volume number (numeric if present, else 0)"
    - key: "publisher"
      instruction: "Publisher imprint"
    - key: "publicationDate"
      instruction: "Year of publication (string; empty if unknown)"
    - key: "isbn"
      instruction: "ISBN-10 or ISBN-13; prefer ISBN-13 if both are present. Return digits only (remove hyphens and spaces). If unknown, return empty string."
    - key: "genres"
      instruction: "Comma-separated list of 1-5 genres"
      
sections: 
    - heading: "Summary" 
      instruction: "2-4 sentence neutral summary (avoid spoilers)." 
    - heading: "Themes" 
      instruction: "Short comma-separated list of 1-6 thematic concepts" 
      
lead_prompt: "You are a meticulous literary assistant. Analyze the provided book cover image and infer structured metadata. Search for additional information online if needed. Make an extra effort to find the publication date and ISBN. If the book is a short story collection, anthology, or magazine, list some representative authors in the summary property. Include fiction or non-fiction classification in the genres field if possible. Extract the following fields if possible:"

trailing_prompt: "If a field is unknown, use an empty string for text fields and 0 for numeric fields (only volume uses numeric). Do not hallucinate beyond visually / famously verifiable information. Also include lightweight classification guard fields to help verify the chosen subject without extra requests: - subject_match: boolean — does this image look like a book cover? - predicted_category: one of \"wine\", \"book\", \"travel\", or \"unknown\" - confidence: number 0..1 — confidence in predicted_category - reason: short explanation (one sentence max) Return ONLY valid JSON with these keys. Example: { \"title\": \"Dune\", \"author\": \"Herbert, Frank\", \"subtitle\": \"\", \"series\": \"Dune\", \"volume\": 1, \"publisher\": \"Chilton\", \"publicationDate\": \"1965\", \"isbn\": \"9780441172719\", \"genres\": \"Science Fiction\", \"themes\": \"politics, ecology\", \"summary\": \"...\", \"subject_match\": true, \"predicted_category\": \"book\", \"confidence\": 0.95, \"reason\": \"Typography, author name, and publisher imprint present.\" }"
```


