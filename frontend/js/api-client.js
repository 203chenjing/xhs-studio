(function (global) {
  "use strict";

  let activeController = null;
  let activeKind = "";

  const DEFAULT_TIMEOUT = {
    health: 8000,
    upload: 60000,
    generate: 120000,
    review: 90000,
    revise: 90000,
    page_revise: 90000,
    layout_ideas: 60000,
    cleanup: 15000,
    default: 60000,
  };

  function mergeSignals(signals) {
    const list = signals.filter(Boolean);
    if (!list.length) return null;
    if (typeof AbortSignal !== "undefined" && AbortSignal.any) {
      try {
        return AbortSignal.any(list);
      } catch {
        /* fall through */
      }
    }
    const ctrl = new AbortController();
    list.forEach((s) => {
      if (s.aborted) ctrl.abort();
      else s.addEventListener("abort", () => ctrl.abort(), { once: true });
    });
    return ctrl.signal;
  }

  async function apiFetch(path, options) {
    const opts = options || {};
    const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : DEFAULT_TIMEOUT.default;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException("请求超时", "TimeoutError"));
    }, timeoutMs);

    const external = opts.signal || null;
    const signal = mergeSignals([controller.signal, external]);

    try {
      const res = await fetch(path, {
        method: opts.method || "GET",
        headers: opts.headers,
        body: opts.body,
        signal,
      });
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j.detail || j.message || JSON.stringify(j);
        } catch {
          detail = res.statusText || String(res.status);
        }
        const err = new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return res.json();
      return res;
    } catch (e) {
      if (e && e.name === "AbortError") {
        const msg =
          e.message === "请求超时" || e.message === "TimeoutError"
            ? "请求已取消或超时"
            : "请求已取消";
        const err = new Error(msg);
        err.aborted = true;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function beginRequest(kind) {
    cancelRequest();
    activeKind = kind || "";
    activeController = new AbortController();
    return activeController.signal;
  }

  function cancelRequest() {
    if (activeController) {
      try {
        activeController.abort(new DOMException("用户取消", "AbortError"));
      } catch {
        /* ignore */
      }
    }
    activeController = null;
    activeKind = "";
  }

  function getActiveKind() {
    return activeKind;
  }

  global.XHSApi = {
    apiFetch,
    beginRequest,
    cancelRequest,
    getActiveKind,
    DEFAULT_TIMEOUT,
  };
})(typeof window !== "undefined" ? window : globalThis);
