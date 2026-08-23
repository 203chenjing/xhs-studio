const statusSelect = document.getElementById('status');
const form = document.getElementById('record-form');
const listEl = document.getElementById('record-list');
const pendingListEl = document.getElementById('pending-list');
const emptyEl = document.getElementById('empty');
const countEl = document.getElementById('count');
const pendingBadge = document.getElementById('pending-badge');
const pendingSection = document.getElementById('pending-section');
const pendingCountEl = document.getElementById('pending-count');
const searchEl = document.getElementById('search');
const versionSelect = document.getElementById('resume-version');
const filterVersionEl = document.getElementById('filter-version');
const versionStatsEl = document.getElementById('version-stats');
const fillSessionStatusEl = document.getElementById('fill-session-status');

let records = [];
let pending = [];
let editingId = null;
let versionMeta = { versions: [], activeVersionId: '' };

function initStatusOptions() {
  statusSelect.innerHTML = JobTrackerConstants.STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('');
  statusSelect.value = '已投递';
}

function setDefaultDates() {
  document.getElementById('applyDate').value = JobTrackerConstants.formatApplyDate(new Date());
}

function openManualForm() {
  switchTab('records');
  const fold = document.querySelector('#panel-records .fold-more');
  if (fold) fold.open = true;
}

async function bg(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => {
    const isActive = p.id === `panel-${name}`;
    if (isActive) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

async function loadVersions() {
  const res = await bg('GET_RESUME_VERSIONS');
  versionMeta = res.meta || { versions: [], activeVersionId: '' };
  const opts = versionMeta.versions
    .map((v) => `<option value="${esc(v.id)}" ${v.id === versionMeta.activeVersionId ? 'selected' : ''}>${esc(v.name)}</option>`)
    .join('');
  versionSelect.innerHTML = opts;
  const filterOpts =
    '<option value="">全部版本</option>' +
    versionMeta.versions.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
  if (filterVersionEl) filterVersionEl.innerHTML = filterOpts;
  updateFillSessionStatus();
}

function getVersionName(id) {
  return versionMeta.versions.find((v) => v.id === id)?.name || '';
}

function updateFillSessionStatus(filledCount) {
  if (!fillSessionStatusEl) return;
  const active = versionMeta.versions.find((v) => v.id === versionMeta.activeVersionId);
  const name = active?.name || versionSelect.selectedOptions?.[0]?.textContent || '—';
  const n = filledCount ?? null;
  const filledPart = n != null && n > 0 ? ` · 本会话已填 ${n} 项` : '';
  fillSessionStatusEl.textContent = `当前简历 · ${name}${filledPart}`;
}

function renderVersionStats() {
  if (!versionStatsEl) return;
  const counts = {};
  for (const r of records) {
    const key = r.resumeVersion || '未标注';
    counts[key] = (counts[key] || 0) + 1;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name} ${n} 家`);
  if (!parts.length) {
    versionStatsEl.hidden = true;
    return;
  }
  versionStatsEl.hidden = false;
  versionStatsEl.textContent = parts.join(' · ');
}

async function loadAll() {
  const [recRes, pendRes] = await Promise.all([bg('GET_ALL'), bg('GET_PENDING')]);
  records = recRes.records || [];
  pending = pendRes.pending || [];
  renderPending();
  renderList();
  renderVersionStats();
}

function formatSignals(signals) {
  if (!signals?.length) return '';
  return signals
    .slice(0, 3)
    .map((s) => `${s.name} ${s.contribution}%`)
    .join(' · ');
}

function renderPending() {
  pendingSection.hidden = pending.length === 0;
  pendingCountEl.textContent = pending.length ? `(${pending.length})` : '';
  pendingBadge.hidden = pending.length === 0;
  pendingBadge.textContent = pending.length ? `${pending.length} 待确认` : '';
  countEl.textContent = records.length ? `${records.length} 条` : '0';

  pendingListEl.innerHTML = pending
    .slice(0, 20)
    .map(
      (r) => `
    <li class="pending-item" data-id="${r.id}">
      <div class="record-main">
        <div>
          <div class="record-title">${esc(r.company || '—')} · ${esc(r.position || '—')}
            <span class="confidence-tag">置信 ${r.confidence ?? '?'}%</span>
          </div>
          <div class="record-meta">${esc(r.pendingMeta || '自动捕获，请确认或到补充页修改')} · ${esc(r.applyDate || '')}${r.note ? ' · ' + esc(r.note) : ''}</div>
          ${r.fusionSignals?.length ? `<div class="signal-summary">本地：${esc(formatSignals(r.fusionSignals))}</div>` : ''}
        </div>
        <span class="status-tag">${esc(r.status || '已投递')}</span>
      </div>
      <div class="record-actions">
        <button type="button" class="link-btn" data-confirm="${r.id}">确认入库</button>
        <button type="button" class="link-btn" data-edit-pending="${r.id}">编辑后确认</button>
        <button type="button" class="link-btn subtle" data-ai-pending="${r.id}">AI 补充（较慢）</button>
        <button type="button" class="link-btn" data-dismiss="${r.id}">忽略</button>
      </div>
    </li>`
    )
    .join('');

  pendingListEl.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await bg('CONFIRM_PENDING', { id: btn.dataset.confirm });
      await loadAll();
    });
  });
  pendingListEl.querySelectorAll('[data-edit-pending]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = pending.find((x) => x.id === btn.dataset.editPending);
      if (!item) return;
      fillForm(item);
      editingId = `pending:${item.id}`;
      openManualForm();
    });
  });
  pendingListEl.querySelectorAll('[data-ai-pending]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = pending.find((x) => x.id === btn.dataset.aiPending);
      if (!item) return;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'AI 补充中…';
      try {
        const res = await bg('AI_ENHANCE_PENDING', {
          id: item.id,
          pageContext: {
            url: item.url,
            title: '',
            text: '',
            ruleExtraction: {
              company: item.company,
              position: item.position,
              platform: item.platform
            }
          }
        });
        if (!res.ok) throw new Error(res.error || 'AI 补充失败');
        await loadAll();
      } catch (err) {
        alert(err.message || 'AI 补充失败');
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
  });
  pendingListEl.querySelectorAll('[data-dismiss]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await bg('DISMISS_PENDING', { id: btn.dataset.dismiss });
      await loadAll();
    });
  });
}

function renderList() {
  const q = (searchEl.value || '').trim().toLowerCase();
  const versionFilter = filterVersionEl?.value || '';
  const filtered = records.filter((r) => {
    if (versionFilter && r.resumeVersionId !== versionFilter) {
      const name = getVersionName(versionFilter);
      if (!name || r.resumeVersion !== name) return false;
    }
    if (!q) return true;
    const hay = `${r.company} ${r.position} ${r.status} ${r.fillStatus} ${r.note} ${r.resumeVersion} ${r.platform}`.toLowerCase();
    return hay.includes(q);
  });

  listEl.innerHTML = '';
  emptyEl.hidden = filtered.length > 0 || pending.length > 0;

  for (const r of filtered.slice(0, 50)) {
    const li = document.createElement('li');
    li.className = 'record-item';
    const statusLabel = r.fillStatus || r.status;
    li.innerHTML = `
      <div class="record-main">
        <div>
          <div class="record-title">${esc(r.company || '—')} · ${esc(r.position || '—')}</div>
          <div class="record-meta">${esc(r.applyDate || '')}${r.resumeVersion ? ' · ' + esc(r.resumeVersion) : ''}${r.filledFieldCount ? ' · 填了' + r.filledFieldCount + '项' : ''}${r.note ? ' · ' + esc(r.note) : ''}</div>
        </div>
        <span class="status-tag ${esc(statusLabel)}">${esc(statusLabel)}</span>
      </div>
      <div class="record-actions">
        <button type="button" class="link-btn" data-edit="${r.id}">编辑</button>
        <button type="button" class="link-btn" data-del="${r.id}">删除</button>
        ${r.url ? `<a class="link-btn" href="${esc(r.url)}" target="_blank" rel="noopener">链接</a>` : ''}
      </div>`;
    listEl.appendChild(li);
  }

  listEl.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      fillForm(records.find((x) => x.id === btn.dataset.edit));
      openManualForm();
    });
  });
  listEl.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定删除这条记录？')) return;
      await bg('DELETE_RECORD', { id: btn.dataset.del });
      await loadAll();
    });
  });
}

function fillForm(record) {
  if (!record) return;
  editingId = record.id;
  document.getElementById('company').value = record.company || '';
  document.getElementById('position').value = record.position || '';
  document.getElementById('status').value = record.status || '已投递';
  document.getElementById('applyDate').value = (record.applyDate || '').replace(/\//g, '-').slice(0, 10);
  document.getElementById('note').value = record.note || '';
}

async function fillFromCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
    if (!info) return null;
    document.getElementById('company').value = info.company || '';
    document.getElementById('position').value = info.position || '';
    document.getElementById('status').value = info.auto?.status || info.defaultStatus || '已投递';
    document.getElementById('note').value = info.auto?.note || info.defaultNote || '';
    editingId = null;
    return info;
  } catch {
    alert('当前页面无法读取，请刷新招聘页后重试，或手动填写。');
    return null;
  }
}

async function aiFillFromCurrentTab() {
  const info = await fillFromCurrentTab();
  if (!info?.pageContext) return;
  const btn = document.getElementById('ai-fill');
  btn.disabled = true;
  btn.textContent = '识别中…';
  try {
    const res = await bg('AI_EXTRACT', { pageContext: info.pageContext });
    if (!res.ok) throw new Error(res.error || 'AI 识别失败');
    const data = res.data || {};
    if (data.company) document.getElementById('company').value = data.company;
    if (data.position) document.getElementById('position').value = data.position;
    if (data.status) document.getElementById('status').value = data.status;
    if (data.note) document.getElementById('note').value = data.note;
  } catch (err) {
    alert(err.message || 'AI 识别失败，请检查设置中的 API Key');
  } finally {
    btn.disabled = false;
    btn.textContent = '慢 · AI 识别';
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const applyDateRaw = document.getElementById('applyDate').value;
  const record = {
    company: document.getElementById('company').value.trim(),
    position: document.getElementById('position').value.trim(),
    status: document.getElementById('status').value,
    applyDate: applyDateRaw || JobTrackerConstants.formatApplyDate(),
    note: document.getElementById('note').value.trim(),
    source: 'manual-panel'
  };

  if (!record.company && !record.position) {
    alert('请至少填写公司或岗位');
    return;
  }

  if (String(editingId).startsWith('pending:')) {
    const pid = editingId.replace('pending:', '');
    await bg('CONFIRM_PENDING', { id: pid, patch: record });
    editingId = null;
  } else if (editingId) {
    await bg('UPDATE_RECORD', { id: editingId, patch: record });
    editingId = null;
  } else {
    const tab = await getActiveTab();
    record.url = tab?.url || '';
    await bg('SAVE_RECORD', { record });
  }

  form.reset();
  initStatusOptions();
  setDefaultDates();
  await loadAll();
  switchTab('records');
});

versionSelect.addEventListener('change', async () => {
  await bg('SET_ACTIVE_VERSION', { id: versionSelect.value });
  versionMeta.activeVersionId = versionSelect.value;
  updateFillSessionStatus();
  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_AUTOFILL' }).catch(() => {});
  }
});

document.getElementById('fill-page').addEventListener('click', fillFromCurrentTab);
document.getElementById('ai-fill').addEventListener('click', aiFillFromCurrentTab);
document.getElementById('open-settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('open-resume').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('resume/resume.html') });
});

document.getElementById('start-apply')?.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return alert('请先打开网申页');
  const btn = document.getElementById('start-apply');
  const spinner = document.getElementById('start-apply-spinner');
  const text = btn?.querySelector('.btn-hero-text');
  btn.disabled = true;
  if (spinner) spinner.hidden = false;
  if (text) text.textContent = '填充中…';
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL_ALL' });
    window.close();
  } catch {
    alert('请刷新网申页后重试');
    btn.disabled = false;
    if (spinner) spinner.hidden = true;
    if (text) text.textContent = '开始填表';
  }
});

document.getElementById('mark-filled').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'MARK_FILLED' });
    if (res?.ok) {
      await loadAll();
      await refreshFillSessionHint();
      switchTab('records');
    } else {
      alert(res?.error || '无法识别当前页');
    }
  } catch {
    alert('请刷新招聘页后重试');
  }
});

document.getElementById('ai-suggest-resume').addEventListener('click', async () => {
  const btn = document.getElementById('ai-suggest-resume');
  const resultEl = document.getElementById('suggest-result');
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = '分析中…';
  try {
    const tab = await getActiveTab();
    let jdText = '';
    if (tab?.id) {
      const info = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' }).catch(() => null);
      jdText = [info?.position, info?.company, info?.pageContext?.text].filter(Boolean).join(' ');
    }
    const settingsRes = await bg('GET_SETTINGS');
    const useAi = !!settingsRes.settings?.ai?.enabled;
    const res = await bg('AI_SUGGEST_RESUME', { jdText, useAi });
    if (!res.ok) throw new Error(res.error || '推荐失败');
    const name = res.suggestion?.name || '';
    const reason = res.reason || '';
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.textContent = `推荐「${name}」（${res.source === 'ai' ? 'AI' : '本地'}：${reason}）— 点击确认切换`;
      resultEl.dataset.versionId = res.suggestion?.id || '';
      resultEl.style.cursor = 'pointer';
      resultEl.onclick = async () => {
        if (res.suggestion?.id) {
          versionSelect.value = res.suggestion.id;
          await bg('SET_ACTIVE_VERSION', { id: res.suggestion.id });
          versionMeta.activeVersionId = res.suggestion.id;
          updateFillSessionStatus();
          resultEl.textContent = `已切换为「${name}」`;
        }
      };
    }
  } catch (err) {
    alert(err.message || '推荐失败');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});

async function refreshFillSessionHint() {
  try {
    const res = await bg('GET_FILL_SESSION');
    const n = res?.summary?.filledFieldCount || 0;
    updateFillSessionStatus(n);
  } catch {
    updateFillSessionStatus(0);
  }
}

document.getElementById('export-tsv').addEventListener('click', () => {
  JobTrackerExport.downloadTSV(records);
});

document.getElementById('import-tsv').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const imported = JobTrackerExport.parseTSV(text);
  if (!imported.length) {
    alert('未能解析到有效记录');
    return;
  }
  await bg('IMPORT_RECORDS', { records: imported });
  await loadAll();
  alert(`已导入 ${imported.length} 条记录`);
  e.target.value = '';
});

searchEl.addEventListener('input', renderList);
if (filterVersionEl) filterVersionEl.addEventListener('change', renderList);

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
    if (tab.dataset.tab === 'apply') refreshFillSessionHint();
  });
});

async function init() {
  initStatusOptions();
  setDefaultDates();
  await loadVersions();
  await loadAll();
  await refreshFillSessionHint();
  switchTab('records');
}

init();
