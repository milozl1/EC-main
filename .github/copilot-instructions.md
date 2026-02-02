## Repo overview

This repository is a set of browser-first tools for extracting delivery/confirmation numbers from PDFs and for renaming/uploading files. The codebase is static HTML + vanilla JS (no bundler). Key entry points:

- `CR.html` + `CR.js`: complex CR (Confirmation of Receipt) detection, OCR normalization and stamp/signature analysis.
- `app.js` (Delivery Note Extractor): PDF text extraction, candidate-number heuristics, 7→8 digit auto-correction, Excel/ZIP export.
- `rename-upload.js`: file upload & renaming UI with a programmatic API (`window.RenameUpload`).
- `scripts/heuristic-check.js`: Node test harness for CR detection heuristics.
- `scripts/ui-smoke-test.js`: Playwright-based UI smoke test; spins up a simple static server.

Read these files to understand the core logic and patterns — important constants and heuristics live in `CONFIG` objects.

## Big picture & data flow

- All processing is client-side in the browser: PDF text is read with `pdfjsLib`, optionally passed through OCR (`Tesseract`) when needed, then scanned for numeric patterns.
- CR detection prioritizes anchor-based search (phrases like "Gelangensbestätigung" / "Confirmation of receipt") and then falls back to global searches.
- Delivery note extractor extracts 7–10 digit candidates, classifies 8-digit as accepted, excludes 9–10, and attempts a 7→8 autoload using a dominant first-digit heuristic (see `validateDeliveryNotes` in `app.js`).
- Image analysis for signatures/stamps is in `CR.js` (ROI-based analysis, stroke-edge heuristics) — treat this as sensitive to changes.

## Project-specific conventions

- Global `CONFIG` objects: Many heuristics and thresholds live in `CONFIG` constants at the top of files. Edit these only after running tests.
- Normalization utilities: `normalizeToken`, `normalizeOCRText` are reused patterns — prefer reusing the existing helpers rather than adding ad-hoc regexes.
- DOM contract: The UI code relies heavily on specific element ids (e.g., `runBtn`, `resultsConsole`, `processAllBtn`). Avoid renaming DOM ids unless you update all callers and smoke tests.
- Browser-global exports: modules expose functions via `window.*` for test automation (e.g., `window.RenameUpload`, `window.processFile`). Keep these exports stable for tests.

## Tests & developer workflows

- Unit-like heuristic tests: Run `node scripts/heuristic-check.js`. This checks CR detection logic and is the canonical place to add new test cases when changing detection patterns.
- UI smoke tests: Install Playwright and run `node scripts/ui-smoke-test.js` (or `npx playwright test scripts/ui-smoke-test.js`). The script expects a static server (the script spawns `python3 -m http.server`).
- Local serve: For manual testing serve the repo root (examples in smoke test):

  python3 -m http.server 8080

 then open `http://localhost:8080/CR.html` or `http://localhost:8080/CR.html`.

## External dependencies & runtime notes

- Libraries are expected at runtime in the browser: `pdfjsLib`, `XLSX` (SheetJS), `JSZip`, `saveAs` and optionally `Tesseract` and `PDFLib` for CR.js. Some are loaded from CDN in `app.js` (pdf.worker); confirm availability before running in headless tests.
- Smoke tests assume `python3` and `node` are available in PATH and that Playwright is installed when running `ui-smoke-test.js`.

## Guidance for AI code agents (concise)

1. Preserve `CONFIG` tuning and DOM ids. If you change a threshold, add or update tests in `scripts/heuristic-check.js`.
2. Prefer small, local edits: detection rules are sensitive and covered by `heuristic-check.js`. Add test cases for every pattern change.
3. When modifying OCR/normalization, update both `CR.js` and `scripts/heuristic-check.js` (they share logic patterns). Keep helpers (`normalizeToken`, `normalizeOCRText`) consistent.
4. Signature/stamp logic in `CR.js` uses canvas pixel analysis (ROI). Avoid major refactors without running the UI smoke tests — these rely on DOM element IDs and expected library availability.
5. For new features needing server-side work: note this repo is client-only; prefer adding small node test scripts under `scripts/` rather than introducing a backend.

## Useful file pointers (examples)

- CR heuristics & stroke detection: CR.js (top-level CONFIG, `findCRsOnText`, `analyzeSignatureStrokes`).
- Delivery note extraction, candidate rules, auto-correct: app.js (`extractPotentialDeliveryNotes`, `validateDeliveryNotes`).
- Heuristic test cases and runner: scripts/heuristic-check.js (add expected cases here).
- Playwright smoke tests: scripts/ui-smoke-test.js (shows how the app is served and what DOM ids are required).

If anything is missing or you want more detail about a specific area (OCR, signature detection, or the 7→8 auto-correction), tell me which part to expand or which files to reference in-line.
