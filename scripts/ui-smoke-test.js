/**
 * UI Smoke Test for CR Processor
 * 
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 * 
 * Run with:
 *   node scripts/ui-smoke-test.js
 * 
 * Or with Playwright test runner:
 *   npx playwright test scripts/ui-smoke-test.js
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

// Create a simple test PDF for testing (base64 encoded minimal PDF)
const MINIMAL_PDF_BASE64 = `JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2Jq
CjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2Jq
CjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIg
NzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4g
Pj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA4NCA+PgpzdHJlYW0KQlQKL0YxIDI0IFMK
MTAwIDcwMCBUZApOby4gb2YgY29uZmlybWF0aW9uIG9mIHJlY2VpcHQgMTAxNzY2NjAgVGoKRVQK
ZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAv
QmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBm
IAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAw
MCBuIAowMDAwMDAwMjcwIDAwMDAwIG4gCjAwMDAwMDA0MDQgMDAwMDAgbiAKdHJhaWxlcgo8PCAv
U2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0ODEKJSVFT0Y=`;

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('python3', ['-m', 'http.server', PORT.toString()], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    server.stdout.on('data', (data) => {
      console.log(`[Server] ${data}`);
    });
    
    server.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Serving HTTP')) {
        console.log('[Server] Started successfully');
        resolve(server);
      }
    });
    
    server.on('error', reject);
    
    // Give server time to start
    setTimeout(() => resolve(server), 1000);
  });
}

async function createTestPDF() {
  const testDir = path.join(__dirname, '..', 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const pdfPath = path.join(testDir, 'test-10176660.pdf');
  const pdfBuffer = Buffer.from(MINIMAL_PDF_BASE64, 'base64');
  fs.writeFileSync(pdfPath, pdfBuffer);
  
  return pdfPath;
}

async function runSmokeTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CR PROCESSOR UI SMOKE TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let server = null;
  let browser = null;
  let allPassed = true;
  
  try {
    // Start local server
    console.log('[Test] Starting local server...');
    server = await startServer();
    
    // Create test PDF
    console.log('[Test] Creating test PDF...');
    const testPdfPath = await createTestPDF();
    
    // Launch browser
    console.log('[Test] Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Capture console logs
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`  [Browser Error] ${msg.text()}`);
      }
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: Page loads correctly
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 1] Page loads correctly...');
    await page.goto(`${BASE_URL}/CR.html`);
    
    const title = await page.title();
    if (title.includes('CR Processor')) {
      console.log('  ✓ Page title is correct');
    } else {
      console.log('  ✗ Page title incorrect:', title);
      allPassed = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2: Required elements exist
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 2] Required elements exist...');
    
    const requiredElements = [
      'inputFiles',
      'runBtn',
      'downloadZipBtn',
      'downloadManifestCSVBtn',
      'clearFilesBtn',
      'resultsConsole',
      'progressBar',
      'roiHeight',
      'blueThreshold',
      'signatureThreshold'
    ];
    
    for (const id of requiredElements) {
      const exists = await page.$(`#${id}`) !== null;
      if (exists) {
        console.log(`  ✓ #${id} exists`);
      } else {
        console.log(`  ✗ #${id} MISSING`);
        allPassed = false;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3: Libraries loaded
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 3] External libraries loaded...');
    
    const libs = await page.evaluate(() => ({
      pdfjsLib: typeof pdfjsLib !== 'undefined',
      PDFLib: typeof PDFLib !== 'undefined',
      Tesseract: typeof Tesseract !== 'undefined',
      JSZip: typeof JSZip !== 'undefined'
    }));
    
    for (const [lib, loaded] of Object.entries(libs)) {
      if (loaded) {
        console.log(`  ✓ ${lib} loaded`);
      } else {
        console.log(`  ✗ ${lib} NOT LOADED`);
        allPassed = false;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 4: Initial UI state
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 4] Initial UI state...');
    
    const runBtnEnabled = await page.$eval('#runBtn', el => !el.disabled);
    const zipBtnDisabled = await page.$eval('#downloadZipBtn', el => el.disabled);
    
    if (runBtnEnabled) {
      console.log('  ✓ Run button is enabled');
    } else {
      console.log('  ✗ Run button should be enabled');
      allPassed = false;
    }
    
    if (zipBtnDisabled) {
      console.log('  ✓ ZIP button is disabled initially');
    } else {
      console.log('  ✗ ZIP button should be disabled initially');
      allPassed = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 5: Config inputs have defaults
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 5] Config inputs have defaults...');
    
    const roiHeight = await page.$eval('#roiHeight', el => el.value);
    const blueThreshold = await page.$eval('#blueThreshold', el => el.value);
    
    if (roiHeight && parseFloat(roiHeight) > 0) {
      console.log(`  ✓ ROI Height default: ${roiHeight}%`);
    } else {
      console.log('  ✗ ROI Height has no default');
      allPassed = false;
    }
    
    if (blueThreshold && parseFloat(blueThreshold) > 0) {
      console.log(`  ✓ Blue Threshold default: ${blueThreshold}%`);
    } else {
      console.log('  ✗ Blue Threshold has no default');
      allPassed = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 6: Clear button works
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 6] Clear button functionality...');
    
    await page.click('#clearFilesBtn');
    await page.waitForTimeout(500);
    
    const consoleEmpty = await page.$eval('#resultsConsole', el => {
      // After clear, there should be at least the "Cleared" message
      return el.textContent.includes('Cleared') || el.children.length <= 2;
    });
    
    if (consoleEmpty) {
      console.log('  ✓ Clear button works');
    } else {
      console.log('  ✗ Clear button did not clear properly');
      allPassed = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 7: No JavaScript errors on page
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[Test 7] No critical JavaScript errors...');
    
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    
    await page.reload();
    await page.waitForTimeout(1000);
    
    if (errors.length === 0) {
      console.log('  ✓ No JS errors detected');
    } else {
      console.log('  ✗ JS errors found:', errors);
      allPassed = false;
    }
    
  } catch (error) {
    console.error('\n[Test] Error:', error.message);
    allPassed = false;
  } finally {
    // Cleanup
    if (browser) await browser.close();
    if (server) server.kill();
    
    // Cleanup test files
    const testDir = path.join(__dirname, '..', 'test-files');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('  \x1b[32m✓ ALL SMOKE TESTS PASSED\x1b[0m');
  } else {
    console.log('  \x1b[31m✗ SOME TESTS FAILED\x1b[0m');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  return allPassed;
}

// Run if executed directly
if (require.main === module) {
  runSmokeTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runSmokeTests };
