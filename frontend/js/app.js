(function () {
  "use strict";

  const PAGE_W = XHSEngine.PAGE_W;
  const PAGE_H = XHSEngine.PAGE_H;
  const API = ""; // same origin when hosted by FastAPI

  const TYPE_LABELS = {
    cover: "封面",
    chapter: "章节",
    points: "要点",
    timeline: "步骤",
    card: "卡片",
    quote: "金句",
    compare: "对比",
    summary: "总结",
    ending: "结尾",
    photo: "配图",
    gallery: "拼图",
    composite: "组合",
    free: "展开",
  };

  const state = {
    data: null,
    title: "",
    caption: "",
    hooks: [],
    brief: null,
    style: "ins",
    page: 0,
    exporting: false,
    photos: [],
    intent: "",
    supplementContext: "",
    step: 1, // 1 写意图 · 2 出稿审核 · 3 改页导出
    composeSub: "", // drafting | reviewing | ""
    layoutConfirmed: false,
    review: null,
    logicSummary: [],
    theme: "",
    needsRereview: false,
    llmConfigured: false,
    serviceMode: "demo",
    runMode: "", // llm | demo | demo_fallback
    warnings: [],
    pageUndo: null, // { pageIndex, page }
    uploadSessionId: null,
    lastGenerateBody: null,
    themeExpanded: false,
    mobilePreview: false,
    viewedPages: new Set(),
    intentCollapsed: false,
    exportChoiceOpen: false,
    generating: false,
    projectId: "current",
    history: { past: [], future: [] },
    llmSession: { calls: 0 },
    generation: { snapshot: null },
    selectedPath: null,
    copilot: { messages: [], loading: false, contextLabel: "", followUpChips: null },
    copilotEphemeral: null, // { beforePage, draftData, ops, instruction, result, streamMsgIdx }
    exportWarnings: [],
    layoutPreview: null,
    pendingRecovery: null,
    apiBusy: false,
    timingLog: [],
  };

  let elapsedTimer = null;
  let elapsedStartedAt = 0;
  let currentEstimatedSeconds = 10;
  let ephemeralRenderTimer = null;

  const MAX_PHOTOS = 9;

  const $ = (s) => document.querySelector(s);
  const intentEl = $("#intent");
  const supplementEl = $("#supplement-context");
  const supplementCopilotHint = $("#supplement-copilot-hint");
  const authorEl = $("#author");
  const brandEl = $("#brand");
  const statusEl = $("#status");
  const progressWrap = $("#progress-wrap");
  const progressStage = $("#progress-stage");
  const progressLabel = $("#progress-label");
  const progressMeta = $("#progress-meta");
  const preview = $("#preview-stage");
  const overflowBadge = $("#overflow-badge");
  const emptyHint = $("#empty-hint");
  const pageNav = $("#page-nav");
  const pageIndicator = $("#page-indicator");
  const titleEl = $("#title");
  const captionEl = $("#caption");
  const hooksEl = $("#hooks");
  const jsonView = $("#json-view");
  const themeGrid = $("#theme-grid");
  const themeRecommend = $("#theme-recommend");
  const btnThemeMore = $("#btn-theme-more");
  const reviewPanel = $("#review-panel");
  const reviewLayoutBadge = $("#review-layout-badge");
  const postGenPanel = $("#post-gen-panel");
  const manuscriptPanel = $("#manuscript-panel");
  const manuscriptList = $("#manuscript-list");
  const manuscriptMeta = $("#manuscript-meta");
  const btnGen = $("#btn-generate");
  const btnRetry = $("#btn-retry-generate");
  const btnExport = $("#btn-export");
  const btnPrev = $("#btn-prev");
  const btnNext = $("#btn-next");
  const btnPageUndo = $("#btn-page-undo");
  const btnLayoutIdeas = $("#btn-layout-ideas");
  const layoutIdeasEl = $("#layout-ideas");
  const timingLogList = $("#timing-log-list");
  const timingLogEmpty = $("#timing-log-empty");
  const timingLogPanel = $("#timing-log-panel");
  const btnCopyTitle = $("#btn-copy-title");
  const btnCopyCaption = $("#btn-copy-caption");
  const btnApplyReview = $("#btn-apply-review");
  const btnRerunReview = $("#btn-rerun-review");
  const btnConfirmLayout = $("#btn-confirm-layout");
  const stickyCta = $("#sticky-cta");
  const copilotPanel = $("#copilot-panel");
  const copilotThread = $("#copilot-thread");
  const copilotInput = $("#copilot-input");
  const copilotSend = $("#copilot-send");
  const copilotChips = $("#copilot-chips");
  const copilotContext = $("#copilot-context");
  const copilotLlmBadge = $("#copilot-llm-badge");
  const copilotLockHint = $("#copilot-lock-hint");
  const copilotEphemeralBar = $("#copilot-ephemeral-bar");
  const btnEphemeralApply = $("#btn-ephemeral-apply");
  const btnEphemeralDiscard = $("#btn-ephemeral-discard");
  const pageTypeLabel = $("#page-type-label");
  const previewModeTag = $("#preview-mode-tag");
  const btnStartEdit = $("#btn-start-edit");
  const btnOverflowCompact = $("#btn-overflow-compact");
  const btnOverflowDeleteLast = $("#btn-overflow-delete-last");
  const btnOverflowSplit = $("#btn-overflow-split");
  const photoDrop = $("#photo-drop");
  const photoInput = $("#photo-input");
  const photoThumbs = $("#photo-thumbs");
  const packHint = $("#pack-hint");
  const needsRereviewEl = $("#needs-rereview");
  const exportRereviewBar = $("#export-rereview-bar");
  const btnExportRereview = $("#btn-export-rereview");
  const btnExportForce = $("#btn-export-force");
  const btnExportCancel = $("#btn-export-cancel");
  const flowStatusEl = $("#flow-status");
  const flowStatusLabel = $("#flow-status-label");
  const flowSub2 = $("#flow-sub-2");
  const heroEtaHint = $("#hero-eta-hint");
  const modeBanner = $("#mode-banner");
  const draftPickerWrap = $("#draft-picker-wrap");
  const draftPicker = $("#draft-picker");
  const btnMobilePreview = $("#btn-mobile-preview");
  const btnMobileClose = $("#btn-mobile-close");
  const appMain = $("#app-main");
  const heroSection = $("#hero-section");
  const intentSummary = $("#intent-summary");
  const intentSummaryText = $("#intent-summary-text");
  const btnExpandIntent = $("#btn-expand-intent");
  const genSkeleton = $("#gen-skeleton");
  const aiHistoryMenu = $("#ai-history-menu");
  const pageAiButtons = [btnLayoutIdeas].filter(Boolean);
  const SMART_OPTIMIZE_INSTR = "智能优化本页：文案更利落、信息更具体、版式更紧凑";
  const COPILOT_SEND_LABEL = "发送";
  const COPILOT_MAX_MESSAGES = 30;
  const HISTORY_MAX = 50;

  const btnCancelRequest = $("#btn-cancel-request");
  const draftRecoveryBar = $("#draft-recovery-bar");
  const btnRecoverDraft = $("#btn-recover-draft");
  const btnDiscardDraft = $("#btn-discard-draft");
  const llmSessionPill = $("#llm-session-pill");
  const savePill = $("#save-pill");
  const btnHistoryUndo = $("#btn-history-undo");
  const btnHistoryRedo = $("#btn-history-redo");
  const btnPageDup = $("#btn-page-dup");
  const btnPageDel = $("#btn-page-del");
  const btnPageAdd = $("#btn-page-add");
  const exportBlockersBar = $("#export-blockers-bar");
  const exportBlockersMsg = $("#export-blockers-msg");
  const btnExportBlockersClose = $("#btn-export-blockers-close");
  let imageReplaceInput = null;

  const REVISE_CHIPS_BY_TYPE = {
    cover: [
      { label: "标题更狠", chip: "标题更狠更抓人", kind: "copy" },
      { label: "副标题缩短", chip: "副标题缩短", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    points: [
      { label: "删第2条", chip: "删掉第 2 条", kind: "copy" },
      { label: "改成账本清单", kind: "layout", localOp: [{ op: "setPointsLayout", layout: "ledger" }] },
      { label: "标签 Pill", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "pill-tags" }] },
      { label: "极简左条", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "left-bar-minimal" }] },
    ],
    timeline: [
      { label: "删第2步", chip: "删掉第 2 步", kind: "copy" },
      { label: "更具体", chip: "每步写得更具体", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    summary: [
      { label: "删第2条", chip: "删掉第 2 条", kind: "copy" },
      { label: "清单体", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "checklist" }] },
      { label: "指标卡片", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "metric-cards" }] },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    compare: [
      { label: "对比表更清晰", chip: "对比表排版更清晰，列对齐字号更大", kind: "layout" },
      { label: "补全两侧", chip: "补全对比两侧内容", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
      { label: "删第2行", chip: "删掉第 2 行", kind: "copy" },
    ],
    quote: [
      { label: "删这句", chip: "删掉这句", kind: "copy" },
      { label: "金句居中", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "center-hero" }] },
      { label: "黑底反转", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "inverted-block" }] },
      { label: "变紧凑", chip: "字体变小一点", kind: "layout" },
    ],
    ending: [
      { label: "CTA 更短", chip: "行动号召再短一点", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    card: [
      { label: "更具体", chip: "正文更具体一点", kind: "copy" },
      { label: "极简居中", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "minimal-center" }] },
      { label: "侧栏强调", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "sidebar-accent" }] },
      { label: "变紧凑", chip: "更紧凑", kind: "layout" },
    ],
    chapter: [
      { label: "标题更狠", chip: "章节标题更抓人", kind: "copy" },
      { label: "罗马序号", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "roman-numeral" }] },
      { label: "超大章节号", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "big-number" }] },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    photo: [
      { label: "文案更短", chip: "配图文案再短一点", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    gallery: [
      { label: "文案更短", chip: "文案再短一点", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    free: [
      { label: "更具体", chip: "写得更具体一点", kind: "copy" },
      { label: "杂志分栏", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "magazine-columns" }] },
      { label: "金句突出", kind: "layout", localOp: [{ op: "setPageLayoutVariant", variant: "pull-quote-inline" }] },
      { label: "变紧凑", chip: "更紧凑", kind: "layout" },
    ],
  };
  const REVISE_CHIPS_DEFAULT = [
    { label: "更具体", chip: "写得更具体一点", kind: "copy" },
    { label: "变紧凑", chip: "更紧凑", kind: "layout" },
    { label: "字号变小", chip: "字体变小一点", kind: "layout" },
  ];
  const FOLLOW_UP_CHIPS_BY_TYPE = {
    ending: [
      { label: "再短一半", chip: "行动号召再短一半", kind: "copy" },
      { label: "更口语", chip: "行动号召更口语一点", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    cover: [
      { label: "再短一点", chip: "副标题再短一点", kind: "copy" },
      { label: "标题更狠", chip: "标题更狠更抓人", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
    quote: [
      { label: "再短一半", chip: "金句再短一半", kind: "copy" },
      { label: "换一句", chip: "换一句更短的金句", kind: "copy" },
      { label: "变紧凑", chip: "更紧凑", kind: "layout" },
    ],
    points: [
      { label: "更具体", chip: "写得更具体一点", kind: "copy" },
      { label: "删第2条", chip: "删掉第 2 条", kind: "copy" },
      { label: "更紧凑", chip: "更紧凑", kind: "layout" },
    ],
  };
  const PAGE_TEXT_FIELDS = ["title", "subtitle", "text", "body", "intro", "desc", "caption", "bridge"];

  const FIELD_PATH_LABELS = {
    title: "标题",
    subtitle: "副标题",
    kicker: "标签",
    body: "正文",
    text: "文字",
    intro: "引言",
    desc: "说明",
    head: "标题",
    time: "时间",
    label: "标签",
    value: "数值",
    no: "序号",
    bridge: "过渡",
    progress: "进度",
    contact: "联系方式",
  };
  const LIST_PATH_LABELS = {
    items: "要点",
    steps: "步骤",
    rows: "行",
    bullets: "条目",
    paragraphs: "段落",
  };
  function syncOverflowActions(overflow) {
    const show = !!overflow;
    if (btnOverflowCompact) {
      btnOverflowCompact.hidden = !show;
      btnOverflowCompact.disabled = !state.data;
    }
    if (btnOverflowDeleteLast) {
      btnOverflowDeleteLast.hidden = !show;
      btnOverflowDeleteLast.disabled = !state.data;
    }
    if (btnOverflowSplit) {
      const page = state.data && state.data.pages && state.data.pages[state.page];
      const key = page && XHSOps.listKeyForPage(page);
      const canSplit =
        show &&
        page &&
        (key === "items" || key === "steps") &&
        Array.isArray(page[key]) &&
        page[key].length >= 3 &&
        state.data.pages.length < 12;
      btnOverflowSplit.hidden = !canSplit;
      btnOverflowSplit.disabled = !canSplit;
    }
  }

  function apiFetch(path, options) {
    return XHSApi.apiFetch(API + path, options);
  }

  function getSupplementContext() {
    return (
      state.supplementContext ||
      (supplementEl && supplementEl.value ? supplementEl.value.trim() : "") ||
      ""
    );
  }

  function syncSupplementFromDom() {
    if (!supplementEl) return;
    state.supplementContext = supplementEl.value;
    updateSupplementCopilotHint();
  }

  function updateSupplementCopilotHint() {
    if (!supplementCopilotHint) return;
    const has = !!getSupplementContext();
    supplementCopilotHint.hidden = !has;
  }

  function buildSupplementPayload() {
    const supp = getSupplementContext();
    return supp ? { supplement_context: supp } : {};
  }

  function setApiBusy(kind, on) {
    state.apiBusy = !!on;
    if (btnCancelRequest) btnCancelRequest.hidden = !on;
  }

  function captureSnapshot() {
    return {
      data: state.data ? JSON.parse(JSON.stringify(state.data)) : null,
      title: state.title,
      caption: state.caption,
      hooks: state.hooks ? [...state.hooks] : [],
      brief: state.brief,
      style: state.style,
      page: state.page,
      layoutConfirmed: state.layoutConfirmed,
      review: state.review ? JSON.parse(JSON.stringify(state.review)) : null,
      logicSummary: state.logicSummary ? [...state.logicSummary] : [],
      theme: state.theme,
      needsRereview: state.needsRereview,
      intent: state.intent,
      supplementContext: state.supplementContext,
      runMode: state.runMode,
      warnings: state.warnings ? [...state.warnings] : [],
      viewedPages: Array.from(state.viewedPages),
      llmSession: { ...state.llmSession },
    };
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    state.data = snap.data ? JSON.parse(JSON.stringify(snap.data)) : null;
    state.title = snap.title || "";
    state.caption = snap.caption || "";
    state.hooks = snap.hooks || [];
    state.brief = snap.brief || null;
    state.style = snap.style || state.style;
    state.page = snap.page || 0;
    state.layoutConfirmed = !!snap.layoutConfirmed;
    state.review = snap.review ? JSON.parse(JSON.stringify(snap.review)) : null;
    state.logicSummary = snap.logicSummary || [];
    state.theme = snap.theme || "";
    state.needsRereview = !!snap.needsRereview;
    state.intent = snap.intent || state.intent;
    state.supplementContext = snap.supplementContext || state.supplementContext || "";
    state.runMode = snap.runMode || state.runMode;
    state.warnings = snap.warnings || [];
    state.viewedPages = new Set(snap.viewedPages || []);
    state.llmSession = snap.llmSession || { calls: 0 };
    if (titleEl) titleEl.value = state.title;
    if (captionEl) captionEl.value = state.caption;
    if (intentEl && snap.intent) intentEl.value = snap.intent;
    if (supplementEl && snap.supplementContext != null) supplementEl.value = snap.supplementContext;
    updateSupplementCopilotHint();
    updateLlmPill();
    renderLogicSummary();
    renderPageSummary();
    renderReviewUI();
    renderHooks();
    syncJson();
    renderPreview();
  }

  function pushHistory(label) {
    state.history.past.push({ snapshot: captureSnapshot(), label: label || "" });
    if (state.history.past.length > HISTORY_MAX) state.history.past.shift();
    state.history.future = [];
    updateHistoryButtons();
  }

  function undoHistory() {
    if (!state.history.past.length) return;
    state.history.future.unshift({ snapshot: captureSnapshot(), label: "redo" });
    const entry = state.history.past.pop();
    restoreSnapshot(entry.snapshot);
    updateHistoryButtons();
    XHSA11y.announce("已撤销");
    setStatus("已撤销上一步编辑", "ok");
  }

  function redoHistory() {
    if (!state.history.future.length) return;
    state.history.past.push({ snapshot: captureSnapshot(), label: "undo" });
    const entry = state.history.future.shift();
    restoreSnapshot(entry.snapshot);
    updateHistoryButtons();
    XHSA11y.announce("已重做");
    setStatus("已重做", "ok");
  }

  function updateHistoryButtons() {
    if (btnHistoryUndo) btnHistoryUndo.disabled = !state.history.past.length;
    if (btnHistoryRedo) btnHistoryRedo.disabled = !state.history.future.length;
  }

  function trackLlmMeta(meta) {
    if (!meta || typeof meta.llm_calls !== "number") return;
    state.llmSession.calls += meta.llm_calls;
    updateLlmPill();
    scheduleAutosave();
  }

  function updateLlmPill() {
    if (!llmSessionPill) return;
    const n = state.llmSession.calls || 0;
    if (n <= 0) {
      llmSessionPill.hidden = true;
      return;
    }
    llmSessionPill.hidden = false;
    llmSessionPill.textContent = `LLM ×${n}`;
    llmSessionPill.title = "本会话累计 LLM 调用（含单页改/排版思路/复审）";
    syncCopilotLlmBadge();
  }

  function updateSavePill(saved) {
    if (!savePill) return;
    savePill.hidden = false;
    savePill.textContent = saved ? "已保存" : "保存中…";
    savePill.classList.toggle("ok", !!saved);
  }

  function buildProjectSnapshot() {
    return {
      id: state.projectId || "current",
      intent: state.intent || (intentEl && intentEl.value.trim()) || "",
      supplementContext: getSupplementContext(),
      author: (authorEl && authorEl.value) || "",
      brand: (brandEl && brandEl.value) || "",
      style: state.style,
      photos: state.photos.map((p) => ({ id: p.id, url: p.url, name: p.name })),
      data: state.data,
      title: state.title,
      caption: state.caption,
      hooks: state.hooks,
      brief: state.brief,
      review: state.review,
      layoutConfirmed: state.layoutConfirmed,
      page: state.page,
      logicSummary: state.logicSummary,
      theme: state.theme,
      needsRereview: state.needsRereview,
      runMode: state.runMode,
      llmSession: state.llmSession,
      step: state.step,
      uploadSessionId: state.uploadSessionId,
      lastGenerateBody: state.lastGenerateBody,
      timingLog: state.timingLog || [],
    };
  }

  function scheduleAutosave() {
    if (!state.data) return;
    updateSavePill(false);
    XHSProjectStore.scheduleSave(() => {
      const snap = buildProjectSnapshot();
      snap.onSaved = () => updateSavePill(true);
      return snap;
    }, 800);
  }

  function hydrateFromProject(snap) {
    if (!snap) return;
    state.projectId = snap.id || "current";
    state.intent = snap.intent || "";
    state.supplementContext = snap.supplementContext || "";
    state.style = snap.style || state.style;
    state.data = snap.data || null;
    state.title = snap.title || "";
    state.caption = snap.caption || "";
    state.hooks = snap.hooks || [];
    state.brief = snap.brief || null;
    state.review = snap.review || null;
    state.layoutConfirmed = !!snap.layoutConfirmed;
    state.page = snap.page || 0;
    state.logicSummary = snap.logicSummary || [];
    state.theme = snap.theme || "";
    state.needsRereview = !!snap.needsRereview;
    state.runMode = snap.runMode || state.serviceMode;
    state.llmSession = snap.llmSession || { calls: 0 };
    state.step = snap.step || (state.data ? 2 : 1);
    state.uploadSessionId = snap.uploadSessionId || null;
    state.lastGenerateBody = snap.lastGenerateBody || null;
    state.timingLog = snap.timingLog || [];
    renderTimingLog();
    if (snap.photos && snap.photos.length) {
      state.photos = snap.photos.filter((p) => p.url).map((p) => ({ ...p, uploading: false }));
    }
    if (intentEl) intentEl.value = state.intent;
    if (supplementEl) supplementEl.value = state.supplementContext || "";
    updateSupplementCopilotHint();
    if (titleEl) titleEl.value = state.title;
    if (captionEl) captionEl.value = state.caption;
    if (authorEl && snap.author) authorEl.value = snap.author;
    if (brandEl && snap.brand) brandEl.value = snap.brand;
    if (state.data) {
      showReviewPanel();
      if (state.layoutConfirmed) showPostGen();
      setFlowStep(state.layoutConfirmed ? 3 : 2);
    } else {
      setFlowStep(1);
    }
    renderPhotoThumbs();
    renderThemeGrid();
    XHSEngine.applyTheme(state.style, window.XHS_THEMES);
    renderHooks();
    renderLogicSummary();
    renderPageSummary();
    renderReviewUI();
    syncJson();
    renderPreview();
    updateLlmPill();
    updateExportButton();
    scheduleAutosave();
    refreshDraftPicker();
  }

  function showExportBlockers(blockers) {
    if (!exportBlockersBar || !exportBlockersMsg) return;
    const msgs = (blockers || []).map((b) => b.message || b.code).filter(Boolean);
    if (!msgs.length) {
      exportBlockersBar.hidden = true;
      return;
    }
    exportBlockersMsg.textContent = msgs.join(" · ");
    exportBlockersBar.hidden = false;
    exportBlockersBar.querySelectorAll("[data-goto-page]").forEach((el) => el.remove());
    blockers.forEach((b) => {
      if (b.pageIndex == null) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm";
      btn.dataset.gotoPage = String(b.pageIndex);
      btn.textContent = `第 ${b.pageIndex + 1} 页`;
      btn.addEventListener("click", () => {
        state.page = b.pageIndex;
        exportBlockersBar.hidden = true;
        renderPreview();
      });
      exportBlockersBar.querySelector(".export-blockers-actions").prepend(btn);
    });
  }

  function getPreviewScale() {
    const wrap = $("#preview-wrap");
    if (!wrap || !preview) return 1;
    const pad = 12;
    return Math.min((wrap.clientWidth - pad) / PAGE_W, (wrap.clientHeight - pad) / PAGE_H);
  }

  function applyLocalPageOps(ops, opts) {
    if (!state.data || !state.layoutConfirmed) return;
    pushHistory((opts && opts.summary) || "编辑");
    const pages = state.data.pages.slice();
    const { page } = XHSOps.applyPageOps(pages[state.page], ops);
    pages[state.page] = page;
    state.data = { ...state.data, pages, _user_edited: true };
    markNeedsRereview(true);
    syncJson();
    renderPreview();
    scheduleAutosave();
    if (opts && opts.summary) setStatus(`已${opts.summary} · 已改需复审`, "ok");
  }

  function applyLocalDocOps(ops, opts) {
    if (!state.data || !state.layoutConfirmed) return;
    pushHistory((opts && opts.summary) || "页操作");
    const { data } = XHSOps.applyDocumentOps(state.data, ops);
    state.data = { ...data, _user_edited: true };
    if (state.page >= state.data.pages.length) state.page = state.data.pages.length - 1;
    markNeedsRereview(true);
    renderLogicSummary();
    renderPageSummary();
    syncJson();
    renderPreview();
    scheduleAutosave();
    if (opts && opts.summary) setStatus(`已${opts.summary} · 已改需复审`, "ok");
  }

  function updatePageOpsButtons() {
    const pages = (state.data && state.data.pages) || [];
    const editable = !!(state.layoutConfirmed && pages.length);
    const hideOps = pages.length > 0 && !state.layoutConfirmed;
    const page = pages[state.page];
    const t = page && page.type;
    if (btnPageDup) {
      btnPageDup.disabled = !editable;
      btnPageDup.hidden = hideOps;
    }
    if (btnPageAdd) {
      btnPageAdd.disabled = !editable || pages.length >= 12;
      btnPageAdd.hidden = hideOps;
    }
    if (btnPageDel) {
      const coverOnly = t === "cover" && pages.filter((p) => p.type === "cover").length <= 1;
      const endingOnly = t === "ending" && pages.filter((p) => p.type === "ending").length <= 1;
      btnPageDel.disabled = !editable || coverOnly || endingOnly || pages.length <= 1;
      btnPageDel.hidden = hideOps;
    }
  }

  function ensureImageReplaceInput() {
    if (imageReplaceInput) return imageReplaceInput;
    imageReplaceInput = document.createElement("input");
    imageReplaceInput.type = "file";
    imageReplaceInput.accept = "image/jpeg,image/png,image/webp";
    imageReplaceInput.hidden = true;
    imageReplaceInput.addEventListener("change", async () => {
      const f = imageReplaceInput.files && imageReplaceInput.files[0];
      imageReplaceInput.value = "";
      const path = imageReplaceInput.dataset.path;
      if (!f || !path) return;
      const room = MAX_PHOTOS - state.photos.length;
      if (room <= 0 && !state.photos.some((p) => p.url)) {
        setStatus("请先在上传区添加图片", "err");
        return;
      }
      const fd = new FormData();
      fd.append("session_id", ensureUploadSession());
      fd.append("files", f, f.name);
      try {
        setStatus("上传换图…");
        const body = await apiFetch("/api/upload", {
          method: "POST",
          body: fd,
          timeoutMs: XHSApi.DEFAULT_TIMEOUT.upload,
        });
        const url = (body.urls && body.urls[0]) || (body.files && body.files[0] && body.files[0].url);
        if (!url) throw new Error("无 URL");
        const slot = path.includes("images[") ? path.match(/images\[(\d+)\]/)?.[0] || "image" : "image";
        applyLocalPageOps([{ op: "setImage", slot, url }], { summary: "换图" });
      } catch (e) {
        setStatus("换图失败: " + e.message, "err");
      }
    });
    document.body.appendChild(imageReplaceInput);
    return imageReplaceInput;
  }

  async function refreshDraftPicker() {
    if (!draftPicker || !draftPickerWrap) return;
    try {
      const list = await XHSProjectStore.listProjects(5);
      if (!list.length) {
        draftPickerWrap.hidden = true;
        return;
      }
      draftPickerWrap.hidden = false;
      const cur = state.projectId || "current";
      draftPicker.innerHTML = list
        .map((p) => {
          const id = String(p.id || "");
          const label = String(p.intent || p.title || "未命名草稿").slice(0, 28);
          const when = p.updatedAt
            ? new Date(p.updatedAt).toLocaleString("zh-CN", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          const text = when ? `${label} · ${when}` : label;
          return `<option value="${escText(id)}"${id === cur ? " selected" : ""}>${escText(text)}</option>`;
        })
        .join("");
    } catch {
      draftPickerWrap.hidden = true;
    }
  }

  async function initProjectRecovery() {
    try {
      const list = await XHSProjectStore.listProjects(1);
      if (list.length && list[0].data && list[0].data.pages && list[0].data.pages.length) {
        state.pendingRecovery = list[0];
        if (draftRecoveryBar) draftRecoveryBar.hidden = false;
      }
    } catch {
      /* IDB unavailable */
    }
    refreshDraftPicker();
  }

  function ensureUploadSession() {
    if (!state.uploadSessionId) {
      state.uploadSessionId =
        (crypto.randomUUID && crypto.randomUUID().replace(/-/g, "")) ||
        "s" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return state.uploadSessionId;
  }

  function setCopilotEnabled(on) {
    pageAiButtons.forEach((b) => {
      b.disabled = !on;
    });
    const blocked = !!(state.copilot.loading || state.copilotEphemeral);
    const canChat = on && state.layoutConfirmed && !!state.data && !blocked;
    if (copilotSend) copilotSend.disabled = !canChat;
    if (copilotInput) copilotInput.disabled = !canChat;
    updateUndoButton();
  }

  function buildOpsPillsHtml(pills, suffix) {
    const list = Array.isArray(pills) ? pills.filter(Boolean) : [];
    if (!list.length) return "";
    const suf = suffix ? `<span class="copilot-ops-suffix">${escText(suffix)}</span>` : "";
    return (
      `<div class="copilot-ops" role="status">` +
      list
        .map((p, i) => {
          const sep = i ? `<span class="copilot-ops-sep">·</span>` : "";
          return `${sep}<span class="copilot-ops-pill">${escText(p)}</span>`;
        })
        .join("") +
      suf +
      `</div>`
    );
  }

  function buildDiffsHtml(diffs) {
    const list = Array.isArray(diffs) ? diffs.filter((d) => d && d.before !== d.after) : [];
    if (!list.length) return "";
    return (
      `<div class="copilot-diffs">` +
      list
        .map((d) => {
          const before = truncateCopilotSnippet(d.before, 72);
          const after = truncateCopilotSnippet(d.after, 72);
          const pathAttr = d.path ? ` data-diff-path="${escText(d.path)}"` : "";
          return (
            `<div class="copilot-diff"${pathAttr}>` +
            `<span class="copilot-diff-label">${escText(d.label || "文案")}</span>` +
            `<div class="copilot-diff-snippet">` +
            `<span class="copilot-diff-before" title="${escText(d.before)}">${escText(before)}</span>` +
            `<span class="copilot-diff-arrow" aria-hidden="true">→</span>` +
            `<span class="copilot-diff-after" title="${escText(d.after)}">${escText(after)}</span>` +
            `</div></div>`
          );
        })
        .join("") +
      `</div>`
    );
  }

  function trimCopilotMessages() {
    if (state.copilot.messages.length > COPILOT_MAX_MESSAGES) {
      state.copilot.messages = state.copilot.messages.slice(-COPILOT_MAX_MESSAGES);
    }
  }

  function addCopilotMessage(role, text, opts) {
    state.copilot.messages.push({
      role,
      text: String(text || ""),
      pills: opts && opts.pills,
      suffix: opts && opts.suffix,
      diffs: opts && opts.diffs,
      hint: opts && opts.hint,
      warn: opts && opts.warn,
      ts: Date.now(),
    });
    trimCopilotMessages();
    renderCopilot();
  }

  function clearCopilotMessages() {
    state.copilot.messages = [];
    state.copilot.loading = false;
    state.copilot.contextLabel = "";
    state.copilot.followUpChips = null;
    renderCopilot();
  }

  function humanizeFieldPath(path) {
    if (!path) return "";
    const parts = XHSFieldPath.parsePath(path);
    const bits = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p === "number" && i > 0) {
        const listKey = String(parts[i - 1]);
        const listLabel = LIST_PATH_LABELS[listKey] || listKey;
        bits.push(`${listLabel}${p + 1}`);
      } else if (typeof p === "string" && typeof parts[i + 1] !== "number") {
        bits.push(FIELD_PATH_LABELS[p] || p);
      }
    }
    return bits.join("·") || path;
  }

  function refreshCopilotContextStrip() {
    if (!state.layoutConfirmed || !state.data) {
      if (copilotContext) {
        copilotContext.hidden = true;
        copilotContext.textContent = "";
      }
      return;
    }
    const pages = (state.data && state.data.pages) || [];
    const page = pages[state.page];
    const pageLabel = page ? TYPE_LABELS[page.type] || page.type || "本页" : "本页";
    const base = `第${state.page + 1}页 · ${pageLabel}`;
    let label = base;
    let mode = "page";
    if (state.selectedPath) {
      label = `${base} · ${humanizeFieldPath(state.selectedPath)}`;
      mode = "field";
    }
    state.copilot.contextLabel = label;
    if (copilotContext) {
      copilotContext.hidden = false;
      copilotContext.textContent = label;
      copilotContext.dataset.mode = mode;
    }
  }

  function syncCopilotInputPlaceholder(path) {
    if (!copilotInput) return;
    if (!state.data || !state.data.pages || !state.data.pages.length) return;
    if (!state.layoutConfirmed) {
      copilotInput.placeholder = "先点预览「开始编辑」，再描述想怎么改本页";
      return;
    }
    copilotInput.placeholder = path
      ? "已选中字段，描述改法；空着=优化选中内容"
      : "描述想怎么改，空着=智能优化本页";
  }

  function updateCopilotContext(path) {
    state.selectedPath = path || null;
    refreshCopilotContextStrip();
    syncCopilotInputPlaceholder(path);
  }

  function scrollCopilotToBottom() {
    if (!copilotThread) return;
    requestAnimationFrame(() => {
      copilotThread.scrollTop = copilotThread.scrollHeight;
    });
  }

  function syncCopilotLlmBadge() {
    if (!copilotLlmBadge) return;
    const n = state.llmSession.calls || 0;
    if (n > 0) {
      copilotLlmBadge.hidden = false;
      copilotLlmBadge.textContent = `LLM ×${n}`;
      copilotLlmBadge.title = "本会话累计 LLM 调用";
    } else {
      copilotLlmBadge.hidden = true;
    }
  }

  function renderCopilotChips() {
    if (!copilotChips) return;
    const pages = (state.data && state.data.pages) || [];
    const page = pages[state.page];
    const type = page && page.type;
    const followUp =
      state.copilot.followUpChips && state.copilot.followUpChips.length
        ? state.copilot.followUpChips
        : null;
    const list = (
      followUp ||
      (type && REVISE_CHIPS_BY_TYPE[type]) ||
      REVISE_CHIPS_DEFAULT
    ).slice(0, 3);
    const disabled = !state.layoutConfirmed || state.copilot.loading || !state.data;
    copilotChips.innerHTML = list
      .map((c) => {
        const chipText = c.chip || c.label || "";
        const localOp = c.localOp ? encodeURIComponent(JSON.stringify(c.localOp)) : "";
        return `<button type="button" class="chip kind-${escText(c.kind || "copy")}" data-chip="${encodeURIComponent(
          chipText
        )}" data-run="${localOp ? "0" : "1"}"${localOp ? ` data-local-op="${localOp}"` : ""}${disabled ? " disabled" : ""}>${escText(
          c.label
        )}</button>`;
      })
      .join("");
  }

  function renderCopilotThread() {
    if (!copilotThread) return;
    const parts = state.copilot.messages.map((m) => {
      const role = m.role || "assistant";
      let bubble = `<div class="copilot-bubble">`;
      if (m.warn) {
        bubble += `<div class="copilot-warn">${escText(m.warn)}</div>`;
      }
      bubble += `<div class="copilot-bubble-text">${escText(m.text)}</div>`;
      if (role === "assistant" && m.diffs && m.diffs.length) {
        bubble += buildDiffsHtml(m.diffs);
      }
      if (role === "assistant" && m.hint) {
        bubble += `<div class="copilot-hint">${escText(m.hint)}</div>`;
      }
      bubble += `</div>`;
      let inner = bubble;
      if (role === "assistant" && m.pills && m.pills.length) {
        inner += buildOpsPillsHtml(m.pills, m.suffix);
      }
      return `<div class="copilot-msg ${escText(role)}">${inner}</div>`;
    });
    if (state.copilot.loading) {
      parts.push(
        `<div class="copilot-msg assistant copilot-typing" aria-label="正在处理">` +
          `<div class="copilot-bubble">` +
          `<span class="copilot-typing-dot"></span>` +
          `<span class="copilot-typing-dot"></span>` +
          `<span class="copilot-typing-dot"></span>` +
          `</div></div>`
      );
    }
    copilotThread.innerHTML = parts.join("");
    scrollCopilotToBottom();
  }

  function renderCopilot() {
    syncCopilotLlmBadge();
    renderCopilotChips();
    renderCopilotThread();
  }

  function syncCopilot() {
    const hasPages = !!(state.data && state.data.pages && state.data.pages.length);
    if (copilotPanel) {
      copilotPanel.hidden = !hasPages;
      copilotPanel.dataset.locked = hasPages && !state.layoutConfirmed ? "1" : "";
    }
    if (copilotLockHint) {
      copilotLockHint.hidden = !hasPages || state.layoutConfirmed;
    }
    syncCopilotInputPlaceholder(state.selectedPath);
    refreshCopilotContextStrip();
    updateSupplementCopilotHint();
    renderCopilot();
  }

  function setCopilotLoading(loading) {
    state.copilot.loading = !!loading;
    if (copilotSend) {
      copilotSend.dataset.loading = loading ? "1" : "";
      copilotSend.textContent = loading ? "…" : COPILOT_SEND_LABEL;
    }
    const blocked = !!(state.copilot.loading || state.copilotEphemeral);
    const canChat = state.layoutConfirmed && !!state.data && !blocked;
    if (copilotSend) copilotSend.disabled = !canChat;
    if (copilotInput) copilotInput.disabled = !canChat;
    renderCopilot();
    updateUndoButton();
  }

  function setPageAiFeedback(msg, kind, opts) {
    if (!msg) return;
    const role = kind === "err" ? "error" : kind === "ok" ? "assistant" : "system";
    addCopilotMessage(role, msg, opts);
  }

  function updateUndoButton() {
    if (!btnPageUndo) return;
    const hasUndo = !!state.pageUndo && state.layoutConfirmed && !!state.data;
    const onUndoPage = hasUndo && state.pageUndo.pageIndex === state.page;
    btnPageUndo.disabled = !hasUndo;
    if (!hasUndo) {
      btnPageUndo.textContent = "撤销本页 AI";
      btnPageUndo.title = "";
      return;
    }
    const n = state.pageUndo.pageIndex + 1;
    if (onUndoPage) {
      btnPageUndo.textContent = "撤销本页 AI";
      btnPageUndo.title = "撤销当前页上一版";
    } else {
      btnPageUndo.textContent = `撤销第 ${n} 页 AI`;
      btnPageUndo.title = `撤销在第 ${n} 页，点此跳转并撤销`;
    }
  }

  function closeHistoryMenu() {
    if (aiHistoryMenu) aiHistoryMenu.removeAttribute("open");
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "status-line" + (kind ? " " + kind : "");
    if (msg && kind !== "err") XHSA11y.announce(msg);
  }

  function escText(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyEtaLabels() {
    const llm = !!state.llmConfigured;
    const map = {
      intent: "即时",
      compose: llm ? "①约 10s + ②约 5s" : "①② 约各 1 秒",
      layout: llm ? "可单页改 · 每次约 3–8 秒" : "可单页改 · 规则即时",
    };
    Object.keys(map).forEach((key) => {
      document.querySelectorAll(`[data-eta="${key}"]`).forEach((el) => {
        el.textContent = map[key];
      });
    });
    if (heroEtaHint) {
      heroEtaHint.textContent = llm
        ? "主路径 2 次 LLM：①写稿 + ②审核；单页改/排版思路/复审另计，会话累计见顶部 pill"
        : "Demo：非完整 AI · ①写稿/②审核约各 1 秒；单页规则改即时";
    }
  }

  function formatMetaTip(meta) {
    if (!meta || typeof meta !== "object") return "";
    const parts = [];
    if (typeof meta.llm_calls === "number") parts.push("LLM×" + meta.llm_calls);
    if (typeof meta.estimated_seconds === "number" && meta.estimated_seconds > 0) {
      parts.push("预估 " + meta.estimated_seconds + "s");
    }
    if (meta.timing && typeof meta.timing.duration_ms === "number") {
      parts.push("耗时 " + formatDurationMs(meta.timing.duration_ms));
    }
    if (meta.step) parts.push(String(meta.step));
    return parts.length ? parts.join(" · ") : "";
  }

  const TIMING_STEP_LABELS = {
    generate: "写稿",
    review: "审核",
    page_revise: "改页",
    layout_ideas: "排版思路",
  };

  function formatDurationMs(ms) {
    if (ms == null || Number.isNaN(ms)) return "—";
    const n = Number(ms);
    if (n < 1000) return n + "ms";
    return (n / 1000).toFixed(1) + "s";
  }

  function pushTimingLog(stepKey, opts) {
    const meta = (opts && opts.meta) || null;
    const timing = meta && meta.timing;
    const mode = (opts && opts.mode) || (meta && meta.mode) || "";
    const ok = !(opts && opts.ok === false);
    const entry = {
      at: new Date().toISOString(),
      step: stepKey,
      stepLabel: TIMING_STEP_LABELS[stepKey] || stepKey,
      duration_ms: timing && typeof timing.duration_ms === "number" ? timing.duration_ms : null,
      mode,
      ok,
      request_id: timing && timing.request_id,
      phases: timing && timing.phases,
    };
    state.timingLog = [entry, ...(state.timingLog || [])].slice(0, 20);
    renderTimingLog();
    scheduleAutosave();
  }

  function renderTimingLog() {
    if (!timingLogList) return;
    const logs = state.timingLog || [];
    if (timingLogPanel) timingLogPanel.hidden = logs.length === 0;
    if (timingLogEmpty) timingLogEmpty.hidden = logs.length > 0;
    timingLogList.innerHTML = logs
      .map((e) => {
        const t = new Date(e.at);
        const ts = t.toLocaleTimeString("zh-CN", { hour12: false });
        const dur = formatDurationMs(e.duration_ms);
        const mode = e.mode || "—";
        const status = e.ok ? "ok" : "fail";
        return `<li class="timing-log-item timing-log-item--${status}"><span class="timing-log-ts">${escText(
          ts
        )}</span> · <span class="timing-log-step">${escText(e.stepLabel)}</span> · <span class="timing-log-dur">${escText(
          dur
        )}</span> · <span class="timing-log-mode">${escText(mode)}</span> · <span class="timing-log-status">${status}</span></li>`;
      })
      .join("");
  }

  function calcProgressPercent(elapsedSec, estimateSec) {
    const est = Math.max(Number(estimateSec) || 10, 1);
    if (elapsedSec <= 0) return 0;
    if (elapsedSec <= est) return Math.min((elapsedSec / est) * 90, 90);
    const over = elapsedSec - est;
    const creep = 90 + 5 * (1 - Math.exp(-over / Math.max(est * 0.4, 2)));
    return Math.min(creep, 95);
  }

  function progressCaptionText() {
    if (state.composeSub === "reviewing") return "② 审核中…";
    if (state.composeSub === "drafting") return "① 写稿中…";
    const label = flowStatusLabel ? (flowStatusLabel.textContent || "").trim() : "";
    if (!label) return "处理中…";
    return /…$/.test(label) ? label : label + "…";
  }

  function applyProgressBars(percent, opts) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    const over = !!(opts && opts.overEstimate);
    const completing = !!(opts && opts.completing);
    const caption = progressCaptionText();
    const elapsedSec = Math.floor((Date.now() - elapsedStartedAt) / 1000);
    document.querySelectorAll(".flow-progress").forEach((bar) => {
      const fill = bar.querySelector(".flow-progress-fill");
      if (fill) fill.style.width = pct + "%";
      bar.setAttribute("aria-valuenow", String(pct));
      bar.setAttribute("aria-label", caption);
      bar.classList.toggle("flow-progress--over", over && !completing);
      bar.classList.toggle("flow-progress--complete", completing);
      const cap = bar.querySelector(".flow-progress-caption");
      if (cap) cap.textContent = caption;
      const elapsedEl = bar.querySelector(".flow-progress-elapsed");
      if (elapsedEl) {
        if (elapsedSec >= 4 && !completing) {
          elapsedEl.textContent = elapsedSec + "s";
          elapsedEl.hidden = false;
        } else {
          elapsedEl.hidden = true;
        }
      }
    });
  }

  function resetProgressBars() {
    document.querySelectorAll(".flow-progress").forEach((bar) => {
      bar.classList.remove("flow-progress--over", "flow-progress--complete");
    });
    applyProgressBars(0);
  }

  function completeProgressBars() {
    applyProgressBars(100, { completing: true });
  }

  function stopElapsed() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
    if (flowStatusEl) flowStatusEl.hidden = true;
    document.body.classList.remove("flow-busy");
    document.querySelectorAll(".flow-step.busy").forEach((el) => el.classList.remove("busy"));
    if (!progressWrap || !progressWrap.classList.contains("active")) {
      resetProgressBars();
    }
  }

  function tickElapsedDisplay(estimatedSeconds) {
    const est =
      typeof estimatedSeconds === "number" && estimatedSeconds > 0
        ? estimatedSeconds
        : currentEstimatedSeconds;
    const s = Math.floor((Date.now() - elapsedStartedAt) / 1000);
    applyProgressBars(calcProgressPercent(s, est), { overEstimate: s > est });
  }

  function startElapsed(label, estimatedSeconds) {
    if (flowStatusLabel) flowStatusLabel.textContent = label || "处理中…";
    currentEstimatedSeconds =
      typeof estimatedSeconds === "number" && estimatedSeconds > 0
        ? estimatedSeconds
        : state.llmConfigured
          ? 10
          : 1;
    if (flowStatusEl) flowStatusEl.hidden = false;
    document.body.classList.add("flow-busy");
    elapsedStartedAt = Date.now();
    resetProgressBars();
    tickElapsedDisplay(currentEstimatedSeconds);
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = setInterval(() => tickElapsedDisplay(currentEstimatedSeconds), 1000);
  }

  function setBusyStage(stageText, label, opts) {
    progressWrap.classList.add("active");
    if (progressStage) progressStage.textContent = stageText || "";
    if (progressLabel) progressLabel.textContent = label || "处理中…";
    const meta = (opts && opts.metaTip) || "";
    if (progressMeta) progressMeta.textContent = meta;
  }

  function clearProgress() {
    completeProgressBars();
    progressWrap.classList.remove("active");
    progressWrap.classList.remove("busy");
    if (progressStage) progressStage.textContent = "";
    if (progressLabel) progressLabel.textContent = "";
    if (progressMeta) progressMeta.textContent = "";
    window.setTimeout(() => {
      stopElapsed();
      hideGenSkeleton();
    }, 260);
  }

  function updateFlowSub(sub) {
    state.composeSub = sub || "";
    if (!flowSub2) return;
    if (sub === "drafting") {
      flowSub2.hidden = false;
      flowSub2.textContent = "子状态 · ①写稿";
    } else if (sub === "reviewing") {
      flowSub2.hidden = false;
      flowSub2.textContent = "子状态 · ②审核";
    } else {
      flowSub2.hidden = true;
      flowSub2.textContent = "";
    }
  }

  function showGenSkeleton(estimatedSeconds) {
    if (!genSkeleton) return;
    state.generating = true;
    genSkeleton.hidden = false;
    if (emptyHint) emptyHint.classList.add("hidden");
    tickElapsedDisplay(estimatedSeconds);
  }

  function hideGenSkeleton() {
    state.generating = false;
    if (genSkeleton) genSkeleton.hidden = true;
  }

  function setFlowStep(step, opts) {
    const busy = !!(opts && opts.busy);
    const statusText = (opts && opts.status) || "";
    const stageText = (opts && opts.stage) || "";
    const estimatedSeconds = opts && opts.estimatedSeconds;
    const metaTip = (opts && opts.metaTip) || "";
    const composeSub = opts && opts.composeSub;
    state.step = step;
    if (composeSub !== undefined) updateFlowSub(composeSub);
    else if (step !== 2) updateFlowSub("");
    document.querySelectorAll(".flow-step").forEach((el) => {
      const n = +el.dataset.step;
      el.classList.toggle("active", n === step);
      el.classList.toggle("done", n < step);
      el.classList.toggle("busy", busy && n === step);
    });
    if (busy && statusText) {
      progressWrap.classList.add("busy");
      startElapsed(statusText, estimatedSeconds);
      setBusyStage(stageText || statusText, statusText, { metaTip });
      // Busy detail lives in progress card + flow bar; avoid duplicating in status-line.
      setStatus("");
    } else if (!busy) {
      progressWrap.classList.remove("busy");
      if (progressWrap.classList.contains("active")) {
        if (elapsedTimer) {
          clearInterval(elapsedTimer);
          elapsedTimer = null;
        }
        document.querySelectorAll(".flow-step.busy").forEach((el) => el.classList.remove("busy"));
        if (flowStatusEl) flowStatusEl.hidden = true;
        document.body.classList.remove("flow-busy");
      } else {
        stopElapsed();
      }
    }
  }

  function updateModeBanner() {
    if (!modeBanner) return;
    const mode = state.runMode || state.serviceMode || "";
    const warnings = state.warnings || [];
    const bits = [];
    if (mode === "demo_fallback") {
      bits.push("已降级为 Demo 样例稿（模型不可用或失败）。请当草稿看，勿当作已完美审核通过。");
    } else if (mode === "demo" || (!state.llmConfigured && mode !== "llm")) {
      bits.push("当前为 Demo 模式：本地样例生成/规则审核，不是完整 AI 质检。");
    } else if (mode === "rules_fallback") {
      bits.push("最近一次改页走了规则兜底（非 LLM 深度改写）。复杂润色请配置 API Key 后重试。");
    }
    if (state.review && state.review.mode && state.review.mode !== "llm" && mode === "llm") {
      bits.push("本轮审核走规则路径（非 LLM 深度审核）。");
    }
    warnings.forEach((w) => {
      const t = String(w || "").trim();
      if (!t) return;
      // outline 与 pages 不一致是预期行为（以 pages 为准），勿当故障黄条
      if (/outline\s*校验|outline\.type/i.test(t)) return;
      bits.push(t);
    });
    if (!bits.length) {
      modeBanner.hidden = true;
      modeBanner.textContent = "";
      modeBanner.className = "mode-banner";
      return;
    }
    modeBanner.hidden = false;
    modeBanner.className =
      "mode-banner" +
      (mode === "demo_fallback" || mode === "rules_fallback" || warnings.length ? " warn" : " info");
    modeBanner.textContent = bits.join(" ");
  }

  function hideExportChoice() {
    state.exportChoiceOpen = false;
    if (exportRereviewBar) exportRereviewBar.hidden = true;
  }

  function showExportChoice() {
    state.exportChoiceOpen = true;
    if (exportRereviewBar) exportRereviewBar.hidden = false;
    if (needsRereviewEl) needsRereviewEl.hidden = false;
  }

  function updateExportButton() {
    const ready = !!(state.layoutConfirmed && state.data && state.data.pages);
    btnExport.disabled = !ready || state.exporting || state.exportChoiceOpen;
    btnExport.classList.toggle("ready", ready && !state.exportChoiceOpen);
    if (packHint) {
      if (!state.data) packHint.textContent = "生成后可预览，确认后导出";
      else if (!state.layoutConfirmed) packHint.textContent = "可先翻页 · 通过或看完后可改页/导出";
      else if (state.needsRereview) packHint.textContent = "已改需复审 · 导出时内联选择";
      else packHint.textContent = "预览满意后导出发布包";
      packHint.classList.toggle(
        "pack-hint--ready",
        ready && !state.needsRereview && !state.exportChoiceOpen
      );
    }
  }

  function markNeedsRereview(flag) {
    state.needsRereview = !!flag;
    if (needsRereviewEl) needsRereviewEl.hidden = !flag;
    if (!flag) hideExportChoice();
    updateExportButton();
  }

  function collapseIntentPanel(collapsed) {
    state.intentCollapsed = !!collapsed;
    if (heroSection) heroSection.classList.toggle("is-collapsed", state.intentCollapsed);
    if (intentSummary) intentSummary.hidden = !state.intentCollapsed;
    if (state.intentCollapsed && intentSummaryText) {
      const t = (state.intent || (intentEl && intentEl.value) || "").trim();
      intentSummaryText.textContent = t || "（空意图）";
    }
  }

  function markPageViewed(idx) {
    if (idx == null || idx < 0) return;
    state.viewedPages.add(idx);
  }

  function allPagesViewed() {
    const pages = (state.data && state.data.pages) || [];
    if (!pages.length) return false;
    for (let i = 0; i < pages.length; i++) {
      if (!state.viewedPages.has(i)) return false;
    }
    return true;
  }

  function canUnlockLayout() {
    if (!state.data || !state.review) return false;
    const v = state.review.verdict || "warn";
    const hasError = (state.review.issues || []).some((i) => i.severity === "error");
    if (hasError || v === "fail") return false;
    if (v === "pass") return true;
    if (allPagesViewed()) return true;
    return false;
  }

  function syncStickyCta() {
    if (!stickyCta || !btnConfirmLayout) return;
    const inReview = !!(state.data && state.review && !state.layoutConfirmed);
    const v = state.review && state.review.verdict;
    // pass / 翻完全部：已自动解锁；warn 未看完才吸顶确认
    const show = inReview && v === "warn" && !allPagesViewed();
    stickyCta.hidden = !show;
    if (show) {
      btnConfirmLayout.disabled = false;
      btnConfirmLayout.textContent = "确认继续排版";
    }
  }

  function renderReviseChips() {
    renderCopilotChips();
  }

  function pageBrief(page, idx) {
    if (!page || typeof page !== "object") return `第${idx + 1}页 · 无效`;
    const t = page.type || "?";
    let detail = "";
    if (t === "cover") detail = String(page.title || "").replace(/\n/g, " ").slice(0, 36);
    else if (t === "points") {
      const n = (page.items || []).length;
      detail = `${page.title || "要点"} · ${n} 条`;
    } else if (t === "timeline") {
      const n = (page.steps || []).length;
      detail = `${page.title || "时间线"} · ${n} 步`;
    } else if (t === "compare") {
      const n = (page.rows || []).length;
      detail = `${page.title || "对比"} · ${n} 行`;
    } else if (t === "card") detail = String(page.title || page.body || "").slice(0, 36);
    else if (t === "quote") detail = String(page.text || "").replace(/\n/g, " ").slice(0, 36);
    else if (t === "summary") detail = `${page.title || "总结"} · ${(page.items || []).length} 条`;
    else if (t === "ending") detail = String(page.title || page.desc || "结尾").slice(0, 36);
    else if (t === "photo" || t === "gallery") detail = String(page.title || "配图").slice(0, 36);
    else if (t === "free") detail = String(page.title || page.body || "展开").slice(0, 36);
    else detail = String(page.title || page.no || TYPE_LABELS[t] || t).slice(0, 36);
    return detail;
  }

  function clipExcerpt(s, max) {
    const t = String(s || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return "";
    const n = max || 96;
    return t.length > n ? t.slice(0, n) + "…" : t;
  }

  function pageTextExcerpt(page) {
    if (!page || typeof page !== "object") return "";
    const parts = [];
    const push = (v) => {
      const s = clipExcerpt(v, 72);
      if (s) parts.push(s);
    };
    push(page.title);
    push(page.subtitle);
    push(page.kicker);
    push(page.body);
    push(page.text);
    push(page.desc);
    push(page.cta);
    if (Array.isArray(page.items)) {
      page.items.slice(0, 2).forEach((it) => {
        if (typeof it === "string") push(it);
        else if (it && typeof it === "object") push(it.title || it.label || it.body || it.text);
      });
    }
    if (Array.isArray(page.steps)) {
      page.steps.slice(0, 2).forEach((st) => {
        if (typeof st === "string") push(st);
        else if (st && typeof st === "object") push(st.title || st.label || st.body);
      });
    }
    if (Array.isArray(page.paragraphs)) page.paragraphs.slice(0, 2).forEach(push);
    if (Array.isArray(page.bullets)) page.bullets.slice(0, 2).forEach(push);
    if (Array.isArray(page.rows) && page.rows[0] && typeof page.rows[0] === "object") {
      const r = page.rows[0];
      const vals = Array.isArray(r.values) ? r.values : [];
      push([r.dim || r.label || r.name, ...vals].filter(Boolean).join(" / "));
    }
    return clipExcerpt(parts.join(" · "), 110);
  }

  function parseIssuePageIndex(where, message) {
    const text = `${where || ""} ${message || ""}`;
    const m = text.match(/第\s*(\d+)\s*页/);
    if (m) {
      const n = parseInt(m[1], 10) - 1;
      if (Number.isFinite(n) && n >= 0) return n;
    }
    const pages = (state.data && state.data.pages) || [];
    const typeRe =
      /\b(cover|chapter|points|timeline|card|quote|compare|summary|ending|photo|gallery|composite|free)\b/i;
    const tm = String(where || "").match(typeRe) || String(message || "").match(typeRe);
    if (tm && pages.length) {
      const t = tm[1].toLowerCase();
      const idx = pages.findIndex((p) => p && p.type === t);
      if (idx >= 0) return idx;
    }
    const w = String(where || "").trim().toLowerCase();
    if (w === "title" || w === "caption") return pages.length ? 0 : null;
    return null;
  }

  function extractIssueExcerpt(where, message) {
    const data = state.data;
    if (!data) return "";
    const w = String(where || "").trim();
    const wl = w.toLowerCase();
    if (wl === "title") return clipExcerpt(state.title || data.title || "", 80);
    if (wl === "caption") return clipExcerpt(state.caption || data.caption || "", 110);
    if (wl === "结构" || wl === "pages" || wl === "data.pages") {
      const pages = data.pages || [];
      return clipExcerpt(
        pages
          .map((p, i) => {
            const zh = TYPE_LABELS[p && p.type] || (p && p.type) || "?";
            const tip = clipExcerpt((p && (p.title || p.text || p.body)) || "", 18);
            return `P${i + 1}${zh}${tip ? "「" + tip + "」" : ""}`;
          })
          .join(" · "),
        120
      );
    }
    const pageIdx = parseIssuePageIndex(where, message);
    const pages = data.pages || [];
    if (pageIdx == null || !pages[pageIdx]) return "";
    const page = pages[pageIdx];
    const loc = `${w} ${message || ""}`;
    const itemM = loc.match(/item\s*(\d+)/i) || loc.match(/第\s*(\d+)\s*条/);
    const stepM = loc.match(/step\s*(\d+)/i) || loc.match(/步骤\s*(\d+)/);
    const rowM = loc.match(/row\s*(\d+)/i) || loc.match(/第\s*(\d+)\s*行/);
    if (itemM && Array.isArray(page.items)) {
      const it = page.items[parseInt(itemM[1], 10) - 1];
      if (typeof it === "string") return clipExcerpt(it);
      if (it && typeof it === "object") {
        return clipExcerpt([it.title || it.label, it.body || it.text].filter(Boolean).join(" · "));
      }
    }
    if (stepM && Array.isArray(page.steps)) {
      const st = page.steps[parseInt(stepM[1], 10) - 1];
      if (typeof st === "string") return clipExcerpt(st);
      if (st && typeof st === "object") {
        return clipExcerpt([st.title || st.label, st.body].filter(Boolean).join(" · "));
      }
    }
    if (rowM && Array.isArray(page.rows)) {
      const row = page.rows[parseInt(rowM[1], 10) - 1];
      if (row && typeof row === "object") {
        const vals = Array.isArray(row.values) ? row.values : [];
        return clipExcerpt([row.dim || row.label || row.name, ...vals].filter(Boolean).join(" / "));
      }
    }
    return pageTextExcerpt(page);
  }

  function normalizeReviewEntries(issues, sugs) {
    const entries = [];
    (issues || []).forEach((it) => {
      const cat = it.category === "layout" ? "layout" : "copy";
      const sevTag =
        cat === "layout"
          ? it.severity === "error"
            ? "版式"
            : it.severity === "info"
              ? "版式·提示"
              : "版式"
          : it.severity === "error"
            ? "错误"
            : it.severity === "info"
              ? "提示"
              : "警告";
      const pageIdx =
        typeof it.page_index === "number" && it.page_index >= 0
          ? it.page_index
          : parseIssuePageIndex(it.where, it.message);
      entries.push({
        sev: it.severity === "error" ? "error" : "warn",
        tag: sevTag,
        category: cat,
        message: it.message || "",
        fixHint: it.fix_hint || "",
        where: it.where || "",
        pageIdx,
        excerpt: extractIssueExcerpt(it.where, it.message),
      });
    });
    (sugs || []).forEach((s) => {
      const text = typeof s === "string" ? s : String(s || "");
      entries.push({
        sev: "warn",
        tag: "建议",
        message: text,
        where: "",
        pageIdx: parseIssuePageIndex("", text),
        excerpt: extractIssueExcerpt("", text),
      });
    });
    return entries;
  }

  function groupReviewEntries(entries) {
    const groups = [];
    const excerptIndex = new Map();
    entries.forEach((entry, idx) => {
      const ex = entry.excerpt;
      const groupKey = ex ? `${entry.where || ""}|${ex}` : `__solo_${idx}`;
      if (ex && excerptIndex.has(groupKey)) {
        const g = groups[excerptIndex.get(groupKey)];
        g.entries.push(entry);
        if (entry.sev === "error") g.sev = "error";
        if (entry.pageIdx != null) g.pageIdx = entry.pageIdx;
        if (!g.where && entry.where) g.where = entry.where;
      } else {
        const g = {
          excerpt: ex,
          sev: entry.sev,
          pageIdx: entry.pageIdx,
          where: entry.where,
          entries: [entry],
        };
        groups.push(g);
        if (ex) excerptIndex.set(groupKey, groups.length - 1);
      }
    });
    return groups;
  }

  function renderIssueGroupHtml(group) {
    const clickable = group.pageIdx != null;
    const pageAttr = clickable ? ` data-page-index="${group.pageIdx}"` : "";
    const cls = `issue-item ${group.sev}${clickable ? " clickable" : ""}`;
    const excerptHtml = group.excerpt
      ? `<blockquote class="issue-excerpt">「${escText(group.excerpt)}」</blockquote>`
      : "";
    const whereLabel = group.where ? escText(group.where) : "";
    const whereHtml = clickable
      ? `<span class="where">${whereLabel ? whereLabel + " · " : ""}点此预览第 ${group.pageIdx + 1} 页</span>`
      : whereLabel
        ? `<span class="where">${whereLabel}</span>`
        : "";
    let bodyHtml;
    if (group.entries.length === 1) {
      const it = group.entries[0];
      const fixHtml = it.fixHint
        ? `<span class="issue-fix-hint">${escText(it.fixHint)}</span>`
        : "";
      const sevCls = it.category === "layout" ? "sev layout" : "sev";
      bodyHtml = `<span class="${sevCls}">${it.tag}</span>${escText(it.message)}${fixHtml}`;
      return `<div class="${cls}"${pageAttr} role="${clickable ? "button" : "listitem"}" tabindex="${clickable ? "0" : "-1"}">${bodyHtml}${excerptHtml}${whereHtml}</div>`;
    }
    const items = group.entries
      .map((it) => {
        const fixHtml = it.fixHint
          ? `<span class="issue-fix-hint">${escText(it.fixHint)}</span>`
          : "";
        const sevCls = it.category === "layout" ? `sev layout ${it.sev}` : `sev ${it.sev}`;
        return `<li><span class="${sevCls}">${it.tag}</span>${escText(it.message)}${fixHtml}</li>`;
      })
      .join("");
    bodyHtml = `<ul class="issue-messages">${items}</ul>`;
    return `<div class="${cls}"${pageAttr} role="${clickable ? "button" : "listitem"}" tabindex="${clickable ? "0" : "-1"}">${excerptHtml}${bodyHtml}${whereHtml}</div>`;
  }

  let pageFlashTimer = null;
  function focusReviewPage(pageIndex) {
    const pages = (state.data && state.data.pages) || [];
    if (pageIndex == null || pageIndex < 0 || pageIndex >= pages.length) return;
    state.page = pageIndex;
    renderPreview();
    if (!preview) return;
    preview.classList.remove("page-flash");
    // restart CSS animation
    void preview.offsetWidth;
    preview.classList.add("page-flash");
    if (pageFlashTimer) clearTimeout(pageFlashTimer);
    pageFlashTimer = setTimeout(() => {
      preview.classList.remove("page-flash");
      pageFlashTimer = null;
    }, 1400);
  }

  function renderLogicSummary() {
    const list = $("#logic-summary");
    const themeEl = $("#logic-theme");
    if (!list) return;
    const lines =
      (state.logicSummary && state.logicSummary.length && state.logicSummary) ||
      (state.data && state.data.logic_summary) ||
      [];
    const theme = state.theme || (state.data && state.data.theme) || "";
    if (themeEl) {
      if (theme) {
        themeEl.hidden = false;
        themeEl.textContent = "主线：" + theme;
      } else {
        themeEl.hidden = true;
        themeEl.textContent = "";
      }
    }
    if (!lines.length) {
      list.innerHTML = `<li class="logic-empty">生成后显示结构大纲</li>`;
      return;
    }
    list.innerHTML = lines.map((line) => `<li>${escText(line)}</li>`).join("");
  }

  function renderPageSummary() {
    const box = $("#page-summary");
    if (!box) return;
    const pages = (state.data && state.data.pages) || [];
    if (!pages.length) {
      box.innerHTML = `<div class="page-summary-item">暂无页面</div>`;
      return;
    }
    box.innerHTML = pages
      .map((p, i) => {
        const role = p.role || "";
        const typeZh = TYPE_LABELS[p.type] || p.type || "?";
        const head = role ? `P${i + 1} · ${role}` : `P${i + 1} · ${typeZh}`;
        return `<div class="page-summary-item"><strong>${escText(head)}</strong><br>${escText(pageBrief(p, i))}</div>`;
      })
      .join("");
  }

  function syncManuscriptPanel() {
    if (!manuscriptPanel) return;
    const show = !!(state.data && state.data.pages && state.data.pages.length);
    manuscriptPanel.hidden = !show;
  }

  function focusManuscriptField(pageIndex, path) {
    if (pageIndex == null || pageIndex < 0) return;
    const pages = (state.data && state.data.pages) || [];
    if (pageIndex >= pages.length) return;
    const samePage = state.page === pageIndex;
    state.page = pageIndex;
    state.layoutPreview = null;
    if (!samePage) renderPreview();
    else renderManuscript();
    if (!path || !preview) return;
    const tryFocus = () => {
      const el = preview.querySelector(`[data-xhs-path="${CSS.escape(path)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (state.layoutConfirmed && !state.layoutPreview) {
        el.click();
      } else {
        preview.classList.remove("page-flash");
        void preview.offsetWidth;
        preview.classList.add("page-flash");
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(tryFocus));
  }

  function applyManuscriptFieldEdit(pageIndex, path, value) {
    if (!state.data || !state.layoutConfirmed || !path) return;
    const pages = state.data.pages || [];
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    const op = XHSFieldPath.pathToOp(path, value);
    if (!op) return;
    const viewPage = state.page;
    pushHistory("改字");
    const nextPages = state.data.pages.slice();
    const { page } = XHSOps.applyPageOps(nextPages[pageIndex], [op]);
    nextPages[pageIndex] = page;
    state.data = { ...state.data, pages: nextPages, _user_edited: true };
    state.page = viewPage;
    markNeedsRereview(true);
    renderPageSummary();
    syncJson();
    renderPreview();
    scheduleAutosave();
    setStatus("已改字 · 已改需复审", "ok");
  }

  function bindManuscriptListEvents() {
    if (!manuscriptList || manuscriptList.dataset.bound) return;
    manuscriptList.dataset.bound = "1";

    manuscriptList.addEventListener("click", (e) => {
      const head = e.target.closest(".manuscript-page-head");
      if (head) {
        focusReviewPage(+head.dataset.page);
        return;
      }
      const el = e.target.closest(".manuscript-field-text[data-path]");
      if (!el || el.isContentEditable) return;
      focusManuscriptField(+el.dataset.page, el.dataset.path);
    });

    manuscriptList.addEventListener("keydown", (e) => {
      const el = e.target.closest(".manuscript-field-text[data-path]");
      if (!el || el.isContentEditable) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        focusManuscriptField(+el.dataset.page, el.dataset.path);
      }
    });

    manuscriptList.addEventListener("keydown", (e) => {
      const el = e.target.closest(".manuscript-field-text.is-editable[data-path]");
      if (!el) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
    });

    manuscriptList.addEventListener("focusin", (e) => {
      const el = e.target.closest(".manuscript-field-text.is-editable[data-path]");
      if (!el) return;
      el.dataset.initial = el.textContent || "";
    });

    manuscriptList.addEventListener("focusout", (e) => {
      const el = e.target.closest(".manuscript-field-text.is-editable[data-path]");
      if (!el) return;
      const next = el.textContent || "";
      const prev = el.dataset.initial || "";
      if (next.trim() === prev.trim()) return;
      applyManuscriptFieldEdit(+el.dataset.page, el.dataset.path, next.trim());
    });
  }

  function renderManuscript() {
    bindManuscriptListEvents();
    syncManuscriptPanel();
    if (!manuscriptList) return;
    const pages = (state.data && state.data.pages) || [];
    if (!pages.length) {
      manuscriptList.innerHTML = `<div class="manuscript-empty">生成后显示全文</div>`;
      if (manuscriptMeta) manuscriptMeta.hidden = true;
      return;
    }

    const title = (state.title || state.data.title || "").trim();
    const caption = (state.caption || state.data.caption || "").trim();
    if (manuscriptMeta) {
      if (title || caption) {
        manuscriptMeta.hidden = false;
        const bits = [];
        if (title) bits.push(`<div><strong>发帖标题</strong><br>${escText(title)}</div>`);
        if (caption) bits.push(`<div style="margin-top:6px"><strong>正文+话题</strong><br>${escText(caption)}</div>`);
        manuscriptMeta.innerHTML = bits.join("");
      } else {
        manuscriptMeta.hidden = true;
        manuscriptMeta.innerHTML = "";
      }
    }

    const sections = XHSManuscript.extractAll(pages, TYPE_LABELS);
    const editable = !!state.layoutConfirmed;
    manuscriptList.innerHTML = sections
      .map((sec) => {
        const active = sec.index === state.page ? " active" : "";
        const fields = sec.blocks
          .filter((b) => String(b.text ?? "").trim())
          .map((b) => {
            const pathAttr = b.path ? ` data-path="${escText(b.path)}"` : "";
            const editCls = editable && b.path ? " is-editable" : "";
            const editAttr =
              editable && b.path
                ? ` contenteditable="true" spellcheck="false" data-page="${sec.index}"${pathAttr}`
                : pathAttr
                  ? ` data-page="${sec.index}"${pathAttr} role="button" tabindex="0"`
                  : "";
            return `<div class="manuscript-field"><div class="manuscript-field-label">${escText(b.label)}</div><div class="manuscript-field-text${editCls}"${editAttr}>${escText(b.text)}</div></div>`;
          })
          .join("");
        return `<article class="manuscript-page${active}" data-page="${sec.index}"><button type="button" class="manuscript-page-head" data-page="${sec.index}" aria-label="${escText(sec.pageLabel)}，跳转预览"><span class="manuscript-page-label">${escText(sec.pageLabel)}</span></button><div class="manuscript-page-body">${fields}</div></article>`;
      })
      .join("");
  }

  function renderReviewIssueBlocks(issues, sugs) {
    const layoutIssues = (issues || []).filter((i) => i.category === "layout");
    const copyIssues = (issues || []).filter((i) => i.category !== "layout");
    const blocks = [];
    if (!issues.length && !sugs.length) {
      return [`<div class="issue-item">未发现明显问题</div>`];
    }
    if (layoutIssues.length) {
      blocks.push(
        `<div class="issue-section-head">版式问题 <span class="issue-section-count">${layoutIssues.length}</span></div>`
      );
      groupReviewEntries(normalizeReviewEntries(layoutIssues, [])).forEach((group) => {
        blocks.push(renderIssueGroupHtml(group));
      });
    }
    if (copyIssues.length || sugs.length) {
      if (layoutIssues.length) {
        blocks.push(`<div class="issue-section-head">文案问题</div>`);
      }
      groupReviewEntries(normalizeReviewEntries(copyIssues, sugs)).forEach((group) => {
        blocks.push(renderIssueGroupHtml(group));
      });
    }
    return blocks;
  }

  function renderReviewUI() {
    const verdictEl = $("#review-verdict");
    const issuesEl = $("#review-issues");
    const forceHint = $("#review-force-hint");
    const r = state.review;
    if (!r) {
      verdictEl.className = "review-verdict pending";
      verdictEl.textContent = "等待审核…";
      issuesEl.innerHTML = "";
      if (reviewLayoutBadge) {
        reviewLayoutBadge.hidden = true;
        reviewLayoutBadge.textContent = "";
      }
      btnApplyReview.disabled = true;
      btnRerunReview.disabled = !state.data;
      if (btnConfirmLayout) btnConfirmLayout.disabled = true;
      syncStickyCta();
      return;
    }

    const v = r.verdict || "warn";
    const mode = r.mode || "";
    const isRule = mode && mode !== "llm";
    const labels = {
      pass: isRule
        ? "规则审核通过 · 已可改页/导出（非深度 AI 质检）"
        : "审核通过 · 已可改页/导出",
      warn: allPagesViewed()
        ? "存在警告 · 已看完全部页，可改页/导出"
        : "存在警告 · 请确认继续，或翻完所有页",
      fail: "未通过 · 请先按意见改写",
    };
    verdictEl.className = "review-verdict " + v;
    const modeTip =
      mode === "llm" ? "（AI 审核）" : mode ? "（规则审核）" : "";
    verdictEl.textContent = (labels[v] || v) + modeTip;

    const issues = r.issues || [];
    const sugs = r.suggestions || [];
    const layoutWarns = issues.filter(
      (i) => i.category === "layout" && (i.severity === "warn" || i.severity === "error")
    ).length;
    if (reviewLayoutBadge) {
      if (layoutWarns > 0) {
        reviewLayoutBadge.hidden = false;
        reviewLayoutBadge.textContent = `版式 ${layoutWarns}`;
        reviewLayoutBadge.title = `${layoutWarns} 条版式提醒，点击列表项可跳转对应页`;
      } else {
        reviewLayoutBadge.hidden = true;
        reviewLayoutBadge.textContent = "";
        reviewLayoutBadge.title = "";
      }
    }
    const blocks = renderReviewIssueBlocks(issues, sugs);
    issuesEl.innerHTML = blocks.join("");
    issuesEl.querySelectorAll(".issue-item.clickable").forEach((el) => {
      const go = () => {
        const idx = parseInt(el.getAttribute("data-page-index"), 10);
        if (Number.isFinite(idx)) focusReviewPage(idx);
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          go();
        }
      });
    });

    const hasError = issues.some((i) => i.severity === "error");
    btnApplyReview.disabled = !issues.length && !sugs.length;
    btnRerunReview.disabled = false;
    if (btnConfirmLayout) {
      btnConfirmLayout.disabled = hasError || v === "fail";
    }
    if (forceHint) {
      if (v === "warn" && !allPagesViewed() && !state.layoutConfirmed) {
        forceHint.hidden = false;
        forceHint.textContent =
          "存在警告：点「确认继续排版」，或翻完所有页后自动解锁改页/导出。";
        if (btnConfirmLayout) btnConfirmLayout.disabled = false;
      } else if (v === "fail") {
        forceHint.hidden = false;
        forceHint.textContent =
          "存在内容错误：请先「按意见改写」或手动改标题/正文后「重新审核」。";
      } else {
        forceHint.hidden = true;
      }
    }
    syncStickyCta();
    updateModeBanner();
  }

  function syncPostGenPanel() {
    if (!postGenPanel) return;
    const hasPages = !!(state.data && state.data.pages && state.data.pages.length);
    postGenPanel.hidden = !hasPages;
  }

  function showReviewPanel() {
    if (reviewPanel) reviewPanel.hidden = false;
    syncPostGenPanel();
    collapseIntentPanel(true);
  }

  function showPostGen() {
    syncPostGenPanel();
    syncCopilot();
    syncStickyCta();
  }

  async function copyText(text, btn) {
    const t = (text || "").trim();
    if (!t) {
      setStatus("没有可复制的内容", "err");
      return;
    }
    try {
      await navigator.clipboard.writeText(t);
      const old = btn ? btn.textContent : "";
      if (btn) {
        btn.textContent = "已复制";
        setTimeout(() => {
          btn.textContent = old || "复制";
        }, 1200);
      }
      setStatus("已复制到剪贴板", "ok");
    } catch {
      setStatus("复制失败，请手动选择文本", "err");
    }
  }

  function currentThemeMeta() {
    const themes = window.XHS_THEMES || {};
    return themes[state.style] || Object.values(themes)[0] || { id: "ins", title: "简约 INS", desc: "" };
  }

  function renderThemeRecommend() {
    if (!themeRecommend) return;
    const t = currentThemeMeta();
    themeRecommend.innerHTML = `<div class="theme-card active recommended"><div class="t">推荐 · ${escText(t.title)}</div><div class="d">${escText(t.desc || "")}</div></div>`;
    if (btnThemeMore) {
      btnThemeMore.textContent = state.themeExpanded ? "收起风格" : "换风格";
    }
  }

  function renderThemeGrid() {
    renderThemeRecommend();
    if (!themeGrid) return;
    themeGrid.hidden = !state.themeExpanded;
    const themes = window.XHS_THEMES || {};
    themeGrid.innerHTML = Object.values(themes)
      .map(
        (t) =>
          `<button type="button" class="theme-card${t.id === state.style ? " active" : ""}" data-style="${t.id}"><div class="t">${escText(t.title)}</div><div class="d">${escText(t.desc)}</div></button>`
      )
      .join("");
    themeGrid.querySelectorAll(".theme-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.style = btn.dataset.style;
        renderThemeGrid();
        XHSEngine.applyTheme(state.style, window.XHS_THEMES);
        if (state.data) {
          state.data = { ...state.data, style: state.style };
          renderPreview();
          scheduleAutosave();
        }
      });
    });
  }

  function updatePreviewScale() {
    const wrap = $("#preview-wrap");
    if (!wrap) return;
    // 尽量占满右侧可视高度（仅留少量内边距），不改导出像素
    const pad = 12;
    const scale = Math.min(
      (wrap.clientWidth - pad) / PAGE_W,
      (wrap.clientHeight - pad) / PAGE_H
    );
    const gapY = (1 - scale) * PAGE_H;
    const gapX = (1 - scale) * PAGE_W;
    preview.style.transform = `scale(${scale})`;
    preview.style.transformOrigin = "center center";
    preview.style.marginTop = `${-gapY / 2}px`;
    preview.style.marginBottom = `${-gapY / 2}px`;
    preview.style.marginLeft = `${-gapX / 2}px`;
    preview.style.marginRight = `${-gapX / 2}px`;
  }

  function applyHookToCover(h) {
    if (!state.data || !state.data.pages || !state.data.pages[0]) return;
    if (state.data.pages[0].type === "cover") {
      state.data.pages[0].title = h.replace(/｜/g, "\n").replace(/\|/g, "\n");
    }
    state.title = h.replace(/\n/g, " ").trim();
    if (titleEl) titleEl.value = state.title;
    if (state.data) renderPreview();
    syncJson();
    markNeedsRereview(true);
    setStatus("已应用到标题 / 封面（已改需复审）", "ok");
  }

  function renderHooks() {
    if (!hooksEl) return;
    if (!state.hooks || !state.hooks.length) {
      hooksEl.innerHTML = `<div class="hook" style="cursor:default">生成后显示标题候选</div>`;
      return;
    }
    hooksEl.innerHTML = state.hooks
      .map((h) => {
        const active = h === state.title ? " active" : "";
        return `<button type="button" class="hook${active}" data-hook="${encodeURIComponent(h)}">${escText(h)}</button>`;
      })
      .join("");
    hooksEl.querySelectorAll(".hook").forEach((el) => {
      el.addEventListener("click", () => {
        const h = decodeURIComponent(el.dataset.hook || "");
        applyHookToCover(h);
        renderHooks();
      });
    });
  }

  function syncJson() {
    if (jsonView) jsonView.value = state.data ? JSON.stringify(state.data, null, 2) : "";
  }

  function renderPreview() {
    XHSWysiwyg.unbind();
    if (state.layoutPreview) {
      preview.classList.add("layout-preview-on");
    } else {
      preview.classList.remove("layout-preview-on");
    }
    // 审时即可看图：有 data 就渲染；未确认排版 = 只读翻页，禁用高危编辑/导出
    if (!state.data || !state.data.pages || !state.data.pages.length) {
      preview.innerHTML = "";
      renderManuscript();
      if (!state.generating) {
        emptyHint.classList.remove("hidden");
        emptyHint.innerHTML =
          "输入意图，点「生成并审核」<br>写意图 → 出稿审核 → 改页导出";
      }
      btnExport.disabled = true;
      btnExport.classList.remove("ready");
      btnPrev.disabled = true;
      btnNext.disabled = true;
      setCopilotEnabled(false);
      syncCopilot();
      pageIndicator.textContent = "0 / 0";
      pageNav.innerHTML = "";
      if (previewModeTag) previewModeTag.hidden = true;
      if (btnStartEdit) btnStartEdit.hidden = true;
      if (btnOverflowCompact) btnOverflowCompact.hidden = true;
      if (btnOverflowDeleteLast) btnOverflowDeleteLast.hidden = true;
      if (btnOverflowSplit) btnOverflowSplit.hidden = true;
      if (pageTypeLabel) pageTypeLabel.textContent = "";
      overflowBadge.classList.remove("is-visible");
      updateExportButton();
      updatePageOpsButtons();
      syncPostGenPanel();
      return;
    }

    hideGenSkeleton();
    emptyHint.classList.add("hidden");
    const readonly = !state.layoutConfirmed;
    updateCopilotContext(null);
    syncCopilot();
    setCopilotEnabled(!readonly);
    if (!readonly) showPostGen();
    if (previewModeTag) {
      previewModeTag.hidden = !readonly;
      previewModeTag.textContent = "只读预览";
    }
    if (btnStartEdit) {
      btnStartEdit.hidden = !readonly;
      const unlockable =
        !readonly ||
        (state.review &&
          state.review.verdict !== "fail" &&
          !(state.review.issues || []).some((i) => i.severity === "error"));
      btnStartEdit.disabled = !unlockable;
      btnStartEdit.textContent = readonly ? "开始编辑" : "编辑中";
    }

    const pages = state.data.pages;
    if (state.page >= pages.length) state.page = pages.length - 1;
    if (state.page < 0) state.page = 0;
    markPageViewed(state.page);

    // warn：翻完全部页后自动解锁（与 pass 同权）
    if (!state.layoutConfirmed && canUnlockLayout()) {
      confirmLayout({ auto: true });
      return;
    }

    pageNav.innerHTML = pages
      .map(
        (_, i) =>
          `<button class="nav-btn${i === state.page ? " active" : ""}" data-idx="${i}">${i + 1}</button>`
      )
      .join("");
    pageNav.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.copilotEphemeral) discardEphemeral();
        state.page = +btn.dataset.idx;
        state.layoutPreview = null;
        renderPreview();
      });
    });

    const draftPage =
      state.copilotEphemeral &&
      state.copilotEphemeral.draftData &&
      state.copilotEphemeral.draftData.pages
        ? state.copilotEphemeral.draftData.pages[state.page]
        : null;
    const page = state.layoutPreview || draftPage || pages[state.page];
    pageTypeLabel.textContent = page
      ? TYPE_LABELS[page.type] || page.type || ""
      : "";
    pageIndicator.textContent = `${state.page + 1} / ${pages.length}`;
    btnPrev.disabled = state.page <= 0;
    btnNext.disabled = state.page >= pages.length - 1;
    renderReviseChips();

    XHSEngine.applyTheme(state.style, window.XHS_THEMES);
    const shell = XHSEngine.pageShellAttrs(page);
    const styleAttr = shell.style ? ` style="${shell.style}"` : "";
    const editable = !readonly && !state.layoutPreview && !state.copilotEphemeral;
    preview.classList.toggle("xhs-edit-mode", editable);
    preview.innerHTML = `<div class="${shell.className}" id="current-page"${styleAttr}>${XHSEngine.renderPage(page, state.data.meta || {}, {
      editable,
      pageIndex: state.page,
      pageTotal: pages.length,
    })}</div>`;

    if (editable) {
      XHSWysiwyg.bind(preview, {
        editable: true,
        onSelectPath: (path) => {
          updateCopilotContext(path);
        },
        onLocalOps: (ops, meta) => applyLocalPageOps(ops, meta),
        onImageClick: (path) => {
          const inp = ensureImageReplaceInput();
          inp.dataset.path = path;
          inp.click();
        },
      });
    }

    requestAnimationFrame(() => {
      const pg = $("#current-page");
      const overflow = !!(pg && XHSEngine.checkOverflow(pg));
      overflowBadge.classList.toggle("is-visible", overflow);
      syncOverflowActions(overflow);
      updatePreviewScale();
    });
    syncJson();
    updateExportButton();
    updateUndoButton();
    syncStickyCta();
    updatePageOpsButtons();
    if (state.review) renderReviewUI();
    renderManuscript();
    syncPostGenPanel();
    updateEphemeralBar();
  }

  function renderPhotoThumbs() {
    if (!state.photos.length) {
      photoThumbs.innerHTML = "";
      return;
    }
    photoThumbs.innerHTML = state.photos
      .map((p, i) => {
        const src = p.url || p.preview || "";
        const badge = i === 0 ? `<span class="badge">封面优先</span>` : "";
        const cls = p.uploading ? "photo-thumb uploading" : "photo-thumb";
        return `<div class="${cls}" data-id="${p.id}"><img src="${src}" alt="" /><button type="button" class="rm" data-rm="${p.id}" title="移除">×</button>${badge}</div>`;
      })
      .join("");
    photoThumbs.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.rm;
        state.photos = state.photos.filter((p) => p.id !== id);
        renderPhotoThumbs();
      });
    });
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_PHOTOS - state.photos.length;
    if (room <= 0) {
      setStatus("最多 9 张照片", "err");
      return;
    }
    const slice = files.slice(0, room);
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    for (const f of slice) {
      if (f.size > 5 * 1024 * 1024) {
        setStatus(`超过 5MB：${f.name}`, "err");
        return;
      }
      if (f.type && !allowed.includes(f.type)) {
        setStatus(`格式不支持：${f.name}`, "err");
        return;
      }
    }

    const placeholders = slice.map((f) => ({
      id: "p_" + Math.random().toString(36).slice(2, 10),
      name: f.name,
      preview: URL.createObjectURL(f),
      uploading: true,
      file: f,
    }));
    state.photos = state.photos.concat(placeholders);
    renderPhotoThumbs();
    setStatus(`上传中（${placeholders.length}）…`);

    const fd = new FormData();
    fd.append("session_id", ensureUploadSession());
    placeholders.forEach((p) => fd.append("files", p.file, p.name));
    try {
      const body = await apiFetch("/api/upload", {
        method: "POST",
        body: fd,
        timeoutMs: XHSApi.DEFAULT_TIMEOUT.upload,
      });
      if (body.session_id) state.uploadSessionId = body.session_id;
      const urls = body.urls || (body.files || []).map((x) => x.url);
      placeholders.forEach((p, i) => {
        p.uploading = false;
        p.url = urls[i];
        if (p.preview) URL.revokeObjectURL(p.preview);
        delete p.preview;
        delete p.file;
      });
      state.photos = state.photos.filter((p) => p.url || p.uploading);
      renderPhotoThumbs();
      setStatus(`已上传 ${urls.length} 张，生成时将自动排版`, "ok");
    } catch (e) {
      const ids = new Set(placeholders.map((p) => p.id));
      state.photos = state.photos.filter((p) => !ids.has(p.id));
      placeholders.forEach((p) => {
        if (p.preview) URL.revokeObjectURL(p.preview);
      });
      renderPhotoThumbs();
      setStatus("上传失败: " + e.message, "err");
    }
  }

  async function cleanupUploads() {
    if (!state.uploadSessionId) return;
    try {
      await apiFetch("/api/uploads/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.uploadSessionId }),
        timeoutMs: XHSApi.DEFAULT_TIMEOUT.cleanup,
      });
    } catch {
      /* best-effort */
    }
  }

  function buildMetaJson(extra) {
    const pages = (state.data && state.data.pages) || [];
    const warnings = [...(state.warnings || []), ...(state.exportWarnings || [])];
    return {
      style: state.style,
      page_count: pages.length,
      title: titleEl.value || state.title || "",
      hooks: state.hooks || [],
      brief: state.brief || null,
      review: state.review
        ? { verdict: state.review.verdict, mode: state.review.mode, issue_count: (state.review.issues || []).length }
        : null,
      run_mode: state.runMode || state.serviceMode,
      llm_session_calls: state.llmSession.calls || 0,
      warnings: warnings.length ? warnings : undefined,
      canvas: { width: PAGE_W, height: PAGE_H },
      pixelRatio: +($("#export-scale") && $("#export-scale").value) || 2,
      generated_at: new Date().toISOString(),
      timing_log: (state.timingLog || []).slice(0, 20),
      ...(extra || {}),
    };
  }

  async function validateBeforeExport(force) {
    return XHSExportGuard.validatePublishPackage({
      title: titleEl.value || state.title,
      caption: captionEl.value || state.caption,
      data: state.data,
      style: state.style,
      themes: window.XHS_THEMES,
      checkOverflow: true,
      needsRereview: state.needsRereview,
      forceExport: !!force,
    });
  }

  async function doExportZip(opts) {
    if (!state.layoutConfirmed || !state.data || !state.data.pages || state.exporting) return false;
    const force = !!(opts && opts.force);
    const validation = await validateBeforeExport(force);
    if (!validation.ok) {
      showExportBlockers(validation.blockers);
      setStatus("导出被拦截：请先修复上述问题", "err");
      return false;
    }
    if (validation.warnings.length && !force) {
      const w = validation.warnings.map((x) => x.message).join(" · ");
      if (!confirm(`导出前提示：${w}\n仍继续导出？`)) return false;
    }
    hideExportChoice();
    if (exportBlockersBar) exportBlockersBar.hidden = true;
    const scale = +($("#export-scale") && $("#export-scale").value) || 2;
    state.exporting = true;
    btnExport.disabled = true;
    btnGen.disabled = true;
    btnExport.textContent = "打包中…";
    setFlowStep(3, {
      busy: true,
      status: "正在导出发布包…",
      stage: "导出",
      estimatedSeconds: Math.max(2, (state.data.pages.length || 1) * 1),
    });
    try {
      await XHSDeps.loadExportDeps();
      await document.fonts.ready;
      await sleep(200);
      const zip = new JSZip();
      const folder = zip.folder("pages");
      const pages = state.data.pages;
      const hidden = $("#export-container");
      hidden.innerHTML = "";
      XHSEngine.applyTheme(state.style, window.XHS_THEMES);

      for (let i = 0; i < pages.length; i++) {
        const label = `正在导出发布包…（${i + 1}/${pages.length}）`;
        setBusyStage("导出", label);
        if (flowStatusLabel) flowStatusLabel.textContent = label;
        setStatus(label);
        const div = document.createElement("div");
        const shell = XHSEngine.pageShellAttrs(pages[i]);
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
        div.innerHTML = XHSEngine.renderPage(pages[i], state.data.meta || {}, {
          editable: false,
          pageIndex: i,
          pageTotal: pages.length,
        });
        hidden.appendChild(div);

        const imgs = Array.from(div.querySelectorAll("img"));
        await Promise.all(
          imgs.map(
            (img) =>
              img.complete
                ? Promise.resolve()
                : new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                  })
          )
        );

        const dataUrl = await htmlToImage.toPng(div, {
          width: PAGE_W,
          height: PAGE_H,
          pixelRatio: scale,
          cacheBust: true,
          skipFonts: false,
        });
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        folder.file(`${String(i + 1).padStart(2, "0")}.png`, base64, { base64: true });
        hidden.removeChild(div);
      }

      const title = (titleEl.value || state.title || "").trim();
      const caption = (captionEl.value || state.caption || "").trim();
      zip.file("title.txt", title);
      zip.file("caption.txt", caption);
      const imagePaths = pages.map((_, i) => `pages/${String(i + 1).padStart(2, "0")}.png`);
      zip.file(
        "publish.json",
        JSON.stringify(
          {
            title,
            caption,
            images: imagePaths,
            meta: { studio: "xhs-studio", version: "1.3.0", page_count: pages.length },
          },
          null,
          2
        )
      );
      const exportMeta = buildMetaJson();
      if (force && state.needsRereview) {
        exportMeta.warnings = [...(exportMeta.warnings || []), "skipped_rereview"];
      }
      zip.file("meta.json", JSON.stringify(exportMeta, null, 2));

      setBusyStage("导出", "正在打包 ZIP…");
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `xhs-publish-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setBusyStage("导出", "发布包已下载");
      setStatus(`发布包已下载（${pages.length} 页 + title/caption/publish.json）`, "ok");
      XHSA11y.announce("发布包已下载");
      await cleanupUploads();
      scheduleAutosave();
      return true;
    } catch (e) {
      setStatus("导出失败: " + e.message, "err");
      setFlowStep(3);
      return false;
    } finally {
      state.exporting = false;
      btnGen.disabled = false;
      btnExport.textContent = "导出发布包";
      updateExportButton();
      setTimeout(clearProgress, 800);
      if (state.layoutConfirmed) setFlowStep(3);
    }
  }

  async function runExport() {
    if (!state.layoutConfirmed || !state.data || !state.data.pages || state.exporting) return false;
    const validation = await validateBeforeExport(false);
    if (!validation.ok) {
      showExportBlockers(validation.blockers);
      setStatus("导出被拦截：请先修复上述问题", "err");
      return false;
    }
    if (state.needsRereview) {
      showExportChoice();
      updateExportButton();
      setStatus("内容已改，请选择：先复审 / 直接导出 / 取消", "ok");
      return false;
    }
    return doExportZip();
  }

  async function exportAfterRereview() {
    hideExportChoice();
    updateExportButton();
    await runReview({ light: true });
    if ((state.review && state.review.verdict) === "fail") {
      setStatus("复审未通过，已取消导出", "err");
      return false;
    }
    return doExportZip();
  }

  async function exportForceSkipRereview() {
    if (!confirm("跳过复审直接导出？内容改动未复检，质量风险由你承担。")) {
      hideExportChoice();
      updateExportButton();
      return false;
    }
    state.exportWarnings = ["skipped_rereview: 用户选择跳过复审直接导出"];
    hideExportChoice();
    updateExportButton();
    return doExportZip({ force: true });
  }

  async function callReview({ light } = {}) {
    if (!state.data) return null;
    const signal = XHSApi.beginRequest("review");
    setApiBusy("review", true);
    try {
      return await apiFetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: state.data,
          title: titleEl.value || state.title || "",
          caption: captionEl.value || state.caption || "",
          intent: state.intent || intentEl.value.trim(),
          light: !!light,
        }),
        signal,
        timeoutMs: XHSApi.DEFAULT_TIMEOUT.review,
      });
    } finally {
      setApiBusy("", false);
    }
  }

  async function runReview({ light } = {}) {
    if (!state.data) return;
    const eta = state.llmConfigured ? 5 : 1;
    const busyLabel = light ? "② 正在重新审核…" : "② 正在审核内容…";
    // 审核时保持右侧已出图，不用骨架盖住
    hideGenSkeleton();
    setFlowStep(2, {
      busy: true,
      status: busyLabel,
      stage: "② 审核",
      composeSub: "reviewing",
      estimatedSeconds: eta,
      metaTip: state.llmConfigured ? "预估约 5 秒 · 1 次调用" : "Demo / 规则 · 约 1 秒",
    });
    showReviewPanel();
    btnApplyReview.disabled = true;
    btnRerunReview.disabled = true;
    if (btnConfirmLayout) btnConfirmLayout.disabled = true;
    try {
      let result = await callReview({ light: !!light });
      state.review = result;
      trackLlmMeta(result.meta);
      pushTimingLog("review", { meta: result.meta, mode: result.mode, ok: true });
      if (result.title) {
        state.title = result.title;
        titleEl.value = result.title;
      }
      if (result.caption) {
        state.caption = result.caption;
        captionEl.value = result.caption;
      }
      markNeedsRereview(false);
      renderReviewUI();
      renderLogicSummary();
      renderPageSummary();
      const v = result.verdict || "warn";
      const n = (result.issues || []).length;
      const meta = result.meta || {};
      const tip = formatMetaTip(meta);
      const honest =
        result.mode && result.mode !== "llm"
          ? "（规则审核，非深度 AI 质检）"
          : "";
      setStatus(
        v === "pass"
          ? `审核通过${n ? `（${n} 条提示）` : ""}${honest}${tip ? " · " + tip : ""}`
          : `审核完成：${v} · ${n} 条问题${honest}${tip ? " · " + tip : ""}`,
        v === "fail" ? "err" : "ok"
      );
      setBusyStage("② 审核", "审核完成", { metaTip: tip });
      setFlowStep(2, { composeSub: "" });
      // 审时看图：审核完仍可翻页；pass / 看完全部会自动解锁
      renderPreview();
      scheduleAutosave();
    } catch (e) {
      const timedOut = /timeout|超时|aborted/i.test(e.message || "");
      if (state.llmConfigured && timedOut && !light) {
        try {
          const fallback = await callReview({ light: true });
          state.review = fallback;
          trackLlmMeta(fallback.meta);
          pushTimingLog("review", { meta: fallback.meta, mode: fallback.mode, ok: true });
          markNeedsRereview(false);
          renderReviewUI();
          renderLogicSummary();
          renderPageSummary();
          setStatus("LLM 审核超时，已改用规则轻量审核", "ok");
          setBusyStage("② 审核", "规则审核完成", {});
          setFlowStep(2, { composeSub: "" });
          renderPreview();
          scheduleAutosave();
          return;
        } catch (fallbackErr) {
          setStatus("审核失败: " + fallbackErr.message, "err");
          renderReviewUI();
          return;
        }
      }
      setStatus("审核失败: " + e.message, "err");
      renderReviewUI();
    } finally {
      setTimeout(clearProgress, 600);
      btnRerunReview.disabled = false;
    }
  }

  function backfillPublishFields(result) {
    state.data = result.data;
    state.title = result.title || "";
    state.caption = result.caption || "";
    state.hooks = result.hooks || [];
    state.brief = result.brief || null;
    state.style = result.style || state.style;
    state.theme = result.theme || (result.data && result.data.theme) || "";
    state.logicSummary =
      result.logic_summary ||
      (result.data && result.data.logic_summary) ||
      [];
    state.page = 0;
    state.pageUndo = null;
    state.warnings = result.warnings || [];
    state.runMode = result.mode || state.serviceMode;

    if (!state.title && state.hooks[0]) state.title = state.hooks[0];
    if (!state.title && state.data.pages && state.data.pages[0]) {
      const cover = state.data.pages.find((p) => p.type === "cover") || state.data.pages[0];
      state.title = String(cover.title || "").replace(/\n/g, " ").trim();
    }
    if (!state.caption) {
      const ending = (state.data.pages || []).find((p) => p.type === "ending");
      const cover = (state.data.pages || []).find((p) => p.type === "cover");
      const bits = [];
      if (cover && cover.subtitle) bits.push(cover.subtitle);
      if (ending && ending.desc) bits.push(ending.desc);
      const tags = (ending && ending.tags) || (cover && cover.tags) || [];
      const tagLine = tags.map((t) => (String(t).startsWith("#") ? t : "#" + t)).join(" ");
      state.caption = (bits.join("\n") || state.title) + (tagLine ? "\n\n" + tagLine : "");
    }
    if (titleEl) titleEl.value = state.title;
    captionEl.value = state.caption;
    updateModeBanner();
  }

  function showRetry(show) {
    if (btnRetry) btnRetry.hidden = !show;
  }

  async function runGenerate(reuseBody) {
    const intent = reuseBody ? reuseBody.intent : intentEl.value.trim();
    if (!intent) {
      setStatus("请先填写意图", "err");
      intentEl.focus();
      return;
    }
    if (!reuseBody && state.photos.some((p) => p.uploading)) {
      setStatus("照片仍在上传，请稍候", "err");
      return;
    }
    const genSnapshot = captureSnapshot();
    state.generation = { snapshot: genSnapshot };
    btnGen.disabled = true;
    showRetry(false);
    btnExport.disabled = true;
    state.layoutConfirmed = false;
    state.review = null;
    state.needsRereview = false;
    state.pageUndo = null;
    state.viewedPages = new Set();
    // 保留旧稿可见，不清 state.data
    hideExportChoice();
    clearCopilotMessages();
    collapseIntentPanel(false);
    const genEta = state.llmConfigured ? 10 : 1;
    const genLabel = state.llmConfigured ? "① 正在写稿…" : "① 正在写稿（Demo）…";
    showGenSkeleton(genEta);
    setFlowStep(2, {
      busy: true,
      status: genLabel,
      stage: "① 写稿",
      composeSub: "drafting",
      estimatedSeconds: genEta,
      metaTip: state.llmConfigured ? "预估约 10 秒 · 随后进入 ② 审核" : "Demo · 约 1 秒后进入 ② 审核",
    });
    if (!state.data) renderPreview();

    const body =
      reuseBody ||
      {
        intent,
        author: (authorEl.value || "").trim() || "你的昵称",
        brand: (brandEl.value || "").trim() || "",
        style: state.style || null,
        image_urls: state.photos.map((p) => p.url).filter(Boolean),
        ...buildSupplementPayload(),
      };

    const signal = XHSApi.beginRequest("generate");
    setApiBusy("generate", true);
    try {
      state.intent = intent;
      state.lastGenerateBody = body;
      setBusyStage("① 写稿", genLabel, {
        metaTip: state.llmConfigured ? "主路径第 1/2 次调用" : "Demo 本地样例",
      });
      const result = await apiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
        timeoutMs: XHSApi.DEFAULT_TIMEOUT.generate,
      });
      const gMeta = result.meta || {};
      trackLlmMeta(gMeta);
      pushTimingLog("generate", { meta: gMeta, mode: result.mode, ok: true });
      const tip = formatMetaTip(gMeta);
      setBusyStage("① 写稿", "全文已生成，准备 ② 审核…", { metaTip: tip });
      if (flowStatusLabel) flowStatusLabel.textContent = "全文已生成，准备 ② 审核…";

      backfillPublishFields(result);
      pushHistory("生成");
      showReviewPanel();
      renderThemeGrid();
      XHSEngine.applyTheme(state.style, window.XHS_THEMES);
      renderHooks();
      renderLogicSummary();
      renderPageSummary();
      renderReviewUI();
      hideGenSkeleton();
      renderPreview();
      syncJson();
      scheduleAutosave();

      const mode = result.mode || "demo";
      state.runMode = mode;
      updateModeBanner();

      await runReview({ light: false });
      const imgN = result.image_count || (body.image_urls || []).length;
      if (!statusEl.classList.contains("err") && imgN) {
        const cur = (statusEl.textContent || "").trim();
        if (cur) setStatus(`${cur} · ${imgN} 张配图`, "ok");
      }
    } catch (e) {
      if (genSnapshot && genSnapshot.data) restoreSnapshot(genSnapshot);
      else renderPreview();
      const aborted = e && e.aborted;
      setStatus(aborted ? "生成已取消" : "生成失败: " + e.message, aborted ? "ok" : "err");
      if (!aborted) setFlowStep(genSnapshot && genSnapshot.data ? 3 : 1);
      clearProgress();
      showRetry(!!state.lastGenerateBody);
    } finally {
      setApiBusy("", false);
      btnGen.disabled = false;
      updateExportButton();
    }
  }

  async function runApplyReview() {
    if (!state.data || !state.review) return;
    btnApplyReview.disabled = true;
    if (btnConfirmLayout) btnConfirmLayout.disabled = true;
    setFlowStep(2, {
      busy: true,
      status: "按审核意见改写中…",
      stage: "改写",
      composeSub: "reviewing",
      estimatedSeconds: state.llmConfigured ? 8 : 1,
    });
    setApiBusy("revise", true);
    const signal = XHSApi.beginRequest("revise");
    try {
      const result = await apiFetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: state.data,
          instruction: "根据审核意见修改",
          issues: state.review.issues || [],
          title: titleEl.value || state.title,
          caption: captionEl.value || state.caption,
          ...buildSupplementPayload(),
        }),
        signal,
        timeoutMs: XHSApi.DEFAULT_TIMEOUT.revise,
      });
      trackLlmMeta(result.meta);
      state.data = result.data;
      state.theme = (result.data && result.data.theme) || state.theme;
      state.logicSummary = (result.data && result.data.logic_summary) || state.logicSummary;
      if (result.title) {
        state.title = result.title;
        titleEl.value = result.title;
      }
      if (result.caption) {
        state.caption = result.caption;
        captionEl.value = result.caption;
      }
      renderLogicSummary();
      renderPageSummary();
      syncJson();
      renderPreview();
      setStatus(`已按意见改写（${result.mode || "ok"}），正在复审…`, "ok");
      await runReview({ light: true });
      scheduleAutosave();
    } catch (e) {
      setStatus("按意见改写失败: " + e.message, "err");
      clearProgress();
      renderReviewUI();
    } finally {
      setApiBusy("", false);
    }
  }

  function confirmLayout(opts) {
    if (!state.data) return false;
    const auto = !!(opts && opts.auto);
    const focusInput = !!(opts && opts.focusInput);
    const v = state.review && state.review.verdict;
    const hasError =
      state.review && (state.review.issues || []).some((i) => i.severity === "error");
    if (hasError || v === "fail") {
      setStatus("仍有错误，请先改写或重新审核", "err");
      return false;
    }
    // warn 且未翻完全部：仅手动确认可强制；auto 路径需 canUnlockLayout
    if (!auto && v === "warn" && !allPagesViewed()) {
      // 手动「确认继续」允许
    } else if (auto && !canUnlockLayout()) {
      return false;
    }
    const already = state.layoutConfirmed;
    state.layoutConfirmed = true;
    // 不得无条件清复审标记：审核阶段改过的 title/caption/hooks 要保留
    setFlowStep(3);
    showPostGen();
    syncStickyCta();
    if (!already) {
      renderPreview();
      setStatus(
        auto
          ? v === "pass"
            ? "审核通过，已可改页/导出"
            : "已看完全部页，已可改页/导出"
          : "已确认，可改页或导出发布包",
        "ok"
      );
    } else {
      renderPreview();
    }
    if (focusInput && copilotInput) {
      requestAnimationFrame(() => {
        copilotInput.focus();
      });
    }
    syncCopilot();
    if (!already && copilotPanel) {
      copilotPanel.classList.add("copilot-panel--unlock");
      window.setTimeout(() => copilotPanel.classList.remove("copilot-panel--unlock"), 2400);
      requestAnimationFrame(() => {
        copilotPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
    return true;
  }

  function startEditCurrentPage() {
    if (!state.data) return;
    const ok = confirmLayout({ focusInput: true });
    if (!ok) return;
    setStatus("已进入编辑 · 点预览文字直接改，或用侧栏改页助手", "ok");
  }

  async function runOverflowCompact() {
    if (!state.data) return;
    if (!state.layoutConfirmed) {
      if (!confirmLayout({})) return;
    }
    applyLocalPageOps([{ op: "setDensity", density: "compact" }], { summary: "变紧凑" });
    setStatus("已切换紧凑排版 · 无需 LLM", "ok");
  }

  function runOverflowDeleteLast() {
    if (!state.data) return;
    if (!state.layoutConfirmed) {
      if (!confirmLayout({})) return;
    }
    const page = state.data.pages[state.page];
    const key = XHSOps.listKeyForPage(page);
    if (!key) {
      setStatus("当前页没有可删的列表条目", "err");
      return;
    }
    const items = page[key] || [];
    if (!items.length) {
      setStatus("列表已空", "err");
      return;
    }
    applyLocalPageOps([{ op: "deleteItem", list: key, index: items.length }], { summary: "删最后一条" });
  }

  function splitPageOverflow() {
    if (!state.data) return;
    if (!state.layoutConfirmed) {
      if (!confirmLayout({})) return;
    }
    const page = state.data.pages[state.page];
    const key = XHSOps.listKeyForPage(page);
    if (!key || (key !== "items" && key !== "steps")) {
      setStatus("当前页类型不支持自动拆页", "err");
      return;
    }
    const items = page[key] || [];
    if (items.length < 3) {
      setStatus("至少 3 条/步才能拆页", "err");
      return;
    }
    if (state.data.pages.length >= 12) {
      setStatus("已达 12 页上限，请先删页", "err");
      return;
    }
    pushHistory("建议拆页");
    const mid = Math.ceil(items.length / 2);
    const pages = state.data.pages.slice();
    const cur = { ...page, [key]: items.slice(0, mid) };
    const next = JSON.parse(JSON.stringify(page));
    next[key] = items.slice(mid);
    if (page.title && !String(page.title).includes("（续）")) {
      next.title = `${page.title}（续）`;
    }
    pages[state.page] = XHSOps.markUserEdited(cur);
    pages.splice(state.page + 1, 0, XHSOps.markUserEdited(next));
    state.data = { ...state.data, pages, _user_edited: true };
    state.page += 1;
    markNeedsRereview(true);
    renderLogicSummary();
    renderPageSummary();
    syncJson();
    renderPreview();
    scheduleAutosave();
    setStatus(`已拆成两页 · 后半移至第 ${state.page + 1} 页`, "ok");
    addCopilotMessage("system", `已把后半 ${items.length - mid} 条拆到新页，无需 LLM`);
  }

  function savePageUndo() {
    const pages = (state.data && state.data.pages) || [];
    const p = pages[state.page];
    if (!p) return;
    state.pageUndo = {
      pageIndex: state.page,
      page: JSON.parse(JSON.stringify(p)),
    };
    updateUndoButton();
  }

  function undoPageRevise() {
    if (!state.pageUndo || !state.data || !state.data.pages) return;
    if (state.pageUndo.pageIndex !== state.page) {
      const n = state.pageUndo.pageIndex + 1;
      state.page = state.pageUndo.pageIndex;
      renderPreview();
      setStatus(`已跳到第 ${n} 页 · 再点一次撤销可恢复`, "ok");
      updateUndoButton();
      return;
    }
    const pages = state.data.pages.slice();
    pages[state.page] = JSON.parse(JSON.stringify(state.pageUndo.page));
    state.data = { ...state.data, pages };
    state.pageUndo = null;
    markNeedsRereview(true);
    syncJson();
    renderPreview();
    addCopilotMessage("system", "已撤销本页修改");
    setStatus("已撤销本页 AI 修改", "ok");
    updateUndoButton();
  }

  function updateEphemeralBar() {
    const ep = state.copilotEphemeral;
    if (copilotEphemeralBar) {
      copilotEphemeralBar.hidden = !ep;
    }
    if (ep && copilotEphemeralBar) {
      const n = (ep.ops && ep.ops.length) || 0;
      const label = copilotEphemeralBar.querySelector(".copilot-ephemeral-label");
      if (label) {
        label.textContent = n ? `AI 建议中 · ${n} 处改动` : "AI 建议中";
      }
    }
    setCopilotEnabled(state.layoutConfirmed && !!state.data);
  }

  function clearEphemeral(opts) {
    const restore = opts && opts.restore;
    const ep = state.copilotEphemeral;
    if (restore && ep && ep.beforePage && state.data && state.data.pages) {
      const pages = state.data.pages.slice();
      pages[state.page] = JSON.parse(JSON.stringify(ep.beforePage));
      state.data = { ...state.data, pages };
    }
    state.copilotEphemeral = null;
    if (ephemeralRenderTimer) {
      clearTimeout(ephemeralRenderTimer);
      ephemeralRenderTimer = null;
    }
    updateEphemeralBar();
  }

  function pathsFromOp(op, page) {
    if (!op || typeof op !== "object") return [];
    const name = op.op;
    if (name === "rewriteField" && op.field) return [String(op.field)];
    if (name === "patchPath" && op.path) return [String(op.path)];
    if (name === "deleteItem" || name === "updateItem" || name === "insertItem") {
      const list =
        op.list ||
        op.listPath ||
        (page && XHSOps.listKeyForPage(page)) ||
        "";
      const idx = Number(op.index);
      if (list && Number.isFinite(idx) && idx >= 1) return [`${list}[${idx - 1}]`];
    }
    if (name === "moveItem") {
      const list = op.list || (page && XHSOps.listKeyForPage(page)) || "";
      const from = Number(op.from);
      const to = Number(op.to);
      const paths = [];
      if (list && from >= 1) paths.push(`${list}[${from - 1}]`);
      if (list && to >= 1) paths.push(`${list}[${to - 1}]`);
      return paths;
    }
    if (name === "setDensity" || name === "setFontScale" || name === "setPageType" || name === "setPointsLayout" || name === "setLayoutRecipe") {
      return [""];
    }
    if (name === "setImage" || name === "setImageFocus") {
      const slot = String(op.slot || "image");
      if (slot.startsWith("images[")) return [slot];
      return ["image"];
    }
    return [];
  }

  function highlightDiffPaths(paths, kind) {
    if (!preview) return;
    const cls = kind === "removed" ? "xhs-diff-removed" : "xhs-diff-flash";
    const list = Array.isArray(paths) ? paths : [paths];
    list.forEach((path) => {
      const p = String(path || "");
      let el = null;
      if (!p) {
        el = preview.querySelector("#current-page") || preview.querySelector(".xhs-page");
      } else {
        el = preview.querySelector(`[data-xhs-path="${CSS.escape(p)}"]`);
      }
      if (!el) return;
      el.classList.remove("xhs-diff-flash", "xhs-diff-removed");
      void el.offsetWidth;
      el.classList.add(cls);
      window.setTimeout(() => {
        el.classList.remove(cls);
      }, 1200);
    });
  }

  function scheduleEphemeralPreview() {
    if (ephemeralRenderTimer) return;
    ephemeralRenderTimer = window.setTimeout(() => {
      ephemeralRenderTimer = null;
      renderPreview();
    }, 80);
  }

  function feedEphemeralOp(op) {
    const ep = state.copilotEphemeral;
    if (!ep || !op) return;
    ep.ops.push(op);
    const pages = (ep.draftData.pages || []).slice();
    const cur = pages[state.page];
    const { page } = XHSOps.applyPageOps(cur, [op]);
    pages[state.page] = page;
    ep.draftData = { ...ep.draftData, pages };
    highlightDiffPaths(pathsFromOp(op, page), op.op === "deleteItem" ? "removed" : "flash");
    scheduleEphemeralPreview();
    updateEphemeralBar();
  }

  function scrollHighlightDiffPath(path) {
    if (!path || !preview) return;
    const el = preview.querySelector(`[data-xhs-path="${CSS.escape(path)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    highlightDiffPaths([path], "flash");
  }

  function appendCopilotStreamPill(pill) {
    if (!pill) return;
    let msg = null;
    if (state.copilot.streamMsgIdx != null) {
      msg = state.copilot.messages[state.copilot.streamMsgIdx];
    }
    if (!msg || msg.role !== "assistant" || !msg.streaming) {
      state.copilot.messages.push({
        role: "assistant",
        text: "AI 建议中…",
        pills: [],
        streaming: true,
        ts: Date.now(),
      });
      state.copilot.streamMsgIdx = state.copilot.messages.length - 1;
      msg = state.copilot.messages[state.copilot.streamMsgIdx];
    }
    if (!msg.pills.includes(pill)) msg.pills.push(pill);
    renderCopilot();
  }

  function finalizeCopilotStreamMessage(text, opts) {
    const idx = state.copilot.streamMsgIdx;
    state.copilot.streamMsgIdx = null;
    if (idx != null && state.copilot.messages[idx]) {
      const msg = state.copilot.messages[idx];
      msg.streaming = false;
      msg.text = text;
      if (opts) {
        if (opts.pills) msg.pills = opts.pills;
        if (opts.suffix != null) msg.suffix = opts.suffix;
        if (opts.diffs) msg.diffs = opts.diffs;
        if (opts.hint) msg.hint = opts.hint;
        if (opts.warn) msg.warn = opts.warn;
      }
    } else {
      addCopilotMessage("assistant", text, opts);
    }
    renderCopilot();
  }

  function commitPageResult(result, okMsg) {
    pushHistory("AI 改页");
    state.data = result.data;
    state.theme = (result.data && result.data.theme) || result.theme || state.theme;
    state.logicSummary =
      (result.data && result.data.logic_summary) ||
      result.logic_summary ||
      state.logicSummary;
    if (result.title) {
      state.title = result.title;
      titleEl.value = result.title;
    }
    if (result.caption) {
      state.caption = result.caption;
      captionEl.value = result.caption;
    }
    markNeedsRereview(true);
    renderLogicSummary();
    renderPageSummary();
    syncJson();
    renderPreview();
    setStatus(okMsg || `已更新当前页（${result.mode || "ok"}）· 已改需复审`, "ok");
    scheduleAutosave();
  }

  function acceptEphemeral() {
    const ep = state.copilotEphemeral;
    if (!ep || !ep.result) return;
    const result = ep.result;
    clearEphemeral();
    const applied = result.applied || {};
    const step = formatAppliedStep(applied, ep.instruction, result.mode);
    const line = step.line + (ep.callTip ? " · " + ep.callTip : "");
    commitPageResult(result, `${line} · 已改需复审`);
    if (result.mode) {
      state.runMode = result.mode;
      updateModeBanner();
    }
    addCopilotMessage("system", "已应用 AI 建议");
  }

  function discardEphemeral() {
    if (!state.copilotEphemeral) return;
    clearEphemeral({ restore: true });
    syncJson();
    renderPreview();
    addCopilotMessage("system", "已放弃 AI 建议");
    setStatus("已恢复原页", "ok");
  }

  function showEphemeralPreview(result, meta) {
    const ep = state.copilotEphemeral;
    if (!ep) return;
    ep.result = result;
    ep.callTip = meta && meta.callTip;
    if (result.data) {
      ep.draftData = JSON.parse(JSON.stringify(result.data));
    }
    updateEphemeralBar();
    renderPreview();
  }

  async function consumePageReviseStream(body, signal, onOp) {
    const res = await fetch(API + "/api/page/revise/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify(body),
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
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    if (!reader) throw new Error("流式响应不可用");
    const decoder = new TextDecoder();
    let buf = "";
    let donePayload = null;
    let streamMeta = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        let ev;
        try {
          ev = JSON.parse(t);
        } catch {
          continue;
        }
        if (ev.event === "op" && ev.op) {
          if (onOp) onOp(ev.op);
        } else if (ev.event === "meta") {
          streamMeta = ev;
        } else if (ev.event === "done") {
          donePayload = ev;
        } else if (ev.event === "error") {
          throw new Error(ev.message || "改页失败");
        }
      }
    }
    const tail = buf.trim();
    if (tail) {
      try {
        const ev = JSON.parse(tail);
        if (ev.event === "done") donePayload = ev;
        else if (ev.event === "error") throw new Error(ev.message || "改页失败");
        else if (ev.event === "meta") streamMeta = ev;
        else if (ev.event === "op" && ev.op && onOp) onOp(ev.op);
      } catch (e) {
        if (e instanceof SyntaxError) {
          /* ignore partial tail */
        } else {
          throw e;
        }
      }
    }
    if (!donePayload || !donePayload.data) {
      throw new Error("流式改页未返回完整结果");
    }
    return {
      data: donePayload.data,
      applied: donePayload.applied,
      title: donePayload.title,
      caption: donePayload.caption,
      theme: donePayload.theme,
      logic_summary: donePayload.logic_summary,
      mode: donePayload.mode || (streamMeta && streamMeta.mode),
      meta: donePayload.meta || streamMeta,
      warnings: donePayload.warnings,
    };
  }

  function applyPageResult(result, okMsg) {
    commitPageResult(result, okMsg);
  }

  function currentPageSnapshot() {
    const pages = (state.data && state.data.pages) || [];
    const p = pages[state.page];
    return p && typeof p === "object" ? JSON.parse(JSON.stringify(p)) : null;
  }

  function normalizeCopilotInstruction(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function truncateCopilotSnippet(text, maxLen) {
    const t = String(text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return "（空）";
    if (t.length <= maxLen) return t;
    return t.slice(0, Math.max(1, maxLen - 1)) + "…";
  }

  function copilotDiffFieldLabel(page, field) {
    if (page && page.type === "ending" && field === "desc") return "行动号召";
    if (page && page.type === "cover" && field === "subtitle") return "副标题";
    return FIELD_PATH_LABELS[field] || field || "文案";
  }

  function getListKeyForPage(page) {
    if (!page || typeof page !== "object") return null;
    for (const k of ["items", "steps", "rows", "bullets", "paragraphs", "tips"]) {
      if (Array.isArray(page[k]) && page[k].length) return k;
    }
    return null;
  }

  function getItemPreviewText(item) {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const bits = [item.head, item.body, item.text, item.value].filter(Boolean);
      if (bits.length) return bits.join(" · ");
    }
    return item == null ? "" : String(item);
  }

  function inferCopilotAction(instruction, diff) {
    const tip = String(instruction || "");
    if (/短|缩短|精简|删/.test(tip)) return "缩短";
    if (/口语|白话|顺口/.test(tip)) return "改得更口语";
    if (/具体|详细/.test(tip)) return "写得更具体";
    if (/狠|抓人|吸引/.test(tip)) return "改得更抓人";
    if (/紧凑|字号|字体|疏朗/.test(tip)) return "调整";
    if (diff && diff.before && diff.after && diff.after.length < diff.before.length) return "缩短";
    return "改写";
  }

  function computeCopilotDiffs(beforePage, afterPage, ops) {
    const diffs = [];
    if (!beforePage || !afterPage) return diffs;
    const seen = new Set();

    function pushDiff(label, before, after, path) {
      const b = String(before ?? "").trim();
      const a = String(after ?? "").trim();
      if (b === a) return;
      const key = `${label}::${b}::${a}`;
      if (seen.has(key)) return;
      seen.add(key);
      diffs.push({ label, before: b, after: a, path: path || "" });
    }

    for (const op of ops || []) {
      if (!op || typeof op !== "object") continue;
      if (op.op === "rewriteField") {
        const field = op.field;
        if (!field) continue;
        const label = copilotDiffFieldLabel(afterPage, field);
        pushDiff(label, beforePage[field], afterPage[field], field);
      } else if (op.op === "updateItem") {
        const key = op.list || getListKeyForPage(beforePage) || getListKeyForPage(afterPage);
        const idx = Number(op.index);
        if (!key || !Number.isFinite(idx) || idx < 1) continue;
        const listLabel = LIST_PATH_LABELS[key] || key;
        const itemPath = `${key}[${idx - 1}]`;
        pushDiff(
          `${listLabel}${idx}`,
          getItemPreviewText((beforePage[key] || [])[idx - 1]),
          getItemPreviewText((afterPage[key] || [])[idx - 1]),
          itemPath
        );
      } else if (op.op === "deleteItem") {
        const key = op.list || getListKeyForPage(beforePage);
        const idx = Number(op.index);
        if (!key || !Number.isFinite(idx) || idx < 1) continue;
        const listLabel = LIST_PATH_LABELS[key] || key;
        pushDiff(
          `${listLabel}${idx}`,
          getItemPreviewText((beforePage[key] || [])[idx - 1]),
          "（已删除）",
          `${key}[${idx - 1}]`
        );
      }
    }

    if (!diffs.length) {
      for (const field of PAGE_TEXT_FIELDS) {
        pushDiff(
          copilotDiffFieldLabel(afterPage, field),
          beforePage[field],
          afterPage[field],
          field
        );
      }
    }
    return diffs;
  }

  function buildCopilotSummary(diffs, applied, instruction, isRules) {
    const prefix = isRules ? "已用快速规则" : "已";
    if (diffs.length === 1) {
      const d = diffs[0];
      const action = inferCopilotAction(instruction, d);
      return `${prefix}${action}「${d.label}」`;
    }
    if (diffs.length > 1) {
      return `${prefix}修改 ${diffs.map((d) => d.label).join("、")}`;
    }
    const step = formatAppliedStep(applied, instruction, applied && applied.mode);
    const detail = step.pills.join(" · ") || humanizeReviseSummary(applied && applied.summary, instruction);
    return `${prefix}${detail || "更新本页"}`;
  }

  function suggestFollowUpChips(page, diffs, instruction) {
    const type = page && page.type;
    if (type && FOLLOW_UP_CHIPS_BY_TYPE[type]) {
      return FOLLOW_UP_CHIPS_BY_TYPE[type].slice(0, 3);
    }
    if (diffs.length === 1 && diffs[0].after.length > 16) {
      const label = diffs[0].label;
      return [
        { label: "再短一半", chip: `${label}再短一半`, kind: "copy" },
        { label: "更口语", chip: `${label}更口语一点`, kind: "copy" },
        { label: "更紧凑", chip: "更紧凑", kind: "layout" },
      ];
    }
    return null;
  }

  function humanizeOp(op) {
    if (!op || typeof op !== "object") return "";
    if (op.label) return String(op.label).trim();
    const name = op.op;
    if (name === "setDensity") {
      return { compact: "变紧凑", airy: "更疏朗", normal: "疏密复位" }[op.density] || "调疏密";
    }
    if (name === "setFontScale") {
      const fs = Number(op.fontScale);
      return Number.isFinite(fs) ? `字号 ${fs.toFixed(2)}` : "调字号";
    }
    if (name === "deleteItem") return op.index != null ? `删第${op.index}条` : "删条目";
    if (name === "updateItem") {
      const idx = op.index != null ? `第${op.index}条` : "条目";
      const val =
        op.body || op.text || op.value
          ? truncateCopilotSnippet(op.body || op.text || op.value, 20)
          : "";
      return val && val !== "（空）" ? `改${idx} → ${val}` : `改${idx}`;
    }
    if (name === "rewriteField") {
      const map = {
        title: "标题",
        subtitle: "副标题",
        text: "金句",
        body: "正文",
        intro: "导语",
        desc: "说明",
        caption: "配文",
      };
      const fieldLabel = map[op.field] || op.field || "字段";
      const val = op.value != null ? truncateCopilotSnippet(op.value, 24) : "";
      if (val && val !== "（空）") return `${fieldLabel} → ${val}`;
      return `改${fieldLabel}`;
    }
    if (name === "setPageType") {
      const map = {
        timeline: "改成时间线",
        points: "改成清单",
        quote: "改成金句",
        card: "改成卡片",
        free: "改成展开",
        compare: "改成对比",
        summary: "改成总结",
      };
      return map[op.type] || (op.type ? `换结构·${op.type}` : "换结构");
    }
    if (name === "setPointsLayout") {
      return op.layout === "ledger" ? "改成账本清单" : "改成卡片清单";
    }
    if (name === "setPageLayoutVariant") {
      const map = {
        "magazine-columns": "杂志分栏",
        "pull-quote-inline": "金句突出",
        "numbered-paragraphs": "编号段落",
        "wide-lead": "宽导语",
        "split-column": "左右分栏",
        "minimal-center": "极简居中",
        "sidebar-accent": "侧栏强调",
        "icon-bullet": "图标要点",
        "tip-box": "提示框",
        "inset-thumb": "缩略图卡",
        "roman-numeral": "罗马序号",
        "big-number": "超大章节号",
        "divider-heavy": "重分割线",
        "pill-tags": "标签 Pill",
        "left-bar-minimal": "极简左条",
        checklist: "清单体",
        "metric-cards": "指标卡片",
        "one-liner-stack": "金句叠放",
        "center-hero": "居中大字",
        "centered-hero": "居中大字",
        "left-bar": "左竖条",
        "inverted-block": "黑底反转",
        "invert-dark": "黑底反转",
      };
      return map[op.variant] || `排版·${op.variant}`;
    }
    if (name === "setLayoutRecipe") {
      return op.recipeId ? `套用菜谱·${op.recipeId}` : "套用菜谱";
    }
    if (name === "patchPath") return "改字段";
    return name || "";
  }

  function humanizeReviseSummary(summary, instruction) {
    const s = String(summary || "").trim();
    if (s) {
      return s
        .replace(/^已调整版式：/, "")
        .replace(/^已更新本页$/, "优化本页")
        .replace(/^已/, "");
    }
    const tip = String(instruction || "");
    if (/删掉?\s*第\s*2/.test(tip)) return "删第2条";
    if (/更紧凑|字体变小/.test(tip)) return "变紧凑";
    if (/智能优化/.test(tip)) return "智能优化本页";
    if (/时间线/.test(tip)) return "改成时间线";
    return "改本页";
  }

  function formatAppliedStep(applied, instruction, runMode) {
    const ops = applied && Array.isArray(applied.ops) ? applied.ops : [];
    const pills = ops.map(humanizeOp).filter(Boolean);
    const source =
      (applied && applied.source) ||
      runMode ||
      (pills.length ? "llm" : "");
    const isRules = source === "rules_fallback" || source === "rule" || source === "demo";
    const prefix = isRules ? "已用快速规则：" : "AI 已：";
    if (pills.length) {
      return { line: prefix + pills.join(" · "), pills, isRules };
    }
    const bare = humanizeReviseSummary(applied && applied.summary, instruction);
    return {
      line: prefix + (bare || "改本页"),
      pills: bare ? [bare] : ["改本页"],
      isRules,
    };
  }

  function pageNeighborBrief(idx) {
    const pages = (state.data && state.data.pages) || [];
    const p = pages[idx];
    if (!p || typeof p !== "object") return null;
    const title = String(p.title || p.text || p.no || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    return { type: p.type || "", title, role: p.role || "" };
  }

  async function sendCopilotMessage(opts) {
    if (state.copilot.loading || state.copilotEphemeral) return;
    const forced = opts && typeof opts.instruction === "string" ? opts.instruction.trim() : "";
    const rawDisplay = forced || (copilotInput && copilotInput.value ? copilotInput.value.trim() : "");
    const usedSmart = !rawDisplay;
    const displayText = usedSmart ? "智能优化本页" : rawDisplay;

    if (!state.data) {
      addCopilotMessage("error", "请先生成内容");
      setStatus("请先生成内容", "err");
      return;
    }
    if (!state.layoutConfirmed) {
      addCopilotMessage("error", "请先点预览区「开始编辑」");
      setStatus("请先点预览工具栏「开始编辑」", "err");
      return;
    }
    if (usedSmart && !state.llmConfigured) {
      addCopilotMessage(
        "error",
        "未配置 LLM，无法智能优化。请点下方快捷芯片（如「更紧凑」「删掉第2条」），或在 backend/.env 配置 Key 后重启。"
      );
      setStatus("智能优化需 LLM · 请用快捷芯片或配置 Key", "err");
      renderCopilotChips();
      return;
    }

    addCopilotMessage("user", displayText);
    if (copilotInput && !forced && !(opts && opts.keepInput)) copilotInput.value = "";

    const prevUserMsgs = state.copilot.messages.filter((m) => m.role === "user");
    const isDuplicateInstruction =
      prevUserMsgs.length >= 2 &&
      normalizeCopilotInstruction(prevUserMsgs[prevUserMsgs.length - 1].text) ===
        normalizeCopilotInstruction(prevUserMsgs[prevUserMsgs.length - 2].text);

    await runPageRevise({
      instruction: usedSmart ? "" : rawDisplay,
      usedSmart,
      userAlreadyShown: true,
      isDuplicateInstruction,
    });
  }

  async function runPageRevise(opts) {
    if (!state.data) {
      if (!(opts && opts.userAlreadyShown)) {
        addCopilotMessage("error", "请先生成内容");
      }
      setStatus("请先生成内容", "err");
      return;
    }
    if (!state.layoutConfirmed) {
      if (!(opts && opts.userAlreadyShown)) {
        addCopilotMessage("error", "请先点预览区「开始编辑」");
      }
      setStatus("请先点预览工具栏「开始编辑」", "err");
      return;
    }
    if (state.copilotEphemeral) {
      discardEphemeral();
    }
    const forced =
      opts && typeof opts.instruction === "string" ? opts.instruction.trim() : "";
    let rawInput = forced;
    const usedSmart = opts && opts.usedSmart != null ? opts.usedSmart : !rawInput;
    if (!rawInput) rawInput = SMART_OPTIMIZE_INSTR;

    const page = currentPageSnapshot();
    if (!page) {
      addCopilotMessage("error", "当前页无效");
      setStatus("当前页无效，请重选预览页", "err");
      return;
    }
    savePageUndo();
    const beforePage = state.pageUndo ? JSON.parse(JSON.stringify(state.pageUndo.page)) : null;
    state.copilotEphemeral = {
      beforePage: JSON.parse(JSON.stringify(page)),
      draftData: JSON.parse(JSON.stringify(state.data)),
      ops: [],
      instruction: rawInput,
      result: null,
    };
    state.copilot.streamMsgIdx = null;
    updateEphemeralBar();
    setCopilotLoading(true);
    setCopilotEnabled(false);
    setFlowStep(3, {
      busy: true,
      status: usedSmart ? "智能优化本页…" : "正在改这一页…",
      stage: "+1 单页",
      estimatedSeconds: state.llmConfigured ? 6 : 1,
      metaTip: state.llmConfigured
        ? "LLM 优先 · 字段级 ops"
        : "未配置 Key · 仅明确操作可走快速规则",
    });
    const signal = XHSApi.beginRequest("page_revise");
    setApiBusy("page_revise", true);
    try {
      const neighbors = {
        prev: pageNeighborBrief(state.page - 1),
        next: pageNeighborBrief(state.page + 1),
      };
      const selectedPath = XHSWysiwyg.getSelectedPath() || state.selectedPath;
      const body = {
        data: state.data,
        page_index: state.page,
        page,
        mode: "auto",
        instruction: rawInput,
        caption: captionEl.value,
        title: titleEl.value,
        style: state.style || (state.data && state.data.style) || null,
        logic_summary: state.logicSummary || (state.data && state.data.logic_summary) || [],
        neighbors,
        ...buildSupplementPayload(),
      };
      if (selectedPath) body.field_path = selectedPath;

      let result;
      const useStream = !!state.llmConfigured;
      if (useStream) {
        result = await consumePageReviseStream(body, signal, (op) => {
          feedEphemeralOp(op);
          const pill = humanizeOp(op);
          if (pill) appendCopilotStreamPill(pill);
        });
      } else {
        result = await apiFetch("/api/page/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
          timeoutMs: XHSApi.DEFAULT_TIMEOUT.page_revise,
        });
        const applied = (result && result.applied) || {};
        const ops = Array.isArray(applied.ops) ? applied.ops : [];
        for (const op of ops) {
          feedEphemeralOp(op);
          const pill = humanizeOp(op);
          if (pill) appendCopilotStreamPill(pill);
        }
      }

      if (!result || !result.data || !result.data.pages) {
        throw new Error("服务未返回更新后的页面数据");
      }
      trackLlmMeta(result.meta);
      pushTimingLog("page_revise", { meta: result.meta, mode: result.mode, ok: true });
      await document.fonts.ready;
      if (layoutIdeasEl) layoutIdeasEl.hidden = true;
      const applied = result.applied || {};
      const meta = result.meta || {};
      const calls = typeof meta.llm_calls === "number" ? meta.llm_calls : null;
      const step = formatAppliedStep(applied, rawInput, result.mode);
      const callTip = step.isRules
        ? "规则兜底"
        : calls === 1
          ? "+1 LLM"
          : calls === 0
            ? ""
            : calls > 1
              ? `+${calls} LLM`
              : "";
      const afterPage = result.data.pages[state.page];
      const diffs = computeCopilotDiffs(beforePage, afterPage, applied.ops);
      const summaryText = buildCopilotSummary(diffs, applied, rawInput, step.isRules);
      let warn = null;
      if (opts && opts.isDuplicateInstruction) {
        warn = "与上次相同指令。若预览未变，可试「删掉半句」或在预览里直接改文字。";
      } else if (!diffs.length && beforePage && afterPage) {
        const layoutOnly = ["density", "fontScale", "type"].some(
          (k) => String(beforePage[k] || "") !== String(afterPage[k] || "")
        );
        if (!layoutOnly) {
          warn = "文案似乎未变。可换更具体的说法，或在预览里点选文字直接改。";
        }
      }
      state.copilot.followUpChips = suggestFollowUpChips(afterPage, diffs, rawInput);
      finalizeCopilotStreamMessage(summaryText, {
        diffs,
        hint: "预览为 AI 建议 · 点「应用」写入或「放弃」恢复",
        warn,
        pills: step.pills,
        suffix: callTip || undefined,
      });
      showEphemeralPreview(result, { callTip });
      setStatus(`${step.line}${callTip ? " · " + callTip : ""} · 待确认`, "ok");
      if (result.mode) {
        state.runMode = result.mode;
        updateModeBanner();
      }
      setFlowStep(3);
    } catch (e) {
      clearEphemeral({ restore: true });
      state.pageUndo = null;
      updateUndoButton();
      let msg = e.message || String(e);
      if (/未配置 LLM|XHS_LLM_API_KEY|API Key/i.test(msg)) {
        msg =
          "未配置 LLM，无法 AI 编辑。请在 backend/.env 配置 XHS_LLM_API_KEY 后重启服务；" +
          "或改用「删掉第N条 / 更紧凑」等明确操作。";
      }
      const full = e.aborted ? "改页已取消" : "改失败：" + msg;
      state.copilot.streamMsgIdx = null;
      if (!e.aborted) {
        addCopilotMessage("system", "内容未变");
      }
      addCopilotMessage(e.aborted ? "system" : "error", full);
      setStatus(full, e.aborted ? "ok" : "err");
      setFlowStep(3);
    } finally {
      setApiBusy("", false);
      setCopilotLoading(false);
      setCopilotEnabled(true);
      clearProgress();
      renderPreview();
    }
  }

  if (copilotChips) {
    copilotChips.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-chip]");
      if (!btn || btn.disabled || state.copilot.loading || state.copilotEphemeral) return;
      const localRaw = btn.getAttribute("data-local-op");
      if (localRaw) {
        try {
          const ops = JSON.parse(decodeURIComponent(localRaw));
          if (Array.isArray(ops) && ops.length) {
            applyLocalPageOps(ops, { summary: (btn.textContent || "").trim() || "快捷改页" });
            addCopilotMessage("system", `已${(btn.textContent || "").trim()} · 无需 LLM`);
          }
        } catch {
          setStatus("快捷操作失败", "err");
        }
        return;
      }
      const sample = decodeURIComponent(btn.getAttribute("data-chip") || "");
      if (!sample) return;
      sendCopilotMessage({ instruction: sample });
    });
  }

  async function runLayoutIdeas() {
    if (!layoutIdeasEl) return;
    if (!state.data) {
      setStatus("请先生成内容", "err");
      return;
    }
    if (!state.layoutConfirmed) {
      setStatus("请先「开始编辑」后再看排版思路", "err");
      return;
    }
    setCopilotEnabled(false);
    setFlowStep(3, {
      busy: true,
      status: "正在生成排版思路…",
      stage: "高级",
      estimatedSeconds: state.llmConfigured ? 8 : 1,
    });
    layoutIdeasEl.hidden = false;
    layoutIdeasEl.innerHTML = `<div class="layout-idea-rationale">生成中…</div>`;
    layoutIdeasEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const signal = XHSApi.beginRequest("layout_ideas");
    setApiBusy("layout_ideas", true);
    try {
      const result = await apiFetch("/api/page/layout-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: state.data,
          page_index: state.page,
          intent: (copilotInput && copilotInput.value.trim()) || state.intent || "",
        }),
        signal,
        timeoutMs: XHSApi.DEFAULT_TIMEOUT.layout_ideas,
      });
      trackLlmMeta(result.meta);
      pushTimingLog("layout_ideas", { meta: result.meta, mode: result.mode, ok: true });
      const ideas = result.ideas || [];
      if (!ideas.length) throw new Error("未返回方案");
      layoutIdeasEl.innerHTML =
        `<p class="layout-ideas-hint">点选方案预览对比，确认后再应用</p>` +
        ideas
        .map((idea, i) => {
          const t = (idea.page && idea.page.type) || "?";
          const tZh = TYPE_LABELS[t] || t;
          const name = idea.name || `方案 ${i + 1}`;
          const why = idea.rationale || "";
          return `<button type="button" class="layout-idea-card" data-idea-idx="${i}">
            <span class="layout-idea-name">${escText(name)}</span>
            <span class="layout-idea-meta">结构 · ${escText(tZh)}</span>
            <span class="layout-idea-rationale">${escText(why)}</span>
          </button>`;
        })
        .join("") +
        `<div class="layout-preview-actions" id="layout-preview-actions" hidden>
          <button type="button" class="btn btn-sm btn-primary" id="btn-layout-apply">应用此方案</button>
          <button type="button" class="btn btn-sm" id="btn-layout-cancel">取消预览</button>
        </div>`;
      let previewIdea = null;
      layoutIdeasEl.querySelectorAll(".layout-idea-card").forEach((card) => {
        card.addEventListener("click", () => {
          const idx = +card.dataset.ideaIdx;
          const idea = ideas[idx];
          if (!idea || !idea.page || !state.data) return;
          previewIdea = idea;
          state.layoutPreview = idea.page;
          layoutIdeasEl.querySelectorAll(".layout-idea-card").forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
          const actions = $("#layout-preview-actions");
          if (actions) actions.hidden = false;
          renderPreview();
          setStatus(`预览「${idea.name || "方案"}」· 满意后点应用`, "ok");
        });
      });
      const btnApply = $("#btn-layout-apply");
      const btnCancelPreview = $("#btn-layout-cancel");
      if (btnApply) {
        btnApply.addEventListener("click", () => {
          if (!previewIdea || !previewIdea.page || !state.data) return;
          savePageUndo();
          pushHistory("排版方案");
          const pages = state.data.pages.slice();
          pages[state.page] = previewIdea.page;
          state.data = { ...state.data, pages };
          state.layoutPreview = null;
          markNeedsRereview(true);
          renderLogicSummary();
          renderPageSummary();
          syncJson();
          renderPreview();
          layoutIdeasEl.hidden = true;
          scheduleAutosave();
          setStatus(`已应用「${previewIdea.name || "方案"}」· 已改需复审`, "ok");
          previewIdea = null;
        });
      }
      if (btnCancelPreview) {
        btnCancelPreview.addEventListener("click", () => {
          state.layoutPreview = null;
          previewIdea = null;
          renderPreview();
          const actions = $("#layout-preview-actions");
          if (actions) actions.hidden = true;
          layoutIdeasEl.querySelectorAll(".layout-idea-card").forEach((c) => c.classList.remove("active"));
          setStatus("已取消预览", "ok");
        });
      }
      const meta = result.meta || {};
      const tip = formatMetaTip(meta);
      setStatus(
        `已给出 ${ideas.length} 种排版思路（${result.mode || "ok"}）${tip ? " · " + tip : ""}，点选应用`,
        "ok"
      );
      setFlowStep(3);
    } catch (e) {
      layoutIdeasEl.innerHTML = "";
      layoutIdeasEl.hidden = true;
      setStatus("排版思路失败: " + e.message, "err");
      setFlowStep(3);
    } finally {
      setApiBusy("", false);
      setCopilotEnabled(true);
      clearProgress();
    }
  }

  function setMobilePreview(on) {
    state.mobilePreview = !!on;
    if (appMain) appMain.classList.toggle("mobile-preview-on", state.mobilePreview);
    if (btnMobileClose) btnMobileClose.hidden = !state.mobilePreview;
    if (btnMobilePreview) {
      btnMobilePreview.textContent = state.mobilePreview ? "返回编辑" : "全屏预览";
    }
    requestAnimationFrame(updatePreviewScale);
  }

  function syncMobileChrome() {
    const narrow = window.matchMedia("(max-width: 960px)").matches;
    if (btnMobilePreview) btnMobilePreview.hidden = !narrow;
    if (!narrow) setMobilePreview(false);
  }

  async function checkHealth() {
    const pill = $("#health-pill");
    try {
      const j = await apiFetch("/api/health", { timeoutMs: XHSApi.DEFAULT_TIMEOUT.health });
      state.llmConfigured = !!j.llm_configured;
      state.serviceMode = j.mode === "llm" ? "llm" : "demo";
      if (!state.runMode) state.runMode = state.serviceMode;
      pill.classList.add("ok");
      pill.classList.remove("dot");
      // Demo/LLM 详情只走顶部黄条，pill 只报连通性
      pill.textContent = "服务在线";
      applyEtaLabels();
      updateModeBanner();
    } catch {
      pill.classList.remove("ok");
      pill.classList.add("dot");
      pill.textContent = "后端未连接";
      state.llmConfigured = false;
      state.serviceMode = "demo";
      applyEtaLabels();
      updateModeBanner();
    }
  }

  // photo upload
  photoDrop.addEventListener("click", () => photoInput.click());
  photoDrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      photoInput.click();
    }
  });
  photoInput.addEventListener("change", () => {
    uploadFiles(photoInput.files);
    photoInput.value = "";
  });
  photoDrop.addEventListener("dragover", (e) => {
    e.preventDefault();
    photoDrop.classList.add("dragover");
  });
  photoDrop.addEventListener("dragleave", () => photoDrop.classList.remove("dragover"));
  photoDrop.addEventListener("drop", (e) => {
    e.preventDefault();
    photoDrop.classList.remove("dragover");
    uploadFiles(e.dataTransfer.files);
  });

  // events
  btnGen.addEventListener("click", () => runGenerate());
  if (btnRetry) {
    btnRetry.addEventListener("click", () => {
      if (state.lastGenerateBody) runGenerate(state.lastGenerateBody);
    });
  }
  btnExport.addEventListener("click", () => runExport());
  if (btnExportRereview) {
    btnExportRereview.addEventListener("click", () => exportAfterRereview());
  }
  if (btnExportForce) {
    btnExportForce.addEventListener("click", () => exportForceSkipRereview());
  }
  if (btnExportCancel) {
    btnExportCancel.addEventListener("click", () => {
      hideExportChoice();
      updateExportButton();
      setStatus("已取消导出", "ok");
    });
  }
  if (copilotSend) copilotSend.addEventListener("click", () => sendCopilotMessage());
  if (copilotInput) {
    copilotInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCopilotMessage();
      }
    });
  }
  if (btnEphemeralApply) btnEphemeralApply.addEventListener("click", () => acceptEphemeral());
  if (btnEphemeralDiscard) btnEphemeralDiscard.addEventListener("click", () => discardEphemeral());
  if (copilotThread) {
    copilotThread.addEventListener("click", (ev) => {
      const diff = ev.target.closest(".copilot-diff[data-diff-path]");
      if (!diff) return;
      const path = diff.getAttribute("data-diff-path");
      if (path) scrollHighlightDiffPath(path);
    });
  }
  if (btnPageUndo) btnPageUndo.addEventListener("click", () => {
    undoPageRevise();
    closeHistoryMenu();
  });
  if (btnHistoryUndo) btnHistoryUndo.addEventListener("click", () => {
    undoHistory();
    closeHistoryMenu();
  });
  if (btnHistoryRedo) btnHistoryRedo.addEventListener("click", () => {
    redoHistory();
    closeHistoryMenu();
  });
  if (btnPageDup) {
    btnPageDup.addEventListener("click", () => {
      applyLocalDocOps([{ op: "duplicatePage", index: state.page + 1 }], { summary: "复制本页" });
    });
  }
  if (btnPageDel) {
    btnPageDel.addEventListener("click", () => {
      if (!confirm(`删除第 ${state.page + 1} 页？`)) return;
      applyLocalDocOps([{ op: "deletePage", index: state.page + 1 }], { summary: "删页" });
    });
  }
  if (btnPageAdd) {
    btnPageAdd.addEventListener("click", () => {
      applyLocalDocOps([{ op: "insertPage", index: state.page + 1, type: "card" }], { summary: "加页" });
    });
  }
  if (btnCancelRequest) {
    btnCancelRequest.addEventListener("click", () => {
      XHSApi.cancelRequest();
      setApiBusy("", false);
      clearProgress();
      if (btnGen) btnGen.disabled = false;
      if (state.review) renderReviewUI();
      setStatus("已取消请求", "ok");
    });
  }
  if (btnRecoverDraft) {
    btnRecoverDraft.addEventListener("click", () => {
      if (state.pendingRecovery) hydrateFromProject(state.pendingRecovery);
      if (draftRecoveryBar) draftRecoveryBar.hidden = true;
      state.pendingRecovery = null;
      setStatus("已恢复草稿", "ok");
    });
  }
  if (btnDiscardDraft) {
    btnDiscardDraft.addEventListener("click", async () => {
      if (state.pendingRecovery && state.pendingRecovery.id) {
        try {
          await XHSProjectStore.deleteProject(state.pendingRecovery.id);
        } catch {
          /* ignore */
        }
      }
      state.pendingRecovery = null;
      if (draftRecoveryBar) draftRecoveryBar.hidden = true;
    });
  }
  if (btnExportBlockersClose) {
    btnExportBlockersClose.addEventListener("click", () => {
      if (exportBlockersBar) exportBlockersBar.hidden = true;
    });
  }
  if (btnLayoutIdeas) btnLayoutIdeas.addEventListener("click", runLayoutIdeas);
  if (btnStartEdit) btnStartEdit.addEventListener("click", startEditCurrentPage);
  if (btnOverflowCompact) btnOverflowCompact.addEventListener("click", () => runOverflowCompact());
  if (btnOverflowDeleteLast) btnOverflowDeleteLast.addEventListener("click", () => runOverflowDeleteLast());
  if (btnOverflowSplit) btnOverflowSplit.addEventListener("click", () => splitPageOverflow());
  if (btnExpandIntent) {
    btnExpandIntent.addEventListener("click", () => {
      collapseIntentPanel(false);
      if (intentEl) intentEl.focus();
    });
  }
  if (btnThemeMore) {
    btnThemeMore.addEventListener("click", () => {
      state.themeExpanded = !state.themeExpanded;
      renderThemeGrid();
    });
  }
  if (btnMobilePreview) {
    btnMobilePreview.addEventListener("click", () => setMobilePreview(!state.mobilePreview));
  }
  if (btnMobileClose) {
    btnMobileClose.addEventListener("click", () => setMobilePreview(false));
  }
  btnApplyReview.addEventListener("click", runApplyReview);
  btnRerunReview.addEventListener("click", () => runReview({ light: true }));
  if (btnConfirmLayout) {
    btnConfirmLayout.addEventListener("click", () => confirmLayout({}));
  }
  btnCopyTitle.addEventListener("click", () => copyText(titleEl.value || state.title, btnCopyTitle));
  btnCopyCaption.addEventListener("click", () => copyText(captionEl.value || state.caption, btnCopyCaption));
  btnPrev.addEventListener("click", () => {
    if (state.page > 0) {
      if (state.copilotEphemeral) discardEphemeral();
      state.page--;
      renderPreview();
    }
  });
  btnNext.addEventListener("click", () => {
    if (state.data && state.page < state.data.pages.length - 1) {
      if (state.copilotEphemeral) discardEphemeral();
      state.page++;
      renderPreview();
    }
  });
  if (titleEl) {
    titleEl.addEventListener("input", () => {
      state.title = titleEl.value;
      if (state.review) markNeedsRereview(true);
      scheduleAutosave();
    });
  }
  captionEl.addEventListener("input", () => {
    state.caption = captionEl.value;
    if (state.review) markNeedsRereview(true);
    scheduleAutosave();
  });
  if (supplementEl) {
    supplementEl.addEventListener("input", () => {
      syncSupplementFromDom();
      scheduleAutosave();
    });
  }
  window.addEventListener("beforeunload", (e) => {
    if (state.data && (state.needsRereview || state.history.past.length)) {
      e.preventDefault();
      e.returnValue = "";
    }
    XHSProjectStore.flushSave(() => buildProjectSnapshot());
  });
  window.addEventListener("pagehide", () => {
    XHSProjectStore.flushSave(() => buildProjectSnapshot());
  });
  window.addEventListener("resize", () => {
    updatePreviewScale();
    syncMobileChrome();
  });

  // init
  syncPostGenPanel();
  XHSEngine.applyTheme(state.style, window.XHS_THEMES);
  renderThemeGrid();
  syncCopilot();
  updateSupplementCopilotHint();
  renderHooks();
  renderReviseChips();
  renderPreview();
  setFlowStep(1);
  updateExportButton();
  updateHistoryButtons();
  renderTimingLog();
  syncMobileChrome();
  checkHealth();
  initProjectRecovery();
  if (draftPicker) {
    draftPicker.addEventListener("change", async () => {
      const id = draftPicker.value;
      if (!id || id === state.projectId) return;
      try {
        const snap = await XHSProjectStore.getProject(id);
        if (snap && snap.data) {
          hydrateFromProject(snap);
          setStatus("已加载草稿", "ok");
        }
      } catch (e) {
        setStatus("加载草稿失败: " + e.message, "err");
      }
    });
  }
})();
