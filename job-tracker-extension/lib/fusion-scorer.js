const JobTrackerFusionScorer = {
  WEIGHTS: {
    rule: 0.28,
    url: 0.1,
    title: 0.18,
    dom: 0.16,
    meta: 0.12,
    success: 0.22
  },

  pickBest(candidates, field) {
    const scored = candidates
      .filter((c) => c[field])
      .map((c) => ({ value: c[field], score: c.weight * (c.confidence || 1), source: c.source }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0] || null;
  },

  scoreUrlTokens(url) {
    try {
      const u = new URL(url || '');
      const tokens = `${u.hostname} ${u.pathname}`
        .split(/[/\-_.?&=]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
      const companyHints = tokens.filter(
        (t) => !/^(www|app|campus|jobs|job|apply|success|detail|position|post|example|localhost|com|cn|net)$/i.test(t)
      );
      return { tokens: companyHints.slice(0, 6), host: u.hostname };
    } catch (_) {
      return { tokens: [], host: '' };
    }
  },

  parseTitle(title) {
    const parts = String(title || '')
      .split(/[-_|·—–/／]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) return { company: '', position: parts[0] || '' };
    const last = parts[parts.length - 1];
    if (/招聘|校招|校园|人才|join|career|jobs/i.test(last)) {
      return { company: parts[parts.length - 2] || '', position: parts[0] };
    }
    return { company: last, position: parts[0] };
  },

  successKeywordDensity(text) {
    const body = String(text || '');
    if (!body) return 0;
    const kws = JobTrackerConstants.SUCCESS_KEYWORDS || [];
    let hits = 0;
    for (const kw of kws) if (body.includes(kw)) hits++;
    return Math.min(1, hits / 3);
  },

  addSignal(signals, name, weight, detail, contribution) {
    signals.push({ name, weight, detail, contribution: Math.round(contribution) });
  },

  score(record, pageContext = {}) {
    const signals = [];
    const info = pageContext.ruleExtraction || {};
    const url = pageContext.url || record.url || '';
    const title = pageContext.title || '';
    const text = pageContext.text || '';

    const candidates = [];

    if (info.platform && info.platform !== '通用') {
      const w = this.WEIGHTS.rule;
      candidates.push({
        source: 'site-rule',
        weight: w,
        confidence: 0.95,
        company: info.company || record.company,
        position: info.position || record.position
      });
      this.addSignal(signals, 'site-rule', w, info.platform || '站点规则', w * 95);
    } else if (info.company || info.position) {
      const w = this.WEIGHTS.rule * 0.7;
      candidates.push({
        source: 'generic-rule',
        weight: w,
        confidence: 0.75,
        company: info.company,
        position: info.position
      });
      this.addSignal(signals, 'dom-heuristic', w, '通用 DOM/规则', w * 75);
    }

    const urlInfo = this.scoreUrlTokens(url);
    if (urlInfo.tokens.length) {
      const w = this.WEIGHTS.url;
      const hostCompany = urlInfo.tokens[0] || '';
      if (hostCompany.length >= 2) {
        candidates.push({ source: 'url', weight: w, confidence: 0.55, company: hostCompany, position: '' });
        this.addSignal(signals, 'url-tokens', w, urlInfo.host, w * 55);
      }
    }

    const titleParsed = this.parseTitle(title);
    if (titleParsed.company || titleParsed.position) {
      const w = this.WEIGHTS.title;
      candidates.push({
        source: 'title',
        weight: w,
        confidence: 0.8,
        company: titleParsed.company,
        position: titleParsed.position
      });
      this.addSignal(signals, 'title-parse', w, title.slice(0, 60), w * 80);
    }

    if (record.company || record.position) {
      const w = this.WEIGHTS.dom;
      candidates.push({
        source: 'record',
        weight: w,
        confidence: 0.85,
        company: record.company,
        position: record.position
      });
      this.addSignal(signals, 'dom-label', w, '已提取字段', w * 85);
    }

    const metaCompany = info.metaCompany || '';
    const metaPosition = info.metaPosition || '';
    if (metaCompany || metaPosition) {
      const w = this.WEIGHTS.meta;
      candidates.push({ source: 'meta', weight: w, confidence: 0.82, company: metaCompany, position: metaPosition });
      this.addSignal(signals, 'meta-jsonld', w, '结构化/meta', w * 82);
    }

    const successDensity = this.successKeywordDensity(text);
    if (successDensity > 0) {
      const w = this.WEIGHTS.success * successDensity;
      this.addSignal(signals, 'success-keywords', this.WEIGHTS.success, `密度 ${Math.round(successDensity * 100)}%`, w * 100);
    }

    const bestCompany = this.pickBest(candidates, 'company');
    const bestPosition = this.pickBest(candidates, 'position');

    let company = bestCompany?.value || record.company || info.company || '';
    let position = bestPosition?.value || record.position || info.position || '';

    if (company && bestCompany?.source === 'url') {
      company = JobTrackerTextUtils.normalizeCompany(company);
    }
    if (company) company = company.trim();
    if (position) position = position.trim();

    let confidence = 0;
    if (company) confidence += 38;
    if (position) confidence += 38;
    if (info.platform && info.platform !== '通用') confidence += 10;
    if (info.auto?.status) confidence += 12;
    if (successDensity >= 0.33) confidence += 10;
    if (successDensity >= 0.33 && company && position) confidence += 8;
    if (info.auto?.status === '已投递' && company && position) confidence += 6;
    if (record.source?.includes('auto-detect') || record.source?.includes('auto-click')) confidence += 6;
    if (record.source === 'manual' || record.source === 'manual-panel' || record.source === 'popup') confidence += 14;
    if (!company) confidence -= 28;
    if (!position) confidence -= 28;
    if (!company && /auto|click/.test(record.source || '')) confidence -= 12;
    if (!position && /auto|click/.test(record.source || '')) confidence -= 12;

    if (company && position) {
      const cross = JobTrackerTextUtils.jaccard(company, position);
      if (cross > 0.7) confidence -= 15;
    }

    confidence = Math.min(100, Math.max(0, Math.round(confidence)));

    return { company, position, confidence, signals };
  }
};
