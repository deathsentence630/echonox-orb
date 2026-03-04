// desktop-assistant/features/rag/rag.utils.js

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Simple chunker: paragraph-ish chunks with overlap.
// Works well for MD/TXT/PDF extracted text.
function chunkText(text, opts = {}) {
  const {
    maxChars = 1400,
    minChars = 250,
    overlapChars = 250,
  } = opts;

  const clean = normalizeWhitespace(text);
  if (!clean) return [];

  // Split by blank lines first (paragraph boundaries)
  const paras = clean.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);

  const chunks = [];
  let buf = '';

  function flush() {
    const t = buf.trim();
    if (t.length) chunks.push(t);
    buf = '';
  }

  for (const p of paras) {
    if (!buf) {
      buf = p;
      continue;
    }

    if ((buf.length + 2 + p.length) <= maxChars) {
      buf += '\n\n' + p;
    } else {
      // if buffer too small, try to add anyway to avoid tiny chunk
      if (buf.length < minChars && p.length < maxChars) {
        buf += '\n\n' + p;
        flush();
      } else {
        flush();
        buf = p;
      }
    }
  }
  flush();

  // Apply overlap by carrying tail of previous chunk
  if (overlapChars > 0 && chunks.length > 1) {
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const cur = chunks[i];
      if (i === 0) {
        out.push(cur);
        continue;
      }
      const prev = out[out.length - 1] || chunks[i - 1];
      const tail = prev.slice(clamp(prev.length - overlapChars, 0, prev.length));
      out.push((tail + '\n\n' + cur).trim());
    }
    return out;
  }

  return chunks;
}

// Cosine similarity for arrays of numbers
function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }

  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function topKByScore(items, k) {
  const kk = Math.max(0, Number(k) || 0);
  if (!kk) return [];
  return items
    .slice()
    .sort((x, y) => (y.score || 0) - (x.score || 0))
    .slice(0, kk);
}

module.exports = {
  normalizeWhitespace,
  chunkText,
  cosineSim,
  topKByScore,
};