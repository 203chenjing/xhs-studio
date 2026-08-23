/**
 * 轻量 Agent 填表：观察 DOM 快照 → AI 规划操作 → 执行 click/type/select
 * 参考 chrome-agent / FSB / Browser Use 的 Think-Act-Observe 循环，专用于网申表单。
 */
const JobTrackerAgentFill = {
  findClickableByText(text) {
    const v = String(text || '').trim();
    if (!v) return null;
    const selectors = [
      '.ant-select-item-option:not(.ant-select-item-option-disabled)',
      '.ant-cascader-menu-item:not(.ant-cascader-menu-item-disabled)',
      '.el-select-dropdown__item:not(.is-disabled)',
      '.ant-picker-cell-inner',
      '[role="option"]'
    ];
    let best = null;
    let bestScore = 0;
    for (const sel of selectors) {
      for (const node of document.querySelectorAll(sel)) {
        const t = (node.getAttribute('title') || node.textContent || '').trim();
        if (!t || t.length > 48) continue;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const score = JobTrackerFillEngine.scoreOptionMatch(t, v);
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
    }
    return bestScore >= 0.5 ? best : null;
  },

  async executeAction(action) {
    const type = String(action?.action || action?.type || '').toLowerCase();
    const el = action?.ref ? JobTrackerPageSnapshot.getElement(action.ref) : null;

    if (type === 'scroll') {
      (el || document.body).scrollIntoView?.({ block: 'center', behavior: 'instant' });
      return { ok: true };
    }

    if (type === 'click_text') {
      const hit = this.findClickableByText(action.text || action.value);
      if (!hit) return { ok: false, reason: 'text not found' };
      JobTrackerFillEngine.mouseDown(hit);
      JobTrackerFillEngine.simulateClick(hit);
      await JobTrackerFillEngine.sleep(120);
      return { ok: true };
    }

    if (type === 'mousedown') {
      if (!el) return { ok: false, reason: 'no ref' };
      JobTrackerFillEngine.mouseDown(el);
      await JobTrackerFillEngine.sleep(120);
      return { ok: true };
    }

    if (type === 'click') {
      if (!el) return { ok: false, reason: 'no ref' };
      JobTrackerFillEngine.simulateClick(el);
      await JobTrackerFillEngine.sleep(120);
      return { ok: true };
    }

    if (type === 'press_key') {
      const target = el || document.activeElement || document.body;
      const key = action.key || 'Enter';
      target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, view: window }));
      target.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, view: window }));
      await JobTrackerFillEngine.sleep(80);
      return { ok: true };
    }

    if (type === 'fill' || type === 'type' || type === 'select' || type === 'date') {
      if (!el) return { ok: false, reason: 'no ref' };
      const ok = await JobTrackerFillEngine.fillElement(el, action.value);
      if (!ok && (type === 'select' || type === 'date')) {
        JobTrackerFillEngine.mouseDown(el);
        await JobTrackerFillEngine.sleep(120);
        const hit = this.findClickableByText(action.value);
        if (hit) {
          JobTrackerFillEngine.simulateClick(hit);
          await JobTrackerFillEngine.sleep(100);
          return { ok: true };
        }
      }
      return { ok };
    }

    if (type === 'click_then_select' && el) {
      JobTrackerFillEngine.mouseDown(el);
      await JobTrackerFillEngine.sleep(140);
      const hit = this.findClickableByText(action.value || action.text);
      if (hit) {
        JobTrackerFillEngine.simulateClick(hit);
        await JobTrackerFillEngine.sleep(100);
        return { ok: true };
      }
      return { ok: false, reason: 'option not found' };
    }

    return { ok: false, reason: 'unknown action' };
  },

  async runPass(profile, atsProfile, excludeRoot, options = {}) {
    const maxRounds = options.maxRounds ?? 3;
    let agentOk = 0;
    const filled = [];

    for (let round = 0; round < maxRounds; round++) {
      const snapshot = JobTrackerPageSnapshot.build(atsProfile, excludeRoot);
      const emptyFields = snapshot.fields.filter((f) => f.empty && f.label);
      if (!emptyFields.length) break;

      let plan = null;
      try {
        plan = await chrome.runtime.sendMessage({
          type: 'AI_AGENT_FORM_PLAN',
          snapshot: { url: snapshot.url, title: snapshot.title, fields: emptyFields },
          round
        });
      } catch (_) {}

      if (!plan?.ok || !Array.isArray(plan.actions) || !plan.actions.length) break;

      for (const action of plan.actions) {
        const before = action.ref
          ? JobTrackerPageSnapshot.readCurrentValue(JobTrackerPageSnapshot.getElement(action.ref))
          : '';
        const res = await this.executeAction(action);
        if (res.ok) {
          const el = action.ref ? JobTrackerPageSnapshot.getElement(action.ref) : null;
          const after = el ? JobTrackerPageSnapshot.readCurrentValue(el) : '';
          const changed = action.value && (!before || before !== after || JobTrackerPageSnapshot.isEmptyValue(before));
          if (changed || action.action === 'click_text') {
            agentOk++;
            const field = emptyFields.find((f) => f.ref === action.ref);
            filled.push({
              label: field?.label || action.text || action.ref || 'Agent',
              value: action.value || action.text || ''
            });
          }
        }
        await JobTrackerFillEngine.sleep(90);
      }
    }

    return { agentOk, filled };
  }
};
