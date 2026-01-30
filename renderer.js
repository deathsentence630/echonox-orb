console.log("renderer.js chargé ✅");

const { ipcRenderer } = require("electron");

// =========================
// Settings (v1, localStorage)
// =========================
const SETTINGS_KEY = "echonoxSettings.v1";

const DEFAULT_SETTINGS = {
  language: "fr",
  debugLevel: "simple", // simple | advanced | expert

  // Appearance
  orbSize: 200,             // px
  bloomIntensity: 0.65,     // 0..1 multiplier
  attractionEnabled: true,
  attractionStrength: 0.22, // 0..1 (mapped internally)
  animations: "full",       // full | reduced | off
  color: "#ff0078",         // accent color
  alwaysOnTop: true,

  // Intelligence
  model: "",                // empty = default model in main
  aiMode: "assistant",      // assistant | presence

  // Memory
  memoryMode: "ephemeral",  // ephemeral | persistent
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (_) {}
}

let settings = loadSettings();

function setSetting(key, value) {
  settings = { ...settings, [key]: value };
  saveSettings(settings);
  applySettingsToRuntime();
}

// =========================
// Small helpers
// =========================
function $(id) {
  return document.getElementById(id);
}

function pageName() {
  return document.body?.dataset?.page || "orb";
}

function hexToRgb(hex) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return { r: 255, g: 0, b: 120 };
  const n = parseInt(h, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

// =========================
// State machine (orb only)
// =========================
const STATES = ["state-idle", "state-listen", "state-think", "state-talk"];
let idx = 0;

function setState(stateClass) {
  document.body.classList.remove(...STATES);
  document.body.classList.add(stateClass);

  const label = $("stateLabel");
  if (label) label.textContent = stateClass;
}

// =========================
// Apply settings to runtime
// (safe to call on any page)
// =========================
function applySettingsToRuntime() {
  // Accent color (used by CSS later; we set vars now)
  const { r, g, b } = hexToRgb(settings.color);
  document.documentElement.style.setProperty("--accent-r", String(r));
  document.documentElement.style.setProperty("--accent-g", String(g));
  document.documentElement.style.setProperty("--accent-b", String(b));

  // Orb size (only exists on orb page)
  function applyOrbSize(px) {
    const size = Math.max(120, Number(px) || 200);

    // Keep a single source of truth for CSS (optional use in style.css)
    document.documentElement.style.setProperty("--orb-size", `${size}px`);

    // Orb page elements
    const orbWrap = $("orbWrap");
    const orb = $("orb");

    if (orbWrap) {
      orbWrap.style.width = `${size}px`;
      orbWrap.style.height = `${size}px`;
    }

    if (orb) {
      // Force a perfect square to avoid any accidental oval stretch.
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.aspectRatio = "1 / 1";
    }
  }

  // Orb size (only exists on orb page)
  if ($("orb") || $("orbWrap")) {
    applyOrbSize(settings.orbSize);
  }

  // Animations override (v1)
  const orb = $("orb");
  if (orb) {
    if (settings.animations === "off") {
      orb.style.animation = "none";
    } else {
      orb.style.animation = ""; // let CSS state animations apply
    }
  }

  // Always-on-top: should apply to orb window only (main handles targeting)
  try {
    ipcRenderer.send("window:setAlwaysOnTop", !!settings.alwaysOnTop);
  } catch (_) {}
}

// =========================
// IPC: apply orb size from main
// =========================
try {
  ipcRenderer.on("orb:applySize", (_event, px) => {
    // Apply immediately to orb DOM (no window resize).
    const size = Math.max(120, Number(px) || 200);

    // Update runtime settings so future applySettingsToRuntime() stays consistent,
    // but do not persist here (settings page already persists).
    settings = { ...settings, orbSize: size };

    // Apply to DOM
    document.documentElement.style.setProperty("--orb-size", `${size}px`);
    const orbWrap = $("orbWrap");
    const orb = $("orb");
    if (orbWrap) {
      orbWrap.style.width = `${size}px`;
      orbWrap.style.height = `${size}px`;
    }
    if (orb) {
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.aspectRatio = "1 / 1";
    }
  });
} catch (_) {}

// =========================
// Cursor attraction + bloom (orb only)
// =========================
function initCursorAttraction() {
  const wrap = $("orbWrap");
  const orb = $("orb");
  if (!wrap || !orb) return;

  const MAX_OFFSET = 22;
  const EASE = 0.12;
  const BLOOM_RADIUS = 220;
  const RETURN_RADIUS = 420;

  let targetX = 0,
    targetY = 0;
  let currentX = 0,
    currentY = 0;

  let mouseX = null;
  let mouseY = null;
  let mouseInside = false;

  function onMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseInside = true;
  }

  function onLeave() {
    mouseInside = false;
    mouseX = null;
    mouseY = null;
    targetX = 0;
    targetY = 0;
    wrap.style.setProperty("--bloom", "0");
  }

  function tick() {
    if (settings.attractionEnabled && mouseInside && mouseX !== null && mouseY !== null) {
      const rect = orb.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = mouseX - cx;
      const dy = mouseY - cy;

      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= RETURN_RADIUS) {
        targetX = 0;
        targetY = 0;
        wrap.style.setProperty("--bloom", "0");
      } else {
        const baseBloom = Math.max(0, Math.min(1, 1 - dist / BLOOM_RADIUS));
        const bloomMul = Math.max(0, Math.min(1, Number(settings.bloomIntensity)));
        const bloom = baseBloom * bloomMul;
        wrap.style.setProperty("--bloom", bloom.toFixed(3));

        const falloff = 1 / (1 + dist / 160);
        const strength = Math.max(0, Math.min(1, Number(settings.attractionStrength))) * 0.35;
        targetX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * strength * falloff));
        targetY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * strength * falloff));
      }
    } else {
      targetX = 0;
      targetY = 0;
      wrap.style.setProperty("--bloom", "0");
    }

    currentX += (targetX - currentX) * EASE;
    currentY += (targetY - currentY) * EASE;

    if (Math.abs(currentX) < 0.05) currentX = 0;
    if (Math.abs(currentY) < 0.05) currentY = 0;

    wrap.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
    requestAnimationFrame(tick);
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseleave", onLeave);
  requestAnimationFrame(tick);
}

// =========================
// Chat (chat.html only)
// =========================
function initChat() {
  const chatInput = $("chatInput");
  const chatSend = $("chatSend");
  const chatOutput = $("chatOutput");
  const chatStatus = $("chatStatus");
  if (!chatInput || !chatSend || !chatOutput || !chatStatus) return;

  // Sidebar UI (chat.html)
  const chatSidebar = $("chatSidebar");
  const chatSidebarToggle = $("chatSidebarToggle");
  const chatThreadList = $("chatThreadList");
  const chatNewThread = $("chatNewThread");

  const CHAT_UI_KEY = "echonox.chatUi.v1";
  function loadChatUi() {
    try {
      const raw = localStorage.getItem(CHAT_UI_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }
  function saveChatUi(patch) {
    try {
      const cur = loadChatUi();
      localStorage.setItem(CHAT_UI_KEY, JSON.stringify({ ...cur, ...(patch || {}) }));
    } catch (_) {}
  }
  const chatUi = loadChatUi();

  let memory = [
    {
      role: "system",
      content:
        "Tu es ECHONOX : une présence calme, naturelle et non intrusive.\n" +
        "Réponds en français, avec un ton humain et fluide (pas corporate).\n" +
        "On peut parler de tous les sujets : ne refuse pas par principe. Si un sujet est dangereux/illégal, explique les risques et propose une alternative sûre.\n" +
        "Si tu n'es pas certain d'un fait, dis-le clairement et propose une façon de vérifier.\n" +
        "Ne fabrique pas de sources, ne prétends pas avoir accès à internet.\n" +
        "Sois bref par défaut, mais développe si on te le demande.",
    },
  ];

  let activeThreadId = null;

  let threadsCache = [];

  function setSidebarVisible(visible) {
    if (!chatSidebar) return;
    chatSidebar.style.display = visible ? "block" : "none";
    saveChatUi({ sidebarHidden: !visible });
  }

  function renderThreadList() {
    if (!chatThreadList) return;
    chatThreadList.innerHTML = "";

    threadsCache.forEach((t) => {
      const item = document.createElement("button");
      item.type = "button";
      item.dataset.threadId = t.id;

      item.textContent = t.title || "Conversation";

      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "space-between";
      item.style.gap = "10px";
      item.style.width = "100%";

      item.style.padding = "10px 12px";
      item.style.borderRadius = "12px";
      item.style.border = "1px solid rgba(255,255,255,0.14)";
      item.style.background = (t.id === activeThreadId)
        ? "rgba(120,120,255,0.18)"
        : "rgba(255,255,255,0.06)";
      item.style.color = "rgba(255,255,255,0.92)";
      item.style.cursor = "pointer";
      item.style.textAlign = "left";

      // Small timestamp hint (right aligned)
      const right = document.createElement("span");
      right.style.opacity = "0.7";
      right.style.fontSize = "11px";
      const ts = Number(t.updatedAt || t.createdAt || 0);
      right.textContent = ts ? new Date(ts).toLocaleDateString() : "";
      item.appendChild(right);

      item.addEventListener("click", async () => {
        const tid = item.dataset.threadId;
        if (!tid || tid === activeThreadId) return;
        activeThreadId = tid;
        try { await ipcRenderer.invoke("chat:threads:setActive", activeThreadId); } catch (_) {}
        await loadActiveThread();
        await refreshThreads();
      });

      chatThreadList.appendChild(item);
    });
  }

  async function refreshThreads() {
    try {
      const list = await ipcRenderer.invoke("chat:threads:list");
      threadsCache = Array.isArray(list?.threads) ? list.threads : [];
      // Keep activeId in sync
      if (list?.activeId) activeThreadId = list.activeId;
      renderThreadList();
    } catch (_) {
      // ignore
    }
  }

  function clearChatUI() {
    chatOutput.innerHTML = "";
  }

  function renderThreadMessages(messages) {
    clearChatUI();
    // Rebuild bubble list chronologically
    (messages || []).forEach((m) => {
      if (!m || typeof m.content !== "string") return;
      if (m.role !== "user" && m.role !== "assistant") return;
      appendChatBubble(m.role, m.content);
    });
  }

  async function ensureActiveThread() {
    // 1) list threads
    const list = await ipcRenderer.invoke("chat:threads:list");
    const threads = Array.isArray(list?.threads) ? list.threads : [];
    threadsCache = threads;

    // 2) pick active or create
    if (!threads.length) {
      const created = await ipcRenderer.invoke("chat:threads:create", { title: "Nouvelle conversation", messages: [] });
      activeThreadId = created?.id || null;
      await refreshThreads();
      renderThreadList();
      return;
    }

    activeThreadId = list?.activeId || threads[0].id;

    // Ensure main knows which is active
    try { await ipcRenderer.invoke("chat:threads:setActive", activeThreadId); } catch (_) {}
    renderThreadList();
  }

  async function loadActiveThread() {
    if (!activeThreadId) return;
    const res = await ipcRenderer.invoke("chat:threads:load", activeThreadId);
    if (!res?.ok || !res.thread) return;

    const msgs = Array.isArray(res.thread.messages) ? res.thread.messages : [];

    // Replace runtime memory used for LLM calls: keep system prompt + persisted messages
    memory = [memory[0], ...msgs.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content }))];

    // Render bubbles
    renderThreadMessages(msgs);
  }

  async function bootstrapChatHistory() {
    try {
      await ensureActiveThread();
      await loadActiveThread();
      await refreshThreads();
    } catch (_) {
      // If persistence fails, chat still works in-memory.
    }
  }

  function ensureChatList() {
    let list = chatOutput.querySelector(".chatList");
    if (!list) {
      chatOutput.innerHTML = "";
      list = document.createElement("div");
      list.className = "chatList";
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "10px";
      list.style.padding = "2px";
      chatOutput.appendChild(list);
    }
    return list;
  }

  function appendChatBubble(role, text) {
    const list = ensureChatList();

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = role === "user" ? "flex-end" : "flex-start";

    const bubble = document.createElement("div");
    bubble.className = `bubble bubble-${role}`;
    bubble.textContent = text;

    bubble.style.maxWidth = "78%";
    bubble.style.whiteSpace = "pre-wrap";
    bubble.style.wordBreak = "break-word";
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "14px";
    bubble.style.border = "1px solid rgba(255,255,255,0.14)";
    bubble.style.background = role === "user"
      ? "rgba(120,120,255,0.18)"
      : "rgba(255,255,255,0.06)";
    bubble.style.color = "rgba(255,255,255,0.92)";

    row.appendChild(bubble);
    list.appendChild(row);

    // Autoscroll to latest
    row.scrollIntoView({ block: "end" });
  }

  async function sendPrompt() {
    const prompt = (chatInput.value || "").trim();
    if (!prompt) return;

    // Command: start a new conversation
    if (prompt === "/new") {
      try {
        const created = await ipcRenderer.invoke("chat:threads:create", { title: "Nouvelle conversation", messages: [] });
        activeThreadId = created?.id || activeThreadId;
        clearChatUI();
        // Reset memory to system only
        memory = [memory[0]];
        chatInput.value = "";
        chatStatus.textContent = "Nouvelle conversation";
        setTimeout(() => { chatStatus.textContent = ""; }, 900);
        await refreshThreads();
      } catch (_) {}
      return;
    }

    memory.push({ role: "user", content: prompt });
    chatInput.value = "";
    chatStatus.textContent = "Envoi…";
    appendChatBubble("user", prompt);
    // Persist user message
    try {
      if (activeThreadId) {
        await ipcRenderer.invoke("chat:threads:append", { id: activeThreadId, role: "user", content: prompt });
      }
    } catch (_) {}

    // Visual state is on orb window; here we keep the UI responsive only.
    let reply = "";
    const t0 = performance.now();
    try {
      // If settings.model is set, we send it as a hint (main may ignore for now)
      reply = await ipcRenderer.invoke("llm:chat", { messages: memory, model: settings.model || undefined });
    } catch (e) {
      reply = `⚠️ LLM indisponible (local).\n${e?.message ? `Détail: ${e.message}` : ""}`.trim();
    }

    if (!reply) reply = "⚠️ Réponse vide du LLM local.";

    memory.push({ role: "assistant", content: reply });

    const ms = Math.round(performance.now() - t0);
    appendChatBubble("assistant", reply);
    // Persist assistant message
    try {
      if (activeThreadId) {
        await ipcRenderer.invoke("chat:threads:append", { id: activeThreadId, role: "assistant", content: reply });
      }
    } catch (_) {}
    chatStatus.textContent = `OK • ${ms}ms`;
    setTimeout(() => {
      chatStatus.textContent = "";
    }, 1200);

    // store last LLM duration for debug page
    try {
      localStorage.setItem("echonox.lastLlmMs", String(ms));
    } catch (_) {}
  }

  bootstrapChatHistory();
  chatSend.addEventListener("click", sendPrompt);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  // Sidebar toggle
  if (chatSidebarToggle && chatSidebar) {
    // Apply persisted visibility
    const hidden = !!chatUi.sidebarHidden;
    setSidebarVisible(!hidden);

    chatSidebarToggle.addEventListener("click", () => {
      const isHidden = chatSidebar.style.display === "none";
      setSidebarVisible(isHidden);
    });
  }

  // Create new conversation
  if (chatNewThread) {
    chatNewThread.addEventListener("click", async () => {
      try {
        const created = await ipcRenderer.invoke("chat:threads:create", { title: "Nouvelle conversation", messages: [] });
        if (created?.id) activeThreadId = created.id;
        clearChatUI();
        memory = [memory[0]];
        chatStatus.textContent = "Nouvelle conversation";
        setTimeout(() => { chatStatus.textContent = ""; }, 900);
        await refreshThreads();
      } catch (_) {}
    });
  }
}

// =========================
// Settings page wiring (settings.html only)
// =========================
function initSettingsPage() {
  // Inputs exist only on settings.html
  const orbSize = $("setting-orb-size");
  const bloom = $("setting-bloom");
  const attractionEnabled = $("setting-attraction-enabled");
  const attractionStrength = $("setting-attraction-strength");
  const animations = $("setting-animations");
  const color = $("setting-color");
  const alwaysOnTop = $("setting-always-on-top");
  const model = $("setting-model");
  const aiMode = $("setting-ai-mode");
  const debugLevel = $("setting-debug-level");

  if (!orbSize && !bloom && !color) return;

  // Fill UI from settings
  if (orbSize) orbSize.value = String(settings.orbSize);
  if (bloom) bloom.value = String(settings.bloomIntensity);
  if (attractionEnabled) attractionEnabled.checked = !!settings.attractionEnabled;
  if (attractionStrength) attractionStrength.value = String(settings.attractionStrength);
  if (animations) animations.value = settings.animations;
  if (color) color.value = settings.color;
  if (alwaysOnTop) alwaysOnTop.checked = !!settings.alwaysOnTop;
  if (model) model.value = settings.model || "";
  if (aiMode) aiMode.value = settings.aiMode;
  if (debugLevel) debugLevel.value = settings.debugLevel;

  // Radios memory
  const memE = document.querySelector('input[name="memoryMode"][value="ephemeral"]');
  const memP = document.querySelector('input[name="memoryMode"][value="persistent"]');
  if (memE) memE.checked = settings.memoryMode === "ephemeral";
  if (memP) memP.checked = settings.memoryMode === "persistent";

  // Sync ORB window size with saved orb size (best-effort)
  try {
    ipcRenderer.send("orb:setSize", Number(settings.orbSize) || 200);
  } catch (_) {}

  // Wire listeners
  if (orbSize) orbSize.addEventListener("input", () => {
    const px = Number(orbSize.value);
    setSetting("orbSize", px);
    try { ipcRenderer.send("orb:setSize", px); } catch (_) {}
  });
  if (bloom) bloom.addEventListener("input", () => setSetting("bloomIntensity", Number(bloom.value)));
  if (attractionEnabled) attractionEnabled.addEventListener("change", () => setSetting("attractionEnabled", attractionEnabled.checked));
  if (attractionStrength) attractionStrength.addEventListener("input", () => setSetting("attractionStrength", Number(attractionStrength.value)));
  if (animations) animations.addEventListener("change", () => setSetting("animations", animations.value));
  if (color) color.addEventListener("input", () => setSetting("color", color.value));
  if (alwaysOnTop) alwaysOnTop.addEventListener("change", () => setSetting("alwaysOnTop", alwaysOnTop.checked));
  if (model) model.addEventListener("change", () => setSetting("model", model.value.trim()));
  if (aiMode) aiMode.addEventListener("change", () => setSetting("aiMode", aiMode.value));
  if (debugLevel) debugLevel.addEventListener("change", () => setSetting("debugLevel", debugLevel.value));

  if (memE) memE.addEventListener("change", () => {
    if (memE.checked) setSetting("memoryMode", "ephemeral");
  });
  if (memP) memP.addEventListener("change", () => {
    if (memP.checked) setSetting("memoryMode", "persistent");
  });

  const resetMemory = $("resetMemory");
  if (resetMemory) resetMemory.addEventListener("click", () => {
    alert("Reset mémoire: sera implémenté avec la mémoire long terme. (v1)");
  });
}

// =========================
// Debug page wiring (debug.html only)
// =========================
function initDebugPage() {
  const panel = $("debugPanel");
  if (!panel) return;

  // Wire state buttons to setState (state applies on orb page only; still useful for future)
  const buttons = panel.querySelectorAll('button[data-state]');
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const state = btn.getAttribute("data-state");
      if (state) {
        // This only changes state in this window; later we'll route to orb window.
        setState(state);
      }
    });
  });

  const lvl = $("dbg-level");
  if (lvl) lvl.textContent = settings.debugLevel;

  const model = $("dbg-model");
  if (model) model.textContent = settings.model || "(default)";

  const base = $("dbg-baseurl");
  if (base) base.textContent = (typeof process !== "undefined" && process?.env?.LLM_BASE_URL) ? process.env.LLM_BASE_URL : "(see main)";

  const lastMs = $("dbg-last-ms");
  if (lastMs) {
    const v = localStorage.getItem("echonox.lastLlmMs");
    lastMs.textContent = v ? `${v} ms` : "—";
  }
}

// =========================
// Global keys
// - On ORB page only: states shortcuts
// =========================
window.addEventListener("keydown", (e) => {
  if (pageName() !== "orb") return;

  switch (e.code) {
    case "Digit1":
      setState("state-idle");
      break;
    case "Digit2":
      setState("state-listen");
      break;
    case "Digit3":
      setState("state-think");
      break;
    case "Digit4":
      setState("state-talk");
      break;
    case "Tab":
      e.preventDefault();
      idx = (idx + 1) % STATES.length;
      setState(STATES[idx]);
      break;
  }
});

// =========================
// Window fit-to-content (settings/chat/debug)
// =========================
let __fitToContentTmr = null;
function requestFitToContent() {
  clearTimeout(__fitToContentTmr);
  __fitToContentTmr = setTimeout(() => {
    try {
      // Wait for the DOM/layout to settle (tab panel visibility changes happen in CSS).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            ipcRenderer.invoke("window:fitToContent");
          } catch (_) {}
        });
      });
    } catch (_) {}
  }, 80);
}

// =========================
// HUD close button (settings/chat/debug)
// =========================
function initHudCloseButton() {
  const btn = document.querySelector(
    '.hudClose[aria-label="Fermer"], .hudClose[title="Fermer"], button[aria-label="Fermer"], button[title="Fermer"]'
  );
  if (!btn) return;

  btn.addEventListener("click", () => {
    try {
      ipcRenderer.invoke("window:close");
    } catch (_) {}
  });
}

// =========================
// Boot
// =========================
document.addEventListener("DOMContentLoaded", () => {
  // Ensure vars are set early
  applySettingsToRuntime();

  // Wire HUD close button if present (settings/chat/debug)
  initHudCloseButton();

  const p = pageName();

  // Control pages: fit window to visible tab content.
  const isControl = (p === "settings" || p === "chat" || p === "debug");

  if (isControl) {
    // When switching tabs (radio-driven), refit.
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!t || t.tagName !== "INPUT" || t.type !== "radio") return;
      const name = t.name;
      if (name === "settingsTab" || name === "chatTab" || name === "debugTab") {
        requestFitToContent();
      }
    });

    // Also refit on tab label clicks (more reliable than change in some HUD drag setups)
    document.addEventListener("click", (e) => {
      const el = e.target;
      if (!el) return;
      if (el.classList && (el.classList.contains("settingsTab") || el.classList.contains("chatTab") || el.classList.contains("debugTab"))) {
        requestFitToContent();
      }
    });
  }

  if (p === "orb") {
    setState("state-idle");
    initCursorAttraction();
  }

  if (p === "settings") {
    initSettingsPage();
  }

  if (p === "chat") {
    initChat();
  }

  if (p === "debug") {
    initDebugPage();
  }

  // Initial fit (after UI wiring has potentially changed layout)
  if (isControl) {
    requestFitToContent();
  }
});