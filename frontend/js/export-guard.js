(function (global) {
  "use strict";

  const PAGE_W = global.XHSEngine ? global.XHSEngine.PAGE_W : 1080;
  const PAGE_H = global.XHSEngine ? global.XHSEngine.PAGE_H : 1440;

  function textLen(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .length;
  }

  function checkPageOverflow(page, meta, style, themes, pageIndex, pageTotal) {
    const hidden = document.getElementById("export-container");
    if (!hidden || !global.XHSEngine) return false;
    const div = document.createElement("div");
    const shell = XHSEngine.pageShellAttrs(page);
    div.className = shell.className + " export-page";
    div.style.width = PAGE_W + "px";
    div.style.height = PAGE_H + "px";
    if (shell.style) {
      shell.style.split(";").forEach((pair) => {
        const idx = pair.indexOf(":");
        if (idx < 0) return;
        div.style.setProperty(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      });
    }
    XHSEngine.applyTheme(style, themes);
    div.innerHTML = XHSEngine.renderPage(page, meta || {}, {
      editable: false,
      pageIndex: pageIndex != null ? pageIndex : 0,
      pageTotal: pageTotal != null ? pageTotal : 1,
    });
    hidden.appendChild(div);
    const overflow = XHSEngine.checkOverflow(div);
    hidden.removeChild(div);
    return overflow;
  }

  function validatePublishPackage(ctx) {
    const blockers = [];
    const warnings = [];
    const title = (ctx.title || "").trim();
    const caption = (ctx.caption || "").trim();
    const data = ctx.data;
    const pages = (data && data.pages) || [];

    if (!pages.length) {
      blockers.push({ code: "no_pages", message: "没有可导出的页面", field: "pages" });
    }
    if (!title) {
      blockers.push({ code: "empty_title", message: "标题为空", field: "title" });
    } else if (textLen(title) < 6) {
      warnings.push({ code: "short_title", message: "标题过短", field: "title" });
    }
    if (!caption) {
      blockers.push({ code: "empty_caption", message: "发布正文 caption 为空", field: "caption" });
    } else if (textLen(caption) < 40) {
      warnings.push({ code: "short_caption", message: "正文过短", field: "caption" });
    } else if (!caption.includes("#")) {
      warnings.push({ code: "no_tags", message: "正文缺少话题标签 #", field: "caption" });
    }

    if (ctx.checkOverflow && data && pages.length && global.XHSEngine) {
      for (let i = 0; i < pages.length; i++) {
        if (checkPageOverflow(pages[i], data.meta, ctx.style, ctx.themes, i, pages.length)) {
          blockers.push({
            code: "overflow",
            message: `第 ${i + 1} 页内容溢出`,
            pageIndex: i,
            field: "page",
          });
        }
      }
    }

    if (ctx.forceExport && ctx.needsRereview) {
      warnings.push({ code: "skipped_rereview", message: "已跳过复审直接导出" });
    }

    return {
      ok: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  global.XHSExportGuard = {
    validatePublishPackage,
    checkPageOverflow,
    textLen,
  };
})(typeof window !== "undefined" ? window : globalThis);
