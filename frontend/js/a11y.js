(function (global) {
  "use strict";

  let announcer = null;

  function ensureAnnouncer() {
    if (announcer) return announcer;
    announcer = document.getElementById("sr-announcer");
    if (!announcer) {
      announcer = document.createElement("div");
      announcer.id = "sr-announcer";
      announcer.className = "sr-only";
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcer);
    }
    return announcer;
  }

  function announce(msg) {
    const el = ensureAnnouncer();
    el.textContent = "";
    requestAnimationFrame(() => {
      el.textContent = String(msg || "");
    });
  }

  function focusEl(el) {
    if (!el || typeof el.focus !== "function") return;
    try {
      el.focus({ preventScroll: false });
    } catch {
      el.focus();
    }
  }

  global.XHSA11y = { announce, focusEl, ensureAnnouncer };
})(typeof window !== "undefined" ? window : globalThis);
