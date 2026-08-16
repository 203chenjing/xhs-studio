/**
 * Minimal layout recipe defaults for client-side ops (mirrors knowledge/layout-recipes.json).
 */
(function (global) {
  const DEFAULTS = {
    "ledger-buying-guide": { density: "compact", pointsStyle: "ledger" },
    "closing-ledger-cta": { density: "normal", pointsStyle: "ledger" },
    "autumn-interview-mix": { density: "normal" },
    "number-shock-listicle": { density: "compact" },
    "quote-rhythm-break": { density: "airy" },
    "photo-led-field-note": { density: "airy" },
    "ins-minimal-scan": { density: "airy" },
    "swiss-metrics-tower": { density: "compact" },
    "composite-mashup": { density: "compact" },
    "signal-brutal-compare": { density: "compact" },
    "evidence-wall": { density: "compact" },
  };

  function defaultsFor(recipeId) {
    return DEFAULTS[String(recipeId || "").trim()] || {};
  }

  global.XHSLayoutCatalog = { defaultsFor };
})(typeof window !== "undefined" ? window : globalThis);
