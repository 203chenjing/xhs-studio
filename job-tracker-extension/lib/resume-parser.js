const JobTrackerResumeParser = {
  SECTION_KEYWORDS: [
    { key: 'education', words: ['教育经历', '教育背景', '学历信息', '学历', '教育', 'education', 'academic'] },
    { key: 'internship', words: ['实习经历', '实习经验', '实习', 'internship', 'intern'] },
    { key: 'work', words: ['工作经历', '工作经验', '职业经历', '工作', 'employment', 'work experience'] },
    { key: 'project', words: ['项目经历', '项目经验', '项目', 'project', 'projects'] },
    { key: 'research', words: ['科研经历', '科研项目', '科研', '研究经历', '实验室', 'research'] },
    { key: 'competition', words: ['竞赛经历', '竞赛', '比赛', 'contest', 'honors'] },
    { key: 'campus', words: ['校园经历', '社团经历', '校园', '社团', '学生会', 'campus'] },
    { key: 'skill', words: ['专业技能', '技能特长', '技能', 'skills', '技术栈', 'certificates'] },
    { key: 'self', words: ['自我评价', '个人评价', '个人简介', 'about me', 'summary'] }
  ],

  DEGREE_WORDS_RE: /^(博士研究生?|硕士研究生?|研究生|学士|本科|专科|大专|高职|master|bachelor|ph\.?d)\s*/i,

  MAJOR_NOISE_RE: /^(博士|硕士|本科|专科|大专|学士|研究生|全日制|统招|学历|专业)\s*/g,

  DEGREE_RANK: { 博士研究生: 5, 博士: 5, 硕士研究生: 4, 硕士: 4, 研究生: 4, 本科: 3, 学士: 3, 专科: 2, 大专: 2 },

  DEGREE_PATTERNS: [
    { re: /博士|ph\.?d/i, label: '博士', full: '博士研究生' },
    { re: /硕士研究生|研究生(?!院)|master/i, label: '硕士', full: '硕士研究生' },
    { re: /硕士/i, label: '硕士', full: '硕士研究生' },
    { re: /本科|学士|bachelor/i, label: '本科', full: '本科' },
    { re: /专科|大专|高职/i, label: '专科', full: '专科' }
  ],

  DATE_RANGE_RE:
    /(\d{4}[./年\-]\d{1,2}(?:[./月\-]\d{1,2})?|\d{4}[./年]\d{1,2}|\d{4}年\d{1,2}月|\d{4})\s*[-–—~至到]\s*(\d{4}[./年\-]\d{1,2}(?:[./月\-]\d{1,2})?|\d{4}[./年]\d{1,2}|\d{4}年\d{1,2}月|\d{4}|至今|present|now)/i,

  DATE_LINE_RE: /^\s*(\d{4})/,

  PHONE_RE: /(?:\+?86[-\s]?)?(1[3-9]\d{9})/,

  EMAIL_RE: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,

  SECTION_TITLE_RE:
    /^(#{1,3}\s*)?(教育经历|学历信息|教育背景|实习经历|实习经验|工作经历|工作经验|工作及实习|项目经历|项目经验|科研项目|竞赛经历|校园经历|社团经历|自我评价|个人评价|专业技能|技能特长|academic|experience|projects)/i,

  UNIVERSITIES: [
    '清华大学', '北京大学', '复旦大学', '上海交通大学', '浙江大学', '南京大学', '中国科学技术大学',
    '中国人民大学', '武汉大学', '华中科技大学', '中山大学', '四川大学', '南开大学', '天津大学',
    '同济大学', '北京师范大学', '西安交通大学', '哈尔滨工业大学', '东南大学', '厦门大学',
    '山东大学', '吉林大学', '中南大学', '大连理工大学', '西北工业大学', '重庆大学', '电子科技大学',
    '湖南大学', '华南理工大学', '北京航空航天大学', '北京理工大学', '中国农业大学', '华东师范大学',
    '中国海洋大学', '中央民族大学', '东北大学', '兰州大学', '西北农林科技大学', '中国矿业大学',
    '河海大学', '江南大学', '南京农业大学', '南京理工大学', '南京航空航天大学', '苏州大学',
    '郑州大学', '南昌大学', '云南大学', '广西大学', '贵州大学', '海南大学', '内蒙古大学',
    '宁夏大学', '青海大学', '西藏大学', '新疆大学', '石河子大学', '延边大学', '东北师范大学',
    '辽宁大学', '安徽大学', '福州大学', '太原理工大学', '合肥工业大学', '中国石油大学',
    '中国地质大学', '中国政法大学', '中央财经大学', '对外经济贸易大学', '北京邮电大学',
    '北京交通大学', '北京科技大学', '北京化工大学', '北京林业大学', '北京中医药大学',
    '北京外国语大学', '中国传媒大学', '中央音乐学院', '中国音乐学院', '中央美术学院',
    '中国美术学院', '上海财经大学', '上海外国语大学', '华东理工大学', '东华大学',
    '上海大学', '南京师范大学', '南京工业大学', '南京邮电大学', '南京信息工程大学',
    '浙江工业大学', '浙江师范大学', '宁波大学', '温州大学', '杭州电子科技大学',
    '西湖大学', '南方科技大学', '深圳大学', '广州大学', '暨南大学', '华南师范大学',
    '汕头大学', '广东工业大学', '华南农业大学', '香港大学', '香港中文大学', '香港科技大学',
    '香港理工大学', '香港城市大学', '澳门大学', '台湾大学', '清华大学深圳国际研究生院',
    '北京大学深圳研究生院', '中国科学院大学', '中国社会科学院大学', '北京协和医学院',
    '首都师范大学', '首都医科大学', '北京工业大学', '华北电力大学', '北京体育大学',
    '中国药科大学', '南京医科大学', '南京中医药大学', '扬州大学', '江苏大学', '南通大学',
    '常州大学', '浙江工商大学', '浙江理工大学', '中国计量大学', '安徽师范大学', '安徽工业大学',
    '安徽理工大学', '华侨大学', '福建师范大学', '福建农林大学', '山东师范大学', '青岛大学',
    '济南大学', '烟台大学', '曲阜师范大学', '河南大学', '河南师范大学', '河南理工大学',
    '武汉理工大学', '华中师范大学', '华中农业大学', '中南财经政法大学', '中国地质大学武汉',
    '湘潭大学', '长沙理工大学', '南华大学', '湖南师范大学', '桂林理工大学', '广西师范大学',
    '西南交通大学', '西南财经大学', '西南政法大学', '成都理工大学', '四川农业大学',
    '昆明理工大学', '云南师范大学', '贵州师范大学', '西北大学', '西安电子科技大学',
    '长安大学', '陕西师范大学', '西安理工大学', '兰州理工大学', '新疆师范大学', '石河子大学',
    '哈尔滨工程大学', '东北林业大学', '东北农业大学', '辽宁师范大学', '大连海事大学',
    '沈阳工业大学', '燕山大学', '河北工业大学', '河北大学', '山西大学', '太原理工大学',
    '中北大学', '内蒙古工业大学', '内蒙古农业大学', '大连大学', '沈阳建筑大学', '长春理工大学',
    '东北电力大学', '哈尔滨理工大学', '上海理工大学', '上海师范大学', '上海海事大学',
    '南京林业大学', '南京财经大学', '江苏师范大学', '中国矿业大学北京', '中国石油大学北京',
    '中国地质大学北京', '北京信息科技大学', '北京工商大学', '天津师范大学', '天津工业大学',
    '天津科技大学', '河北师范大学', '山西师范大学', '中北大学', '内蒙古师范大学',
    '大连交通大学', '沈阳师范大学', '吉林师范大学', '黑龙江大学', '哈尔滨师范大学',
    '上海海洋大学', '上海工程技术大学', '苏州科技大学', '常州工学院', '浙江海洋大学',
    '安徽工程大学', '安徽农业大学', '江西师范大学', '江西财经大学', '华东交通大学',
    '山东农业大学', '青岛科技大学', '聊城大学', '鲁东大学', '临沂大学', '河南农业大学',
    '河南科技大学', '信阳师范学院', '湖北大学', '湖北工业大学', '长江大学', '三峡大学',
    '湖南农业大学', '中南林业科技大学', '广东外语外贸大学', '广东财经大学', '五邑大学',
    '海南师范大学', '海南医学院', '重庆邮电大学', '重庆交通大学', '西南科技大学',
    '成都信息工程大学', '西华大学', '四川师范大学', '西南民族大学', '云南农业大学',
    '云南财经大学', '贵州大学', '遵义师范学院', '西藏民族大学', '西北师范大学',
    '西安工业大学', '西安建筑科技大学', '延安大学', '兰州交通大学', '甘肃农业大学',
    '青海师范大学', '宁夏医科大学', '塔里木大学', '新疆农业大学', '新疆医科大学',
    '字节跳动', '阿里巴巴', '腾讯', '百度', '京东', '美团', '华为', '小米', '网易',
    '拼多多', '滴滴', '快手', '哔哩哔哩', '蚂蚁集团', '携程', '贝壳', '小红书'
  ],

  toHalfWidth(text) {
    return String(text || '')
      .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/\u3000/g, ' ');
  },

  normalizeText(text) {
    let s = this.toHalfWidth(text);
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    s = s.replace(/[•·●▪◆◇]/g, '-');
    s = this.expandTableRows(s);
    s = s.replace(/[|｜]/g, ' | ');
    s = s.replace(/ +/g, ' ');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  },

  expandTableRows(text) {
    const lines = String(text).split('\n');
    const out = [];
    for (const line of lines) {
      if (line.includes('\t') && line.split('\t').filter((c) => c.trim()).length >= 2) {
        const cells = line.split('\t').map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          out.push(cells.join(' '));
          continue;
        }
      }
      out.push(line.replace(/\t+/g, ' '));
    }
    return out.join('\n');
  },

  normalizeDate(dateStr) {
    if (!dateStr) return '';
    let s = String(dateStr).trim().toLowerCase();
    if (/^(至今|present|now|现在)$/.test(s)) return '至今';
    s = s.replace(/[年月]/g, '/').replace(/\./g, '/').replace(/-/g, '/');
    s = s.replace(/\/+/g, '/').replace(/\/$/, '');
    const m = s.match(/^(\d{4})(?:\/(\d{1,2}))?(?:\/(\d{1,2}))?/);
    if (!m) return dateStr;
    const y = m[1];
    const mo = m[2] ? String(m[2]).padStart(2, '0') : '';
    return mo ? `${y}/${mo}` : y;
  },

  normalizeMajor(major) {
    if (!major) return '';
    let s = String(major).trim();
    s = s.replace(this.DATE_RANGE_RE, '');
    s = s.replace(this.MAJOR_NOISE_RE, '');
    s = s.replace(this.DEGREE_WORDS_RE, '');
    s = s.replace(/\s*(GPA|排名|绩点).*/i, '').trim();
    s = s.replace(/[，,;；].*$/, '').trim();
    return s;
  },

  flattenContactLines(contactBlocks) {
    const lines = [];
    for (const block of contactBlocks) {
      for (const line of String(block).split('\n')) {
        const t = line.trim();
        if (t) lines.push(t);
      }
    }
    return lines;
  },

  normalizeEducationEntry(entry) {
    if (!entry) return entry;
    if (entry.major) entry.major = this.normalizeMajor(entry.major);
    if (entry.startDate) entry.startDate = this.normalizeDate(entry.startDate);
    if (entry.endDate) entry.endDate = this.normalizeDate(entry.endDate);
    return entry;
  },

  normalizeExperienceEntry(entry) {
    if (!entry) return entry;
    if (entry.startDate) entry.startDate = this.normalizeDate(entry.startDate);
    if (entry.endDate) entry.endDate = this.normalizeDate(entry.endDate);
    return entry;
  },

  fuzzyKeywordScore(line, words) {
    const norm = line.replace(/\s+/g, '').toLowerCase();
    let best = 0;
    for (const w of words) {
      const kw = w.toLowerCase();
      if (norm === kw) return 1;
      if (norm.includes(kw) || kw.includes(norm)) best = Math.max(best, 0.85);
      const sim = JobTrackerTextUtils.partialRatio(norm, kw);
      best = Math.max(best, sim);
    }
    return best;
  },

  classifyLine(line, lineIndex, prevBlank) {
    const trimmed = line.trim();
    if (!trimmed) return { type: 'blank', text: '' };
    if (this.SECTION_TITLE_RE.test(trimmed)) return { type: 'section_header', text: trimmed };
    if (trimmed.endsWith('：') || trimmed.endsWith(':')) {
      const head = trimmed.slice(0, -1);
      if (this.fuzzyKeywordScore(head, this.SECTION_KEYWORDS.flatMap((s) => s.words)) >= 0.7) {
        return { type: 'section_header', text: trimmed };
      }
    }
    if (/^[A-Z\s]{4,}$/.test(trimmed) && trimmed.length < 40) return { type: 'section_header', text: trimmed };
    if (lineIndex < 5 && (this.PHONE_RE.test(trimmed) || this.EMAIL_RE.test(trimmed))) {
      return { type: 'contact', text: trimmed };
    }
    if (this.DATE_RANGE_RE.test(trimmed) || (this.DATE_LINE_RE.test(trimmed) && trimmed.length < 60)) {
      return { type: 'date_line', text: trimmed };
    }
    if (prevBlank && trimmed.length <= 20 && this.fuzzyKeywordScore(trimmed, this.SECTION_KEYWORDS.flatMap((s) => s.words)) >= 0.75) {
      return { type: 'section_header', text: trimmed };
    }
    return { type: 'body', text: trimmed };
  },

  buildLineModel(text) {
    const rawLines = this.normalizeText(text).split('\n');
    const lines = [];
    let prevBlank = true;
    for (let i = 0; i < rawLines.length; i++) {
      const cls = this.classifyLine(rawLines[i], i, prevBlank);
      lines.push({ ...cls, index: i, raw: rawLines[i] });
      prevBlank = cls.type === 'blank';
    }
    return lines;
  },

  detectSectionKey(headerText) {
    const h = headerText.replace(/[：:#\s]/g, '');
    let best = { key: 'other', score: 0 };
    for (const sec of this.SECTION_KEYWORDS) {
      const score = this.fuzzyKeywordScore(h, sec.words);
      if (score > best.score) best = { key: sec.key, score };
    }
    if (best.score < 0.65) return 'other';
    if (best.key === 'internship' || best.key === 'work' || best.key === 'project' ||
        best.key === 'research' || best.key === 'competition' || best.key === 'campus') {
      return 'experience';
    }
    if (best.key === 'education') return 'education';
    if (best.key === 'self') return 'self';
    return 'other';
  },

  splitSections(text) {
    const lines = this.buildLineModel(text);
    const sections = { contact: [], education: [], experience: [], self: [], other: [] };
    let current = 'contact';
    let sectionHint = '';
    let buf = [];

    const flush = () => {
      if (!buf.length) return;
      const block = buf.join('\n').trim();
      if (!block) return;
      if (current === 'experience') sections.experience.push({ block, hint: sectionHint });
      else sections[current].push(block);
      buf = [];
    };

    for (const line of lines) {
      if (line.type === 'blank') {
        flush();
        continue;
      }
      if (line.type === 'section_header') {
        flush();
        const sec = this.detectSectionKey(line.text);
        sectionHint = line.text;
        if (sec === 'education') current = 'education';
        else if (sec === 'experience') current = 'experience';
        else if (sec === 'self') current = 'self';
        else if (sec === 'other' && current === 'contact') current = 'other';
        continue;
      }
      if (current === 'contact' && line.index > 12) {
        flush();
        current = 'other';
      }
      buf.push(line.text);
    }
    flush();

    if (!sections.education.length && !sections.experience.length) {
      this.inferSectionsFromDates(text, sections);
    }

    return sections;
  },

  inferSectionsFromDates(text, sections) {
    const blocks = this.splitSectionBlocks(text);
    for (const block of blocks) {
      const blob = block;
      const degree = this.detectEduType(blob);
      const expCat = this.scoreExpCategory(blob, '');
      if (degree && this.matchUniversity(blob).name) {
        sections.education.push(block);
      } else if (expCat.score >= 0.35 || /公司|集团|科技|实习|岗位/.test(blob)) {
        sections.experience.push({ block, hint: '' });
      }
    }
  },

  splitSectionBlocks(text) {
    const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
    const blocks = [];
    let buf = [];
    const newEntryRe = /^[\u4e00-\u9fa5A-Za-z0-9（）()]+(?:公司|集团|科技|跳动|腾讯|阿里|华为|美团|京东|银行|助手)/;
    for (const line of lines) {
      const isBoundary =
        buf.length > 0 &&
        (this.DATE_RANGE_RE.test(line) ||
          (this.DATE_LINE_RE.test(line) && line.length < 80) ||
          (newEntryRe.test(line) && this.DATE_RANGE_RE.test(buf[buf.length - 1] || '')));
      if (isBoundary && newEntryRe.test(line)) {
        blocks.push(buf.join('\n'));
        buf = [line];
      } else if (isBoundary && this.DATE_RANGE_RE.test(line) && !newEntryRe.test(line)) {
        if (buf.length) blocks.push(buf.join('\n'));
        buf = [line];
      } else {
        buf.push(line);
      }
    }
    if (buf.length) blocks.push(buf.join('\n'));
    return blocks.length > 1 ? blocks : [String(text).trim()];
  },

  splitBlocksByDate(text) {
    const lines = this.normalizeText(text).split('\n').map((l) => l.trim()).filter(Boolean);
    const blocks = [];
    let buf = [];
    for (const line of lines) {
      const isDateStart = this.DATE_RANGE_RE.test(line) || (this.DATE_LINE_RE.test(line) && line.length < 80);
      if (isDateStart && buf.length) {
        blocks.push(buf);
        buf = [line];
      } else {
        buf.push(line);
      }
    }
    if (buf.length) blocks.push(buf);
    return blocks.length ? blocks : [lines];
  },

  validateCnMobile(phone) {
    const m = String(phone || '').match(/^(1[3-9]\d{9})$/);
    if (!m) return false;
    const n = m[1];
    if (/^1(70|71|72|73|74|75|76|77|78|79)\d{8}$/.test(n)) return false;
    return true;
  },

  extractPhone(text, headText = '') {
    const priority = headText || text.slice(0, 300);
    const tryExtract = (blob, conf) => {
      const matches = [...String(blob).matchAll(new RegExp(this.PHONE_RE.source, 'g'))];
      for (const m of matches) {
        const p = m[1] || m[0].replace(/\D/g, '').slice(-11);
        if (this.validateCnMobile(p)) return { value: p, confidence: conf, source: 'regex' };
      }
      return null;
    };
    const headHit = tryExtract(priority, 0.95);
    if (headHit) return headHit;
    const fullHit = tryExtract(text, 0.88);
    if (fullHit) return fullHit;
    return { value: '', confidence: 0, source: 'none' };
  },

  extractEmail(text, headText = '') {
    const priority = headText || text.slice(0, 300);
    const tryExtract = (blob, conf) => {
      const m = String(blob).match(this.EMAIL_RE);
      if (!m) return null;
      return { value: m[0].toLowerCase(), confidence: conf, source: 'regex' };
    };
    const headHit = tryExtract(priority, 0.96);
    if (headHit) return headHit;
    const fullHit = tryExtract(text, 0.9);
    if (fullHit) return fullHit;
    return { value: '', confidence: 0, source: 'none' };
  },

  extractName(lines, contactText) {
    const excludeRe = /教育|学历|实习|工作|项目|简历|电话|手机|邮箱|地址|性别/;
    for (const line of lines.slice(0, 5)) {
      const t = line.trim();
      if (!t || this.PHONE_RE.test(t) || this.EMAIL_RE.test(t)) continue;
      const cjk = t.match(/^[\u4e00-\u9fa5]{2,4}$/);
      if (cjk && !excludeRe.test(t)) {
        return { value: cjk[0], confidence: 0.75, source: 'first_line_heuristic' };
      }
      const pipeParts = t.split(/[|｜/\\·]/).map((s) => s.trim()).filter(Boolean);
      for (const p of pipeParts) {
        if (/^[\u4e00-\u9fa5]{2,4}$/.test(p) && !excludeRe.test(p)) {
          return { value: p, confidence: 0.7, source: 'delimiter_split' };
        }
      }
    }
    const nameLabel = contactText.match(/(?:姓名|名字)[：:\s]*([\u4e00-\u9fa5]{2,4})/);
    if (nameLabel) return { value: nameLabel[1], confidence: 0.88, source: 'label' };
    return { value: '', confidence: 0, source: 'none' };
  },

  parseDateRange(text) {
    const m = String(text).match(this.DATE_RANGE_RE);
    if (!m) return { startDate: '', endDate: '' };
    return { startDate: this.normalizeDate(m[1]), endDate: this.normalizeDate(m[2]) };
  },

  parseNowcoderEducationLine(line) {
    const m = line.match(
      /^(?:(博士|硕士|本科|专科|大专)\s+)?([\u4e00-\u9fa5A-Za-z（）()]+(?:大学|学院|学校))\s+([\u4e00-\u9fa5A-Za-z0-9+（）()\-]+?)\s+(\d{4}[./年\-]\d{1,2}(?:[./月\-]\d{1,2})?\s*[-–—~至到]\s*(?:\d{4}[./年\-]\d{1,2}(?:[./月\-]\d{1,2})?|至今|present))/i
    );
    if (!m) return null;
    const degreeInfo = this.detectEduType(m[1] || line) || this.detectEduType(line);
    return {
      degree: degreeInfo?.label || '',
      type: degreeInfo?.label || '',
      school: m[2],
      major: this.normalizeMajor(m[3]),
      startDate: this.normalizeDate(m[4].split(/[-–—~至到]/)[0]),
      endDate: this.normalizeDate(m[4].split(/[-–—~至到]/)[1])
    };
  },

  parseMokaEducationLine(line) {
    const parts = line.split(/\s{2,}|\t|\|/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    const datePart = parts.find((p) => this.DATE_RANGE_RE.test(p));
    const degreePart = parts.find((p) => this.detectEduType(p));
    const schoolPart = parts.find((p) => /大学|学院|学校/.test(p));
    if (!schoolPart) return null;
    const majorPart = parts.find((p) => p !== schoolPart && p !== degreePart && p !== datePart && p.length >= 2 && !this.DATE_RANGE_RE.test(p));
    const dates = datePart ? this.parseDateRange(datePart) : { startDate: '', endDate: '' };
    const degreeInfo = degreePart ? this.detectEduType(degreePart) : this.detectEduType(line);
    return {
      degree: degreeInfo?.label || '',
      type: degreeInfo?.label || '',
      school: schoolPart,
      major: this.normalizeMajor(majorPart || ''),
      startDate: dates.startDate,
      endDate: dates.endDate
    };
  },

  detectEduType(text) {
    for (const p of this.DEGREE_PATTERNS) {
      if (p.re.test(text)) return { label: p.label, full: p.full, rank: this.DEGREE_RANK[p.label] || this.DEGREE_RANK[p.full] || 0 };
    }
    return null;
  },

  matchUniversity(text) {
    const blob = String(text);
    let best = { name: '', score: 0 };
    for (const u of this.UNIVERSITIES) {
      if (blob.includes(u)) {
        const score = 0.95;
        if (score > best.score) best = { name: u, score, source: 'exact' };
        continue;
      }
      const sim = JobTrackerTextUtils.partialRatio(blob, u);
      if (sim >= 0.82 && sim > best.score) best = { name: u, score: sim * 0.9, source: 'fuzzy' };
    }
    const schoolM = blob.match(/([\u4e00-\u9fa5A-Za-z（）()]+(?:大学|学院|学校|科技大学|师范大学|理工大学|工业大学|医科大学|美术学院|音乐学院))/);
    if (schoolM && schoolM[1].length >= 4) {
      const sim = JobTrackerTextUtils.similarity(schoolM[1], best.name);
      if (!best.name || sim < 0.6) {
        return { name: schoolM[1], score: 0.72, source: 'pattern' };
      }
    }
    return best.name ? best : { name: '', score: 0, source: 'none' };
  },

  splitEducationBlocks(blocks) {
    const out = [];
    const degreeStart = /^(博士|硕士|本科|专科|研究生|学士|大专)/;
    for (const block of blocks) {
      const lines = String(block).split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        out.push(block);
        continue;
      }
      let buf = [];
      for (const line of lines) {
        if (degreeStart.test(line) && buf.length) {
          out.push(buf.join('\n'));
          buf = [line];
        } else {
          buf.push(line);
        }
      }
      if (buf.length) out.push(buf.join('\n'));
    }
    return out.length ? out : blocks;
  },

  parseEducationBlock(block) {
    const lines = String(block).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const joined = lines.join(' ');
    const entry = {
      degree: '',
      type: '',
      school: '',
      college: '',
      major: '',
      gpa: '',
      ranking: '',
      startDate: '',
      endDate: '',
      cet4: '',
      cet6: '',
      trainingMode: '',
      _confidence: {}
    };

    const degreeInfo = this.detectEduType(joined);
    if (degreeInfo) {
      entry.degree = degreeInfo.label;
      entry.type = degreeInfo.label;
      entry._confidence.degree = { value: degreeInfo.label, confidence: 0.85, source: 'keyword_rank' };
    }

    const schoolHit = this.matchUniversity(joined);
    if (schoolHit.name) {
      entry.school = schoolHit.name;
      entry._confidence.school = { value: schoolHit.name, confidence: schoolHit.score, source: schoolHit.source };
    }

    const templateHit = this.parseNowcoderEducationLine(joined) || this.parseMokaEducationLine(joined);
    if (templateHit) {
      Object.assign(entry, templateHit);
      entry._confidence.school = { value: entry.school, confidence: 0.88, source: 'template' };
      if (entry.major) entry._confidence.major = { value: entry.major, confidence: 0.85, source: 'template' };
    }

    const majorM = joined.match(/(?:专业[：:\s]+|专业\s+)([\u4e00-\u9fa5A-Za-z0-9+（）()\-]+?)(?:\s+GPA|\s+\d{4}|$|，|,)/i);
    if (majorM && !entry.major) {
      entry.major = this.normalizeMajor(majorM[1].trim());
      entry._confidence.major = { value: entry.major, confidence: 0.8, source: 'label_pattern' };
    } else if (degreeInfo && schoolHit.name && !entry.major) {
      let between = joined;
      between = between.replace(degreeInfo.full, '').replace(degreeInfo.label, '');
      between = between
        .replace(schoolHit.name, '')
        .replace(this.DATE_RANGE_RE, '')
        .replace(/GPA[：:\s]*[\d./]+/gi, '')
        .trim();
      const tokens = between.split(/\s+/).filter((t) => {
        if (t.length < 2) return false;
        if (/GPA|排名|绩点/i.test(t)) return false;
        if (this.detectEduType(t)) return false;
        if (/^(硕士|本科|博士|专科|大专|学士|研究生|全日制)$/i.test(t)) return false;
        return true;
      });
      if (tokens.length) {
        entry.major = this.normalizeMajor(tokens.slice(0, 2).join(' '));
        entry._confidence.major = { value: entry.major, confidence: 0.6, source: 'between_school_degree' };
      }
    }
    if (entry.major) entry.major = this.normalizeMajor(entry.major);

    const collegeM = joined.match(/(?:学院|院系)[：:\s]*([\u4e00-\u9fa5A-Za-z（）()]+)/);
    if (collegeM) entry.college = collegeM[1].trim();

    const gpaM = joined.match(/GPA[：:\s]*([\d.]+(?:\/[\d.]+)?)/i);
    if (gpaM) {
      entry.gpa = gpaM[1];
      entry._confidence.gpa = { value: entry.gpa, confidence: 0.9, source: 'pattern' };
    }

    const rankM = joined.match(/(?:排名|专业排名)[：:\s]*([^\s，,;；]+)/);
    if (rankM) entry.ranking = rankM[1];

    const cet4M = joined.match(/(?:CET-?4|四级|英语四级)[：:\s]*(\d+)/i);
    if (cet4M) entry.cet4 = cet4M[1];
    const cet6M = joined.match(/(?:CET-?6|六级|英语六级)[：:\s]*(\d+)/i);
    if (cet6M) entry.cet6 = cet6M[1];

    const dates = this.parseDateRange(joined);
    entry.startDate = dates.startDate;
    entry.endDate = dates.endDate;
    if (dates.startDate) entry._confidence.startDate = { value: dates.startDate, confidence: 0.88, source: 'date_range' };

    return Object.values({ ...entry, _confidence: undefined }).some((v) => v) ? entry : null;
  },

  scoreExpCategory(text, sectionHint = '') {
    const blob = `${sectionHint} ${text}`.toLowerCase();
    const weights = {
      internship: [/实习/g, /intern/g],
      work: [/工作/g, /全职/g, /正式/g, /employ/g],
      project: [/项目/g, /project/g],
      research: [/科研/g, /研究/g, /实验室/g, /research/g],
      competition: [/竞赛/g, /比赛/g, /contest/g],
      campus: [/校园/g, /社团/g, /学生会/g, /campus/g]
    };
    let best = { category: 'internship', score: 0 };
    for (const [cat, patterns] of Object.entries(weights)) {
      let score = 0;
      for (const p of patterns) {
        const hits = (blob.match(p) || []).length;
        score += hits * 0.35;
      }
      if (score > best.score) best = { category: cat, score };
    }
    if (best.score < 0.2) best = { category: 'internship', score: 0.15 };
    return best;
  },

  splitOrgRole(line) {
    const cleaned = line.replace(this.DATE_RANGE_RE, '').trim();
    const roleM = cleaned.match(/(?:岗位|职位|角色|担任)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()\-/]+)/);
    if (roleM) return { organization: '', role: roleM[1].trim(), rest: cleaned };

    const parts = cleaned.split(/\s*[·\-@|｜/\\]\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { organization: parts[0], role: parts[1], rest: cleaned };
    }

    const atM = cleaned.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (atM) return { organization: atM[2].trim(), role: atM[1].trim(), rest: cleaned };

    const orgM = cleaned.match(
      /([\u4e00-\u9fa5A-Za-z0-9（）()]+(?:公司|集团|科技|研究院|实验室|大学|协会|基金会|银行|证券|事务所|字节跳动|阿里巴巴|腾讯|百度|京东|美团|华为))/
    );
    if (orgM) {
      const org = orgM[1];
      const role = cleaned.replace(org, '').replace(/[·\-@|｜/\\]/g, ' ').trim();
      return { organization: org, role: role.slice(0, 40), rest: cleaned };
    }

    return { organization: cleaned.slice(0, 40), role: '', rest: cleaned };
  },

  splitExperienceBlocks(items) {
    const out = [];
    for (const item of items) {
      const text = typeof item === 'string' ? item : item.block;
      const hint = typeof item === 'object' ? item.hint || '' : '';
      const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        out.push({ block: text, hint });
        continue;
      }
      let buf = [];
      for (const line of lines) {
        const hasDate = this.DATE_RANGE_RE.test(line);
        if (hasDate && buf.length) {
          out.push({ block: buf.join('\n'), hint });
          buf = [line];
        } else {
          buf.push(line);
        }
      }
      if (buf.length) out.push({ block: buf.join('\n'), hint });
    }
    return out;
  },

  parseExperienceBlock(block, sectionHint = '') {
    const lines = String(block).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;

    const joined = lines.join(' ');
    const catScore = this.scoreExpCategory(joined, sectionHint);
    const entry = {
      category: catScore.category,
      organization: '',
      role: '',
      startDate: '',
      endDate: '',
      description: '',
      _confidence: { category: { value: catScore.category, confidence: Math.min(0.95, catScore.score + 0.4), source: 'keyword_weight' } }
    };

    const dates = this.parseDateRange(joined);
    entry.startDate = dates.startDate;
    entry.endDate = dates.endDate;

    const firstLine = lines.find((l) => !/^[-*]/.test(l)) || lines[0];
    const { organization, role } = this.splitOrgRole(firstLine);
    entry.organization = organization;
    entry.role = role;
    if (organization) entry._confidence.organization = { value: organization, confidence: 0.75, source: 'split_heuristic' };
    if (role) entry._confidence.role = { value: role, confidence: 0.7, source: 'split_heuristic' };

    const descLines = lines.filter((l) => l !== firstLine && !this.DATE_RANGE_RE.test(l) && !/^(岗位|职位)/.test(l));
    if (descLines.length) entry.description = descLines.join('\n');

    return entry.organization || entry.role || entry.description ? entry : null;
  },

  parseSelfIntro(text, sections) {
    if (sections.self?.length) return sections.self.join('\n').trim().slice(0, 2000);
    const m = text.match(/(?:自我评价|个人评价|个人简介)[：:\s]*([\s\S]+?)(?:\n\s*\n|$)/);
    return m ? m[1].trim().slice(0, 2000) : '';
  },

  dedupeEducation(list) {
    const out = [];
    for (const e of list) {
      const dup = out.find((x) => {
        if (e.school && x.school) {
          return JobTrackerTextUtils.similarity(e.school, x.school) >= 0.85 && e.degree === x.degree;
        }
        return false;
      });
      if (dup) {
        for (const [k, v] of Object.entries(e)) {
          if (v && !dup[k]) dup[k] = v;
        }
      } else out.push(e);
    }
    return out;
  },

  sortEducation(list) {
    return [...list].sort((a, b) => {
      const ra = this.DEGREE_RANK[a.degree] || this.DEGREE_RANK[a.type] || 0;
      const rb = this.DEGREE_RANK[b.degree] || this.DEGREE_RANK[b.type] || 0;
      if (ra !== rb) return rb - ra;
      const ea = parseInt((a.endDate || a.startDate || '0').replace(/\D/g, '').slice(0, 4), 10) || 0;
      const eb = parseInt((b.endDate || b.startDate || '0').replace(/\D/g, '').slice(0, 4), 10) || 0;
      return eb - ea;
    });
  },

  stripMeta(entry) {
    const { _confidence, ...rest } = entry;
    return rest;
  },

  buildStats(profile, metaEntries) {
    const edu = profile.education || [];
    const exp = profile.experience || [];
    const byCat = {};
    for (const x of exp) {
      const c = x.category || 'other';
      byCat[c] = (byCat[c] || 0) + 1;
    }
    return {
      educationCount: edu.length,
      experienceCount: exp.length,
      experienceByCategory: byCat,
      contactFound: !!(profile.personalInfo?.phone || profile.personalInfo?.email || profile.personalInfo?.name),
      avgConfidence: metaEntries.length
        ? metaEntries.reduce((s, m) => s + m.confidence, 0) / metaEntries.length
        : 0
    };
  },

  parse(text) {
    const normalized = this.normalizeText(text);
    const sections = this.splitSections(normalized);
    const lineModel = this.buildLineModel(normalized);
    const contactLines = sections.contact;
    const contactText = contactLines.join('\n');
    const headLines = normalized.split('\n').slice(0, 5).join('\n');
    const allContactText = normalized.slice(0, 800);

    const warnings = [];
    const metaEntries = [];

    const phone = this.extractPhone(allContactText, headLines);
    const email = this.extractEmail(allContactText, headLines);
    const flatContact = this.flattenContactLines(contactLines);
    const nameLines = flatContact.length
      ? flatContact
      : lineModel.filter((l) => l.type !== 'blank' && l.index < 5).map((l) => l.text);
    const name = this.extractName(nameLines, contactText);

    if (phone.value) metaEntries.push(phone);
    if (email.value) metaEntries.push(email);
    if (name.value) metaEntries.push(name);

    const profile = {
      personalInfo: {
        name: name.value,
        phone: phone.value,
        email: email.value
      },
      education: [],
      experience: [],
      special: { selfIntroduction: '' }
    };

    const eduBlocks = this.splitEducationBlocks(
      sections.education.length
        ? sections.education
        : this.splitBlocksByDate(normalized).map((b) => b.join('\n'))
    );

    for (const block of eduBlocks) {
      const degreeHint = this.detectEduType(block);
      const schoolHint = this.matchUniversity(block);
      if (!degreeHint && !schoolHint.name && !this.DATE_RANGE_RE.test(block)) continue;
      const e = this.parseEducationBlock(block);
      if (e) profile.education.push(this.stripMeta(this.normalizeEducationEntry(e)));
    }

    for (const { block, hint } of sections.experience) {
      const chunks = this.splitSectionBlocks(block);
      const blocks = chunks.length > 1 ? chunks : [block];
      for (const chunk of blocks) {
        const x = this.parseExperienceBlock(chunk, hint);
        if (x) profile.experience.push(this.stripMeta(this.normalizeExperienceEntry(x)));
      }
    }

    profile.education = this.sortEducation(this.dedupeEducation(profile.education));
    profile.special.selfIntroduction = this.parseSelfIntro(normalized, sections);

    if (!profile.education.length && !profile.experience.length && !profile.personalInfo.phone) {
      warnings.push('未能识别结构化段落，请检查是否包含教育/实习标题或日期行');
    }

    const stats = this.buildStats(profile, metaEntries);

    return { profile, warnings, stats };
  },

  parseText(text) {
    const result = this.parse(text);
    return {
      personalInfo: result.profile.personalInfo || {},
      education: result.profile.education || [],
      experience: result.profile.experience || [],
      special: result.profile.special || { selfIntroduction: '' }
    };
  },

  parseForPreview(text) {
    const result = this.parse(text);
    const rawSections = this.splitSections(this.normalizeText(text));
    const eduWithConf = [];
    const eduBlocks = this.splitEducationBlocks(
      rawSections.education.length
        ? rawSections.education
        : this.splitBlocksByDate(this.normalizeText(text)).map((b) => b.join('\n'))
    );
    for (const block of eduBlocks) {
      const degreeHint = this.detectEduType(block);
      const schoolHint = this.matchUniversity(block);
      if (!degreeHint && !schoolHint.name && !this.DATE_RANGE_RE.test(block)) continue;
      const e = this.parseEducationBlock(block);
      if (e) {
        const conf = e._confidence || {};
        const scores = Object.values(conf).map((c) => c.confidence || 0);
        eduWithConf.push({
          ...this.normalizeEducationEntry(this.stripMeta(e)),
          _avgConfidence: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5
        });
      }
    }
    const expWithConf = [];
    for (const { block, hint } of rawSections.experience) {
      const chunks = this.splitSectionBlocks(block);
      const blocks = chunks.length > 1 ? chunks : [block];
      for (const chunk of blocks) {
        const x = this.parseExperienceBlock(chunk, hint);
        if (x) {
          const conf = x._confidence || {};
          const scores = Object.values(conf).map((c) => c.confidence || 0);
          expWithConf.push({
            ...this.normalizeExperienceEntry(this.stripMeta(x)),
            _avgConfidence: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5
          });
        }
      }
    }
    return {
      ...result,
      preview: {
        personalInfo: result.profile.personalInfo,
        education: eduWithConf,
        experience: expWithConf
      }
    };
  },

  buildMergeDiff(current, parsed) {
    const cur = current || JobTrackerResumeStorage.defaultProfile();
    const diff = { personalInfo: [], education: [], experience: [], selfIntro: false };
    const pi = parsed.personalInfo || {};
    for (const [k, v] of Object.entries(pi)) {
      if (v && (!cur.personalInfo?.[k] || !String(cur.personalInfo[k]).trim())) {
        diff.personalInfo.push(k);
      }
    }
    for (const e of parsed.education || []) {
      const dup = (cur.education || []).find(
        (x) => e.school && x.school && JobTrackerTextUtils.similarity(e.school, x.school) >= 0.85
      );
      if (!dup) diff.education.push(e);
    }
    for (const e of parsed.experience || []) {
      const dup = (cur.experience || []).find(
        (x) => e.organization && x.organization &&
          JobTrackerTextUtils.similarity(e.organization, x.organization) >= 0.85
      );
      if (!dup) diff.experience.push(e);
    }
    if (parsed.special?.selfIntroduction && !cur.special?.selfIntroduction) diff.selfIntro = true;
    return diff;
  },

  formatMergeSummary(diff) {
    const parts = [];
    if (diff.personalInfo.length) parts.push(`${diff.personalInfo.length} 项基本信息`);
    if (diff.education.length) parts.push(`${diff.education.length} 段教育`);
    if (diff.experience.length) {
      const byCat = {};
      for (const e of diff.experience) {
        const c = JobTrackerResumeStorage.CATEGORY_LABELS[e.category] || '经历';
        byCat[c] = (byCat[c] || 0) + 1;
      }
      parts.push(Object.entries(byCat).map(([c, n]) => `${n} 段${c}`).join('、'));
    }
    if (diff.selfIntro) parts.push('自我评价');
    return parts.length ? `将添加 ${parts.join('、')}` : '没有新内容可合并（已有相同条目）';
  },

  mergeProfile(current, parsed, { overwrite = false } = {}) {
    const result = JSON.parse(JSON.stringify(current || JobTrackerResumeStorage.defaultProfile()));

    const mergeScalar = (section, key) => {
      const v = parsed?.[section]?.[key];
      if (!v) return;
      if (overwrite || !result[section][key]) result[section][key] = v;
    };

    if (parsed.personalInfo) {
      for (const k of Object.keys(parsed.personalInfo)) mergeScalar('personalInfo', k);
    }

    if (parsed.special?.selfIntroduction) {
      if (overwrite || !result.special.selfIntroduction) result.special.selfIntroduction = parsed.special.selfIntroduction;
    }

    const mergeEntries = (field, defaultFn) => {
      const list = parsed[field];
      if (!Array.isArray(list) || !list.length) return;
      if (overwrite) {
        result[field] = list.map((e) => ({ ...defaultFn(), ...e }));
        return;
      }
      if (!result[field]?.length) {
        result[field] = list.map((e) => ({ ...defaultFn(), ...e }));
        return;
      }
      for (const entry of list) {
        const dupIdx = result[field].findIndex((x) => {
          if (field === 'education') {
            return entry.school && x.school && JobTrackerTextUtils.similarity(entry.school, x.school) >= 0.85;
          }
          return entry.organization && x.organization &&
            JobTrackerTextUtils.similarity(entry.organization, x.organization) >= 0.85;
        });
        if (dupIdx >= 0) {
          const target = result[field][dupIdx];
          for (const [k, v] of Object.entries(entry)) {
            if (v && !target[k]) target[k] = v;
          }
        } else {
          result[field].push({ ...defaultFn(), ...entry });
        }
      }
    };

    mergeEntries('education', () => JobTrackerResumeStorage.defaultEducationEntry());
    mergeEntries('experience', () => JobTrackerResumeStorage.defaultExperienceEntry());

    return JobTrackerResumeStorage.normalizeProfile(result);
  },

  previewSummary(result) {
    const { profile, stats } = result.profile ? { profile: result.profile, stats: result.stats || {} } : { profile: result, stats: {} };
    const parts = [];
    if (profile.personalInfo?.name) parts.push(`姓名「${profile.personalInfo.name}」`);
    if (profile.personalInfo?.phone) parts.push('手机');
    if (profile.personalInfo?.email) parts.push('邮箱');
    if (stats.educationCount || profile.education?.length) {
      parts.push(`${stats.educationCount || profile.education.length} 段教育`);
    }
    const expN = stats.experienceCount || profile.experience?.length || 0;
    if (expN) {
      const cats = stats.experienceByCategory || {};
      const catParts = Object.entries(cats).map(([c, n]) => {
        const label = JobTrackerResumeStorage.CATEGORY_LABELS[c] || c;
        return `${n} 段${label}`;
      });
      parts.push(catParts.length ? catParts.join('、') : `${expN} 段经历`);
    }
    const conf = stats.avgConfidence;
    const confHint = conf > 0 ? `（平均置信 ${Math.round(conf * 100)}%）` : '';
    return parts.length ? `识别到 ${parts.join('、')}${confHint}` : '未能识别到有效字段';
  }
};
