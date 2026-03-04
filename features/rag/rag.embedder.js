

// /Users/dylangaly/Project/features/rag/rag.embedder.js
// Ollama embeddings client (local-only). No data leaves the machine.

// Node 18+ usually has global fetch. Electron main may as well, but we add a safe fallback.
let _fetch = null;

async function getFetch() {
  if (_fetch) return _fetch;
  if (typeof fetch === 'function') {
    _fetch = fetch;
    return _fetch;
  }
  try {
    // Optional dependency fallback
    const undici = require('undici');
    _fetch = undici.fetch;
    return _fetch;
  } catch (_) {
    throw new Error('No fetch available. Upgrade Node/Electron or add undici.');
  }
}

function normalizeBaseUrl(u) {
  const s = String(u || '').trim() || 'http://127.0.0.1:11434';
  return s.replace(/\/$/, '');
}

async function ollamaEmbeddings({ baseUrl, model, input }) {
  const f = await getFetch();
  const url = `${normalizeBaseUrl(baseUrl)}/api/embeddings`;

  const res = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: input }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Ollama embeddings error (${res.status}): ${txt || res.statusText}`);
  }

  const data = await res.json();
  const emb = data?.embedding;
  if (!Array.isArray(emb) || emb.length === 0) {
    throw new Error('Ollama embeddings: invalid embedding returned.');
  }
  return emb;
}

async function embedTexts({ baseUrl, model, texts }) {
  const list = Array.isArray(texts) ? texts : [];
  const out = [];

  // Sequential calls for stability (avoids hammering Ollama). Can be optimized later.
  for (const t of list) {
    const emb = await ollamaEmbeddings({ baseUrl, model, input: String(t || '') });
    out.push(emb);
  }

  return out;
}

module.exports = {
  embedTexts,
  ollamaEmbeddings,
};