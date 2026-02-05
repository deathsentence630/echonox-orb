

// /Users/dylangaly/Project/features/rag/rag.loader.js
// Responsible for loading and extracting text from user-selected sources.
// Supports: TXT, MD, PDF (via pdf-parse). Notes are stored directly in the rag store.

const fs = require('fs');
const path = require('path');

let pdfParse = null;

function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.txt', '.md', '.markdown', '.pdf'].includes(ext);
}

function detectKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.md' || ext === '.markdown') return 'md';
  return 'txt';
}

function safeReadFileUtf8(filePath) {
  // Best-effort. For binary files we won't call this.
  return fs.readFileSync(filePath, 'utf8');
}

async function readPdfText(filePath) {
  if (!pdfParse) {
    try {
      // Lazy-load to avoid requiring pdf-parse unless needed.
      pdfParse = require('pdf-parse');
    } catch (e) {
      throw new Error('Missing dependency: pdf-parse. Run npm install.');
    }
  }

  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  // data.text is the extracted text
  return String(data?.text || '').trim();
}

async function loadFileText(filePath) {
  const kind = detectKind(filePath);
  if (kind === 'pdf') return await readPdfText(filePath);
  return safeReadFileUtf8(filePath);
}

function walkFolderRecursive(folderPath, opts = {}) {
  const { maxFiles = 2000 } = opts;
  const out = [];

  function walk(dir) {
    if (out.length >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const ent of entries) {
      if (out.length >= maxFiles) return;

      // Skip hidden folders/files by default
      if (ent.name.startsWith('.')) continue;

      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile()) {
        if (isSupportedFile(full)) out.push(full);
      }
    }
  }

  walk(folderPath);
  return out;
}

function statSafe(p) {
  try {
    return fs.statSync(p);
  } catch (_) {
    return null;
  }
}

function buildDocId(sourceId, filePath) {
  // Stable enough across runs for the same file
  return `${sourceId}::${path.resolve(filePath)}`;
}

module.exports = {
  isSupportedFile,
  detectKind,
  loadFileText,
  walkFolderRecursive,
  statSafe,
  buildDocId,
};