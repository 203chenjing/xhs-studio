(function (global) {
  "use strict";

  let boundRoot = null;
  let overlayEl = null;
  let ctx = null;
  let selectedPath = null;
  let dragState = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.id = "xhs-edit-overlay";
    overlayEl.className = "xhs-edit-overlay";
    overlayEl.hidden = true;
    overlayEl.innerHTML =
      '<textarea class="xhs-edit-textarea" rows="3"></textarea>' +
      '<div class="xhs-edit-actions">' +
      '<button type="button" class="btn btn-sm btn-primary xhs-edit-save">保存</button>' +
      '<button type="button" class="btn btn-sm xhs-edit-cancel">取消</button>' +
      "</div>";
    document.body.appendChild(overlayEl);
    const ta = overlayEl.querySelector(".xhs-edit-textarea");
    const save = overlayEl.querySelector(".xhs-edit-save");
    const cancel = overlayEl.querySelector(".xhs-edit-cancel");
    save.addEventListener("click", () => commitOverlay());
    cancel.addEventListener("click", () => hideOverlay());
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideOverlay();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commitOverlay();
      }
    });
    return overlayEl;
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.hidden = true;
    overlayEl && overlayEl.removeAttribute("data-path");
  }

  function brToText(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  function showOverlay(target, path, initial) {
    const ov = ensureOverlay();
    const rect = target.getBoundingClientRect();
    ov.hidden = false;
    ov.style.left = Math.max(8, rect.left) + "px";
    ov.style.top = Math.max(8, rect.bottom + 6) + "px";
    ov.style.width = Math.min(360, Math.max(200, rect.width)) + "px";
    ov.dataset.path = path;
    const ta = ov.querySelector(".xhs-edit-textarea");
    ta.value = initial || "";
    ta.focus();
    ta.select();
  }

  function commitOverlay() {
    if (!overlayEl || !ctx) return;
    const path = overlayEl.dataset.path;
    const ta = overlayEl.querySelector(".xhs-edit-textarea");
    const value = ta.value;
    hideOverlay();
    if (!path || !ctx.onLocalOps) return;
    const op = global.XHSFieldPath.pathToOp(path, value);
    if (!op) return;
    ctx.onLocalOps([op], { summary: "改字" });
  }

  function onEditableClick(ev) {
    if (!ctx || !ctx.editable) return;
    if (ev.target.closest(".xhs-item-delete")) return;
    const el = ev.target.closest("[data-xhs-path]");
    if (!el || !boundRoot.contains(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const path = el.getAttribute("data-xhs-path");
    const kind = el.getAttribute("data-xhs-kind") || "text";
    selectedPath = path;
    if (ctx.onSelectPath) ctx.onSelectPath(path);
    if (kind === "image") {
      if (ctx.onImageClick) ctx.onImageClick(path);
      return;
    }
    if (kind === "list-item") {
      selectedPath = path;
      if (ctx.onSelectPath) ctx.onSelectPath(path);
      const nested = el.querySelector("[data-xhs-path]");
      if (nested && nested.getAttribute("data-xhs-path") !== path) return;
      const initial = brToText(
        el.innerHTML.replace(/<button[^>]*class="[^"]*xhs-item-delete[^"]*"[^>]*>[\s\S]*?<\/button>/gi, "")
      );
      showOverlay(el, path, initial);
      return;
    }
    const initial = brToText(el.innerHTML);
    showOverlay(el, path, initial);
  }

  function listPathFromSortable(el) {
    return el.getAttribute("data-xhs-list-path") || el.getAttribute("data-xhs-sortable") || "";
  }

  function onDragStart(ev) {
    if (ev.target.closest(".xhs-item-delete")) return;
    const li = ev.target.closest("[data-xhs-sortable]");
    if (!li || !boundRoot.contains(li)) return;
    dragState = {
      list: listPathFromSortable(li),
      from: Array.from(li.parentElement.children).indexOf(li) + 1,
    };
    ev.dataTransfer.effectAllowed = "move";
    try {
      ev.dataTransfer.setData("text/plain", dragState.from);
    } catch {
      /* ignore */
    }
  }

  function onDragOver(ev) {
    if (!dragState) return;
    const li = ev.target.closest("[data-xhs-sortable]");
    if (li) ev.preventDefault();
  }

  function listOpFields(list) {
    if (list && String(list).includes("[")) return { listPath: list };
    return { list };
  }

  function onDrop(ev) {
    if (!dragState || !ctx || !ctx.onLocalOps) return;
    const li = ev.target.closest("[data-xhs-sortable]");
    if (!li) return;
    ev.preventDefault();
    const list = dragState.list || listPathFromSortable(li);
    const to = Array.from(li.parentElement.children).indexOf(li) + 1;
    const from = dragState.from;
    dragState = null;
    if (from === to) return;
    ctx.onLocalOps(
      [{ op: "moveItem", ...listOpFields(list), from, to }],
      { summary: "排序" }
    );
  }

  function onDeleteItemClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!ctx || !ctx.onLocalOps) return;
    const btn = ev.currentTarget;
    const li = btn.closest("[data-xhs-sortable]");
    if (!li || !boundRoot.contains(li)) return;
    const list = listPathFromSortable(li);
    const index = Array.from(li.parentElement.children).indexOf(li) + 1;
    if (!list || index < 1) return;
    ctx.onLocalOps(
      [{ op: "deleteItem", ...listOpFields(list), index }],
      { summary: "删除" }
    );
  }

  function bindSortableRow(el) {
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    if (!el.querySelector(".xhs-item-delete")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "xhs-item-delete";
      btn.setAttribute("aria-label", "删除此项");
      btn.title = "删除";
      btn.textContent = "×";
      btn.addEventListener("click", onDeleteItemClick);
      el.appendChild(btn);
    }
  }

  function bind(root, options) {
    unbind();
    if (!root || !options || !options.editable) return;
    boundRoot = root;
    ctx = options;
    root.classList.add("xhs-edit-mode");
    root.addEventListener("click", onEditableClick);
    root.querySelectorAll("[data-xhs-sortable]").forEach(bindSortableRow);
  }

  function unbind() {
    hideOverlay();
    if (boundRoot) {
      boundRoot.classList.remove("xhs-edit-mode");
      boundRoot.removeEventListener("click", onEditableClick);
      boundRoot.querySelectorAll("[data-xhs-sortable]").forEach((el) => {
        el.removeAttribute("draggable");
      });
    }
    boundRoot = null;
    ctx = null;
    selectedPath = null;
    dragState = null;
  }

  function getSelectedPath() {
    return selectedPath;
  }

  global.XHSWysiwyg = {
    bind,
    unbind,
    getSelectedPath,
    brToText,
  };
})(typeof window !== "undefined" ? window : globalThis);
