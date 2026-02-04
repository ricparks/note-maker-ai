```
subject_name: "Books" 
icon: "book-open" 

naming:
    note: "{{author}} - {{title}}"
    photo: "{{author}}_{{title}}_{{publicationDate}}"
    
validate_subject: true
validation_threshold: 0.7

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
    - key: "language"
      instruction: "The language the book was originally written in."
    - key: "publisher"
      instruction: "Publisher imprint"
    - key: "publicationDate"
      instruction: "Year of publication (string; empty if unknown)"
    - key: "isbn"
      instruction: "ISBN-10 or ISBN-13; prefer ISBN-13 if both are present. Return digits only (remove hyphens and spaces). If unknown, return empty string."
    - key: "genres"
      instruction: "Comma-separated list of 1-5 genres"
    - key: "is_reviewed"
      default: false
    - key: "is_digital"
      default: false
      touch_me_not: true
      
sections: 
    - heading: "Summary" 
      instruction: "2-4 sentence neutral summary (avoid spoilers)." 
    - heading: "Themes" 
      instruction: "Short comma-separated list of 1-6 thematic concepts" 
      
lead_prompt: "You are a meticulous literary assistant. Analyze the provided book cover image and infer structured metadata. Search for additional information online if needed. Make an extra effort to find the publication date and ISBN. If the book is a short story collection, anthology, or magazine, list some representative authors in the summary property. Include fiction or non-fiction classification in the genres field if possible."

trailing_prompt: "If a field is unknown, use an empty string for text fields and 0 for numeric fields (only volume uses numeric). Do not hallucinate beyond visually / famously verifiable information."
```


