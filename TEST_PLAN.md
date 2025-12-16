# NoteMakerAI Test Plan

**Version:** 0.1.20  
**Last Updated:** 2025-12-11  
**Tester:** _______________  
**Platform:** Desktop / Mobile (circle one)  
**Obsidian Version:** _______________  

---

## Test Environment Setup

### Prerequisites
- [ ] Obsidian installed (version 0.15.0+)
- [ ] Test vault created or existing vault with test folder
- [ ] At least one AI provider API key configured (OpenAI, Gemini, or OpenRouter)
- [ ] Sample images prepared:
  - [ ] Book cover photo (JPG)
  - [ ] Book cover photo (PNG)
  - [ ] Book cover photo (JPEG extension)
  - [ ] Non-book image (for mismatch testing)
  - [ ] Large image (> 750x1000 pixels)
  - [ ] Small image (< 750x1000 pixels)

### Plugin Installation
- [ ] Copy `main.js`, `manifest.json`, `styles.css` to vault `.obsidian/plugins/note-maker-ai/`
- [ ] Enable plugin in Settings → Community plugins
- [ ] Plugin appears in list without errors

---

## Test Cases

### 1. Plugin Initialization

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 1.1 | Plugin loads | Enable plugin in settings | No console errors, ribbon icon appears | |
| 1.2 | Ribbon icon displays | Look at left ribbon | Book icon (book-open) visible | |
| 1.3 | Settings tab appears | Open Settings → NoteMakerAI | Settings tab loads with all sections | |
| 1.4 | Command registered | Open command palette (Cmd/Ctrl+P), search "NoteMakerAI" | "Create note from current image or selection" appears | |

---

### 2. Settings Configuration

#### 2.1 Folder Settings

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 2.1.1 | Notes folder setting | Type custom folder path | Setting saves, persists after restart | |
| 2.1.2 | Photos folder setting | Type custom folder path | Setting saves, persists after restart | |
| 2.1.3 | Folder suggest dropdown | Click in folder field, type partial path | Folder suggestions appear | |
| 2.1.4 | Prompt additions file | Enter path to .md file | Setting saves | |

#### 2.2 LLM Configuration

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 2.2.1 | Add LLM | Click "Add LLM" button | New LLM row appears with defaults | |
| 2.2.2 | Change vendor | Select different vendor (OpenAI/Gemini/OpenRouter) | Model dropdown updates with vendor-specific models | |
| 2.2.3 | Custom model | Select "Custom…" from model dropdown | Text input appears for custom model name | |
| 2.2.4 | API key entry | Enter API key | Key saved (masked display) | |
| 2.2.5 | Rename LLM label | Edit label field | Label updates, references update | |
| 2.2.6 | Delete LLM | Click × button (with multiple LLMs) | LLM removed from list | |
| 2.2.7 | Cannot delete last LLM | Try to delete when only 1 LLM exists | Delete button disabled | |
| 2.2.8 | Set default LLM | Change "LLM to use" dropdown | Selection persists after restart | |

#### 2.3 Image Settings

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 2.3.1 | Keep original toggle | Toggle "Keep original after resize" | Setting saves and persists | |

#### 2.4 Validation Settings

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 2.4.1 | Mismatch warning toggle | Toggle "Warn on subject mismatch" | Setting saves | |
| 2.4.2 | Threshold setting | Enter threshold value (0.0-1.0) | Value clamped and saved | |

---

### 3. Image Processing (Single File)

#### 3.1 Via Ribbon Icon

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 3.1.1 | Process JPG image | Open JPG image, click ribbon icon | Progress modal appears, note created | |
| 3.1.2 | Process PNG image | Open PNG image, click ribbon icon | Progress modal appears, note created | |
| 3.1.3 | Process JPEG image | Open .jpeg image, click ribbon icon | Progress modal appears, note created | |
| 3.1.4 | No active file | Close all files, click ribbon icon | Error message: "No active file" | |
| 3.1.5 | Non-image file | Open .md file, click ribbon icon | Redo flow triggers (see section 5) | |
| 3.1.6 | Unsupported file | Open .pdf or .txt, click ribbon icon | Error: "not a JPG or PNG image" | |

#### 3.2 Via Command Palette

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 3.2.1 | Process via command | Open image, Cmd/Ctrl+P → "Create note from current image" | Same as ribbon: note created | |

---

### 4. Note Creation

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 4.1 | Note file created | Process an image | .md file appears in notes folder | |
| 4.2 | Note filename | Check created filename | Format: "Author - Title.md" | |
| 4.3 | Frontmatter | Open created note | YAML frontmatter with all properties | |
| 4.4 | Cover photo embedded | Check note content | Photo embedded at bottom of note | |
| 4.5 | Sections present | Check note structure | "My Notes", "Summary", "Themes" sections | |
| 4.6 | Photo moved/copied | Check photos folder | Photo present in photos folder | |
| 4.7 | Photo renamed | Check photo filename | Format: "author_title_year.jpg" | |
| 4.8 | Duplicate handling | Process same book twice | Second note gets numeric suffix | |
| 4.9 | Folder creation | Delete notes folder, process image | Folder auto-created | |

---

### 5. Redo Functionality

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 5.1 | Redo existing note | Open created book note, click ribbon | AI regenerates content | |
| 5.2 | My Notes preserved | Add text to "My Notes", redo | User text preserved after redo | |
| 5.3 | Prompt Additions | Add "#### Prompt Additions" section with text, redo | Content influences AI output | |
| 5.4 | PA alias | Add "#### PA" section with text, redo | Same as Prompt Additions | |
| 5.5 | Title update | Redo changes title | Note filename updated | |
| 5.6 | Photo not found | Delete photo, try redo | Error: "could not locate linked photo" | |

---

### 6. Multi-Select Processing

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 6.1 | Select multiple images | Cmd/Ctrl+click multiple images in explorer, click ribbon | Confirmation dialog appears | |
| 6.2 | Confirm multi-process | Click "Continue" on confirmation | All images processed sequentially | |
| 6.3 | Cancel multi-process | Click "Cancel" on confirmation | No processing occurs | |
| 6.4 | Mix of images and notes | Select images and .md files | Both types processed appropriately | |

---

### 7. Image Resizing

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 7.1 | Large image resized | Process image > 750x1000 | Image resized to fit limits | |
| 7.2 | Small image unchanged | Process image < 750x1000 | Image moved but not resized | |
| 7.3 | Keep original ON | Enable setting, process large image | Original file kept, resized copy created | |
| 7.4 | Keep original OFF | Disable setting, process large image | Original file deleted | |
| 7.5 | JPEG quality | Check resized image quality | Acceptable quality (0.9 encoding) | |

---

### 8. AI Provider Testing

#### 8.1 OpenAI

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 8.1.1 | Valid API key | Configure valid OpenAI key | Processing succeeds | |
| 8.1.2 | Invalid API key | Configure invalid key | Clear error message | |
| 8.1.3 | Model selection | Try different OpenAI models | All work correctly | |

#### 8.2 Google Gemini

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 8.2.1 | Valid API key | Configure valid Gemini key | Processing succeeds | |
| 8.2.2 | Invalid API key | Configure invalid key | Clear error message | |
| 8.2.3 | Model selection | Try different Gemini models | All work correctly | |

#### 8.3 OpenRouter

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 8.3.1 | Valid API key | Configure valid OpenRouter key | Processing succeeds | |
| 8.3.2 | Model selection | Try Claude/Grok/Llama models | All work correctly | |

---

### 9. Validation & Guardrails

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 9.1 | Subject mismatch warning | Process non-book image (e.g., wine bottle) | Warning dialog appears if confidence > threshold | |
| 9.2 | Continue on mismatch | Click "Continue" on warning | Processing continues | |
| 9.3 | Cancel on mismatch | Click "Cancel" on warning | Processing stops | |
| 9.4 | Don't show again | Check "Don't show again", continue | Future warnings suppressed | |
| 9.5 | Invalid ISBN warning | Process book with unreadable ISBN | Warning in progress log | |

---

### 10. Error Handling

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 10.1 | Network error | Disable network, try processing | Graceful error message | |
| 10.2 | API rate limit | Trigger rate limit (if possible) | Appropriate error message | |
| 10.3 | Corrupted image | Process corrupted image file | Error handling, no crash | |
| 10.4 | Read-only vault | Try processing in read-only location | Error handling | |

---

### 11. Progress Modal

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 11.1 | Modal appears | Start processing | Progress modal opens immediately | |
| 11.2 | Steps logged | Watch during processing | Each step shown with timestamp | |
| 11.3 | LLM info shown | Check progress log | Shows which LLM/model being used | |
| 11.4 | Success state | Complete processing | "Completed" message, OK button | |
| 11.5 | Error state | Trigger an error | "Finished with errors", red text | |
| 11.6 | Modal dismissal | Click "OK" button | Modal closes | |

---

### 12. Mobile Testing (if isDesktopOnly: false)

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 12.1 | Plugin loads on mobile | Enable plugin on iOS/Android | No errors | |
| 12.2 | Image processing | Process image from camera roll | Note created successfully | |
| 12.3 | Canvas operations | Check resized images | Proper JPEG output | |
| 12.4 | UI elements | Check settings, modals | All render correctly | |

---

### 13. Edge Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 13.1 | Special characters in title | Process book with quotes, colons in title | Filename sanitized correctly | |
| 13.2 | Very long title | Process book with very long title | Filename truncated appropriately | |
| 13.3 | Non-Latin characters | Process book with Japanese/Hebrew/etc. title | Characters handled correctly | |
| 13.4 | Multiple authors | Process anthology with multiple authors | Authors formatted with semicolons | |
| 13.5 | Empty response | AI returns minimal data | Graceful handling with defaults | |
| 13.6 | Nested folder path | Set deeply nested folder path | All folders created | |

---

### 14. Performance

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| 14.1 | Large batch | Process 10+ images sequentially | All complete without memory issues | |
| 14.2 | Very large image | Process 4000x4000+ image | Resizing completes in reasonable time | |
| 14.3 | Plugin startup | Measure time from enable to ready | Fast startup (< 500ms) | |

---

## Test Results Summary

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| Initialization | 4 | | | |
| Settings | 14 | | | |
| Single File Processing | 6 | | | |
| Note Creation | 9 | | | |
| Redo | 6 | | | |
| Multi-Select | 4 | | | |
| Image Resizing | 5 | | | |
| AI Providers | 7 | | | |
| Validation | 5 | | | |
| Error Handling | 4 | | | |
| Progress Modal | 6 | | | |
| Mobile | 4 | | | |
| Edge Cases | 6 | | | |
| Performance | 3 | | | |
| **TOTAL** | **83** | | | |

---

## Issues Found

| ID | Severity | Description | Steps to Reproduce | Status |
|----|----------|-------------|-------------------|--------|
| | | | | |
| | | | | |
| | | | | |

**Severity Levels:** Critical / Major / Minor / Cosmetic

---

## Sign-Off

**Tested By:** _______________  
**Date:** _______________  
**Approved for Release:** Yes / No  
**Notes:** 

---

## Appendix: Test Images

Recommended test images to prepare:

1. **book_cover_standard.jpg** - Standard book cover, clear text
2. **book_cover_large.png** - High resolution (3000x4000+)
3. **book_cover_small.jpeg** - Small resolution (300x400)
4. **book_anthology.jpg** - Multiple authors
5. **book_foreign.jpg** - Non-English title
6. **wine_bottle.jpg** - For mismatch testing
7. **corrupted.jpg** - Intentionally corrupted file
8. **special_chars.jpg** - Book with "Quotes: A Story" title
