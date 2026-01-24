/* rename-upload.js
   - permite upload multi fișiere (same-name allowed)
   - redenumește fiecare fișier în format DD.MM.YY_index.ext
   - oferă download individual și Download All (ZIP)
*/

(function () {
  const fileInput = document.getElementById('fileInput');
  const selectBtn = document.getElementById('selectBtn');
  const dropZone = document.getElementById('dropZone');
  const processBtn = document.getElementById('processBtn');
  const zipBtn = document.getElementById('zipBtn');
  const clearBtn = document.getElementById('clearBtn');
  const listSection = document.getElementById('listSection');
  const filesTableBody = document.querySelector('#filesTable tbody');

  let uploadedFiles = []; // { file: File, originalName, newName, renamedFile }

  function formatShortDate(d = new Date()) {
    // Return format: yy.mm.dd (two-digit year first)
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${yy}.${mm}.${dd}`;
  }

  function getExtension(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i) : '';
  }

  function bytesToSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

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
    zipBtn.disabled = uploadedFiles.every(f => !f.renamedFile);

    uploadedFiles.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const iTd = document.createElement('td'); iTd.textContent = idx + 1;
      const origTd = document.createElement('td'); origTd.textContent = item.originalName;
      const newTd = document.createElement('td'); newTd.textContent = item.newName || '-';
      const sizeTd = document.createElement('td'); sizeTd.textContent = bytesToSize(item.file.size);
      const actTd = document.createElement('td');

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-small';
      downloadBtn.textContent = 'Download';
      downloadBtn.disabled = !item.renamedFile;
      downloadBtn.addEventListener('click', () => downloadFile(item));

      actTd.appendChild(downloadBtn);

      tr.appendChild(iTd);
      tr.appendChild(origTd);
      tr.appendChild(newTd);
      tr.appendChild(sizeTd);
      tr.appendChild(actTd);
      filesTableBody.appendChild(tr);
    });
  }

  function downloadFile(item) {
    if (!item.renamedFile) return;
    const url = URL.createObjectURL(item.renamedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.renamedFile.name || item.newName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadAllZip() {
    const zip = new JSZip();
    for (const item of uploadedFiles) {
      if (!item.renamedFile) continue;
      // Blob/ File are both OK with zip.file
      const blob = item.renamedFile instanceof Blob ? item.renamedFile : new Blob([item.renamedFile]);
      zip.file(item.renamedFile.name || item.newName, blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const zipName = `renamed_${formatShortDate()}_${Date.now()}.zip`;
    saveAs(content, zipName);
  }

  async function processAndRename() {
    if (uploadedFiles.length === 0) return;
    const datePrefix = formatShortDate();

    for (let i = 0; i < uploadedFiles.length; i++) {
      const entry = uploadedFiles[i];
      const ext = getExtension(entry.originalName) || '.pdf';
      const index = i + 1;
      const safeName = `${datePrefix}_${index}${ext}`;
      entry.newName = safeName;

      try {
        const blob = entry.file.slice(0, entry.file.size, entry.file.type);
        const newFile = new File([blob], safeName, { type: entry.file.type });
        entry.renamedFile = newFile;
      } catch (err) {
        const blob = entry.file.slice(0, entry.file.size, entry.file.type);
        blob.name = safeName; // not all browsers allow name on Blob
        entry.renamedFile = blob;
      }
    }

    renderList();
    zipBtn.disabled = false;
  }

  function handleFiles(fileList) {
    const arr = Array.from(fileList);
    for (const f of arr) {
      uploadedFiles.push({ file: f, originalName: f.name, newName: null, renamedFile: null });
    }
    renderList();
  }

  selectBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      handleFiles(e.target.files);
      fileInput.value = '';
    }
  });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', (e) => { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      handleFiles(dt.files);
    }
  });

  processBtn.addEventListener('click', async () => {
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';
    await processAndRename();
    processBtn.textContent = 'Process & Rename';
    processBtn.disabled = false;
  });

  zipBtn.addEventListener('click', () => downloadAllZip());

  clearBtn.addEventListener('click', () => {
    uploadedFiles = [];
    renderList();
  });

  renderList();

  // === Testing / programmatic API (exposed for automated tests) ===
  // Expose a minimal API so tests can add files programmatically and run the renaming
  window.RenameUpload = {
    // addFiles accepts an array (or FileList) of File/Blob-like objects
    addFiles: function(files) {
      // convert FileList-like to array of File objects
      if (!files) return;
      if (files instanceof FileList || files instanceof Array) {
        handleFiles(files);
      } else if (files.item && typeof files.item === 'function') {
        // FileList-like
        const arr = [];
        for (let i = 0; i < files.length; i++) arr.push(files.item(i));
        handleFiles(arr);
      }
    },
    // trigger the same processing used by UI
    process: async function() {
      await processAndRename();
    },
    // returns a deep copy of the uploadedFiles state for inspection
    getState: function() {
      return uploadedFiles.map(u => ({ originalName: u.originalName, newName: u.newName, size: u.file.size, renamedPresent: !!u.renamedFile }));
    },
    // expose internal uploadedFiles for advanced tests (read-only reference)
    _internal: function() { return uploadedFiles; }
  };

})();
