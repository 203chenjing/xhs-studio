(() => {
  const DEBOUNCE_MS = 900;
  const SUBMIT_DELAYS_MS = JobTrackerConstants.CAPTURE_SUBMIT_DELAYS_MS || [2800, 6000];
  const SESSION_PREFIX = 'jt_saved_';
  const MAX_PAGE_TEXT = 1200;

  let lastAutoKey = '';
  let debounceTimer = null;
  let submitRetryTimers = [];

  function isActivePage() {
    const url = location.href;
    return JobTrackerExtractors.matchRule(url) || JobTrackerExtractors.isRecruitmentPage(url);
  }

  /** 仅详情/投递/成功/测评页才自动记录，列表页跳过 */
  function shouldAutoCapture() {
    if (!isActivePage()) return false;
    if (JobTrackerExtractors.isListPage()) return false;
    if (JobTrackerExtractors.isCapturePage()) return true;
    return !!JobTrackerExtractors.detectAutoStatus(
      document.body?.innerText || '',
      JobTrackerExtractors.matchRule(location.href)
    );
  }

  function getPageText() {
    const parts = [];
    const pick = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    };
    const h1 = pick('h1');
    if (h1) parts.push(h1);
    const success = pick('[class*="success"], [class*="Success"], [class*="result"]');
    if (success) parts.push(success.slice(0, 240));
    const main = pick('main, [class*="detail"], [class*="job-title"], [class*="content"]');
    if (main && main !== h1) parts.push(main.slice(0, 600));
    if (!parts.length) {
      const clone = document.body?.cloneNode(true);
      if (clone) {
        clone.querySelectorAll('script, style, noscript, svg, iframe, nav, footer').forEach((el) => el.remove());
        parts.push((clone.innerText || '').replace(/\s+/g, ' ').trim());
      }
    }
    return parts.join(' | ').slice(0, MAX_PAGE_TEXT);
  }

  function getHeuristicInfo() {
    if (typeof JobTrackerExtractHeuristics !== 'undefined') {
      return JobTrackerExtractHeuristics.extract(location.href);
    }
    return JobTrackerExtractors.extractPageInfo(location.href);
  }

  function getPageContext(source) {
    const info = getHeuristicInfo();
    const auto = JobTrackerExtractors.detectAutoStatus(
      document.body?.innerText || '',
      JobTrackerExtractors.matchRule(location.href)
    );
    return {
      url: location.href,
      title: document.title || '',
      text: getPageText(),
      source,
      ruleExtraction: {
        company: info.company,
        position: info.position,
        platform: info.platform,
        defaultStatus: info.defaultStatus,
        defaultNote: info.defaultNote,
        ruleId: info.ruleId,
        matchQuality: info.company && info.position ? 80 : info.company || info.position ? 50 : 0,
        metaCompany: info.companySource === 'meta' || info.companySource === 'jsonld' ? info.company : '',
        metaPosition: info.positionSource === 'meta' || info.positionSource === 'jsonld' ? info.position : '',
        extractionSources: info.sources || [],
        auto
      }
    };
  }

  function sessionKey(record) {
    return `${SESSION_PREFIX}${record.company}|${record.position}|${record.status}|${record.applyDate}|${location.hostname}`;
  }

  function alreadySaved(record) {
    const key = `${record.company}|${record.position}|${record.status}|${record.applyDate}`;
    if (key === lastAutoKey) return true;
    try {
      if (sessionStorage.getItem(sessionKey(record))) return true;
    } catch (_) {}
    return false;
  }

  function markSaved(record) {
    const key = `${record.company}|${record.position}|${record.status}|${record.applyDate}`;
    lastAutoKey = key;
    try {
      sessionStorage.setItem(sessionKey(record), '1');
    } catch (_) {}
  }

  function sendSave(record, pageContext) {
    return chrome.runtime.sendMessage({ type: 'SAVE_RECORD', record, pageContext }).catch(() => null);
  }

  async function startFillSession() {
    const snap = getPageSnapshot();
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GET_RESUME'
      }).catch(() => null);
      const profile = res?.profile || {};
      await chrome.runtime.sendMessage({
        type: 'FILL_SESSION_START',
        ctx: {
          url: location.href,
          company: snap.company,
          position: snap.position,
          resumeVersionId: profile._versionId || '',
          resumeVersionName: profile._versionName || ''
        }
      });
    } catch (_) {}
  }

  async function markFilled() {
    const snap = getPageSnapshot();
    const pageContext = getPageContext('mark-filled');
    await startFillSession();
    const fillRes = await chrome.runtime.sendMessage({ type: 'GET_FILL_SESSION' }).catch(() => null);
    const session = fillRes?.session;
    let record = session
      ? JobTrackerFillSession.buildRecordFromSession(session, {
          company: snap.company,
          position: snap.position,
          url: location.href,
          source: 'mark-filled'
        })
      : null;
    if (!record) {
      record = {
        company: snap.company,
        position: snap.position,
        status: '已填表',
        fillStatus: '已填表',
        url: location.href,
        source: 'mark-filled'
      };
    }
    lastAutoKey = '';
    const res = await sendSave(record, pageContext);
    await chrome.runtime.sendMessage({ type: 'FILL_SESSION_COMPLETE' }).catch(() => null);
    return res;
  }

  window.__jtMarkFilled = markFilled;

  function getPageSnapshot() {
    const info = getHeuristicInfo();
    const auto = JobTrackerExtractors.detectAutoStatus(
      document.body?.innerText || '',
      JobTrackerExtractors.matchRule(location.href)
    );
    return { ...info, auto };
  }

  async function saveFromPage(overrides = {}) {
    const source = overrides.source || 'auto';
    const manual = source === 'popup' || source === 'manual-panel';
    if (!manual && !shouldAutoCapture()) return null;
    if (!isActivePage() && !manual) return null;
    const snap = getPageSnapshot();
    const pageContext = getPageContext(source);
    const record = {
      company: overrides.company ?? snap.company,
      position: overrides.position ?? snap.position,
      status: overrides.status ?? snap.auto?.status ?? snap.defaultStatus ?? '已投递',
      fillStatus: overrides.fillStatus ?? overrides.status ?? snap.auto?.status ?? snap.defaultStatus ?? '已投递',
      note: overrides.note ?? snap.auto?.note ?? snap.defaultNote ?? '',
      applyDate: overrides.applyDate ?? JobTrackerConstants.formatApplyDate(),
      url: location.href,
      platform: snap.platform,
      source
    };

    const hasAutoSuccess = !!snap.auto;
    const hasIdentity = record.company || record.position;
    const hasContext = record.note || record.platform;

    if (!hasIdentity && !record.note && !record.platform) return null;
    if (!hasIdentity && !hasAutoSuccess && source !== 'popup') return null;
    if (!hasIdentity && hasAutoSuccess && hasContext && source !== 'popup') {
      if (!record.company && record.platform) record.company = record.platform;
    }
    if (!record.company && !record.position && !hasAutoSuccess && source !== 'popup') return null;
    if (alreadySaved(record)) return null;

    markSaved(record);
    return sendSave(record, pageContext);
  }

  function tryAutoDetect() {
    if (!shouldAutoCapture()) return;
    const auto = JobTrackerExtractors.detectAutoStatus(
      document.body?.innerText || '',
      JobTrackerExtractors.matchRule(location.href)
    );
    if (auto) {
      saveFromPage({ status: auto.status, note: auto.note, source: 'auto-detect' });
    }
  }

  function scheduleSubmitCapture() {
    clearSubmitRetries();
    for (const delay of SUBMIT_DELAYS_MS) {
      submitRetryTimers.push(
        setTimeout(() => {
          const auto = JobTrackerExtractors.detectAutoStatus(
            document.body?.innerText || '',
            JobTrackerExtractors.matchRule(location.href)
          );
          if (!auto) return;
          saveFromPage({ status: auto.status, note: auto.note, source: 'auto-click' });
        }, delay)
      );
    }
  }

  function clearSubmitRetries() {
    for (const t of submitRetryTimers) clearTimeout(t);
    submitRetryTimers = [];
  }

  function watchSuccessMessages() {
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tryAutoDetect, DEBOUNCE_MS);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    setTimeout(tryAutoDetect, 1200);
  }

  function watchSubmitClicks() {
    document.addEventListener(
      'click',
      (e) => {
        if (!shouldAutoCapture()) return;
        const btn = e.target.closest('button, a, [role="button"], input[type="submit"]');
        if (!btn) return;
        const label = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
        if (!/投递|申请|提交|确认.*(投递|申请)|立即申请|提交简历|确认提交/.test(label)) return;
        scheduleSubmitCapture();
      },
      true
    );
  }

  function maybeShowOnboarding() {
    if (!isActivePage() || document.getElementById('jt-onboarding-tip')) return;
    chrome.storage.local.get('jt_onboarding_seen', (data) => {
      if (data?.jt_onboarding_seen) return;
      const tip = document.createElement('div');
      tip.id = 'jt-onboarding-tip';
      tip.className = 'jt-onboarding-tip';
      tip.innerHTML =
        '<span>扩展已就绪：正常投递会自动记入台账</span><button type="button" class="jt-tip-dismiss">知道了</button>';
      document.body.appendChild(tip);
      tip.querySelector('.jt-tip-dismiss')?.addEventListener('click', () => {
        tip.remove();
        chrome.storage.local.set({ jt_onboarding_seen: true });
      });
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_INFO') {
      const snap = getPageSnapshot();
      sendResponse({ ...snap, pageContext: getPageContext('popup') });
      return true;
    }
    if (msg.type === 'SAVE_FROM_POPUP') {
      lastAutoKey = '';
      saveFromPage({ ...msg.record, source: 'popup' }).then(sendResponse);
      return true;
    }
    if (msg.type === 'MARK_PREPARED') {
      lastAutoKey = '';
      saveFromPage({ status: '已准备简历', fillStatus: '已准备简历', source: 'manual-panel' }).then((res) => {
        sendResponse(res || { ok: false, error: '无法识别公司与岗位' });
      });
      return true;
    }
    if (msg.type === 'MARK_FILLED') {
      markFilled().then((res) => {
        sendResponse(res || { ok: false, error: '无法识别公司与岗位' });
      });
      return true;
    }
    if (msg.type === 'START_FILL_SESSION') {
      startFillSession().then(() => sendResponse({ ok: true }));
      return true;
    }
  });

  if (isActivePage()) {
    startFillSession();
    watchSuccessMessages();
    watchSubmitClicks();
    maybeShowOnboarding();

    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        lastAutoKey = '';
        clearSubmitRetries();
        setTimeout(tryAutoDetect, 400);
        setTimeout(tryAutoDetect, 1600);
      }
    }, 800);

    window.addEventListener('beforeunload', () => {
      chrome.runtime.sendMessage({ type: 'FILL_SESSION_COMPLETE' }).catch(() => {});
    });
  }
})();
