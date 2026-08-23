const JobTrackerSettings = {
  STORAGE_KEY: 'job_tracker_settings',

  defaults: {
    ai: {
      enabled: false,
      autoEnhance: false,
      resumeParse: true,
      resumeParseMode: 'ai-first',
      autofillAssist: true,
      autofillAutoRun: true,
      autofillAgent: true,
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      mode: 'fallback',
      useForPending: true
    }
  },

  RESUME_PARSE_MODES: ['ai-first', 'local-only', 'ai-only'],

  normalizeResumeParseMode(mode) {
    const m = String(mode || '').trim();
    return this.RESUME_PARSE_MODES.includes(m) ? m : this.defaults.ai.resumeParseMode;
  },

  /** HTTP Authorization 只允许可打印 ASCII（ISO-8859-1 子集） */
  sanitizeApiKey(raw) {
    let s = String(raw ?? '');
    s = s.trim();
    s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029\u2060\u180E\uFFF9-\uFFFB]/g, '');
    s = s.replace(/^[\s"'`''""「」【】]+|[\s"'`''""「」【】]+$/g, '');
    s = s.replace(/[\u3000-\u303F\uFF00-\uFFEF\u2010-\u201F\u00AB\u00BB，。；：、！？（）【】《》「」]/g, '');
    s = s.replace(/\s+/g, '');
    s = s.replace(/[^\x21-\x7E]/g, '');
    return s;
  },

  validateApiKey(raw) {
    const rawStr = String(raw ?? '');
    const key = this.sanitizeApiKey(raw);
    const hadIllegalChars =
      rawStr.length > 0 &&
      (key !== rawStr.trim().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').replace(/\s+/g, '') ||
        /[^\x21-\x7E]/.test(rawStr));

    const illegalMsg =
      'API Key 含非法字符（常见于复制时带入中文或空格），请重新粘贴纯英文 Key';

    if (!key) {
      return {
        key: '',
        valid: false,
        hadIllegalChars: !!rawStr.trim(),
        error: rawStr.trim() ? illegalMsg : 'API Key 为空'
      };
    }

    if (!/^sk-[A-Za-z0-9_-]{8,}$/.test(key)) {
      return {
        key,
        valid: false,
        hadIllegalChars,
        error: hadIllegalChars ? illegalMsg : 'API Key 格式无效：请以 sk- 开头的 DeepSeek Key'
      };
    }

    return { key, valid: true, hadIllegalChars, error: null };
  },

  isAsciiHeaderValue(value) {
    const s = String(value ?? '');
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x20 || c > 0x7e) return false;
    }
    return true;
  },

  sanitizeUrl(raw) {
    return String(raw || '')
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[^\x21-\x7E]/g, '');
  },

  sanitizeModel(raw) {
    return String(raw || '')
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[^\w.-]/g, '');
  },

  normalizeAi(ai = {}) {
    return {
      ...ai,
      apiKey: this.sanitizeApiKey(ai.apiKey),
      baseUrl: this.sanitizeUrl(ai.baseUrl) || this.defaults.ai.baseUrl,
      model: this.sanitizeModel(ai.model) || this.defaults.ai.model,
      resumeParse: ai.resumeParse !== false,
      resumeParseMode: this.normalizeResumeParseMode(ai.resumeParseMode),
      autofillAssist: ai.autofillAssist !== false,
      autofillAutoRun: ai.autofillAutoRun !== false,
      autofillAgent: ai.autofillAgent !== false
    };
  },

  async get() {
    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    const merged = deepMerge(structuredClone(this.defaults), data[this.STORAGE_KEY] || {});
    merged.ai = this.normalizeAi(merged.ai);
    return merged;
  },

  async save(patch) {
    const current = await this.get();
    const next = deepMerge(current, patch);
    if (next.ai) {
      if (!String(patch?.ai?.apiKey || '').trim() && current.ai?.apiKey) {
        next.ai.apiKey = current.ai.apiKey;
      }
      const providedKey = patch?.ai?.apiKey;
      if (providedKey !== undefined && String(providedKey).trim()) {
        const validation = this.validateApiKey(providedKey);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        next.ai.apiKey = validation.key;
      }
      next.ai = this.normalizeAi(next.ai);
    }
    await chrome.storage.local.set({ [this.STORAGE_KEY]: next });
    return next;
  }
};

function deepMerge(base, patch) {
  for (const key of Object.keys(patch || {})) {
    const val = patch[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      base[key] = deepMerge({ ...(base[key] || {}) }, val);
    } else if (val !== undefined) {
      base[key] = val;
    }
  }
  return base;
}
