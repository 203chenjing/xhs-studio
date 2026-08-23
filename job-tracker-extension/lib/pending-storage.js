const JobTrackerPending = {
  STORAGE_KEY: 'job_tracker_pending',

  async getAll() {
    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    return data[this.STORAGE_KEY] || [];
  },

  async add(record) {
    const list = await this.getAll();
    const entry = {
      ...record,
      id: record.id || JobTrackerConstants.uuid(),
      pendingAt: new Date().toISOString()
    };
    list.unshift(entry);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: list.slice(0, 100) });
    await JobTrackerStorage.updateBadge();
    return entry;
  },

  async remove(id) {
    const list = (await this.getAll()).filter((r) => r.id !== id);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: list });
    await JobTrackerStorage.updateBadge();
  },

  async update(id, patch) {
    const list = await this.getAll();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('待确认记录不存在');
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    await chrome.storage.local.set({ [this.STORAGE_KEY]: list });
    await JobTrackerStorage.updateBadge();
    return list[idx];
  },

  async confirm(id, patch = {}) {
    const list = await this.getAll();
    const item = list.find((r) => r.id === id);
    if (!item) throw new Error('待确认记录不存在');
    const merged = { ...item, ...patch, confirmed: true, source: 'confirmed' };
    await this.remove(id);
    return JobTrackerStorage.save(merged);
  }
};
