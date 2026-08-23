(() => {
  if (window.__jtAutofillInit) return;
  window.__jtAutofillInit = true;

  const SHADOW_CSS = `
:host {
  all: initial;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #1e293b;
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  direction: ltr;
  -webkit-text-size-adjust: 100%;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.jt-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 10px 8px;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  z-index: 1;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: -2px 2px 10px rgba(37, 99, 235, 0.35);
  pointer-events: auto;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

:host(.jt-sidebar-open) .jt-toggle {
  display: none;
}

.jt-sidebar {
  position: fixed;
  top: 80px;
  right: -360px;
  width: 320px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  background: #fff;
  z-index: 2;
  transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s ease;
  border: 1px solid #e5e7eb;
  border-right: none;
  border-radius: 12px 0 0 12px;
  box-shadow: -4px 4px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  pointer-events: auto;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: #1e293b;
  writing-mode: horizontal-tb;
  direction: ltr;
}

.jt-sidebar.jt-visible {
  right: 0;
  box-shadow: -8px 8px 32px rgba(0, 0, 0, 0.16);
}

.jt-head {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  flex-shrink: 0;
}

.jt-head-title {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.jt-head-title strong {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

.jt-head-meta {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.92;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.jt-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: 0;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}

.jt-close:hover {
  background: rgba(255, 255, 255, 0.28);
}

.jt-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  flex-shrink: 0;
}

.jt-version-select {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  color: #1e293b;
  background: #fff;
}

.jt-toolbar-btns {
  display: flex;
  flex-direction: row;
  gap: 4px;
  flex-shrink: 0;
}

.jt-tool-btn {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.2;
  white-space: nowrap;
}

.jt-tool-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.jt-quick-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid #eee;
  background: #fff;
  flex-shrink: 0;
}

.jt-quick-btn {
  padding: 5px 10px;
  border: 1px dashed #94a3b8;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}

.jt-quick-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}

.jt-quick-primary {
  flex: 1;
  border-style: solid;
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 600;
  font-size: 12px;
  padding: 8px 12px;
}

.jt-empty-secondary {
  background: #fff;
  color: #2563eb;
  border: 1px solid #93c5fd;
  margin-top: 8px;
}

.jt-search-wrap {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
  background: #fff;
}

.jt-privacy-label {
  font-size: 11px;
  margin-top: 6px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  color: #64748b;
  cursor: pointer;
}

.jt-search {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  color: #1e293b;
  background: #fff;
  font-family: inherit;
  line-height: normal;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.jt-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 12px;
  background: #fff;
}

.jt-group {
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  background: #fff;
}

.jt-group-head {
  padding: 8px 10px;
  background: #f8fafc;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.jt-group-head:hover {
  background: #f1f5f9;
}

.jt-chevron {
  font-size: 10px;
  color: #94a3b8;
  transition: transform 0.2s ease;
  display: inline-block;
}

.jt-group:not(.jt-collapsed) .jt-chevron {
  transform: rotate(90deg);
}

.jt-group.jt-collapsed .jt-group-body {
  display: none;
}

.jt-count {
  font-weight: 400;
  color: #94a3b8;
  font-size: 12px;
}

.jt-group-body {
  padding: 6px 8px 8px;
  background: #fff;
}

.jt-item {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.jt-fill {
  flex-shrink: 0;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1.3;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.jt-fill:hover {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.jt-preview {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jt-footer {
  flex-shrink: 0;
  padding: 10px 12px;
  border-top: 1px solid #eee;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.jt-footer-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 8px;
}

.jt-footer-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 8px 6px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  text-align: center;
  line-height: 1.3;
  font-family: inherit;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.jt-footer-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.jt-footer-primary:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.jt-footer-btn:hover:not(:disabled) {
  border-color: #94a3b8;
}

.jt-footer-more {
  flex: 0 1 auto;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  border-style: dashed;
}

.jt-footer-more:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.jt-footer-more:disabled {
  opacity: 0.6;
  cursor: wait;
}

.jt-footer-main {
  width: 100%;
  flex: none;
  padding: 10px 12px;
  font-size: 14px;
}

.jt-more {
  font-size: 11px;
  color: #64748b;
}

.jt-more summary {
  cursor: pointer;
  padding: 4px 0;
  list-style: none;
}

.jt-more-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
}

.jt-more-body .jt-footer-btn {
  flex: none;
  width: 100%;
}

.jt-msg {
  display: block;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
  color: #94a3b8;
  background: #f8fafc;
  margin: 0;
  padding: 0;
}

.jt-msg-ok {
  color: #16a34a;
}

.jt-msg-warn {
  color: #d97706;
}

.jt-msg-err {
  color: #dc2626;
}

.jt-hidden-content .jt-preview {
  display: none;
}

.jt-empty-state {
  text-align: center;
  padding: 24px 16px;
  background: #fff;
}

.jt-empty-hint {
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  margin: 0 0 4px;
}

.jt-empty-sub {
  color: #64748b;
  font-size: 12px;
  margin: 0 0 12px;
}

.jt-empty-link {
  display: inline-block;
  padding: 8px 16px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
}

.jt-empty-link:hover {
  background: #1d4ed8;
}
`;

  function shouldShow() {
    if (JobTrackerATS.detect()) return true;
    return JobTrackerExtractors.isRecruitmentPage(location.href) || !!document.querySelector('form input, form textarea');
  }

  if (!shouldShow()) return;

  class AutofillSidebar {
    constructor() {
      this.root = null;
      this.shadow = null;
      this.sidebar = null;
      this.toggleBtn = null;
      this.isVisible = false;
      this.currentInput = null;
      this.inputs = [];
      this.profile = { sidebarGroups: [] };
      this.versionMeta = { versions: [], activeVersionId: '' };
      this.hideContent = false;
      this.autoFilledOnce = false;
      this.init();
    }

    async startFillSession() {
      const info = JobTrackerExtractors.extractPageInfo(location.href);
      try {
        await chrome.runtime.sendMessage({
          type: 'FILL_SESSION_START',
          ctx: {
            url: location.href,
            company: info.company || '',
            position: info.position || '',
            resumeVersionId: this.profile._versionId || '',
            resumeVersionName: this.profile._versionName || ''
          }
        });
      } catch (_) {}
    }

    async init() {
      await this.loadProfile();
      await this.loadVersions();
      this.createUI();
      this.bindGlobalEvents();
      await this.startFillSession();
      this.scheduleAutoFillOnLoad();
    }

    async scheduleAutoFillOnLoad() {
      if (!this.profile.sidebarGroups?.length) return;
      const ats = JobTrackerATS.detect();
      // 仅首轮 + 末轮补填，避免多 pass 反复扰动页面
      const allDelays = ats?.multiPassDelays?.length ? ats.multiPassDelays : [Math.max(ats?.loadDelay || 800, 800)];
      const delays =
        allDelays.length > 1
          ? [allDelays[0], allDelays[allDelays.length - 1]].filter((d, i, arr) => arr.indexOf(d) === i)
          : allDelays;
      delays.forEach((delay, i) => {
        setTimeout(() => this.maybeAutoFillOnLoad(i), delay);
      });
    }

    async maybeAutoFillOnLoad(passIndex = 0) {
      if (passIndex === 0 && this.autoFilledOnce) return;
      if (!this.profile.sidebarGroups?.length) {
        if (passIndex === 0) {
          this.show();
          this.msg('请先导入档案或编辑简历', 'warn');
        }
        return;
      }
      let autoRun = true;
      try {
        const s = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        autoRun = s?.settings?.ai?.autofillAutoRun !== false;
      } catch (_) {}
      if (!autoRun) return;
      if (passIndex === 0) {
        this.autoFilledOnce = true;
        this.show();
      }
      await this.autoFillAll(passIndex > 0);
    }

    async loadProfile() {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_RESUME' });
        this.profile = res?.profile || { sidebarGroups: [] };
      } catch (_) {
        this.profile = { sidebarGroups: [] };
      }
    }

    createUI() {
      const old = document.getElementById('jt-autofill-root');
      if (old) old.remove();

      this.root = document.createElement('div');
      this.root.id = 'jt-autofill-root';

      this.shadow = this.root.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = SHADOW_CSS;
      this.shadow.appendChild(style);

      this.toggleBtn = document.createElement('button');
      this.toggleBtn.type = 'button';
      this.toggleBtn.className = 'jt-toggle';
      this.toggleBtn.textContent = '填表助手';
      this.toggleBtn.title = '填表助手 · 编辑简历、一键填充';

      this.sidebar = document.createElement('div');
      this.sidebar.className = 'jt-sidebar';
      this.sidebar.innerHTML = this.buildHTML();

      this.shadow.appendChild(this.toggleBtn);
      this.shadow.appendChild(this.sidebar);
      document.documentElement.appendChild(this.root);

      this.toggleBtn.addEventListener('click', () => this.toggle());
      this.bindSidebarEvents();
    }

    async loadVersions() {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_RESUME_VERSIONS' });
        this.versionMeta = res?.meta || { versions: [], activeVersionId: '' };
      } catch (_) {
        this.versionMeta = { versions: [], activeVersionId: '' };
      }
    }

    async refreshSidebar() {
      await this.loadProfile();
      await this.loadVersions();
      this.sidebar.innerHTML = this.buildHTML();
      this.bindSidebarEvents();
    }

    buildHTML() {
      const groups = this.profile.sidebarGroups || [];
      const versions = this.versionMeta?.versions || [];
      const versionOptions = versions.length
        ? versions
            .map(
              (v) =>
                `<option value="${escAttr(v.id)}" ${v.id === this.versionMeta.activeVersionId ? 'selected' : ''}>${esc(v.name)}</option>`
            )
            .join('')
        : `<option value="default">默认版本</option>`;
      const hasProfile = groups.length > 0;
      const groupsHTML = hasProfile
        ? groups
            .map(
              (g, gi) => `
          <div class="jt-group" data-group="${gi}">
            <div class="jt-group-head" data-toggle-group="${gi}">
              <span class="jt-chevron">▸</span>
              ${esc(g.group)} <span class="jt-count">(${g.items.length})</span>
            </div>
            <div class="jt-group-body">
              ${g.items
                .map(
                  (item) => `
                <div class="jt-item">
                  <button type="button" class="jt-fill" data-value="${escAttr(item.value)}" data-label="${escAttr(item.label)}">${esc(item.label)}</button>
                  <span class="jt-preview">${esc(trunc(item.value, 24))}</span>
                </div>`
                )
                .join('')}
            </div>
          </div>`
            )
            .join('')
        : `<div class="jt-empty-state">
            <p class="jt-empty-hint">还没有简历数据</p>
            <p class="jt-empty-sub">首次使用：导入档案或编辑简历，之后进网申页会自动填充</p>
            <button type="button" class="jt-empty-link" id="jt-empty-import">导入我的档案</button>
            <button type="button" class="jt-empty-link jt-empty-secondary" id="jt-empty-resume">编辑简历</button>
          </div>`;

      const quickBar = hasProfile
        ? `<button type="button" id="jt-mark-filled" class="jt-quick-btn jt-quick-primary">填完了</button>`
        : `<button type="button" id="jt-import-seed" class="jt-quick-btn jt-quick-primary">导入我的档案</button>`;

      return `
        <div class="jt-head">
          <div class="jt-head-title">
            <strong>填表助手</strong>
            <span class="jt-head-meta">${esc(this.profile._versionName || '未导入')} · <span id="jt-head-count">已填 0 项</span></span>
          </div>
          <button type="button" class="jt-close" id="jt-close">×</button>
        </div>
        <div class="jt-toolbar">
          <select id="jt-version" class="jt-version-select" title="切换简历版本">${versionOptions}</select>
          <div class="jt-toolbar-btns">
            <button type="button" id="jt-open-resume" class="jt-tool-btn">简历</button>
            <button type="button" id="jt-settings" class="jt-tool-btn" title="设置">⚙</button>
          </div>
        </div>
        <div class="jt-quick-bar">${quickBar}</div>
        <div class="jt-search-wrap" ${hasProfile ? '' : 'hidden'}>
          <input class="jt-search" id="jt-search" placeholder="搜索字段…">
        </div>
        <div class="jt-body" id="jt-body">${groupsHTML}</div>
        <div class="jt-footer">
          <button type="button" id="jt-auto-all" class="jt-footer-btn jt-footer-primary jt-footer-main">自动填充</button>
          <details class="jt-more">
            <summary>更多</summary>
            <div class="jt-more-body">
              <button type="button" id="jt-agent-fill" class="jt-footer-btn">补填下拉/日期</button>
              <button type="button" id="jt-ai-field" class="jt-footer-btn">填当前字段</button>
              <button type="button" id="jt-ai-essay" class="jt-footer-btn">AI 写开放题</button>
              <button type="button" id="jt-next" class="jt-footer-btn">下一个输入框</button>
              <button type="button" id="jt-refresh" class="jt-footer-btn">刷新字段</button>
            </div>
          </details>
          <p id="jt-msg" class="jt-msg">打开网申页会自动填充；漏项点「补填下拉/日期」</p>
        </div>`;
    }

    bindSidebarEvents() {
      this.sidebar.querySelector('#jt-close')?.addEventListener('click', () => this.hide());
      this.sidebar.querySelector('#jt-open-resume')?.addEventListener('click', () => this.openResume());
      this.sidebar.querySelector('#jt-empty-resume')?.addEventListener('click', () => this.openResume());
      this.sidebar.querySelector('#jt-empty-import')?.addEventListener('click', () => this.importSeedProfile());
      this.sidebar.querySelector('#jt-settings')?.addEventListener('click', () => this.openSettings());
      this.sidebar.querySelector('#jt-refresh')?.addEventListener('click', () => this.manualRefresh());
      this.sidebar.querySelector('#jt-version')?.addEventListener('change', (e) => this.switchVersion(e.target.value));
      this.sidebar.querySelector('#jt-import-seed')?.addEventListener('click', () => this.importSeedProfile());
      this.sidebar.querySelector('#jt-mark-filled')?.addEventListener('click', () => this.markFilled());
      this.sidebar.querySelector('#jt-next')?.addEventListener('click', () => this.jumpNext());
      this.sidebar.querySelector('#jt-auto-all')?.addEventListener('click', () => this.autoFillAll());
      this.sidebar.querySelector('#jt-search')?.addEventListener('input', (e) => this.filter(e.target.value));
      this.sidebar.querySelectorAll('[data-toggle-group]').forEach((head) => {
        head.addEventListener('click', () => {
          const group = head.closest('.jt-group');
          group?.classList.toggle('jt-collapsed');
        });
      });
      this.sidebar.querySelectorAll('.jt-fill').forEach((btn) => {
        btn.addEventListener('click', () => {
          const label = btn.getAttribute('data-label') || btn.textContent?.trim();
          this.fillByLabel(label, btn.getAttribute('data-value'));
        });
      });
      this.sidebar.querySelector('#jt-ai-essay')?.addEventListener('click', () => this.aiFillEssay());
      this.sidebar.querySelector('#jt-agent-fill')?.addEventListener('click', () => this.agentFillRemaining());
      this.sidebar.querySelector('#jt-ai-field')?.addEventListener('click', () => this.aiFillCurrentField());
      this.refreshFooterCount();
    }

    openResume() {
      chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_PAGE', path: 'resume/resume.html' }).catch(() => {});
    }

    openSettings() {
      chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_PAGE', path: 'options/options.html' }).catch(() => {});
    }

    async manualRefresh() {
      this.msg('刷新中…', 'warn');
      await this.refreshSidebar();
      this.msg('字段已更新', 'ok');
    }

    async switchVersion(id) {
      if (!id) return;
      try {
        await chrome.runtime.sendMessage({ type: 'SET_ACTIVE_VERSION', id });
        await this.refreshSidebar();
        await this.startFillSession();
        this.msg('已切换简历版本', 'ok');
      } catch (_) {
        this.msg('切换版本失败', 'err');
      }
    }

    async importSeedProfile() {
      this.msg('导入通用档案…', 'warn');
      try {
        const res = await chrome.runtime.sendMessage({ type: 'IMPORT_SEED_PROFILE' });
        if (!res?.ok) throw new Error(res?.error || '导入失败');
        await this.refreshSidebar();
        this.msg(`已导入「${res.name}」`, 'ok');
      } catch (err) {
        this.msg(err.message || '导入失败', 'err');
      }
    }

    async markFilled() {
      try {
        if (typeof window.__jtMarkFilled === 'function') {
          const res = await window.__jtMarkFilled();
          if (res?.ok) {
            this.msg('已标记填表并记入台账', 'ok');
            return;
          }
        }
        await chrome.runtime.sendMessage({ type: 'FILL_SESSION_COMPLETE' });
        this.msg('已结束填表会话', 'ok');
      } catch (_) {
        this.msg('标记失败', 'err');
      }
    }

    highlightInput(el) {
      if (!el || !el.style) return;
      const prev = el.style.outline;
      const prevTransition = el.style.transition;
      el.style.transition = 'outline 0.15s ease';
      el.style.outline = '3px solid #2563eb';
      el.style.outlineOffset = '2px';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        el.style.outline = '3px solid #f59e0b';
        setTimeout(() => {
          el.style.outline = prev;
          el.style.transition = prevTransition;
        }, 600);
      }, 400);
    }

    async refreshFooterCount() {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_FILL_SESSION' });
        const n = res?.summary?.filledFieldCount || 0;
        const countEl = this.sidebar?.querySelector('#jt-head-count');
        if (countEl) countEl.textContent = `已填 ${n} 项`;
      } catch (_) {}
    }

    getFocusedQuestion() {
      const el = this.currentInput;
      if (!el || el.tagName !== 'TEXTAREA') return null;
      const label = JobTrackerATS.getFieldLabel(el, JobTrackerATS.detect()) || el.placeholder || el.name || '开放题';
      return { el, question: label };
    }

    async aiFillEssay() {
      const focused = this.getFocusedQuestion();
      if (!focused) return this.msg('请先点击开放题 textarea', 'warn');
      const btn = this.sidebar.querySelector('#jt-ai-essay');
      if (btn) btn.disabled = true;
      this.msg('AI 生成中…', 'warn');
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'AI_FILL_ESSAY',
          question: focused.question
        });
        if (!res?.ok) throw new Error(res?.error || '生成失败');
        await JobTrackerFillEngine.fillElement(focused.el, res.text);
        await chrome.runtime.sendMessage({ type: 'FILL_SESSION_TRACK', label: `开放题·${focused.question}` });
        await this.refreshFooterCount();
        this.msg('开放题已生成，请核对后修改', 'ok');
      } catch (err) {
        this.msg(err.message || 'AI 失败', 'err');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    isInternalNode(node) {
      if (!node) return false;
      return node === this.root || this.shadow?.contains(node);
    }

    bindGlobalEvents() {
      document.addEventListener('focusin', (e) => {
        const t = e.target;
        if (
          t &&
          (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
        ) {
          if (!this.isInternalNode(t)) {
            this.currentInput = t;
            if (this.isVisible) this.highlightInput(t);
          }
        }
      });

      chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
        if (msg.type === 'TOGGLE_AUTOFILL') {
          this.toggle();
          sendResponse({ ok: true });
        }
        if (msg.type === 'AUTOFILL_ALL') {
          this.show();
          this.autoFillAll().then(() => sendResponse({ ok: true }));
          return true;
        }
        if (msg.type === 'REFRESH_AUTOFILL') {
          this.refreshSidebar().then(() => sendResponse({ ok: true }));
          return true;
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.job_tracker_resume || changes.job_tracker_resume_meta) {
          this.refreshSidebar().catch(() => {});
        }
      });
    }

    toggle() {
      this.isVisible ? this.hide() : this.show();
    }

    show() {
      this.sidebar.classList.add('jt-visible');
      this.root.classList.add('jt-sidebar-open');
      this.isVisible = true;
      this.startFillSession();
    }

    hide() {
      this.sidebar.classList.remove('jt-visible');
      this.root.classList.remove('jt-sidebar-open');
      this.isVisible = false;
    }

    filter(keyword) {
      const q = (keyword || '').trim().toLowerCase();
      this.sidebar.querySelectorAll('.jt-item').forEach((item) => {
        const label = item.querySelector('.jt-fill')?.textContent?.toLowerCase() || '';
        const val = item.querySelector('.jt-fill')?.getAttribute('data-value')?.toLowerCase() || '';
        item.style.display = !q || label.includes(q) || val.includes(q) ? '' : 'none';
      });
    }

    jumpNext() {
      this.inputs = JobTrackerFillEngine.scanInputs(document, this.root);
      if (!this.inputs.length) return this.msg('未找到输入框', 'warn');
      let idx = 0;
      if (this.currentInput) {
        const i = this.inputs.indexOf(this.currentInput);
        if (i >= 0) idx = (i + 1) % this.inputs.length;
      }
      const next = this.inputs[idx];
      next.focus();
      this.currentInput = next;
      this.highlightInput(next);
      this.msg(`第 ${idx + 1}/${this.inputs.length} 个`, 'ok');
    }

    async fillCurrent(value, label) {
      if (!this.currentInput) return this.msg('未聚焦输入框，正在按标签查找…', 'warn');
      if (!value) return;
      await JobTrackerFillEngine.fillElement(this.currentInput, value);
      chrome.runtime.sendMessage({ type: 'FILL_SESSION_TRACK', label: label || '手动填入' }).then(() => this.refreshFooterCount()).catch(() => {});
      this.msg('已填入', 'ok');
    }

    async fillByLabel(label, value) {
      if (!value) return;
      await this.loadProfile();
      const ats = JobTrackerATS.detect();
      let el = this.currentInput;
      if (!el || !JobTrackerFillEngine.isVisibleField(el, this.root)) {
        el = JobTrackerAutoFill.findInputForLabel(label, ats, this.root);
      }
      if (!el) return this.msg(`未找到「${label}」对应输入框，请点「自动填充」`, 'warn');
      this.currentInput = el;
      await JobTrackerFillEngine.fillElement(el, value);
      el.focus();
      this.highlightInput(el);
      try {
        await chrome.runtime.sendMessage({ type: 'FILL_SESSION_TRACK', label: label || '字段' });
        await this.refreshFooterCount();
      } catch (_) {}
      this.msg(`已填入「${label}」`, 'ok');
    }

    async aiFillCurrentField() {
      if (!this.currentInput) return this.msg('请先点击网页上的输入框', 'warn');
      const btn = this.sidebar.querySelector('#jt-ai-field');
      if (btn) btn.disabled = true;
      await this.loadProfile();
      const ats = JobTrackerATS.detect();
      const resolved = JobTrackerAutoFill.resolveFieldValue(this.profile, this.currentInput, ats);
      if (resolved.value) {
        await JobTrackerFillEngine.fillElement(this.currentInput, resolved.value);
        await chrome.runtime.sendMessage({ type: 'FILL_SESSION_TRACK', label: resolved.rawLabel || '字段' });
        await this.refreshFooterCount();
        this.msg('已填入', 'ok');
        if (btn) btn.disabled = false;
        return;
      }
      this.msg('AI 识别字段中…', 'warn');
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'AI_MATCH_AUTOFILL_FIELD',
          field: {
            label: resolved.rawLabel,
            enrichedLabel: resolved.label,
            section: resolved.sectionCtx.section,
            sectionTitle: resolved.sectionCtx.sectionTitle,
            category: resolved.sectionCtx.category,
            blockIndex: resolved.sectionCtx.blockIndex,
            placeholder: this.currentInput.placeholder || '',
            inputType: this.currentInput.type || this.currentInput.tagName
          }
        });
        if (!res?.ok || !res.value) throw new Error(res?.error || '未匹配到值');
        await JobTrackerFillEngine.fillElement(this.currentInput, res.value);
        await chrome.runtime.sendMessage({ type: 'FILL_SESSION_TRACK', label: resolved.rawLabel || 'AI字段' });
        await this.refreshFooterCount();
        this.highlightInput(this.currentInput);
        this.msg('AI 已填入', 'ok');
      } catch (err) {
        this.msg(err.message || 'AI 失败', 'err');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async agentFillRemaining() {
      const btn = this.sidebar.querySelector('#jt-agent-fill');
      if (btn) btn.disabled = true;
      this.msg('Agent 观察页面并补填…', 'warn');
      await this.loadProfile();
      const ats = JobTrackerATS.detect();
      try {
        const result = await JobTrackerAgentFill.runPass(this.profile, ats, this.root, { maxRounds: 4 });
        if (result.filled?.length) {
          await chrome.runtime.sendMessage({ type: 'FILL_SESSION_TRACK_BULK', items: result.filled });
          await this.refreshFooterCount();
        }
        this.msg(`Agent 补填 ${result.agentOk} 项`, result.agentOk ? 'ok' : 'warn');
      } catch (err) {
        this.msg(err.message || 'Agent 失败', 'err');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async autoFillAll(isFollowUpPass = false) {
      const ats = JobTrackerATS.detect();
      const profileName = ats?.name || '通用';
      if (!isFollowUpPass) {
        this.msg(`[${profileName}] 扫描并匹配字段…`, 'warn');
      } else {
        this.msg(`[${profileName}] 补填懒加载字段…`, 'warn');
      }
      JobTrackerFillEngine.closeAllDatePanels?.();
      await this.loadProfile();
      await this.startFillSession();
      if (!isFollowUpPass && ats?.loadDelay) {
        const delay = profileName === '通用' ? Math.min(ats.loadDelay, 1500) : ats.loadDelay;
        await sleep(delay);
      }
      let useAi = false;
      try {
        const s = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        useAi =
          s?.settings?.ai?.autofillAssist !== false &&
          !!String(s?.settings?.ai?.apiKey || '').trim();
      } catch (_) {}
      const result = await JobTrackerAutoFill.runAll(this.profile, ats, this.root, {
        useAi,
        useAgent: false,
        aiBatchSize: 40,
        localSweepRounds: ats?.localSweepRounds ?? 2,
        agentRounds: ats?.agentRounds ?? 2
      });
      this.autoFilledOnce = true;
      const scanned = result.scanned ?? result.total ?? 0;
      const filled = result.ok ?? 0;
      const skipped = result.skip ?? 0;
      const summary = `[${profileName}] 扫描 ${scanned} · 填入 ${filled} · 跳过 ${skipped}`;
      if (result.filled?.length) {
        try {
          const res = await chrome.runtime.sendMessage({
            type: 'FILL_SESSION_TRACK_BULK',
            items: result.filled
          });
          const sessionTotal = res?.summary?.filledFieldCount ?? filled;
          await this.refreshFooterCount();
          const extras = [];
          if (result.sweepOk) extras.push(`补扫 ${result.sweepOk}`);
          if (result.aiOk) extras.push(`AI ${result.aiOk}`);
          const extraPart = extras.length ? `（${extras.join('，')}）` : '';
          this.msg(`${summary}${extraPart} · 会话 ${sessionTotal}`, filled > 0 ? 'ok' : 'warn');
        } catch (_) {
          this.msg(summary, filled > 0 ? 'ok' : 'warn');
        }
      } else {
        this.msg(summary, filled > 0 ? 'ok' : 'warn');
      }
    }

    msg(text, type) {
      const el = this.sidebar.querySelector('#jt-msg');
      if (!el) return;
      el.textContent = text;
      el.className = type ? `jt-msg jt-msg-${type}` : 'jt-msg';
    }
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  window._jtAutofill = new AutofillSidebar();
})();
