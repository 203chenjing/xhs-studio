/* Desktop workspace demo */
(function () {
  "use strict";

  var decks = (window.XHS_DEMO && window.XHS_DEMO.decks) || [];
  var themes = window.XHS_THEMES || {};
  var PAGE_W = 1080;
  var PAGE_H = 1440;

  var state = {
    deck: 0,
    theme: decks[0] ? decks[0].style : "ins",
    page: 0,
    step: 1,
    started: false,
    generating: false,
    exporting: false,
    publishTitle: decks[0] ? decks[0].title : ""
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var el = {
    steps: $$(".pc-steps button"),
    sample: $("#sample"),
    decks: $("#decks"),
    intent: $("#intent"),
    deckKicker: $("#deck-kicker"),
    review: $("#review-block"),
    risk: $("#risk"),
    pubTitle: $("#pub-title"),
    hooks: $("#hooks"),
    caption: $("#caption"),
    checkTitle: $("#check-title"),
    checkPages: $("#check-pages"),
    checkTags: $("#check-tags"),
    primary: $("#primary"),
    ctaHint: $("#cta-hint"),
    stageNote: $("#stage-note"),
    stageBody: $("#stage-body"),
    stageEmpty: $("#stage-empty"),
    canvasBox: $("#canvas-box"),
    canvas: $("#canvas"),
    gen: $("#gen"),
    genStage: $("#gen-stage"),
    genBar: $("#gen-bar"),
    genNote: $("#gen-note"),
    pageType: $("#page-type"),
    pageCount: $("#page-count"),
    zoom: $("#zoom"),
    prev: $("#prev"),
    next: $("#next"),
    thumbs: $("#thumbs"),
    railCount: $("#rail-count"),
    themeList: $("#themes"),
    railTheme: $("#rail-theme"),
    styleName: $("#style-name"),
    exportBtn: $("#export"),
    modal: $("#export-modal"),
    exportTitle: $("#export-title"),
    exportSub: $("#export-sub"),
    exportBar: $("#export-bar"),
    exportStatus: $("#export-status"),
    exportActions: $("#export-actions"),
    download: $("#download"),
    exportStage: $("#export-stage"),
    toast: $("#toast")
  };

  var TYPE_LABELS = {
    cover: "封面", chapter: "章节", points: "要点", timeline: "时间线",
    compare: "对比", quote: "金句", summary: "总结", ending: "结尾",
    card: "卡片", free: "正文", composite: "组合", photo: "配图", gallery: "图集"
  };

  function deck() { return decks[state.deck] || null; }
  function pages() { return (deck() && deck().data.pages) || []; }
  function meta() { return (deck() && deck().data.meta) || {}; }
  function themeName(id) { return (themes[id] && themes[id].title) || id; }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.hidden = true; }, 1600);
  }

  function applyTheme() {
    if (window.XHSEngine) window.XHSEngine.applyTheme(state.theme, themes);
  }

  function themeAccent(id) {
    var css = (themes[id] && themes[id].css) || "";
    var m = css.match(/--page-accent:\s*([^;]+)/);
    return m ? m[1].trim() : "#ff4d5f";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── data / sidebar ── */
  function renderSample() {
    el.sample.innerHTML = decks.map(function (d, i) {
      return '<option value="' + i + '">' + escapeHtml(d.label) + " · " + d.data.pages.length + " 页</option>";
    }).join("");
    el.sample.value = String(state.deck);
  }

  function renderDeckCards() {
    el.decks.innerHTML = decks.map(function (d, i) {
      return '<button type="button" class="deck' + (i === state.deck ? " is-active" : "") + '" data-deck="' + i + '">' +
        "<b>" + escapeHtml(d.title) + "</b>" +
        "<span>" + escapeHtml(d.kicker) + " · " + escapeHtml(themeName(d.style)) + "</span>" +
        "</button>";
    }).join("");
    $$(".deck").forEach(function (btn) {
      btn.addEventListener("click", function () { selectDeck(+btn.dataset.deck); });
    });
  }

  function selectDeck(i) {
    if (i === state.deck || !decks[i]) return;
    state.deck = i;
    state.theme = deck().style;
    state.page = 0;
    state.publishTitle = deck().title;
    applyTheme();
    renderSample();
    renderDeckCards();
    syncBase();
    renderThemes();
    if (state.started) {
      populateReview();
      renderThumbs();
      renderCanvas();
    }
    toast("已切换案例");
  }

  function syncBase() {
    var d = deck();
    el.intent.textContent = d.intent;
    el.deckKicker.textContent = d.kicker;
    el.railTheme.textContent = themeName(state.theme);
    el.styleName.textContent = themeName(state.theme);
  }

  /* ── steps ── */
  function syncSteps() {
    el.steps.forEach(function (btn) {
      var n = +btn.dataset.step;
      btn.classList.toggle("is-active", n === state.step);
      btn.classList.toggle("is-done", n < state.step);
      btn.disabled = state.started ? n === 1 : n > 1;
    });
    el.review.hidden = !state.started;
    el.exportBtn.disabled = state.step !== 3 || !state.started;
    if (state.step === 1) {
      el.primary.textContent = "生成并审核";
      el.ctaHint.textContent = "回放约 2 秒 · 内容为真实模型预生成";
      el.stageNote.textContent = "生成后可逐页查看、切换主题并导出";
    } else if (state.step === 2) {
      el.primary.textContent = "开始排版";
      el.ctaHint.textContent = "审核通过 · 可翻页预览后再进排版";
      el.stageNote.textContent = "审阅模式 · 翻页只读";
    } else {
      el.primary.textContent = "导出发布包";
      el.ctaHint.textContent = "浏览器内生成 2160×2880 PNG + ZIP";
      el.stageNote.textContent = "已确认排版 · 可换主题或导出";
    }
  }

  function gotoStep(n) {
    if (n > 1 && !state.started) return;
    if (n === 1 && state.started) return;
    state.step = n;
    syncSteps();
    if (state.started) {
      el.stageEmpty.hidden = true;
      el.canvasBox.hidden = false;
      requestAnimationFrame(fitCanvas);
    }
  }

  /* ── generation playback ── */
  function startGenerate() {
    if (state.generating) return;
    state.generating = true;
    el.primary.disabled = true;
    el.gen.hidden = false;
    el.genStage.textContent = "① 正在写稿…";
    el.genNote.textContent = "按 3:4 画布自由组页 · 预生成内容回放";
    el.genBar.style.width = "12%";
    var t1 = setTimeout(function () {
      el.genStage.textContent = "② 正在审核标题与排版…";
      el.genNote.textContent = "检查标题长度、封面 hook、话题与溢出";
      el.genBar.style.width = "64%";
    }, 900);
    var t2 = setTimeout(function () {
      el.genBar.style.width = "100%";
      el.genNote.textContent = "完成 · 未发现发布风险";
    }, 1650);
    var t3 = setTimeout(function () {
      el.gen.hidden = true;
      el.primary.disabled = false;
      state.generating = false;
      state.started = true;
      state.page = 0;
      state.publishTitle = deck().title;
      populateReview();
      renderThemes();
      renderThumbs();
      renderCanvas();
      gotoStep(2);
      el.stageEmpty.hidden = true;
      el.canvasBox.hidden = false;
      requestAnimationFrame(fitCanvas);
      toast("审核完成 · 可以开始排版");
    }, 2050);
    void t1; void t2; void t3;
  }

  function populateReview() {
    var d = deck();
    var list = pages();
    state.publishTitle = d.title;
    el.pubTitle.textContent = d.title;
    el.caption.textContent = d.caption;
    var tags = list.reduce(function (acc, p) { return acc.concat(p.tags || []); }, []);
    el.checkTitle.textContent = d.title.length + " 字";
    el.checkPages.textContent = list.length;
    el.checkTags.textContent = tags.length;
    renderHooks();
  }

  function renderHooks() {
    var d = deck();
    el.hooks.innerHTML = d.hooks.map(function (h) {
      return '<button type="button" class="hook' + (h === state.publishTitle ? " is-active" : "") + '" data-hook="' + encodeURIComponent(h) + '">' + escapeHtml(h) + "</button>";
    }).join("");
    $$(".hook").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.publishTitle = decodeURIComponent(btn.dataset.hook);
        el.pubTitle.textContent = state.publishTitle;
        el.checkTitle.textContent = state.publishTitle.length + " 字";
        renderHooks();
        toast("已替换发布标题");
      });
    });
  }

  /* ── canvas ── */
  function pageHtml(page, i) {
    var shell = window.XHSEngine.pageShellAttrs(page);
    var styleAttr = shell.style ? ' style="' + shell.style + '"' : "";
    var inner = window.XHSEngine.renderPage(page, meta(), {
      editable: false, pageIndex: i, pageTotal: pages().length
    });
    return '<div class="' + shell.className + '"' + styleAttr + ">" + inner + "</div>";
  }

  function renderCanvas() {
    var list = pages();
    if (!list.length) return;
    if (state.page < 0) state.page = 0;
    if (state.page >= list.length) state.page = list.length - 1;
    var page = list[state.page];
    el.canvas.innerHTML = pageHtml(page, state.page);
    el.pageType.textContent = TYPE_LABELS[page.type] || page.type;
    el.pageCount.textContent = String(state.page + 1).padStart(2, "0") + " / " + String(list.length).padStart(2, "0");
    el.prev.disabled = state.page <= 0;
    el.next.disabled = state.page >= list.length - 1;
    $$(".thumb").forEach(function (t, i) { t.classList.toggle("is-active", i === state.page); });
    fitCanvas();
  }

  function fitCanvas() {
    if (!el.canvasBox || el.canvasBox.hidden) return;
    var box = el.stageBody;
    var availW = box.clientWidth - 44;
    var availH = box.clientHeight - 44;
    var scale = Math.max(0.1, Math.min(availW / PAGE_W, availH / PAGE_H));
    el.canvas.style.transform = "scale(" + scale + ")";
    el.canvasBox.style.width = Math.round(PAGE_W * scale) + "px";
    el.canvasBox.style.height = Math.round(PAGE_H * scale) + "px";
    el.zoom.textContent = Math.round(scale * 100) + "%";
  }

  function goPage(i) {
    if (!state.started) return;
    state.page = i;
    renderCanvas();
  }

  function renderThumbs() {
    var list = pages();
    el.railCount.textContent = list.length + " 页";
    el.thumbs.innerHTML = list.map(function (page, i) {
      return '<button type="button" class="thumb' + (i === state.page ? " is-active" : "") + '" data-page="' + i + '">' +
        '<span class="thumb-frame"><span class="thumb-scale">' + pageHtml(page, i) + "</span></span>" +
        '<span class="thumb-meta"><b>' + (TYPE_LABELS[page.type] || page.type) + "</b><span>" + String(i + 1).padStart(2, "0") + "</span></span>" +
        "</button>";
    }).join("");
    $$(".thumb").forEach(function (btn) {
      var scaleEl = btn.querySelector(".thumb-scale");
      if (scaleEl) scaleEl.style.transform = "scale(" + (36 / PAGE_W) + ")";
      btn.addEventListener("click", function () { goPage(+btn.dataset.page); });
    });
  }

  /* ── themes ── */
  function renderThemes() {
    el.themeList.innerHTML = Object.keys(themes).map(function (id) {
      var t = themes[id];
      return '<button type="button" class="theme-item' + (id === state.theme ? " is-active" : "") + '" data-theme="' + id + '"' +
        (state.started ? "" : " disabled") + ">" +
        '<span class="theme-dot" style="background:' + themeAccent(id) + '"></span>' +
        "<b>" + escapeHtml(t.title) + "</b><span>" + escapeHtml((t.desc || "").split(" · ")[0]) + "</span>" +
        "</button>";
    }).join("");
    $$(".theme-item").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTheme(btn.dataset.theme); });
    });
  }

  function switchTheme(id) {
    if (!themes[id] || id === state.theme) return;
    state.theme = id;
    applyTheme();
    renderThemes();
    el.railTheme.textContent = themeName(id);
    el.styleName.textContent = themeName(id);
    if (state.started) {
      renderCanvas();
      renderThumbs();
    }
    toast("已切换 · " + themeName(id));
  }

  /* ── copy ── */
  function copyText(text) {
    function done() { toast("已复制"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else {
      fallback(text);
      done();
    }
  }
  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.dataset.copy === "title") copyText(state.publishTitle);
      else copyText(deck().caption);
    });
  });

  /* ── export ── */
  function exportZip() {
    if (state.exporting || !state.started) return;
    if (!window.htmlToImage || !window.JSZip) { toast("导出组件未加载"); return; }
    state.exporting = true;
    var d = deck();
    var list = pages();
    el.modal.hidden = false;
    el.exportTitle.textContent = "正在导出发布包";
    el.exportSub.textContent = "逐页渲染 2160×2880 PNG，再打包 title / caption";
    el.exportActions.hidden = true;
    el.download.hidden = false;
    el.exportBar.style.width = "0%";
    el.exportStatus.textContent = "0 / " + list.length;

    var chain = Promise.resolve();
    list.forEach(function (page, i) {
      chain = chain.then(function () {
        el.exportStatus.textContent = (i + 1) + " / " + list.length + " · 渲染中";
        el.exportBar.style.width = Math.round((i / list.length) * 100) + "%";
        var div = document.createElement("div");
        var shell = window.XHSEngine.pageShellAttrs(page);
        div.className = shell.className;
        div.style.width = PAGE_W + "px";
        div.style.height = PAGE_H + "px";
        if (shell.style) {
          shell.style.split(";").forEach(function (pair) {
            var idx = pair.indexOf(":");
            if (idx < 0) return;
            div.style.setProperty(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
          });
        }
        div.innerHTML = window.XHSEngine.renderPage(page, meta(), { editable: false, pageIndex: i, pageTotal: list.length });
        el.exportStage.appendChild(div);
        window.XHSEngine.fitPage(div);
        return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); })
          .then(function () {
            return window.htmlToImage.toPng(div, {
              width: PAGE_W, height: PAGE_H, pixelRatio: 2, cacheBust: true, skipFonts: false
            });
          })
          .then(function (dataUrl) {
            window.__zipFolder.file(String(i + 1).padStart(2, "0") + ".png", dataUrl.split(",")[1], { base64: true });
            el.exportStage.removeChild(div);
          });
      });
    });

    var zip = new window.JSZip();
    window.__zipFolder = zip.folder("pages");
    applyTheme();
    document.fonts.ready
      .then(function () { return chain; })
      .then(function () {
        var tags = list.reduce(function (acc, p) { return acc.concat(p.tags || []); }, []);
        zip.file("title.txt", state.publishTitle);
        zip.file("caption.txt", d.caption);
        zip.file("publish.json", JSON.stringify({
          title: state.publishTitle, caption: d.caption,
          images: list.map(function (_, i) { return "pages/" + String(i + 1).padStart(2, "0") + ".png"; }),
          meta: { studio: "xhs-studio", demo: true, style: state.theme, page_count: list.length, tags: tags }
        }, null, 2));
        zip.file("meta.json", JSON.stringify({ style: state.theme, page_count: list.length, title: state.publishTitle }, null, 2));
        el.exportStatus.textContent = "打包中…";
        return zip.generateAsync({ type: "blob" });
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        el.download.href = url;
        el.download.download = "xhs-studio-" + d.id + "-" + list.length + "p.zip";
        el.exportBar.style.width = "100%";
        el.exportTitle.textContent = "发布包已生成";
        el.exportSub.textContent = list.length + " 张 2160×2880 PNG + title / caption / publish.json";
        el.exportStatus.textContent = "共 " + list.length + " 页 · " + (blob.size / 1024 / 1024).toFixed(1) + " MB";
        el.exportActions.hidden = false;
        setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
      })
      .catch(function (err) {
        console.error(err);
        el.exportTitle.textContent = "导出失败";
        el.exportSub.textContent = "可以先用左侧「复制」把文案带走，或刷新重试。";
        el.exportStatus.textContent = String(err && err.message ? err.message : err);
        el.exportActions.hidden = false;
        el.download.hidden = true;
      })
      .then(function () { state.exporting = false; });
  }

  /* ── bind ── */
  el.primary.addEventListener("click", function () {
    if (state.step === 1) startGenerate();
    else if (state.step === 2) gotoStep(3);
    else exportZip();
  });
  el.exportBtn.addEventListener("click", exportZip);
  el.prev.addEventListener("click", function () { goPage(state.page - 1); });
  el.next.addEventListener("click", function () { goPage(state.page + 1); });
  el.sample.addEventListener("change", function () { selectDeck(+el.sample.value); });
  el.steps.forEach(function (btn) {
    btn.addEventListener("click", function () { if (!btn.disabled) gotoStep(+btn.dataset.step); });
  });
  $("#export-close").addEventListener("click", function () { el.modal.hidden = true; });
  $("#export-modal").addEventListener("click", function (e) { if (e.target === el.modal) el.modal.hidden = true; });

  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (!state.started) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); goPage(state.page - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); goPage(state.page + 1); }
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      var n = +e.key;
      if (n === 1) return;
      if (!el.steps[n - 1].disabled) gotoStep(n);
    }
  });

  window.addEventListener("resize", function () { if (state.started) fitCanvas(); });
  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (state.started) fitCanvas(); }).observe(el.stageBody);
  }

  // init
  applyTheme();
  renderSample();
  renderDeckCards();
  syncBase();
  renderThemes();
  syncSteps();
  el.review.hidden = true;
})();
