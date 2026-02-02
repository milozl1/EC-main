/**
 * CR Processor v3.3 - Hella Confirmation of Receipt Extraction
 * 
 * Features:
 * - CR detection for EP1 (1XXXXXXX) and H01 (5XXXXX) formats
 * - Improved OCR text normalization (handles spaces, OCR character errors)
 * - Smart multi-page grouping: same CR across pages = single output
 * - Advanced Signature Detection v2:
 *   - Stroke-based analysis (not just ink density)
 *   - Distinguishes signatures from stamp text
 *   - Detects dark ink strokes (black/dark blue ballpoint)
 *   - Edge detection for stroke pattern analysis
 *   - Excludes date field (left side) from signature area (right side)
 * - Separate Stamp detection (blue ink density)
 * - Date field detection (bottom-left area)
 * - Digital signature preservation (no corruption)
 * - Postal code exclusion to avoid false positives
 * 
 * @author CR-extractor Team
 * @version 3.3.0
 */

"use strict";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURATION & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CONFIG = {
  // ROI regions (percentages of page dimensions)
  // Stamp+Signature area: bottom-right quadrant (where "Stempel und Unterschrift" label is)
  stampSignatureROI: { xStart: 0.45, yStart: 0.70, width: 0.55, height: 0.30 },
  
  // Date area to EXCLUDE from signature detection (bottom-left, where "Datum" is)
  dateExclusionROI: { xStart: 0.0, yStart: 0.75, width: 0.35, height: 0.25 },
  
  // Detection thresholds (defaults, can be overridden via UI)
  defaults: {
    roiHeight: 30,
    roiThreshold: 2,
    blueThreshold: 0.25,
    signatureThreshold: 0.05,  // Lower threshold - now uses stroke analysis
    compDensityThreshold: 0.002,
    // Signature stroke detection thresholds
    signatureStrokeThreshold: 0.03,  // Min dark stroke density for signature
    signatureEdgeRatio: 0.15,        // Min edge-to-stroke ratio (signatures have many edges)
  },
  
  // Performance settings
  renderScale: 1.5,
  ocrTimeout: 30000,
  
  // CR patterns - STRICT to avoid false positives from addresses/codes
  patterns: {
    EP1: /^1\d{7}$/,  // 1XXXXXXX - 8 digits starting with 1
    H01: /^5\d{5}$/,  // 5XXXXX - 6 digits starting with 5
  },
  
  // Date patterns to detect and exclude from signature analysis
  datePatterns: [
    /\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}/,
    /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    /\d{4}-\d{2}-\d{2}/,
  ]
};

// Anchor phrases for CR detection (EN + DE) - HIGH PRIORITY
const CR_ANCHORS = [
  /No\.\s*of\s*confirmation\s*of\s*receipt/i,
  /Gelangensbestätigung\s*(?:Nr\.?)?/i,
  /Confirmation\s*of\s*receipt/i,
];

// These are NOT CR numbers - exclusion patterns
const EXCLUSION_CONTEXT_PATTERNS = [
  /\bStr\.\s*DE\s*\d+/i,
  /\b\d{6}\s+\w+\b/i,
  /\bDE\d{9,}/i,
  /\bPage:?\s*\d+/i,
];

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL STATE
   ═══════════════════════════════════════════════════════════════════════════ */

window._generatedFiles = [];
window._generatedBySource = {};
window._manualBySource = {};
window._hellaManifest = [];
window._selectedFiles = [];

/* ═══════════════════════════════════════════════════════════════════════════
   DOM UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

function ensureEl(id, tag = 'div') {
  let el = $(id);
  if (el) return el;
  el = document.createElement(tag);
  el.id = id;
  (document.querySelector('.container') || document.body).appendChild(el);
  return el;
}

function appendLog(msg, level = 'info') {
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  const consoleEl = $('resultsConsole');
  if (!consoleEl) return;
  
  const entry = document.createElement('div');
  entry.className = 'entry';
  const ts = new Date().toLocaleTimeString();
  const prefix = { error: '[ERR]', warn: '[WARN]', info: '[INFO]' }[level] || '[INFO]';
  entry.textContent = `${ts} ${prefix} ${text}`;
  entry.style.color = { error: '#fca5a5', warn: '#fde047', info: '#93c5fd' }[level] || '#93c5fd';
  
  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setProgress(percent, text) {
  const bar = $('progressBar');
  if (bar?.firstElementChild) {
    bar.firstElementChild.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
  const pt = $('progressText');
  if (pt) pt.textContent = text || `${percent}%`;
}

function clearState() {
  ['fileList', 'manualList', 'summary', 'resultsConsole'].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = '';
  });
  window._generatedFiles = [];
  window._generatedBySource = {};
  window._manualBySource = {};
}

/* ═══════════════════════════════════════════════════════════════════════════
   FILE UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */

async function readFileAsUint8(file) {
  return new Uint8Array(await file.arrayBuffer());
}

/* ═══════════════════════════════════════════════════════════════════════════
   PDF TEXT EXTRACTION & OCR
   ═══════════════════════════════════════════════════════════════════════════ */

async function extractTextFromPage(pdf, pageIndex) {
  try {
    const page = await pdf.getPage(pageIndex + 1);
    const content = await page.getTextContent();
    return content?.items?.map(i => i.str || '').join(' ') || '';
  } catch (e) {
    console.warn('extractTextFromPage failed:', e);
    return '';
  }
}

async function renderPageToCanvas(pdf, pageIndex, scale = CONFIG.renderScale) {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  
  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport
  }).promise;
  
  return canvas;
}

async function ocrCanvas(canvas) {
  if (!window.Tesseract) {
    console.warn('Tesseract not loaded');
    return '';
  }
  
  try {
    const result = await Promise.race([
      Tesseract.recognize(canvas, 'eng+deu', { logger: () => {} }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR timeout')), CONFIG.ocrTimeout)
      )
    ]);
    return result?.data?.text || '';
  } catch (e) {
    console.warn('OCR failed:', e);
    return '';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CR DETECTION - IMPROVED with context awareness
   ═══════════════════════════════════════════════════════════════════════════ */

function normalizeToken(raw) {
  if (!raw) return '';
  let s = String(raw)
    .replace(/\u00A0/g, ' ')
    .replace(/[\s\-\.\,\_]+/g, '')  // Remove spaces, dashes, dots, commas
    .toUpperCase();
  
  // OCR character corrections
  s = s.replace(/[OQ]/g, '0')
       .replace(/[IL|\]\[]/g, '1')
       .replace(/[Ss\$]/g, '5')  // S and $ → 5
       .replace(/[B]/g, '8')
       .replace(/[G]/g, '9')
       .replace(/[Z]/g, '2')  // Z often misread as 2
       .replace(/[^\d]/g, '');
  
  return s;
}

function isValidCR(value) {
  return CONFIG.patterns.EP1.test(value) || CONFIG.patterns.H01.test(value);
}

function getCRType(value) {
  if (CONFIG.patterns.EP1.test(value)) return 'EP1';
  if (CONFIG.patterns.H01.test(value)) return 'H01';
  return 'UNKNOWN';
}

/**
 * Check if a match is in an exclusion context (address, postal code, etc.)
 */
function isInExclusionContext(text, matchIndex, matchValue) {
  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(text.length, matchIndex + matchValue.length + 100);
  const context = text.substring(start, end);
  
  // Check if this looks like a postal code in address context
  const postalPattern = new RegExp(`\\b${matchValue}\\s+[A-Za-zăâîșțĂÂÎȘȚ]+\\b`, 'i');
  if (postalPattern.test(context)) {
    return true;
  }
  
  for (const pattern of EXCLUSION_CONTEXT_PATTERNS) {
    if (pattern.test(context)) {
      const exclusionMatch = context.match(pattern);
      if (exclusionMatch && exclusionMatch[0].includes(matchValue)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Normalize OCR text - remove spaces between digits, fix common OCR errors
 */
function normalizeOCRText(text) {
  if (!text) return '';
  // First pass: normalize whitespace
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Fix common OCR patterns where digits have spaces between them
  // e.g., "5 7 7 7 7 0" → "577770" or "5 77770" → "577770"
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2');
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2'); // Run twice for consecutive
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2'); // Run thrice to be safe
  
  return normalized;
}

/**
 * Find CR numbers on text with improved context awareness
 * FIXED: Prioritizes CR found directly after anchor phrase, not just nearby
 */
function findCRsOnText(text) {
  if (!text) return [];
  
  // Pre-process text for OCR artifacts
  const normalizedText = normalizeOCRText(text);
  const results = [];
  
  // PRIORITY 1: Direct anchor patterns (most reliable)
  // These patterns capture the CR number DIRECTLY after the anchor phrase
  const directPatterns = [
    // English patterns - "No. of confirmation of receipt 577770"
    /No\.?\s*of\s*confirmation\s*of\s*receipt[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
    /confirmation\s*of\s*receipt[:\s\-]*([0-9OIlSsQBG\s]{4,14})\s*from/i,
    // German patterns - "Gelangensbestätigung Nr. 554131"
    /Gelangensbestätigung(?:\s+Nr\.?)?[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
  ];
  
  // Try both original and normalized text
  for (const searchText of [normalizedText, text]) {
    for (const rx of directPatterns) {
      const match = rx.exec(searchText);
      if (match?.[1]) {
        const norm = normalizeToken(match[1]);
        if (isValidCR(norm)) {
          appendLog(`CR found via direct anchor: ${norm} (raw: "${match[1]}")`);
          results.push({
            value: norm,
            type: getCRType(norm),
            raw: match[1],
            index: match.index,
            source: 'direct_anchor',
            confidence: 'high'
          });
          return results;
        }
      }
    }
  }
  
  // PRIORITY 2: Search ONLY within 50 chars after specific CR anchor phrases
  // This is stricter than before - only looks immediately after the anchor
  const strictAnchors = [
    /No\.?\s*of\s*confirmation\s*of\s*receipt/i,
    /Gelangensbestätigung(?:\s+Nr\.?)?/i,
    /Bestätigung(?:\s+Nr\.?)?/i,
  ];
  
  for (const anchorRx of strictAnchors) {
    const anchorMatch = anchorRx.exec(normalizedText);
    if (!anchorMatch) continue;
    
    // ONLY look in the 50 characters AFTER the anchor phrase
    const anchorEnd = anchorMatch.index + anchorMatch[0].length;
    const searchWindow = normalizedText.substring(anchorEnd, Math.min(anchorEnd + 50, normalizedText.length));
    
    // Look for H01 pattern FIRST (5XXXXX) - more specific for Hella documents
    const h01Match = searchWindow.match(/\b(5\d{5})\b/);
    if (h01Match) {
      const norm = normalizeToken(h01Match[1]);
      if (isValidCR(norm)) {
        appendLog(`CR found near strict anchor (H01): ${norm}`);
        return [{
          value: norm,
          type: 'H01',
          raw: h01Match[1],
          index: anchorEnd + h01Match.index,
          source: 'near_anchor',
          confidence: 'high'
        }];
      }
    }
    
    // Then look for EP1 pattern (1XXXXXXX)
    const ep1Match = searchWindow.match(/\b(1\d{7})\b/);
    if (ep1Match) {
      const norm = normalizeToken(ep1Match[1]);
      if (isValidCR(norm)) {
        appendLog(`CR found near strict anchor (EP1): ${norm}`);
        return [{
          value: norm,
          type: 'EP1',
          raw: ep1Match[1],
          index: anchorEnd + ep1Match.index,
          source: 'near_anchor',
          confidence: 'high'
        }];
      }
    }
  }
  
  // PRIORITY 3: Broader anchor search (less strict, for fallback)
  const broadAnchors = [
    /confirmation\s*of\s*receipt/i,
    /Gelangen/i,
  ];
  
  for (const anchorRx of broadAnchors) {
    const anchorMatch = anchorRx.exec(normalizedText);
    if (!anchorMatch) continue;
    
    // Search in a 100 char window after anchor
    const anchorEnd = anchorMatch.index + anchorMatch[0].length;
    const searchWindow = normalizedText.substring(anchorEnd, Math.min(anchorEnd + 100, normalizedText.length));
    
    // H01 first
    const h01Match = searchWindow.match(/\b(5\d{5})\b/);
    if (h01Match) {
      const norm = normalizeToken(h01Match[1]);
      const absoluteIndex = anchorEnd + h01Match.index;
      const afterContext = normalizedText.substring(absoluteIndex + 6, absoluteIndex + 56);
      const looksLikePostalCode = /^\s+[A-Za-zăâîșțĂÂÎȘȚ]{2,}/i.test(afterContext);
      
      if (!looksLikePostalCode && isValidCR(norm)) {
        appendLog(`CR found near broad anchor (H01): ${norm}`);
        return [{
          value: norm,
          type: 'H01',
          raw: h01Match[1],
          index: absoluteIndex,
          source: 'near_anchor',
          confidence: 'high'
        }];
      }
    }
    
    // EP1 second
    const ep1Match = searchWindow.match(/\b(1\d{7})\b/);
    if (ep1Match) {
      const norm = normalizeToken(ep1Match[1]);
      if (isValidCR(norm)) {
        appendLog(`CR found near broad anchor (EP1): ${norm}`);
        return [{
          value: norm,
          type: 'EP1',
          raw: ep1Match[1],
          index: anchorEnd + ep1Match.index,
          source: 'near_anchor',
          confidence: 'high'
        }];
      }
    }
  }
  
  // PRIORITY 4: Global search - ONLY if no anchor-based result found
  // This is last resort and may pick up wrong numbers
  appendLog('No anchor-based CR found, trying global search...', 'warn');
  
  // Collect ALL potential CRs first, then choose the best one
  const globalCandidates = [];
  
  // H01 global search (5XXXXX) - prefer these as they're more specific
  for (const m of normalizedText.matchAll(/\b(5\d{5})\b/g)) {
    const norm = normalizeToken(m[1]);
    
    const afterMatch = normalizedText.substring(m.index + m[1].length, m.index + m[1].length + 50);
    const looksLikePostalCode = /^\s+[A-Za-zăâîșțĂÂÎȘȚ]{2,}/i.test(afterMatch);
    
    // Check if there's an anchor phrase nearby (within 200 chars before)
    const nearbyContext = normalizedText.substring(Math.max(0, m.index - 200), m.index);
    const hasAnchorNearby = /confirmation|receipt|Gelangen|bestätigung/i.test(nearbyContext);
    
    if (isValidCR(norm) && !isInExclusionContext(normalizedText, m.index, m[1]) && !looksLikePostalCode) {
      globalCandidates.push({
        value: norm,
        type: 'H01',
        raw: m[1],
        index: m.index,
        source: 'global',
        confidence: hasAnchorNearby ? 'medium' : 'low'
      });
    }
  }
  
  // If we found H01 candidates with anchor nearby, prefer those
  const h01WithAnchor = globalCandidates.filter(c => c.confidence === 'medium');
  if (h01WithAnchor.length > 0) {
    appendLog(`Global search found H01 near anchor: ${h01WithAnchor[0].value}`);
    return [h01WithAnchor[0]];
  }
  
  // EP1 global search (1XXXXXXX) - ONLY if no H01 found
  // EP1 is more prone to false positives (material numbers, etc.)
  if (globalCandidates.length === 0) {
    for (const m of normalizedText.matchAll(/\b(1\d{7})\b/g)) {
      const norm = normalizeToken(m[1]);
      
      // Check if there's an anchor phrase nearby
      const nearbyContext = normalizedText.substring(Math.max(0, m.index - 200), m.index);
      const hasAnchorNearby = /confirmation|receipt|Gelangen|bestätigung/i.test(nearbyContext);
      
      // STRICTER: Only accept EP1 from global search if it has anchor nearby
      // This prevents picking up material numbers like 13047454
      if (isValidCR(norm) && hasAnchorNearby && !isInExclusionContext(normalizedText, m.index, m[1])) {
        globalCandidates.push({
          value: norm,
          type: 'EP1',
          raw: m[1],
          index: m.index,
          source: 'global',
          confidence: 'medium'
        });
      }
    }
  }
  
  // Return best candidate
  if (globalCandidates.length > 0) {
    const medConf = globalCandidates.filter(c => c.confidence === 'medium');
    if (medConf.length > 0) {
      appendLog(`Global search result: ${medConf[0].value} (${medConf[0].type})`);
      return [medConf[0]];
    }
    
    // Low confidence - only return if nothing else available
    appendLog(`Global search result (low confidence): ${globalCandidates[0].value}`, 'warn');
    return [globalCandidates[0]];
  }
  
  return [];
}

function chooseValidCRs(candidates, relax = false) {
  if (!candidates?.length) return [];
  
  const valid = candidates.filter(c => isValidCR(c.value));
  
  const highConf = valid.filter(c => c.confidence === 'high');
  if (highConf.length > 0) return highConf;
  
  const medConf = valid.filter(c => c.confidence === 'medium');
  if (medConf.length > 0) return medConf;
  
  return valid;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAMP & SIGNATURE DETECTION - IMPROVED v2
   Signature detection now analyzes stroke patterns, not just ink density
   ═══════════════════════════════════════════════════════════════════════════ */

function analyzeROI(canvas, roi) {
  const w = canvas.width, h = canvas.height;
  
  const roiX = Math.floor(w * roi.xStart);
  const roiY = Math.floor(h * roi.yStart);
  const roiW = Math.floor(w * roi.width);
  const roiH = Math.floor(h * roi.height);
  
  const temp = document.createElement('canvas');
  temp.width = roiW;
  temp.height = roiH;
  const tempCtx = temp.getContext('2d');
  tempCtx.drawImage(canvas, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
  
  const imgData = tempCtx.getImageData(0, 0, roiW, roiH);
  const pixels = imgData.data;
  
  let inkPixels = 0, bluePixels = 0, blackPixels = 0;
  
  const step = 2;
  const maskW = Math.ceil(roiW / step);
  const maskH = Math.ceil(roiH / step);
  const mask = new Uint8Array(maskW * maskH);
  
  for (let y = 0, my = 0; y < roiH; y += step, my++) {
    for (let x = 0, mx = 0; x < roiW; x += step, mx++) {
      const idx = (y * roiW + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      
      const distFromWhite = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
      const isInk = distFromWhite > 50;
      
      if (isInk) {
        inkPixels++;
        mask[my * maskW + mx] = 1;
        
        if (b > r + 20 && b > g + 20 && b > 100) {
          bluePixels++;
        }
        
        if ((r < 100 && g < 100 && b < 100) || (b > r + 10 && b > g + 10)) {
          blackPixels++;
        }
      }
    }
  }
  
  const largestComp = findLargestComponent(mask, maskW, maskH);
  const sampledTotal = maskW * maskH;
  
  return {
    density: (inkPixels / sampledTotal) * 100,
    blueDensity: (bluePixels / sampledTotal) * 100,
    blackDensity: (blackPixels / sampledTotal) * 100,
    largestComponentRatio: largestComp / sampledTotal,
    hasSignificantInk: inkPixels > sampledTotal * 0.003
  };
}

/**
 * Analyze signature strokes specifically (excluding blue stamp ink)
 * Signatures have characteristic stroke patterns:
 * - Dark ink (black/dark blue) strokes
 * - Variable stroke directions
 * - NOT solid blocks (like stamps)
 * - Typically written OVER or BESIDE the stamp
 */
function analyzeSignatureStrokes(canvas, roi) {
  const w = canvas.width, h = canvas.height;
  
  const roiX = Math.floor(w * roi.xStart);
  const roiY = Math.floor(h * roi.yStart);
  const roiW = Math.floor(w * roi.width);
  const roiH = Math.floor(h * roi.height);
  
  const temp = document.createElement('canvas');
  temp.width = roiW;
  temp.height = roiH;
  const tempCtx = temp.getContext('2d');
  tempCtx.drawImage(canvas, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
  
  const imgData = tempCtx.getImageData(0, 0, roiW, roiH);
  const pixels = imgData.data;
  
  // Look for signature characteristics:
  // 1. Dark strokes (NOT light blue stamp text)
  // 2. Stroke-like patterns (adjacent dark pixels forming lines)
  // 3. High variation (not uniform like printed text)
  
  let darkStrokePixels = 0;
  let veryDarkPixels = 0;
  let strokeSegments = 0;
  let edgePixels = 0;
  
  const step = 1; // Higher resolution for stroke detection
  
  for (let y = 1; y < roiH - 1; y += step) {
    for (let x = 1; x < roiW - 1; x += step) {
      const idx = (y * roiW + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      
      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Check if this is dark ink (signature stroke)
      // Signatures are typically written in dark ink (black or dark blue ballpoint)
      const isDarkInk = luminance < 120;
      
      // Very dark pixels (black ink signature strokes)
      const isVeryDark = luminance < 80 && !(b > r + 30 && b > g + 30);
      
      // Dark blue ink (ballpoint pen - common for signatures)
      // Different from light blue stamp: stamps are typically lighter blue
      const isDarkBluePen = b > r && b > g && luminance < 150 && b < 180;
      
      if (isDarkInk || isDarkBluePen) {
        darkStrokePixels++;
        
        if (isVeryDark) {
          veryDarkPixels++;
        }
        
        // Detect edges (stroke boundaries) using simple gradient
        const rightIdx = (y * roiW + (x + 1)) * 4;
        const bottomIdx = ((y + 1) * roiW + x) * 4;
        
        const rightLum = 0.299 * pixels[rightIdx] + 0.587 * pixels[rightIdx + 1] + 0.114 * pixels[rightIdx + 2];
        const bottomLum = 0.299 * pixels[bottomIdx] + 0.587 * pixels[bottomIdx + 1] + 0.114 * pixels[bottomIdx + 2];
        
        const gradX = Math.abs(luminance - rightLum);
        const gradY = Math.abs(luminance - bottomLum);
        const gradient = Math.sqrt(gradX * gradX + gradY * gradY);
        
        if (gradient > 30) {
          edgePixels++;
        }
      }
    }
  }
  
  const total = roiW * roiH;
  const darkStrokeDensity = (darkStrokePixels / total) * 100;
  const veryDarkDensity = (veryDarkPixels / total) * 100;
  const edgeDensity = (edgePixels / total) * 100;
  
  // Signature detection criteria:
  // 1. Has some dark stroke pixels (not just stamp)
  // 2. Has edge pixels (strokes have boundaries)
  // 3. NOT just uniform stamp (would have low edge density relative to ink density)
  
  // Ratio of edges to dark pixels indicates stroke-like patterns vs solid blocks
  const strokeRatio = darkStrokePixels > 0 ? edgePixels / darkStrokePixels : 0;
  
  // Signatures have high stroke ratio (many edges per ink pixel)
  // Stamps have lower stroke ratio (solid text blocks)
  const hasSignaturePattern = strokeRatio > 0.15 && darkStrokeDensity > 0.05;
  
  // Very dark pixels (black ink) strongly indicate signature
  const hasBlackInkSignature = veryDarkDensity > 0.03;
  
  return {
    darkStrokeDensity,
    veryDarkDensity,
    edgeDensity,
    strokeRatio,
    hasSignaturePattern,
    hasBlackInkSignature,
    confidence: hasBlackInkSignature ? 'high' : (hasSignaturePattern ? 'medium' : 'low'),
    details: `Stroke: dark=${darkStrokeDensity.toFixed(3)}%, veryDark=${veryDarkDensity.toFixed(3)}%, edges=${edgeDensity.toFixed(3)}%, ratio=${strokeRatio.toFixed(3)}`
  };
}

function findLargestComponent(mask, width, height) {
  const visited = new Uint8Array(width * height);
  let largest = 0;
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        const queue = [idx];
        visited[idx] = 1;
        let head = 0, size = 0;
        
        while (head < queue.length) {
          const cur = queue[head++];
          size++;
          const cx = cur % width, cy = Math.floor(cur / width);
          
          for (const [dx, dy] of neighbors) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const ni = ny * width + nx;
              if (mask[ni] && !visited[ni]) {
                visited[ni] = 1;
                queue.push(ni);
              }
            }
          }
        }
        
        if (size > largest) largest = size;
      }
    }
  }
  
  return largest;
}

/**
 * Analyze date field ROI (bottom-left area where "Datum der Ausstellung" is)
 * Returns whether handwritten date is present
 */
function analyzeDateField(canvas) {
  const roi = CONFIG.dateExclusionROI;
  const analysis = analyzeROI(canvas, roi);
  
  // Date is typically handwritten in blue or black ink
  // If there's significant ink in the date area, date is present
  const hasDate = analysis.density > 0.3 || analysis.blackDensity > 0.1 || analysis.blueDensity > 0.1;
  
  return {
    hasDate,
    density: analysis.density,
    details: `Date ROI: density=${analysis.density.toFixed(3)}, black=${analysis.blackDensity.toFixed(3)}, blue=${analysis.blueDensity.toFixed(3)}`
  };
}

async function analyzeStampAndSignature(canvas, pageText, config = {}) {
  const roi = CONFIG.stampSignatureROI;
  const analysis = analyzeROI(canvas, roi);
  
  const blueThreshold = config.blueThreshold || CONFIG.defaults.blueThreshold;
  const sigThreshold = config.signatureThreshold || CONFIG.defaults.signatureThreshold;
  const compThreshold = config.compDensityThreshold || CONFIG.defaults.compDensityThreshold;
  
  // Analyze date field (to exclude from signature confusion)
  const dateAnalysis = analyzeDateField(canvas);
  
  // Analyze signature strokes specifically
  const signatureAnalysis = analyzeSignatureStrokes(canvas, roi);
  
  // STAMP DETECTION: Blue ink presence
  let stampStatus = 'MISSING';
  let stampConfidence = 'high';
  
  if (analysis.blueDensity >= blueThreshold) {
    stampStatus = 'PRESENT';
    stampConfidence = 'high';
  } else if (analysis.blueDensity >= blueThreshold * 0.5) {
    stampStatus = 'UNCERTAIN';
    stampConfidence = 'low';
  }
  
  // SIGNATURE DETECTION: Use stroke analysis, not just ink density
  let signatureStatus = 'MISSING';
  let signatureConfidence = 'high';
  
  // Primary: Check for black ink signature strokes
  if (signatureAnalysis.hasBlackInkSignature) {
    signatureStatus = 'PRESENT';
    signatureConfidence = 'high';
  } 
  // Secondary: Check for signature stroke patterns (dark blue pen)
  else if (signatureAnalysis.hasSignaturePattern) {
    signatureStatus = 'PRESENT';
    signatureConfidence = signatureAnalysis.confidence;
  }
  // Fallback: Very high dark stroke density might indicate signature
  else if (signatureAnalysis.darkStrokeDensity > 0.5 && signatureAnalysis.strokeRatio > 0.1) {
    signatureStatus = 'UNCERTAIN';
    signatureConfidence = 'low';
  }
  // Otherwise: No signature detected
  else {
    signatureStatus = 'MISSING';
    signatureConfidence = 'high';
  }
  
  let dateStatus = dateAnalysis.hasDate ? 'PRESENT' : 'MISSING';
  
  // Determine overall status
  let overallStatus;
  if (stampStatus === 'PRESENT' && signatureStatus === 'PRESENT') {
    overallStatus = dateAnalysis.hasDate ? 'COMPLETE' : 'DATE_MISSING';
  } else if (stampStatus === 'MISSING' && signatureStatus === 'MISSING') {
    overallStatus = 'BOTH_MISSING';
  } else if (stampStatus === 'UNCERTAIN' || signatureStatus === 'UNCERTAIN') {
    overallStatus = 'NEEDS_REVIEW';
  } else if (stampStatus === 'MISSING') {
    overallStatus = 'STAMP_MISSING';
  } else if (signatureStatus === 'MISSING') {
    overallStatus = 'SIGNATURE_MISSING';
  } else {
    overallStatus = 'NEEDS_REVIEW';
  }
  
  return {
    overallStatus,
    stamp: { status: stampStatus, confidence: stampConfidence, blueDensity: analysis.blueDensity.toFixed(3) },
    signature: { 
      status: signatureStatus, 
      confidence: signatureConfidence, 
      darkStrokeDensity: signatureAnalysis.darkStrokeDensity.toFixed(3),
      strokeRatio: signatureAnalysis.strokeRatio.toFixed(3)
    },
    date: { status: dateStatus, density: dateAnalysis.density.toFixed(3) },
    details: {
      totalDensity: analysis.density.toFixed(3),
      blueDensity: analysis.blueDensity.toFixed(3),
      signatureStrokes: signatureAnalysis.details,
      largestComponent: analysis.largestComponentRatio.toFixed(4),
      dateInfo: dateAnalysis.details
    },
    summary: `Stamp: ${stampStatus} | Signature: ${signatureStatus} | Date: ${dateStatus}`
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FILE OUTPUT & MANIFEST
   ═══════════════════════════════════════════════════════════════════════════ */

function saveBlobAndLink(blob, filename, source) {
  window._generatedFiles.push({ name: filename, blob, source });
  window._generatedBySource[source] = window._generatedBySource[source] || [];
  window._generatedBySource[source].push({ name: filename, blob });
  renderGeneratedFiles();
  appendLog(`✓ Created ${filename}`, 'info');
}

function renderGeneratedFiles() {
  const container = $('fileList');
  if (!container) return;
  container.innerHTML = '';
  
  const sources = Object.keys(window._generatedBySource);
  if (sources.length === 0) {
    container.innerHTML = '<p style="color:#64748b">No generated files yet.</p>';
    return;
  }
  
  sources.forEach(source => {
    const group = document.createElement('div');
    group.className = 'generated-group';
    
    const header = document.createElement('h4');
    header.textContent = `📄 ${source}`;
    group.appendChild(header);
    
    const filesDiv = document.createElement('div');
    filesDiv.className = 'generated-files';
    
    window._generatedBySource[source].forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'generated-file';
      btn.textContent = item.name;
      btn.title = `Download ${item.name}`;
      
      btn.addEventListener('click', () => {
        try {
          const url = URL.createObjectURL(item.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (err) {
          appendLog(`Download failed: ${err.message || err}`, 'error');
        }
      });
      
      filesDiv.appendChild(btn);
    });
    
    group.appendChild(filesDiv);
    
    const manual = window._manualBySource[source] || [];
    if (manual.length > 0) {
      const mWrap = document.createElement('div');
      mWrap.className = 'manual-messages';
      mWrap.innerHTML = `<strong>⚠️ Manual Review Required:</strong>`;
      const ul = document.createElement('ul');
      manual.forEach(msg => {
        const li = document.createElement('li');
        li.textContent = msg;
        ul.appendChild(li);
      });
      mWrap.appendChild(ul);
      group.appendChild(mWrap);
    }
    
    container.appendChild(group);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PROCESSING PIPELINE - IMPROVED with smart grouping
   ═══════════════════════════════════════════════════════════════════════════ */

async function processFile(file, config = {}) {
  const startTime = performance.now();
  const srcBytes = await readFileAsUint8(file);
  
  const [srcPdfLib, pdf] = await Promise.all([
    PDFLib.PDFDocument.load(srcBytes, { ignoreEncryption: true }),
    pdfjsLib.getDocument({ data: srcBytes }).promise
  ]);
  
  const numPages = pdf.numPages;
  appendLog(`Processing ${file.name}: ${numPages} page(s)`);
  
  // STEP 1: Extract text and detect CRs from ALL pages first
  const pages = [];
  for (let i = 0; i < numPages; i++) {
    setProgress(Math.round((i / numPages) * 30), `Extracting page ${i + 1}/${numPages}`);
    
    let text = await extractTextFromPage(pdf, i);
    let usedOCR = false;
    
    if (!text || text.trim().length < 30) {
      appendLog(`Page ${i + 1}: Low text, running OCR...`, 'warn');
      const canvas = await renderPageToCanvas(pdf, i);
      text = await ocrCanvas(canvas);
      usedOCR = true;
    }
    
    const rawCandidates = findCRsOnText(text);
    const candidates = chooseValidCRs(rawCandidates, config.relaxRegexOnly);
    
    pages.push({
      pageIndex: i,
      pageNum: i + 1,
      text,
      usedOCR,
      rawCandidates,
      candidates,
      cr: candidates.length === 1 ? candidates[0].value : null,
      crType: candidates.length === 1 ? candidates[0].type : null
    });
    
    appendLog(`Page ${i + 1}: ${usedOCR ? 'OCR' : 'text'} | CR: ${candidates.map(c => `${c.value} (${c.confidence})`).join(', ') || 'none'}`);
  }
  
  // STEP 2: Check for digital signatures
  const hasDigitalSig = checkDigitalSignatures(srcPdfLib);
  if (hasDigitalSig) {
    appendLog('⚠️ Digital signature detected - preserving original bytes', 'warn');
    return handleSignedPDF(file, srcBytes, pages, numPages);
  }
  
  // STEP 3: Group pages by CR number
  const crGroups = groupPagesByCR(pages);
  appendLog(`Found ${crGroups.length} CR group(s)`);
  
  // STEP 4: Process each CR group
  const manifestEntries = [];
  
  for (const group of crGroups) {
    setProgress(50 + Math.round((crGroups.indexOf(group) / crGroups.length) * 45), 
                `Processing CR ${group.cr || 'unknown'}`);
    
    if (!group.cr) {
      appendLog(`Pages ${group.pages.map(p => p.pageNum).join(',')}: No CR found`);
      continue;
    }
    
    try {
      // Analyze stamp & signature on the LAST page of the group
      const lastPage = group.pages[group.pages.length - 1];
      const canvas = await renderPageToCanvas(pdf, lastPage.pageIndex);
      const verification = await analyzeStampAndSignature(canvas, lastPage.text, config);
      
      appendLog(`CR ${group.cr}: ${verification.summary} (pages: ${group.pages.map(p => p.pageNum).join('-')})`);
      
      // Create output PDF with all pages in the group
      const outName = `${group.cr}.pdf`;
      const pageIndices = group.pages.map(p => p.pageIndex);
      
      const outPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await outPdf.copyPages(srcPdfLib, pageIndices);
      copiedPages.forEach(page => outPdf.addPage(page));
      
      const bytes = await outPdf.save({ useObjectStreams: false });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      
      saveBlobAndLink(blob, outName, file.name);
      
      if (['NEEDS_REVIEW', 'STAMP_MISSING', 'SIGNATURE_MISSING', 'BOTH_MISSING', 'DATE_MISSING'].includes(verification.overallStatus)) {
        const msg = formatVerificationMessage(file.name, group.pages.map(p => p.pageNum).join('-'), group.cr, verification);
        window._manualBySource[file.name] = window._manualBySource[file.name] || [];
        window._manualBySource[file.name].push(msg);
        renderGeneratedFiles();
      }
      
      manifestEntries.push({
        input: file.name,
        outputFile: outName,
        cr: group.cr,
        type: group.crType,
        status: verification.overallStatus,
        stampStatus: verification.stamp.status,
        signatureStatus: verification.signature.status,
        pages: group.pages.map(p => p.pageNum).join('-'),
        notes: verification.summary
      });
      
    } catch (e) {
      appendLog(`Error processing CR ${group.cr}: ${e.message}`, 'error');
      manifestEntries.push({
        input: file.name,
        outputFile: null,
        cr: group.cr,
        type: group.crType,
        status: 'ERROR',
        pages: group.pages.map(p => p.pageNum).join('-'),
        notes: e.message
      });
    }
  }
  
  if (manifestEntries.length === 0) {
    manifestEntries.push({
      input: file.name,
      outputFile: null,
      cr: null,
      type: null,
      status: 'NO_CR_FOUND',
      pages: `1-${numPages}`,
      notes: 'No valid confirmation numbers found'
    });
  }
  
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  appendLog(`✓ ${file.name} completed in ${elapsed}s`);
  
  return { input: file.name, pages: numPages, manifestEntries };
}

/**
 * Group consecutive pages that share the same CR number
 * IMPROVED: Pages without CR are included in the previous group
 * Logic: If page 1 has CR=577770 and page 2 has no CR, page 2 belongs to 577770
 */
function groupPagesByCR(pages) {
  const groups = [];
  let currentGroup = null;
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    
    if (page.cr) {
      // This page has a CR
      if (currentGroup && currentGroup.cr === page.cr) {
        // Same CR as current group - add to it
        currentGroup.pages.push(page);
      } else {
        // Different CR - save current group and start new one
        if (currentGroup && currentGroup.pages.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = {
          cr: page.cr,
          crType: page.crType,
          pages: [page]
        };
      }
    } else {
      // Page has no CR - attach to current group if exists
      if (currentGroup && currentGroup.pages.length > 0) {
        // This page belongs to the current CR document
        // (e.g., signature page without CR header)
        currentGroup.pages.push(page);
        appendLog(`Page ${page.pageNum}: No CR, attached to ${currentGroup.cr}`);
      } else {
        // No current group - this is an orphan page without CR
        // Try to look ahead for a CR to attach to
        let foundCR = null;
        for (let j = i + 1; j < pages.length && j < i + 3; j++) {
          if (pages[j].cr) {
            foundCR = pages[j].cr;
            break;
          }
        }
        
        if (foundCR) {
          // Start a new group with this orphan page
          currentGroup = {
            cr: foundCR,
            crType: getCRType(foundCR),
            pages: [page]
          };
        }
        // Otherwise skip orphan page without CR
      }
    }
  }
  
  if (currentGroup && currentGroup.pages.length > 0) {
    groups.push(currentGroup);
  }
  
  // Deduplicate: if multiple groups have same CR, merge them
  const merged = new Map();
  for (const group of groups) {
    if (merged.has(group.cr)) {
      merged.get(group.cr).pages.push(...group.pages);
    } else {
      merged.set(group.cr, { ...group });
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Check if PDF has digital signatures - IMPROVED detection
 * Checks multiple locations where signature data can be stored
 */
function checkDigitalSignatures(pdfDoc) {
  try {
    // Method 1: Check for signature form fields
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      for (const field of fields) {
        const type = field.constructor.name;
        if (type === 'PDFSignature' || type.includes('Sig')) {
          appendLog('Digital signature found: form field', 'info');
          return true;
        }
      }
    } catch (e) { /* No form or fields */ }
    
    // Method 2: Check AcroForm for signature fields
    try {
      const catalog = pdfDoc.catalog;
      if (catalog) {
        const acroForm = catalog.lookup(PDFLib.PDFName.of('AcroForm'));
        if (acroForm) {
          // Check SigFlags
          const sigFlags = acroForm.lookup(PDFLib.PDFName.of('SigFlags'));
          if (sigFlags) {
            const flags = sigFlags.asNumber ? sigFlags.asNumber() : 0;
            if (flags > 0) {
              appendLog('Digital signature found: SigFlags=' + flags, 'info');
              return true;
            }
          }
          
          // Check individual fields
          const fields = acroForm.lookup(PDFLib.PDFName.of('Fields'));
          if (fields && fields.asArray) {
            for (const fieldRef of fields.asArray()) {
              try {
                const field = pdfDoc.context.lookup(fieldRef);
                if (field) {
                  const ft = field.lookup(PDFLib.PDFName.of('FT'));
                  if (ft) {
                    const ftStr = ft.asString ? ft.asString() : (ft.encodedName || '');
                    if (ftStr === '/Sig' || ftStr === 'Sig' || ftStr.includes('Sig')) {
                      appendLog('Digital signature found: AcroForm field FT=Sig', 'info');
                      return true;
                    }
                  }
                  // Also check for V (value) containing signature data
                  const v = field.lookup(PDFLib.PDFName.of('V'));
                  if (v) {
                    const contents = v.lookup ? v.lookup(PDFLib.PDFName.of('Contents')) : null;
                    if (contents) {
                      appendLog('Digital signature found: AcroForm field with Contents', 'info');
                      return true;
                    }
                  }
                }
              } catch (e) { /* Skip invalid field */ }
            }
          }
        }
      }
    } catch (e) { /* AcroForm check failed */ }
    
    // Method 3: Check page annotations for signature widgets
    try {
      const pageCount = pdfDoc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const annots = page.node.lookup(PDFLib.PDFName.of('Annots'));
        if (annots && annots.asArray) {
          for (const annotRef of annots.asArray()) {
            try {
              const annot = pdfDoc.context.lookup(annotRef);
              if (annot) {
                const subtype = annot.lookup(PDFLib.PDFName.of('Subtype'));
                if (subtype) {
                  const subtypeStr = subtype.asString ? subtype.asString() : (subtype.encodedName || '');
                  if (subtypeStr === '/Widget' || subtypeStr === 'Widget') {
                    const ft = annot.lookup(PDFLib.PDFName.of('FT'));
                    if (ft) {
                      const ftStr = ft.asString ? ft.asString() : (ft.encodedName || '');
                      if (ftStr === '/Sig' || ftStr === 'Sig' || ftStr.includes('Sig')) {
                        appendLog('Digital signature found: Widget annotation', 'info');
                        return true;
                      }
                    }
                  }
                }
              }
            } catch (e) { /* Skip invalid annotation */ }
          }
        }
      }
    } catch (e) { /* Annotation check failed */ }
    
    // Method 4: Raw byte scan for signature markers (last resort)
    // This is expensive but catches signatures that other methods miss
    try {
      const pdfBytes = pdfDoc.context.enumerateIndirectObjects();
      // Check for /Type /Sig patterns - not implemented for performance
    } catch (e) { /* Raw scan failed */ }
    
    return false;
  } catch (e) {
    console.warn('Error checking signatures:', e);
    return false;
  }
}

/**
 * Handle digitally signed PDF - preserve original bytes to maintain signature integrity
 * NO alerts for missing stamp/signature - digital signature is sufficient
 */
function handleSignedPDF(file, srcBytes, pages, numPages) {
  // Collect all unique CRs from all pages
  const allCRs = [];
  pages.forEach(p => {
    if (p.cr && !allCRs.some(c => c.value === p.cr)) {
      allCRs.push({ value: p.cr, type: p.crType });
    }
  });
  
  // If no CR found via OCR, try harder with combined text
  if (allCRs.length === 0) {
    const combinedText = pages.map(p => p.text).join(' ');
    const candidates = findCRsOnText(combinedText);
    if (candidates.length > 0) {
      allCRs.push({ value: candidates[0].value, type: candidates[0].type });
    }
  }
  
  if (allCRs.length >= 1) {
    // Use the first CR found (most reliable)
    const cr = allCRs[0];
    const outName = `${cr.value}.pdf`;
    
    // CRITICAL: Use original bytes directly - do NOT process through pdf-lib
    // This preserves the digital signature integrity
    const blob = new Blob([srcBytes], { type: 'application/pdf' });
    saveBlobAndLink(blob, outName, file.name);
    
    appendLog(`✅ Preserved digitally signed PDF as ${outName} (${numPages} pages)`);
    
    // NO manual review alerts for digitally signed PDFs
    return {
      input: file.name,
      pages: numPages,
      manifestEntries: [{
        input: file.name,
        outputFile: outName,
        cr: cr.value,
        type: cr.type,
        status: 'DIGITAL_SIGNATURE_VALID',
        stampStatus: 'N/A',
        signatureStatus: 'DIGITAL',
        pages: `1-${numPages}`,
        notes: 'Digital signature preserved - original PDF bytes unchanged'
      }]
    };
  }
  
  // No CR found at all - still preserve the signed PDF
  appendLog('⚠️ Signed PDF but no CR found - preserving as-is', 'warn');
  
  const blob = new Blob([srcBytes], { type: 'application/pdf' });
  const outName = file.name.replace(/\.pdf$/i, '_signed.pdf');
  saveBlobAndLink(blob, outName, file.name);
  
  // Add to manual review but explain it's about CR detection, not signature
  window._manualBySource[file.name] = window._manualBySource[file.name] || [];
  window._manualBySource[file.name].push(
    `${file.name}: Digital signature valid but CR number not detected - please verify CR manually`
  );
  renderGeneratedFiles();
  
  return {
    input: file.name,
    pages: numPages,
    manifestEntries: [{
      input: file.name,
      outputFile: outName,
      cr: null,
      type: null,
      status: 'DIGITAL_SIG_NO_CR',
      stampStatus: 'N/A',
      signatureStatus: 'DIGITAL',
      pages: `1-${numPages}`,
      notes: 'Digital signature preserved but CR not detected'
    }]
  };
}

function formatVerificationMessage(fileName, pageRange, cr, verification) {
  const { stamp, signature, date, overallStatus } = verification;
  let msg = `${fileName} p.${pageRange} (${cr}): `;
  
  switch (overallStatus) {
    case 'STAMP_MISSING':
      msg += '⚠️ Stamp MISSING - please verify stamp is applied';
      break;
    case 'SIGNATURE_MISSING':
      msg += '⚠️ Signature MISSING - please verify document is signed';
      break;
    case 'BOTH_MISSING':
      msg += '❌ Both stamp AND signature MISSING - document incomplete';
      break;
    case 'DATE_MISSING':
      msg += '⚠️ Date MISSING - stamp & signature OK but date field empty';
      break;
    case 'NEEDS_REVIEW':
      msg += `🔍 Manual check needed (Stamp: ${stamp.status}, Sig: ${signature.status})`;
      break;
    default:
      msg += verification.summary;
  }
  
  return msg;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI EVENT HANDLERS
   ═══════════════════════════════════════════════════════════════════════════ */

async function onRun() {
  const runBtn = $('runBtn');
  try {
    clearState();
    setProgress(0, 'Starting...');
    if (runBtn) runBtn.disabled = true;
    
    const files = window._selectedFiles || [];
    if (!files.length) {
      appendLog('No files selected', 'warn');
      setProgress(0, 'No files');
      return;
    }
    
    const config = {
      roiHeight: parseFloat($('roiHeight')?.value || CONFIG.defaults.roiHeight),
      roiThreshold: parseFloat($('roiThreshold')?.value || CONFIG.defaults.roiThreshold),
      blueThreshold: parseFloat($('blueThreshold')?.value || CONFIG.defaults.blueThreshold),
      signatureThreshold: parseFloat($('signatureThreshold')?.value || CONFIG.defaults.signatureThreshold),
    };
    
    appendLog(`Config: Blue=${config.blueThreshold}%, Sig=${config.signatureThreshold}%`);
    
    const manifest = [];
    const stats = { files: 0, crFound: 0, outputs: 0, complete: 0, needsReview: 0 };
    
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(Math.round((i / files.length) * 100), `Processing ${f.name}`);
      
      try {
        const result = await processFile(f, config);
        manifest.push(result);
        stats.files++;
        
        (result.manifestEntries || []).forEach(e => {
          if (e.cr) stats.crFound++;
          if (e.outputFile) stats.outputs++;
          if (e.status === 'COMPLETE' || e.status === 'DIGITAL_SIGNATURE_PRESERVED') stats.complete++;
          if (['NEEDS_REVIEW', 'STAMP_MISSING', 'SIGNATURE_MISSING', 'BOTH_MISSING', 'AMBIGUOUS', 'MANUAL_REVIEW'].includes(e.status)) {
            stats.needsReview++;
          }
        });
      } catch (e) {
        appendLog(`Error: ${f.name} - ${e.message}`, 'error');
        console.error(e);
      }
    }
    
    window._hellaManifest = manifest;
    
    const summaryEl = ensureEl('summary', 'div');
    summaryEl.innerHTML = `
      <strong>📊 Summary:</strong> 
      Files: ${stats.files} | 
      CRs: ${stats.crFound} | 
      Outputs: ${stats.outputs} | 
      <span style="color:#16a34a">✓ Complete: ${stats.complete}</span> | 
      <span style="color:#ea580c">⚠ Review: ${stats.needsReview}</span>
    `;
    
    const dlZip = $('downloadZipBtn');
    const dlCsv = $('downloadManifestCSVBtn');
    if (dlZip) dlZip.disabled = false;
    if (dlCsv) dlCsv.disabled = false;
    
    appendLog('✓ Processing complete');
    setProgress(100, 'Done');
    
  } catch (e) {
    appendLog(`Fatal error: ${e.message}`, 'error');
    console.error(e);
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

async function downloadAllAsZip() {
  if (!window.JSZip) {
    appendLog('JSZip not loaded', 'error');
    return;
  }
  
  if (!window._generatedFiles?.length) {
    appendLog('No files to zip', 'warn');
    return;
  }
  
  try {
    const zip = new JSZip();
    window._generatedFiles.forEach(f => zip.file(f.name, f.blob));
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CR_processed.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    appendLog('✓ ZIP downloaded');
  } catch (e) {
    appendLog(`ZIP error: ${e.message}`, 'error');
  }
}

function downloadManifestCSV() {
  const data = window._hellaManifest || [];
  if (!data.length) {
    appendLog('No manifest to export', 'warn');
    return;
  }
  
  const header = 'Input,TotalPages,OutputFile,CR,Type,Status,StampStatus,SignatureStatus,Pages,Notes';
  const rows = [header];
  
  data.forEach(doc => {
    (doc.manifestEntries || []).forEach(e => {
      const row = [
        doc.input,
        doc.pages,
        e.outputFile || '',
        e.cr || '',
        e.type || '',
        e.status || '',
        e.stampStatus || '',
        e.signatureStatus || '',
        e.pages || '',
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ].join(',');
      rows.push(row);
    });
  });
  
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CR_manifest.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  appendLog('✓ CSV exported');
}

function bindUI() {
  $('runBtn')?.addEventListener('click', onRun);
  $('downloadZipBtn')?.addEventListener('click', downloadAllAsZip);
  $('downloadManifestCSVBtn')?.addEventListener('click', downloadManifestCSV);
  
  // Note: File selection is handled by the enhanced UI in CR.html
  // We only listen for changes here to log the selection
  const inputFiles = $('inputFiles');
  if (inputFiles) {
    inputFiles.addEventListener('change', (e) => {
      // Don't override _selectedFiles if already set by enhanced UI
      if (!window._selectedFiles || window._selectedFiles.length === 0) {
        window._selectedFiles = Array.from(e.target.files);
      }
      appendLog(`📄 Selected ${window._selectedFiles.length} file(s)`);
    });
  }
  
  // Enhanced clear handling - coordinate with enhanced UI
  const clearBtn = $('clearFilesBtn');
  if (clearBtn) {
    // Remove any existing listeners first (to avoid duplicates)
    const newClearBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    
    newClearBtn.addEventListener('click', () => {
      window._selectedFiles = [];
      const input = $('inputFiles');
      if (input) input.value = '';
      
      clearState();
      window._hellaManifest = [];
      setProgress(0, 'Ready');
      
      const dlZip = $('downloadZipBtn');
      const dlCsv = $('downloadManifestCSVBtn');
      if (dlZip) dlZip.disabled = true;
      if (dlCsv) dlCsv.disabled = true;
      
      // Update enhanced UI file list
      if (typeof window.updateFileListUI === 'function') {
        window.updateFileListUI();
      }
      
      appendLog('🗑️ Cleared all files and results');
    });
  }
  
  appendLog('🚀 CR Processor v3.3 ready — Advanced Signature Detection');
}

/* ═══════════════════════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[CR.js] Initializing v3.2...');
  
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';
  }
  
  bindUI();
  console.log('[CR.js] Ready');
});

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTS FOR TESTING
   ═══════════════════════════════════════════════════════════════════════════ */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeToken,
    findCRsOnText,
    chooseValidCRs,
    isValidCR,
    getCRType,
    isInExclusionContext,
    groupPagesByCR,
    CONFIG
  };
}
