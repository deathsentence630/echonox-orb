const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');

// -------------------------
// Window references (single instance each)
// -------------------------
let orbWindow = null;
let settingsWindow = null;
let chatWindow = null;
let debugWindow = null;

const isMac = process.platform === 'darwin';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampBoundsToWorkArea(bounds) {
  try {
    const wa = screen.getPrimaryDisplay().workArea;
    const width = clamp(bounds.width, 1, wa.width);
    const height = clamp(bounds.height, 1, wa.height);
    const x = clamp(bounds.x, wa.x, wa.x + wa.width - width);
    const y = clamp(bounds.y, wa.y, wa.y + wa.height - height);
    return { x, y, width, height };
  } catch (_) {
    return bounds;
  }
}

function positionOrbWindow(win) {
  // Default position: center-left of the primary display (work area)
  try {
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
    const WIN_W = 620;
    const WIN_H = 620;

    // Place around the left quarter of the screen, centered vertically
    const targetX = Math.round(x + (width * 0.25) - (WIN_W / 2));
    const targetY = Math.round(y + (height / 2) - (WIN_H / 2));

    win.setPosition(targetX, targetY, false);
  } catch (_) {
    // ignore
  }
}

function createOrbWindow() {
  if (orbWindow && !orbWindow.isDestroyed()) {
    orbWindow.show();
    orbWindow.focus();
    return orbWindow;
  }

  orbWindow = new BrowserWindow({
    width: 620,
    height: 620,
    minWidth: 220,
    minHeight: 220,
    maxWidth: 900,
    maxHeight: 900,

    frame: false,
    transparent: true,
    hasShadow: false,

    backgroundColor: '#00000000',

    // We size/position the orb programmatically; avoid user-resize drift.
    resizable: false,

    alwaysOnTop: true,
    skipTaskbar: true,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  positionOrbWindow(orbWindow);
  orbWindow.loadFile('index.html');

  orbWindow.on('closed', () => {
    orbWindow = null;
  });

  return orbWindow;
}

function centerWindow(win, w = 980, h = 720) {
  try {
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
    const targetX = Math.round(x + (width / 2) - (w / 2));
    const targetY = Math.round(y + (height / 2) - (h / 2));
    win.setPosition(targetX, targetY, false);
  } catch (_) {}
}

function createControlWindow(kind) {
  // kind: 'settings' | 'chat' | 'debug'
  const map = {
    settings: { ref: () => settingsWindow, set: (v) => (settingsWindow = v), file: 'settings.html', title: 'ECHONOX — Settings' },
    chat: { ref: () => chatWindow, set: (v) => (chatWindow = v), file: 'chat.html', title: 'ECHONOX — Chat' },
    debug: { ref: () => debugWindow, set: (v) => (debugWindow = v), file: 'debug.html', title: 'ECHONOX — Debug' },
  };

  const cfg = map[kind];
  if (!cfg) return null;

  const existing = cfg.ref();
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width: 980,
    height: 720,

    // HUD-style window (macOS)
    frame: false,
    transparent: isMac ? true : false,
    vibrancy: isMac ? 'hud' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundColor: isMac ? '#00000000' : '#0b0b10',

    resizable: true,
    alwaysOnTop: false,
    title: cfg.title,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  centerWindow(win, 980, 720);
  win.loadFile(cfg.file);

  win.on('closed', () => cfg.set(null));

  cfg.set(win);
  return win;
}

function openControl(kind) {
  return createControlWindow(kind);
}

// -------------------------
// App lifecycle
// -------------------------
app.whenReady().then(() => {
  createOrbWindow();

  // Global shortcuts (open on demand)
  // - Settings: Cmd/Ctrl + ,
  // - Chat: Cmd/Ctrl + Shift + C
  // - Debug: Cmd/Ctrl + Shift + D
  globalShortcut.register('CommandOrControl+,', () => openControl('settings'));
  globalShortcut.register('CommandOrControl+Shift+C', () => openControl('chat'));
  globalShortcut.register('CommandOrControl+Shift+D', () => openControl('debug'));

  // Keep orb visible if displays/work areas change.
  const clampOrb = () => {
    if (!orbWindow || orbWindow.isDestroyed()) return;
    const b = orbWindow.getBounds();
    const next = clampBoundsToWorkArea(b);
    if (next.x !== b.x || next.y !== b.y || next.width !== b.width || next.height !== b.height) {
      orbWindow.setBounds(next, false);
    }
  };

  screen.on('display-metrics-changed', clampOrb);
  screen.on('display-added', clampOrb);
  screen.on('display-removed', clampOrb);
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  // macOS: recreate orb window if none exists
  if (!orbWindow || orbWindow.isDestroyed()) createOrbWindow();
});

// -------------------------
// IPC: Window controls
// -------------------------
// Always-on-top applies to ORB window only.
ipcMain.on('window:setAlwaysOnTop', (_event, enabled) => {
  if (!orbWindow || orbWindow.isDestroyed()) return;
  orbWindow.setAlwaysOnTop(!!enabled);
});

// Resize ORB window to match orb size (called from Settings)
ipcMain.on("orb:setSize", (_event, orbPx) => {
  if (!orbWindow || orbWindow.isDestroyed()) return;

  const px = clamp(Number(orbPx) || 200, 120, 700);

  // 1) Renderer: applique la taille de l'orbe (carré strict côté DOM)
  orbWindow.webContents.send("orb:applySize", px);

  // 2) Window: ajuste la fenêtre pour coller à l'orbe (+ marge pour glow)
  // Padding dynamique: petit orb => petite marge ; grand orb => marge suffisante.
  const PAD = clamp(Math.round(px * 0.38), 120, 260);
  const side = clamp(Math.round(px + PAD), 220, 900);

  const b = orbWindow.getBounds();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  const next = clampBoundsToWorkArea({
    x: Math.round(cx - side / 2),
    y: Math.round(cy - side / 2),
    width: side,
    height: side,
  });

  orbWindow.setBounds(next, false);
});

// Open control windows (from nav links, etc.)
ipcMain.on('control:open', (_event, kind) => {
  const k = String(kind || '').toLowerCase();
  if (k === 'settings' || k === 'chat' || k === 'debug') openControl(k);
});

// -------------------------
// Local LLM (Ollama) bridge
// -------------------------
// Privacy-first: calls only localhost by default.
ipcMain.handle('llm:chat', async (_event, payload) => {
  const baseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434';

  // Allow per-request model override from UI (settings.model), fallback to env/default.
  const requestedModel = typeof payload?.model === 'string' ? payload.model.trim() : '';
  const model = requestedModel || process.env.LLM_MODEL || 'qwen2.5:7b';

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
          `Refusé: LLM_BASE_URL pointe vers '${host}'. (Privacy-first)\nPour autoriser, définir LLM_ALLOW_REMOTE=1.`
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