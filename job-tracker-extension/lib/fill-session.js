const JobTrackerFillSession = {
  STORAGE_KEY: 'jt_fill_session',
  MERGE_WINDOW_MS: 30 * 60 * 1000,

  createId() {
    return JobTrackerConstants.uuid();
  },

  async get() {
    const data = await chrome.storage.session.get(this.STORAGE_KEY);
    return data[this.STORAGE_KEY] || null;
  },

  async save(session) {
    await chrome.storage.session.set({ [this.STORAGE_KEY]: session });
    return session;
  },

  async clear() {
    await chrome.storage.session.remove(this.STORAGE_KEY);
  },

  async ensureSession(ctx = {}) {
    const url = ctx.url || '';
    let session = await this.get();
    if (session && session.url === url) {
      if (ctx.resumeVersionId && !session.resumeVersionId) {
        session.resumeVersionId = ctx.resumeVersionId;
        session.resumeVersionName = ctx.resumeVersionName || session.resumeVersionName;
      }
      if (ctx.company && !session.company) session.company = ctx.company;
      if (ctx.position && !session.position) session.position = ctx.position;
      return this.save(session);
    }

    session = {
      id: this.createId(),
      url,
      company: ctx.company || '',
      position: ctx.position || '',
      resumeVersionId: ctx.resumeVersionId || '',
      resumeVersionName: ctx.resumeVersionName || '',
      filledFields: [],
      filledFieldCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: null
    };
    return this.save(session);
  },

  async trackFill(fieldLabel, meta = {}) {
    const session = await this.get();
    if (!session) return null;
    const label = String(fieldLabel || '').trim();
    if (!label) return session;
    if (!session.filledFields.some((f) => f.label === label)) {
      session.filledFields.push({ label, at: new Date().toISOString(), ...meta });
    }
    session.filledFieldCount = session.filledFields.length;
    return this.save(session);
  },

  async trackBulk(filledItems = []) {
    const session = await this.get();
    if (!session) return null;
    for (const item of filledItems) {
      const label = String(item?.label || '').trim();
      if (!label) continue;
      if (!session.filledFields.some((f) => f.label === label)) {
        session.filledFields.push({ label, at: new Date().toISOString(), value: item.value || '' });
      }
    }
    session.filledFieldCount = session.filledFields.length;
    return this.save(session);
  },

  async complete() {
    const session = await this.get();
    if (!session) return null;
    session.completedAt = new Date().toISOString();
    return this.save(session);
  },

  getSummary(session) {
    const s = session || null;
    if (!s) return null;
    return {
      fillSessionId: s.id,
      resumeVersionId: s.resumeVersionId || '',
      resumeVersion: s.resumeVersionName || '',
      filledFieldCount: s.filledFieldCount || 0,
      company: s.company || '',
      position: s.position || '',
      url: s.url || '',
      startedAt: s.startedAt || '',
      completedAt: s.completedAt || ''
    };
  },

  isRecent(session, withinMs = this.MERGE_WINDOW_MS) {
    if (!session?.startedAt) return false;
    return Date.now() - new Date(session.startedAt).getTime() < withinMs;
  },

  matchesRecord(session, record) {
    if (!session || !record) return false;
    if (session.url && record.url && session.url === record.url) return true;
    if (session.company && record.company) {
      const a = String(session.company).trim();
      const b = String(record.company).trim();
      if (a && b && (a === b || a.includes(b) || b.includes(a))) return true;
    }
    return false;
  },

  mergeIntoRecord(record, session) {
    if (!session || !this.isRecent(session)) return record;
    if (!this.matchesRecord(session, record)) return record;
    const out = { ...record };
    if (session.resumeVersionName && !out.resumeVersion) out.resumeVersion = session.resumeVersionName;
    if (session.resumeVersionId && !out.resumeVersionId) out.resumeVersionId = session.resumeVersionId;
    if (session.id && !out.fillSessionId) out.fillSessionId = session.id;
    if (session.filledFieldCount && !out.filledFieldCount) out.filledFieldCount = session.filledFieldCount;
    if (!out.fillStatus && out.status) out.fillStatus = out.status;
    return out;
  },

  buildRecordFromSession(session, overrides = {}) {
    const summary = this.getSummary(session);
    if (!summary) return null;
    return {
      company: overrides.company || summary.company,
      position: overrides.position || summary.position,
      status: overrides.status || '已填表',
      fillStatus: overrides.fillStatus || '已填表',
      resumeVersion: summary.resumeVersion,
      resumeVersionId: summary.resumeVersionId,
      filledFieldCount: summary.filledFieldCount,
      fillSessionId: summary.fillSessionId,
      url: summary.url || overrides.url || '',
      source: overrides.source || 'fill-session'
    };
  }
};
