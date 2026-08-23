const JobTrackerFieldMatcher = {
  MATCH_THRESHOLD: 0.52,

  TYPE_HINTS: {
    email: ['email', 'mail', '邮箱', '邮件'],
    tel: ['phone', 'mobile', 'tel', '手机', '电话'],
    date: ['date', 'birth', '生日', '出生', '入学', '毕业'],
    number: ['gpa', '绩点', '排名', 'rank']
  },

  scoreRule(label, rule, hints = {}) {
    const text = String(label || '').toLowerCase().replace(/\s+/g, '');
    if (!text) return { score: 0, reasons: ['empty-label'] };

    let score = 0;
    const reasons = [];
    let bestKw = 0;

    for (const kw of rule.keywords) {
      const k = kw.toLowerCase().replace(/\s+/g, '');
      if (!k) continue;
      if (text === k) {
        bestKw = Math.max(bestKw, 1);
        reasons.push(`exact:${kw}`);
      } else if (text.includes(k) || k.includes(text)) {
        bestKw = Math.max(bestKw, 0.82);
        reasons.push(`contains:${kw}`);
      } else {
        const pr = JobTrackerTextUtils.partialRatio(text, k);
        if (pr > 0.65) {
          bestKw = Math.max(bestKw, pr * 0.78);
          reasons.push(`partial:${kw}`);
        }
      }
    }

    score += bestKw * 0.55;
    score += (rule.priority / 100) * 0.25;

    const labelTokens = new Set(JobTrackerTextUtils.tokenize(label));
    const ruleTokens = new Set(rule.keywords.flatMap((k) => JobTrackerTextUtils.tokenize(k)));
    let overlap = 0;
    for (const t of labelTokens) if (ruleTokens.has(t)) overlap++;
    if (labelTokens.size) score += (overlap / labelTokens.size) * 0.12;

    const type = (hints.type || '').toLowerCase();
    const name = `${hints.name || ''} ${hints.placeholder || ''} ${hints.id || ''}`.toLowerCase();
    const blob = `${text} ${name}`;
    if (rule.path.includes('email') && (type === 'email' || /mail|邮箱/.test(blob))) {
      score += 0.08;
      reasons.push('type:email');
    }
    if (rule.path.includes('phone') && (type === 'tel' || /phone|mobile|手机/.test(blob))) {
      score += 0.08;
      reasons.push('type:tel');
    }
    if (rule.path.includes('Date') && (type === 'date' || /date|日期|时间/.test(blob))) {
      score += 0.06;
      reasons.push('type:date');
    }

    if (rule.path.includes('@master') && /硕士|研究生/.test(text)) {
      score += 0.12;
      reasons.push('degree:master');
    }
    if (rule.path.includes('@bachelor') && /本科|学士/.test(text)) {
      score += 0.12;
      reasons.push('degree:bachelor');
    }
    if (rule.path.includes('@highest') && /最高/.test(text)) {
      score += 0.1;
      reasons.push('degree:highest');
    }

    if (rule.category) {
      const catAliases = JobTrackerFieldMapping.CATEGORY_ALIASES[rule.category] || [];
      if (catAliases.some((a) => blob.includes(a.toLowerCase()))) {
        score += 0.12;
        reasons.push(`category:${rule.category}`);
      }
    }
    if (rule.section === 'education' && /学校|专业|学历|教育|gpa|绩点|cet/i.test(blob)) {
      score += 0.05;
      reasons.push('section:education');
    }
    if (rule.section === 'experience' && /公司|岗位|实习|工作|项目|职责|描述/i.test(blob)) {
      score += 0.05;
      reasons.push('section:experience');
    }

    return { score: Math.min(1, score), reasons };
  },

  matchLabel(label, hints = {}) {
    const text = String(label || '').trim();
    if (!text) return { rule: null, score: 0, skipReason: '无标签' };

    let best = null;
    let bestScore = 0;
    let bestReasons = [];

    for (const rule of JobTrackerFieldMapping.RULES) {
      const { score, reasons } = this.scoreRule(text, rule, hints);
      if (score > bestScore) {
        bestScore = score;
        best = rule;
        bestReasons = reasons;
      }
    }

    if (!best || bestScore < this.MATCH_THRESHOLD) {
      return {
        rule: null,
        score: bestScore,
        skipReason: best ? `得分 ${Math.round(bestScore * 100)} 低于阈值` : '无匹配规则',
        candidate: best?.path
      };
    }

    return { rule: best, score: bestScore, reasons: bestReasons };
  }
};
