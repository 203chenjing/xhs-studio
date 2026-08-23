/** 从 DOM 推断字段所属区块（教育/实习/项目等）与块序号 */
const JobTrackerFormSection = {
  NUMBERED_SECTION_RE: /(教育经历|Education Experience|工作\/实习经历|Work Experience|Work\/Internship Experience|工作经历|项目经历|Project Experience|语言技能|Language Skills|语言能力|外语能力|校园经历|Campus Experience|技能证书|获奖经历|Awards|家庭成员|家庭关系|Family)-(\d+)/,

  SECTION_HINTS: [
    { re: /教育背景|教育经历|Education Experience/i, section: 'education', category: null },
    { re: /工作\/实习经历|Work Experience|Work\/Internship/i, section: 'experience', category: 'internship' },
    { re: /工作经历/i, section: 'experience', category: 'work' },
    { re: /实习经历|实习/i, section: 'experience', category: 'internship' },
    { re: /项目经历|Project Experience/i, section: 'experience', category: 'project' },
    { re: /校园经历|在校职务|在校/i, section: 'campus', category: 'campus' },
    { re: /语言技能|语言能力|外语能力|外语/i, section: 'languages', category: null },
    { re: /获奖经历|获奖|award/i, section: 'awards', category: null },
    { re: /技能证书|资格证书|专业证书|证书信息/i, section: 'certificates', category: null },
    { re: /证书/i, section: 'certificates', category: null },
    { re: /家庭成员|家庭关系|家属/i, section: 'family', category: null },
    { re: /应聘意向|求职意向|投递意向/i, section: 'jobIntent', category: null },
    { re: /基本信息|校招简历|个人信息/i, section: 'personal', category: null },
    { re: /补充信息/i, section: 'personal', category: null }
  ],

  ANCHOR_LABEL_RES: {
    education: /毕业学校|学校名称|学校|院校|university|college|school/i,
    experience: /公司\/单位|单位名称|公司|单位|employer|organization|company/i,
    awards: /奖励名称|获奖名称|奖项|award/i,
    family: /家庭成员|家属姓名|姓名|name/i,
    campus: /职务名称|在校职务|title/i,
    languages: /语种|语言|language/i,
    certificates: /证书名称|certificate/i,
    computerSkills: /技能名称|技能类型/i
  },

  matchNumberedSection(text) {
    const t = String(text || '').replace(/\s+/g, '');
    const m = t.match(this.NUMBERED_SECTION_RE);
    if (!m) return null;
    return { sectionTitle: `${m[1]}-${m[2]}`, blockIndex: parseInt(m[2], 10) - 1, blockKey: m[1] };
  },

  parseNumberedSection(el) {
    let node = el;
    for (let depth = 0; node && depth < 18; depth++) {
      const heads = node.querySelectorAll?.(
        'h1,h2,h3,h4,h5,legend,.title,[class*="title"],[class*="head"],[class*="sub-title"],.el-card__header,strong,b,span,div,p'
      );
      if (heads?.length) {
        for (const h of heads) {
          const raw = (h.textContent || '').trim();
          if (raw.length > 28) continue;
          const hit = this.matchNumberedSection(raw);
          if (hit) return hit;
        }
      }
      const snippet = (node.textContent || '').replace(/\s+/g, '').slice(0, 80);
      const m2 = this.matchNumberedSection(snippet);
      if (m2 && node.querySelector?.('input, select, textarea, .el-select, .el-date-editor, .ant-select, .ant-picker')) {
        return m2;
      }
      node = node.parentElement;
    }
    return null;
  },

  detectDateRangeIndex(el) {
    if (!el?.closest || typeof JobTrackerFillEngine === 'undefined') return 0;
    const widget = JobTrackerFillEngine.detectWidget(el);
    const root = widget.root || el;
    const scopes = [
      el.closest('tr'),
      el.closest('.el-form-item, .ant-form-item, .form-group'),
      el.closest('.el-row, .ant-row'),
      el.parentElement?.parentElement
    ].filter(Boolean);
    for (const scope of scopes) {
      const pickers = [...scope.querySelectorAll('.el-date-editor, .ant-picker, input[type="date"]')].filter(
        (n) => n.offsetParent !== null || n.getBoundingClientRect().width > 0
      );
      if (pickers.length < 2) continue;
      for (let i = 0; i < pickers.length; i++) {
        if (pickers[i] === root || pickers[i].contains(el) || pickers[i].contains(root)) return i;
      }
    }
    return 0;
  },

  detect(el) {
    if (!el?.closest) {
      return { section: null, category: null, blockIndex: 0, sectionTitle: '', dateRangeIndex: 0, blockAnchorName: '' };
    }

    const numbered = this.parseNumberedSection(el);
    if (numbered) {
      let section = null;
      let category = null;
      for (const hint of this.SECTION_HINTS) {
        if (hint.re.test(numbered.blockKey)) {
          section = hint.section;
          category = hint.category;
          break;
        }
      }
      if (numbered.blockKey.includes('工作')) {
        section = 'experience';
        category = numbered.blockKey.includes('实习') ? 'internship' : category || 'work';
      }
      return {
        section: section || 'education',
        category,
        blockIndex: numbered.blockIndex,
        sectionTitle: numbered.sectionTitle,
        dateRangeIndex: this.detectDateRangeIndex(el),
        blockAnchorName: this.extractBlockAnchorName(el, section || 'education')
      };
    }

    let node = el.parentElement;
    let sectionTitle = '';
    let section = null;
    let category = null;

    for (let depth = 0; node && depth < 14; depth++) {
      const text = this.collectHeadingText(node);
      if (text.length >= 2 && text.length < 40) {
        for (const hint of this.SECTION_HINTS) {
          if (hint.re.test(text)) {
            sectionTitle = text;
            section = hint.section;
            category = hint.category;
            break;
          }
        }
      }
      if (section) break;
      node = node.parentElement;
    }

    const blockIndex = this.detectBlockIndex(el, section);
    return {
      section,
      category,
      blockIndex,
      sectionTitle,
      dateRangeIndex: this.detectDateRangeIndex(el),
      blockAnchorName: section ? this.extractBlockAnchorName(el, section) : ''
    };
  },

  collectHeadingText(node) {
    if (!node) return '';
    const direct =
      node.querySelector?.(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > .title, :scope > [class*="title"]')
        ?.textContent?.trim() || '';
    if (direct && direct.length < 30) return direct.replace(/\s+/g, '');
    const cls = String(node.className || '');
    if (/section|block|group|module|panel|card|form-item-wrap/i.test(cls)) {
      const head = node.querySelector('[class*="title"], [class*="head"], legend, strong');
      const t = head?.textContent?.trim() || '';
      if (t.length >= 2 && t.length < 24) return t.replace(/\s+/g, '');
    }
    return '';
  },

  detectBlockIndex(el, section) {
    if (!section || !el?.closest) return 0;
    const container = this.findRepeatContainer(el, section);
    if (!container) return 0;
    const blocks = this.findBlocks(container, section);
    const block = this.findOwnBlock(el, blocks);
    const idx = blocks.indexOf(block);
    return idx >= 0 ? idx : 0;
  },

  findRepeatContainer(el, section) {
    let node = el.parentElement;
    for (let i = 0; i < 12 && node; i++) {
      const blocks = this.findBlocks(node, section);
      if (blocks.length >= 2) return node;
      const text = (node.textContent || '').slice(0, 200);
      if (this.SECTION_HINTS.some((h) => h.section === section && h.re.test(text)) && blocks.length >= 1) {
        return node.parentElement || node;
      }
      node = node.parentElement;
    }
    return el.closest('form') || document.body;
  },

  findBlocks(container, section) {
    const selectors = [
      '[class*="repeat"]',
      '[class*="block"]',
      '[class*="item-wrap"]',
      '[class*="form-group"]',
      '[class*="experience"]',
      '[class*="education"]',
      'fieldset',
      '.ant-row',
      '.el-row'
    ];
    let candidates = [];
    for (const sel of selectors) {
      try {
        candidates = [...container.querySelectorAll(`:scope > ${sel}, :scope > div > ${sel}`)];
      } catch (_) {
        candidates = [...container.querySelectorAll(sel)];
      }
      if (candidates.length >= 2) break;
    }
    if (candidates.length < 2) {
      candidates = [...container.children].filter((c) => {
        const inputs = c.querySelectorAll?.('input, select, textarea');
        return inputs && inputs.length >= 3;
      });
    }
    return candidates.filter((b) => b.querySelector('input, select, textarea'));
  },

  findOwnBlock(el, blocks) {
    for (const b of blocks) {
      if (b.contains(el)) return b;
    }
    return blocks[0] || null;
  },

  extractBlockAnchorName(el, section) {
    if (!el?.closest || !section) return '';
    const anchorRe = this.ANCHOR_LABEL_RES[section];
    if (!anchorRe) return '';
    const container = this.findRepeatContainer(el, section);
    const blocks = this.findBlocks(container, section);
    const block = this.findOwnBlock(el, blocks);
    const scope = block || container;
    if (!scope?.querySelectorAll) return '';

    const inputs = scope.querySelectorAll('input, select, textarea, .el-select, .ant-select');
    for (const input of inputs) {
      let label = '';
      if (typeof JobTrackerATS !== 'undefined') {
        label = JobTrackerATS.getFieldLabel(input, null) || '';
      } else {
        label = input.getAttribute?.('aria-label') || input.placeholder || '';
      }
      if (!anchorRe.test(label)) continue;
      const val =
        typeof JobTrackerFillEngine !== 'undefined'
          ? JobTrackerFillEngine.readFieldValue(input)
          : input.value || '';
      const s = String(val || '').trim();
      if (s && !/^(请选择|请输入|please)/i.test(s)) return s;
    }
    return '';
  },

  enrichLabel(label, ctx) {
    const parts = [];
    if (ctx.sectionTitle) parts.push(ctx.sectionTitle);
    if (ctx.blockIndex > 0) parts.push(`第${ctx.blockIndex + 1}段`);
    if (ctx.category === 'internship') parts.push('实习');
    if (ctx.category === 'project') parts.push('项目');
    parts.push(label);
    return parts.filter(Boolean).join('·');
  }
};
