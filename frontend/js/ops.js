(function (global) {
  "use strict";

  const REWRITE_FIELDS = new Set([
    "title", "subtitle", "kicker", "body", "text", "intro", "desc", "caption", "from", "no", "bridge", "role", "progress", "contact", "label",
  ]);

  const PAGE_TYPES = new Set([
    "cover", "chapter", "points", "timeline", "card", "quote", "compare", "summary", "ending", "composite", "photo", "gallery", "free",
  ]);

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function listKeyForPage(page) {
    if (!page || typeof page !== "object") return null;
    const t = page.type || "";
    if (t === "points" || t === "summary") return "items";
    if (t === "timeline") return "steps";
    if (t === "compare") return "rows";
    if (t === "free") {
      if (Array.isArray(page.bullets) && page.bullets.length) return "bullets";
      if (Array.isArray(page.paragraphs) && page.paragraphs.length) return "paragraphs";
      return "bullets";
    }
    if (t === "card") return "tips";
    if (t === "ending") return "cta";
    return null;
  }

  function markUserEdited(page) {
    if (!page || typeof page !== "object") return page;
    return { ...page, _user_edited: true };
  }

  function normalizeOp(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.op || "").trim();
    const allowed = new Set([
      "setDensity", "setFontScale", "rewriteField", "deleteItem", "updateItem", "setPageType",
      "setPointsLayout", "setPageLayoutVariant", "setLayoutRecipe",
      "moveItem", "insertItem", "setImage", "setImageFocus", "patchPath",
    ]);
    if (!allowed.has(name)) return null;
    const out = { op: name };
    if (name === "setDensity") {
      const d = String(raw.density || "").toLowerCase();
      if (!["compact", "normal", "airy"].includes(d)) return null;
      out.density = d;
    } else if (name === "setFontScale") {
      const fs = Number(raw.fontScale);
      if (!Number.isFinite(fs)) return null;
      out.fontScale = Math.max(0.65, Math.min(1.4, fs));
    } else if (name === "rewriteField") {
      const field = String(raw.field || "").trim();
      if (!REWRITE_FIELDS.has(field)) return null;
      out.field = field;
      out.value = raw.value == null ? "" : String(raw.value);
    } else if (name === "deleteItem" || name === "updateItem" || name === "moveItem" || name === "insertItem") {
      const idx = parseInt(raw.index, 10);
      const from = parseInt(raw.from, 10);
      const to = parseInt(raw.to, 10);
      if (name === "moveItem") {
        if (!(from >= 1) || !(to >= 1)) return null;
        out.from = from;
        out.to = to;
      } else if (name === "insertItem") {
        if (!(idx >= 1)) return null;
        out.index = idx;
        out.item = raw.item;
      } else {
        if (!(idx >= 1)) return null;
        out.index = idx;
      }
      const lst = String(raw.list || "").trim();
      if (lst) out.list = lst;
      const lp = String(raw.listPath || "").trim();
      if (lp) out.listPath = lp;
      if (name === "updateItem") {
        ["head", "body", "value", "text", "time", "label"].forEach((k) => {
          if (raw[k] != null) out[k] = String(raw[k]);
        });
        const vi = parseInt(raw.valueIndex, 10);
        if (vi >= 1) out.valueIndex = vi;
      }
    } else if (name === "setImage") {
      out.slot = String(raw.slot || "image");
      out.url = String(raw.url || "");
      if (raw.focus) out.focus = raw.focus;
    } else if (name === "setImageFocus") {
      out.slot = String(raw.slot || "image");
      out.x = Math.max(0, Math.min(100, Number(raw.x) || 50));
      out.y = Math.max(0, Math.min(100, Number(raw.y) || 50));
    } else if (name === "setPageType") {
      const t = String(raw.type || "");
      if (!PAGE_TYPES.has(t)) return null;
      out.type = t;
    } else if (name === "setPointsLayout") {
      const layout = String(raw.layout || "").toLowerCase();
      if (!["ledger", "cards"].includes(layout)) return null;
      out.layout = layout;
    } else if (name === "setPageLayoutVariant") {
      const variant = String(raw.variant || raw.layoutVariant || "").trim();
      if (!variant) return null;
      out.variant = variant;
    } else if (name === "setLayoutRecipe") {
      const recipeId = String(raw.recipeId || "").trim();
      if (!recipeId) return null;
      out.recipeId = recipeId;
    } else if (name === "patchPath") {
      const p = String(raw.path || "").trim();
      if (!p) return null;
      out.path = p;
      out.value = raw.value == null ? "" : raw.value;
    }
    return out;
  }

  function applyDensity(page, density) {
    const out = { ...page, density };
    const fs = density === "compact" ? 0.88 : density === "airy" ? 1.12 : 1;
    out.fontScale = fs;
    out.style = { ...(page.style || {}), density, fontScale: fs };
    return out;
  }

  function listPathKey(op) {
    if (op.listPath) return { path: op.listPath, nested: true };
    if (op.list && String(op.list).includes("[")) return { path: op.list, nested: true };
    if (op.list) return { path: op.list, nested: false };
    return null;
  }

  function readList(page, spec) {
    if (!spec) return null;
    if (spec.nested) {
      const arr = global.XHSFieldPath.getAtPath(page, spec.path);
      return Array.isArray(arr) ? arr : null;
    }
    return page[spec.path];
  }

  function writeList(page, spec, items) {
    if (!spec) return page;
    if (spec.nested) {
      global.XHSFieldPath.setAtPath(page, spec.path, items);
      return page;
    }
    page[spec.path] = items;
    return page;
  }

  function applyPageOps(page, ops) {
    let out = clone(page || { type: "card", title: "内容", body: "" });
    const applied = [];
    for (const raw of ops || []) {
      const op = normalizeOp(raw);
      if (!op) continue;
      const name = op.op;
      if (name === "setDensity") {
        out = applyDensity(out, op.density);
      } else if (name === "setFontScale") {
        out.fontScale = op.fontScale;
        let dens = out.density || "normal";
        if (op.fontScale <= 0.9) dens = "compact";
        else if (op.fontScale >= 1.1) dens = "airy";
        out.density = dens;
        out.style = { ...(out.style || {}), density: dens, fontScale: op.fontScale };
      } else if (name === "rewriteField") {
        out[op.field] = op.value;
      } else if (name === "patchPath") {
        global.XHSFieldPath.setAtPath(out, op.path, op.value);
      } else if (name === "deleteItem") {
        const spec = listPathKey(op) || (listKeyForPage(out) ? { path: listKeyForPage(out), nested: false } : null);
        if (!spec) continue;
        const items = [...(readList(out, spec) || [])];
        const idx = op.index;
        if (idx < 1 || idx > items.length) continue;
        items.splice(idx - 1, 1);
        writeList(out, spec, items);
      } else if (name === "insertItem") {
        const spec = listPathKey(op) || (listKeyForPage(out) ? { path: listKeyForPage(out), nested: false } : null);
        if (!spec) continue;
        const key = spec.nested ? spec.path.split(".").pop() : spec.path;
        const items = [...(readList(out, spec) || [])];
        const idx = Math.min(op.index, items.length + 1);
        const item = op.item || (key === "items" || key === "steps" ? { head: "新条目", body: "" } : "新条目");
        items.splice(idx - 1, 0, item);
        writeList(out, spec, items);
      } else if (name === "moveItem") {
        const spec = listPathKey(op) || (listKeyForPage(out) ? { path: listKeyForPage(out), nested: false } : null);
        if (!spec) continue;
        const items = [...(readList(out, spec) || [])];
        const from = op.from - 1;
        const to = op.to - 1;
        if (from < 0 || from >= items.length || to < 0 || to >= items.length) continue;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        writeList(out, spec, items);
      } else if (name === "updateItem") {
        const spec = listPathKey(op) || (listKeyForPage(out) ? { path: listKeyForPage(out), nested: false } : null);
        if (!spec) continue;
        const items = [...(readList(out, spec) || [])];
        const idx = op.index;
        if (idx < 1 || idx > items.length) continue;
        const cur = items[idx - 1];
        const newText = op.body || op.value || op.text;
        if (typeof cur === "object" && cur) {
          const nxt = { ...cur };
          ["head", "body", "value", "text", "time", "label"].forEach((k) => {
            if (op[k] != null) nxt[k] = op[k];
          });
          if (op.valueIndex != null) {
            const vi = parseInt(op.valueIndex, 10) - 1;
            if (vi >= 0) {
              const vals = Array.isArray(nxt.values) ? [...nxt.values] : [];
              while (vals.length <= vi) vals.push("");
              vals[vi] = op.value != null ? op.value : newText != null ? newText : vals[vi];
              nxt.values = vals;
            }
          }
          items[idx - 1] = nxt;
        } else if (newText != null) {
          items[idx - 1] = newText;
        }
        writeList(out, spec, items);
      } else if (name === "setImage") {
        const slot = op.slot || "image";
        if (slot.startsWith("images[")) {
          const m = slot.match(/images\[(\d+)\]/);
          if (m) {
            const i = parseInt(m[1], 10);
            const imgs = [...(out.images || [])];
            while (imgs.length <= i) imgs.push("");
            imgs[i] = op.url;
            out.images = imgs;
          }
        } else {
          out.image = op.url;
        }
        if (op.focus) {
          out.imageFocus = op.focus;
        }
      } else if (name === "setImageFocus") {
        out.imageFocus = { x: op.x, y: op.y };
      } else if (name === "setPageType") {
        out.type = op.type;
      } else if (name === "setPointsLayout") {
        if ((out.type || "points") !== "points") continue;
        out.pointsStyle = op.layout;
        out.layoutVariant = op.layout;
        const styleObj = out.style && typeof out.style === "object" ? { ...out.style } : {};
        styleObj.pointsStyle = op.layout;
        styleObj.layoutVariant = op.layout;
        out.style = styleObj;
      } else if (name === "setPageLayoutVariant") {
        out.layoutVariant = op.variant;
        const styleObj = out.style && typeof out.style === "object" ? { ...out.style } : {};
        styleObj.layoutVariant = op.variant;
        out.style = styleObj;
        if (out.type === "points" && (op.variant === "ledger" || op.variant === "cards")) {
          out.pointsStyle = op.variant;
          styleObj.pointsStyle = op.variant;
        }
      } else if (name === "setLayoutRecipe") {
        out.layoutRecipe = op.recipeId;
        const defaults = (global.XHSLayoutCatalog && global.XHSLayoutCatalog.defaultsFor(op.recipeId)) || {};
        if (defaults.density) out = applyDensity(out, defaults.density);
        if (defaults.pointsStyle && out.type === "points") {
          out.pointsStyle = defaults.pointsStyle;
          const styleObj = out.style && typeof out.style === "object" ? { ...out.style } : {};
          styleObj.pointsStyle = defaults.pointsStyle;
          out.style = styleObj;
        }
      }
      applied.push(op);
    }
    return { page: markUserEdited(out), applied, summary: applied.map((o) => o.op).join(" · ") };
  }

  function blankPage(type) {
    const t = type || "card";
    const map = {
      cover: { type: "cover", title: "新封面", subtitle: "副标题" },
      ending: { type: "ending", title: "结尾", desc: "行动号召", cta: ["收藏备用"] },
      points: { type: "points", title: "要点", items: [{ head: "1", body: "内容" }] },
      timeline: { type: "timeline", title: "步骤", steps: [{ time: "Day1", head: "步骤", body: "说明" }] },
      card: { type: "card", title: "卡片", body: "正文" },
      quote: { type: "quote", text: "金句" },
      compare: { type: "compare", title: "对比", cols: [{ head: "维度" }, { head: "A", tone: "neg" }, { head: "B", tone: "pos" }], rows: [{ label: "项", values: ["", ""] }] },
      summary: { type: "summary", title: "总结", items: ["要点一"] },
      free: { type: "free", title: "展开", paragraphs: ["正文"] },
      photo: { type: "photo", title: "配图", body: "说明" },
      gallery: { type: "gallery", title: "图集", images: [] },
    };
    return map[t] || map.card;
  }

  function applyDocumentOps(data, ops) {
    const out = clone(data || { meta: {}, pages: [] });
    if (!Array.isArray(out.pages)) out.pages = [];
    const applied = [];
    for (const raw of ops || []) {
      if (!raw || typeof raw !== "object") continue;
      const name = String(raw.op || "");
      if (name === "movePage") {
        const from = parseInt(raw.from, 10) - 1;
        const to = parseInt(raw.to, 10) - 1;
        if (from < 0 || from >= out.pages.length || to < 0 || to >= out.pages.length) continue;
        const [p] = out.pages.splice(from, 1);
        out.pages.splice(to, 0, p);
        applied.push(raw);
      } else if (name === "duplicatePage") {
        const idx = parseInt(raw.index, 10) - 1;
        if (idx < 0 || idx >= out.pages.length || out.pages.length >= 12) continue;
        out.pages.splice(idx + 1, 0, markUserEdited(clone(out.pages[idx])));
        applied.push(raw);
      } else if (name === "insertPage") {
        const idx = parseInt(raw.index, 10) - 1;
        const pg = raw.page || blankPage(raw.type);
        const at = Math.max(0, Math.min(idx + 1, out.pages.length));
        out.pages.splice(at, 0, markUserEdited(pg));
        applied.push(raw);
      } else if (name === "deletePage") {
        const idx = parseInt(raw.index, 10) - 1;
        if (idx < 0 || idx >= out.pages.length) continue;
        const t = out.pages[idx].type;
        if (t === "cover" || t === "ending") {
          const count = out.pages.filter((p) => p.type === t).length;
          if (count <= 1) continue;
        }
        out.pages.splice(idx, 1);
        applied.push(raw);
      }
    }
    return { data: out, applied };
  }

  global.XHSOps = {
    clone,
    listKeyForPage,
    applyPageOps,
    applyDocumentOps,
    blankPage,
    normalizeOp,
    markUserEdited,
  };
})(typeof window !== "undefined" ? window : globalThis);
