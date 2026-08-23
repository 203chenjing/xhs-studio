const aiEnabledEl = document.getElementById('ai-enabled');
const aiResumeParseEl = document.getElementById('ai-resume-parse');
const resumeParseModeEl = document.getElementById('resume-parse-mode');
const aiAutoEnhanceEl = document.getElementById('ai-auto-enhance');

const form = document.getElementById('settings-form');
const statusEl = document.getElementById('status');
const apiKeyInput = document.getElementById('api-key');
const keyHintEl = document.getElementById('key-hint');

async function bg(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function formatAiTestError(message) {
  const m = String(message || "");
  if (/ISO-8859-1|non-ascii|bytestring|headers?.*ascii/i.test(m)) {
    return "API Key 含非 ASCII 字符（常见于复制带入中文/全角符号），请从 DeepSeek 控制台重新复制纯英文 Key 后保存再测";
  }
  if (/401|403/.test(m) && /unauthorized|invalid/i.test(m)) {
    return "API Key 无效或已失效，请在 platform.deepseek.com 检查 Key 并重试";
  }
  if (/Failed to fetch|NetworkError|network/i.test(m)) {
    return "网络请求失败：请检查能否访问 api.deepseek.com，以及 Base URL 是否为 https://api.deepseek.com/v1";
  }
  return m;
}

function showStatus(text, ok) {
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.className = `status ${ok ? 'ok' : 'err'}`;
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function sanitizeKeyInput() {
  const raw = apiKeyInput.value;
  if (!raw.trim()) return { changed: false, validation: null };
  const validation = JobTrackerSettings.validateApiKey(raw);
  const changed = validation.key !== raw;
  if (changed) apiKeyInput.value = validation.key;
  return { changed, validation };
}

function syncAiDependentFields() {
  const on = aiEnabledEl.checked;
  aiAutoEnhanceEl.disabled = !on;
  if (!on) aiAutoEnhanceEl.checked = false;
}

async function load() {
  const res = await bg('GET_SETTINGS');
  const ai = res.settings?.ai || {};
  aiEnabledEl.checked = !!ai.enabled;
  aiResumeParseEl.checked = ai.resumeParse !== false;
  resumeParseModeEl.value = JobTrackerSettings.normalizeResumeParseMode(ai.resumeParseMode);
  const smartEl = document.getElementById('ai-smart-autofill');
  if (smartEl) {
    smartEl.checked =
      ai.autofillAutoRun !== false && ai.autofillAssist !== false && ai.autofillAgent !== false;
  }
  aiAutoEnhanceEl.checked = !!ai.autoEnhance;
  syncAiDependentFields();
  apiKeyInput.value = '';
  apiKeyInput.placeholder = ai.apiKey ? `已保存 ${maskKey(ai.apiKey)}，重新输入可覆盖` : 'sk-...';
  if (keyHintEl) {
    keyHintEl.textContent = ai.apiKey
      ? `✓ 已保存 Key：${maskKey(ai.apiKey)}（输入框留空不会清除）`
      : '填写 DeepSeek API Key 后务必点击「保存设置」';
  }
  const banner = document.getElementById('onboarding-banner');
  if (banner) banner.hidden = !!ai.apiKey;
  document.getElementById('base-url').value = ai.baseUrl || 'https://api.deepseek.com/v1';
  document.getElementById('model').value = ai.model || 'deepseek-chat';
  document.getElementById('ai-mode').value = ai.mode || 'fallback';
  const modeEl = document.getElementById('resume-parse-mode');
  if (modeEl) {
    modeEl.value = JobTrackerSettings.normalizeResumeParseMode(ai.resumeParseMode);
  }
}

async function saveSettings() {
  const res = await bg('GET_SETTINGS');
  const existingKey = res.settings?.ai?.apiKey || '';
  const typedRaw = apiKeyInput.value;
  const typedKey = typedRaw.trim();
  const validation = typedKey ? JobTrackerSettings.validateApiKey(typedKey) : null;

  if (validation && !validation.valid) {
    return { ok: false, error: validation.error, ai: res.settings?.ai || {} };
  }

  const keyToSave = validation ? validation.key : existingKey;
  const smartAutofill = document.getElementById('ai-smart-autofill')?.checked !== false;
  const saved = await bg('SAVE_SETTINGS', {
    patch: {
      ai: {
        enabled: aiEnabledEl.checked,
        resumeParse: aiResumeParseEl.checked,
        resumeParseMode: resumeParseModeEl.value,
        autofillAssist: smartAutofill,
        autofillAgent: smartAutofill,
        autofillAutoRun: smartAutofill,
        autoEnhance: aiAutoEnhanceEl.checked,
        apiKey: typedKey ? keyToSave : existingKey,
        baseUrl: document.getElementById('base-url').value.trim() || 'https://api.deepseek.com/v1',
        model: document.getElementById('model').value.trim() || 'deepseek-chat',
        mode: document.getElementById('ai-mode').value,
        resumeParseMode: document.getElementById('resume-parse-mode')?.value || 'ai-first'
      }
    }
  });

  if (!saved.ok) {
    return { ok: false, error: saved.error, ai: res.settings?.ai || {} };
  }

  return {
    ok: true,
    ai: saved.settings?.ai || {},
    hadIllegalChars: validation?.hadIllegalChars
  };
}

apiKeyInput.addEventListener('blur', () => {
  const { changed, validation } = sanitizeKeyInput();
  if (!validation) return;
  if (!validation.valid) {
    showStatus(validation.error, false);
    return;
  }
  if (changed || validation.hadIllegalChars) {
    showStatus('已自动清理 Key 中的非法字符，请确认后保存', false);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await saveSettings();
  if (!result.ok) {
    showStatus(result.error || '保存失败', false);
    return;
  }
  const { ai, hadIllegalChars } = result;
  if (hadIllegalChars) {
    showStatus('Key 含中文或特殊字符已自动清理，请确认无误后再测试', false);
    await load();
    return;
  }
  if (aiEnabledEl.checked && !ai.apiKey) {
    showStatus('已勾选启用 AI，但 API Key 为空，请填写后再次保存', false);
    return;
  }
  if (aiAutoEnhanceEl.checked && !aiEnabledEl.checked) {
    showStatus('自动后台补全需同时勾选「启用 AI 识别」', false);
    return;
  }
  showStatus('设置已保存', true);
  await load();
});

document.getElementById('test-ai').addEventListener('click', async () => {
  const result = await saveSettings();
  if (!result.ok) {
    showStatus(result.error || '保存失败', false);
    return;
  }
  const { ai, hadIllegalChars } = result;
  if (hadIllegalChars) {
    showStatus('Key 含中文或特殊字符，请从 DeepSeek 控制台重新复制纯英文 Key', false);
    return;
  }
  if (!aiEnabledEl.checked) {
    showStatus('请先勾选「启用 AI 增强」并保存', false);
    return;
  }
  if (!ai.apiKey) {
    showStatus('API Key 为空：请在输入框填写 Key 后点「保存设置」', false);
    return;
  }
  showStatus('测试中，可能需要 10–30 秒…', true);
  try {
    const res = await bg('AI_EXTRACT', {
      pageContext: {
        url: 'https://talent.alibaba.com/apply/success',
        title: '投递成功 - AI产品经理 - 淘天集团',
        text: '您的简历已成功投递至 AI产品经理（淘天集团）岗位。阿里校招 2027届秋招。',
        ruleExtraction: { company: '', position: '', platform: '阿里校招' }
      }
    });
    if (!res?.ok) throw new Error(formatAiTestError(res?.error || '请求失败'));
    showStatus(`连接成功：${res.data.company} · ${res.data.position} · ${res.data.status}`, true);
    await load();
  } catch (err) {
    showStatus(`测试失败：${formatAiTestError(err.message)}`, false);
  }
});

aiEnabledEl.addEventListener('change', syncAiDependentFields);

document.getElementById('open-resume-from-settings')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('resume/resume.html') });
});

load();
