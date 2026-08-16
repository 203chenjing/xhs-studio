(function (global) {
  "use strict";

  function parsePath(path) {
    const parts = [];
    const re = /([^.\[\]]+)|\[(\d+)\]/g;
    let m;
    const s = String(path || "").trim();
    while ((m = re.exec(s))) {
      if (m[1] != null) parts.push(m[1]);
      else parts.push(parseInt(m[2], 10));
    }
    return parts;
  }

  function getAtPath(obj, path) {
    const parts = Array.isArray(path) ? path : parsePath(path);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setAtPath(obj, path, value) {
    const parts = Array.isArray(path) ? path.slice() : parsePath(path);
    if (!parts.length) return obj;
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] == null || typeof cur[p] !== "object") {
        cur[p] = typeof parts[i + 1] === "number" ? [] : {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  const TOP_LEVEL_FIELDS = new Set([
    "title", "subtitle", "kicker", "body", "text", "intro", "desc", "caption",
    "from", "no", "bridge", "role", "progress", "contact", "label",
  ]);

  const ITEM_PATCH_FIELDS = ["head", "body", "value", "text", "time", "label"];

  /** @deprecated use pathToOp */
  function pathToRewriteField(path) {
    const op = pathToOp(path, "");
    if (!op) return "";
    if (op.op === "rewriteField") return op.field;
    return "";
  }

  function partsToPath(parts) {
    let s = "";
    parts.forEach((p, i) => {
      if (typeof p === "number") s += `[${p}]`;
      else s += (i === 0 ? p : `.${p}`);
    });
    return s;
  }

  /** Map data-xhs-path to a page op (rewriteField, updateItem, or patchPath). */
  function pathToOp(path, value) {
    const parts = parsePath(path);
    if (!parts.length) return null;

    const last = parts[parts.length - 1];

    if (parts[0] === "blocks") {
      // compare cell in composite block: blocks[0].rows[1].values[2]
      if (
        typeof last === "number" &&
        parts.length >= 6 &&
        parts[parts.length - 2] === "values" &&
        typeof parts[parts.length - 3] === "number"
      ) {
        return {
          op: "updateItem",
          listPath: partsToPath(parts.slice(0, parts.length - 3)),
          index: parts[parts.length - 3] + 1,
          valueIndex: last + 1,
          value,
        };
      }
      if (typeof last === "number" && parts.length >= 3) {
        return {
          op: "updateItem",
          listPath: partsToPath(parts.slice(0, parts.length - 2)),
          index: last + 1,
          body: value,
        };
      }
      if (parts.length >= 4 && typeof parts[parts.length - 2] === "number") {
        const listPath = partsToPath(parts.slice(0, parts.length - 3));
        const index = parts[parts.length - 2] + 1;
        const field = String(last);
        const op = { op: "updateItem", listPath, index };
        if (field === "head" || field === "time" || field === "label") {
          op[field] = value;
        } else {
          op.body = value;
        }
        return op;
      }
      return { op: "patchPath", path: partsToPath(parts), value };
    }

    // compare cell: rows[0].values[1]
    if (
      typeof last === "number" &&
      parts.length >= 4 &&
      parts[parts.length - 2] === "values" &&
      typeof parts[parts.length - 3] === "number"
    ) {
      const list = String(parts[parts.length - 4]);
      return {
        op: "updateItem",
        list,
        index: parts[parts.length - 3] + 1,
        valueIndex: last + 1,
        value,
      };
    }

    // Whole list item: items[0], steps[1], cta[0], rows[0]
    if (typeof last === "number" && parts.length >= 2) {
      const list = String(parts[parts.length - 2]);
      return { op: "updateItem", list, index: last + 1, body: value };
    }

    // Nested item field: steps[1].head, items[0].body, rows[0].label
    if (parts.length >= 3 && typeof parts[parts.length - 2] === "number") {
      const list = String(parts[parts.length - 3]);
      const index = parts[parts.length - 2] + 1;
      const field = String(last);
      const op = { op: "updateItem", list, index };
      if (field === "head" || field === "time" || field === "label") {
        op[field] = value;
      } else {
        op.body = value;
      }
      return op;
    }

    const field = String(last);
    if (TOP_LEVEL_FIELDS.has(field)) {
      return { op: "rewriteField", field, value };
    }
    return null;
  }

  function listKeyFromPath(path) {
    const parts = parsePath(path);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (typeof parts[i] === "number" && i > 0) return parts[i - 1];
    }
    return null;
  }

  global.XHSFieldPath = {
    parsePath,
    getAtPath,
    setAtPath,
    partsToPath,
    pathToRewriteField,
    pathToOp,
    listKeyFromPath,
    TOP_LEVEL_FIELDS,
    ITEM_PATCH_FIELDS,
  };
})(typeof window !== "undefined" ? window : globalThis);
