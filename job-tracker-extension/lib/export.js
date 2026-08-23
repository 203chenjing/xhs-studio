const JobTrackerExport = {
  toTSV(records) {
    const header = ['公司', '岗位', '状态', '填表状态', '投递日期', '备注', '记录日期', '简历版本', '简历版本ID', '已填字段数'].join('\t');
    const rows = records.map((r) =>
      [
        r.company || '',
        r.position || '',
        r.status || '',
        r.fillStatus || r.status || '',
        r.applyDate || '',
        r.note || '',
        r.recordDate || '',
        r.resumeVersion || '',
        r.resumeVersionId || '',
        r.filledFieldCount ?? ''
      ]
        .map((cell) => String(cell).replace(/\t/g, ' ').replace(/\r?\n/g, ' '))
        .join('\t')
    );
    return [header, ...rows].join('\n');
  },

  downloadTSV(records, filename) {
    const tsv = this.toTSV(records);
    const blob = new Blob(['\ufeff' + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `校招投递记录_${JobTrackerConstants.formatApplyDate()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  parseTSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    const start = /^公司/.test(lines[0]) ? 1 : 0;
    const newFormat = /^公司/.test(lines[0]) && lines[0].includes('填表状态');
    const records = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length < 3) continue;
      const hasFillStatus = newFormat || cols.length >= 9;
      records.push({
        id: JobTrackerConstants.uuid(),
        company: cols[0]?.trim() || '',
        position: cols[1]?.trim() || '',
        status: cols[2]?.trim() || '已投递',
        fillStatus: hasFillStatus ? cols[3]?.trim() || cols[2]?.trim() : cols[2]?.trim() || '已投递',
        applyDate: hasFillStatus ? cols[4]?.trim() || '' : cols[3]?.trim() || '',
        note: hasFillStatus ? cols[5]?.trim() || '' : cols[4]?.trim() || '',
        recordDate: hasFillStatus ? cols[6]?.trim() || JobTrackerConstants.formatDate() : cols[5]?.trim() || JobTrackerConstants.formatDate(),
        resumeVersion: hasFillStatus ? cols[7]?.trim() || '' : cols[6]?.trim() || '',
        resumeVersionId: hasFillStatus ? cols[8]?.trim() || '' : '',
        filledFieldCount: hasFillStatus ? parseInt(cols[9], 10) || 0 : 0,
        url: '',
        platform: '',
        source: 'import',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return records;
  }
};
