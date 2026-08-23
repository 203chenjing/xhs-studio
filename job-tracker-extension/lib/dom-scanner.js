/**
 * 高级 DOM 字段扫描（参考 FormPilot / EasyForm / Playwright a11y tree）
 * - 多优先级标签提取 + 置信度
 * - role/name 定位
 * - 稳定 selector  hint
 */
const JobTrackerDomScanner = {
  LABEL_SKIP: /^(select|please select|请选择|请输入|\d+\/\d+)$/i,

  cssEscape(s) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(s));
    return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  },

  norm(s) {
    return String(s || '')
      .replace(/[*:：\s*必填]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  isUsefulLabel(text) {
    const t = this.norm(text);
    return t.length >= 2 && t.length <= 48 && !this.LABEL_SKIP.test(t);
  },

  /** FormPilot 式多源标签提取，返回最高分 */
  extractLabel(el) {
    if (!el) return { label: '', confidence: 0, source: 'none' };
    const candidates = [];

    const push = (text, confidence, source) => {
      const t = this.norm(text);
      if (this.isUsefulLabel(t)) candidates.push({ label: t, confidence, source });
    };

    push(el.getAttribute('aria-label'), 0.98, 'aria-label');
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
      if (parts.length) push(parts.join(' '), 0.96, 'aria-labelledby');
    }

    if (el.id) {
      const lab = document.querySelector(`label[for="${this.cssEscape(el.id)}"]`);
      push(lab?.textContent, 0.94, 'label-for');
    }

    const fieldset = el.closest('fieldset');
    push(fieldset?.querySelector('legend')?.textContent, 0.9, 'legend');

    push(el.getAttribute('placeholder'), 0.82, 'placeholder');
    push(el.getAttribute('name'), 0.75, 'name');
    push(el.getAttribute('title'), 0.7, 'title');

    const formItem = el.closest(
      '.el-form-item, .ant-form-item, .van-field, .uni-forms-item, .form-group, .form-item, [class*="form-item"], tr'
    );
    if (formItem) {
      push(
        formItem.querySelector(
          '.el-form-item__label, .ant-form-item-label label, .van-field__label, .uni-forms-item__label, .field-label, .form-label, label'
        )?.textContent,
        0.88,
        'form-item-label'
      );
      push(formItem.getAttribute?.('data-label') || formItem.dataset?.label, 0.85, 'data-label');
      const td = el.closest('td');
      if (td?.previousElementSibling) push(td.previousElementSibling.textContent, 0.86, 'td-prev');
      push(formItem.querySelector('td:first-child, th:first-child, dt')?.textContent, 0.84, 'row-head');
    }
    const dl = el.closest('dl');
    if (dl) {
      const dt = el.closest('dd')?.previousElementSibling;
      if (dt?.tagName === 'DT') push(dt.textContent, 0.83, 'dl-dt');
    }

    let prev = el.previousElementSibling;
    for (let i = 0; i < 3 && prev; i++) {
      push(prev.textContent, 0.72 - i * 0.04, 'sibling');
      prev = prev.previousElementSibling;
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0] || { label: '', confidence: 0, source: 'none' };
  },

  getRole(el) {
    if (!el) return '';
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const widget = JobTrackerFillEngine.detectWidget(el);
    if (widget.kind.includes('select')) return 'combobox';
    if (widget.kind.includes('date')) return 'textbox';
    if (el.tagName === 'SELECT') return 'combobox';
    if (el.tagName === 'TEXTAREA') return 'textbox';
    if (el.type === 'checkbox') return 'checkbox';
    if (el.type === 'radio') return 'radio';
    if (el.tagName === 'INPUT') return 'textbox';
    return '';
  },

  stableSelector(el) {
    if (!el) return '';
    if (el.id) return `#${this.cssEscape(el.id)}`;
    if (el.name) {
      const tag = el.tagName.toLowerCase();
      const named = document.querySelectorAll(`${tag}[name="${this.cssEscape(el.name)}"]`);
      if (named.length === 1) return `${tag}[name="${el.name}"]`;
    }
    const label = this.extractLabel(el).label;
    if (label) return `label:${label.slice(0, 24)}`;
    return el.tagName?.toLowerCase() || 'input';
  },

  describeField(el, atsProfile) {
    const fromScanner = this.extractLabel(el);
    let label = fromScanner.label;
    let confidence = fromScanner.confidence;
    let source = fromScanner.source;

    if (!label && atsProfile) {
      const legacy = JobTrackerATS.getFieldLabelLegacy?.(el, atsProfile) || '';
      if (legacy) {
        label = legacy;
        confidence = 0.65;
        source = 'ats-legacy';
      }
    }

    const widget = JobTrackerFillEngine.detectWidget(el);
    const sectionCtx = JobTrackerFormSection.detect(el);
    return {
      label,
      confidence,
      source,
      role: this.getRole(el),
      widget: widget.kind,
      selector: this.stableSelector(el),
      section: sectionCtx.section || '',
      sectionTitle: sectionCtx.sectionTitle || '',
      blockIndex: sectionCtx.blockIndex || 0,
      enrichedLabel: JobTrackerFormSection.enrichLabel(label, sectionCtx)
    };
  },

  /** Playwright MCP 风格：扁平 a11y 字段列表 */
  buildA11ySnapshot(inputs, atsProfile) {
    return (inputs || []).map((el) => {
      const d = this.describeField(el, atsProfile);
      const val = JobTrackerFillEngine.readFieldValue(el);
      return {
        ref: JobTrackerPageSnapshot.assignRef(el),
        role: d.role,
        name: d.label,
        widget: d.widget,
        value: val,
        empty: JobTrackerFillEngine.isPlaceholderValue(val),
        confidence: d.confidence
      };
    });
  },

  scanPage(atsProfile, excludeRoot) {
    const inputs = JobTrackerAutoFill.collectInputs(atsProfile, excludeRoot);
    const fields = [];
    for (const el of inputs) {
      if (el.type === 'file') continue;
      const d = this.describeField(el, atsProfile);
      if (!d.label && d.confidence < 0.5) continue;
      const currentValue = JobTrackerFillEngine.readFieldValue(el);
      fields.push({
        el,
        ...d,
        currentValue,
        empty: JobTrackerFillEngine.isPlaceholderValue(currentValue)
      });
    }
    fields.sort((a, b) => b.confidence - a.confidence);
    return fields;
  }
};
