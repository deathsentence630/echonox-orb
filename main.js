const { app, BrowserWindow, ipcMain } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 620,
    height: 620,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// =========================
// Local LLM (Ollama) bridge
// =========================
// Privacy-first: calls only localhost by default.
ipcMain.handle('llm:chat', async (_event, payload) => {
  const baseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434';
  const model = process.env.LLM_MODEL || 'qwen2.5:7b';
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];

  console.log(`[llm:chat] called (messages=${messages.length}) model=${model}`);

  if (messages.length === 0) return '';

  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

  // Guardrail: refuse non-localhost unless the user explicitly sets LLM_ALLOW_REMOTE=1
  const allowRemote = process.env.LLM_ALLOW_REMOTE === '1';
  if (!allowRemote) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      const isLocalhost = host === '127.0.0.1' || host === 'localhost' || host === '::1';
      if (!isLocalhost) {
        throw new Error(
          `Refusé: LLM_BASE_URL pointe vers '${host}'. (Privacy-first)
Pour autoriser, définir LLM_ALLOW_REMOTE=1.`
        );
      }
    } catch (e) {
      throw new Error(e?.message || String(e));
    }
  }

  async function getFetch() {
    if (typeof fetch === 'function') return fetch;
    try {
      const { fetch: undiciFetch } = await import('undici');
      if (typeof undiciFetch === 'function') return undiciFetch;
    } catch (_) {}
    throw new Error(
      "fetch() indisponible dans ce runtime Electron. Installe 'undici' (npm i undici) ou mets à jour Electron/Node."
    );
  }

  const doFetch = await getFetch();

  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json().catch(() => ({}));
  const content = data?.message?.content ?? '';
  console.log(`[llm:chat] reply chars=${content.length}`);
  return content;
});