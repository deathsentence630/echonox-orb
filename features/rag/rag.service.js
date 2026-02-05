

// /Users/dylangaly/Project/features/rag/rag.service.js
// Core RAG logic: index sources (explicit), query against selected corpora, and build context + citations.

const path = require('path');

const { chunkText, cosineSim, topKByScore, normalizeWhitespace } = require('./rag.utils');
const { loadFileText, walkFolderRecursive, statSafe, buildDocId, isSupportedFile } = require('./rag.loader');
const { embedTexts } = require('./rag.embedder');

/**
 * Build a human-readable title for a chunk source.
 */
function sourceTitle(src, filePath) {
  if (!src) return filePath ? path.basename(filePath) : 'Source';
  if (src.kind === 'note') return src.label || 'Note';
  if (filePath) return `${src.label || path.basename(src.path || filePath)} — ${path.basename(filePath)}`;
  return src.label || path.basename(src.path || 'Source');
}

function getEnabledSourceIdsForCorpus(store, corpusId) {
  const c = store.corpora.find(x => x.id === corpusId);
  if (!c) return [];
  const ids = Array.isArray(c.sourceIds) ? c.sourceIds : [];
  const enabled = new Set(store.sources.filter(s => s.enabled).map(s => s.id));
  return ids.filter(id => enabled.has(id));
}

function getEnabledSourcesByIds(store, sourceIds) {
  const set = new Set((sourceIds || []).map(String));
  return store.sources.filter(s => set.has(s.id) && s.enabled);
}

function ensureIndexShape(store) {
  if (!store.index || typeof store.index !== 'object') store.index = {};
}

function ensureSourceIndex(store, sourceId) {
  ensureIndexShape(store);
  if (!store.index[sourceId]) {
    store.index[sourceId] = {
      updatedAt: 0,
      docs: {},
      // flat list for fast retrieval
      chunks: [],
    };
  }
  return store.index[sourceId];
}

function rebuildFlatChunksForSourceIndex(srcIdx) {
  const flat = [];
  const docs = srcIdx.docs || {};
  for (const docId of Object.keys(docs)) {
    const d = docs[docId];
    if (!d || !Array.isArray(d.chunks)) continue;
    for (const ch of d.chunks) flat.push(ch);
  }
  srcIdx.chunks = flat;
}

function shouldReindexFile(docMeta, fileStat) {
  if (!docMeta || !fileStat) return true;
  const prevMtime = Number(docMeta.mtimeMs || 0);
  const curMtime = Number(fileStat.mtimeMs || 0);
  const prevSize = Number(docMeta.size || 0);
  const curSize = Number(fileStat.size || 0);
  return curMtime !== prevMtime || curSize !== prevSize;
}

async function indexNoteSource({ store, sourceId, cfg }) {
  const src = store.sources.find(s => s.id === sourceId);
  if (!src || src.kind !== 'note') return { indexed: 0, skipped: 0, errors: [] };

  const srcIdx = ensureSourceIndex(store, sourceId);

  const text = normalizeWhitespace(src.note || '');
  const docId = `${sourceId}::note`;

  const chunksText = chunkText(text, {
    maxChars: cfg.chunkMaxChars,
    minChars: cfg.chunkMinChars,
    overlapChars: cfg.chunkOverlapChars,
  });

  const embeddings = chunksText.length
    ? await embedTexts({ baseUrl: cfg.ollamaBaseUrl, model: cfg.embeddingsModel, texts: chunksText })
    : [];

  const chunks = chunksText.map((t, i) => ({
    chunkId: `${docId}::${i}`,
    text: t,
    embedding: embeddings[i],
    meta: {
      sourceId,
      docId,
      title: sourceTitle(src),
      path: '',
      kind: 'note',
      idx: i,
    },
  }));

  srcIdx.docs[docId] = {
    docId,
    kind: 'note',
    title: sourceTitle(src),
    path: '',
    mtimeMs: Date.now(),
    size: text.length,
    chunks,
    updatedAt: Date.now(),
  };

  rebuildFlatChunksForSourceIndex(srcIdx);
  srcIdx.updatedAt = Date.now();

  return { indexed: chunks.length, skipped: 0, errors: [] };
}

async function indexFileSource({ store, sourceId, cfg }) {
  const src = store.sources.find(s => s.id === sourceId);
  if (!src || (src.kind !== 'file' && src.kind !== 'folder')) {
    return { indexed: 0, skipped: 0, errors: [] };
  }

  const errors = [];
  const srcIdx = ensureSourceIndex(store, sourceId);

  let files = [];
  if (src.kind === 'file') {
    if (src.path && isSupportedFile(src.path)) files = [src.path];
  } else {
    if (src.path) files = walkFolderRecursive(src.path);
  }

  let indexed = 0;
  let skipped = 0;

  for (const filePath of files) {
    const st = statSafe(filePath);
    if (!st || !st.isFile()) continue;

    const docId = buildDocId(sourceId, filePath);
    const prev = srcIdx.docs?.[docId];

    if (!shouldReindexFile(prev, st)) {
      skipped++;
      continue;
    }

    let text = '';
    try {
      text = await loadFileText(filePath);
    } catch (e) {
      errors.push({ filePath, error: String(e?.message || e) });
      continue;
    }

    const clean = normalizeWhitespace(text);
    if (!clean) {
      // store empty doc meta to avoid repeated work
      srcIdx.docs[docId] = {
        docId,
        kind: 'file',
        title: sourceTitle(src, filePath),
        path: filePath,
        mtimeMs: st.mtimeMs,
        size: st.size,
        chunks: [],
        updatedAt: Date.now(),
      };
      continue;
    }

    const chunksText = chunkText(clean, {
      maxChars: cfg.chunkMaxChars,
      minChars: cfg.chunkMinChars,
      overlapChars: cfg.chunkOverlapChars,
    });

    let embeddings = [];
    try {
      embeddings = chunksText.length
        ? await embedTexts({ baseUrl: cfg.ollamaBaseUrl, model: cfg.embeddingsModel, texts: chunksText })
        : [];
    } catch (e) {
      errors.push({ filePath, error: String(e?.message || e) });
      continue;
    }

    const chunks = chunksText.map((t, i) => ({
      chunkId: `${docId}::${i}`,
      text: t,
      embedding: embeddings[i],
      meta: {
        sourceId,
        docId,
        title: sourceTitle(src, filePath),
        path: filePath,
        kind: 'file',
        idx: i,
      },
    }));

    srcIdx.docs[docId] = {
      docId,
      kind: 'file',
      title: sourceTitle(src, filePath),
      path: filePath,
      mtimeMs: st.mtimeMs,
      size: st.size,
      chunks,
      updatedAt: Date.now(),
    };

    indexed += chunks.length;
  }

  rebuildFlatChunksForSourceIndex(srcIdx);
  srcIdx.updatedAt = Date.now();

  return { indexed, skipped, errors };
}

async function indexSources({ store, sourceIds, cfg }) {
  const ids = Array.isArray(sourceIds) ? sourceIds.map(String) : [];
  const enabledSet = new Set(store.sources.filter(s => s.enabled).map(s => s.id));

  let indexed = 0;
  let skipped = 0;
  const errors = [];

  for (const id of ids) {
    if (!enabledSet.has(id)) continue;

    const src = store.sources.find(s => s.id === id);
    if (!src) continue;

    try {
      if (src.kind === 'note') {
        const r = await indexNoteSource({ store, sourceId: id, cfg });
        indexed += r.indexed;
        skipped += r.skipped;
        errors.push(...r.errors);
      } else {
        const r = await indexFileSource({ store, sourceId: id, cfg });
        indexed += r.indexed;
        skipped += r.skipped;
        errors.push(...r.errors);
      }
    } catch (e) {
      errors.push({ sourceId: id, error: String(e?.message || e) });
    }
  }

  return { indexed, skipped, errors };
}

function listIndexStatus(store) {
  ensureIndexShape(store);

  let sourcesIndexed = 0;
  let chunks = 0;

  for (const sid of Object.keys(store.index)) {
    const idx = store.index[sid];
    if (!idx) continue;
    sourcesIndexed++;
    chunks += Array.isArray(idx.chunks) ? idx.chunks.length : 0;
  }

  return {
    sourcesIndexed,
    chunks,
    updatedAt: Math.max(0, ...Object.values(store.index).map(i => Number(i?.updatedAt || 0))),
  };
}

function collectChunksForCorpusSelection(store, corpusIds) {
  ensureIndexShape(store);

  const enabledSourceIds = new Set();
  for (const cid of corpusIds) {
    for (const sid of getEnabledSourceIdsForCorpus(store, cid)) enabledSourceIds.add(sid);
  }

  const chunks = [];
  for (const sid of enabledSourceIds) {
    const idx = store.index[sid];
    if (!idx || !Array.isArray(idx.chunks)) continue;
    for (const ch of idx.chunks) chunks.push(ch);
  }

  return chunks;
}

async function retrieveTopChunks({ store, corpusIds, queryText, cfg }) {
  const allChunks = collectChunksForCorpusSelection(store, corpusIds);
  if (!allChunks.length) return [];

  const [qEmb] = await embedTexts({ baseUrl: cfg.ollamaBaseUrl, model: cfg.embeddingsModel, texts: [queryText] });

  const scored = allChunks.map(ch => {
    const score = cosineSim(qEmb, ch.embedding);
    return { score, chunk: ch };
  });

  const top = topKByScore(scored, cfg.topK);
  return top.filter(x => (x.score || 0) >= cfg.minScore);
}

function buildContextFromChunks({ topChunks, cfg }) {
  const maxChars = Number(cfg.maxContextChars || 9000);

  const sources = [];
  const used = [];

  let usedChars = 0;
  let n = 0;

  for (const item of topChunks) {
    const ch = item.chunk;
    const meta = ch.meta || {};
    const snippet = String(ch.text || '').trim();
    if (!snippet) continue;

    const entry = {
      n: ++n,
      score: item.score,
      title: meta.title || 'Source',
      path: meta.path || '',
      kind: meta.kind || 'file',
      snippet: snippet.slice(0, 900),
    };

    // context block with inline citation marker
    const block = `[#${entry.n}] ${entry.title}${entry.path ? ` (${entry.path})` : ''}\n${snippet}`;
    const addLen = block.length + 2;

    if (usedChars + addLen > maxChars) break;

    usedChars += addLen;
    used.push(block);
    sources.push(entry);
  }

  const context = used.length ? used.join('\n\n') : '';
  return { context, sources };
}

/**
 * Public API: query RAG and return context + sources.
 */
async function ragQuery({ store, corpusIds, queryText }) {
  const cfg = store.config;
  const q = normalizeWhitespace(queryText || '');
  if (!q) return { context: '', sources: [] };

  const top = await retrieveTopChunks({ store, corpusIds, queryText: q, cfg });
  const { context, sources } = buildContextFromChunks({ topChunks: top, cfg });
  return { context, sources };
}

module.exports = {
  indexSources,
  listIndexStatus,
  ragQuery,
  getEnabledSourcesByIds,
  getEnabledSourceIdsForCorpus,
};