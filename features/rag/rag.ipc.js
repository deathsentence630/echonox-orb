// /Users/dylangaly/Project/features/rag/rag.ipc.js
// IPC layer for RAG feature. Keeps everything local and explicit.

const { dialog, BrowserWindow } = require('electron');

const {
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
} = require('./rag.store');

const { indexSources, listIndexStatus, ragQuery } = require('./rag.service');

function requireEncryption(safeStorage) {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error('Encryption is not available (safeStorage). RAG store cannot be used safely.');
  }
}

function loadStore(app, safeStorage) {
  requireEncryption(safeStorage);
  return readRagStore(app, safeStorage);
}

function saveStore(app, safeStorage, store) {
  requireEncryption(safeStorage);
  writeRagStore(app, safeStorage, store);
}

function registerRagIpc(ipcMain, { app, safeStorage }) {
  if (!ipcMain) throw new Error('ipcMain is required');
  if (!app) throw new Error('app is required');

  // --- Status ---
  ipcMain.handle('rag:status', async () => {
    const store = loadStore(app, safeStorage);
    return {
      ok: true,
      status: listIndexStatus(store),
      sources: listSources(store),
      corpora: listCorpora(store),
      config: getConfig(store),
    };
  });

  // --- Config ---
  ipcMain.handle('rag:config:get', async () => {
    const store = loadStore(app, safeStorage);
    return { ok: true, config: getConfig(store) };
  });

  ipcMain.handle('rag:config:set', async (_evt, partial) => {
    const store = loadStore(app, safeStorage);
    const cfg = setConfig(store, partial || {});
    saveStore(app, safeStorage, store);
    return { ok: true, config: cfg };
  });

  // --- Pickers (explicit user action) ---
  ipcMain.handle('rag:pick:files', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win || undefined, {
      title: 'Ajouter des fichiers (RAG)',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'md', 'markdown', 'txt'] },
        { name: 'Tous les fichiers', extensions: ['*'] },
      ],
    });
    return { ok: true, paths: res.canceled ? [] : (res.filePaths || []) };
  });

  ipcMain.handle('rag:pick:folder', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win || undefined, {
      title: 'Ajouter un dossier (RAG)',
      properties: ['openDirectory'],
    });
    const p = (!res.canceled && res.filePaths && res.filePaths[0]) ? res.filePaths[0] : '';
    return { ok: true, path: p };
  });

  // --- Sources CRUD ---
  ipcMain.handle('rag:sources:list', async () => {
    const store = loadStore(app, safeStorage);
    return { ok: true, sources: listSources(store) };
  });

  ipcMain.handle('rag:sources:add', async (_evt, payload) => {
    const store = loadStore(app, safeStorage);
    const src = addSource(store, payload || {});
    saveStore(app, safeStorage, store);
    return { ok: true, source: src, sources: listSources(store) };
  });

  ipcMain.handle('rag:sources:update', async (_evt, payload) => {
    const store = loadStore(app, safeStorage);
    const src = updateSource(store, payload || {});
    saveStore(app, safeStorage, store);
    return { ok: true, source: src, sources: listSources(store) };
  });

  ipcMain.handle('rag:sources:delete', async (_evt, sourceId) => {
    const store = loadStore(app, safeStorage);
    const removed = deleteSource(store, sourceId);
    saveStore(app, safeStorage, store);
    return { ok: true, removed, sources: listSources(store), corpora: listCorpora(store) };
  });

  // --- Corpora CRUD ---
  ipcMain.handle('rag:corpora:list', async () => {
    const store = loadStore(app, safeStorage);
    return { ok: true, corpora: listCorpora(store) };
  });

  ipcMain.handle('rag:corpora:upsert', async (_evt, payload) => {
    const store = loadStore(app, safeStorage);
    const corpus = upsertCorpus(store, payload || {});
    saveStore(app, safeStorage, store);
    return { ok: true, corpus, corpora: listCorpora(store) };
  });

  ipcMain.handle('rag:corpora:delete', async (_evt, corpusId) => {
    const store = loadStore(app, safeStorage);
    const removed = deleteCorpus(store, corpusId);
    saveStore(app, safeStorage, store);
    return { ok: true, removed, corpora: listCorpora(store) };
  });

  // --- Conversation selection ---
  ipcMain.handle('rag:convo:get', async (_evt, threadId) => {
    const store = loadStore(app, safeStorage);
    return { ok: true, corpusIds: getConversationSelection(store, threadId) };
  });

  ipcMain.handle('rag:convo:set', async (_evt, { threadId, corpusIds }) => {
    const store = loadStore(app, safeStorage);
    const entry = setConversationSelection(store, threadId, corpusIds);
    saveStore(app, safeStorage, store);
    return { ok: true, entry };
  });

  // --- Indexing ---
  ipcMain.handle('rag:index:run', async (_evt, { sourceIds }) => {
    const store = loadStore(app, safeStorage);
    const cfg = store.config || defaultRagStore().config;

    const r = await indexSources({ store, sourceIds: sourceIds || [], cfg });
    saveStore(app, safeStorage, store);

    return {
      ok: true,
      result: r,
      status: listIndexStatus(store),
    };
  });

  // --- Query ---
  ipcMain.handle('rag:query', async (_evt, { threadId, corpusIds, queryText }) => {
    const store = loadStore(app, safeStorage);

    const selection = Array.isArray(corpusIds)
      ? corpusIds
      : (threadId ? getConversationSelection(store, threadId) : []);

    const r = await ragQuery({ store, corpusIds: selection || [], queryText: queryText || '' });

    return {
      ok: true,
      corpusIds: selection || [],
      context: r.context,
      sources: r.sources,
    };
  });
}

module.exports = {
  registerRagIpc,
};