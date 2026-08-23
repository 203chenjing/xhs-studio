/**
 * Playwright 风格填表原语（content script 内复刻，非 Playwright 运行时）
 * 参考：locator.fill / getByLabel / getByRole('option') / press(Escape)
 */
const JobTrackerPlaywrightFill = {
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  normLabel(s) {
    return String(s || '')
      .replace(/[*:：\s*必填]+/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  },

  /** 类似 page.getByLabel(text) */
  getByLabel(text, root = document) {
    const target = this.normLabel(text);
    if (!target) return null;

    const pickControl = (container) => {
      if (!container) return null;
      return (
        container.querySelector(
          'input:not([type="hidden"]):not([type="file"]), textarea, select, .el-select, .el-date-editor, .ant-select, .ant-picker, .ant-picker-range'
        ) || null
      );
    };

    for (const label of root.querySelectorAll('label, .el-form-item__label, .ant-form-item-label label, td:first-child, th')) {
      const t = this.normLabel(label.textContent);
      if (!t || (t !== target && !t.includes(target) && !target.includes(t))) continue;
      const id = label.getAttribute('for');
      if (id) {
        const linked = root.querySelector(`#${CSS.escape(id)}`);
        if (linked) return linked;
      }
      const hit = pickControl(label.closest('.el-form-item, .ant-form-item, tr, .form-group'));
      if (hit) return hit.querySelector?.('input') || hit;
    }

    for (const item of root.querySelectorAll('.el-form-item, .ant-form-item')) {
      const lab = item.querySelector('.el-form-item__label, .ant-form-item-label');
      const t = this.normLabel(lab?.textContent);
      if (!t || (t !== target && !t.includes(target) && !target.includes(t))) continue;
      const hit = pickControl(item);
      if (hit) return hit.querySelector?.('input') || hit;
    }
    return null;
  },

  /** 同步 Vue 2 / Element UI 受控组件 */
  syncVueInput(el, value) {
    let node = el;
    for (let i = 0; i < 8 && node; i++) {
      const vm = node.__vue__ || node.__vueParentComponent;
      if (vm?.$emit) {
        try {
          vm.$emit('input', value);
          vm.$emit('change', value);
        } catch (_) {}
      }
      node = node.parentElement;
    }
  },

  press(el, key) {
    const target = el || document.activeElement || document.body;
    for (const type of ['keydown', 'keyup']) {
      target.dispatchEvent(
        new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true, view: window })
      );
    }
  },

  /**
   * 类似 locator.fill(value) — 不打开日期面板，直接注入受控值
   */
  async fill(el, value, opts = {}) {
    if (!el || value == null || value === '') return false;
    const str = String(value);

    el.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    el.focus?.();

    if (el.isContentEditable) {
      if (opts.clear !== false) el.textContent = '';
      el.textContent = str;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: str, inputType: 'insertFromPaste' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      this.syncVueInput(el, str);
      return true;
    }

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const wasReadonly = el.readOnly;
      if (wasReadonly) el.readOnly = false;
      try {
        if (opts.clear !== false) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
          const proto0 = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter0 = Object.getOwnPropertyDescriptor(proto0, 'value')?.set;
          if (setter0) setter0.call(el, '');
          else el.value = '';
        }
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (opts.typingDelayMs > 0) {
          if (setter) setter.call(el, '');
          else el.value = '';
          for (const ch of str) {
            const cur = (el.value || '') + ch;
            if (setter) setter.call(el, cur);
            else el.value = cur;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
            await this.sleep(opts.typingDelayMs);
          }
        } else {
          if (setter) setter.call(el, str);
          else el.value = str;
        }
      } catch (_) {
        el.value = str;
      }
      if (wasReadonly) el.readOnly = true;

      try {
        el.dispatchEvent(
          new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: str })
        );
      } catch (_) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      this.syncVueInput(el, str);
      el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      return true;
    }

    return false;
  },

  closeOverlays() {
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
    }
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  },

  /** 类似对 combobox：click → getByRole('option') → click */
  async selectCombobox(root, value, scoreFn) {
    if (!root || !value) return false;
    const trigger = root.querySelector('.ant-select-selector, .el-input__inner, input') || root;
    trigger.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    trigger.click?.();
    await this.sleep(160);

    const dropdownSelectors = [
      '.el-select-dropdown:not(.is-hidden)',
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      '[role="listbox"]'
    ];
    let dropdown = null;
    for (const sel of dropdownSelectors) {
      for (const node of document.querySelectorAll(sel)) {
        const st = window.getComputedStyle(node);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        dropdown = node;
        break;
      }
      if (dropdown) break;
    }
    if (!dropdown) {
      this.closeOverlays();
      return false;
    }

    const options = dropdown.querySelectorAll(
      '[role="option"], .el-select-dropdown__item:not(.is-disabled), .ant-select-item-option:not(.ant-select-item-option-disabled)'
    );
    let best = null;
    let bestScore = 0;
    for (const opt of options) {
      const text = opt.getAttribute('title') || opt.getAttribute('label') || opt.textContent || '';
      const score = scoreFn ? scoreFn(text, value) : text.includes(value) ? 1 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = opt;
      }
    }
    if (!best || bestScore < 0.5) {
      const wrap = dropdown.querySelector('.el-select-dropdown__wrap, .rc-virtual-list-holder');
      if (wrap && wrap.scrollHeight > wrap.clientHeight + 8) {
        for (let i = 0; i < 6; i++) {
          wrap.scrollTop += Math.max(80, Math.floor(wrap.clientHeight * 0.75));
          await this.sleep(70);
          for (const opt of dropdown.querySelectorAll(
            '[role="option"], .el-select-dropdown__item:not(.is-disabled), .ant-select-item-option:not(.ant-select-item-option-disabled)'
          )) {
            const text = opt.getAttribute('title') || opt.getAttribute('label') || opt.textContent || '';
            const score = scoreFn ? scoreFn(text, value) : text.includes(value) ? 1 : 0;
            if (score > bestScore) {
              bestScore = score;
              best = opt;
            }
          }
          if (best && bestScore >= 0.5) break;
        }
      }
    }
    if (!best || bestScore < 0.5) {
      this.closeOverlays();
      return false;
    }
    best.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    best.click();
    await this.sleep(100);
    this.closeOverlays();
    return true;
  },

  /** 日期范围：Playwright 式直接 fill 两个 input，不点开日历 */
  async fillDateRange(root, start, end) {
    if (!root) return false;
    const inputs = root.querySelectorAll('input');
    if (inputs.length < 2 || !start || !end) return false;

    this.closeOverlays();
    await this.sleep(80);

    await this.fill(inputs[0], start);
    await this.sleep(80);
    await this.fill(inputs[1], end);
    this.press(inputs[1], 'Enter');
    await this.sleep(100);
    this.closeOverlays();

    const v0 = inputs[0].value?.trim() || '';
    const v1 = inputs[1].value?.trim() || '';
    return !!v0 && !!v1;
  },

  /** FormPilot 式填完高亮 */
  highlightFilled(el, ok = true) {
    const target = JobTrackerFillEngine.detectWidget(el).root || el;
    if (!target?.style) return;
    const color = ok ? 'rgba(34, 197, 94, 0.45)' : 'rgba(245, 158, 11, 0.45)';
    const prev = target.style.boxShadow;
    target.style.transition = 'box-shadow 0.2s ease';
    target.style.boxShadow = `0 0 0 3px ${color}`;
    setTimeout(() => {
      target.style.boxShadow = prev;
    }, ok ? 1200 : 800);
  },

  /** Playwright getByRole */
  getByRole(role, name, root = document) {
    const r = String(role || '').toLowerCase();
    const target = this.normLabel(name);
    const nodes = root.querySelectorAll('[role], input, select, textarea, .el-select, .ant-select, .el-date-editor, .ant-picker');
    for (const el of nodes) {
      const elRole = (el.getAttribute('role') || JobTrackerDomScanner?.getRole(el) || '').toLowerCase();
      if (r && elRole !== r) continue;
      const label = JobTrackerDomScanner?.extractLabel(el)?.label || el.getAttribute('aria-label') || '';
      const t = this.normLabel(label);
      if (!target || t.includes(target) || target.includes(t)) {
        return el.querySelector?.('input') || el;
      }
    }
    return null;
  }
};
