# NoteMakerAI Smoke Test Checklist

**Version:** 0.1.20  
**Date:** _______________  
**Tester:** _______________  
**Duration:** ~10 minutes  

---

## Quick Setup

- [ ] Test vault ready with plugin installed
- [ ] API key configured (any provider)
- [ ] One book cover image available

---

## Smoke Tests (12 critical checks)

### 🔌 Plugin Basics

| # | Test | Action | ✓/✗ |
|---|------|--------|-----|
| 1 | **Plugin loads** | Enable plugin in Settings → Community Plugins | |
| 2 | **Ribbon icon visible** | Look for book icon in left ribbon | |
| 3 | **Settings accessible** | Open Settings → NoteMakerAI tab | |
| 4 | **Command available** | Cmd/Ctrl+P → search "NoteMakerAI" | |

### 📸 Core Functionality

| # | Test | Action | ✓/✗ |
|---|------|--------|-----|
| 5 | **Process image** | Open book cover image, click ribbon icon | |
| 6 | **Progress modal works** | Watch for progress updates during processing | |
| 7 | **Note created** | New .md file appears in notes folder | |
| 8 | **Photo handled** | Photo moved/copied to photos folder | |
| 9 | **Content correct** | Note has frontmatter + sections (Summary, Themes, My Notes) | |

### 🔄 Redo & Multi

| # | Test | Action | ✓/✗ |
|---|------|--------|-----|
| 10 | **Redo works** | Open created note, click ribbon → content regenerates | |
| 11 | **My Notes preserved** | Add text to "My Notes", redo → user text remains | |
| 12 | **Error handling** | Try processing without active file → error message shown | |

---

## Result

| Passed | Failed |
|--------|--------|
| /12 | /12 |

**Status:** ☐ PASS (all 12) / ☐ FAIL (any failures)

---

## Quick Notes

_Issues encountered:_




---

## If Smoke Test Fails

1. Check console (Cmd/Ctrl+Shift+I) for errors
2. Verify API key is valid
3. Check network connectivity
4. Review Settings configuration
5. Run full TEST_PLAN.md if needed
