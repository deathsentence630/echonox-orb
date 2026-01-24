console.log("renderer.js chargé ✅");

const STATES = ["state-idle", "state-listen", "state-think", "state-talk"];
let idx = 0;

/**
 * Debug mode toggle
 * - Persists in localStorage
 * - Can be forced with ?debug=1 (or disabled with ?debug=0)
 * - Toggles with:
 *   - macOS: ⌥ Option + ⌘ Command + D
 *   - Others: Ctrl + Alt + D
 */
function getDebugFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("debug")) return params.get("debug") === "1";
  } catch (_) {}
  return null;
}

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

  const hint = document.getElementById("debugHint");
  if (hint) {
    hint.textContent =
      "Tip: clique dans la fenêtre pour lui donner le focus, puis teste 1/2/3/4 (ou Tab). " +
      "Toggle debug: Ctrl+Alt+D (Win/Linux) ou ⌥⌘D (Mac).";
  }

  try {
    localStorage.setItem("debugEnabled", enabled ? "1" : "0");
  } catch (_) {}

  console.log("Debug:", enabled ? "ON" : "OFF");
}

function initDebug() {
  const forced = getDebugFromURL();
  const enabled = forced !== null ? forced : getDebugFromStorage();
  setDebugEnabled(enabled);
}

function setState(stateClass) {
  document.body.classList.remove(...STATES);
  document.body.classList.add(stateClass);

  const label = document.getElementById("stateLabel");
  if (label) label.textContent = stateClass;

  console.log("State:", stateClass);
}

function wireDebugButtons() {
  const buttons = document.querySelectorAll('#debug button[data-state]');
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const state = btn.getAttribute("data-state");
      if (state) setState(state);
      // keep focus so keyboard shortcuts work
      window.focus();
    });
  });
}

// Key handling robuste (QWERTY / AZERTY / Electron)
window.addEventListener("keydown", (e) => {
  // Toggle debug (Ctrl+Alt+D or Option+Command+D)
  const isToggleDebug =
    e.code === "KeyD" && ((e.ctrlKey && e.altKey) || (e.metaKey && e.altKey));

  if (isToggleDebug) {
    e.preventDefault();
    const currentlyOn = document.body.classList.contains("debug-on");
    setDebugEnabled(!currentlyOn);
    return;
  }

  // Only log keys when debug is enabled (less noisy)
  if (document.body.classList.contains("debug-on")) {
    console.log("Key pressed:", e.key, e.code);
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

  // état initial
  setState("state-idle");

  // Petit test visuel uniquement si debug activé
  setTimeout(() => {
    if (document.body.classList.contains("debug-on")) {
      setState("state-listen");
    }
  }, 300);

  // =========================
  // Cursor attraction (orb)
  // =========================
  function initCursorAttraction() {
    const wrap = document.getElementById("orbWrap");
    const orb = document.getElementById("orb");
    if (!wrap || !orb) return;

    // Réglages
    const MAX_OFFSET = 22; // px max de déplacement
    const STRENGTH = 0.22; // force d'attraction
    const EASE = 0.12;     // inertie

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
        // No mouse info: return to center
        targetX = 0;
        targetY = 0;
        wrap.style.setProperty("--bloom", "0");
      }

      currentX += (targetX - currentX) * EASE;
      currentY += (targetY - currentY) * EASE;

      if (Math.abs(currentX) < 0.05) currentX = 0;
      if (Math.abs(currentY) < 0.05) currentY = 0;

      wrap.style.transform =
        `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

      requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    requestAnimationFrame(tick);
  }

  // Init attraction
  initCursorAttraction();
});