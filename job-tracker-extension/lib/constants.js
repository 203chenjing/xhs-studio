const JobTrackerConstants = {
  STORAGE_KEY: 'job_applications',

  STATUSES: [
    '已投递',
    '已填表',
    '已准备简历',
    '被挂',
    '测评',
    '笔试',
    '面试',
    'Offer',
    '拒信'
  ],

  SUCCESS_KEYWORDS: [
    '投递成功',
    '申请成功',
    '提交成功',
    '已成功投递',
    '已成功申请',
    '已成功提交',
    '申请已提交',
    '简历已投递',
    '网申成功',
    '确认投递',
    '感谢您的申请',
    '感谢你的申请'
  ],

  /** 投递按钮点击后的捕获重试间隔（毫秒） */
  CAPTURE_SUBMIT_DELAYS_MS: [2800, 6000],

  ASSESSMENT_KEYWORDS: [
    '在线测评',
    '能力测评',
    '性格测评',
    '北森',
    '开始测评',
    '进入测评'
  ],

  formatDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  },

  formatApplyDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  uuid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
};
