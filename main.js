const { app, BrowserWindow, ipcMain, screen, globalShortcut, safeStorage } = require('electron');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// -------------------------
// Window references (single instance each)
// -------------------------
let orbWindow = null;
let settingsWindow = null;
let chatWindow = null;
let debugWindow = null;


const isMac = process.platform === 'darwin';

// --- CLI arg helpers for Wayland-friendly window control ---
function parseCliArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const out = { open: null, toggle: null, closeAll: false };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--open' && args[i + 1]) out.open = String(args[++i]).toLowerCase();
    else if (a === '--toggle' && args[i + 1]) out.toggle = String(args[++i]).toLowerCase();
    else if (a === '--close-all') out.closeAll = true;
  }
  return out;
}

function isControlKind(k) {
  return k === 'settings' || k === 'chat' || k === 'debug';
}

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
// -------------------------
// Encrypted chat history (multi-thread) via safeStorage
// -------------------------
const CHAT_STORE_VERSION = 1;

function chatStorePath() {
  return path.join(app.getPath('userData'), 'chat-threads.enc');
}

function defaultChatStore() {
  return { version: CHAT_STORE_VERSION, activeId: null, threads: [] };
}

function readChatStore() {
  const p = chatStorePath();
  if (!fs.existsSync(p)) return defaultChatStore();

  const raw = fs.readFileSync(p);

  if (!safeStorage.isEncryptionAvailable()) {
    // We refuse to load plaintext if encryption isn't available, to keep the guarantee.
    // Return a fresh store instead of leaking readable content.
    return defaultChatStore();
  }

  try {
    const json = safeStorage.decryptString(raw);
    const data = JSON.parse(json);
    if (!data || data.version !== CHAT_STORE_VERSION || !Array.isArray(data.threads)) {
      return defaultChatStore();
    }
    return data;
  } catch (_) {
    return defaultChatStore();
  }
}

function writeChatStore(store) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system.');
  }

  const p = chatStorePath();
  const json = JSON.stringify(store);
  const enc = safeStorage.encryptString(json);
  fs.writeFileSync(p, enc);
}

function newThreadId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_) {}
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function findThread(store, id) {
  return store.threads.find((t) => t.id === id) || null;
}

function clampTitle(s) {
  const t = String(s || '').trim();
  return t.length > 80 ? t.slice(0, 80) : t;
}

function deriveTitleFromFirstUserMessage(messages) {
  const firstUser = (messages || []).find((m) => m && m.role === 'user' && typeof m.content === 'string');
  if (!firstUser) return 'Nouvelle conversation';
  const oneLine = firstUser.content.replace(/\s+/g, ' ').trim();
  return clampTitle(oneLine.slice(0, 48) || 'Nouvelle conversation');
}

function touchThread(t) {
  const now = Date.now();
  if (!t.createdAt) t.createdAt = now;
  t.updatedAt = now;
}
// Fit a control window to its panel content (used when switching tabs)
async function fitWindowToPanelContent(win) {
  if (!win || win.isDestroyed()) return;

  try {
    const measured = await win.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.panel');
      if (!panel) return { height: 520 };

      const header = panel.querySelector('.panelHeader');
      const content = panel.querySelector('.panelContent');

      const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;

      // Panel padding/border (so the window actually fits the glass container)
      const ps = window.getComputedStyle(panel);
      const padTop = parseFloat(ps.paddingTop) || 0;
      const padBottom = parseFloat(ps.paddingBottom) || 0;
      const borderTop = parseFloat(ps.borderTopWidth) || 0;
      const borderBottom = parseFloat(ps.borderBottomWidth) || 0;
      const panelFrame = Math.ceil(padTop + padBottom + borderTop + borderBottom);

      // Default target if we can't measure anything else
      let targetHeight = headerH + panelFrame + 32;

      if (content) {
        // Temporarily remove constraints so we can measure intrinsic sizes.
        const prevHeight = content.style.height;
        const prevFlex = content.style.flex;
        const prevMinH = content.style.minHeight;
        const prevOverflow = content.style.overflow;

        content.style.height = 'auto';
        content.style.flex = '0 0 auto';
        content.style.minHeight = '0';
        content.style.overflow = 'visible';

        // Tight measurement: visible tabPanel if present, else the whole content.
        const panels = Array.from(content.querySelectorAll('.tabPanel'));
        const visiblePanel = panels.find((el) => {
          const cs = window.getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden';
        });
        const target = visiblePanel || content;

        const tightBreathing = 14;
        const scrollBreathing = 24;
        const threshold = 4; // px

        const tight = Math.ceil(headerH + panelFrame + target.getBoundingClientRect().height + tightBreathing);
        const scroll = Math.ceil(panel.scrollHeight + scrollBreathing);

        // Use scrollHeight only when it's meaningfully larger (fixes macOS range overflow on Appearance)
        targetHeight = (scroll > tight + threshold) ? scroll : tight;

        // Restore
        content.style.height = prevHeight;
        content.style.flex = prevFlex;
        content.style.minHeight = prevMinH;
        content.style.overflow = prevOverflow;
      } else {
        // No content container; fall back to scrollHeight
        targetHeight = Math.ceil(panel.scrollHeight + 24);
      }

      return { height: targetHeight };
    })()`);

    const b = win.getBounds();
    const nextH = clamp(Number(measured?.height) || b.height, 80, 1400);

    // Keep width; adjust height only; keep center stable.
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;

    const next = clampBoundsToWorkArea({
      x: Math.round(cx - b.width / 2),
      y: Math.round(cy - nextH / 2),
      width: b.width,
      height: nextH,
    });

    win.setBounds(next, false);
    console.log("FIT bounds after:", win.getBounds(), "measured:", measured);
  } catch (_) {
    // ignore
  }
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
    width: 560,
    height: 500,

    // HUD-style window
    frame: false,
    transparent: true,
    //vibrancy: true,
    visualEffectState: "active",
    backgroundColor: "#000000c1",
    hasShadow: false,
    roundedCorners: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    minWidth: 420,
    minHeight: 320,
    maxWidth: 980,
    maxHeight: 760,
    
    title: cfg.title,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  centerWindow(win, 560, 520);

  win.loadFile(cfg.file);

  win.on('closed', () => cfg.set(null));

  cfg.set(win);
  return win;
}

function openControl(kind) {
  return createControlWindow(kind);
}

// --- CLI action dispatcher ---
function applyCliAction(action) {
  if (!action) return;

  if (action.closeAll) {
    try { if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close(); } catch (_) {}
    try { if (chatWindow && !chatWindow.isDestroyed()) chatWindow.close(); } catch (_) {}
    try { if (debugWindow && !debugWindow.isDestroyed()) debugWindow.close(); } catch (_) {}
    return;
  }

  if (action.open && isControlKind(action.open)) {
    openControl(action.open);
    return;
  }

  if (action.toggle && isControlKind(action.toggle)) {
    const map = { settings: settingsWindow, chat: chatWindow, debug: debugWindow };
    const w = map[action.toggle];
    if (w && !w.isDestroyed() && w.isVisible()) w.close();
    else openControl(action.toggle);
  }
}


// -------------------------
// App lifecycle
// -------------------------
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const action = parseCliArgs(argv);

    try {
      if (orbWindow && !orbWindow.isDestroyed()) {
        orbWindow.show();
        orbWindow.focus();
      }
    } catch (_) {}

    applyCliAction(action);
  });

  app.whenReady().then(() => {
    createOrbWindow();

    // Apply CLI actions on first launch
    applyCliAction(parseCliArgs(process.argv));

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
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (!orbWindow || orbWindow.isDestroyed()) createOrbWindow();
});

// -------------------------
// IPC: Window controls
// -------------------------
ipcMain.on('window:setAlwaysOnTop', (_event, enabled) => {
  if (!orbWindow || orbWindow.isDestroyed()) return;
  orbWindow.setAlwaysOnTop(!!enabled);
});

ipcMain.on('orb:setSize', (_event, orbPx) => {
  if (!orbWindow || orbWindow.isDestroyed()) return;

  const px = clamp(Number(orbPx) || 200, 120, 700);

  // 1) Renderer: apply orb size (square)
  orbWindow.webContents.send('orb:applySize', px);

  // 2) Window: adjust bounds around orb (+ glow padding)
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

ipcMain.on('control:open', (_event, kind) => {
  const k = String(kind || '').toLowerCase();
  if (k === 'settings' || k === 'chat' || k === 'debug') openControl(k);
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.handle('window:fitToContent', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  try {
    await fitWindowToPanelContent(win);
  } catch (e) {
  }
});

// -------------------------
// IPC: Encrypted chat threads (multi-conversation)
// -------------------------

ipcMain.handle('chat:threads:list', () => {
  const store = readChatStore();
  // Return summaries only (no message bodies)
  const threads = store.threads
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt || 0,
      updatedAt: t.updatedAt || 0,
    }));
  return { activeId: store.activeId, threads };
});

ipcMain.handle('chat:threads:create', (_event, payload) => {
  const store = readChatStore();

  const id = newThreadId();
  const now = Date.now();

  const thread = {
    id,
    title: clampTitle(payload?.title) || 'Nouvelle conversation',
    createdAt: now,
    updatedAt: now,
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
  };

  // Auto title if messages provided and title is default
  if (!payload?.title && Array.isArray(thread.messages) && thread.messages.length) {
    thread.title = deriveTitleFromFirstUserMessage(thread.messages);
  }

  store.threads.push(thread);
  store.activeId = id;

  writeChatStore(store);

  return { id };
});

ipcMain.handle('chat:threads:delete', (_event, id) => {
  const store = readChatStore();
  const before = store.threads.length;
  store.threads = store.threads.filter((t) => t.id !== String(id));

  if (store.activeId === String(id)) {
    store.activeId = store.threads.length ? store.threads[0].id : null;
  }

  if (store.threads.length !== before) {
    writeChatStore(store);
  }

  return { ok: true, activeId: store.activeId };
});

ipcMain.handle('chat:threads:setActive', (_event, id) => {
  const store = readChatStore();
  const tid = String(id || '');
  if (tid && findThread(store, tid)) {
    store.activeId = tid;
    writeChatStore(store);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('chat:threads:load', (_event, id) => {
  const store = readChatStore();
  const tid = String(id || store.activeId || '');
  const t = tid ? findThread(store, tid) : null;
  if (!t) return { ok: false, thread: null };

  // Return full thread
  return {
    ok: true,
    thread: {
      id: t.id,
      title: t.title,
      createdAt: t.createdAt || 0,
      updatedAt: t.updatedAt || 0,
      messages: Array.isArray(t.messages) ? t.messages : [],
    },
  };
});

ipcMain.handle('chat:threads:append', (_event, payload) => {
  const store = readChatStore();
  const tid = String(payload?.id || store.activeId || '');
  if (!tid) return { ok: false };

  const t = findThread(store, tid);
  if (!t) return { ok: false };

  const role = String(payload?.role || '');
  const content = String(payload?.content || '');
  if (!role || !content) return { ok: false };

  if (!Array.isArray(t.messages)) t.messages = [];

  t.messages.push({ role, content, ts: Date.now() });

  // Auto-title on first user message if still default
  if (!t.title || t.title === 'Nouvelle conversation') {
    t.title = deriveTitleFromFirstUserMessage(t.messages);
  }

  touchThread(t);
  store.activeId = tid;

  writeChatStore(store);

  return { ok: true };
});

ipcMain.handle('chat:threads:rename', (_event, payload) => {
  const store = readChatStore();
  const tid = String(payload?.id || '');
  const t = tid ? findThread(store, tid) : null;
  if (!t) return { ok: false };

  const title = clampTitle(payload?.title);
  if (!title) return { ok: false };

  t.title = title;
  touchThread(t);
  writeChatStore(store);

  return { ok: true };
});

// -------------------------
// Local LLM (Ollama) bridge
// -------------------------
ipcMain.handle('llm:chat', async (_event, payload) => {
  const baseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434';

  const requestedModel = typeof payload?.model === 'string' ? payload.model.trim() : '';
  const model = requestedModel || process.env.LLM_MODEL || 'qwen2.5:7b';

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];

  console.log(`[llm:chat] called (messages=${messages.length}) model=${model}`);

  if (messages.length === 0) return '';

  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

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