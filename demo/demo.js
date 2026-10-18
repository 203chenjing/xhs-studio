/* xhs-studio interactive demo */
(function () {
  "use strict";

  const decks = (window.XHS_DEMO && window.XHS_DEMO.decks) || [];
  const themes = window.XHS_THEMES || {};
  const PAGE_W = 1080;
  const PAGE_H = 1440;

  const state = {
    deck: 0,
    theme: decks[0] ? decks[0].style : "ins",
    publishTitle: decks[0] ? decks[0].title : "",
    screen: 1,
    layoutBuilt: false,
    pageIndex: 0,
    exporting: false,
    timers: [],
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    decks: $("#decks"),
    intentText: $("#intent-text"),
    intentKicker: $("#intent-kicker"),
    deckMeta: $("#deck-meta"),
    footDeck: $("#foot-deck"),
    reviewTitle: $("#review-title"),
    reviewCaption: $("#review-caption"),
    reviewKicker: $("#review-kicker"),
    hooks: $("#hooks"),
    checks: document.querySelector(".checks"),
    carousel: $("#carousel"),
    dots: $("#dots"),
    pageType: $("#page-type"),
    pageCount: $("#page-count"),
    themeRow: $("#theme-row"),
    themeName: $("#theme-name"),
    gen: $("#gen"),
    genStage: $("#gen-stage"),
    genBar: $("#gen-bar-fill"),
    genNote: $("#gen-note"),
    toast: $("#toast"),
    modal: $("#export-modal"),
    exportBar: $("#export-bar"),
    exportStatus: $("#export-status"),
    exportSub: $("#export-sub"),
    exportActions: $("#export-actions"),
    download: $("#btn-download"),
    exportTitle: $("#export-title"),
    exportStage: $("#export-stage"),
  };

  const steps = $$(".stepper button");

  function deck() { return decks[state.deck]; }
  function pages() { return (deck() && deck().data.pages) || []; }
  function meta() { return (deck() && deck().data.meta) || {}; }
  function themeName(id) { return (themes[id] && themes[id].title) || id; }

  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.toast.hidden = true; }, 1600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
    toast("已复制");
  }

  function applyTheme() {
    if (window.XHSEngine) window.XHSEngine.applyTheme(state.theme, themes);
  }

  /* ── screen navigation ── */
  function goto(n) {
    state.screen = n;
    $$(".screen").forEach((s) => s.classList.toggle("is-active", +s.dataset.screen === n));
    steps.forEach((btn) => {
      const i = +btn.dataset.goto;
      btn.classList.toggle("is-active", i === n);
      btn.classList.toggle("is-done", i < n);
    });
    const scroller = document.querySelector(`.screen[data-screen="${n}"] .scroll`);
    if (scroller) scroller.scrollTop = 0;
    if (n === 3) {
      if (!state.layoutBuilt) buildLayout();
      requestAnimationFrame(() => {
        fitFrames();
        goToPage(state.pageIndex, "auto");
        syncPageChrome();
      });
    }
  }

  steps.forEach((btn) => btn.addEventListener("click", () => goto(+btn.dataset.goto)));
  $$("[data-goto]").forEach((btn) => {
    if (btn.classList.contains("stepper")) return;
    btn.addEventListener("click", () => goto(+btn.dataset.goto));
  });

  /* ── deck picker ── */
  function renderDeckCards() {
    el.decks.innerHTML = decks.map((d, i) => `
      <button type="button" class="deck-card${i === state.deck ? " is-active" : ""}" data-deck="${i}">
        <div class="deck-kicker">${escapeHtml(d.kicker)}</div>
        <div class="deck-title">${escapeHtml(d.title)}</div>
        <div class="deck-meta">
          <span>${d.data.pages.length} 页</span>
          <span>${escapeHtml(themeName(d.style))}</span>
          <span>真实模型生成</span>
        </div>
      </button>`).join("");
    el.decks.querySelectorAll("[data-deck]").forEach((btn) => {
      btn.addEventListener("click", () => selectDeck(+btn.dataset.deck));
    });
  }

  function selectDeck(i) {
    state.deck = i;
    state.theme = deck().style;
    state.publishTitle = deck().title;
    state.layoutBuilt = false;
    state.pageIndex = 0;
    renderDeckCards();
    syncDeckText();
    if (state.screen === 3) {
      buildLayout();
      requestAnimationFrame(() => {
        fitFrames();
        goToPage(0, "auto");
        syncPageChrome();
      });
    }
  }

  function syncDeckText() {
    const d = deck();
    el.intentText.textContent = d.intent;
    el.intentKicker.textContent = d.kicker;
    el.footDeck.textContent = d.id;
    el.deckMeta.innerHTML = [
      `${pages().length} 页`,
      themeName(state.theme),
      "2× 导出",
      d.data.meta && d.data.meta.brand ? d.data.meta.brand : "",
    ].filter(Boolean).map((t) => `<span>${escapeHtml(t)}</span>`).join("");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── generation playback ── */
  function startFlow() {
    if (!deck()) return;
    const startBtn = $("#btn-start");
    if (startBtn) startBtn.disabled = true;
    el.gen.hidden = false;
    el.genStage.textContent = "① 正在写稿…";
    el.genNote.textContent = "按 3:4 画布自由组页 · 这是预生成内容的回放";
    el.genBar.style.width = "12%";
    const t1 = setTimeout(() => {
      el.genStage.textContent = "② 正在审核标题与排版…";
      el.genNote.textContent = "检查标题长度、封面 hook、话题与溢出";
      el.genBar.style.width = "66%";
    }, 900);
    const t2 = setTimeout(() => {
      el.genBar.style.width = "100%";
      el.genNote.textContent = "完成 · 未发现发布风险";
    }, 1700);
    const t3 = setTimeout(() => {
      el.gen.hidden = true;
      if (startBtn) startBtn.disabled = false;
      populateReview();
      goto(2);
    }, 2100);
    state.timers.push(t1, t2, t3);
  }

  function populateReview() {
    const d = deck();
    state.publishTitle = d.title;
    el.reviewTitle.textContent = d.title;
    el.reviewCaption.textContent = d.caption;
    el.reviewCaption.classList.remove("is-open");
    const expand = $("#btn-expand-caption");
    if (expand) expand.textContent = "展开全文";
    el.reviewKicker.textContent = `${pages().length} 页 · ${themeName(state.theme)}`;
    renderHooks();
    renderChecks();
  }

  function renderHooks() {
    const d = deck();
    el.hooks.innerHTML = d.hooks.map((h) => `
      <button type="button" class="hook${h === state.publishTitle ? " is-active" : ""}" data-hook="${encodeURIComponent(h)}">
        ${escapeHtml(h)}
      </button>`).join("");
    el.hooks.querySelectorAll("[data-hook]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.publishTitle = decodeURIComponent(btn.dataset.hook);
        el.reviewTitle.textContent = state.publishTitle;
        renderHooks();
        renderChecks();
        toast("已替换发布标题");
      });
    });
  }

  function renderChecks() {
    const d = deck();
    const tags = d.data.pages.reduce((acc, p) => acc.concat(p.tags || []), []);
    const len = state.publishTitle.length;
    const ul = el.checks.querySelector("ul");
    ul.innerHTML = `
      <li><span>标题 ${len} 字</span><em>${len <= 28 ? "信息流可完整展示" : "建议压到 28 字内"}</em></li>
      <li><span>封面 3:4</span><em>1080×1440 · 2× 导出</em></li>
      <li><span>话题 ${tags.length} 个</span><em>${tags.slice(0, 3).map(escapeHtml).join(" / ")}</em></li>`;
    el.checks.querySelector("summary").textContent = `发布前检查 · 3 项通过`;
  }

  /* ── layout / page preview ── */
  function pageHtml(page, i) {
    const shell = window.XHSEngine.pageShellAttrs(page);
    const styleAttr = shell.style ? ` style="${shell.style}"` : "";
    const inner = window.XHSEngine.renderPage(page, meta(), {
      editable: false,
      pageIndex: i,
      pageTotal: pages().length,
    });
    return `<div class="${shell.className}"${styleAttr}>${inner}</div>`;
  }

  function buildLayout() {
    if (!window.XHSEngine) return;
    applyTheme();
    el.carousel.innerHTML = pages().map((page, i) => `
      <div class="slide" data-page="${i}">
        <div class="frame">
          <div class="page-scale">${pageHtml(page, i)}</div>
        </div>
      </div>`).join("");
    renderDots();
    renderThemeRow();
    el.themeName.textContent = themeName(state.theme);
    bindCarousel();
    state.layoutBuilt = true;
    state.pageIndex = Math.min(state.pageIndex, pages().length - 1);
  }

  function renderDots() {
    el.dots.innerHTML = pages().map((_, i) =>
      `<button type="button" class="dot${i === state.pageIndex ? " is-active" : ""}" data-dot="${i}" aria-label="第 ${i + 1} 页"></button>`
    ).join("");
    el.dots.querySelectorAll("[data-dot]").forEach((dot) => {
      dot.addEventListener("click", () => goToPage(+dot.dataset.dot));
    });
  }

  function renderThemeRow() {
    el.themeRow.innerHTML = Object.keys(themes).map((id) => `
      <button type="button" class="theme-chip${id === state.theme ? " is-active" : ""}" data-theme="${id}">
        ${escapeHtml(themeName(id))}
      </button>`).join("");
    el.themeRow.querySelectorAll("[data-theme]").forEach((chip) => {
      chip.addEventListener("click", () => switchTheme(chip.dataset.theme));
    });
    const active = el.themeRow.querySelector(".theme-chip.is-active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function switchTheme(id) {
    if (!themes[id] || id === state.theme) return;
    const keep = state.pageIndex;
    state.theme = id;
    applyTheme();
    buildLayout();
    state.pageIndex = keep;
    requestAnimationFrame(() => {
      fitFrames();
      goToPage(keep, "auto");
    });
    syncDeckText();
    toast(`已切换 · ${themeName(id)}`);
  }

  function fitFrames() {
    $$(".frame").forEach((frame) => {
      const scale = frame.clientWidth / PAGE_W;
      const inner = frame.querySelector(".page-scale");
      if (inner) inner.style.transform = `scale(${scale})`;
    });
  }

  function bindCarousel() {
    if (el.carousel.dataset.bound === "1") return;
    el.carousel.dataset.bound = "1";
    el.carousel.addEventListener("scroll", () => {
      if (bindCarousel._raf) cancelAnimationFrame(bindCarousel._raf);
      bindCarousel._raf = requestAnimationFrame(updatePageIndicator);
    }, { passive: true });
  }

  function updatePageIndicator() {
    const slides = $$(".slide");
    if (!slides.length) return;
    const cr = el.carousel.getBoundingClientRect();
    const center = cr.left + cr.width / 2;
    let best = 0;
    let dist = Infinity;
    slides.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - center);
      if (d < dist) { dist = d; best = i; }
    });
    if (best !== state.pageIndex) {
      state.pageIndex = best;
      syncPageChrome();
    }
  }

  function syncPageChrome() {
    const page = pages()[state.pageIndex];
    if (page) {
      const labels = { cover: "封面", chapter: "章节", points: "要点", timeline: "时间线", compare: "对比", quote: "金句", summary: "总结", ending: "结尾", card: "卡片", free: "正文", composite: "组合", photo: "配图", gallery: "图集" };
      el.pageType.textContent = labels[page.type] || page.type;
    }
    el.pageCount.textContent = `${state.pageIndex + 1} / ${pages().length}`;
    $$(".dot").forEach((d, i) => d.classList.toggle("is-active", i === state.pageIndex));
  }

  function goToPage(i, behavior) {
    const slides = $$(".slide");
    const slide = slides[i];
    if (!slide) return;
    el.carousel.scrollTo({ left: slide.offsetLeft, behavior: behavior || "smooth" });
    state.pageIndex = i;
    syncPageChrome();
  }

  /* ── export ── */
  async function exportZip() {
    if (state.exporting) return;
    if (!window.htmlToImage || !window.JSZip) {
      toast("导出组件未加载");
      return;
    }
    state.exporting = true;
    const d = deck();
    const list = pages();
    el.modal.hidden = false;
    el.exportTitle.textContent = "正在导出发布包";
    el.exportSub.textContent = "逐页渲染 2160×2880 PNG，再打包 title / caption";
    el.exportActions.hidden = true;
    el.exportBar.style.width = "0%";
    el.exportStatus.textContent = `0 / ${list.length}`;

    try {
      applyTheme();
      await document.fonts.ready;
      const zip = new JSZip();
      const folder = zip.folder("pages");
      for (let i = 0; i < list.length; i++) {
        el.exportStatus.textContent = `${i + 1} / ${list.length} · 渲染中`;
        el.exportBar.style.width = `${Math.round((i / list.length) * 100)}%`;
        const div = document.createElement("div");
        const shell = window.XHSEngine.pageShellAttrs(list[i]);
        div.className = shell.className;
        div.style.width = PAGE_W + "px";
        div.style.height = PAGE_H + "px";
        if (shell.style) {
          shell.style.split(";").forEach((pair) => {
            const idx = pair.indexOf(":");
            if (idx < 0) return;
            div.style.setProperty(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
          });
        }
        div.innerHTML = window.XHSEngine.renderPage(list[i], meta(), {
          editable: false,
          pageIndex: i,
          pageTotal: list.length,
        });
        el.exportStage.appendChild(div);
        window.XHSEngine.fitPage(div);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const dataUrl = await window.htmlToImage.toPng(div, {
          width: PAGE_W,
          height: PAGE_H,
          pixelRatio: 2,
          cacheBust: true,
          skipFonts: false,
        });
        folder.file(`${String(i + 1).padStart(2, "0")}.png`, dataUrl.split(",")[1], { base64: true });
        el.exportStage.removeChild(div);
      }
      const tags = d.data.pages.reduce((acc, p) => acc.concat(p.tags || []), []);
      zip.file("title.txt", state.publishTitle);
      zip.file("caption.txt", d.caption);
      zip.file("publish.json", JSON.stringify({
        title: state.publishTitle,
        caption: d.caption,
        images: list.map((_, i) => `pages/${String(i + 1).padStart(2, "0")}.png`),
        meta: { studio: "xhs-studio", demo: true, style: state.theme, page_count: list.length, tags },
      }, null, 2));
      zip.file("meta.json", JSON.stringify({ style: state.theme, page_count: list.length, title: state.publishTitle }, null, 2));

      el.exportStatus.textContent = "打包中…";
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      el.download.href = url;
      el.download.download = `xhs-studio-${d.id}-${list.length}p.zip`;
      el.exportBar.style.width = "100%";
      el.exportTitle.textContent = "发布包已生成";
      el.exportSub.textContent = `${list.length} 张 2160×2880 PNG + title / caption / publish.json`;
      el.exportStatus.textContent = `共 ${list.length} 页 · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
      el.exportActions.hidden = false;
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (err) {
      console.error(err);
      el.exportTitle.textContent = "导出失败";
      el.exportSub.textContent = "可以先用「复制标题和正文」把内容带走，或刷新重试。";
      el.exportStatus.textContent = String(err && err.message ? err.message : err);
      el.exportActions.hidden = false;
      el.download.hidden = true;
    } finally {
      state.exporting = false;
    }
  }

  /* ── wiring ── */
  function resetDemo() {
    state.timers.forEach((t) => clearTimeout(t));
    state.timers = [];
    state.publishTitle = deck().title;
    state.pageIndex = 0;
    state.layoutBuilt = false;
    const startBtn = $("#btn-start");
    if (startBtn) startBtn.disabled = false;
    applyTheme();
    goto(1);
  }

  el.intentText && renderDeckCards();
  el.gen && $("#btn-start").addEventListener("click", startFlow);
  $("#btn-expand-caption").addEventListener("click", (e) => {
    const cap = el.reviewCaption;
    cap.classList.toggle("is-open");
    e.target.textContent = cap.classList.contains("is-open") ? "收起" : "展开全文";
  });
  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.copy === "title") copyText(state.publishTitle);
      else copyText(deck().caption);
    });
  });
  $("#btn-copy-all").addEventListener("click", () => copyText(`${state.publishTitle}\n\n${deck().caption}`));

  $("#btn-export").addEventListener("click", exportZip);
  $("#btn-export-close").addEventListener("click", () => { el.modal.hidden = true; el.download.hidden = false; });
  $("#btn-restart").addEventListener("click", resetDemo);

  window.addEventListener("resize", () => {
    if (state.screen === 3) fitFrames();
  });
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => { if (state.screen === 3) fitFrames(); });
    ro.observe(el.carousel);
  }

  // init
  applyTheme();
  renderDeckCards();
  syncDeckText();
  goto(1);
})();
