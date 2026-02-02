### Copilot instructions — EC-main (concise)

This file tells AI coding agents how this repo is organized and how to make safe, testable edits.

Core idea
- Browser-first, static site (no bundler): processing runs client-side in the browser using plain HTML + vanilla JS.
- Two main feature areas: delivery-note extraction (`app.js`) and Confirmation-of-Receipt (CR) detection/signature analysis (`CR.js`).

Key files to read first
- [app.js](app.js): delivery-note extraction, candidate heuristics, 7→8 autoconversion (`validateDeliveryNotes`).
- [CR.js](CR.js): OCR normalization, CR anchor heuristics, canvas-based stamp/signature analysis.
- [rename-upload.js](rename-upload.js): upload/rename UI and `window.RenameUpload` API.
- [scripts/heuristic-check.js](scripts/heuristic-check.js): canonical place to add/verify heuristic unit cases.
- [scripts/ui-smoke-test.js](scripts/ui-smoke-test.js): example Playwright smoke test and local serve routine.

Project-specific rules and patterns
- CONFIG objects: thresholds/heuristics live in module-level `CONFIG` constants. Treat changes to these as behavior changes — update tests.
- Normalization helpers: reuse `normalizeToken` / `normalizeOCRText` rather than adding ad-hoc regexes.
- DOM contract: many UI flows depend on stable element ids (e.g., `runBtn`, `resultsConsole`, `processAllBtn`) and global window exports (`window.processFile`, `window.RenameUpload`). Do not rename without updating callers and tests.
- Image analysis: `CR.js` includes ROI/canvas pixel heuristics for signatures/stamps — these are fragile to refactor and should be validated with the smoke test.

Testing & run commands (quick)
- Heuristic tests: run `node scripts/heuristic-check.js` (add new patterns here when you change heuristics).
- Local server for manual UI testing: `python3 -m http.server 8080` then open `http://localhost:8080/CR.html` or `index.html`.
- Smoke test (Playwright): install Playwright and run `node scripts/ui-smoke-test.js` or `npx playwright test scripts/ui-smoke-test.js`.

Runtime dependencies
- Browser libraries are loaded at runtime (CDNs): `pdfjsLib`, `XLSX` (SheetJS), `JSZip`, `saveAs`, optional `Tesseract` / `PDFLib`.
- Smoke tests expect `node`, `python3`, and (for Playwright) Playwright installed.

Editing guidance for AI agents
- Make small, focused edits. Heuristics are sensitive; add test cases to `scripts/heuristic-check.js` for any change in detection rules or `CONFIG` values.
- When changing OCR/normalization, update both `CR.js` and `scripts/heuristic-check.js` (they share logic patterns and test harnesses).
- Avoid renaming DOM ids or removing `window.*` exports; these break tests and the smoke test.
- For visual/signature logic, run the UI smoke test and manual serve flow — do not rely solely on unit heuristics.

If you want a deeper walkthrough (OCR internals, signature stroke heuristics, or the 7→8 digit algorithm), say which area and I will expand with file-level examples and test cases.
