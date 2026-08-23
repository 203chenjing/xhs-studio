const JobTrackerEntityResolution = {
  normalizeCompany(name) {
    return JobTrackerTextUtils.normalizeCompany(name);
  },

  companySimilarity(a, b) {
    const na = this.normalizeCompany(a);
    const nb = this.normalizeCompany(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.92;
    return JobTrackerTextUtils.similarity(na, nb);
  },

  positionSimilarity(a, b) {
    return JobTrackerTextUtils.similarity(a, b);
  },

  isDuplicate(a, b) {
    const companySim = this.companySimilarity(a.company, b.company);
    const posSim = this.positionSimilarity(a.position, b.position);
    const sameDate = !a.applyDate || !b.applyDate || a.applyDate === b.applyDate;
    if (companySim >= 0.88 && posSim >= 0.75 && sameDate) return true;
    if (companySim >= 0.95 && posSim >= 0.6 && sameDate) return true;
    return false;
  },

  findDuplicateIndex(list, entry) {
    return list.findIndex((r) => this.isDuplicate(r, entry));
  },

  noteHasSuccessKeyword(note) {
    const text = String(note || '');
    if (!text) return false;
    return (JobTrackerConstants.SUCCESS_KEYWORDS || []).some((kw) => text.includes(kw));
  },

  mergeNotes(existingNote, incomingNote) {
    const a = String(existingNote || '').trim();
    const b = String(incomingNote || '').trim();
    if (!a) return b;
    if (!b) return a;
    if (a === b || a.includes(b)) return a;
    if (b.includes(a)) return b;
    if (this.noteHasSuccessKeyword(b) && !this.noteHasSuccessKeyword(a)) return b;
    if (this.noteHasSuccessKeyword(a) && !this.noteHasSuccessKeyword(b)) return a;
    return a;
  },

  mergePreferExisting(existing, incoming) {
    const merged = {
      ...existing,
      ...incoming,
      id: existing.id,
      company: existing.company || incoming.company,
      position: existing.position || incoming.position,
      confidence: Math.max(existing.confidence || 0, incoming.confidence || 0),
      resumeVersion: existing.resumeVersion || incoming.resumeVersion,
      resumeVersionId: existing.resumeVersionId || incoming.resumeVersionId,
      fillSessionId: existing.fillSessionId || incoming.fillSessionId,
      filledFieldCount: Math.max(existing.filledFieldCount || 0, incoming.filledFieldCount || 0)
    };
    if (incoming.fillStatus) merged.fillStatus = incoming.fillStatus;
    merged.note = this.mergeNotes(existing.note, incoming.note);
    return merged;
  }
};
