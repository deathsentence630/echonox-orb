console.log("renderer.js chargé ✅");

const { ipcRenderer } = require("electron");

// =========================
// State machine (visual)
// =========================
const STATES = ["state-idle", "state-listen", "state-think", "state-talk"];
let idx = 0;

function setState(stateClass) {
  document.body.classList.remove(...STATES);
  document.body.classList.add(stateClass);

  const label = document.getElementById("stateLabel");
  if (label) label.textContent = stateClass;
}

// =========================
// Debug HUD toggle (optional)
// =========================
function getDebugFromStorage() {
  try {
    const v = localStorage.getItem("debugEnabled");
    if (v === "1") return true;
    if (v === "0") return false;
  } catch (_) {}
  return false;
}

function setDebugEnabled(enabled) {
  document.body.classList.toggle("debug-on", enabled);

  const hud = document.getElementById("debug");
  if (hud) hud.style.display = enabled ? "" : "none";

  try {
    localStorage.setItem("debugEnabled", enabled ? "1" : "0");
  } catch (_) {}
}

function initDebug() {
  setDebugEnabled(getDebugFromStorage());
}

function wireDebugButtons() {
  const buttons = document.querySelectorAll('#debug button[data-state]');
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const state = btn.getAttribute("data-state");
      if (state) setState(state);
      window.focus();
    });
  });
}

// =========================
// Cursor attraction + bloom
// =========================
function initCursorAttraction() {
  const wrap = document.getElementById("orbWrap");
  const orb = document.getElementById("orb");
  if (!wrap || !orb) return;

  // Réglages
  const MAX_OFFSET = 22;      // px max de déplacement
  const STRENGTH = 0.22;      // force d'attraction
  const EASE = 0.12;          // inertie
  const BLOOM_RADIUS = 220;   // px: distance où le bloom devient fort
  const RETURN_RADIUS = 420;  // px: distance où l'orbe revient au centre

  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;

  // Track last known mouse position inside the window
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
    // Recompute attraction every frame (orb can move even if mouse is still)
    if (mouseInside && mouseX !== null && mouseY !== null) {
      const rect = orb.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = mouseX - cx;
      const dy = mouseY - cy;

      const dist = Math.sqrt(dx * dx + dy * dy);

      // Si la souris est loin : retour au centre + bloom off
      if (dist >= RETURN_RADIUS) {
        targetX = 0;
        targetY = 0;
        wrap.style.setProperty("--bloom", "0");
      } else {
        // Bloom progressif (0 → loin, 1 → proche)
        const bloom = Math.max(0, Math.min(1, 1 - dist / BLOOM_RADIUS));
        wrap.style.setProperty("--bloom", bloom.toFixed(3));

        // Attraction avec atténuation
        const falloff = 1 / (1 + dist / 160);

        targetX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * STRENGTH * falloff));
        targetY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * STRENGTH * falloff));
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
// LLM Chat (UI)
// =========================
function initChat() {
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");
  const chatOutput = document.getElementById("chatOutput");
  const chatStatus = document.getElementById("chatStatus");

  // Chat UI may be hidden if debug is off; still wire it.
  if (!chatInput || !chatSend || !chatOutput || !chatStatus) return;

  const memory = [
    {
      role: "system",
      content:
        "Tu es ECHONOX : une présence calme, naturelle et non intrusive.\n" +
        "Réponds en français, avec un ton humain et fluide (pas corporate).\n" +
        "On peut parler de tous les sujets : ne refuse pas par principe. Si un sujet est dangereux/illégal, explique les risques et propose une alternative sûre.\n" +
        "Si tu n'es pas certain d'un fait, dis-le clairement et propose une façon de vérifier.\n" +
        "Ne fabrique pas de sources, ne prétends pas avoir accès à internet.\n" +
        "Sois bref par défaut, mais développe si on te le demande."
    },
  ];

  async function sendPrompt() {
    const prompt = (chatInput.value || "").trim();
    if (!prompt) return;

    memory.push({ role: "user", content: prompt });
    chatInput.value = "";
    chatStatus.textContent = "Envoi…";

    setState("state-think");

    let reply = "";
    try {
      reply = await ipcRenderer.invoke("llm:chat", { messages: memory });
    } catch (e) {
      reply = `⚠️ LLM indisponible (local).\n${e?.message ? `Détail: ${e.message}` : ""}`.trim();
    }

    if (!reply) reply = "⚠️ Réponse vide du LLM local.";

    memory.push({ role: "assistant", content: reply });

    chatOutput.textContent = `Vous: ${prompt}\n\nIA: ${reply}\n\n` + chatOutput.textContent;

    setState("state-talk");
    const isErr = reply.startsWith("⚠️");
    setTimeout(() => setState("state-idle"), isErr ? 350 : 900);

    chatStatus.textContent = "Réponse reçue";
    setTimeout(() => { chatStatus.textContent = ""; }, 800);
  }

  chatSend.addEventListener("click", sendPrompt);

  chatInput.addEventListener("keydown", (e) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });
}

// =========================
// Global keys
// =========================
window.addEventListener("keydown", (e) => {
  // Toggle debug (Ctrl+Alt+D or Option+Command+D)
  const isToggleDebug = e.code === "KeyD" && ((e.ctrlKey && e.altKey) || (e.metaKey && e.altKey));
  if (isToggleDebug) {
    e.preventDefault();
    const currentlyOn = document.body.classList.contains("debug-on");
    setDebugEnabled(!currentlyOn);
    return;
  }

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

document.addEventListener("DOMContentLoaded", () => {
  initDebug();
  wireDebugButtons();
  initChat();
  initCursorAttraction();

  // état initial
  setState("state-idle");
});