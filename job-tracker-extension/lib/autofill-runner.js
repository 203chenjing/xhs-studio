const JobTrackerAutoFill = {
  collectInputs(atsProfile, excludeRoot) {
    const extra = atsProfile?.formSelectors || null;
    return JobTrackerFillEngine.scanInputs(document, excludeRoot, extra);
  },

  async fillOne(profile, el, atsProfile) {
    const det =
      typeof JobTrackerDomScanner !== 'undefined'
        ? JobTrackerDomScanner.describeField(el, atsProfile)
        : null;
    const rawLabel = det?.label || JobTrackerATS.getFieldLabel(el, atsProfile);
    const sectionCtx = JobTrackerFormSection.detect(el);
    const label = JobTrackerFormSection.enrichLabel(rawLabel, sectionCtx);
    const hints = {
      type: el.type,
      name: el.name,
      placeholder: el.placeholder,
      id: el.id
    };
    const widget = JobTrackerFillEngine.detectWidget(el);

    if (widget.kind === 'ant-date-range' || widget.kind === 'el-date-range') {
      const { start, end } = JobTrackerFieldMapping.getRangeDates(profile, sectionCtx);
      if (!start || !end) return { ok: false, rawLabel: rawLabel || '起止时间', label, value: '' };
      if (JobTrackerFillEngine.rangeLooksFilled(widget.root, widget.kind, start, end)) {
        return { ok: true, rawLabel: rawLabel || '起止时间', label, value: `${start} ~ ${end}`, rule: null };
      }
      const ok = await JobTrackerFillEngine.fillDateRange(widget.root, start, end, widget.kind);
      if (ok && typeof JobTrackerPlaywrightFill !== 'undefined') {
        JobTrackerPlaywrightFill.highlightFilled(widget.root, true);
      }
      return { ok, rawLabel: rawLabel || '起止时间', label, value: `${start} ~ ${end}`, rule: null };
    }

    const { rule, value } = JobTrackerFieldMapping.resolveFieldValue(profile, rawLabel, label, sectionCtx, hints);
    if (!value) return { ok: false, rawLabel, label, value: '' };
    const ok = await JobTrackerFillEngine.fillElementWithRetry(el, value);
    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      JobTrackerPlaywrightFill.highlightFilled(el, ok);
    }
    return { ok, rawLabel, label, value, rule };
  },

  async runLocalSweep(profile, atsProfile, excludeRoot, rounds = 2) {
    let ok = 0;
    const filled = [];
    for (let r = 0; r < rounds; r++) {
      const snapshot = JobTrackerPageSnapshot.build(atsProfile, excludeRoot);
      const emptyFields = snapshot.fields.filter((f) => f.empty && f.label);
      if (!emptyFields.length) break;
      for (const field of emptyFields) {
        const el = JobTrackerPageSnapshot.getElement(field.ref);
        if (!el) continue;
        const res = await this.fillOne(profile, el, atsProfile);
        if (res.ok) {
          ok++;
          filled.push({ label: res.rawLabel || field.label, value: res.value });
        }
        await this._pause(100);
      }
      await this._pause(300);
    }
    return { ok, filled };
  },

  _scanOptions(atsProfile) {
    const isGeneric = !atsProfile || atsProfile.name === '通用';
    return {
      expand: atsProfile?.expandSections ?? isGeneric,
      maxExpandClicks: (atsProfile?.expandSections ?? isGeneric) ? 5 : 0
    };
  },

  async runAll(profile, atsProfile, excludeRoot, options = {}) {
    const scanOpts = this._scanOptions(atsProfile);
    await JobTrackerFillEngine.preparePageForScan(document, excludeRoot, scanOpts);
    const inputs = this.collectInputs(atsProfile, excludeRoot);
    let ok = 0;
    let skip = 0;
    let aiOk = 0;
    let sweepOk = 0;
    const filled = [];
    const useAi = !!options.useAi;
    const pendingAi = [];
    const isKnownSite = atsProfile?.name && atsProfile.name !== '通用';

    for (const el of inputs) {
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') {
        skip++;
        continue;
      }
      if (!JobTrackerFillEngine.isPlaceholderValue(JobTrackerFillEngine.readFieldValue(el))) {
        continue;
      }
      const res = await this.fillOne(profile, el, atsProfile);
      if (res.value) {
        if (res.ok) {
          ok++;
          filled.push({ label: res.rawLabel || res.rule?.path || '字段', value: res.value });
        } else {
          pendingAi.push({ el, rawLabel: res.rawLabel, label: res.label, sectionCtx: JobTrackerFormSection.detect(el), value: res.value });
          skip++;
        }
        await this._pause(90);
        continue;
      }

      const rawLabel = JobTrackerATS.getFieldLabel(el, atsProfile);
      if (useAi && rawLabel) {
        pendingAi.push({ el, rawLabel, label: JobTrackerFormSection.enrichLabel(rawLabel, JobTrackerFormSection.detect(el)), sectionCtx: JobTrackerFormSection.detect(el), hints: {}, value: '' });
      } else {
        skip++;
      }
    }

    const sweepRounds = options.localSweepRounds ?? atsProfile?.localSweepRounds ?? 2;
    const sweep1 = await this.runLocalSweep(profile, atsProfile, excludeRoot, sweepRounds);
    sweepOk += sweep1.ok;
    if (sweep1.filled.length) filled.push(...sweep1.filled);

    for (const item of pendingAi.filter((x) => x.value)) {
      if (await JobTrackerFillEngine.fillElementWithRetry(item.el, item.value)) {
        ok++;
        filled.push({ label: item.rawLabel || '字段', value: item.value });
      }
      await this._pause(120);
    }

    const needAi = pendingAi.filter((x) => !x.value);
    if (useAi && needAi.length) {
      const batchSize = options.aiBatchSize ?? 40;
      for (let i = 0; i < needAi.length; i += batchSize) {
        const chunk = needAi.slice(i, i + batchSize);
        let aiMap = {};
        try {
          const aiRes = await chrome.runtime.sendMessage({
            type: 'AI_MATCH_AUTOFILL_FIELDS_BATCH',
            fields: chunk.map((item, index) => ({
              index,
              label: item.rawLabel,
              enrichedLabel: item.label,
              section: item.sectionCtx.section,
              sectionTitle: item.sectionCtx.sectionTitle,
              category: item.sectionCtx.category,
              blockIndex: item.sectionCtx.blockIndex,
              placeholder: item.el.placeholder || '',
              inputType: item.el.type || item.el.tagName
            }))
          });
          if (aiRes?.ok && aiRes.matches) {
            aiMap = aiRes.matches;
          }
        } catch (_) {}

        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          const value = String(aiMap[j] ?? aiMap[String(j)] ?? '').trim();
          if (!value) {
            skip++;
            continue;
          }
          if (await JobTrackerFillEngine.fillElementWithRetry(item.el, value)) {
            ok++;
            aiOk++;
            filled.push({ label: item.rawLabel || 'AI字段', value });
          } else {
            skip++;
          }
          await this._pause(120);
        }
      }
    }

    // 已知站点：主扫 + 一次补扫即可；通用页多留一轮补扫
    const finalSweepRounds = isKnownSite ? 1 : 2;
    const sweep2 = await this.runLocalSweep(profile, atsProfile, excludeRoot, finalSweepRounds);
    sweepOk += sweep2.ok;
    if (sweep2.filled.length) filled.push(...sweep2.filled);

    // Agent 仅在通用页或用户显式开启时自动跑；已知 ATS 走「补填下拉/日期」按钮
    let agentOn = options.useAgent === true || (!isKnownSite && options.useAgent !== false);
    if (useAi && agentOn) {
      try {
        const s = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        agentOn = s?.settings?.ai?.autofillAgent !== false;
        if (agentOn) {
          const agentResult = await JobTrackerAgentFill.runPass(profile, atsProfile, excludeRoot, {
            maxRounds: options.agentRounds ?? atsProfile?.agentRounds ?? 2
          });
          ok += agentResult.agentOk;
          aiOk += agentResult.agentOk;
          if (agentResult.filled?.length) filled.push(...agentResult.filled);
        }
      } catch (_) {}
    }

    const filledCount = ok + sweepOk;
    return {
      ok: filledCount,
      skip,
      aiOk,
      sweepOk,
      total: inputs.length,
      scanned: inputs.length,
      filled,
      profileName: atsProfile?.name || '通用',
      agent: agentOn
    };
  },

  resolveFieldValue(profile, el, atsProfile) {
    const rawLabel = JobTrackerATS.getFieldLabel(el, atsProfile);
    const sectionCtx = JobTrackerFormSection.detect(el);
    const label = JobTrackerFormSection.enrichLabel(rawLabel, sectionCtx);
    const hints = {
      type: el.type,
      name: el.name,
      placeholder: el.placeholder,
      id: el.id
    };
    const { rule, value } = JobTrackerFieldMapping.resolveFieldValue(profile, rawLabel, label, sectionCtx, hints);
    return { rawLabel, label, sectionCtx, value, rule };
  },

  findInputForLabel(label, atsProfile, excludeRoot) {
    if (typeof JobTrackerPlaywrightFill !== 'undefined') {
      const byLabel = JobTrackerPlaywrightFill.getByLabel(label, document);
      if (byLabel && JobTrackerFillEngine.isVisibleField(byLabel, excludeRoot)) return byLabel;
    }
    const inputs = this.collectInputs(atsProfile, excludeRoot);
    let best = null;
    let bestScore = 0;
    for (const el of inputs) {
      const rawLabel = JobTrackerATS.getFieldLabel(el, atsProfile);
      const sectionCtx = JobTrackerFormSection.detect(el);
      const enriched = JobTrackerFormSection.enrichLabel(rawLabel, sectionCtx);
      const score = JobTrackerFillEngine.labelMatchScore(label, rawLabel, enriched);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return bestScore >= 0.55 ? best : null;
  },

  _pause(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
};
