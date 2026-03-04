// desktop-assistant/features/rag/rag.store.js
const fs = require('fs');
const path = require('path');

const RAG_STORE_VERSION = 1;

function ragStorePath(app) {
  return path.join(app.getPath('userData'), 'rag-store.enc');
}

function defaultRagStore() {
  return {
    version: RAG_STORE_VERSION,

    // All sources are explicit & listable
    // sources: [{ id, kind:'file'|'folder'|'note', label, path, enabled, createdAt, updatedAt }]
    sources: [],

    // corpora: [{ id, name, sourceIds: [] }]
    corpora: [],

    // conversation corpus selection: { [threadId]: { corpusIds: [] } }
    convo: {},

    // index: { sourceId: { docId, chunks:[{ chunkId, text, embedding, meta }], updatedAt } }
    index: {},

    // config
    config: {
      // Ollama local by default (privacy-first like llm:chat)
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      embeddingsModel: 'nomic-embed-text',
      // retrieval params
      topK: 6,
      minScore: 0.18,
      // chunking params
      chunkMaxChars: 1400,
      chunkMinChars: 250,
      chunkOverlapChars: 250,
      // prompt budget (rough guard)
      maxContextChars: 9000,
    },
  };
}

function readRagStore(app, safeStorage) {
  const p = ragStorePath(app);
  if (!fs.existsSync(p)) return defaultRagStore();

  const raw = fs.readFileSync(p);

  if (!safeStorage?.isEncryptionAvailable?.()) {
    // Keep the privacy guarantee: no plaintext load.
    return defaultRagStore();
  }

  try {
    const json = safeStorage.decryptString(raw);
    const data = JSON.parse(json);
    if (!data || data.version !== RAG_STORE_VERSION) return defaultRagStore();

    // Minimal shape validation
    if (!Array.isArray(data.sources)) data.sources = [];
    if (!Array.isArray(data.corpora)) data.corpora = [];
    if (!data.convo || typeof data.convo !== 'object') data.convo = {};
    if (!data.index || typeof data.index !== 'object') data.index = {};
    if (!data.config || typeof data.config !== 'object') data.config = defaultRagStore().config;

    return data;
  } catch (_) {
    return defaultRagStore();
  }
}

function writeRagStore(app, safeStorage, store) {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error('safeStorage encryption is not available on this system.');
  }
  const p = ragStorePath(app);
  const json = JSON.stringify(store);
  const enc = safeStorage.encryptString(json);
  fs.writeFileSync(p, enc);
}

function nowTs() {
  return Date.now();
}

function newId(prefix = 'r') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- Sources ----------
function listSources(store) {
  return store.sources.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function addSource(store, payload) {
  const kind = String(payload?.kind || 'file');
  const label = String(payload?.label || '').trim();
  const pth = payload?.path ? String(payload.path) : '';
  if (!['file', 'folder', 'note'].includes(kind)) throw new Error('Invalid source kind.');
  if (kind !== 'note' && !pth) throw new Error('Missing path.');
  if (!label && kind === 'note') throw new Error('Missing label for note.');

  const id = newId('src');
  const ts = nowTs();

  const src = {
    id,
    kind,
    label: label || path.basename(pth),
    path: pth || '',
    enabled: payload?.enabled !== false,
    createdAt: ts,
    updatedAt: ts,
    // For notes we can store content directly (optional)
    note: kind === 'note' ? String(payload?.note || '') : undefined,
  };

  store.sources.push(src);
  return src;
}

function updateSource(store, payload) {
  const id = String(payload?.id || '');
  const src = store.sources.find(s => s.id === id);
  if (!src) throw new Error('Source not found.');

  if (payload.label != null) src.label = String(payload.label).trim() || src.label;
  if (payload.enabled != null) src.enabled = !!payload.enabled;

  if (src.kind === 'note' && payload.note != null) src.note = String(payload.note);

  src.updatedAt = nowTs();
  return src;
}

function deleteSource(store, sourceId) {
  const id = String(sourceId || '');
  const before = store.sources.length;
  store.sources = store.sources.filter(s => s.id !== id);

  // Remove from corpora
  for (const c of store.corpora) {
    c.sourceIds = Array.isArray(c.sourceIds) ? c.sourceIds.filter(x => x !== id) : [];
  }

  // Remove indexed data
  if (store.index && store.index[id]) delete store.index[id];

  return store.sources.length !== before;
}

// ---------- Corpora ----------
function listCorpora(store) {
  return store.corpora.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function upsertCorpus(store, payload) {
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('Corpus name is required.');

  const sourceIds = Array.isArray(payload?.sourceIds) ? payload.sourceIds.map(String) : [];
  const unique = Array.from(new Set(sourceIds));

  let corpus = null;
  if (payload?.id) {
    const id = String(payload.id);
    corpus = store.corpora.find(c => c.id === id) || null;
  }

  const ts = nowTs();

  if (!corpus) {
    corpus = { id: newId('corpus'), name, sourceIds: unique, createdAt: ts, updatedAt: ts };
    store.corpora.push(corpus);
  } else {
    corpus.name = name;
    corpus.sourceIds = unique;
    corpus.updatedAt = ts;
  }

  return corpus;
}

function deleteCorpus(store, corpusId) {
  const id = String(corpusId || '');
  const before = store.corpora.length;
  store.corpora = store.corpora.filter(c => c.id !== id);

  // Remove from convo selections
  if (store.convo && typeof store.convo === 'object') {
    for (const tid of Object.keys(store.convo)) {
      const entry = store.convo[tid];
      if (!entry || !Array.isArray(entry.corpusIds)) continue;
      entry.corpusIds = entry.corpusIds.filter(x => x !== id);
    }
  }

  return store.corpora.length !== before;
}

// ---------- Conversation selection ----------
function getConversationSelection(store, threadId) {
  const tid = String(threadId || '');
  const entry = store.convo?.[tid];
  return Array.isArray(entry?.corpusIds) ? entry.corpusIds.slice() : [];
}

function setConversationSelection(store, threadId, corpusIds) {
  const tid = String(threadId || '');
  if (!tid) throw new Error('threadId is required.');

  const ids = Array.isArray(corpusIds) ? corpusIds.map(String) : [];
  store.convo[tid] = { corpusIds: Array.from(new Set(ids)) };
  return store.convo[tid];
}

// ---------- Config ----------
function getConfig(store) {
  return { ...(store.config || defaultRagStore().config) };
}

function setConfig(store, partial) {
  if (!store.config) store.config = defaultRagStore().config;
  const cfg = store.config;

  if (partial?.ollamaBaseUrl != null) cfg.ollamaBaseUrl = String(partial.ollamaBaseUrl);
  if (partial?.embeddingsModel != null) cfg.embeddingsModel = String(partial.embeddingsModel);

  if (partial?.topK != null) cfg.topK = Number(partial.topK) || cfg.topK;
  if (partial?.minScore != null) cfg.minScore = Number(partial.minScore);
  if (partial?.chunkMaxChars != null) cfg.chunkMaxChars = Number(partial.chunkMaxChars) || cfg.chunkMaxChars;
  if (partial?.chunkMinChars != null) cfg.chunkMinChars = Number(partial.chunkMinChars) || cfg.chunkMinChars;
  if (partial?.chunkOverlapChars != null) cfg.chunkOverlapChars = Number(partial.chunkOverlapChars) || cfg.chunkOverlapChars;
  if (partial?.maxContextChars != null) cfg.maxContextChars = Number(partial.maxContextChars) || cfg.maxContextChars;

  return getConfig(store);
}

module.exports = {
  RAG_STORE_VERSION,
  defaultRagStore,
  readRagStore,
  writeRagStore,

  listSources,
  addSource,
  updateSource,
  deleteSource,

  listCorpora,
  upsertCorpus,
  deleteCorpus,

  getConversationSelection,
  setConversationSelection,

  getConfig,
  setConfig,

  newId,
};