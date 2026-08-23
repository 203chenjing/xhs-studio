const JobTrackerFillEngine = {
  fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
  },

  mouseDown(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  },

  simulateClick(el) {
    if (!el) return;
    for (const type of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  },

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  normOptionText(s) {
    return String(s || '')
      .replace(/[*:：\s*必填]+/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  },

  scoreOptionMatch(text, value) {
    const t = this.normOptionText(text);
    const v = this.normOptionText(value);
    if (!t || !v) return 0;
    if (t === v) return 1;
    if (/^(是|否)$/.test(v) && (t === v || (v === '是' && /全日制|统招/.test(text)))) return 0.95;
    if (v === '硕士' && /硕士|研究生/.test(t)) return 0.93;
    if (v === '本科' && /本科|学士/.test(t)) return 0.93;
    if (v === '博士' && /博士/.test(t)) return 0.93;
    if (t.includes(v) || v.includes(t)) return 0.92;
    const stripSuffix = (x) => x.replace(/(省|市|区|县|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
    const ts = stripSuffix(t);
    const vs = stripSuffix(v);
    if (ts && vs && (ts.includes(vs) || vs.includes(ts))) return 0.88;
    if (/前\d+%/.test(v) && t.includes(v.replace(/\s/g, ''))) return 0.9;
    if (/前\d+%/.test(t) && v.includes(t.replace(/\s/g, ''))) return 0.9;
    return 0;
  },

  pickBestOption(nodes, value) {
    let best = null;
    let bestScore = 0;
    for (const node of nodes) {
      const el = node.closest?.('.ant-select-item-option, .el-select-dropdown__item, .ant-cascader-menu-item') || node;
      if (el.classList?.contains('ant-select-item-option-disabled') || el.classList?.contains('is-disabled')) continue;
      const text = el.getAttribute?.('title') || el.getAttribute?.('label') || el.textContent || '';
      const score = this.scoreOptionMatch(text, value);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best && bestScore >= 0.5) {
      best.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
      return best;
    }
    return null;
  },

  async scrollDropdownForOption(dropdown, value, optionSelectors, maxSteps = 6) {
    if (!dropdown || !value) return null;
    const wraps = dropdown.querySelectorAll(
      '.el-select-dropdown__wrap, .rc-virtual-list-holder, .ant-select-dropdown-content, .ant-select-item-option-content'
    );
    const wrap = [...wraps].find((w) => w.scrollHeight > w.clientHeight + 8);
    if (!wrap) return null;
    for (let i = 0; i < maxSteps; i++) {
      const options = dropdown.querySelectorAll(optionSelectors);
      const hit = this.pickBestOption(options, value);
      if (hit) return hit;
      wrap.scrollTop += Math.max(80, Math.floor(wrap.clientHeight * 0.75));
      await this.sleep(70);
    }
    return null;
  },

  normalizeDateValue(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    if (/^\d{4}\/\d{2}$/.test(s)) return s.replace('/', '-') + '-01';
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
    if (/^\d{4}\.\d{2}$/.test(s)) return s.replace('.', '-') + '-01';
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(s)) return s.replace(/\./g, '-');
    return s;
  },

  detectWidget(el) {
    if (!el) return { kind: 'input', root: el };
    const antRange = el.closest('.ant-picker-range');
    if (antRange) return { kind: 'ant-date-range', root: antRange };
    const antSelect = el.closest('.ant-select');
    if (antSelect) return { kind: 'ant-select', root: antSelect };
    const antCascader = el.closest('.ant-cascader');
    if (antCascader) return { kind: 'ant-cascader', root: antCascader };
    const antPicker = el.closest('.ant-picker, .ant-calendar-picker');
    if (antPicker) return { kind: 'ant-date', root: antPicker };
    const elSelect = el.closest('.el-select');
    if (elSelect) return { kind: 'el-select', root: elSelect };
    const elDate = el.closest('.el-date-editor, .el-date-picker');
    if (elDate) {
      const isRange =
        elDate.classList.contains('el-date-editor--daterange') ||
        elDate.classList.contains('el-range-editor') ||
        elDate.querySelectorAll('input').length >= 2;
      if (isRange) return { kind: 'el-date-range', root: elDate };
      return { kind: 'el-date', root: elDate };
    }
    if (el.type === 'radio') return { kind: 'radio', root: el.closest('.ant-radio-group, .el-radio-group, form') || el };
    if (el.tagName === 'SELECT') return { kind: 'native-select', root: el };
    return { kind: 'input', root: el };
  },

  widgetKey(el) {
    const w = this.detectWidget(el);
    if (w.kind === 'input') return `input:${el}`;
    return `${w.kind}:${w.root}`;
  },

  clearContent(el) {
    if (el.isContentEditable) {
      el.textContent = '';
    } else {
      el.value = '';
    }
    this.fire(el, 'input');
    this.fire(el, 'change');
  },

  setNativeValue(el, val) {
    try {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
      if (setter) setter.call(el, val);
      else el.value = val;
    } catch (_) {
      el.value = val;
    }
  },

  setContent(el, content) {
    const val = String(content ?? '');
    if (el.isContentEditable) {
      el.textContent = val;
    } else if (el.tagName === 'SELECT') {
      this.fillSelect(el, val);
      return;
    } else {
      this.setNativeValue(el, val);
    }
    try {
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val })
      );
    } catch (_) {
      this.fire(el, 'input');
    }
  },

  fillSelect(select, value) {
    const v = String(value).trim();
    const opts = [...select.options];
    let hit = opts.find((o) => o.value === v || o.text.trim() === v);
    if (!hit) hit = opts.find((o) => this.scoreOptionMatch(o.text, v) >= 0.5);
    if (hit) {
      select.value = hit.value;
      this.fire(select, 'change');
      return true;
    }
    return false;
  },

  fireEventSequence(el) {
    this.fire(el, 'compositionstart');
    for (const t of ['keydown', 'keypress', 'keyup']) {
      el.dispatchEvent(new KeyboardEvent(t, { bubbles: true, cancelable: true, key: 'a', keyCode: 65, view: window }));
    }
    this.fire(el, 'compositionend');
    this.fire(el, 'change');
    const v = el.isContentEditable ? el.textContent : el.value;
    try {
      el.dispatchEvent(new CustomEvent('ngModelChange', { bubbles: true, detail: v }));
    } catch (_) {}
  },

  async fillNativeInput(el, content) {
    if (!el || content == null || content === '') return false;
    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      const ok = await JobTrackerPlaywrightFill.fill(el, content);
      if (ok) {
        JobTrackerPlaywrightFill.highlightFilled(el, true);
        await this.sleep(50);
        return true;
      }
    }
    el.focus();
    this.simulateClick(el);
    this.clearContent(el);
    this.setContent(el, content);
    this.fireEventSequence(el);
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', view: window }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', view: window }));
    await this.sleep(60);
    this.fire(el, 'blur');
    return true;
  },

  queryVisibleDropdown(selectors) {
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (const node of nodes) {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (node.classList.contains('ant-select-dropdown-hidden')) continue;
        if (node.offsetParent === null && !node.classList.contains('ant-select-dropdown')) continue;
        return node;
      }
    }
    return null;
  },

  async waitForDropdown(selectors, timeoutMs = 600) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const node = this.queryVisibleDropdown(selectors);
      if (node) return node;
      await this.sleep(40);
    }
    return null;
  },

  parseElPickerHeaderMonth(content) {
    const header = content?.querySelector('.el-date-range-picker__header div, .el-date-picker__header-label')?.textContent || '';
    const zh = header.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (zh) return { year: parseInt(zh[1], 10), month: parseInt(zh[2], 10) };
    const en = header.match(/(\d{4})\s+([A-Za-z]+)/);
    if (en) {
      const months = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
      };
      const m = months[en[2].toLowerCase()];
      if (m) return { year: parseInt(en[1], 10), month: m };
    }
    return null;
  },

  async navigateElPickerPanel(content, dateStr) {
    const formatted = this.normalizeDateValue(dateStr);
    const [y, m] = formatted.split('-').map((x) => parseInt(x, 10));
    if (!content || !y || !m) return;
    for (let step = 0; step < 60; step++) {
      const cur = this.parseElPickerHeaderMonth(content);
      if (cur && cur.year === y && cur.month === m) return;
      if (!cur) break;
      const yearDiff = cur.year - y;
      const monthDiff = cur.year * 12 + cur.month - (y * 12 + m);
      let clickTarget = null;
      if (Math.abs(yearDiff) > 1) {
        clickTarget = content.querySelector(
          yearDiff > 0
            ? 'button .el-icon-d-arrow-left, .el-icon-d-arrow-left'
            : 'button .el-icon-d-arrow-right:not(.is-disabled), .el-icon-d-arrow-right'
        )?.closest?.('button');
      }
      if (!clickTarget) {
        clickTarget = content.querySelector(
          monthDiff > 0
            ? 'button .el-icon-arrow-left, .el-icon-arrow-left'
            : 'button .el-icon-arrow-right:not(.is-disabled), .el-icon-arrow-right'
        )?.closest?.('button');
      }
      if (!clickTarget || clickTarget.disabled || clickTarget.classList.contains('is-disabled')) break;
      this.simulateClick(clickTarget);
      await this.sleep(90);
    }
  },

  async clickElPickerDateInPanel(content, dateStr) {
    const formatted = this.normalizeDateValue(dateStr);
    if (!formatted || !content) return false;
    const d = parseInt(formatted.split('-')[2], 10);
    const table = content.querySelector('.el-date-table');
    if (!table) return false;
    for (const td of table.querySelectorAll('td')) {
      if (td.classList.contains('prev-month') || td.classList.contains('next-month')) continue;
      if (td.classList.contains('disabled')) continue;
      const span = td.querySelector('span, div span');
      if (span?.textContent?.trim() === String(d)) {
        this.simulateClick(span);
        return true;
      }
    }
    return false;
  },

  closeFloatingPanel() {
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
    }
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  },

  closeAllDatePanels() {
    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      JobTrackerPlaywrightFill.closeOverlays();
      return;
    }
    this.closeFloatingPanel();
    document.querySelectorAll('.ant-picker-dropdown, .el-picker-panel, .el-popper').forEach((node) => {
      node.style.display = 'none';
    });
  },

  parsePickerHeaderMonth(panel) {
    const view = panel?.querySelector('.ant-picker-header-view')?.textContent?.replace(/\s+/g, '') || '';
    const zh = view.match(/(\d{4})年(\d{1,2})月/);
    if (zh) return { year: parseInt(zh[1], 10), month: parseInt(zh[2], 10) };
    const en = view.match(/([A-Za-z]+)\s*(\d{4})/);
    if (en) {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      const m = months[en[1].slice(0, 3).toLowerCase()];
      if (m) return { year: parseInt(en[2], 10), month: m };
    }
    return null;
  },

  async navigateAntPickerPanel(panel, year, month) {
    if (!panel) return;
    for (let step = 0; step < 36; step++) {
      const cur = this.parsePickerHeaderMonth(panel);
      if (cur && cur.year === year && cur.month === month) return;
      if (!cur) break;
      const curIdx = cur.year * 12 + cur.month;
      const targetIdx = year * 12 + month;
      const btn =
        curIdx > targetIdx
          ? panel.querySelector('.ant-picker-header-prev-btn, .ant-picker-prev-icon')
          : panel.querySelector('.ant-picker-header-next-btn, .ant-picker-next-icon');
      if (!btn) break;
      this.simulateClick(btn);
      await this.sleep(90);
    }
  },

  async clickAntPickerDate(panel, dateStr, panelIndex = 0) {
    const formatted = this.normalizeDateValue(dateStr);
    if (!formatted || !panel) return false;
    const [y, m, d] = formatted.split('-').map((x) => parseInt(x, 10));
    const panels = panel.querySelectorAll('.ant-picker-panel');
    const cal = panels[panelIndex] || panels[0];
    if (!cal) return false;
    await this.navigateAntPickerPanel(cal, y, m);
    const targetTitle = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cells = cal.querySelectorAll('.ant-picker-cell[title], .ant-picker-cell');
    for (const cell of cells) {
      const title = cell.getAttribute('title') || '';
      if (title.startsWith(targetTitle) || title === targetTitle) {
        if (cell.classList.contains('ant-picker-cell-disabled')) continue;
        const inner = cell.querySelector('.ant-picker-cell-inner') || cell;
        this.simulateClick(inner);
        return true;
      }
    }
    for (const cell of cells) {
      const inner = cell.querySelector('.ant-picker-cell-inner');
      const text = inner?.textContent?.trim();
      if (text === String(d) && !cell.classList.contains('ant-picker-cell-disabled') && !cell.classList.contains('ant-picker-cell-in-view')) {
        continue;
      }
      if (text === String(d) && !cell.classList.contains('ant-picker-cell-disabled')) {
        this.simulateClick(inner || cell);
        return true;
      }
    }
    return false;
  },

  readRangeValues(root, kind) {
    const inputs = root.querySelectorAll('input');
    if (inputs.length >= 2) {
      return { start: inputs[0].value?.trim() || '', end: inputs[1].value?.trim() || '' };
    }
    const text = root.textContent?.trim() || '';
    const m = text.match(/(\d{4}-\d{2}-\d{2})\s*[-~至到]\s*(\d{4}-\d{2}-\d{2})/);
    if (m) return { start: m[1], end: m[2] };
    return { start: inputs[0]?.value?.trim() || '', end: '' };
  },

  rangeLooksFilled(root, kind, start, end) {
    const cur = this.readRangeValues(root, kind);
    const s = this.normalizeDateValue(start);
    const e = this.normalizeDateValue(end);
    if (!cur.start || !cur.end) return false;
    return (
      this.normOptionText(cur.start).includes(this.normOptionText(s.slice(0, 7))) &&
      this.normOptionText(cur.end).includes(this.normOptionText(e.slice(0, 7)))
    );
  },

  async fillAntDateRange(root, startRaw, endRaw) {
    const start = this.normalizeDateValue(startRaw);
    const end = this.normalizeDateValue(endRaw);
    if (!start || !end) return false;

    this.closeAllDatePanels();
    await this.sleep(120);

    const trigger = root.querySelector('.ant-picker-input input') || root.querySelector('input');
    if (!trigger) return false;
    trigger.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    this.simulateClick(trigger);
    await this.sleep(220);

    let panel = await this.waitForDropdown(['.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'], 700);
    if (!panel) {
      this.mouseDown(trigger);
      await this.sleep(200);
      panel = await this.waitForDropdown(['.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'], 500);
    }
    if (!panel) {
      this.closeAllDatePanels();
      return false;
    }

    await this.clickAntPickerDate(panel, start, 0);
    await this.sleep(180);
    await this.clickAntPickerDate(panel, end, 1);
    await this.sleep(200);

    this.closeAllDatePanels();
    await this.sleep(120);

    if (this.rangeLooksFilled(root, 'ant-date-range', start, end)) return true;

    const inputs = root.querySelectorAll('input');
    if (inputs[0] && inputs[1]) {
      await this.fillNativeInput(inputs[0], start);
      await this.sleep(80);
      await this.fillNativeInput(inputs[1], end);
      inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, view: window }));
      await this.sleep(80);
      this.closeAllDatePanels();
    }
    return this.rangeLooksFilled(root, 'ant-date-range', start, end);
  },

  async fillElDateRange(root, startRaw, endRaw) {
    const start = this.normalizeDateValue(startRaw);
    const end = this.normalizeDateValue(endRaw);
    if (!start || !end) return false;

    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      const pwOk = await JobTrackerPlaywrightFill.fillDateRange(root, start, end);
      if (pwOk || this.rangeLooksFilled(root, 'el-date-range', start, end)) {
        this.closeAllDatePanels();
        return true;
      }
    }

    this.closeAllDatePanels();
    await this.sleep(120);

    const inputs = root.querySelectorAll('input');
    if (inputs.length < 2) return false;

    inputs[0].scrollIntoView?.({ block: 'center', behavior: 'instant' });
    await this.fillNativeInput(inputs[0], start);
    await this.sleep(100);
    await this.fillNativeInput(inputs[1], end);
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, view: window }));
    inputs[1].dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, view: window }));
    await this.sleep(150);
    if (this.rangeLooksFilled(root, 'el-date-range', start, end)) {
      this.closeAllDatePanels();
      return true;
    }

    this.closeAllDatePanels();
    await this.sleep(100);
    this.simulateClick(inputs[0]);
    await this.sleep(260);

    let panel = await this.waitForDropdown(
      ['.el-picker-panel.el-date-range-picker', '.el-picker-panel:not([style*="display: none"])'],
      800
    );
    if (!panel) {
      this.simulateClick(root);
      await this.sleep(200);
      panel = await this.waitForDropdown(['.el-picker-panel.el-date-range-picker', '.el-picker-panel'], 500);
    }

    if (panel) {
      const contents = panel.querySelectorAll('.el-date-range-picker__content');
      const left = panel.querySelector('.el-date-range-picker__content.is-left') || contents[0];
      const right = panel.querySelector('.el-date-range-picker__content.is-right') || contents[1] || contents[0];

      await this.navigateElPickerPanel(left, start);
      await this.clickElPickerDateInPanel(left, start);
      await this.sleep(220);

      await this.navigateElPickerPanel(right, end);
      await this.clickElPickerDateInPanel(right, end);
      await this.sleep(220);
    }

    this.closeAllDatePanels();
    await this.sleep(120);
    return this.rangeLooksFilled(root, 'el-date-range', start, end);
  },

  async clickElPickerDate(panel, dateStr) {
    const content = panel?.querySelector('.el-date-range-picker__content.is-left') || panel?.querySelector('.el-date-range-picker__content') || panel;
    return this.clickElPickerDateInPanel(content, dateStr);
  },

  async fillDateRange(root, startRaw, endRaw, kind) {
    if (kind === 'ant-date-range') return this.fillAntDateRange(root, startRaw, endRaw);
    if (kind === 'el-date-range') return this.fillElDateRange(root, startRaw, endRaw);
    return false;
  },

  async fillAntSelect(root, value) {
    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      const pwOk = await JobTrackerPlaywrightFill.selectCombobox(root, value, (text, val) =>
        this.scoreOptionMatch(text, val)
      );
      if (pwOk) return true;
    }

    const trigger = root.querySelector('.ant-select-selector') || root;
    trigger.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    this.mouseDown(trigger);
    await this.sleep(120);

    let dropdown = await this.waitForDropdown([
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      '.rc-select-dropdown:not(.rc-select-dropdown-hidden)'
    ]);

    const searchInput =
      root.querySelector('.ant-select-selection-search-input') || root.querySelector('input[type="search"]') || root.querySelector('input');

    if (!dropdown && searchInput) {
      searchInput.focus();
      await this.fillNativeInput(searchInput, value);
      await this.sleep(180);
      dropdown = await this.waitForDropdown(['.ant-select-dropdown:not(.ant-select-dropdown-hidden)'], 400);
    }

    if (!dropdown) {
      this.closeFloatingPanel();
      return false;
    }

    let options = dropdown.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)');
    if (!options.length) options = dropdown.querySelectorAll('.rc-select-item-option:not(.rc-select-item-option-disabled)');
    let hit = this.pickBestOption(options, value);

    if (!hit && searchInput) {
      searchInput.focus();
      await this.fillNativeInput(searchInput, value);
      await this.sleep(160);
      options = dropdown.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)');
      hit = this.pickBestOption(options, value);
    }

    if (!hit) {
      hit = await this.scrollDropdownForOption(
        dropdown,
        value,
        '.ant-select-item-option:not(.ant-select-item-option-disabled), .rc-select-item-option:not(.rc-select-item-option-disabled)'
      );
    }

    if (!hit) {
      this.closeFloatingPanel();
      return false;
    }

    this.mouseDown(hit);
    this.simulateClick(hit);
    await this.sleep(100);
    return true;
  },

  async fillAntCascader(root, value) {
    const trigger =
      root.querySelector('.ant-cascader-input') || root.querySelector('.ant-select-selector') || root.querySelector('input') || root;
    trigger.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    this.mouseDown(trigger);
    await this.sleep(140);

    const parts = String(value)
      .split(/[/／、,，>\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const levels = parts.length ? parts : [String(value)];

    for (const part of levels) {
      const dropdown = await this.waitForDropdown(['.ant-cascader-dropdown:not(.ant-cascader-dropdown-hidden)'], 500);
      if (!dropdown) return false;
      const menus = dropdown.querySelectorAll('.ant-cascader-menu');
      const menu = menus[menus.length - 1];
      if (!menu) return false;
      const items = menu.querySelectorAll('.ant-cascader-menu-item:not(.ant-cascader-menu-item-disabled)');
      const hit = this.pickBestOption(items, part);
      if (!hit) {
        this.closeFloatingPanel();
        return false;
      }
      this.simulateClick(hit);
      await this.sleep(120);
    }
    await this.sleep(80);
    return true;
  },

  async fillAntDatePicker(root, value) {
    const formatted = this.normalizeDateValue(value);
    if (!formatted) return false;
    const input = root.querySelector('input');
    const trigger = root.querySelector('.ant-picker-input') || input || root;
    trigger.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    this.mouseDown(trigger);
    this.simulateClick(trigger);
    await this.sleep(140);

    const panel = await this.waitForDropdown(
      ['.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)', '.ant-calendar-picker-container'],
      500
    );

    const panelInput =
      panel?.querySelector('.ant-calendar-input') ||
      panel?.querySelector('.ant-picker-input input') ||
      panel?.querySelector('input');

    const target = panelInput || input;
    if (!target) {
      this.closeFloatingPanel();
      return false;
    }

    target.focus();
    await this.fillNativeInput(target, formatted);
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', view: window }));
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', view: window }));
    await this.sleep(100);

    const okBtn = panel?.querySelector('.ant-picker-ok button, .ant-calendar-ok-btn');
    if (okBtn) this.simulateClick(okBtn);

    await this.sleep(80);
    this.closeFloatingPanel();
    await this.sleep(60);

    if (input && this.normOptionText(input.value).includes(this.normOptionText(formatted.slice(0, 7)))) return true;
    if (input && input.value) return true;
    return !!panel;
  },

  async fillElSelect(root, value) {
    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      const pwOk = await JobTrackerPlaywrightFill.selectCombobox(root, value, (text, val) =>
        this.scoreOptionMatch(text, val)
      );
      if (pwOk) return true;
    }

    const trigger = root.querySelector('.el-input__inner') || root.querySelector('input') || root;
    trigger.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    this.simulateClick(trigger);
    await this.sleep(160);

    let dropdown = await this.waitForDropdown([
      '.el-select-dropdown:not(.is-hidden)',
      '.el-popper:not([style*="display: none"])'
    ]);

    const input = root.querySelector('.el-input__inner') || root.querySelector('input');
    if (!dropdown && input) {
      input.focus();
      await this.fillNativeInput(input, value);
      await this.sleep(220);
      dropdown = await this.waitForDropdown(['.el-select-dropdown:not(.is-hidden)', '.el-popper:not([style*="display: none"])'], 500);
    }

    if (!dropdown) {
      this.closeFloatingPanel();
      return false;
    }

    let items = dropdown.querySelectorAll('.el-select-dropdown__item:not(.is-disabled)');
    let hit = this.pickBestOption(items, value);

    if (!hit && input) {
      await this.fillNativeInput(input, value);
      await this.sleep(180);
      items = dropdown.querySelectorAll('.el-select-dropdown__item:not(.is-disabled)');
      hit = this.pickBestOption(items, value);
    }

    if (!hit) {
      hit = await this.scrollDropdownForOption(dropdown, value, '.el-select-dropdown__item:not(.is-disabled)');
    }

    if (!hit) {
      this.closeFloatingPanel();
      return false;
    }
    this.simulateClick(hit);
    await this.sleep(100);
    return true;
  },

  async fillElDatePicker(root, value) {
    const formatted = this.normalizeDateValue(value);
    const input = root.querySelector('.el-input__inner') || root.querySelector('input');
    if (!input) return false;
    input.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    this.simulateClick(input);
    await this.sleep(140);

    await this.fillNativeInput(input, formatted);
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', view: window }));

    const panel = document.querySelector('.el-picker-panel:not([style*="display: none"])');
    const confirm = panel?.querySelector('.el-picker-panel__link-btn, .el-date-picker__link-btn');
    if (confirm) this.simulateClick(confirm);

    await this.sleep(80);
    this.closeFloatingPanel();
    return !!input.value;
  },

  fillRadioGroup(root, value) {
    const scope = root?.closest?.('.ant-radio-group, .el-radio-group, form') || root || document;
    const wrappers = scope.querySelectorAll('.ant-radio-wrapper, .el-radio, label');
    for (const wrap of wrappers) {
      const text = wrap.textContent || '';
      if (this.scoreOptionMatch(text, value) < 0.5) continue;
      const input = wrap.querySelector('input[type="radio"]') || wrap;
      this.simulateClick(input);
      return true;
    }
    return false;
  },

  isPlaceholderValue(val) {
    const s = String(val || '').trim();
    if (!s) return true;
    return /^(请选择|请输入|请填写|请选择日期|—|--|0\/\d+)$/i.test(s);
  },

  readFieldValue(el) {
    if (!el) return '';
    const widget = this.detectWidget(el);
    const root = widget.root || el;
    if (widget.kind === 'ant-select' || widget.kind === 'el-select') {
      const text =
        root.querySelector('.ant-select-selection-item')?.textContent?.trim() ||
        root.querySelector('.el-select__selected-item')?.textContent?.trim() ||
        root.querySelector('.el-input__inner')?.value?.trim() ||
        root.querySelector('.ant-select-selection-placeholder')?.textContent?.trim();
      if (text && !this.isPlaceholderValue(text)) return text;
      return '';
    }
    if (widget.kind === 'ant-cascader') {
      const text = root.querySelector('.ant-cascader-picker-label')?.textContent?.trim();
      if (text && !this.isPlaceholderValue(text)) return text;
      return '';
    }
    if (widget.kind === 'ant-date' || widget.kind === 'el-date') {
      return root.querySelector('input')?.value?.trim() || '';
    }
    if (widget.kind === 'ant-date-range' || widget.kind === 'el-date-range') {
      const { start, end } = this.readRangeValues(root, widget.kind);
      if (start && end) return `${start} ~ ${end}`;
      return start || end || '';
    }
    if (el.isContentEditable) return (el.textContent || '').trim();
    const val = el.value != null ? String(el.value).trim() : '';
    if (val && !this.isPlaceholderValue(val)) return val;
    return (el.textContent || '').trim();
  },

  valueLooksFilled(el, expected) {
    const cur = this.readFieldValue(el);
    if (!cur || this.isPlaceholderValue(cur)) return false;
    if (!expected) return true;
    return this.scoreOptionMatch(cur, expected) >= 0.5;
  },

  async fillElementWithRetry(el, content, opts = {}) {
    const widget = this.detectWidget(el);
    if (widget.kind === 'ant-date-range' || widget.kind === 'el-date-range') {
      return false;
    }
    const attempts = opts.attempts ?? 3;
    const pause = opts.pause ?? 180;
    for (let i = 0; i < attempts; i++) {
      await this.fillElement(el, content);
      await this.sleep(pause);
      if (this.valueLooksFilled(el, content)) return true;
      const widget = this.detectWidget(el);
      if (widget.kind === 'el-select' || widget.kind === 'ant-select' || widget.kind === 'ant-cascader') {
        await this.fillElement(el, content);
        await this.sleep(pause + 80);
        if (this.valueLooksFilled(el, content)) return true;
      }
    }
    return this.valueLooksFilled(el, content);
  },

  async fillElement(el, content) {
    if (!el || content == null || content === '') return false;
    const widget = this.detectWidget(el);
    try {
      switch (widget.kind) {
        case 'ant-select':
          return await this.fillAntSelect(widget.root, content);
        case 'ant-cascader':
          return await this.fillAntCascader(widget.root, content);
        case 'ant-date':
          return await this.fillAntDatePicker(widget.root, content);
        case 'el-select':
          return await this.fillElSelect(widget.root, content);
        case 'el-date':
          return await this.fillElDatePicker(widget.root, content);
        case 'ant-date-range':
        case 'el-date-range':
          return false;
        case 'native-select':
          return this.fillSelect(widget.root, content);
        case 'radio':
          return this.fillRadioGroup(widget.root, content);
        default:
          return await this.fillNativeInput(el, content);
      }
    } catch (_) {
      return false;
    }
  },

  isVisibleField(el, excludeRoot) {
    if (!el || excludeRoot?.contains(el)) return false;
    if (el.disabled) return false;
    const widget = this.detectWidget(el);
    const probe = widget.kind !== 'input' ? widget.root : el;
    const r = probe.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = window.getComputedStyle(probe);
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    if (el.readOnly && widget.kind === 'input' && el.tagName !== 'SELECT' && !el.isContentEditable) return false;
    return true;
  },

  isClickableVisible(el, excludeRoot) {
    if (!el || excludeRoot?.contains(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  },

  /** 扫描前展开折叠区块（仅通用页启用；已知 ATS 默认跳过以免误点） */
  async expandCollapsedSections(root = document, excludeRoot, maxClicks = 5) {
    if (!maxClicks || maxClicks <= 0) return 0;
    const headerSelectors = [
      '.el-collapse-item:not(.is-active) > .el-collapse-item__header',
      '.ant-collapse-item:not(.ant-collapse-item-active) > .ant-collapse-header',
      '.van-collapse-item:not(.van-collapse-item--expanded) .van-collapse-item__title',
      '[role="button"][aria-expanded="false"][class*="collapse"]',
      '[role="button"][aria-expanded="false"][class*="accordion"]'
    ];
    const skipRe = /^(提交|下一步|上一步|保存|取消|返回|登录|注册|删除|移除|新增|添加|展开全部|收起|关闭|确认|同意|拒绝|预览|打印|导出|上传|下载)/;
    const clicked = new WeakSet();
    let clicks = 0;
    for (let round = 0; round < 2 && clicks < maxClicks; round++) {
      let expanded = 0;
      for (const sel of headerSelectors) {
        for (const header of root.querySelectorAll(sel)) {
          if (clicks >= maxClicks) break;
          if (clicked.has(header)) continue;
          if (!this.isClickableVisible(header, excludeRoot)) continue;
          if (header.closest?.('footer, nav, .footer, .nav, [class*="toolbar"], [class*="action-bar"]')) continue;
          const text = (header.textContent || '').replace(/\s+/g, '').slice(0, 24);
          if (skipRe.test(text)) continue;
          if (/删除|移除|新增|添加/.test(text)) continue;
          clicked.add(header);
          this.simulateClick(header);
          clicks++;
          expanded++;
          await this.sleep(100);
        }
      }
      if (!expanded) break;
    }
    return clicks;
  },

  async preparePageForScan(root = document, excludeRoot, options = {}) {
    const expand = options.expand !== false;
    const maxClicks = options.maxExpandClicks ?? 5;
    if (expand && maxClicks > 0) {
      await this.expandCollapsedSections(root, excludeRoot, maxClicks);
      await this.sleep(120);
    }
  },

  scanInputs(root = document, excludeRoot, extraSelector) {
    const baseSel =
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable="true"], .ant-select-selector, .ant-picker, .ant-cascader-picker, .el-select, .el-date-editor';
    const seen = new Set();
    const widgetSeen = new Set();
    const out = [];
    const push = (el) => {
      if (!el || seen.has(el) || !this.isVisibleField(el, excludeRoot)) return;
      if (el.classList?.contains('el-range-editor') || el.classList?.contains('el-date-editor--daterange')) {
        const wKey = `el-date-range:${el}`;
        if (widgetSeen.has(wKey)) return;
        widgetSeen.add(wKey);
        const probe = el.querySelector('input') || el;
        seen.add(probe);
        out.push(probe);
        return;
      }
      const antRange = el.closest?.('.ant-picker-range');
      if (antRange) {
        const wKey = `ant-date-range:${antRange}`;
        if (widgetSeen.has(wKey)) return;
        widgetSeen.add(wKey);
        const probe = antRange.querySelector('input') || antRange;
        seen.add(probe);
        out.push(probe);
        return;
      }
      const elRange = el.closest?.('.el-date-editor--daterange, .el-range-editor');
      if (elRange && elRange.querySelectorAll('input').length >= 2) {
        const wKey = `el-date-range:${elRange}`;
        if (widgetSeen.has(wKey)) return;
        widgetSeen.add(wKey);
        const probe = elRange.querySelector('input') || elRange;
        seen.add(probe);
        out.push(probe);
        return;
      }
      const wKey = this.widgetKey(el);
      if (widgetSeen.has(wKey)) return;
      seen.add(el);
      widgetSeen.add(wKey);
      out.push(el);
    };
    for (const el of root.querySelectorAll(baseSel)) push(el);
    if (extraSelector) {
      for (const el of root.querySelectorAll(extraSelector)) push(el);
    }
    return out.sort((a, b) => {
      const ra = (this.detectWidget(a).root || a).getBoundingClientRect();
      const rb = (this.detectWidget(b).root || b).getBoundingClientRect();
      return Math.abs(ra.top - rb.top) < 10 ? ra.left - rb.left : ra.top - rb.top;
    });
  },

  labelMatchScore(targetLabel, rawLabel, enrichedLabel) {
    const norm = (s) =>
      String(s || '')
        .replace(/[*:：\s*必填]+/g, '')
        .toLowerCase();
    const t = norm(targetLabel);
    const r = norm(rawLabel);
    const e = norm(enrichedLabel);
    if (!t || (!r && !e)) return 0;
    if (t === r || t === e) return 1;
    if (r && (r.includes(t) || t.includes(r))) return 0.85;
    if (e && (e.includes(t) || t.includes(e))) return 0.8;
    const tk = t.replace(/[·第\d段]/g, '').split(/[\s·]+/).filter((x) => x.length >= 2);
    const pool = `${r} ${e}`;
    let hit = 0;
    for (const k of tk) {
      if (pool.includes(k)) hit++;
    }
    return tk.length ? hit / tk.length : 0;
  }
};
