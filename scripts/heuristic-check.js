/**
 * Heuristic Check Script for CR Detection
 * 
 * Run with: node scripts/heuristic-check.js
 * 
 * Tests the CR detection logic with sample text inputs
 * Reports True Positives, False Positives, False Negatives
 */

// Import the detection functions (simulated for browser code)
// In a real Node setup, you'd need to extract these to a shared module

const CONFIG = {
  patterns: {
    EP1: /^1\d{7}$/,  // 1XXXXXXX - 8 digits starting with 1
    H01: /^5\d{5}$/,  // 5XXXXX - 6 digits starting with 5
  }
};

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

const ANCHORS = [
  /Confirmation of receipt/i,
  /No\.?\s*of\s*confirmation\s*of\s*receipt/i,
  /Gelangensbestätigung/i,
  /Bestätigung über das Gelangen/i,
  /receipt/i,
  /Gelangen/i,
];

/**
 * Check if a number looks like a postal code (followed by city name)
 */
function isPostalCodeContext(text, matchIndex, matchValue) {
  const afterMatch = text.substring(matchIndex + matchValue.length, matchIndex + matchValue.length + 50);
  // Postal code pattern: number followed by whitespace then city name (letters)
  const postalPattern = /^\s+[A-Za-zăâîșțĂÂÎȘȚ]{2,}/i;
  return postalPattern.test(afterMatch);
}

/**
 * Normalize OCR text - remove spaces between digits
 */
function normalizeOCRText(text) {
  if (!text) return '';
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Fix spaces between digits
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2');
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2');
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2');
  
  // Normalize German umlauts and common OCR variations
  // ä → a, ö → o, ü → u, ß → ss (for matching purposes)
  normalized = normalized.replace(/[äàáâãåæ]/gi, 'a');
  normalized = normalized.replace(/[öòóôõø]/gi, 'o');
  normalized = normalized.replace(/[üùúû]/gi, 'u');
  normalized = normalized.replace(/ß/g, 'ss');
  
  return normalized;
}

function findCRsOnText(text) {
  if (!text) return [];
  
  // Pre-process for OCR artifacts
  const normalizedText = normalizeOCRText(text);
  const results = [];
  
  // PRIORITY 1: Direct anchor patterns - capture CR right after anchor
  const directPatterns = [
    /No\.?\s*of\s*confirmation\s*of\s*receipt[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
    /confirmation\s*of\s*receipt[:\s\-]*([0-9OIlSsQBG\s]{4,14})\s*from/i,
    // German patterns - "Gelangensbestätigung Nr. 554131"
    // Original with umlaut
    /Gelangensbestätigung(?:\s+Nr\.?)?[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
    // OCR-friendly variants (ä→a, ae, missing chars)
    /Gelangensbestatigung(?:\s+Nr\.?)?[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
    /Gelangensbestaetigung(?:\s+Nr\.?)?[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
    /Gelangensbest[aä]?t?i?g?u?n?g?(?:\s+Nr\.?)?[:\s\-]*([0-9OIlSsQBG\s]{4,14})/i,
  ];
  
  // Try both original and normalized
  for (const searchText of [normalizedText, text]) {
    for (const rx of directPatterns) {
      const match = rx.exec(searchText);
      if (match?.[1]) {
        const norm = normalizeToken(match[1]);
        if (isValidCR(norm)) {
          return [{
            value: norm,
            type: getCRType(norm),
            raw: match[1],
            source: 'direct_anchor',
            confidence: 'high'
          }];
        }
      }
    }
  }
  
  // PRIORITY 2: Search ONLY in 50 chars after strict anchor phrases
  const strictAnchors = [
    /No\.?\s*of\s*confirmation\s*of\s*receipt/i,
    /Gelangensbestätigung(?:\s+Nr\.?)?/i,
    /Gelangensbestatigung(?:\s+Nr\.?)?/i,  // OCR: ä→a
    /Gelangensbestaetigung(?:\s+Nr\.?)?/i, // OCR: ä→ae
    /Gelangensbest[aä]?t?i?g?u?n?g?(?:\s+Nr\.?)?/i, // Partial OCR match
    /Best[aä]tigung(?:\s+Nr\.?)?/i,  // Shorter anchor with OCR support
    /\bNr\.?\s*(?:vom|from)?\s*$/i,  // Just "Nr." at end of context
  ];
  
  for (const anchorRx of strictAnchors) {
    const anchorMatch = anchorRx.exec(normalizedText);
    if (!anchorMatch) continue;
    
    const anchorEnd = anchorMatch.index + anchorMatch[0].length;
    const searchWindow = normalizedText.substring(anchorEnd, Math.min(anchorEnd + 50, normalizedText.length));
    
    // H01 first (more specific)
    const h01Match = searchWindow.match(/\b(5\d{5})\b/);
    if (h01Match) {
      const norm = normalizeToken(h01Match[1]);
      if (isValidCR(norm)) {
        return [{ value: norm, type: 'H01', raw: h01Match[1], source: 'near_anchor', confidence: 'high' }];
      }
    }
    
    // EP1 second
    const ep1Match = searchWindow.match(/\b(1\d{7})\b/);
    if (ep1Match) {
      const norm = normalizeToken(ep1Match[1]);
      if (isValidCR(norm)) {
        return [{ value: norm, type: 'EP1', raw: ep1Match[1], source: 'near_anchor', confidence: 'high' }];
      }
    }
  }
  
  // PRIORITY 3: Broader anchor search (100 chars)
  const broadAnchors = [
    /confirmation\s*of\s*receipt/i,
    /Gelangen/i,
    /best[aä]tigung/i,  // Just "Bestätigung" with OCR support
    /innergemeinschaftlich/i,  // Common text in Hella CR documents
    /Lieferung/i,  // "Delivery" in German - common in CR docs
  ];
  
  for (const anchorRx of broadAnchors) {
    const anchorMatch = anchorRx.exec(normalizedText);
    if (!anchorMatch) continue;
    
    const anchorEnd = anchorMatch.index + anchorMatch[0].length;
    const searchWindow = normalizedText.substring(anchorEnd, Math.min(anchorEnd + 100, normalizedText.length));
    
    // H01 first
    const h01Match = searchWindow.match(/\b(5\d{5})\b/);
    if (h01Match && !isPostalCodeContext(normalizedText, anchorEnd + h01Match.index, h01Match[0])) {
      const norm = normalizeToken(h01Match[0]);
      if (isValidCR(norm)) {
        return [{ value: norm, type: 'H01', raw: h01Match[0], source: 'near_anchor', confidence: 'high' }];
      }
    }
    
    // EP1 second
    const ep1Match = searchWindow.match(/\b(1\d{7})\b/);
    if (ep1Match) {
      const norm = normalizeToken(ep1Match[0]);
      if (isValidCR(norm)) {
        return [{ value: norm, type: 'EP1', raw: ep1Match[0], source: 'near_anchor', confidence: 'high' }];
      }
    }
  }
  
  // PRIORITY 3.5: Look for "Nr." followed by H01 pattern anywhere in text
  // This catches cases like "Gelangensbestätigung Nr. |554128|" where OCR splits text
  const nrPattern = /Nr\.?\s*[:\|\-\s]*\[?\s*(5\d{5})\s*\]?/gi;
  for (const match of normalizedText.matchAll(nrPattern)) {
    const norm = normalizeToken(match[1]);
    if (isValidCR(norm)) {
      // Check context - should be near relevant document text
      const beforeContext = normalizedText.substring(Math.max(0, match.index - 150), match.index);
      const hasRelevantContext = /Gelangen|bestat|confirmation|receipt|innergemeinschaftlich|Lieferung/i.test(beforeContext);
      
      if (hasRelevantContext) {
        return [{
          value: norm,
          type: 'H01',
          raw: match[1],
          source: 'nr_pattern',
          confidence: 'high'
        }];
      }
    }
  }
  
  // PRIORITY 4: Global search - H01 first, then EP1 only if anchor nearby
  // H01 global
  for (const m of normalizedText.matchAll(/\b(5\d{5})\b/g)) {
    if (!isPostalCodeContext(normalizedText, m.index, m[0])) {
      const norm = normalizeToken(m[0]);
      if (isValidCR(norm)) {
        return [{ value: norm, type: 'H01', raw: m[0], source: 'global', confidence: 'medium' }];
      }
    }
  }
  
  // EP1 global - ONLY if anchor phrase exists nearby
  for (const m of normalizedText.matchAll(/\b(1\d{7})\b/g)) {
    const nearbyContext = normalizedText.substring(Math.max(0, m.index - 200), m.index);
    const hasAnchorNearby = /confirmation|receipt|Gelangen|bestatigung|bestaetigung|innergemeinschaftlich|Lieferung|Nr\./i.test(nearbyContext);
    
    if (hasAnchorNearby) {
      const norm = normalizeToken(m[0]);
      if (isValidCR(norm)) {
        return [{ value: norm, type: 'EP1', raw: m[0], source: 'global', confidence: 'medium' }];
      }
    }
  }
  
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

const testCases = [
  // EP1 Format Tests (1XXXXXXX)
  {
    name: 'EP1 - Direct anchor English',
    input: 'No. of confirmation of receipt 10176660 from 30.09.2025',
    expected: { value: '10176660', type: 'EP1' }
  },
  {
    name: 'EP1 - Direct anchor with colon',
    input: 'No. of confirmation of receipt: 12345678',
    expected: { value: '12345678', type: 'EP1' }
  },
  {
    name: 'EP1 - Confirmation header context',
    input: 'Confirmation of receipt for objects of intra-community (EU) deliveries\nNo. of confirmation of receipt 10176660',
    expected: { value: '10176660', type: 'EP1' }
  },
  {
    name: 'EP1 - OCR noise (O instead of 0)',
    input: 'No. of confirmation of receipt 1O176660',
    expected: { value: '10176660', type: 'EP1' }
  },
  {
    name: 'EP1 - OCR noise (I instead of 1)',
    input: 'No. of confirmation of receipt I0176660',
    expected: { value: '10176660', type: 'EP1' }
  },
  
  // NEW: OCR with spaces between digits
  {
    name: 'H01 - OCR with spaces between digits',
    input: 'No. of confirmation of receipt 5 7 7 7 7 0 from 03.10.2025',
    expected: { value: '577770', type: 'H01' }
  },
  {
    name: 'H01 - OCR with partial spaces',
    input: 'No. of confirmation of receipt 577 770 from 03.10.2025',
    expected: { value: '577770', type: 'H01' }
  },
  
  // CRITICAL: Material number must NOT be detected as CR
  {
    name: 'H01 with material numbers in table - MUST detect 577770 not 13047454',
    input: `Confirmation of receipt for objects of intra-community (EU) deliveries
to another EU-member state (confirmation of receipt)
Customer: JoysonQuin Automotive System Romania SRL
507075 Ghimbav
Romania
No. of confirmation of receipt 577770 from 03.10.2025
CR Item Material Description Quantity
1 3047454 LED-MODULE FLEX LIN 8.400 PC
2 3047453 LED-MODULE FLEX LIN 8.400 PC`,
    expected: { value: '577770', type: 'H01' }
  },
  
  // H01 Format Tests (5XXXXX)
  {
    name: 'H01 - German Gelangensbestätigung',
    input: 'Gelangensbestätigung Nr. 554131 vom 30.04.2025',
    expected: { value: '554131', type: 'H01' }
  },
  {
    name: 'H01 - German with different spacing',
    input: 'Gelangensbestätigung Nr.: 554131',
    expected: { value: '554131', type: 'H01' }
  },
  {
    name: 'H01 - Full German header context',
    input: 'Bestätigung über das Gelangen der Gegenstände innergemeinschaftlicher Lieferungen\nGelangensbestätigung Nr. 554131',
    expected: { value: '554131', type: 'H01' }
  },
  {
    name: 'H01 - OCR with S instead of 5',
    input: 'Gelangensbestätigung Nr. SS4131',
    expected: { value: '554131', type: 'H01' }
  },
  
  // Edge cases
  {
    name: 'Global fallback - EP1 with confirmation context',
    input: 'Customer: Plastal Sverige AB\nConfirmation Reference: 10176660\nDate: 2025',
    expected: { value: '10176660', type: 'EP1' }
  },
  {
    name: 'Global fallback - H01 without anchor',
    input: 'Lieferung 554131, Datum: 2025',
    expected: { value: '554131', type: 'H01' }
  },
  {
    name: 'No CR present',
    input: 'This document contains no confirmation number whatsoever',
    expected: null
  },
  {
    name: 'Invalid format - too short',
    input: 'Reference: 12345',
    expected: null
  },
  {
    name: 'Invalid format - wrong prefix',
    input: 'Reference: 20176660',
    expected: null
  },
  
  // CRITICAL: Postal code exclusion (Problem 1 - bug fix v3.0)
  {
    name: 'Postal code must NOT be detected as CR',
    input: `Ursus Factoring IFN SA
Strada Pindului nr. 4-6, Et. 7, 507075 Ghimbav, Judetul Brasov
Romania
No. of confirmation of receipt 577770 from date`,
    expected: { value: '577770', type: 'H01' }  // Should find 577770, NOT 507075
  },
  
  // Real-world examples from screenshots
  {
    name: 'Real - Swedish Hella document',
    input: `Confirmation of receipt for objects of intra-community (EU) deliveries
to another EU-member state (confirmation of receipt)
Customer: Plastal Sverige AB
Mölndalsvägen 36
412 63 Göteborg
Sweden
Ship-to: Plastal Sverige AB
Arendals Allé, ARS
418 79 Gothenburg
Sweden
No. of confirmation of receipt 10176660 from 30.09.2025
CR Item Material Description Quantity UM Receive month`,
    expected: { value: '10176660', type: 'EP1' }
  },
  {
    name: 'Real - Austrian Hella document (German)',
    input: `Bestätigung über das Gelangen der Gegenstände
innergemeinschaftlicher Lieferungen
in einen anderen EU-Mitgliedsstaat (Gelangensbestätigung)
Customer: Hella Fahrzeugteile Austria GmbH
Fabriksgasse
7503 Großpetersdorf
Österreich
Absender: HELLA GmbH & Co. KGaA Handel
Overhagener Weg 14
59597 Erwitte
Deutschland
DE813832619
Gelangensbestätigung Nr. 554131 vom 30.04.2025`,
    expected: { value: '554131', type: 'H01' }
  },
  
  // OCR edge cases - German umlauts and character errors
  {
    name: 'OCR - Gelangensbestatigung without umlaut',
    input: 'Gelangensbestatigung Nr. 554128 vom 30.04.2025',
    expected: { value: '554128', type: 'H01' }
  },
  {
    name: 'OCR - Gelangensbestaetigung with ae',
    input: 'Gelangensbestaetigung Nr. 554118 vom 30.04.2025',
    expected: { value: '554118', type: 'H01' }
  },
  {
    name: 'OCR - Partial anchor Gelangensbest',
    input: 'Gelangensbest Nr. 554128 vom 30.04.2025',
    expected: { value: '554128', type: 'H01' }
  },
  {
    name: 'OCR - Bestätigung only anchor',
    input: 'Bestätigung Nr. 554131 vom 30.04.2025\nCustomer: Hella GmbH',
    expected: { value: '554131', type: 'H01' }
  },
  {
    name: 'OCR - innergemeinschaftlich context with Nr pattern',
    input: `Bestätigung über das Gelangen der Gegenstände
innergemeinschaftlicher Lieferungen
in einen anderen EU-Mitgliedsstaat
Nr. 554128 vom 30.04.2025`,
    expected: { value: '554128', type: 'H01' }
  },
  {
    name: 'OCR - Boxed CR number with pipes',
    input: 'Gelangensbestätigung Nr. |554128| vom 30.04.2025',
    expected: { value: '554128', type: 'H01' }
  },
  {
    name: 'OCR - Full Hella doc with varied OCR quality',
    input: `Bestatigung uber das Gelangen der Gegenstande
innergemeinschaftlicher Lieferungen
in einen anderen EU-Mitgliedsstaat (Gelangensbestatigung)
Customer: Hella Fahrzeugteile Austria GmbH
Gelangensbestatigung Nr. 554128 vom 30.04.2025`,
    expected: { value: '554128', type: 'H01' }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CR DETECTION HEURISTIC TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let passed = 0, failed = 0;
  const results = { TP: 0, FP: 0, FN: 0, TN: 0 };
  
  for (const tc of testCases) {
    const detected = findCRsOnText(tc.input);
    const found = detected.length > 0 ? detected[0] : null;
    
    let success = false;
    
    if (tc.expected === null) {
      // Should not find anything
      if (found === null) {
        success = true;
        results.TN++;
      } else {
        results.FP++;
      }
    } else {
      // Should find specific CR
      if (found && found.value === tc.expected.value && found.type === tc.expected.type) {
        success = true;
        results.TP++;
      } else if (found) {
        results.FP++;
      } else {
        results.FN++;
      }
    }
    
    const status = success ? '✓ PASS' : '✗ FAIL';
    const color = success ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${color}${status}\x1b[0m ${tc.name}`);
    
    if (!success) {
      console.log(`       Expected: ${tc.expected ? `${tc.expected.value} (${tc.expected.type})` : 'null'}`);
      console.log(`       Got:      ${found ? `${found.value} (${found.type})` : 'null'}`);
    }
    
    if (success) passed++;
    else failed++;
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total:  ${testCases.length}`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
  console.log('');
  console.log('  Detection Metrics:');
  console.log(`    True Positives:  ${results.TP}`);
  console.log(`    True Negatives:  ${results.TN}`);
  console.log(`    False Positives: ${results.FP}`);
  console.log(`    False Negatives: ${results.FN}`);
  
  const precision = results.TP / (results.TP + results.FP) || 0;
  const recall = results.TP / (results.TP + results.FN) || 0;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;
  
  console.log('');
  console.log(`    Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`    Recall:    ${(recall * 100).toFixed(1)}%`);
  console.log(`    F1 Score:  ${(f1 * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  return failed === 0;
}

// Run if executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests, findCRsOnText, normalizeToken, isValidCR };
