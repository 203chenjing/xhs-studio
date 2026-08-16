/**
 * XHS page render engine — 1080×1440 canvas
 * Extracted from xhs-templates (shared renderers for page types + images).
 */
(function (global) {
  "use strict";

  const PAGE_W = 1080;
  const PAGE_H = 1440;

  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, "<br>");
  }

  function imgTag(src, cls, focus) {
    if (!src) return "";
    let style = "";
    if (focus && typeof focus === "object") {
      const x = Number(focus.x);
      const y = Number(focus.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        style = ` style="object-position:${x}% ${y}%"`;
      }
    }
    return `<img class="${cls}" src="${esc(src)}" alt="" crossorigin="anonymous" decoding="async"${style} />`;
  }

  function edAttr(path, kind, sortable) {
    if (!path) return "";
    let s = ` data-xhs-path="${esc(path)}" data-xhs-kind="${kind || "text"}"`;
    if (sortable) s += ` data-xhs-sortable="${esc(sortable)}"`;
    return s;
  }

  /** WYSIWYG paths for card-based compare rows (label + values[*]) */
  function markCompareRowElements(scope, rowsPathPrefix, listPath) {
    scope.querySelectorAll(".compare-row").forEach((el, i) => {
      const rowPath = `${rowsPathPrefix}[${i}]`;
      el.setAttribute("data-xhs-path", rowPath);
      el.setAttribute("data-xhs-kind", "list-item");
      el.setAttribute("data-xhs-sortable", "rows");
      if (listPath) el.setAttribute("data-xhs-list-path", listPath);
      el.classList.add("xhs-editable");
      const dim = el.querySelector(".compare-cell.col-dim");
      if (dim) {
        dim.setAttribute("data-xhs-path", `${rowPath}.label`);
        dim.setAttribute("data-xhs-kind", "text");
        dim.classList.add("xhs-editable");
      }
      el.querySelectorAll(".compare-cell:not(.col-dim)").forEach((cell, j) => {
        cell.setAttribute("data-xhs-path", `${rowPath}.values[${j}]`);
        cell.setAttribute("data-xhs-kind", "text");
        cell.classList.add("xhs-editable");
      });
    });
  }

  function annotateEditable(html, page) {
    if (!page || typeof DOMParser === "undefined") return html;
    try {
      const wrap = `<div id="xhs-annotate-root">${html}</div>`;
      const doc = new DOMParser().parseFromString(wrap, "text/html");
      const root = doc.getElementById("xhs-annotate-root");
      if (!root) return html;
      const t = page.type || "card";
      const mark = (sel, path, kind, sortable, listPath) => {
        root.querySelectorAll(sel).forEach((el, i) => {
          const p = path.replace(/\{i\}/g, String(i));
          el.setAttribute("data-xhs-path", p);
          el.setAttribute("data-xhs-kind", kind || "text");
          if (sortable) {
            el.setAttribute("data-xhs-sortable", sortable);
            if (listPath) el.setAttribute("data-xhs-list-path", listPath);
          }
          el.classList.add("xhs-editable");
        });
      };
      const markIn = (scope, sel, path, kind, sortable, listPath) => {
        scope.querySelectorAll(sel).forEach((el, i) => {
          const p = path.replace(/\{i\}/g, String(i));
          el.setAttribute("data-xhs-path", p);
          el.setAttribute("data-xhs-kind", kind || "text");
          if (sortable) {
            el.setAttribute("data-xhs-sortable", sortable);
            if (listPath) el.setAttribute("data-xhs-list-path", listPath);
          }
          el.classList.add("xhs-editable");
        });
      };
      const annotateBlock = (scope, prefix, blockType) => {
        const bt = blockType || "card";
        const lp = (listKey) => `${prefix}.${listKey}`;
        if (bt === "points") {
          markIn(scope, ".cb-title", `${prefix}.title`, "text");
          markIn(scope, ".cb-intro", `${prefix}.intro`, "text");
          markIn(scope, ".points-list > li, .points-ledger > li", `${prefix}.items[{i}]`, "list-item", "items", lp("items"));
          markIn(scope, ".pt-head", `${prefix}.items[{i}].head`, "text");
          markIn(scope, ".pt-body", `${prefix}.items[{i}].body`, "text");
        } else if (bt === "timeline") {
          markIn(scope, ".cb-title", `${prefix}.title`, "text");
          markIn(scope, ".timeline .timeline-step", `${prefix}.steps[{i}]`, "list-item", "steps", lp("steps"));
          markIn(scope, ".step-badge", `${prefix}.steps[{i}].time`, "text");
          markIn(scope, ".step-head", `${prefix}.steps[{i}].head`, "text");
          markIn(scope, ".step-body", `${prefix}.steps[{i}].body`, "text");
        } else if (bt === "card") {
          markIn(scope, ".card-label", `${prefix}.label`, "text");
          markIn(scope, ".card-title", `${prefix}.title`, "text");
          markIn(scope, ".card-body", `${prefix}.body`, "text");
        } else if (bt === "quote") {
          markIn(scope, ".quote-text", `${prefix}.text`, "text");
        } else if (bt === "summary") {
          markIn(scope, ".cb-title", `${prefix}.title`, "text");
          markIn(scope, ".summary-card", `${prefix}.items[{i}]`, "list-item", "items", lp("items"));
          markIn(scope, ".summary-text", `${prefix}.items[{i}]`, "text");
        } else if (bt === "compare") {
          markIn(scope, ".cb-title", `${prefix}.title`, "text");
          markCompareRowElements(scope, `${prefix}.rows`, lp("rows"));
        } else if (bt === "free") {
          markIn(scope, ".block-title", `${prefix}.title`, "text");
          markIn(scope, ".kicker", `${prefix}.kicker`, "text");
          markIn(scope, ".free-p", `${prefix}.paragraphs[{i}]`, "text", "paragraphs", lp("paragraphs"));
          markIn(scope, ".free-bullets > li", `${prefix}.bullets[{i}]`, "list-item", "bullets", lp("bullets"));
        }
      };
      if (t === "cover") {
        mark(".kicker", "kicker", "text");
        mark(".cover-title", "title", "text");
        mark(".cover-sub", "subtitle", "text");
        mark(".cover-hero-img, .block-thumb-img", "image", "image");
      } else if (t === "points") {
        mark(".block-title", "title", "text");
        mark(".block-intro", "intro", "text");
        mark(".points-list > li, .points-ledger > li", "items[{i}]", "list-item", "items");
        mark(".pt-head", "items[{i}].head", "text");
        mark(".pt-body", "items[{i}].body", "text");
        mark(".block-thumb-img", "image", "image");
      } else if (t === "timeline") {
        mark(".block-title", "title", "text");
        mark(".timeline .timeline-step", "steps[{i}]", "list-item", "steps");
        mark(".step-badge", "steps[{i}].time", "text");
        mark(".step-head", "steps[{i}].head", "text");
        mark(".step-body", "steps[{i}].body", "text");
      } else if (t === "card") {
        mark(".card-label", "label", "text");
        mark(".card-title", "title", "text");
        mark(".card-body", "body", "text");
        mark(".card-tips > li", "tips[{i}]", "list-item", "tips");
        mark(".block-thumb-img", "image", "image");
      } else if (t === "quote") {
        mark(".quote-text", "text", "text");
        mark(".quote-from", "from", "text");
      } else if (t === "summary") {
        mark(".block-title", "title", "text");
        mark(".summary-card", "items[{i}]", "list-item", "items");
        mark(".summary-text", "items[{i}]", "text");
      } else if (t === "compare") {
        mark(".block-title", "title", "text");
        markCompareRowElements(root, "rows", "rows");
      } else if (t === "ending") {
        mark(".ending-title", "title", "text");
        mark(".ending-desc", "desc", "text");
        mark(".cta-btn", "cta[{i}]", "list-item", "cta");
      } else if (t === "photo") {
        mark(".block-title", "title", "text");
        mark(".photo-body", "body", "text");
        mark(".photo-hero-img", "image", "image");
      } else if (t === "gallery") {
        mark(".block-title", "title", "text");
        mark(".block-intro", "caption", "text");
      } else if (t === "chapter") {
        mark(".chapter-no", "no", "text");
        mark(".chapter-title", "title", "text");
        mark(".chapter-desc", "desc", "text");
        mark(".chapter-role", "role", "text");
      } else if (t === "free") {
        mark(".block-title", "title", "text");
        mark(".kicker", "kicker", "text");
        mark(".free-p", "paragraphs[{i}]", "text", "paragraphs");
        mark(".free-bullets > li", "bullets[{i}]", "list-item", "bullets");
      } else if (t === "composite") {
        mark(".composite-page > .page-content > .block-title", "title", "text");
        const blocks = page.blocks || [];
        root.querySelectorAll(".composite-block").forEach((blockEl, bi) => {
          const block = blocks[bi] || {};
          const bt =
            block.type ||
            (blockEl.className.match(/composite-(\w+)/) || [])[1] ||
            "card";
          annotateBlock(blockEl, `blocks[${bi}]`, bt);
        });
      } else {
        mark(".block-title, .card-title, .cb-title", "title", "text");
        mark(".card-body, .free-p", "body", "text");
      }
      return root.innerHTML;
    } catch {
      return html;
    }
  }

  function renderMeta(meta) {
    meta = meta || {};
    const av = meta.avatar || (meta.author ? meta.author[0] : "?");
    const brand = meta.brand || "";
    const author = meta.author || "";
    return `<div class="page-footer"><div class="footer-left"><span class="footer-avatar">${esc(av)}</span><span class="footer-author">${esc(author)}</span></div>${brand ? `<span class="footer-brand">${esc(brand)}</span>` : ""}</div>`;
  }

  function formatTag(t) {
    const s = String(t || "").trim();
    if (!s) return "";
    return s.startsWith("#") ? s : "#" + s;
  }

  function renderTags(tags) {
    if (!tags || !tags.length) return "";
    return `<div class="tags">${tags.map((t) => `<span class="tag tag-pill">${esc(formatTag(t))}</span>`).join("")}</div>`;
  }

  function summaryIndex(i) {
    return String(i + 1).padStart(2, "0");
  }

  function renderSummaryItems(items, sm) {
    const cls = sm ? "summary-list sm" : "summary-list";
    return `<ul class="${cls}">${(items || []).map((it, i) => `<li class="summary-card"><span class="summary-index" aria-hidden="true">${summaryIndex(i)}</span><span class="summary-text">${nl2br(it)}</span></li>`).join("")}</ul>`;
  }

  function renderCtaRow(cta) {
    if (!cta || !cta.length) return "";
    return `<div class="cta-row">${cta.map((c) => `<span class="cta-btn">${nl2br(c)}</span>`).join("")}</div>`;
  }

  function layoutVariantOf(p, pageType) {
    if (!p || typeof p !== "object") return "";
    const v = p.layoutVariant || (p.style && p.style.layoutVariant);
    if (v) return String(v);
    if (pageType === "points") {
      const ps = p.pointsStyle || (p.style && p.style.pointsStyle);
      if (ps === "ledger") return "ledger";
      return "cards";
    }
    return "";
  }

  function formatPageIndicator(idx, total) {
    if (!Number.isFinite(idx) || !Number.isFinite(total) || total <= 0) return "";
    return `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  }

  const VARIANT_DEFAULTS = new Set([
    "default",
    "cards",
    "vertical-rail",
    "three-col",
    "checklist-cards",
    "cta-pill",
    "hero-dominant",
    "grid-balanced",
    "number-hero",
    "stack-blocks",
    "editorial",
    "accent-label",
  ]);

  function toRomanChapterNo(raw) {
    const n = parseInt(String(raw || "").replace(/\D/g, ""), 10) || 1;
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
    let x = Math.max(1, Math.min(3999, n));
    let out = "";
    for (let i = 0; i < vals.length; i++) {
      while (x >= vals[i]) {
        out += syms[i];
        x -= vals[i];
      }
    }
    return out;
  }

  function variantPageClass(pageType, variant) {
    const v = String(variant || "").trim();
    if (!v || VARIANT_DEFAULTS.has(v)) {
      return "";
    }
    const safe = v.replace(/[^a-z0-9-]/gi, "");
    if (!safe) return "";
    const prefix = {
      cover: "cover-variant",
      points: "points-variant",
      timeline: "timeline-variant",
      quote: "quote-variant",
      compare: "compare-variant",
      summary: "summary-variant",
      ending: "ending-variant",
      photo: "photo-variant",
      gallery: "gallery-variant",
      chapter: "chapter-variant",
      composite: "composite-variant",
      free: "free-variant",
      card: "card-variant",
    }[pageType];
    return prefix ? ` ${prefix}-${safe}` : "";
  }

  function pointsStyleOf(p) {
    if (!p || typeof p !== "object") return "cards";
    const variant = layoutVariantOf(p, "points");
    if (variant === "ledger") return "ledger";
    if (
      variant === "cards" ||
      variant === "numbered-pill" ||
      variant === "left-bar" ||
      variant === "pill-tags" ||
      variant === "left-bar-minimal"
    ) {
      return "cards";
    }
    const v = p.pointsStyle || (p.style && p.style.pointsStyle) || "cards";
    return v === "ledger" ? "ledger" : "cards";
  }

  function ledgerIndex(i) {
    return String(i + 1).padStart(2, "0");
  }

  function renderPointsItemsHtml(items, opts) {
    opts = opts || {};
    const sm = !!opts.sm;
    const layout = opts.layout === "ledger" ? "ledger" : "cards";
    const variant = opts.variant || "";
    const list = items || [];
    if (layout === "ledger") {
      const cls = sm ? "points-ledger sm" : "points-ledger";
      return `<ul class="${cls}">${list
        .map(
          (it, i) =>
            `<li><span class="ledger-idx" aria-hidden="true">${ledgerIndex(i)}</span><div class="ledger-main"><div class="pt-head">${esc(
              it.head || ""
            )}</div><div class="pt-body">${nl2br(it.body || "")}</div></div></li>`
        )
        .join("")}</ul>`;
    }
    const cls = sm ? "points-list sm" : "points-list";
    const pillTags = variant === "pill-tags";
    return `<ul class="${cls}">${list
      .map((it, i) => {
        const tag = it && it.tag ? `<span class="pt-tag-pill">${esc(it.tag)}</span>` : "";
        const headPrefix = pillTags && !it.tag ? `<span class="pt-tag-pill">${ledgerIndex(i)}</span>` : tag;
        return `<li><div class="pt-head">${headPrefix}${esc(it.head)}</div><div class="pt-body">${nl2br(it.body)}</div></li>`;
      })
      .join("")}</ul>`;
  }

  /** 非封面/结尾：品牌顶栏（author / brand + 页码） */
  function renderBrandTop(meta, page, opts) {
    if (!page || page.type === "cover" || page.type === "ending") return "";
    meta = meta || {};
    const author = String(meta.author || "").trim();
    const brand = String(meta.brand || "").trim();
    if (!author && !brand) return "";
    opts = opts || {};
    const left = author || brand;
    const idx = opts.pageIndex;
    const total = opts.pageTotal;
    const pageInd = formatPageIndicator(idx, total);
    const right = pageInd || (author && brand ? brand : "");
    return `<div class="page-e-top" aria-hidden="true"><span class="e-top-author">${esc(left)}</span>${
      right ? `<span class="e-top-page">${esc(right)}</span>` : ""
    }</div>`;
  }

  /** 非封面/结尾：轻量进度 + 叙事角色，不抢正文 */
  function renderNavChrome(p, opts) {
    if (!p || p.type === "cover" || p.type === "ending") return "";
    opts = opts || {};
    let progress = String(p.progress || p.step || "").trim();
    const pageInd = formatPageIndicator(opts.pageIndex, opts.pageTotal);
    // page-e-top 已展示「NN / TT」时，nav 不再重复同一页码
    if (progress && pageInd && progress === pageInd) progress = "";
    // chapter 页角色在正文区强化展示，chrome 只留进度
    const role = p.type === "chapter" ? "" : p.role || "";
    if (!progress && !role) return "";
    return `<div class="page-nav-chrome" aria-hidden="true">${
      progress ? `<span class="page-progress">${esc(progress)}</span>` : ""
    }${role ? `<span class="page-role">${esc(role)}</span>` : ""}</div>`;
  }

  function renderBridge(p) {
    if (!p || !p.bridge) return "";
    // points 已用 intro 展示同文案时不重复
    if (p.intro && String(p.intro) === String(p.bridge)) return "";
    if (p.type === "chapter" && p.desc && String(p.desc) === String(p.bridge)) return "";
    return `<p class="page-bridge">${nl2br(p.bridge)}</p>`;
  }

  function withNarrativeChrome(html, page, meta, opts) {
    if (!page || !html) return html;
    const brandTop = renderBrandTop(meta, page, opts);
    const chrome = renderNavChrome(page, opts);
    const bridge = renderBridge(page);
    if (!brandTop && !chrome && !bridge) return html;
    let out = html;
    const topChrome = `${brandTop}${chrome}`;
    if (topChrome) {
      out = out.replace(/^(<div class="page-inner[^"]*">)/, `$1${topChrome}`);
    }
    if (bridge) {
      out = out.replace(/(<div class="page-content[^"]*">)/, `$1${bridge}`);
    }
    return out;
  }

  function blockThumb(src, focus) {
    if (!src) return "";
    return `<div class="block-thumb">${imgTag(src, "block-thumb-img", focus)}</div>`;
  }

  function renderCover(p, meta) {
    const variant = layoutVariantOf(p, "cover") || "default";
    const hasImg = !!p.image;
    const useSplit = variant === "hero-split" || (variant === "magazine" && hasImg);
    const useNumber = variant === "number-shock" && p.stat;
    const deco = hasImg
      ? `<div class="cover-hero">${imgTag(p.image, "cover-hero-img", p.imageFocus)}<div class="cover-hero-veil"></div></div>`
      : `<div class="cover-deco"></div>`;
    const cls = hasImg ? " cover-with-image" : "";
    const variantCls = variantPageClass("cover", variant);
    const splitCls = useSplit ? " cover-layout-split" : "";
    const numberHtml = useNumber
      ? `<div class="cover-stat" aria-hidden="true">${esc(p.stat)}</div>`
      : "";
    const questionMark = variant === "question-hook" ? `<span class="cover-qmark" aria-hidden="true">?</span>` : "";
    return `<div class="page-inner cover-page${cls}${variantCls}${splitCls}">${deco}<div class="page-content cover-content">${p.kicker ? `<div class="kicker">${esc(p.kicker)}</div>` : ""}${numberHtml}<h1 class="cover-title">${questionMark}${nl2br(p.title)}</h1>${p.subtitle ? `<p class="cover-sub">${nl2br(p.subtitle)}</p>` : ""}${renderTags(p.tags)}</div>${renderMeta(meta)}</div>`;
  }

  function renderChapter(p, meta) {
    const variant = layoutVariantOf(p, "chapter") || "number-hero";
    const variantCls = variantPageClass("chapter", variant);
    const root = document.documentElement;
    const fg = getComputedStyle(root).getPropertyValue("--page-chapter-fg").trim();
    const style = fg ? ` style="color:${fg}"` : "";
    const roleLine = p.role
      ? `<div class="chapter-role"${style}>${esc(p.role)}</div>`
      : `<div class="chapter-role"${style}>章节</div>`;
    const noRaw = p.no != null ? String(p.no) : "01";
    const noDisplay =
      variant === "roman-numeral" ? toRomanChapterNo(noRaw) : esc(noRaw);
    const progressBand =
      variant === "progress-band" && p.progress
        ? `<div class="chapter-progress-band" aria-hidden="true"><span class="chapter-progress-fill" style="width:${Math.min(100, Math.max(8, parseInt(String(p.progress).replace(/\D/g, ""), 10) || 33))}%"></span><span class="chapter-progress-label">${esc(p.progress)}</span></div>`
        : variant === "progress-band"
          ? `<div class="chapter-progress-band" aria-hidden="true"><span class="chapter-progress-fill" style="width:33%"></span></div>`
          : "";
    const rules =
      variant === "divider-heavy"
        ? `<div class="chapter-rule" aria-hidden="true"></div><div class="chapter-rule chapter-rule-thin" aria-hidden="true"></div>`
        : `<div class="chapter-rule" aria-hidden="true"></div>`;
    return `<div class="page-inner chapter-page${variantCls}"><div class="page-content chapter-content">${progressBand}${roleLine}${rules}<div class="chapter-no">${noDisplay}</div><h2 class="chapter-title"${style}>${nl2br(p.title)}</h2>${p.desc ? `<p class="chapter-desc"${style}>${nl2br(p.desc)}</p>` : ""}</div>${renderMeta(meta)}</div>`;
  }

  function renderPoints(p, meta) {
    const variant = layoutVariantOf(p, "points") || "cards";
    const layout = pointsStyleOf(p);
    const listHtml = renderPointsItemsHtml(p.items, { layout, variant });
    const ledgerCls = layout === "ledger" ? " points-ledger-page" : "";
    const variantCls = variantPageClass("points", variant);
    return `<div class="page-inner points-page${ledgerCls}${variantCls}"><div class="page-content">${blockThumb(p.image)}<h2 class="block-title">${nl2br(p.title)}</h2>${p.intro ? `<p class="block-intro">${nl2br(p.intro)}</p>` : ""}${listHtml}</div>${renderMeta(meta)}</div>`;
  }

  function timelineShowBadge(time, head) {
    if (!time || !head || time === head) return false;
    if (head.startsWith(time)) {
      const rest = head.slice(time.length);
      if (!rest || /^[\s\-—–·:：→（(【\[「『]/.test(rest)) return false;
    }
    return true;
  }

  function renderTimelineStep(s, opts) {
    opts = opts || {};
    const time = String((s && s.time) || "").trim();
    const head = String((s && s.head) || "").trim();
    const showBadge = timelineShowBadge(time, head);
    const headText = head || time || "步骤";
    if (opts.variant === "number-ladder") {
      const idx = opts.index != null ? ledgerIndex(opts.index) : "01";
      return `<div class="timeline-ladder-step"><div class="ladder-no" aria-hidden="true">${idx}</div><div class="ladder-card"><div class="step-head">${esc(headText)}</div>${showBadge ? `<div class="step-badge">${esc(time)}</div>` : ""}<div class="step-body">${nl2br((s && s.body) || "")}</div></div></div>`;
    }
    if (opts.variant === "horizontal-steps") {
      return `<div class="timeline-h-step"><div class="h-step-no" aria-hidden="true">${opts.index != null ? ledgerIndex(opts.index) : "01"}</div><div class="step-head">${esc(headText)}</div><div class="step-body">${nl2br((s && s.body) || "")}</div></div>`;
    }
    return `<div class="timeline-step"><div class="step-rail" aria-hidden="true"><span class="step-dot"></span></div><div class="step-card">${showBadge ? `<div class="step-badge">${esc(time)}</div>` : ""}<div class="step-head">${esc(headText)}</div><div class="step-body">${nl2br((s && s.body) || "")}</div></div></div>`;
  }

  function renderTimeline(p, meta) {
    const variant = layoutVariantOf(p, "timeline") || "vertical-rail";
    const variantCls = variantPageClass("timeline", variant);
    const steps = p.steps || [];
    let timelineInner = "";
    if (variant === "horizontal-steps") {
      timelineInner = `<div class="timeline timeline-horizontal">${steps.map((s, i) => renderTimelineStep(s, { variant, index: i })).join("")}</div>`;
    } else if (variant === "number-ladder") {
      timelineInner = `<div class="timeline timeline-ladder">${steps.map((s, i) => renderTimelineStep(s, { variant, index: i })).join("")}</div>`;
    } else {
      timelineInner = `<div class="timeline">${steps.map((s) => renderTimelineStep(s)).join("")}</div>`;
    }
    return `<div class="page-inner timeline-page${variantCls}"><div class="page-content"><h2 class="block-title">${nl2br(p.title)}</h2>${timelineInner}</div>${renderMeta(meta)}</div>`;
  }

  function renderCard(p, meta) {
    const variant = layoutVariantOf(p, "card") || "accent-label";
    const variantCls = variantPageClass("card", variant);
    const tipsCls = variant === "icon-bullet" ? "card-tips icon-bullet" : "card-tips";
    const blockCls =
      variant === "tip-box"
        ? "card-block card-tipbox"
        : variant === "minimal-center"
          ? "card-block card-minimal-center"
          : variant === "sidebar-accent"
            ? "card-block card-sidebar-accent"
            : "card-block";
    const tipsHtml =
      p.tips && p.tips.length
        ? `<ul class="${tipsCls}">${p.tips.map((t) => `<li>${nl2br(t)}</li>`).join("")}</ul>`
        : "";
    const cardInner = `<div class="${blockCls}">${p.label ? `<div class="card-label">${esc(p.label)}</div>` : ""}<h2 class="card-title">${nl2br(p.title)}</h2><p class="card-body">${nl2br(p.body)}</p>${tipsHtml}</div>`;
    const thumb = blockThumb(p.image);
    const body =
      variant === "inset-thumb" && thumb
        ? `<div class="card-inset-row">${cardInner}${thumb}</div>`
        : `${thumb}${cardInner}`;
    return `<div class="page-inner card-page${variantCls}"><div class="page-content">${body}</div>${renderMeta(meta)}</div>`;
  }

  function renderPhoto(p, meta) {
    const src = p.image || (p.images && p.images[0]) || "";
    return `<div class="page-inner photo-page"><div class="page-content photo-content"><div class="photo-hero">${imgTag(src, "photo-hero-img")}</div><div class="photo-copy"><h2 class="block-title">${nl2br(p.title || "配图")}</h2>${p.body ? `<p class="photo-body">${nl2br(p.body)}</p>` : ""}</div></div>${renderMeta(meta)}</div>`;
  }

  function renderGallery(p, meta) {
    let imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (!imgs.length && p.image) imgs = [p.image];
    imgs = imgs.slice(0, 9);
    const n = imgs.length || 1;
    const g =
      n === 1 ? "g1" : n === 2 ? "g2" : n === 3 ? "g3" : n === 4 ? "g4" : "gmany";
    const cells = imgs
      .map((src) => `<div class="gallery-cell">${imgTag(src, "gallery-img")}</div>`)
      .join("");
    return `<div class="page-inner gallery-page"><div class="page-content gallery-content"><h2 class="block-title">${nl2br(p.title || "图集")}</h2>${p.caption ? `<p class="block-intro">${nl2br(p.caption)}</p>` : ""}<div class="gallery-grid ${g}">${cells}</div></div>${renderMeta(meta)}</div>`;
  }

  function renderQuote(p, meta) {
    const rawVariant = layoutVariantOf(p, "quote") || "sidebar";
    const variantCls = variantPageClass("quote", rawVariant);
    let variant = rawVariant;
    if (variant === "center-hero") variant = "centered-hero";
    if (variant === "inverted-block") variant = "invert-dark";
    const blockCls =
      variant === "left-bar"
        ? "quote-block quote-left-bar"
        : variant === "sidebar"
          ? "quote-block quote-sidebar"
          : variant === "invert-dark"
            ? "quote-block quote-inverted"
            : "quote-block";
    const quoteInner = `<blockquote class="${blockCls}"><p class="quote-text">${nl2br(p.text)}</p>${
      p.from ? `<cite class="quote-from">-- ${esc(p.from)}</cite>` : ""
    }</blockquote>`;
    return `<div class="page-inner quote-page${variantCls}"><div class="page-content quote-content"><div class="quote-hero">${quoteInner}</div></div>${renderMeta(meta)}</div>`;
  }

  const DIM_HEADS = new Set([
    "维度", "项目", "对比项", "指标", "类别", "类型", "项", "对比", "方面",
    "item", "metric", "dimension", "vs",
  ]);

  function toneClass(t) {
    return t === "neg" ? "col-neg" : t === "pos" ? "col-pos" : "col-neutral";
  }

  /** cols[0]=维度；values 对齐 cols[1..]；修复 LLM 只给「白天/夜游」导致白天列空 */
  function normalizeCompare(p) {
    let cols = (p.cols || []).map((c) =>
      c && typeof c === "object"
        ? { head: String(c.head || "列"), tone: c.tone || "neutral" }
        : { head: String(c || "列"), tone: "neutral" }
    );
    if (cols.length < 2) {
      cols = [
        { head: "维度", tone: "neutral" },
        { head: "A", tone: "neg" },
        { head: "B", tone: "pos" },
      ];
    }
    const firstIsDim = cols[0] && DIM_HEADS.has(String(cols[0].head || "").trim().toLowerCase());
    if (!firstIsDim) {
      cols = [{ head: "维度", tone: "neutral" }, ...cols].slice(0, 4);
      if (cols[1] && cols[1].tone === "neutral") cols[1].tone = "neg";
      if (cols[2] && cols[2].tone === "neutral") cols[2].tone = "pos";
    }
    const nVals = Math.max(1, cols.length - 1);
    const rows = (p.rows || []).map((r) => {
      if (!r || typeof r !== "object") return { label: "对比项", values: Array(nVals).fill("—") };
      let label = String(r.label || r.head || r.item || "");
      let values = Array.isArray(r.values) ? r.values.map((v) => String(v == null ? "" : v)) : [];
      if (values.length === cols.length) {
        if (!label) label = values[0];
        values = values.slice(1);
      }
      if (values.length < nVals) {
        const keyed = cols.slice(1).map((c) => (r[c.head] != null ? String(r[c.head]) : null));
        if (keyed.every((v) => v != null)) values = keyed;
      }
      while (values.length < nVals) values.push("—");
      if (!String(label).trim()) label = "对比项";
      return { label, values: values.slice(0, nVals) };
    });
    return {
      cols,
      rows: rows.length ? rows : [{ label: "示例", values: ["更弱", "更强"].slice(0, nVals) }],
    };
  }

  function compareGridTemplate(nCols) {
    const n = Math.max(2, Math.min(4, nCols));
    if (n === 2) return "minmax(200px, 30%) 1fr";
    if (n === 3) return "minmax(168px, 24%) 1fr 1fr";
    return "minmax(148px, 20%) 1fr 1fr 1fr";
  }

  function compareHeadCell(c, i) {
    if (i === 0) return `<div class="compare-head-cell col-dim">${esc(c.head)}</div>`;
    const tone = toneClass(c.tone);
    const label = String(c.head || "");
    const needToneLabel =
      (c.tone === "neg" && !/避免|不要|别再/.test(label)) ||
      (c.tone === "pos" && !/推荐|建议|更好/.test(label));
    return `<div class="compare-head-cell ${tone}${needToneLabel ? " has-tone-label" : ""}">${esc(c.head)}</div>`;
  }

  function renderCompareTable(cols, rows, sm) {
    const smCls = sm ? " sm" : "";
    const grid = compareGridTemplate(cols.length);
    const head = cols.map((c, i) => compareHeadCell(c, i)).join("");
    const body = rows
      .map(
        (r) =>
          `<div class="compare-row"><div class="compare-cell col-dim">${esc(r.label)}</div>${(r.values || [])
            .map(
              (v, i) =>
                `<div class="compare-cell ${toneClass((cols[i + 1] && cols[i + 1].tone) || "neutral")}">${esc(v)}</div>`
            )
            .join("")}</div>`
      )
      .join("");
    return `<div class="compare-card${smCls}" style="--compare-grid-cols:${grid}"><div class="compare-head">${head}</div><div class="compare-body">${body}</div></div>`;
  }

  function resolveCompareVariant(raw) {
    const v = String(raw || "three-col").trim();
    if (v === "before-after" || v === "cards") return v === "before-after" ? "swipe-before-after" : "three-col";
    return v;
  }

  function renderCompare(p, meta) {
    const variant = resolveCompareVariant(layoutVariantOf(p, "compare") || "three-col");
    const variantCls = variantPageClass("compare", variant);
    const { cols, rows } = normalizeCompare(p);
    const swipeCls = variant === "swipe-before-after" ? " compare-swipe-mode" : "";
    return `<div class="page-inner compare-page${variantCls}${swipeCls}"><div class="page-content"><h2 class="block-title">${nl2br(p.title)}</h2><div class="compare-grow">${renderCompareTable(cols, rows, false)}</div></div>${renderMeta(meta)}</div>`;
  }

  function renderSummaryChecklist(items) {
    return `<ul class="summary-checklist">${(items || [])
      .map((it) => `<li class="summary-check-item"><span class="summary-check-mark" aria-hidden="true"></span><span class="summary-text">${nl2br(it)}</span></li>`)
      .join("")}</ul>`;
  }

  function renderSummaryMetricCards(metrics) {
    return `<div class="summary-metric-cards">${(metrics || [])
      .map(
        (m) =>
          `<div class="summary-metric-card"><span class="metric-num">${esc(m.num)}</span><span class="metric-unit">${esc(m.unit)}</span></div>`
      )
      .join("")}</div>`;
  }

  function renderSummary(p, meta) {
    const variant = layoutVariantOf(p, "summary") || "checklist-cards";
    const variantCls = variantPageClass("summary", variant);
    const metricsPlain =
      p.metrics && p.metrics.length
        ? `<div class="metrics">${p.metrics.map((m) => `<div class="metric"><span class="metric-num">${esc(m.num)}</span><span class="metric-unit">${esc(m.unit)}</span></div>`).join("")}</div>`
        : "";
    let body = "";
    if (variant === "checklist") {
      body = renderSummaryChecklist(p.items);
    } else if (variant === "metric-cards" && p.metrics && p.metrics.length) {
      body = `${renderSummaryMetricCards(p.metrics)}${p.items && p.items.length ? renderSummaryChecklist(p.items) : ""}`;
    } else if (variant === "one-liner-stack" && p.items && p.items.length) {
      body = `<div class="summary-oneliner-stack">${p.items
        .map((it) => `<div class="summary-oneliner">${nl2br(it)}</div>`)
        .join("")}</div>${metricsPlain}`;
    } else if (variant === "one-liner-close" && p.items && p.items[0]) {
      body = `<div class="summary-oneliner">${nl2br(p.items[0])}</div>${p.items.length > 1 ? `<ul class="summary-list summary-subpoints">${p.items.slice(1).map((it) => `<li class="summary-card"><span class="summary-text">${nl2br(it)}</span></li>`).join("")}</ul>` : ""}`;
    } else {
      body = `${renderSummaryItems(p.items, false)}${metricsPlain}`;
    }
    return `<div class="page-inner summary-page${variantCls}"><div class="page-content summary-content"><div class="summary-head"><h2 class="block-title">${nl2br(p.title)}</h2></div>${body}</div>${renderMeta(meta)}</div>`;
  }

  function renderEnding(p, meta) {
    const variant = layoutVariantOf(p, "ending") || "cta-pill";
    const variantCls = variantPageClass("ending", variant);
    const followReasons = variant === "follow-guide" && p.reasons && p.reasons.length
      ? `<ul class="ending-reasons">${p.reasons.map((r) => `<li>${nl2br(r)}</li>`).join("")}</ul>`
      : "";
    return `<div class="page-inner ending-page${variantCls}"><div class="ending-deco" aria-hidden="true"></div><div class="page-content ending-content"><div class="ending-hero"><h2 class="ending-title">${nl2br(p.title)}</h2>${p.desc ? `<p class="ending-desc">${nl2br(p.desc)}</p>` : ""}</div>${followReasons}${renderCtaRow(p.cta)}${renderTags(p.tags)}${p.contact ? `<div class="ending-contact">${esc(p.contact)}</div>` : ""}</div>${renderMeta(meta)}</div>`;
  }

  function normPullText(s) {
    return String(s || "").replace(/\s+/g, "").trim();
  }

  function pullQuoteDuplicatesParagraph(quote, paras) {
    const q = normPullText(quote);
    if (!q) return false;
    return paras.some((p) => {
      const t = normPullText(p);
      if (!t) return false;
      if (q === t) return true;
      return t.includes(q) && q.length >= t.length * 0.85;
    });
  }

  function extractInlinePullQuote(paras) {
    if (!paras || paras.length < 2) return "";
    const mid = paras[Math.floor(paras.length / 2)] || "";
    const sentences = mid
      .split(/[。！？.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length > 1) {
      const candidates = sentences.filter((s) => normPullText(s) !== normPullText(mid));
      const pick =
        candidates.find((s) => s.length >= 8 && s.length <= 36) ||
        candidates.find((s) => s.length >= 6) ||
        "";
      if (pick && !pullQuoteDuplicatesParagraph(pick, paras)) return pick;
    }
    for (const p of paras) {
      const m = p.match(/[「『"]([^」』"]{6,40})[」』"]/);
      if (m && m[1] && !pullQuoteDuplicatesParagraph(m[1], paras)) return m[1];
    }
    return "";
  }

  function resolvePullQuote(p, paras, variant) {
    const explicit = String(p.pullQuote || "").trim();
    if (explicit) {
      return pullQuoteDuplicatesParagraph(explicit, paras) ? "" : explicit;
    }
    if (variant !== "pull-quote-inline" || paras.length < 2) return "";
    return extractInlinePullQuote(paras);
  }

  function renderFreeParas(paras, variant, fallbackBody) {
    const list = paras && paras.length ? paras : fallbackBody ? [fallbackBody] : [];
    if (!list.length) return "";
    if (variant === "numbered-paragraphs") {
      return `<div class="free-paras free-paras-numbered">${list
        .map(
          (t, i) =>
            `<p class="free-p"><span class="free-para-no" aria-hidden="true">${ledgerIndex(i)}</span><span class="free-para-text">${nl2br(t)}</span></p>`
        )
        .join("")}</div>`;
    }
    if (variant === "wide-lead" && list.length > 1) {
      return `<div class="free-paras free-paras-lead"><p class="free-p free-lead">${nl2br(list[0])}</p>${list
        .slice(1)
        .map((t) => `<p class="free-p">${nl2br(t)}</p>`)
        .join("")}</div>`;
    }
    if (variant === "wide-lead" && list.length === 1) {
      return `<div class="free-paras free-paras-lead"><p class="free-p free-lead">${nl2br(list[0])}</p></div>`;
    }
    if (variant === "magazine-columns") {
      return `<div class="free-paras free-paras-columns">${list.map((t) => `<p class="free-p">${nl2br(t)}</p>`).join("")}</div>`;
    }
    return `<div class="free-paras">${list.map((t) => `<p class="free-p">${nl2br(t)}</p>`).join("")}</div>`;
  }

  function renderFree(p, meta, sm) {
    const variant = layoutVariantOf(p, "free") || "editorial";
    const variantCls = variantPageClass("free", variant);
    const paras = Array.isArray(p.paragraphs) ? p.paragraphs.filter(Boolean) : [];
    const bullets = Array.isArray(p.bullets) ? p.bullets.filter(Boolean) : [];
    const body =
      paras.length || bullets.length ? "" : p.body || p.text || "补充正文";
    const paraHtml = renderFreeParas(paras, variant, body);
    const bulletHtml = bullets.length
      ? `<ul class="free-bullets${sm ? " sm" : ""}">${bullets.map((t) => `<li>${nl2br(t)}</li>`).join("")}</ul>`
      : "";
    const pullQuote = resolvePullQuote(p, paras, variant);
    const pullHtml = pullQuote
      ? `<blockquote class="free-pull-quote"><p>${nl2br(pullQuote)}</p></blockquote>`
      : "";
    let contentBody = "";
    if (variant === "split-column" && (bulletHtml || paraHtml)) {
      contentBody = `<div class="free-split-cols"><div class="free-col-side">${bulletHtml || "<ul class=\"free-bullets free-bullets-minor\"><li>要点</li></ul>"}</div><div class="free-col-main">${paraHtml}${pullHtml}</div></div>`;
    } else if (variant === "pull-quote-inline" && pullHtml) {
      contentBody = `${paraHtml}${pullHtml}${bulletHtml}`;
    } else {
      contentBody = `${paraHtml}${pullHtml}${bulletHtml}`;
    }
    if (sm) {
      return `${blockThumb(p.image)}${p.kicker ? `<div class="kicker">${esc(p.kicker)}</div>` : ""}<h3 class="cb-title">${nl2br(p.title || "内容")}</h3>${contentBody}`;
    }
    return `<div class="page-inner free-page${variantCls}"><div class="page-content free-content">${blockThumb(p.image)}${p.kicker ? `<div class="kicker">${esc(p.kicker)}</div>` : ""}<h2 class="block-title">${nl2br(p.title || "内容")}</h2>${contentBody}</div>${renderMeta(meta)}</div>`;
  }

  function renderComposite(p, meta) {
    const allowed = ["points", "timeline", "card", "quote", "compare", "summary", "free"];
    let html = `<div class="page-inner composite-page"><div class="page-content composite-content">`;
    if (p.title) html += `<h2 class="block-title" style="flex-shrink:0">${nl2br(p.title)}</h2>`;
    for (const b of p.blocks || []) {
      let block = b;
      if (!block || !allowed.includes(block.type)) {
        // 未知子块 → card 兜底，不丢内容
        if (!block) continue;
        block = {
          type: "card",
          title: block.title || block.head || "模块",
          body: block.body || block.text || block.desc || "",
        };
      }
      html += `<div class="composite-block composite-${block.type}">`;
      if (block.type === "points") {
        html += `${blockThumb(block.image)}<h3 class="cb-title">${nl2br(block.title)}</h3>${block.intro ? `<p class="cb-intro">${nl2br(block.intro)}</p>` : ""}${renderPointsItemsHtml(block.items, { sm: true, layout: pointsStyleOf(block) })}`;
      } else if (block.type === "timeline") {
        html += `<h3 class="cb-title">${nl2br(block.title)}</h3><div class="timeline sm">${(block.steps || []).map(renderTimelineStep).join("")}</div>`;
      } else if (block.type === "card") {
        html += `${blockThumb(block.image)}<div class="card-block sm">${block.label ? `<div class="card-label">${esc(block.label)}</div>` : ""}<h3 class="card-title">${nl2br(block.title)}</h3><p class="card-body">${nl2br(block.body)}</p></div>`;
      } else if (block.type === "quote") {
        html += `<blockquote class="quote-block sm"><p class="quote-text">${nl2br(block.text)}</p></blockquote>`;
      } else if (block.type === "compare") {
        const norm = normalizeCompare(block);
        html += `<h3 class="cb-title">${nl2br(block.title)}</h3><div class="compare-grow">${renderCompareTable(norm.cols, norm.rows, true)}</div>`;
      } else if (block.type === "summary") {
        html += `<h3 class="cb-title">${nl2br(block.title)}</h3>${renderSummaryItems(block.items, true)}`;
      } else if (block.type === "free") {
        html += renderFree(block, meta, true);
      }
      html += `</div>`;
    }
    html += `</div>${renderMeta(meta)}</div>`;
    return html;
  }

  function renderPage(page, meta, opts) {
    opts = opts || {};
    const editable = !!opts.editable;
    if (!page) {
      return `<div class="page-inner"><div class="page-content"><p>空页面</p></div>${renderMeta(meta)}</div>`;
    }
    let html;
    // 任意页自带 blocks → 按 composite
    if (Array.isArray(page.blocks) && page.blocks.length && page.type !== "cover" && page.type !== "ending") {
      html = renderComposite({ ...page, type: "composite" }, meta);
      html = withNarrativeChrome(html, page, meta, opts);
      if (editable) html = annotateEditable(html, { ...page, type: "composite" });
      return html;
    }
    const t = page.type || "card";
    switch (t) {
      case "cover":
        html = renderCover(page, meta);
        if (editable) html = annotateEditable(html, page);
        return html;
      case "chapter":
        html = renderChapter(page, meta);
        break;
      case "points":
        html = renderPoints(page, meta);
        break;
      case "timeline":
        html = renderTimeline(page, meta);
        break;
      case "card":
        html = renderCard(page, meta);
        break;
      case "photo":
        html = renderPhoto(page, meta);
        break;
      case "gallery":
        html = renderGallery(page, meta);
        break;
      case "quote":
        html = renderQuote(page, meta);
        break;
      case "compare":
        html = renderCompare(page, meta);
        break;
      case "summary":
        html = renderSummary(page, meta);
        break;
      case "ending":
        html = renderEnding(page, meta);
        if (editable) html = annotateEditable(html, page);
        return html;
      case "composite":
        html = renderComposite(page, meta);
        break;
      case "free":
        html = renderFree(page, meta, false);
        break;
      default:
        // 未知 type → card 兜底
        html = renderCard(
          {
            title: page.title || page.head || t,
            body: page.body || page.text || page.desc || "补充正文",
            label: page.label,
            image: page.image,
            tips: page.tips,
          },
          meta
        );
    }
    html = withNarrativeChrome(html, page, meta, opts);
    if (editable) {
      const annPage =
        t === "composite" || (Array.isArray(page.blocks) && page.blocks.length)
          ? { ...page, type: "composite" }
          : page;
      html = annotateEditable(html, annPage);
    }
    return html;
  }

  function checkOverflow(el) {
    const content = el.querySelector(".page-content");
    if (!content) return false;
    return content.scrollHeight > content.clientHeight + 2;
  }

  function applyTheme(themeId, themesMap) {
    const theme = themesMap[themeId] || themesMap.ins;
    if (!theme) return;
    const root = document.documentElement;
    const css = theme.css || "";
    css.split(";").forEach((pair) => {
      const idx = pair.indexOf(":");
      if (idx < 0) return;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (key.startsWith("--")) root.style.setProperty(key, val);
    });
    // inject fonts if needed
    const linkId = "xhs-theme-fonts";
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement("div");
      link.id = linkId;
      document.head.appendChild(link);
    }
    link.innerHTML = theme.fonts || "";
  }

  /** Per-page density class + optional --page-font-scale inline style */
  function pageShellAttrs(page) {
    if (!page || typeof page !== "object") {
      return { className: "xhs-page", style: "" };
    }
    const styleObj = page.style && typeof page.style === "object" ? page.style : {};
    let density = String(page.density || styleObj.density || "").toLowerCase();
    let fontScale = page.fontScale != null ? Number(page.fontScale) : NaN;
    if (!Number.isFinite(fontScale) && styleObj.fontScale != null) {
      fontScale = Number(styleObj.fontScale);
    }
    if (!density && Number.isFinite(fontScale)) {
      if (fontScale < 0.95) density = "compact";
      else if (fontScale > 1.05) density = "airy";
      else density = "normal";
    }
    const classes = ["xhs-page"];
    if (density === "compact" || density === "airy" || density === "normal") {
      classes.push("density-" + density);
    }
    let style = "";
    if (Number.isFinite(fontScale) && fontScale > 0.5 && fontScale < 1.5 && Math.abs(fontScale - 1) > 0.02) {
      classes.push("has-font-scale");
      style = `--page-font-scale:${fontScale}`;
    } else if (density === "compact") {
      style = "--page-font-scale:0.88";
    } else if (density === "airy") {
      style = "--page-font-scale:1.12";
    }
    return { className: classes.join(" "), style };
  }

  global.XHSEngine = {
    PAGE_W,
    PAGE_H,
    esc,
    nl2br,
    renderPage,
    renderMeta,
    renderBrandTop,
    layoutVariantOf,
    variantPageClass,
    pointsStyleOf,
    renderPointsItemsHtml,
    checkOverflow,
    applyTheme,
    normalizeCompare,
    pageShellAttrs,
    annotateEditable,
    edAttr,
  };
})(typeof window !== "undefined" ? window : globalThis);
