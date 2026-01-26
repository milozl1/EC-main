/* rename-upload.js v2.0
  - Upload multiple files (same-name allowed)
  - Rename each file to format: yymmdd_index.ext
  - Individual download + Download All (ZIP)
  - Improved: validation, error handling, security, UX
*/

(function () {
  'use strict';

  // === Configuration ===
  const CONFIG = {
    maxFiles: 100,                    // Maximum number of files allowed
    maxFileSizeMB: 50,                // Maximum size per file in MB
    maxTotalSizeMB: 500,              // Maximum total size in MB
    allowedExtensions: ['.pdf'],      // Allowed file extensions (empty = allow all)
    strictExtensionCheck: false,      // If true, reject non-matching extensions
    dateFormat: 'yymmdd'            // Date format used in renamed files
  };

  // === DOM Elements ===
  const fileInput = document.getElementById('fileInput');
  const selectBtn = document.getElementById('selectBtn');
  const dropZone = document.getElementById('dropZone');
  const processBtn = document.getElementById('processBtn');
  const zipBtn = document.getElementById('zipBtn');
  const clearBtn = document.getElementById('clearBtn');
  const listSection = document.getElementById('listSection');
  const filesTableBody = document.querySelector('#filesTable tbody');

  // === State ===
  let uploadedFiles = []; // { file: File, originalName: string, newName: string|null, renamedFile: File|Blob|null, error: string|null }

  // === Utility Functions ===

  /**
   * Format date as yymmdd
   * @param {Date} d - Date object (defaults to now)
   * @returns {string} Formatted date string e.g. '240126' (for 26 Jan 2024)
   */
  function formatShortDate(d = new Date()) {
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  /**
   * Extract file extension from filename
   * @param {string} name - Filename
   * @returns {string} Extension including dot, or empty string
   */
  function getExtension(name) {
    if (!name || typeof name !== 'string') return '';
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i).toLowerCase() : '';
  }

  /**
   * Sanitize filename for display (prevent XSS)
   * @param {string} name - Raw filename
   * @returns {string} Sanitized filename
   */
  function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'unknown';
    // Remove or encode potentially dangerous characters
    return name
      .replace(/[<>:"\/\\|?*]/g, '_')
      .slice(0, 255); // Limit length
  }

  /**
   * Convert bytes to human-readable size
   * @param {number} bytes - Size in bytes
   * @returns {string} Human-readable size
   */
  function bytesToSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Calculate total size of uploaded files
   * @returns {number} Total size in bytes
   */
  function getTotalSize() {
    return uploadedFiles.reduce((sum, item) => sum + (item.file?.size || 0), 0);
  }

  /**
   * Validate a single file
   * @param {File} file - File to validate
   * @returns {{ valid: boolean, error: string|null }}
   */
  function validateFile(file) {
    // Check if file exists
    if (!file || !(file instanceof File || file instanceof Blob)) {
      return { valid: false, error: 'Invalid file object' };
    }

    // Check file size
    const maxBytes = CONFIG.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return { valid: false, error: `File too large (max ${CONFIG.maxFileSizeMB}MB)` };
    }

    // Check extension if strict mode
    if (CONFIG.strictExtensionCheck && CONFIG.allowedExtensions.length > 0) {
      const ext = getExtension(file.name);
      if (!CONFIG.allowedExtensions.includes(ext)) {
        return { valid: false, error: `Invalid extension (allowed: ${CONFIG.allowedExtensions.join(', ')})` };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Show a toast/notification message
   * @param {string} message - Message to display
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   */
  function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 9999;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;

    // Set background color based on type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    toast.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // === Core Functions ===

  /**
   * Render the file list table
   */
  function renderList() {
    filesTableBody.innerHTML = '';

    if (uploadedFiles.length === 0) {
      listSection.style.display = 'none';
      processBtn.disabled = true;
      zipBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    listSection.style.display = 'block';
    processBtn.disabled = false;
    clearBtn.disabled = false;

    const hasRenamedFiles = uploadedFiles.some(f => f.renamedFile);
    zipBtn.disabled = !hasRenamedFiles;

    uploadedFiles.forEach((item, idx) => {
      const tr = document.createElement('tr');

      // Index column
      const iTd = document.createElement('td');
      iTd.textContent = idx + 1;

      // Original name column (sanitized)
      const origTd = document.createElement('td');
      origTd.textContent = sanitizeFilename(item.originalName);
      origTd.title = item.originalName; // Full name on hover

      // New name column
      const newTd = document.createElement('td');
      if (item.error) {
        newTd.innerHTML = `<span style="color:#ef4444">⚠ ${item.error}</span>`;
      } else {
        newTd.textContent = item.newName || '—';
      }

      // Size column
      const sizeTd = document.createElement('td');
      sizeTd.textContent = bytesToSize(item.file?.size || 0);

      // Actions column
      const actTd = document.createElement('td');

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-small';
      downloadBtn.textContent = 'Download';
      downloadBtn.disabled = !item.renamedFile;
      downloadBtn.setAttribute('aria-label', `Download ${item.newName || item.originalName}`);
      downloadBtn.addEventListener('click', () => downloadFile(item));

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-small btn-danger';
      removeBtn.textContent = '✕';
      removeBtn.style.marginLeft = '6px';
      removeBtn.setAttribute('aria-label', `Remove ${item.originalName}`);
      removeBtn.addEventListener('click', () => removeFile(idx));

      actTd.appendChild(downloadBtn);
      actTd.appendChild(removeBtn);

      tr.appendChild(iTd);
      tr.appendChild(origTd);
      tr.appendChild(newTd);
      tr.appendChild(sizeTd);
      tr.appendChild(actTd);
      filesTableBody.appendChild(tr);
    });

    // Update counter in header if exists
    const counter = document.getElementById('fileCounter');
    if (counter) {
      counter.textContent = `${uploadedFiles.length} file(s), ${bytesToSize(getTotalSize())}`;
    }
  }

  /**
   * Remove a file from the list
   * @param {number} index - Index to remove
   */
  function removeFile(index) {
    if (index >= 0 && index < uploadedFiles.length) {
      uploadedFiles.splice(index, 1);
      renderList();
    }
  }

  /**
   * Download a single renamed file
   * @param {Object} item - File item from uploadedFiles
   */
  function downloadFile(item) {
    if (!item.renamedFile) {
      showToast('File not processed yet', 'warning');
      return;
    }

    let url;
    try {
      url = URL.createObjectURL(item.renamedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.renamedFile.name || item.newName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Download failed:', err);
      showToast('Download failed', 'error');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  /**
   * Download all renamed files as a ZIP
   */
  async function downloadAllZip() {
    const filesToZip = uploadedFiles.filter(item => item.renamedFile);

    if (filesToZip.length === 0) {
      showToast('No processed files to download', 'warning');
      return;
    }

    // Show loading state
    zipBtn.disabled = true;
    const originalText = zipBtn.textContent;
    zipBtn.textContent = 'Creating ZIP...';

    try {
      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded');
      }

      const zip = new JSZip();

      for (const item of filesToZip) {
        const blob = item.renamedFile instanceof Blob
          ? item.renamedFile
          : new Blob([item.renamedFile]);
        const filename = item.renamedFile.name || item.newName || `file_${Date.now()}`;
        zip.file(filename, blob);
      }

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const zipName = `renamed_${formatShortDate()}_${Date.now()}.zip`;

      // Check if saveAs is available
      if (typeof saveAs === 'undefined') {
        // Fallback download method
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        saveAs(content, zipName);
      }

      showToast(`Downloaded ${filesToZip.length} files as ZIP`, 'success');
    } catch (err) {
      console.error('ZIP creation failed:', err);
      showToast(`ZIP failed: ${err.message}`, 'error');
    } finally {
      zipBtn.textContent = originalText;
      zipBtn.disabled = false;
    }
  }

  /**
   * Process and rename all uploaded files
   */
  async function processAndRename() {
    if (uploadedFiles.length === 0) {
      showToast('No files to process', 'warning');
      return;
    }

    const datePrefix = formatShortDate();

    for (let i = 0; i < uploadedFiles.length; i++) {
      const entry = uploadedFiles[i];

      // Skip already processed files
      if (entry.renamedFile) continue;

      // Clear previous error
      entry.error = null;

      try {
        const ext = getExtension(entry.originalName) || '.pdf';
        const index = i + 1;
        const safeName = `${datePrefix}_${index}${ext}`;
        entry.newName = safeName;

        // Create a new File with the new name
        const blob = entry.file.slice(0, entry.file.size, entry.file.type);
        entry.renamedFile = new File([blob], safeName, {
          type: entry.file.type || 'application/octet-stream',
          lastModified: entry.file.lastModified || Date.now()
        });
      } catch (err) {
        console.error(`Failed to process file ${i + 1}:`, err);
        entry.error = 'Processing failed';

        // Fallback: try with Blob
        try {
          const blob = entry.file.slice(0, entry.file.size, entry.file.type);
          blob.name = entry.newName;
          entry.renamedFile = blob;
          entry.error = null;
        } catch (fallbackErr) {
          entry.error = 'Processing failed';
        }
      }
    }

    renderList();

    const successCount = uploadedFiles.filter(f => f.renamedFile).length;
    showToast(`Processed ${successCount}/${uploadedFiles.length} files`, 'success');
  }

  /**
   * Handle incoming files (from input or drag-drop)
   * @param {FileList|File[]} fileList - Files to add
   */
  function handleFiles(fileList) {
    const arr = Array.from(fileList);

    if (arr.length === 0) return;

    // Check max files limit
    if (uploadedFiles.length + arr.length > CONFIG.maxFiles) {
      showToast(`Maximum ${CONFIG.maxFiles} files allowed`, 'error');
      return;
    }

    // Check total size limit
    const newTotalSize = getTotalSize() + arr.reduce((sum, f) => sum + (f.size || 0), 0);
    const maxTotalBytes = CONFIG.maxTotalSizeMB * 1024 * 1024;
    if (newTotalSize > maxTotalBytes) {
      showToast(`Total size exceeds ${CONFIG.maxTotalSizeMB}MB limit`, 'error');
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const f of arr) {
      const validation = validateFile(f);

      if (!validation.valid) {
        console.warn(`Skipped file "${f.name}": ${validation.error}`);
        skippedCount++;
        continue;
      }

      uploadedFiles.push({
        file: f,
        originalName: f.name,
        newName: null,
        renamedFile: null,
        error: null
      });
      addedCount++;
    }

    renderList();

    if (addedCount > 0) {
      showToast(`Added ${addedCount} file(s)`, 'success');
    }
    if (skippedCount > 0) {
      showToast(`Skipped ${skippedCount} invalid file(s)`, 'warning');
    }
  }

  /**
   * Clear all files with confirmation
   */
  function clearAllFiles() {
    if (uploadedFiles.length === 0) return;

    const confirmed = confirm(`Are you sure you want to remove all ${uploadedFiles.length} file(s)?`);
    if (confirmed) {
      uploadedFiles = [];
      renderList();
      showToast('All files cleared', 'info');
    }
  }

  // === Event Listeners ===

  selectBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      handleFiles(e.target.files);
      fileInput.value = ''; // Reset to allow re-selecting same file
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      handleFiles(dt.files);
    }
  });

  processBtn.addEventListener('click', async () => {
    processBtn.disabled = true;
    const originalText = processBtn.textContent;
    processBtn.textContent = 'Processing...';

    try {
      await processAndRename();
    } catch (err) {
      console.error('Processing error:', err);
      showToast('Processing failed', 'error');
    } finally {
      processBtn.textContent = originalText;
      processBtn.disabled = uploadedFiles.length === 0;
    }
  });

  zipBtn.addEventListener('click', () => downloadAllZip());

  clearBtn.addEventListener('click', () => clearAllFiles());

  // Keyboard accessibility
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Make drop zone focusable
  dropZone.setAttribute('tabindex', '0');
  dropZone.setAttribute('role', 'button');
  dropZone.setAttribute('aria-label', 'Drop zone for file upload. Press Enter to select files.');

  // Initial render
  renderList();

  // === Testing / Programmatic API ===
  window.RenameUpload = {
    // Add files programmatically
    addFiles: function(files) {
      if (!files) return;
      const arr = files instanceof FileList || files instanceof Array
        ? Array.from(files)
        : files.item ? Array.from({ length: files.length }, (_, i) => files.item(i)) : [];
      handleFiles(arr);
    },

    // Trigger processing
    process: async function() {
      await processAndRename();
    },

    // Get current state (safe copy)
    getState: function() {
      return uploadedFiles.map(u => ({
        originalName: u.originalName,
        newName: u.newName,
        size: u.file?.size || 0,
        renamedPresent: !!u.renamedFile,
        error: u.error
      }));
    },

    // Get internal state reference (for testing)
    _internal: function() { return uploadedFiles; },

    // Clear all files (bypasses confirmation)
    clear: function() {
      uploadedFiles = [];
      renderList();
    },

    // Get configuration
    getConfig: function() { return { ...CONFIG }; }
  };

  // Add toast animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

})();
