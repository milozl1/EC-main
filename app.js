/**
 * ============================================================================
 * DELIVERY NOTE EXTRACTOR - APPLICATION v7.0 (Robust Extraction)
 * ============================================================================
 * 
 * APPROACH: Extract ALL 8-digit numbers from PDF, then validate
 * This is more robust than column-based extraction for varied PDF formats
 * 
 * RULES:
 * - 8 digits: ACCEPTED (exported to Excel)
 * - 9-10 digits: EXCLUDED (too long, likely Transport ID)
 * - 7 digits: AUTO-CORRECT if pattern found, else INVALID
 * - Other: INVALID
 * ============================================================================
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    MAX_FILES: 500,
    
    // Delivery Note validation patterns
    REGEX_8_DIGITS: /^\d{8}$/,
    REGEX_7_DIGITS: /^\d{7}$/,
    REGEX_9_DIGITS: /^\d{9}$/,
    REGEX_10_DIGITS: /^\d{10}$/,
    
    // Pattern for potential delivery notes (7-10 pure digits)
    POTENTIAL_DN_PATTERN: /^\d{7,10}$/,
    
    // Patterns to EXCLUDE (these are NOT delivery notes)
    EXCLUDE_PATTERNS: [
        /^\d{10}$/,           // 10-digit Transport IDs like P042277201
        /^[A-Z]/i,            // Starts with letter (Part numbers like 146505902R)
        /[A-Z]$/i,            // Ends with letter
        /[A-Z]/i,             // Contains any letter
        /\//,                 // Contains slash (dates like 21/02/2025)
        /\./,                 // Contains dot (decimals like 360.0)
        /,/,                  // Contains comma
        /-/,                  // Contains dash
    ],
    
    // Row grouping tolerance
    ROW_Y_TOLERANCE: 8
};

// =============================================================================
// STATE
// =============================================================================

const AppState = {
    files: new Map(),
    excelBlobs: new Map(),
    isProcessing: false,
    sortColumn: null,
    sortDirection: 'asc',
    searchQuery: ''
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const Utils = {
    generateId: () => 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    getFileNameWithoutExtension: (fileName) => fileName.replace(/\.pdf$/i, ''),
    
    escapeHtml: (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    formatTimestamp: () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
};

// =============================================================================
// PDF.JS WORKER CONFIGURATION
// =============================================================================

let workerConfigured = false;

async function configurePdfWorker() {
    if (workerConfigured || typeof pdfjsLib === 'undefined') return;
    
    const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    try {
        if (location.protocol === 'http:' || location.protocol === 'https:') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
            workerConfigured = true;
            console.log('✅ PDF.js worker configured (CDN)');
            return;
        }
        
        console.log('📁 Running from file:// - configuring worker via blob...');
        const response = await fetch(workerUrl);
        if (!response.ok) throw new Error('Failed to fetch worker');
        
        const workerCode = await response.text();
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
        workerConfigured = true;
        console.log('✅ PDF.js worker configured (blob URL)');
        
    } catch (error) {
        console.warn('⚠️ Could not configure worker, disabling...', error);
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        workerConfigured = true;
    }
}

// =============================================================================
// PDF TEXT EXTRACTION
// =============================================================================

async function extractAllTextFromPDF(pdfFile) {
    await configurePdfWorker();
    
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const allTextItems = [];
    const pageCount = pdf.numPages;
    
    console.log(`📄 PDF has ${pageCount} pages`);
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        for (const item of textContent.items) {
            const text = (item.str || '').trim();
            if (text) {
                allTextItems.push({
                    text: text,
                    pageNum: pageNum
                });
            }
        }
    }
    
    console.log(`📝 Extracted ${allTextItems.length} text items`);
    return { items: allTextItems, pageCount };
}

// =============================================================================
// DELIVERY NOTE EXTRACTION (SIMPLE & ROBUST)
// =============================================================================

/**
 * Extracts all potential delivery notes from PDF text
 * Simple approach: find all 7-10 digit pure numbers
 * NOW TRACKS DUPLICATES properly!
 */
function extractPotentialDeliveryNotes(textItems) {
    const allCandidates = [];     // ALL occurrences (including duplicates)
    const occurrenceCount = {};   // Track how many times each value appears
    
    for (const item of textItems) {
        const text = item.text;
        
        // Clean the text: remove spaces
        const cleaned = text.replace(/\s+/g, '');
        
        // Skip if empty
        if (!cleaned) continue;
        
        // Check if it's a pure digit string of 7-10 characters
        if (/^\d{7,10}$/.test(cleaned)) {
            // Additional check: skip if it looks like something else
            // Skip values starting with 0 and having 10 digits (often Transport IDs)
            if (cleaned.length === 10 && cleaned.startsWith('0')) {
                console.log(`  ⏭️ Skipping Transport ID pattern: ${cleaned}`);
                continue;
            }
            
            // Track all occurrences
            allCandidates.push(cleaned);
            occurrenceCount[cleaned] = (occurrenceCount[cleaned] || 0) + 1;
            
            console.log(`  📋 Found candidate: ${cleaned} (${cleaned.length} digits) - occurrence #${occurrenceCount[cleaned]}`);
        }
    }
    
    // Calculate duplicates
    const uniqueCandidates = [...new Set(allCandidates)];
    const duplicates = [];
    
    for (const value of uniqueCandidates) {
        const count = occurrenceCount[value];
        if (count > 1) {
            duplicates.push({
                value: value,
                count: count,
                reason: `Found ${count} times in document`
            });
            console.log(`  🔁 Duplicate detected: ${value} appears ${count} times`);
        }
    }
    
    console.log(`\n📊 Found ${allCandidates.length} total candidates, ${uniqueCandidates.length} unique, ${duplicates.length} with duplicates`);
    
    return {
        unique: uniqueCandidates,
        duplicates: duplicates,
        totalCount: allCandidates.length,
        occurrenceCount: occurrenceCount
    };
}

// =============================================================================
// VALIDATION LOGIC
// =============================================================================

function validateDeliveryNotes(extractionResult) {
    // extractionResult has: { unique, duplicates, totalCount, occurrenceCount }
    const rawNotes = extractionResult.unique;
    const extractedDuplicates = extractionResult.duplicates;
    const occurrenceCount = extractionResult.occurrenceCount;
    
    console.log(`\n🔍 Validating ${rawNotes.length} unique candidates...`);
    
    const results = {
        accepted: [],           // Valid 8-digit delivery notes
        excluded: [],           // 9-10 digits (too long)
        invalid: [],            // Other issues
        autoCorrections: [],    // 7-digit auto-corrected
        duplicates: [],         // All duplicates info
        uniqueCount: 0,
        duplicateCount: 0,
        totalOccurrences: extractionResult.totalCount
    };
    
    const seen = new Set();
    const tempAccepted = [];
    const pending7Digit = [];
    
    for (const note of rawNotes) {
        const cleaned = note.replace(/\s+/g, '');
        
        if (!cleaned) continue;
        
        // Verify it's pure digits
        if (!/^\d+$/.test(cleaned)) {
            results.invalid.push({ value: cleaned, reason: 'Contains non-digit characters' });
            continue;
        }
        
        // Classify by digit count
        const len = cleaned.length;
        
        if (len === 8) {
            // Perfect! This is what we want
            seen.add(cleaned);
            tempAccepted.push(cleaned);
            console.log(`  ✅ Accepted: ${cleaned}`);
        } else if (len === 9 || len === 10) {
            // Too long - exclude
            results.excluded.push({ value: cleaned, reason: `${len} digits (excluded - likely Transport ID)` });
            console.log(`  ⏭️ Excluded: ${cleaned} (${len} digits)`);
        } else if (len === 7) {
            // May need auto-correction
            pending7Digit.push(cleaned);
            console.log(`  🔧 Pending 7-digit: ${cleaned}`);
        } else {
            // Invalid length
            results.invalid.push({ 
                value: cleaned, 
                reason: `${len} digits (expected 8)` 
            });
            console.log(`  ❌ Invalid: ${cleaned} (${len} digits)`);
        }
    }
    
    // Process 7-digit numbers
    if (pending7Digit.length > 0) {
        console.log(`\n🔧 Processing ${pending7Digit.length} 7-digit numbers...`);
        
        // Find dominant first digit from accepted 8-digit notes
        const firstDigitCounts = {};
        for (const note of tempAccepted) {
            const fd = note[0];
            firstDigitCounts[fd] = (firstDigitCounts[fd] || 0) + 1;
        }
        
        // Find most common first digit (must have at least 30% or 1 occurrence)
        let dominantDigit = null;
        let maxCount = 0;
        const threshold = Math.max(1, tempAccepted.length * 0.3);
        
        for (const [digit, count] of Object.entries(firstDigitCounts)) {
            if (count > maxCount && count >= threshold) {
                maxCount = count;
                dominantDigit = digit;
            }
        }
        
        console.log(`  Dominant first digit: ${dominantDigit || 'none'} (${maxCount} occurrences, threshold: ${threshold})`);
        
        for (const pending of pending7Digit) {
            if (dominantDigit) {
                const corrected = dominantDigit + pending;
                
                if (!seen.has(corrected)) {
                    seen.add(corrected);
                    results.autoCorrections.push({
                        original: pending,
                        corrected: corrected,
                        confidence: 'high',
                        reason: `Added leading '${dominantDigit}'`
                    });
                    results.accepted.push(corrected);
                    console.log(`  ✅ Auto-corrected: ${pending} → ${corrected}`);
                } else {
                    // The corrected value already exists
                    const existingCount = occurrenceCount[corrected] || 1;
                    results.duplicates.push({ 
                        value: corrected, 
                        count: existingCount + 1,
                        reason: `Corrected from ${pending}, already exists (now ${existingCount + 1} times)` 
                    });
                    results.duplicateCount++;
                    console.log(`  🔁 Corrected ${pending} → ${corrected} is duplicate`);
                }
            } else {
                // No pattern found - mark as needing review
                results.invalid.push({ 
                    value: pending, 
                    reason: '7 digits - needs manual review' 
                });
                console.log(`  ⚠️ Cannot auto-correct: ${pending} (no pattern)`);
            }
        }
    }
    
    // Add all accepted 8-digit notes
    results.accepted.push(...tempAccepted);
    
    // Add the duplicates found during extraction (from extractPotentialDeliveryNotes)
    // But only for 8-digit numbers that were accepted
    for (const dup of extractedDuplicates) {
        if (dup.value.length === 8 && seen.has(dup.value)) {
            // Check if this duplicate is not already in the list
            const alreadyAdded = results.duplicates.some(d => d.value === dup.value);
            if (!alreadyAdded) {
                results.duplicates.push(dup);
                results.duplicateCount += (dup.count - 1); // count - 1 because one is the original
            }
        }
    }
    
    // Final stats
    results.uniqueCount = new Set(results.accepted).size;
    
    console.log(`\n📊 VALIDATION RESULTS:`);
    console.log(`  ✅ Accepted: ${results.accepted.length}`);
    console.log(`  ⏭️ Excluded: ${results.excluded.length}`);
    console.log(`  ❌ Invalid: ${results.invalid.length}`);
    console.log(`  🔧 Auto-corrected: ${results.autoCorrections.length}`);
    console.log(`  🔁 Duplicates: ${results.duplicates.length} items (${results.duplicateCount} extra occurrences)`);
    
    return results;
}

// =============================================================================
// MAIN PDF PROCESSING
// =============================================================================

async function processPDF(fileData) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processing: ${fileData.name}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
        // Extract all text from PDF
        const { items, pageCount } = await extractAllTextFromPDF(fileData.file);
        
        if (items.length === 0) {
            throw new Error('Could not extract text from PDF. File may be scanned or protected.');
        }
        
        // Find all potential delivery notes (7-10 digit numbers)
        // Returns: { unique, duplicates, totalCount, occurrenceCount }
        const extractionResult = extractPotentialDeliveryNotes(items);
        
        // Validate and classify
        const results = validateDeliveryNotes(extractionResult);
        
        return {
            ...results,
            pageCount,
            rawCount: extractionResult.totalCount,
            uniqueRawCount: extractionResult.unique.length
        };
        
    } catch (error) {
        console.error('❌ Error processing PDF:', error);
        throw error;
    }
}

// =============================================================================
// EXCEL GENERATION
// =============================================================================

function generateExcel(deliveryNotes) {
    const wb = XLSX.utils.book_new();
    const uniqueNotes = [...new Set(deliveryNotes)];
    const data = uniqueNotes.map(note => [note]);
    
    if (data.length === 0) {
        data.push(['']);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }];
    
    XLSX.utils.book_append_sheet(wb, ws, 'DeliveryNotes');
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
}

// =============================================================================
// ZIP GENERATION
// =============================================================================

async function generateZip() {
    const zip = new JSZip();
    
    for (const [fileId, blob] of AppState.excelBlobs) {
        const fileData = AppState.files.get(fileId);
        if (fileData && fileData.status === 'done') {
            const excelName = Utils.getFileNameWithoutExtension(fileData.name) + '.xlsx';
            zip.file(excelName, blob);
        }
    }
    
    return await zip.generateAsync({ type: 'blob' });
}

// =============================================================================
// MODAL SYSTEM
// =============================================================================

function createModal() {
    const existingModal = document.getElementById('detailModal');
    if (existingModal) existingModal.remove();
    
    const modalHtml = `
        <div id="detailModal" class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-container" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 id="modalTitle">Details</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-search">
                    <input type="text" id="modalSearch" placeholder="Search..." onkeyup="filterModalContent()">
                    <span id="modalCount" class="modal-count">0 items</span>
                </div>
                <div class="modal-body" id="modalBody"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="exportModalContent()">📥 Export to CSV</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showModal(title, items, type) {
    createModal();
    
    const modal = document.getElementById('detailModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalCount').textContent = `${items.length} items`;
    
    modal.dataset.items = JSON.stringify(items);
    modal.dataset.type = type;
    modal.dataset.title = title;
    
    renderModalItems(items, type);
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function renderModalItems(items, type) {
    const modalBody = document.getElementById('modalBody');
    
    if (items.length === 0) {
        modalBody.innerHTML = '<div class="modal-empty">No items to display</div>';
        return;
    }
    
    let html = '<div class="modal-list">';
    
    for (const item of items.slice(0, 500)) {
        if (type === 'autocorrection') {
            html += `
                <div class="modal-item modal-item-correction">
                    <span class="modal-value original">${Utils.escapeHtml(item.original)}</span>
                    <span class="modal-arrow">→</span>
                    <span class="modal-value corrected">${Utils.escapeHtml(item.corrected)}</span>
                    <span class="modal-reason">${Utils.escapeHtml(item.reason)}</span>
                </div>`;
        } else if (type === 'duplicate') {
            // Special formatting for duplicates showing count
            const countBadge = item.count ? `<span class="duplicate-count">×${item.count}</span>` : '';
            html += `
                <div class="modal-item modal-item-duplicate">
                    <span class="modal-value">${Utils.escapeHtml(item.value)}</span>
                    ${countBadge}
                    <span class="modal-reason">${Utils.escapeHtml(item.reason)}</span>
                </div>`;
        } else if (typeof item === 'object') {
            html += `
                <div class="modal-item">
                    <span class="modal-value">${Utils.escapeHtml(item.value)}</span>
                    <span class="modal-reason">${Utils.escapeHtml(item.reason)}</span>
                </div>`;
        } else {
            html += `
                <div class="modal-item">
                    <span class="modal-value">${Utils.escapeHtml(item)}</span>
                </div>`;
        }
    }
    
    if (items.length > 500) {
        html += `<div class="modal-truncated">... and ${items.length - 500} more items</div>`;
    }
    
    html += '</div>';
    modalBody.innerHTML = html;
}

function filterModalContent() {
    const query = document.getElementById('modalSearch').value.toLowerCase();
    const modal = document.getElementById('detailModal');
    const items = JSON.parse(modal.dataset.items || '[]');
    const type = modal.dataset.type;
    
    const filtered = items.filter(item => {
        if (typeof item === 'object') {
            return Object.values(item).some(v => String(v).toLowerCase().includes(query));
        }
        return String(item).toLowerCase().includes(query);
    });
    
    document.getElementById('modalCount').textContent = `${filtered.length} of ${items.length} items`;
    renderModalItems(filtered, type);
}

function closeModal(event) {
    if (event && event.target.id !== 'detailModal') return;
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function exportModalContent() {
    const modal = document.getElementById('detailModal');
    const items = JSON.parse(modal.dataset.items || '[]');
    const title = modal.dataset.title || 'export';
    const type = modal.dataset.type;
    
    let csv = '';
    
    if (type === 'autocorrection') {
        csv = 'Original,Corrected,Reason\n';
        items.forEach(i => csv += `"${i.original}","${i.corrected}","${i.reason}"\n`);
    } else if (items.length > 0 && typeof items[0] === 'object') {
        csv = 'Value,Reason\n';
        items.forEach(i => csv += `"${i.value}","${i.reason}"\n`);
    } else {
        csv = 'Value\n';
        items.forEach(i => csv += `"${i}"\n`);
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, title.replace(/[^a-z0-9]/gi, '_') + '.csv');
}

// =============================================================================
// UI FUNCTIONS
// =============================================================================

function updateFileList() {
    const tableBody = document.getElementById('fileTableBody');
    const filesSection = document.getElementById('filesSection');
    const fileCount = document.getElementById('fileCount');
    const processAllBtn = document.getElementById('processAllBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    
    if (AppState.files.size === 0) {
        filesSection.style.display = 'none';
        return;
    }
    
    filesSection.style.display = 'block';
    fileCount.textContent = AppState.files.size;
    
    const hasPending = Array.from(AppState.files.values()).some(f => f.status === 'pending');
    const hasDone = Array.from(AppState.files.values()).some(f => f.status === 'done');
    
    processAllBtn.disabled = !hasPending || AppState.isProcessing;
    downloadAllBtn.disabled = !hasDone || AppState.isProcessing;
    
    let files = Array.from(AppState.files.entries());
    
    if (AppState.searchQuery) {
        const q = AppState.searchQuery.toLowerCase();
        files = files.filter(([_, f]) => f.name.toLowerCase().includes(q));
    }
    
    if (AppState.sortColumn) {
        files.sort((a, b) => {
            let va, vb;
            switch (AppState.sortColumn) {
                case 'name': va = a[1].name; vb = b[1].name; break;
                case 'size': va = a[1].size; vb = b[1].size; break;
                case 'accepted': va = a[1].results?.accepted?.length || 0; vb = b[1].results?.accepted?.length || 0; break;
                default: return 0;
            }
            if (va < vb) return AppState.sortDirection === 'asc' ? -1 : 1;
            if (va > vb) return AppState.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    tableBody.innerHTML = files.map(([fileId, fileData]) => createFileRow(fileId, fileData)).join('');
}

function createFileRow(fileId, fileData) {
    const r = fileData.results || {};
    
    const makeCell = (type, count, title) => {
        if (!count || count === 0) return '-';
        return `<button class="cell-link" onclick="showCellDetails('${fileId}','${type}','${Utils.escapeHtml(title)}')">${count}</button>`;
    };
    
    const statusBadge = {
        pending: '<span class="status-badge status-pending">⏳ Pending</span>',
        processing: '<span class="status-badge status-processing">⚙️ Processing</span>',
        done: '<span class="status-badge status-done">✅ Done</span>',
        error: `<span class="status-badge status-error">❌ Error</span>`
    }[fileData.status] || '';
    
    const actionBtn = {
        done: `<button class="btn btn-success btn-small" onclick="downloadExcel('${fileId}')">📥 Download</button>`,
        pending: `<button class="btn btn-primary btn-small" onclick="processFile('${fileId}')">⚙️ Process</button>`,
        error: `<button class="btn btn-secondary btn-small" onclick="processFile('${fileId}')">🔄 Retry</button>`,
        processing: '<span class="loading-indicator"><span class="spinner"></span></span>'
    }[fileData.status] || '-';
    
    const fileName = fileData.name.length > 25 ? fileData.name.slice(0, 22) + '...' : fileData.name;
    
    return `
        <tr id="row_${fileId}">
            <td title="${Utils.escapeHtml(fileData.name)}">${fileName}</td>
            <td>${Utils.formatFileSize(fileData.size)}</td>
            <td>${statusBadge}</td>
            <td class="num-accepted">${makeCell('accepted', r.accepted?.length, 'Accepted Delivery Notes')}</td>
            <td class="num-excluded">${makeCell('excluded', r.excluded?.length, 'Excluded (9-10 digits)')}</td>
            <td class="num-invalid">${makeCell('invalid', r.invalid?.length, 'Invalid Entries')}</td>
            <td class="num-duplicate">${makeCell('duplicate', r.duplicates?.length, 'Duplicates')}</td>
            <td class="num-corrected">${makeCell('autocorrection', r.autoCorrections?.length, 'Auto-Corrections')}</td>
            <td>${actionBtn}</td>
        </tr>
    `;
}

function showCellDetails(fileId, type, title) {
    const fileData = AppState.files.get(fileId);
    if (!fileData?.results) return;
    
    const items = {
        accepted: fileData.results.accepted,
        excluded: fileData.results.excluded,
        invalid: fileData.results.invalid,
        duplicate: fileData.results.duplicates,
        autocorrection: fileData.results.autoCorrections
    }[type] || [];
    
    showModal(`${title} - ${fileData.name}`, items, type);
}

function updateDashboard() {
    const dashboardSection = document.getElementById('dashboardSection');
    const errorsSection = document.getElementById('errorsSection');
    
    let totals = { files: 0, accepted: 0, excluded: 0, invalid: 0, duplicates: 0, corrections: 0 };
    const allData = { accepted: [], excluded: [], invalid: [], duplicates: [], autoCorrections: [] };
    
    for (const [_, fileData] of AppState.files) {
        if (fileData.status === 'done') totals.files++;
        if (fileData.results) {
            totals.accepted += fileData.results.accepted?.length || 0;
            totals.excluded += fileData.results.excluded?.length || 0;
            totals.invalid += fileData.results.invalid?.length || 0;
            totals.duplicates += fileData.results.duplicateCount || 0;
            totals.corrections += fileData.results.autoCorrections?.length || 0;
            
            allData.accepted.push(...(fileData.results.accepted || []));
            allData.excluded.push(...(fileData.results.excluded || []));
            allData.invalid.push(...(fileData.results.invalid || []));
            allData.duplicates.push(...(fileData.results.duplicates || []));
            allData.autoCorrections.push(...(fileData.results.autoCorrections || []));
        }
    }
    
    document.getElementById('totalFiles').textContent = AppState.files.size;
    document.getElementById('totalAccepted').textContent = totals.accepted;
    document.getElementById('totalExcluded').textContent = totals.excluded;
    document.getElementById('totalInvalid').textContent = totals.invalid;
    document.getElementById('totalDuplicates').textContent = totals.duplicates;
    document.getElementById('totalAutoCorrections').textContent = totals.corrections;
    
    window.globalData = allData;
    
    dashboardSection.style.display = totals.files > 0 ? 'block' : 'none';
    
    // Show files with issues
    const filesWithIssues = Array.from(AppState.files.values()).filter(f => 
        f.results && (f.results.invalid?.length > 0 || f.results.autoCorrections?.length > 0)
    );
    
    if (filesWithIssues.length > 0) {
        errorsSection.style.display = 'block';
        document.getElementById('errorsContainer').innerHTML = filesWithIssues.map(f => {
            let html = '';
            
            if (f.results.autoCorrections?.length > 0) {
                html += `
                    <div class="correction-card">
                        <div class="correction-card-header">
                            <span class="correction-card-title">🔧 ${Utils.escapeHtml(f.name)}</span>
                            <span class="badge badge-purple">${f.results.autoCorrections.length} auto-fixed</span>
                        </div>
                        <div class="correction-list">
                            ${f.results.autoCorrections.slice(0, 5).map(c => `
                                <div class="correction-item">
                                    <span class="correction-original">${c.original}</span>
                                    <span class="correction-arrow">→</span>
                                    <span class="correction-fixed">${c.corrected}</span>
                                </div>
                            `).join('')}
                            ${f.results.autoCorrections.length > 5 ? `<div class="more-items">+${f.results.autoCorrections.length - 5} more</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            if (f.results.invalid?.length > 0) {
                html += `
                    <div class="error-card">
                        <div class="error-card-header">
                            <span class="error-card-title">⚠️ ${Utils.escapeHtml(f.name)}</span>
                            <span class="badge badge-red">${f.results.invalid.length} need review</span>
                        </div>
                        <div class="error-list">
                            ${f.results.invalid.slice(0, 5).map(e => `
                                <div class="error-item">
                                    <span class="error-value">${Utils.escapeHtml(e.value)}</span>
                                    <span class="error-reason">${Utils.escapeHtml(e.reason)}</span>
                                </div>
                            `).join('')}
                            ${f.results.invalid.length > 5 ? `<div class="more-items">+${f.results.invalid.length - 5} more</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            return html;
        }).join('');
    } else {
        errorsSection.style.display = 'none';
    }
}

function updateProgress(current, total) {
    const progressDiv = document.getElementById('globalProgress');
    
    if (total === 0) {
        progressDiv.style.display = 'none';
        return;
    }
    
    progressDiv.style.display = 'block';
    const pct = Math.round((current / total) * 100);
    
    document.getElementById('progressText').textContent = `Processing: ${current} / ${total}`;
    document.getElementById('progressPercent').textContent = `${pct}%`;
    document.getElementById('progressFill').style.width = `${pct}%`;
    
    if (current === total) {
        setTimeout(() => progressDiv.style.display = 'none', 2000);
    }
}

// =============================================================================
// NOTIFICATION SYSTEM
// =============================================================================

function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${Utils.escapeHtml(message)}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function handleFilesAdded(files) {
    const pdfFiles = Array.from(files).filter(f => 
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length === 0) {
        showNotification('Please select valid PDF files.', 'warning');
        return;
    }
    
    if (AppState.files.size + pdfFiles.length > CONFIG.MAX_FILES) {
        showNotification(`Maximum ${CONFIG.MAX_FILES} files allowed.`, 'warning');
        return;
    }
    
    for (const file of pdfFiles) {
        const fileId = Utils.generateId();
        AppState.files.set(fileId, {
            id: fileId,
            file: file,
            name: file.name,
            size: file.size,
            status: 'pending',
            error: null,
            results: null
        });
    }
    
    updateFileList();
    showNotification(`Added ${pdfFiles.length} file(s)`, 'success');
}

async function processFile(fileId) {
    const fileData = AppState.files.get(fileId);
    if (!fileData) return;
    
    try {
        fileData.status = 'processing';
        fileData.error = null;
        updateFileList();
        
        const results = await processPDF(fileData);
        fileData.status = 'done';
        fileData.results = results;
        
        const excelBlob = generateExcel([...new Set(results.accepted)]);
        AppState.excelBlobs.set(fileId, excelBlob);
        
    } catch (error) {
        fileData.status = 'error';
        fileData.error = error.message || 'Unknown error';
        console.error('Processing error:', error);
    }
    
    updateFileList();
    updateDashboard();
}

async function processAllFiles() {
    if (AppState.isProcessing) return;
    
    AppState.isProcessing = true;
    const pending = Array.from(AppState.files.entries())
        .filter(([_, f]) => f.status === 'pending' || f.status === 'error');
    
    const total = pending.length;
    let processed = 0;
    
    updateProgress(0, total);
    document.getElementById('processAllBtn').disabled = true;
    
    for (const [fileId] of pending) {
        await processFile(fileId);
        processed++;
        updateProgress(processed, total);
    }
    
    AppState.isProcessing = false;
    updateFileList();
    showNotification(`Processed ${processed} file(s)!`, 'success');
}

function downloadExcel(fileId) {
    const blob = AppState.excelBlobs.get(fileId);
    const fileData = AppState.files.get(fileId);
    
    if (blob && fileData) {
        saveAs(blob, Utils.getFileNameWithoutExtension(fileData.name) + '.xlsx');
    }
}

async function downloadAllAsZip() {
    if (AppState.excelBlobs.size === 0) {
        showNotification('No processed files available.', 'warning');
        return;
    }
    
    try {
        const btn = document.getElementById('downloadAllBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Generating...';
        
        const zipBlob = await generateZip();
        saveAs(zipBlob, `delivery_notes_${Utils.formatTimestamp()}.zip`);
        
        btn.disabled = false;
        btn.innerHTML = '📥 Download All (ZIP)';
        showNotification('ZIP generated!', 'success');
        
    } catch (error) {
        console.error('ZIP error:', error);
        showNotification('Error generating ZIP.', 'error');
        
        const btn = document.getElementById('downloadAllBtn');
        btn.disabled = false;
        btn.innerHTML = '📥 Download All (ZIP)';
    }
}

function clearAllFiles() {
    if (AppState.isProcessing) {
        showNotification('Please wait for processing to complete.', 'warning');
        return;
    }
    
    if (confirm('Clear all files?')) {
        AppState.files.clear();
        AppState.excelBlobs.clear();
        updateFileList();
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('errorsSection').style.display = 'none';
        showNotification('All files cleared.', 'info');
    }
}

function showGlobalDetails(type) {
    if (!window.globalData) return;
    
    const mapping = {
        accepted: ['All Accepted Delivery Notes', window.globalData.accepted, 'accepted'],
        excluded: ['All Excluded (9-10 digits)', window.globalData.excluded, 'excluded'],
        invalid: ['All Invalid Entries', window.globalData.invalid, 'invalid'],
        duplicates: ['All Duplicates', window.globalData.duplicates, 'duplicate'],
        autocorrections: ['All Auto-Corrections', window.globalData.autoCorrections, 'autocorrection']
    };
    
    const [title, items, modalType] = mapping[type] || [];
    if (items && items.length > 0) {
        showModal(title, items, modalType);
    }
}

function exportSummaryReport() {
    let report = `DELIVERY NOTE EXTRACTOR - SUMMARY REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `App Version: 7.0 (Robust Extraction)\n\n`;
    report += `${'='.repeat(50)}\nSTATISTICS\n${'='.repeat(50)}\n`;
    
    let totals = { accepted: 0, excluded: 0, invalid: 0, duplicates: 0, corrections: 0 };
    
    for (const [_, f] of AppState.files) {
        if (f.results) {
            totals.accepted += f.results.accepted?.length || 0;
            totals.excluded += f.results.excluded?.length || 0;
            totals.invalid += f.results.invalid?.length || 0;
            totals.duplicates += f.results.duplicateCount || 0;
            totals.corrections += f.results.autoCorrections?.length || 0;
        }
    }
    
    report += `Total Files: ${AppState.files.size}\n`;
    report += `Accepted (8 digits): ${totals.accepted}\n`;
    report += `Excluded (9-10 digits): ${totals.excluded}\n`;
    report += `Invalid: ${totals.invalid}\n`;
    report += `Duplicates: ${totals.duplicates}\n`;
    report += `Auto-Corrections: ${totals.corrections}\n\n`;
    
    report += `${'='.repeat(50)}\nFILE DETAILS\n${'='.repeat(50)}\n`;
    
    for (const [_, f] of AppState.files) {
        report += `\n${f.name}\n  Status: ${f.status}\n`;
        if (f.results) {
            report += `  Accepted: ${f.results.accepted?.length || 0}\n`;
            report += `  Excluded: ${f.results.excluded?.length || 0}\n`;
            report += `  Invalid: ${f.results.invalid?.length || 0}\n`;
            report += `  Duplicates: ${f.results.duplicateCount || 0}\n`;
            report += `  Auto-Corrections: ${f.results.autoCorrections?.length || 0}\n`;
        }
    }
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    saveAs(blob, `summary_${Utils.formatTimestamp()}.txt`);
    showNotification('Report exported!', 'success');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function checkLibraries() {
    const status = document.getElementById('libraryStatus');
    
    if (typeof pdfjsLib === 'undefined' || typeof XLSX === 'undefined' || 
        typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
        status.style.display = 'block';
        return false;
    }
    
    status.style.display = 'none';
    return true;
}

function initEventListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    
    selectFilesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    });
    
    dropZone.addEventListener('click', (e) => {
        if (e.target !== selectFilesBtn && !selectFilesBtn.contains(e.target)) {
            fileInput.click();
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFilesAdded(e.target.files);
            e.target.value = '';
        }
    });
    
    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFilesAdded(e.dataTransfer.files);
        }
    });
    
    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => e.preventDefault());
    
    // Buttons
    document.getElementById('processAllBtn').addEventListener('click', processAllFiles);
    document.getElementById('downloadAllBtn').addEventListener('click', downloadAllAsZip);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllFiles);
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            AppState.searchQuery = e.target.value;
            updateFileList();
        });
    }
    
    const exportBtn = document.getElementById('exportReportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSummaryReport);
    }
    
    // Sort headers
    document.querySelectorAll('.files-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (AppState.sortColumn === col) {
                AppState.sortDirection = AppState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                AppState.sortColumn = col;
                AppState.sortDirection = 'asc';
            }
            updateFileList();
        });
    });
    
    // Dashboard card clicks
    document.querySelectorAll('.stat-card[data-type]').forEach(card => {
        card.addEventListener('click', () => showGlobalDetails(card.dataset.type));
    });
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function init() {
    setTimeout(() => {
        if (checkLibraries()) {
            console.log('✅ Libraries loaded');
        } else {
            console.error('❌ Missing libraries');
        }
    }, 1000);
    
    initEventListeners();
    console.log('🚀 Delivery Note Extractor v7.0 (Robust Extraction) initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// =============================================================================
// GLOBAL EXPORTS
// =============================================================================

window.processFile = processFile;
window.downloadExcel = downloadExcel;
window.processAllFiles = processAllFiles;
window.downloadAllAsZip = downloadAllAsZip;
window.clearAllFiles = clearAllFiles;
window.showCellDetails = showCellDetails;
window.showGlobalDetails = showGlobalDetails;
window.closeModal = closeModal;
window.filterModalContent = filterModalContent;
window.exportModalContent = exportModalContent;
window.exportSummaryReport = exportSummaryReport;

// =============================================================================
// AUTOMATED TESTS (Run in console with: runTests())
// =============================================================================

window.runTests = function() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 RUNNING AUTOMATED TESTS');
    console.log('='.repeat(60) + '\n');
    
    let passed = 0;
    let failed = 0;
    
    function test(name, fn) {
        try {
            fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (e) {
            console.error(`❌ FAIL: ${name}`);
            console.error(`   Error: ${e.message}`);
            failed++;
        }
    }
    
    function assertEqual(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error(`${msg}: expected ${expected}, got ${actual}`);
        }
    }
    
    function assertArrayEqual(actual, expected, msg) {
        if (JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) {
            throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }
    
    // Test 1: 8-digit validation
    test('8-digit number should be ACCEPTED', () => {
        const result = validateDeliveryNotes(['26996798']);
        assertEqual(result.accepted.length, 1, 'Accepted count');
        assertEqual(result.accepted[0], '26996798', 'Accepted value');
        assertEqual(result.excluded.length, 0, 'Excluded count');
        assertEqual(result.invalid.length, 0, 'Invalid count');
    });
    
    // Test 2: Multiple 8-digit numbers
    test('Multiple 8-digit numbers should all be ACCEPTED', () => {
        const result = validateDeliveryNotes(['26996798', '27008029', '27005099', '27010223']);
        assertEqual(result.accepted.length, 4, 'Accepted count');
        assertEqual(result.excluded.length, 0, 'Excluded count');
    });
    
    // Test 3: 9-digit number should be EXCLUDED
    test('9-digit number should be EXCLUDED', () => {
        const result = validateDeliveryNotes(['123456789']);
        assertEqual(result.accepted.length, 0, 'Accepted count');
        assertEqual(result.excluded.length, 1, 'Excluded count');
    });
    
    // Test 4: 10-digit number should be EXCLUDED
    test('10-digit number should be EXCLUDED', () => {
        const result = validateDeliveryNotes(['1234567890']);
        assertEqual(result.accepted.length, 0, 'Accepted count');
        assertEqual(result.excluded.length, 1, 'Excluded count');
    });
    
    // Test 5: 7-digit with pattern should be AUTO-CORRECTED
    test('7-digit with 8-digit pattern should be AUTO-CORRECTED', () => {
        // First pass: 8-digit notes establish pattern (start with 2)
        const result = validateDeliveryNotes(['26996798', '27008029', '7180890']);
        // 7180890 should be corrected to 27180890
        assertEqual(result.autoCorrections.length, 1, 'Auto-corrections count');
        assertEqual(result.autoCorrections[0].original, '7180890', 'Original value');
        assertEqual(result.autoCorrections[0].corrected, '27180890', 'Corrected value');
    });
    
    // Test 6: 7-digit without pattern should be INVALID
    test('7-digit without pattern should be INVALID (needs review)', () => {
        const result = validateDeliveryNotes(['7180890']); // No 8-digit notes to establish pattern
        assertEqual(result.invalid.length, 1, 'Invalid count');
        assertEqual(result.autoCorrections.length, 0, 'Auto-corrections count');
    });
    
    // Test 7: Duplicates should be detected
    test('Duplicate 8-digit numbers should be detected', () => {
        const result = validateDeliveryNotes(['26996798', '26996798', '27008029']);
        assertEqual(result.accepted.length, 2, 'Accepted count (unique)');
        assertEqual(result.duplicateCount, 1, 'Duplicate count');
    });
    
    // Test 8: Mixed input
    test('Mixed input should be classified correctly', () => {
        const result = validateDeliveryNotes([
            '26996798',  // 8 digits - accept
            '27008029',  // 8 digits - accept
            '123456789', // 9 digits - exclude
            '1234567890',// 10 digits - exclude
            '7180890',   // 7 digits - auto-correct (pattern from above)
            '12345'      // 5 digits - invalid
        ]);
        assertEqual(result.accepted.length, 3, 'Accepted count (2 + 1 corrected)');
        assertEqual(result.excluded.length, 2, 'Excluded count');
        assertEqual(result.invalid.length, 1, 'Invalid count');
        assertEqual(result.autoCorrections.length, 1, 'Auto-corrections count');
    });
    
    // Test 9: extractPotentialDeliveryNotes filters correctly
    test('extractPotentialDeliveryNotes should only return 7-10 digit pure numbers', () => {
        const items = [
            { text: '26996798', pageNum: 1 },      // Valid 8-digit
            { text: '21/02/2025', pageNum: 1 },    // Date - should be ignored
            { text: '360.0', pageNum: 1 },         // Decimal - should be ignored
            { text: '180222866R', pageNum: 1 },    // Alphanumeric - should be ignored
            { text: 'POMPE VIDE', pageNum: 1 },    // Text - should be ignored
            { text: '7180890', pageNum: 1 },       // Valid 7-digit
        ];
        const result = extractPotentialDeliveryNotes(items);
        assertEqual(result.length, 2, 'Should only extract 2 valid candidates');
        assertEqual(result.includes('26996798'), true, 'Should include 8-digit');
        assertEqual(result.includes('7180890'), true, 'Should include 7-digit');
    });
    
    // Test 10: Real PDF values from screenshots
    test('Real PDF delivery notes should be ACCEPTED', () => {
        const realValues = [
            '26996798', '27008029', '27005099', '27010223', 
            '27018035', '27016500', '27023343', '27031367',
            '27028952', '27028838', '27043970'
        ];
        const result = validateDeliveryNotes(realValues);
        assertEqual(result.accepted.length, 11, 'All 11 real values should be accepted');
        assertEqual(result.excluded.length, 0, 'None should be excluded');
        assertEqual(result.invalid.length, 0, 'None should be invalid');
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60) + '\n');
    
    return { passed, failed };
};

// Run tests automatically if in development
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    setTimeout(() => {
        console.log('💡 Run tests with: runTests()');
    }, 2000);
}
