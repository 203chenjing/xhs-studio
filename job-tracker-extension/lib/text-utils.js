const JobTrackerTextUtils = {
  tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  },

  jaccard(a, b) {
    const sa = new Set(this.tokenize(a));
    const sb = new Set(this.tokenize(b));
    if (!sa.size && !sb.size) return 1;
    let inter = 0;
    for (const x of sa) if (sb.has(x)) inter++;
    const union = sa.size + sb.size - inter;
    return union ? inter / union : 0;
  },

  levenshtein(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    if (s === t) return 0;
    const m = s.length;
    const n = t.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  },

  similarity(a, b) {
    const sa = String(a || '').trim();
    const sb = String(b || '').trim();
    if (!sa || !sb) return 0;
    if (sa === sb) return 1;
    const jac = this.jaccard(sa, sb);
    const dist = this.levenshtein(sa, sb);
    const lev = 1 - dist / Math.max(sa.length, sb.length, 1);
    return Math.max(jac, lev);
  },

  partialRatio(label, keyword) {
    const l = String(label || '').toLowerCase().replace(/\s+/g, '');
    const k = String(keyword || '').toLowerCase().replace(/\s+/g, '');
    if (!l || !k) return 0;
    if (l === k) return 1;
    if (l.includes(k) || k.includes(l)) return Math.min(1, (Math.min(l.length, k.length) / Math.max(l.length, k.length)) * 0.95 + 0.05);
    const shorter = l.length <= k.length ? l : k;
    const longer = l.length <= k.length ? k : l;
    let best = 0;
    for (let i = 0; i <= longer.length - shorter.length; i++) {
      const sub = longer.slice(i, i + shorter.length);
      const sim = 1 - this.levenshtein(shorter, sub) / Math.max(shorter.length, 1);
      if (sim > best) best = sim;
    }
    return best;
  },

  stripCompanySuffix(name) {
    return String(name || '')
      .replace(/[（(].*?[）)]/g, '')
      .replace(/(股份)?有限(责任)?公司$/g, '')
      .replace(/(科技|网络|信息|技术|集团|控股|实业|发展|股份)(有限)?$/g, '')
      .replace(/\s+/g, '')
      .trim();
  },

  normalizeCompany(name) {
    return this.stripCompanySuffix(name);
  }
};
