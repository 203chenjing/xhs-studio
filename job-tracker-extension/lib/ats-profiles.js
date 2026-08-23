/** ATS 站点 profile：已知平台做加速调参；未知校招页走 GENERIC_PROFILE 开箱即用 */
const JobTrackerATS = {
  /** 通用表单控件选择器（Ant/Element/Vant/原生 + SPA 无 form 标签） */
  GENERIC_FORM_SELECTORS:
    'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), ' +
    'select, textarea, [contenteditable="true"], ' +
    '.ant-select-selector, .ant-select-selection-search-input, .ant-picker, .ant-picker-input input, .ant-cascader-picker, .ant-cascader-input, ' +
    '.el-input__inner, .el-textarea__inner, .el-select, .el-date-editor, .el-cascader, ' +
    '.van-field__control, .uni-input-input, ' +
    '[class*="field"] input, [class*="field"] textarea, [class*="field"] select, ' +
    '[class*="form-item"] input, [class*="form-item"] textarea, [class*="form-item"] select, ' +
    '[class*="apply-form"] input, [class*="resume"] input, [class*="resume"] textarea',

  GENERIC_LABEL_SELECTOR:
    'label, .label, .field-label, .form-label, [class*="label"], .name, ' +
    '.ant-form-item-label, .ant-form-item-label label, .el-form-item__label, ' +
    '.van-field__label, .uni-forms-item__label, td:first-child, th',

  /** 未知 URL / 无站点 profile 时的默认层（覆盖多数校招 ATS） */
  GENERIC_PROFILE: null,

  /** 校招/网申 URL 启发式（站点 profile 未命中时 fallback） */
  GENERIC_URL_PATTERNS: [
    /campus\.[a-z0-9-]+\.(com|cn|net|com\.cn)/i,
    /[a-z0-9-]+\.(zhiye|mokahr)\.com/i,
    /\/(campus|recruit|recruitment|apply|application|zhaopin)\b/i,
    /zhaopin\.|recruit\.|career\.|jobs\./i,
    /校招|网申|投递/i
  ],

  PROFILES: [
    {
      name: '吉利校招',
      urlPatterns: [/campus\.geely\.com/i, /geely\.com\/campus-recruitment/i, /geely\.zhiye\.com/i, /campus\.geely/i],
      domSelectors: ['[class*="campus-recruitment"]', '[class*="geely"]', '[class*="apply-form"]', '.application-form'],
      loadDelay: 2200,
      multiPassDelays: [2200, 6000],
      localSweepRounds: 2,
      agentRounds: 2,
      expandSections: false
    },
    {
      name: '比亚迪校招',
      urlPatterns: [/job\.byd\.com/i, /byd\.com/i, /byd\.cn/i, /bydglobal/i],
      domSelectors: ['[class*="campus"]', '[class*="resume"]', '[class*="byd"]'],
      formSelectors:
        'input:not([type="hidden"]):not([type="file"]), select, textarea, .el-input__inner, .el-textarea__inner, .el-select, .el-date-editor, .ant-picker-range, .ant-select-selector, .ant-picker, [contenteditable="true"]',
      labelSelector:
        'label, .el-form-item__label, .ant-form-item-label label, .form-label, [class*="label"], .name, td:first-child, th',
      loadDelay: 2800,
      multiPassDelays: [2800, 7000],
      localSweepRounds: 2,
      agentRounds: 2,
      expandSections: false
    },
    {
      name: '北森职页',
      urlPatterns: [/\.zhiye\.com/i, /zhiye\.cn/i],
      domSelectors: ['[class*="zhiye"]', '[class*="apply-form"]', '.application-form'],
      loadDelay: 2200,
      multiPassDelays: [2200, 5500],
      localSweepRounds: 2,
      agentRounds: 2,
      expandSections: false
    },
    {
      name: '北森',
      urlPatterns: [/\.italent\.cn/i, /\.beisen\.(com|cn)/i, /italentx\./i, /rszhaopin\./i],
      domSelectors: ['.italent-form', '[class*="italent"]', '[class*="beisen"]'],
      formSelectors:
        'input:not([type="hidden"]), select, textarea, [contenteditable="true"], .ant-select-selection-search-input, .el-input__inner',
      labelSelector: '.ant-form-item-label label, .el-form-item__label, .form-label',
      loadDelay: 2000,
      multiPassDelays: [2000, 5000],
      localSweepRounds: 2,
      agentRounds: 2,
      expandSections: false
    },
    {
      name: 'Moka',
      urlPatterns: [/\.mokahr\.com/i, /\.moka\.com/i, /app\.mokahr/i],
      domSelectors: ['[class*="moka"]', '.application-form'],
      formSelectors: 'input, select, textarea, [class*="form-control"] input',
      labelSelector: '.form-label, .field-label, [class*="label"]',
      loadDelay: 1500,
      multiPassDelays: [1500, 3500, 5500],
      localSweepRounds: 3,
      agentRounds: 4
    },
    {
      name: '智联',
      urlPatterns: [/\.zhaopin\.com/i, /xiaoyuan\.zhaopin/i],
      loadDelay: 1000,
      multiPassDelays: [1000, 2500, 4500],
      localSweepRounds: 3,
      agentRounds: 3
    },
    {
      name: '牛客',
      urlPatterns: [/\.nowcoder\.com/i],
      domSelectors: ['.nc-form', '[class*="nowcoder"]'],
      loadDelay: 1000,
      multiPassDelays: [1000, 2500],
      localSweepRounds: 3,
      agentRounds: 3
    },
    {
      name: '前程无忧',
      urlPatterns: [/\.51job\.com/i],
      loadDelay: 1000,
      multiPassDelays: [1000, 2500],
      localSweepRounds: 3,
      agentRounds: 3
    },
    {
      name: 'Greenhouse',
      urlPatterns: [/greenhouse\.io/i],
      formSelectors: '#application-form input, #application-form select, #application-form textarea',
      labelSelector: 'label',
      loadDelay: 500,
      multiPassDelays: [500, 1500],
      localSweepRounds: 2,
      agentRounds: 2
    }
  ],

  _withGenericDefaults(profile) {
    const g = this.getGenericProfile();
    return {
      name: profile.name,
      urlPatterns: profile.urlPatterns,
      domSelectors: profile.domSelectors,
      formSelectors: profile.formSelectors || g.formSelectors,
      labelSelector: profile.labelSelector || g.labelSelector,
      multiPassDelays: profile.multiPassDelays || g.multiPassDelays,
      localSweepRounds: profile.localSweepRounds ?? g.localSweepRounds,
      agentRounds: profile.agentRounds ?? g.agentRounds,
      loadDelay: profile.loadDelay ?? g.loadDelay,
      expandSections: profile.expandSections ?? g.expandSections
    };
  },

  getGenericProfile() {
    if (!this.GENERIC_PROFILE) {
      this.GENERIC_PROFILE = {
        name: '通用',
        urlPatterns: this.GENERIC_URL_PATTERNS,
        domSelectors: [
          'form',
          '.ant-form',
          '.el-form',
          '[class*="apply-form"]',
          '[class*="application-form"]',
          '[class*="resume-form"]',
          '[class*="campus-recruitment"]'
        ],
        formSelectors: this.GENERIC_FORM_SELECTORS,
        labelSelector: this.GENERIC_LABEL_SELECTOR,
        loadDelay: 1500,
        multiPassDelays: [1500, 5000, 9000],
        localSweepRounds: 3,
        agentRounds: 3,
        expandSections: true
      };
    }
    return this.GENERIC_PROFILE;
  },

  hasFormLikeDom() {
    const sel = [
      'form input',
      'form textarea',
      'form select',
      '.ant-form input',
      '.el-form input',
      '[class*="apply-form"] input',
      '[class*="resume"] input',
      '[class*="application"] input'
    ];
    return sel.some((s) => document.querySelector(s));
  },

  detect(url = location.href) {
    for (const raw of this.PROFILES) {
      if (raw.urlPatterns?.some((re) => re.test(url))) return this._withGenericDefaults(raw);
    }
    for (const raw of this.PROFILES) {
      if (raw.domSelectors?.some((s) => document.querySelector(s))) return this._withGenericDefaults(raw);
    }
    const generic = this.getGenericProfile();
    if (generic.urlPatterns?.some((re) => re.test(url))) return generic;
    if (this.hasFormLikeDom()) return generic;
    return null;
  },

  formSelector(profile) {
    return (
      profile?.formSelectors ||
      this.GENERIC_FORM_SELECTORS ||
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]), select, textarea, [contenteditable="true"]'
    );
  },

  getFieldLabel(el, profile) {
    if (typeof JobTrackerDomScanner !== 'undefined') {
      const det = JobTrackerDomScanner.extractLabel(el);
      if (det.label) return det.label;
    }
    return this.getFieldLabelLegacy(el, profile);
  },

  getFieldLabelLegacy(el, profile) {
    const p = profile?.labelSelector ? profile : this.getGenericProfile();
    const formItem = el.closest(
      '.ant-form-item, .el-form-item, .van-field, .uni-forms-item, .form-group, .form-item, [class*="form-item"], [class*="field"], [class*="form-group"], label, [class*="row"]'
    );
    if (p?.labelSelector && formItem) {
      for (const sel of p.labelSelector.split(',').map((s) => s.trim())) {
        const label = formItem.querySelector(sel);
        if (label?.textContent?.trim()) {
          const t = label.textContent.replace(/[*:：\s]+$/g, '').trim();
          if (t.length > 0 && t.length < 40) return t;
        }
      }
    }
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label?.textContent) return label.textContent.replace(/[*:：\s]+$/g, '').trim();
    }
    const aria = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    if (aria && aria.length < 40) return aria.trim();
    const named = el.getAttribute('name') || '';
    if (named && named.length < 40) return named.trim();
    let prev = el.previousElementSibling;
    for (let i = 0; i < 3 && prev; i++) {
      if (/label|span|p|div/i.test(prev.tagName)) {
        const t = prev.textContent.replace(/[*:：\s*必填]+$/g, '').trim();
        if (t.length > 0 && t.length < 30 && !/^\d+\/\d+$/.test(t)) return t;
      }
      prev = prev.previousElementSibling;
    }
    const parent = el.parentElement;
    if (parent) {
      const labelChild = parent.querySelector(':scope > label, :scope > span, :scope > .label');
      const t = labelChild?.textContent?.replace(/[*:：\s*必填]+$/g, '').trim();
      if (t && t.length > 0 && t.length < 30) return t;
    }
    const row = el.closest('tr, .el-row, .ant-row');
    if (row) {
      const td = el.closest('td');
      if (td?.previousElementSibling) {
        const prev = td.previousElementSibling.textContent?.replace(/[*:：\s*必填]+$/g, '').trim();
        if (prev && prev.length >= 2 && prev.length < 28 && !/^\d+\/\d+$/.test(prev)) return prev;
      }
      const cell = row.querySelector('td:first-child, th:first-child, .el-form-item__label, label');
      const t = cell?.textContent?.replace(/[*:：\s*必填]+$/g, '').trim();
      if (t && t.length >= 2 && t.length < 28 && !/^\d+$/.test(t) && !/^\d+\/\d+$/.test(t)) return t;
    }
    const fi = formItem || el.closest('.el-form-item, .ant-form-item, .van-field');
    if (fi) {
      const lab = fi.querySelector('.el-form-item__label, .ant-form-item-label, .van-field__label');
      const t = lab?.textContent?.replace(/[*:：\s*必填]+$/g, '').trim();
      if (t && t.length >= 2 && t.length < 28) return t;
    }
    return '';
  }
};
