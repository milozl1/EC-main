# 📄 Delivery Note Extractor v6.0 - Multi-Table Support# 📄 Delivery Note Extractor v5.0 - Production Ready# 📄 Delivery Note Extractor v4.0 - Professional Edition# 📄 Delivery Note Extractor v3.0# 📄 Delivery Note Extractor v2.0ROL / CONTEXT



A professional web application for extracting Delivery Notes from PDF files and generating Excel files. Runs 100% client-side - your data never leaves your computer.



## 🔧 What's New in v6.0A professional web application for extracting Delivery Notes from PDF files and generating Excel files. Runs 100% client-side - your data never leaves your computer.



- **Multi-Table Detection**: Finds ALL tables in PDF (multiple tables per page, tables split across pages)

- **Accurate Column Detection**: Properly identifies "Delivery Note" column header on every page

- **7-Digit Handling**: Numbers with 7 digits are reported for review and auto-corrected when possible**🔧 Critical Update in v5.0**: Complete rewrite of extraction logic to strictly extract ONLY from the "Delivery Note" column using X-coordinate matching. Previous versions incorrectly extracted dates, prices, and other data from adjacent columns.A complete, professional-grade web application for extracting Delivery Notes from PDF files and generating Excel files. Runs 100% client-side - your data never leaves your computer.

- **Smart Pre-Filtering**: Automatically excludes dates (21/02/2025), decimals (360.0), and alphanumeric codes (180222866R)



---

---

## 🚀 Features



### Core Functionality

- **Bulk PDF Upload**: Drag & drop or click to select up to 500 PDF files## 🚀 Features## 🚀 FeaturesA complete web application for extracting **Delivery Notes** from PDF files and generating Excel files (.xlsx).Ești o echipă completă de profesioniști seniori (Tech Lead, Frontend Engineer, Full‑Stack Engineer, QA, UX) cu experiență solidă în HTML, JavaScript, PDF parsing, generare Excel, UI dashboards, testare și livrare end‑to‑end. Livrezi o aplicație complet funcțională, cu cod clar, comentat, testabil și ușor de rulat local.

- **Multi-Table Extraction**: Handles PDFs with multiple tables and tables spanning pages

- **Excel Generation**: Creates clean Excel files without headers (just delivery note values)

- **ZIP Download**: Download all processed files as a single ZIP archive

### Core Functionality

### Validation System

- **Bulk PDF Upload**: Drag & drop or click to select up to 500 PDF files

| Category | Criteria | Action |

|----------|----------|--------|- **Strict Column Extraction**: Identifies "Delivery Note" column header and extracts ONLY values from that column### Core Functionality

| ✅ **Accepted** | Exactly 8 digits | Exported to Excel |

| ⏭️ **Excluded** | 9-10 digits | Skipped (too long) |- **Excel Generation**: Creates clean Excel files without headers (just values)

| 🔧 **Auto-Fix** | 7 digits | Adds leading digit based on pattern |

| ❌ **Invalid** | Other lengths | Flagged for review |- **ZIP Download**: Download all processed files as a single ZIP archive- **Bulk PDF Upload**: Drag & drop or click to select up to 500 PDF files



### Interactive Features

- **Click-to-View Details**: Click any number in the results table to see full list

- **Dashboard Cards**: Click statistics to view all items across files### Validation System- **Smart Table Extraction**: Automatically detects and extracts delivery note columns## 🎯 FeaturesAplicație web completă pentru extragerea **Delivery Notes** din fișiere PDF și generarea de fișiere Excel (.xlsx).

- **Modal Search**: Search within detail dialogs

- **CSV Export**: Export any view to CSV



---| Category | Criteria | Action |- **Excel Generation**: Creates clean Excel files without headers (just values)



## 🛠️ Technology Stack|----------|----------|--------|



- **PDF.js 3.11.174**: PDF parsing and text extraction| ✅ **Accepted** | Exactly 8 digits | Exported to Excel |- **ZIP Download**: Download all processed files as a single ZIP archive

- **SheetJS (xlsx) 0.18.5**: Excel file generation

- **JSZip 3.10.1**: ZIP archive creation| ⏭️ **Excluded** | 9-10 digits | Skipped (too long) |

- **FileSaver.js 2.0.5**: Client-side file downloads

| 🔧 **Auto-Fix** | 7 digits | Adds leading digit based on pattern |

---

| ❌ **Invalid** | <7 or >10 digits | Flagged as error |

## 🚀 How to Run

### Comprehensive Validation System- ✅ **Bulk PDF Upload** - Drag & Drop or click (up to 500 files)OBIECTIV

### Option 1: Deploy to Vercel (Recommended)

**Note**: The extraction now pre-filters to only consider pure digit values (7-10 characters). Dates like `21/02/2025`, decimals like `360.0`, and alphanumeric codes like `180222866R` are automatically ignored since they contain non-digit characters.

```bash

# Install Vercel CLI| Category | Criteria | Action |

npm install -g vercel

### Interactive Features

# Deploy from project folder

cd /path/to/EC-main- **Click-to-View Details**: Click on any number in the table to see the full list|----------|----------|--------|- ✅ **Table Extraction** - Automatic detection of "Delivery Note" column

vercel

```- **Dashboard Cards**: Click dashboard statistics to view all items across files



### Option 2: Local Server (Python)- **Modal Search**: Search within modal dialogs to find specific entries| ✅ **Accepted** | Exactly 8 digits | Exported to Excel |



```bash- **CSV Export**: Export modal contents to CSV from any detail view

cd /path/to/EC-main

python -m http.server 8000| ⏭️ **Excluded** | 9-10 digits | Skipped (too long) |- ✅ **Complete Validation**:## 🎯 FuncționalitățiConstruiește o aplicație web (HTML + JS + CSS) care permite încărcarea în bulk a mai multor fișiere PDF și, pentru fiecare PDF:

# Open http://localhost:8000

```### Professional UI/UX



### Option 3: Local Server (Node.js)- **Real-time Progress**: Visual progress bar during batch processing| ❌ **Invalid** | <7 digits, >10 digits, letters, special chars | Flagged as error |



```bash- **Toast Notifications**: Success/error/warning notifications

cd /path/to/EC-main

npx serve- **Sortable Columns**: Click headers to sort by name, size, or status| 🔧 **Auto-Fix** | 7 digits | Attempts to add leading digit based on pattern |  - `8 digits` → **ACCEPT** (exported to Excel)

```

- **Search Files**: Filter uploaded files by name

### Option 4: Direct Browser Opening



Open `index.html` directly in Chrome, Firefox, or Edge.

---

---

### Interactive Features  - `9-10 digits` → **EXCLUDE** (not exported)Exemplu PDF: 25.01.23_1.pdf

## 📁 Project Structure

## 🛠️ Technology Stack

```

EC-main/- **Click-to-View Details**: Click on any number in the table to see the full list

├── index.html      # Main application HTML

├── styles.css      # Professional styling- **PDF.js 3.11.174**: PDF parsing and text extraction

├── app.js          # Application logic (v6.0)

├── vercel.json     # Vercel deployment config- **SheetJS (xlsx) 0.18.5**: Excel file generation- **Dashboard Cards**: Click dashboard statistics to view all items across files  - `7 digits or other` → **ERROR** (reported in dashboard)

└── README.md       # This file

```- **JSZip 3.10.1**: ZIP archive creation



---- **FileSaver.js 2.0.5**: Client-side file downloads- **Modal Search**: Search within modal dialogs to find specific entries



## 🔍 How Multi-Table Extraction Works- **Pure HTML/CSS/JavaScript**: No build tools required



1. **Parse PDF**: Extract all text items with X/Y coordinates from all pages- **CSV Export**: Export modal contents to CSV from any detail view- ✅ **Smart Auto-Correction** - For 7-digit numbers with missing leading digit- ✅ **Încărcare bulk PDF** - Drag & Drop sau click (până la 500 fișiere)Extrage din tabele valorile din coloana “Delivery Note”.

2. **Group into Rows**: Cluster text items by Y position

3. **Find ALL Headers**: Search for "Delivery Note" column headers on every page---

4. **Extract Per Table**: For each header, extract values from that column until next header or table end

5. **Pre-Filter**: Only consider pure 7-10 digit numbers (ignores dates, decimals, alphanumeric)

6. **Validate**: Apply 8-digit/9-10/7-digit rules

## 🚀 How to Run

### Automatically Filtered Out

- Dates: `21/02/2025`, `16/01/2025` (contain `/`)### Professional UI/UX- ✅ **Excel per PDF** - Each PDF produces a separate Excel file (no header row)

- Decimals: `360.0`, `180.50` (contain `.`)

- Alphanumeric: `180222866R` (contain letters)### Method 1: Deploy to Vercel (Recommended)

- Wrong length: Less than 7 or more than 10 digits

- **Real-time Progress**: Visual progress bar during batch processing

---

Best option if you can't run a local server. Free, fast, and always accessible.

## 📊 Dashboard

- **Toast Notifications**: Success/error/warning notifications- ✅ **Individual or ZIP Download** - All files in one click- ✅ **Extragere tabele** - Detectare automată a coloanei "Delivery Note"Aplică o regulă de validare:

Click any card to view details:

1. Create account at [vercel.com](https://vercel.com)

| Card | Description |

|------|-------------|2. Install Vercel CLI (optional, but recommended):- **Sortable Columns**: Click headers to sort by name, size, or status

| Total Accepted | Valid 8-digit delivery notes |

| Total Excluded | 9-10 digit numbers (skipped) |   ```bash

| Total Invalid | Entries needing review |

| Total Duplicates | Duplicate values found |   npm install -g vercel- **Search Files**: Filter uploaded files by name- ✅ **Complete Dashboard** - Detailed statistics per file and total

| Auto-Corrections | 7-digit → 8-digit fixes |

   ```

---

3. Deploy from the project folder:- **Validation Rules Info**: Clear explanation of validation logic

## 🆘 Troubleshooting

   ```bash

### No delivery notes extracted

- Check that PDF has a "Delivery Note" column header   cd /path/to/EC-main- ✅ **100% Client-side** - Data NEVER leaves your computer- ✅ **Validare completă**:

- Verify PDF is text-based (not scanned image)

- Open browser console (F12) to see extraction logs   vercel



### 7-digit numbers not auto-corrected   ```### Export & Reporting

- Auto-correction requires at least one valid 8-digit number to detect pattern

- If no pattern found, 7-digit numbers appear in Invalid for manual review4. Follow the prompts - your app will be live at `https://your-project.vercel.app`



### Dates/decimals appearing in results- **Individual Excel Download**: Download Excel for each processed file

- Update to v6.0 which pre-filters non-digit characters

- These should never appear in extracted results anymore**Or deploy via GitHub:**



---1. Push this folder to a GitHub repository- **Bulk ZIP Download**: Download all Excel files in one ZIP



## 📄 License2. Connect repository to Vercel



MIT License - Free to use and modify.3. Vercel automatically deploys on every push- **Summary Report**: Export a complete text report with statistics---  - `9 cifre` → **ACCEPT** (exportat în Excel)dacă un “Delivery Note” are 10 digits, de forma 0183173265 → IGNORĂ (nu îl exporta)




### Method 2: Local Server (Python)- **CSV Export**: Export any detail view to CSV format



```bash

cd /path/to/EC-main

python -m http.server 8000## 🛠️ Technology Stack

```

Open: http://localhost:8000## 🚀 How to Run  - `10 cifre` → **IGNORAT** (nu se exportă)dacă are 9 digits → ACCEPTĂ (îl exporta)



### Method 3: Local Server (Node.js)- **PDF.js 3.11.174**: PDF parsing and text extraction



```bash- **SheetJS (xlsx) 0.18.5**: Excel file generation

cd /path/to/EC-main

npx serve- **JSZip 3.10.1**: ZIP archive creation

```

- **FileSaver.js 2.0.5**: Client-side file downloads### Method 1: Direct Browser Opening  - `8 cifre sau altele` → **EROARE** (raportat în dashboard)orice alt format (ex. 8 digits,, litere, gol) → marchează ca eroare (în dashboard)

### Method 4: Direct Browser Opening

- **Pure HTML/CSS/JavaScript**: No build tools required

Open `index.html` directly in Chrome, Firefox, or Edge.



**Note**: Due to CORS restrictions, some PDF workers may not load via `file://` protocol. The app includes a fallback that loads the worker via blob URL, which should work in most modern browsers.

## 📦 Installation

---

1. Open `index.html` directly in browser (Chrome, Firefox, Edge)- ✅ **Auto-corecție inteligentă** - Pentru numere cu cifră lipsă din fațădaca de exemplu un delivery note are lipsa un numar sau are un caracter neobisnuit, acesta trebuie semnalizat in dashbord si creata o obtinute de apropare modificare automat in cazul in care exista erori. de exemplu daca lipseste un numar din fata de forma

## 📁 Project Structure

No installation required! Simply:

```

EC-main/2. Due to CORS restrictions for local files, some browsers may block external library loading

├── index.html      # Main application HTML

├── styles.css      # Professional styling (modals, notifications, etc.)1. Clone or download this repository

├── app.js          # Application logic (v5.0 - strict column extraction)

├── vercel.json     # Vercel deployment configuration2. Open `index.html` in a modern web browser, OR- ✅ **Generare Excel per PDF** - Fiecare PDF produce un Excel separat26969537

└── README.md       # This file

```3. Run a local server for best results:



---### Method 2: Simple Local Server (Recommended)



## 🔍 How Column Extraction Works```bash



### v5.0 Algorithm# Using Python- ✅ **Download individual sau ZIP** - Toate fișierele într-un singur click26995971



1. **Extract Text with Coordinates**: Parse PDF and get text items with X/Y positionspython3 -m http.server 8080

2. **Group into Rows**: Group text items by Y coordinate (same row if Y within 5 units)

3. **Find Column Header**: Search for "Delivery Note", "DN", "Aviz", etc. in header rows#### With Python (simplest):

4. **Record Column X Position**: Store the X coordinate of the column header

5. **Extract Column Values**: For each row below the header, find values within ±50px of column X# Using Node.js

6. **Pre-Filter**: Only consider values that are 7-10 pure digits (no letters, slashes, decimals)

7. **Validate**: Apply 8-digit/9-10/7-digit rulesnpx serve- ✅ **Dashboard complet** - Statistici detaliate per fișier și total27028883



### What Gets Filtered Out



The strict extraction automatically ignores:# Using PHP```bash

- Dates: `21/02/2025`, `16/01/2025` (contain `/`)

- Decimals: `360.0`, `180.50` (contain `.`)php -S localhost:8080

- Alphanumeric: `180222866R`, `ABC123` (contain letters)

- Too short: `12345` (less than 7 digits)```# Navigate to folder- ✅ **100% Client-side** - Datele NU părăsesc calculatorul27009396

- Too long: `12345678901234` (more than 10 digits)

- Data from other columns: Only values aligned with "Delivery Note" header are extracted



---4. Open http://localhost:8080 in your browsercd /path/to/EC-main



## 📊 Dashboard Cards



Click any dashboard card to view details:## 📖 Usage Guide27022495



| Card | Shows |

|------|-------|

| Total Accepted | All valid 8-digit delivery notes across all files |### Basic Workflow# Python 3

| Total Excluded | All 9-10 digit numbers that were skipped |

| Total Invalid | All entries that failed validation |

| Total Duplicates | Duplicate entries found within files |

| Auto-Corrections | 7-digit numbers that were auto-corrected to 8 digits |1. **Upload PDFs**: Drag PDF files onto the drop zone or click to selectpython3 -m http.server 8080---7022496 - lipseste 2, trebuie sa analizezi ce numar lipseste din fata in functie de cum incep celelate, daca incep cu 2 inseamna ca lipsete 2. acest lucu se aplica doar pentru numerle care lipsesc din fata nu de la coada( se aplica doar pentru 9 digits)



---2. **Process**: Click "Process All" to extract delivery notes from all files



## 🧪 Testing3. **Review**: Check the table for results:



Use the included test PDF files (`25.01.23_1.pdf` through `25.01.23_5.pdf`) to verify the extraction logic.   - Click numbers to view details



Expected behavior:   - Review excluded/invalid entries# Or Python 2

- Only values from the "Delivery Note" column should be extracted

- Dates, prices, and reference numbers from other columns should NOT appear in results   - Verify auto-corrections

- 8-digit numbers should be accepted

- 9-10 digit numbers should be excluded4. **Download**: Download individual Excel files or all as ZIPpython -m SimpleHTTPServer 8080

- 7-digit numbers should be auto-corrected if a pattern exists



---

### Understanding the Results```## 🚀 How to Run (Instrucțiuni de Rulare)Generează un fișier Excel (.xlsx) separat pentru fiecare PDF, cu:

## 📝 Changelog



### v5.0 (Current)

- **Critical Fix**: Complete rewrite of extraction logic- **Accepted (8d)**: Valid 8-digit delivery notes → exported to Excel

- Strict column-based extraction using X coordinates

- Pre-filter to only consider 7-10 pure digit values- **Excluded (9-10d)**: Numbers with 9-10 digits → skipped

- Added blob URL worker fallback for `file://` protocol

- Added Vercel deployment configuration- **Invalid**: Wrong format (letters, special chars, wrong length)Then open in browser: `http://localhost:8080`



### v4.0- **Duplicates**: Repeated entries found

- Professional Edition with modals, notifications

- Interactive dashboard cards- **Auto-Fixes**: 7-digit numbers corrected by adding leading digit

- Search and sort functionality

- CSV export from modals



### v3.0### Clicking for Details#### With Node.js:### Metoda 1: Deschidere directă în browserprima coloană = Delivery Note

- Initial validation rules (8/9-10/7 digit logic)

- Auto-correction for 7-digit numbers

- Basic dashboard

- **Table Numbers**: Click any number in the table to see the specific items

---

- **Dashboard Cards**: Click any statistic card to view all items from all files

## 🆘 Troubleshooting

- **Modal Features**:```bashcâte un rând pentru fiecare valoare găsită (păstrează și duplicatele, dar raportează și numărul de unice în dashboard)

### "Could not extract text from PDF"

- PDF may be scanned (image-based) rather than text-based  - Search to filter items

- PDF may be password protected

- Try a different PDF file  - Export to CSV# Install serve (once)



### Numbers from other columns appearing in results  - See reasons for each entry

- This was fixed in v5.0 with strict column extraction

- Ensure you're using the latest `app.js`npm install -g serve1. Deschide fișierul `index.html` direct în browser (Chrome, Firefox, Edge)



### Worker not loading (file:// protocol)## 📋 Validation Rules

- Use Vercel deployment (recommended)

- Or run via local server (`python -m http.server 8000`)

- The app includes a blob URL fallback that should work in most cases

### What Gets Accepted

---

- Numbers with **exactly 8 digits**: `12345678`# Run2. Din cauza restricțiilor CORS pentru fișierele locale, unele browsere pot bloca încărcarea bibliotecilor externeOferă opțiuni de download:

## 📄 License

- Auto-corrected 7-digit numbers: `1234567` → `01234567` (if pattern found)

MIT License - Free to use and modify.

cd /path/to/EC-main

---

### What Gets Excluded

**Built with ❤️ for efficient delivery note extraction**

- **9 digits**: Too long, e.g., `123456789`serve -p 8080

- **10 digits**: Too long, e.g., `1234567890`

```

### What's Invalid

- **Less than 7 digits**: Too short, e.g., `12345`### Metoda 2: Server local simplu (Recomandat)download Excel individual per PDF

- **More than 10 digits**: Way too long

- **Contains letters**: e.g., `1234567A`#### With Live Server (VS Code Extension):

- **Contains special chars**: e.g., `1234-5678`

- **7 digits without pattern**: Cannot auto-correctdownload “All” într‑un ZIP cu toate Excel‑urile



## 🔧 Auto-Correction Logic1. Install "Live Server" extension in VS Code



The system attempts to correct 7-digit numbers by:2. Right-click on `index.html` → "Open with Live Server"#### Cu Python (cel mai simplu):



1. **Dominant Digit Method**: If >50% of valid 8-digit numbers start with the same digit, use that as the leading digit

2. **Prefix Pattern Method**: Analyze common 2-digit prefixes and match patterns

---CERINȚE FUNCȚIONALE (detaliate)

Example:

- If most delivery notes start with `2` (e.g., `21234567`, `22345678`)

- A 7-digit number `1234567` becomes `21234567`

## 📋 How to Use```bashUI / Pagina principală

## 📊 Example Output



### Excel File (no header)

```1. **Upload PDF files**# Navighează în folderzonă de upload: <input type="file" multiple accept="application/pdf"> + drag&drop

21234567

21234568   - Drag files to upload zone OR

21234569

21234570   - Click "Select Files" and choose PDFscd /Users/esteravranceanu/Desktop/EC-mainlistă de fișiere încărcate cu status per fișier: “Pending / Processing / Done / Error”

```



### Summary Report

```2. **Process**buton “Process All”

=== DELIVERY NOTE EXTRACTOR SUMMARY REPORT ===

Generated: 01/23/2026, 07:30:00 PM   - Click "⚙️ Process All" for bulk processing



--- STATISTICS ---   - Or "⚙️ Process" individually per file# Python 3progres global (ex. progres bar) și progres per fișier

Total Files: 5

Total Accepted (8 digits): 150

Total Excluded (9-10 digits): 10

Total Invalid: 53. **Check results**python3 -m http.server 8080

Total Duplicates: 3

Total Auto-Corrections: 12   - Table shows status of each file

```

   - Dashboard summarizes all statisticsExtragere tabele / logică PDF

## 🔐 Privacy

   - Errors section shows problems and auto-corrections

**100% Client-Side Processing**

# Sau Python 2

- All PDF parsing happens in your browser

- No data is sent to any server4. **Download**

- Works offline after initial page load

- Your files never leave your computer   - "📥 Download" - for a single Excelpython -m SimpleHTTPServer 8080folosește o abordare robustă: extrage textul și pozițiile (coordonate) și reconstruiește rânduri/coloane.



## 🌐 Browser Compatibility   - "📥 Download All (ZIP)" - for all files



- ✅ Chrome (recommended)```identifică zona de tabel prin detectarea header‑elor “Delivery Note”.

- ✅ Firefox

- ✅ Safari---

- ✅ Edge

- ❌ Internet Explorer (not supported)nu presupune că “primul număr din rând” e delivery note; folosește coloana corectă după header.



## 📝 Version History## 🧮 Table Reconstruction Algorithm



### v4.0 (Current) - Professional EditionApoi deschide în browser: `http://localhost:8080`gestionează mai multe tabele în același PDF și mai multe pagini.

- Interactive detail modals with click-to-view

- Enhanced validation for <8 digits and non-numeric characters### Problem

- Clickable dashboard cards

- Search functionality for files and modal contentPDFs store text as individual elements with positions (x, y), not as structured tables.tratează PDF-uri cu layout imperfect: spațieri, linii rupte, rânduri în 2 linii etc.

- Sortable table columns

- Export to CSV from any modal

- Summary report export

- Toast notification system### Solution (in 5 steps)#### Cu Node.js:

- Validation rules info box

- Improved error reporting with reasons



### v3.0#### 1. Text Extraction with PositionsValidare

- Changed validation: 8 digits = accept, 9-10 = exclude

- English interface```

- Excel without header row

- Auto-correction for 7-digit numbersPDF.js extracts each text element with:```bash



### v2.0- text: string (content)

- Dashboard statistics

- Bulk processing- x: horizontal coordinate# Instalează serve (o singură dată)regex pentru digits:

- ZIP download

- y: vertical coordinate

### v1.0

- Initial release- pageNum: page numbernpm install -g serve

- Basic PDF extraction

- Single file processing```



## 📄 Licenseaccept: ^\d{9}$



MIT License - Free to use, modify, and distribute.#### 2. Row Grouping



## 🤝 Support```# Ruleazăignore: ^\d{10}$



For issues or feature requests, please create an issue in the repository.Elements with similar Y (difference < 3 points) = same row



---Clustering is used for tolerance to imperfectionscd /Users/esteravranceanu/Desktop/EC-mainerror: orice altceva (inclusiv 8 digits)



Made with ❤️ for efficient document processing```


serve -p 8080

#### 3. "Delivery Note" Header Detection

``````raportează în dashboard:

Search for: "delivery note", "del note", "dn", etc.

Store X position of found column

```

#### Cu Live Server (VS Code Extension):count acceptate (9 digits)

#### 4. Column Value Extraction

```count ignorate (10 digits)

From row after header:

- Search for element with similar X1. Instalează extensia "Live Server" în VS Codecount invalide (altele) + exemple (primele 10)

- Stop at next header (new table)

```2. Click dreapta pe `index.html` → "Open with Live Server"count total detectate



#### 5. Regex Fallbackcount duplicate + count unice

```

If table method fails:### Metoda 3: Alte opțiuni

- Scan all text with regex /\b\d{7,10}\b/

```Excel



---- **XAMPP/MAMP/WAMP**: Pune folderul în `htdocs`



## ✅ Validation Rules- **Browsersync**: `npx browser-sync start --server --files "*.html, *.css, *.js"`generează .xlsx per PDF cu Sheet1:



| Pattern | Action | Example |

|---------|--------|---------|

| `^\d{8}$` | ✅ ACCEPT | 26969537 |---A1 = “Delivery Note”

| `^\d{9}$` | ⏭️ EXCLUDE | 123456789 |

| `^\d{10}$` | ⏭️ EXCLUDE | 0183173265 |

| `^\d{7}$` | 🔧 AUTO-CORRECT | 6969537 → 26969537 |

| Other | ❌ ERROR | ABC123, 12345, empty |## 📋 Cum să Folosești Aplicațianumele fișierului Excel va fi identic cu numele PDF ului din care au fost extrase datele.



### Smart Auto-Correction



When we find a 7-digit number:1. **Încarcă fișierele PDF**daca sunt 300 de fisiere PDF se vor genera 300 de excel, cate unul pentru fiecare fisier pdf

1. Analyze other accepted Delivery Notes (8 digits)

2. Identify dominant leading digit (e.g., most start with "2")   - Trage fișierele în zona de upload SAU

3. Automatically add missing digit: `6969537` → `26969537`

4. Report correction in dashboard for manual verification   - Click pe "Selectează Fișiere" și alege PDF-urileZIP



---



## 🧪 Test Plan2. **Procesează**creează un results.zip conținând toate Excel‑urile generate



### Functional Test Cases   - Click pe "⚙️ Procesează Toate" pentru bulk



| # | Test Case | Input | Expected Result |   - Sau "⚙️ Process" individual per fișierDashboard

|---|-----------|-------|-----------------|

| 1 | Upload single PDF | 1 valid PDF | Appears in list, status "Pending" |

| 2 | Upload multiple PDFs | 10 PDFs | All in list, counter = 10 |

| 3 | Upload non-PDF | .jpg, .doc | Alert "valid PDF files" |3. **Verifică rezultatele**tabel sumar per PDF:

| 4 | Drag & Drop | Drag 5 PDFs | All added to list |

| 5 | Process single | Click Process | Status → Processing → Done |   - Tabelul arată statusul fiecărui fișier

| 6 | Process all | Click Process All | Progress bar, all processed |

| 7 | Download Excel | Click Download | Downloads .xlsx with PDF name |   - Dashboard-ul sumarizează toate statisticilenume PDF, pagini, status, acceptate, ignorate (10 digits), invalide, duplicate, buton download

| 8 | Download ZIP | Click ZIP | results.zip with all Excel files |

   - Secțiunea de erori arată probleme și auto-corecții

### Validation Test Cases

secțiune “Errors” cu detalii pe fișier

| # | Input | Expected |

|---|-------|----------|4. **Descarcă**

| 1 | 26969537 | Accepted (8 digits) |

| 2 | 123456789 | Excluded (9 digits) |   - "📥 Download" - pentru un singur ExcelCONSTRÂNGERI / NFR (non‑functional)

| 3 | 0123456789 | Excluded (10 digits) |

| 4 | 6969537 | Auto-correct → 26969537 |   - "📥 Descarcă Toate (ZIP)" - pentru toate fișierelerulează local ușor (fără setup complicat).

| 5 | ABC12345 | Error |

preferabil client‑side pentru confidențialitate (PDF-urile nu pleacă de pe PC).

### Edge Cases

---gestionează bulk: minim 50 PDF-uri

| # | Scenario | Action |

|---|----------|--------|cod modular, lizibil, comentat; error handling real.

| 1 | PDF without tables | Regex fallback |

| 2 | Scanned PDF (images) | Error: "Could not extract text" |## 🧮 Algoritm de Reconstrucție a Tabelului

| 3 | Protected PDF | Error: access denied |

| 4 | Multi-page PDF | Processes all pages |TEHNOLOGII RECOMANDATE alege cele mai bune tehnologii dar fara server, aplicatia va rula local

| 5 | Multiple tables | Detects each header |

### Problema

---

PDF-urile stochează textul ca elemente individuale cu poziții (x, y), nu ca tabel structurat. Trebuie să reconstruim tabelul pentru a identifica coloana "Delivery Note".LIVRABILE (obligatoriu)

## 📁 Project Structure

Livrează:

```

EC-main/### Soluția (în 5 pași)

├── index.html      # Main HTML page (English)

├── styles.css      # Complete CSS stylescod complet pentru: index.html, styles.css, app.js (sau modulare)

├── app.js          # JavaScript logic (800+ lines)

└── README.md       # Documentation#### 1. Extragere Text cu Pozițiiinstrucțiuni clare “How to run”

```

```explicație a algoritmului de reconstrucție a tabelului (din coordonate în rânduri/coloane)

---

PDF.js extrage fiecare element de text cu:plan de testare + cazuri edge

## 🔧 Technologies Used

- text: string (conținutul)

| Library | Version | Purpose |

|---------|---------|---------|- x: coordonata orizontalăACCEPTANCE CRITERIA (criterii de acceptanță)

| PDF.js | 3.11.174 | PDF parsing |

| SheetJS (xlsx) | 0.18.5 | Excel generation |- y: coordonata verticalăAplicația e “DONE” doar dacă:

| JSZip | 3.10.1 | ZIP archive creation |

| FileSaver.js | 2.0.5 | File download |- width, height: dimensiunipot încărca multiple PDF-uri și pot procesa toate



All libraries loaded from CDN (cdnjs.cloudflare.com).- pageNum: numărul paginiipentru fiecare PDF se generează un Excel separat cu Delivery Notes acceptate (9 digits)



---```valorile cu 10 digits sunt ignorate, iar altele sunt raportate ca invalide



## 🔒 Security & Privacydashboard arată clar rezultatele și erorile per fișier



- **100% Client-side**: No communication with external servers#### 2. Grupare pe Rânduriexistă download individual și download ZIP pentru toate

- **Data stays local**: PDFs are never uploaded anywhere

- **Browser processing**: All code runs locally```

- **No server dependencies**: No backend required

Algoritmul scanează toate elementele și le grupează:Output final: cod + instrucțiuni, totul complet end‑to‑end.

---

- Elemente cu Y similar (diferență < 3 puncte) = același rând

## 🐛 Troubleshooting- Se folosește clustering pentru toleranță la imperfecțiuni

```

### "Error loading libraries"

- Check internet connection#### 3. Detectare Header "Delivery Note"

- Use a local server (see How to Run)```

- Disable AdBlock/uBlockPentru fiecare rând:

- Concatenăm textul elementelor

### "Could not extract text from PDF"- Căutăm: "delivery note", "del note", "dn", etc.

- PDF may be scanned (image, not text)- Memorăm poziția X a coloanei găsite

- PDF may be protected/encrypted```

- Try another PDF to verify

#### 4. Extragere Valori din Coloană

### Excel is empty```

- PDF doesn't contain valid Delivery NotesDe la rândul după header:

- Check table format in PDF- Căutăm în fiecare rând elementul cu X similar (±50 puncte)

- All numbers may be 9-10 digits (excluded)- Extragem valoarea dacă conține cifre

- Ne oprim la următorul header (tabel nou)

---```



## 📝 Changelog#### 5. Fallback Regex

```

### v3.0 (Current)Dacă metoda tabelului eșuează:

- ✨ NEW: 8 digits = Accept, 9-10 digits = Exclude- Scanăm tot textul cu regex /\b\d{7,10}\b/

- ✨ Excel without header row- Colectăm toate numerele care par Delivery Notes

- ✨ English interface (default)```

- ✨ Auto-correction for 7-digit numbers → 8 digits

- ✨ Improved table reconstruction algorithm### Diagrama Fluxului

- 🐛 Various bug fixes

```

### v2.0PDF File

- Initial release with 9-digit logic    ↓

[PDF.js - Extract Text Items]

---    ↓

[Group Items by Y → Rows]

**Developed with ❤️ for efficient PDF data extraction.**    ↓

[Find "Delivery Note" Header]
    ↓
[Extract Values from Column]
    ↓
[Validate & Categorize]
    ↓
[Generate Excel]
```

---

## ✅ Reguli de Validare

| Pattern | Acțiune | Exemplu |
|---------|---------|---------|
| `^\d{9}$` | ✅ ACCEPT | 123456789 |
| `^\d{10}$` | ⏭️ IGNORĂ | 0183173265 |
| `^\d{8}$` | 🔧 AUTO-CORECTARE | 26969537 → 226969537 |
| Altele | ❌ EROARE | ABC123, 12345, gol |

### Auto-Corecție Inteligentă

Când găsim un număr de 8 cifre:
1. Analizăm celelalte Delivery Notes acceptate (9 cifre)
2. Identificăm cifra dominantă din față (ex: majoritatea încep cu "2")
3. Adăugăm automat cifra lipsă: `7022496` → `27022496`
4. Raportăm corecția în dashboard pentru verificare manuală

**Exemplu din cerințe:**
```
26969537  ✅ Accept (9 digits)
26995971  ✅ Accept (9 digits)
27028883  ✅ Accept (9 digits)
27009396  ✅ Accept (9 digits)
27022495  ✅ Accept (9 digits)
7022496   🔧 Auto-corectare → 27022496 (lipsește "2" din față)
```

---

## 🧪 Plan de Testare

### Test Cases - Funcționale

| # | Test Case | Intrare | Rezultat Așteptat |
|---|-----------|---------|-------------------|
| 1 | Upload single PDF | 1 PDF valid | Apare în listă, status "Pending" |
| 2 | Upload multiple PDFs | 10 PDF-uri | Toate în listă, counter = 10 |
| 3 | Upload non-PDF | .jpg, .doc | Alert "fișiere PDF valide" |
| 4 | Drag & Drop | Drag 5 PDF-uri | Toate adăugate în listă |
| 5 | Process single | Click Process | Status → Processing → Done |
| 6 | Process all | Click Process All | Progress bar, toate procesate |
| 7 | Download Excel | Click Download | Descarcă .xlsx cu numele PDF |
| 8 | Download ZIP | Click ZIP | results.zip cu toate Excel |

### Test Cases - Validare

| # | Input | Expected |
|---|-------|----------|
| 1 | 123456789 | Accepted |
| 2 | 0123456789 | Ignored (10d) |
| 3 | 12345678 | Error sau Auto-correct |
| 4 | ABCD12345 | Error |
| 5 | (empty) | Ignored |
| 6 | 123 | Error |
| 7 | 7022496 | Auto-correct → 27022496 |

### Test Cases - Edge Cases

| # | Scenario | Acțiune |
|---|----------|---------|
| 1 | PDF fără tabele | Fallback regex, raportează ce găsește |
| 2 | PDF scanat (imagini) | Error: "Nu s-a putut extrage text" |
| 3 | PDF protejat | Error: acces respins |
| 4 | PDF multipagini | Procesează toate paginile |
| 5 | Tabele multiple | Detectează fiecare header |
| 6 | Duplicate values | Contorizate separat |
| 7 | 500+ fișiere | Alert "maxim 500" |

---

## 📁 Structura Proiectului

```
EC-main/
├── index.html      # Pagina principală HTML
├── styles.css      # Stiluri CSS complete
├── app.js          # Logica JavaScript (700+ linii)
└── README.md       # Documentație (acest fișier)
```

---

## 🔧 Tehnologii Utilizate

| Bibliotecă | Versiune | Rol |
|------------|----------|-----|
| PDF.js | 3.11.174 | Parsare PDF-uri |
| SheetJS (xlsx) | 0.18.5 | Generare Excel |
| JSZip | 3.10.1 | Creare arhive ZIP |
| FileSaver.js | 2.0.5 | Descărcare fișiere |

Toate bibliotecile sunt încărcate de pe CDN (cdnjs.cloudflare.com).

---

## 🔒 Securitate & Confidențialitate

- **100% Client-side**: Nicio comunicare cu servere externe
- **Datele rămân locale**: PDF-urile nu sunt uploadate nicăieri
- **Procesare în browser**: Tot codul rulează local
- **Fără dependențe server**: Nu necesită backend

---

## 🐛 Troubleshooting

### "Eroare la încărcarea bibliotecilor"
- Verifică conexiunea la internet
- Folosește un server local (vezi secțiunea How to Run)
- Dezactivează AdBlock/uBlock

### "Nu s-a putut extrage text din PDF"
- PDF-ul poate fi scanat (imagine, nu text)
- PDF-ul poate fi protejat/criptat
- Încearcă alt PDF pentru verificare

### Excel-ul este gol
- PDF-ul nu conține Delivery Notes valide
- Verifică formatul tabelului din PDF
- Toate numerele pot fi de 10 cifre (ignorate)

---

## 📝 Changelog

### v2.0 (Curent)
- ✨ Algoritm îmbunătățit de reconstrucție tabel
- ✨ Auto-corecție pentru numere de 8 cifre
- ✨ Dashboard extins cu statistici detaliate
- ✨ Suport pentru tabele multiple și pagini multiple
- 🐛 Fix pentru drag & drop pe macOS
- 🐛 Fix pentru click pe butonul de selectare

---

## 📧 Suport

Pentru probleme sau sugestii, verifică:
1. Consola browser-ului (F12 → Console) pentru erori
2. Secțiunea Troubleshooting din acest README
3. Asigură-te că folosești un browser modern (Chrome, Firefox, Edge)

---

**Dezvoltat cu ❤️ pentru extragerea eficientă a datelor din PDF-uri.**
