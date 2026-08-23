/** 为 Agent 填表生成页面字段快照（类似 FSB get_dom_snapshot / chrome-agent DOM read） */
const JobTrackerPageSnapshot = {
  _refMap: new WeakMap(),
  _refs: new Map(),
  _seq: 0,

  reset() {
    this._refs.clear();
    this._seq = 0;
  },

  assignRef(el) {
    if (this._refMap.has(el)) return this._refMap.get(el);
    const ref = `f${this._seq++}`;
    this._refMap.set(el, ref);
    this._refs.set(ref, el);
    return ref;
  },

  getElement(ref) {
    return this._refs.get(ref) || null;
  },

  readCurrentValue(el) {
    if (!el) return '';
    const widget = JobTrackerFillEngine.detectWidget(el);
    const root = widget.root || el;
    if (widget.kind === 'ant-select' || widget.kind === 'el-select') {
      const text =
        root.querySelector('.ant-select-selection-item')?.textContent?.trim() ||
        root.querySelector('.el-select__selected-item')?.textContent?.trim() ||
        root.querySelector('.ant-select-selection-placeholder')?.textContent?.trim();
      if (text && !/请选择|请输入|please select/i.test(text)) return text;
      return '';
    }
    if (widget.kind === 'ant-cascader') {
      const text = root.querySelector('.ant-cascader-picker-label')?.textContent?.trim();
      if (text && !/请选择/i.test(text)) return text;
      return '';
    }
    if (widget.kind === 'ant-date' || widget.kind === 'el-date') {
      return root.querySelector('input')?.value?.trim() || '';
    }
    if (widget.kind === 'ant-date-range' || widget.kind === 'el-date-range') {
      const { start, end } = JobTrackerFillEngine.readRangeValues(root, widget.kind);
      if (start && end) return `${start} ~ ${end}`;
      return start || end || '';
    }
    if (el.isContentEditable) return (el.textContent || '').trim();
    const val = el.value != null ? String(el.value).trim() : '';
    if (val) return val;
    return (el.textContent || '').trim();
  },

  isEmptyValue(val) {
    const s = String(val || '').trim();
    if (!s) return true;
    return /^(请选择|请输入|请填写|请选择日期|—|--)$/i.test(s);
  },

  build(atsProfile, excludeRoot) {
    this.reset();
    if (typeof JobTrackerDomScanner !== 'undefined') {
      const scanned = JobTrackerDomScanner.scanPage(atsProfile, excludeRoot);
      const fields = [];
      for (const row of scanned) {
        if (!row.label) continue;
        fields.push({
          ref: this.assignRef(row.el),
          label: row.label,
          enrichedLabel: row.enrichedLabel,
          section: row.section || '',
          sectionTitle: row.sectionTitle || '',
          blockIndex: row.blockIndex || 0,
          widget: row.widget,
          placeholder: row.el.placeholder || '',
          currentValue: row.currentValue,
          empty: row.empty,
          confidence: row.confidence,
          role: row.role
        });
      }
      return { url: location.href, title: document.title, fields };
    }
    const inputs = JobTrackerAutoFill.collectInputs(atsProfile, excludeRoot);
    const fields = [];
    for (const el of inputs) {
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') continue;
      const rawLabel = JobTrackerATS.getFieldLabel(el, atsProfile);
      if (!rawLabel) continue;
      const sectionCtx = JobTrackerFormSection.detect(el);
      const widget = JobTrackerFillEngine.detectWidget(el);
      const currentValue = this.readCurrentValue(el);
      fields.push({
        ref: this.assignRef(el),
        label: rawLabel,
        enrichedLabel: JobTrackerFormSection.enrichLabel(rawLabel, sectionCtx),
        section: sectionCtx.section || '',
        sectionTitle: sectionCtx.sectionTitle || '',
        blockIndex: sectionCtx.blockIndex || 0,
        widget: widget.kind,
        placeholder: el.placeholder || '',
        currentValue,
        empty: this.isEmptyValue(currentValue)
      });
    }
    return {
      url: location.href,
      title: document.title,
      fields
    };
  }
};
