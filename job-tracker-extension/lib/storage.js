const JobTrackerStorage = {
  async getAll() {
    const data = await chrome.storage.local.get(JobTrackerConstants.STORAGE_KEY);
    return data[JobTrackerConstants.STORAGE_KEY] || [];
  },

  buildNote(record) {
    const parts = [];
    if (record.resumeVersion) parts.push(record.resumeVersion);
    if (record.note && !parts.some((p) => record.note.includes(p))) parts.push(record.note);
    return parts.join(' · ');
  },

  async save(record) {
    const list = await this.getAll();
    const now = new Date();
    const note = this.buildNote(record);
    const status = record.status || '已投递';
    const entry = {
      id: record.id || JobTrackerConstants.uuid(),
      company: (record.company || '').trim(),
      position: (record.position || '').trim(),
      status,
      fillStatus: record.fillStatus || status,
      applyDate: record.applyDate || JobTrackerConstants.formatApplyDate(now),
      note,
      resumeVersion: record.resumeVersion || '',
      resumeVersionId: record.resumeVersionId || '',
      filledFieldCount: record.filledFieldCount ?? 0,
      fillSessionId: record.fillSessionId || '',
      confidence: record.confidence ?? 100,
      confirmed: record.confirmed !== false,
      recordDate: record.recordDate || JobTrackerConstants.formatDate(now),
      url: record.url || '',
      platform: record.platform || '',
      source: record.source || 'manual',
      createdAt: record.createdAt || now.toISOString(),
      updatedAt: now.toISOString()
    };

    const dupIdx = JobTrackerEntityResolution.findDuplicateIndex(list, entry);
    if (dupIdx >= 0) {
      list[dupIdx] = JobTrackerEntityResolution.mergePreferExisting(list[dupIdx], {
        ...entry,
        updatedAt: now.toISOString()
      });
    } else {
      list.unshift(entry);
    }

    await chrome.storage.local.set({ [JobTrackerConstants.STORAGE_KEY]: list });
    await this.updateBadge();
    return entry;
  },

  async remove(id) {
    const list = (await this.getAll()).filter((r) => r.id !== id);
    await chrome.storage.local.set({ [JobTrackerConstants.STORAGE_KEY]: list });
    await this.updateBadge();
  },

  async update(id, patch) {
    const list = await this.getAll();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('记录不存在');
    const merged = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    if (patch.note !== undefined || patch.resumeVersion !== undefined) {
      merged.note = this.buildNote(merged);
    }
    list[idx] = merged;
    await chrome.storage.local.set({ [JobTrackerConstants.STORAGE_KEY]: list });
    return list[idx];
  },

  async updateBadge() {
    const pending = await JobTrackerPending.getAll();
    const records = await this.getAll();
    const pendingN = pending.length;
    const recordN = records.length;
    let text = '';
    if (pendingN > 0) {
      text = pendingN > 99 ? '99+' : String(pendingN);
    } else if (recordN > 0) {
      text = recordN > 99 ? '99+' : String(recordN);
    }
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: pendingN ? '#d97706' : '#2563eb' });
  },

  async importRecords(records) {
    const existing = await this.getAll();
    const merged = [...records, ...existing];
    await chrome.storage.local.set({ [JobTrackerConstants.STORAGE_KEY]: merged });
    await this.updateBadge();
    return merged.length;
  }
};
