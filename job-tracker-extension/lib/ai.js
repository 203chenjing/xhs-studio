const JobTrackerAI = {
  TIMEOUT_MS: 15000,
  TEST_TIMEOUT_MS: 30000,
  RESUME_PARSE_TIMEOUT_MS: 45000,
  MAX_TEXT_CHARS: 800,
  RESUME_PARSE_MAX_CHARS: 4000,
  RESUME_PARSE_MAX_TOKENS: 2048,
  MAX_OUTPUT_TOKENS: 96,
  CACHE_MAX: 40,
  _cache: new Map(),

  RESUME_CATEGORY_VALUES: ['internship', 'work', 'project', 'research', 'competition', 'campus', 'other'],

  cacheKey(ctx, record) {
    const url = ctx?.url || record?.url || '';
    return `${url}|${record?.company || ''}|${record?.position || ''}`;
  },

  getCached(key) {
    return this._cache.get(key) || null;
  },

  setCached(key, data) {
    if (this._cache.size >= this.CACHE_MAX) {
      const first = this._cache.keys().next().value;
      this._cache.delete(first);
    }
    this._cache.set(key, data);
  },

  compactContext(ctx) {
    const r = ctx?.ruleExtraction || {};
    let text = (ctx?.text || '').replace(/\s+/g, ' ').trim();
    if (text.length > this.MAX_TEXT_CHARS) text = text.slice(0, this.MAX_TEXT_CHARS);

    return {
      url: ctx?.url || '',
      title: (ctx?.title || '').slice(0, 120),
      text,
      ruleExtraction: {
        company: r.company || '',
        position: r.position || '',
        platform: r.platform || '',
        autoStatus: r.auto?.status || ''
      }
    };
  },

  buildPrompt(ctx) {
    const r = ctx.ruleExtraction || {};
    const lines = [`URL:${ctx.url}`, `标题:${ctx.title}`];
    if (r.company) lines.push(`规则公司:${r.company}`);
    if (r.position) lines.push(`规则岗位:${r.position}`);
    if (r.platform) lines.push(`平台:${r.platform}`);
    if (r.autoStatus) lines.push(`状态线索:${r.autoStatus}`);
    if (ctx.text) lines.push(`正文:${ctx.text}`);
    return (
      '提取校招投递记录，只输出JSON：{"company":"","position":"","status":"","note":""}。' +
      'status 用：已投递/测评/笔试/被挂/面试/Offer。缺信息留空，勿编造。\n' +
      lines.join('\n')
    );
  },

  parseJsonContent(raw) {
    const text = (raw || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1].trim() : text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI 返回非 JSON');
    return JSON.parse(candidate.slice(start, end + 1));
  },

  normalizeAiResult(data) {
    const status = JobTrackerConstants.STATUSES.includes(data?.status) ? data.status : '';
    return {
      company: String(data?.company || '').trim(),
      position: String(data?.position || '').trim(),
      status,
      note: String(data?.note || '').trim()
    };
  },

  shouldUseAi(settings, record, source) {
    if (!settings?.ai?.enabled || !settings?.ai?.autoEnhance || !settings.ai.apiKey) return false;
    if (source === 'popup' || source === 'manual-panel') return false;
    if (record.company && record.position) return false;
    if (settings.ai.mode === 'always') return true;
    return settings.ai.mode === 'fallback';
  },

  mergeRecord(base, aiData, mode) {
    const out = { ...base };
    if (!aiData) return out;

    if (mode === 'always') {
      if (aiData.company) out.company = aiData.company;
      if (aiData.position) out.position = aiData.position;
      if (aiData.status) out.status = aiData.status;
      if (aiData.note) out.note = aiData.note;
    } else {
      if (!out.company && aiData.company) out.company = aiData.company;
      if (!out.position && aiData.position) out.position = aiData.position;
    }
    if (aiData.company || aiData.position) out.source = out.source ? `${out.source}+ai` : 'ai';
    return out;
  },

  buildResumeParsePrompt(text) {
    const body = String(text || '').replace(/\s+/g, ' ').trim();
    const clipped = body.length > this.RESUME_PARSE_MAX_CHARS
      ? body.slice(0, this.RESUME_PARSE_MAX_CHARS) + '…'
      : body;
    const cats = this.RESUME_CATEGORY_VALUES.join('|');
    return (
      '你是校招简历结构化解析器。从下方简历纯文本提取信息，只输出一个 JSON 对象，不要 markdown 代码块或解释。\n' +
      '字段结构：{"personalInfo":{"name":"","gender":"","birthDate":"","phone":"","email":"","idNumber":"","idType":"","ethnicity":"","politicalStatus":"","maritalStatus":"","qq":"","wechat":"","country":"","currentCity":"","mailingAddress":"","highestDegree":"","height":"","weight":"","healthStatus":"","specialty":"","workYears":"","emergencyContactName":"","emergencyContactPhone":""},' +
      '"jobIntent":{"expectedStartDate":"","expectedCity":"","expectedSalary":""},' +
      '"education":[{"type":"","degree":"","school":"","college":"","major":"","gpa":"","ranking":"","startDate":"","endDate":"","trainingMode":""}],' +
      `"experience":[{"category":"${cats}","organization":"","role":"","startDate":"","endDate":"","description":""}],` +
      '"awards":[{"date":"","name":"","level":"","description":""}],' +
      '"languages":[{"language":"","certificate":"","level":"","score":"","proficiency":"","speaking":"","reading":""}],' +
      '"computerSkills":[{"name":"","proficiency":""}],' +
      '"certificates":[{"date":"","name":"","number":"","description":""}],' +
      '"family":[{"name":"","relation":"","phone":"","company":"","role":""}],' +
      '"special":{"selfIntroduction":"","hobbies":""}}\n' +
      '规则：缺信息留空字符串，勿编造；日期用 YYYY-MM-DD 或 YYYY/MM；experience.category 仅用列出的英文值；多段教育/经历全部列出。\n' +
      `简历文本：\n${clipped}`
    );
  },

  buildFollowUpQuestionsPrompt(profile, localGaps, sourceText) {
    const gapLines = (localGaps || [])
      .slice(0, 10)
      .map((g) => `- ${g.label}(${g.path})`)
      .join('\n');
    const profileJson = JSON.stringify(profile, null, 0).slice(0, 2000);
    return (
      '你是校招简历助手。根据已解析的简历 JSON 和缺失字段列表，生成 3-6 条中文追问，帮助用户补全信息。\n' +
      '只输出 JSON：{"questions":[{"path":"字段路径","question":"口语化追问","placeholder":"输入示例"}]}\n' +
      '要求：path 必须来自缺失列表；question 简短友好、一次只问一件事；不要重复已有信息。\n' +
      `已解析简历（摘要）：${profileJson}\n` +
      `缺失字段：\n${gapLines || '（无）'}\n` +
      `原文片段：${String(sourceText || '').slice(0, 400)}`
    );
  },

  buildMergeFollowUpPrompt(profile, answers, freeform, sourceText) {
    const qa = (answers || [])
      .filter((a) => String(a.value || '').trim())
      .map((a) => `${a.label || a.path}: ${a.value}`)
      .join('\n');
    return (
      '你是校招简历结构化助手。根据已有简历 JSON、用户的追问回答和自由补充文本，输出更新后的完整简历 JSON（结构与解析时相同）。\n' +
      '规则：只补充/修正用户明确提供的信息；缺项留空；勿编造；保留已有正确内容。\n' +
      `当前简历 JSON：\n${JSON.stringify(profile).slice(0, 3500)}\n` +
      (qa ? `用户追问回答：\n${qa}\n` : '') +
      (freeform ? `用户自由补充：\n${String(freeform).slice(0, 2000)}\n` : '') +
      (sourceText ? `原始粘贴文本：\n${String(sourceText).slice(0, 800)}` : '')
    );
  },

  normalizeResumeCategory(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (this.RESUME_CATEGORY_VALUES.includes(v)) return v;
    if (/实习|intern/i.test(v)) return 'internship';
    if (/工作|全职|正式/i.test(v)) return 'work';
    if (/项目|project/i.test(v)) return 'project';
    if (/科研|研究|research/i.test(v)) return 'research';
    if (/竞赛|比赛|contest/i.test(v)) return 'competition';
    if (/校园|社团|campus/i.test(v)) return 'campus';
    return 'other';
  },

  normalizeResumeProfile(data) {
    const pi = data?.personalInfo || {};
    const personalInfo = {};
    for (const k of [
      'name', 'gender', 'birthDate', 'phone', 'email', 'idNumber', 'currentCity',
      'wechat', 'github', 'ethnicity', 'politicalStatus', 'nativePlace', 'nativePlacePath', 'originPlace', 'targetCity', 'targetPosition'
    ]) {
      const v = String(pi[k] || '').trim();
      if (v) personalInfo[k] = v;
    }

    const education = (Array.isArray(data?.education) ? data.education : [])
      .map((e) => ({
        type: String(e?.type || e?.degree || '').trim(),
        degree: String(e?.degree || e?.type || '').trim(),
        school: String(e?.school || '').trim(),
        college: String(e?.college || '').trim(),
        major: String(e?.major || '').trim(),
        gpa: String(e?.gpa || '').trim(),
        ranking: String(e?.ranking || '').trim(),
        startDate: String(e?.startDate || '').trim(),
        endDate: String(e?.endDate || '').trim(),
        trainingMode: String(e?.trainingMode || '').trim(),
        cet4: String(e?.cet4 || '').trim(),
        cet6: String(e?.cet6 || '').trim()
      }))
      .filter((e) => e.school || e.type || e.degree || e.major);

    const experience = (Array.isArray(data?.experience) ? data.experience : [])
      .map((e) => ({
        category: this.normalizeResumeCategory(e?.category),
        organization: String(e?.organization || e?.company || '').trim(),
        role: String(e?.role || e?.position || e?.title || '').trim(),
        startDate: String(e?.startDate || '').trim(),
        endDate: String(e?.endDate || '').trim(),
        description: String(e?.description || e?.summary || '').trim()
      }))
      .filter((e) => e.organization || e.role || e.description);

    return {
      personalInfo,
      education,
      experience,
      special: { selfIntroduction: String(data?.special?.selfIntroduction || data?.selfIntroduction || '').trim() }
    };
  },

  async parseResume(text, settings, options = {}) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('简历文本为空');
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!keyValidation.valid) {
      throw new Error(keyValidation.error || '请先在设置配置 API Key');
    }
    const timeoutMs = options.timeoutMs || this.RESUME_PARSE_TIMEOUT_MS;
    const raw = await this._chat(this.buildResumeParsePrompt(trimmed), settings, {
      max_tokens: this.RESUME_PARSE_MAX_TOKENS,
      timeoutMs,
      json: true
    });
    const data = this.parseJsonContent(raw);
    const profile = JobTrackerResumeStorage.normalizeProfile(data);
    const hasContent =
      Object.keys(profile.personalInfo || {}).length ||
      profile.education?.length ||
      profile.experience?.length ||
      profile.special?.selfIntroduction ||
      (profile.awards || []).length ||
      (profile.languages || []).length;
    if (!hasContent) throw new Error('AI 未能识别有效字段');
    return profile;
  },

  async generateFollowUpQuestions(profile, sourceText, settings, localGaps) {
    const gaps = localGaps || JobTrackerResumeGapAnalyzer.analyze(profile);
    if (!gaps.length) return [];
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!keyValidation.valid) return gaps;
    try {
      const raw = await this._chat(
        this.buildFollowUpQuestionsPrompt(profile, gaps, sourceText),
        settings,
        { max_tokens: 600, timeoutMs: 20000, json: true }
      );
      const data = this.parseJsonContent(raw);
      const aiQs = Array.isArray(data?.questions) ? data.questions : [];
      if (!aiQs.length) return gaps;
      const byPath = new Map(gaps.map((g) => [g.path, g]));
      return aiQs
        .map((q) => {
          const base = byPath.get(q.path) || gaps.find((g) => g.path === q.path);
          if (!base && !q.path) return null;
          return {
            id: q.path || base?.id,
            path: q.path || base?.path,
            label: base?.label || q.path,
            question: String(q.question || base?.question || '').trim() || base?.question,
            placeholder: String(q.placeholder || base?.placeholder || '').trim(),
            priority: base?.priority || 'medium',
            inputType: base?.inputType || 'text'
          };
        })
        .filter((q) => q && q.path && q.question)
        .slice(0, 8);
    } catch (_) {
      return gaps;
    }
  },

  async mergeResumeFollowUp(profile, answers, freeform, sourceText, settings) {
    let merged = JobTrackerResumeGapAnalyzer.applyAnswers(profile, answers);
    const free = String(freeform || '').trim();
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!free && !keyValidation.valid) return merged;
    if (!free && answers?.every((a) => a.path && !/\./.test(a.path.split('.').slice(-1)[0]))) {
      return merged;
    }
    if (!keyValidation.valid) return merged;
    try {
      const raw = await this._chat(
        this.buildMergeFollowUpPrompt(merged, answers, free, sourceText),
        settings,
        { max_tokens: this.RESUME_PARSE_MAX_TOKENS, timeoutMs: this.RESUME_PARSE_TIMEOUT_MS, json: true }
      );
      const data = this.parseJsonContent(raw);
      return JobTrackerResumeStorage.normalizeProfile(data);
    } catch (_) {
      return merged;
    }
  },

  async fillAssistEssay(question, profile, settings) {
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!settings?.ai?.enabled || !keyValidation.valid) {
      return { ok: false, error: '请先在设置页启用 AI 并保存 API Key' };
    }
    const q = String(question || '').trim();
    if (!q) return { ok: false, error: '请先点击开放题输入框' };

    const summary = [];
    const pi = profile?.personalInfo || {};
    if (pi.name) summary.push(`姓名:${pi.name}`);
    if (profile?.education?.length) {
      const edu = profile.education[0];
      summary.push(`学历:${edu.degree || edu.type || ''} ${edu.school || ''} ${edu.major || ''}`.trim());
    }
    const exp = (profile?.experience || []).slice(0, 3);
    for (const e of exp) {
      summary.push(`${e.category || '经历'}:${e.organization || ''} ${e.role || ''} ${(e.description || '').slice(0, 120)}`);
    }

    const prompt =
      '你是校招简历助手。根据候选人简历要点，用第一人称写一段简洁、真实的网申开放题回答（150-300字）。' +
      '只输出回答正文，不要标题或解释。\n' +
      `题目：${q}\n` +
      `简历要点：\n${summary.join('\n')}`;

    const text = await this._chat(prompt, settings, { max_tokens: 400, timeoutMs: 20000 });
    return { ok: true, text: String(text || '').trim() };
  },

  buildAutofillBatchPrompt(fields, profile) {
    const compact = JSON.stringify(profile, null, 0).slice(0, 5000);
    const lines = (fields || [])
      .map(
        (f, i) =>
          `[${i}] 标签="${f.label || ''}" 上下文="${f.enrichedLabel || f.sectionTitle || ''}" 区块=${f.section || ''}/${f.category || ''} 第${(f.blockIndex || 0) + 1}段 占位=${f.placeholder || ''} 类型=${f.inputType || ''}`
      )
      .join('\n');
    return (
      '你是网申自动填表助手。根据候选人简历 JSON，为下列每个页面字段给出应填入的值。\n' +
      '只输出 JSON：{"matches":{"0":"值","1":""}}，key 为字段序号字符串，无合适内容留空，勿编造。\n' +
      '长文本（实习内容/项目描述/在校职务）可截取前 600 字。\n' +
      `待填字段：\n${lines}\n` +
      `简历 JSON：\n${compact}`
    );
  },

  async matchAutofillFieldsBatch(fields, profile, settings) {
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!keyValidation.valid) return { ok: false, error: keyValidation.error || 'API Key 无效' };
    const list = (fields || []).filter((f) => f?.label);
    if (!list.length) return { ok: false, error: '无字段' };
    try {
      const raw = await this._chat(this.buildAutofillBatchPrompt(list, profile), settings, {
        max_tokens: 4096,
        timeoutMs: 45000,
        json: true
      });
      const data = this.parseJsonContent(raw);
      const matches = data?.matches && typeof data.matches === 'object' ? data.matches : {};
      const normalized = {};
      for (const [k, v] of Object.entries(matches)) {
        normalized[String(k)] = String(v ?? '').trim();
      }
      return { ok: true, matches: normalized };
    } catch (err) {
      return { ok: false, error: err.message || 'AI 批量匹配失败' };
    }
  },

  async matchAutofillFieldsBatch(fields, profile, settings) {
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!keyValidation.valid) return { ok: false, error: keyValidation.error || 'API Key 无效' };
    const list = (fields || []).filter((f) => f?.label);
    if (!list.length) return { ok: false, error: '无字段' };
    try {
      const raw = await this._chat(this.buildAutofillBatchPrompt(list, profile), settings, {
        max_tokens: 4096,
        timeoutMs: 45000,
        json: true
      });
      const data = this.parseJsonContent(raw);
      const matches = data?.matches && typeof data.matches === 'object' ? data.matches : {};
      const normalized = {};
      for (const [k, v] of Object.entries(matches)) {
        normalized[String(k)] = String(v ?? '').trim();
      }
      return { ok: true, matches: normalized };
    } catch (err) {
      return { ok: false, error: err.message || 'AI 批量匹配失败' };
    }
  },

  buildAgentFormPlanPrompt(snapshot, profile, round = 0) {
    const compact = JSON.stringify(profile, null, 0).slice(0, 4500);
    const fieldLines = (snapshot?.fields || [])
      .map(
        (f) =>
          `${f.ref}|${f.enrichedLabel || f.label}|widget=${f.widget}|empty=${f.empty}|current="${f.currentValue || ''}"`
      )
      .join('\n');
    return (
      '你是浏览器网申填表 Agent（类似 chrome-agent / FSB）。根据页面字段快照与简历，为仍为空白的字段生成操作序列。\n' +
      'Ant Design 下拉/级联/日期不能仅 set value，需模拟用户：mousedown 打开 → click_text 点选项 → 或 fill+press_key Enter。\n' +
      '只输出 JSON：{"actions":[{"ref":"f0","action":"fill","value":"邱井晨"}, {"ref":"f3","action":"click_then_select","value":"广东省"}, {"ref":"f5","action":"mousedown"}, {"ref":"f5","action":"click_text","text":"前5%"}, {"ref":"f8","action":"fill","value":"2002-06-19"}, {"ref":"f8","action":"press_key","key":"Enter"}]}\n' +
      'action 取值：fill|type|select|date|mousedown|click|click_text|click_then_select|press_key|scroll\n' +
      '无合适值则跳过该字段。长文本截取前 600 字。勿编造。\n' +
      `轮次：${round + 1}\n` +
      `页面：${snapshot?.title || ''} ${snapshot?.url || ''}\n` +
      `空白字段：\n${fieldLines}\n` +
      `简历 JSON：\n${compact}`
    );
  },

  normalizeAgentActions(data) {
    const raw = data?.actions || data?.steps || [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a) => ({
        ref: String(a.ref || a.fieldRef || '').trim(),
        action: String(a.action || a.type || 'fill').toLowerCase(),
        value: a.value != null ? String(a.value) : '',
        text: a.text != null ? String(a.text) : '',
        key: a.key != null ? String(a.key) : 'Enter'
      }))
      .filter((a) => a.action === 'click_text' ? !!(a.text || a.value) : a.action === 'press_key' ? true : !!a.ref);
  },

  async planAgentFormFill(snapshot, profile, settings, round = 0) {
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!keyValidation.valid) return { ok: false, error: keyValidation.error || 'API Key 无效' };
    const fields = snapshot?.fields || [];
    if (!fields.length) return { ok: false, error: '无空白字段' };
    try {
      const raw = await this._chat(this.buildAgentFormPlanPrompt(snapshot, profile, round), settings, {
        max_tokens: 4096,
        timeoutMs: 60000,
        json: true
      });
      const data = this.parseJsonContent(raw);
      const actions = this.normalizeAgentActions(data);
      if (!actions.length) return { ok: false, error: 'Agent 未生成操作' };
      return { ok: true, actions };
    } catch (err) {
      return { ok: false, error: err.message || 'Agent 规划失败' };
    }
  },

  buildAutofillMatchPrompt(field, profile) {
    const compact = JSON.stringify(profile, null, 0).slice(0, 4500);
    return (
      '你是网申自动填表助手。根据候选人简历 JSON，为页面上的单个字段给出应填入的值。\n' +
      '只输出 JSON：{"value":"","reason":""}。若无合适内容 value 留空字符串，勿编造。\n' +
      '长文本字段（实习内容/项目描述）可截取前 600 字。\n' +
      `字段标签：${field.label || ''}\n` +
      `上下文：${field.enrichedLabel || field.sectionTitle || ''}\n` +
      `区块类型：${field.section || ''} ${field.category || ''} 第${(field.blockIndex || 0) + 1}段\n` +
      `占位符：${field.placeholder || ''}\n` +
      `输入类型：${field.inputType || ''}\n` +
      `简历 JSON：\n${compact}`
    );
  },

  async matchAutofillField(field, profile, settings) {
    const keyValidation = JobTrackerSettings.validateApiKey(settings?.ai?.apiKey);
    if (!keyValidation.valid) return { ok: false, error: keyValidation.error || 'API Key 无效' };
    if (!field?.label) return { ok: false, error: '无字段标签' };
    try {
      const raw = await this._chat(this.buildAutofillMatchPrompt(field, profile), settings, {
        max_tokens: 512,
        timeoutMs: 15000,
        json: true
      });
      const data = this.parseJsonContent(raw);
      const value = String(data?.value ?? '').trim();
      if (!value) return { ok: false, error: 'AI 未找到匹配值' };
      return { ok: true, value, reason: String(data?.reason || '').trim() };
    } catch (err) {
      return { ok: false, error: err.message || 'AI 匹配失败' };
    }
  },

  scoreVersionLocal(jdText, versions) {
    const jd = String(jdText || '').toLowerCase();
    const tokens = jd.match(/[\u4e00-\u9fa5a-z]{2,}/gi) || [];
    return (versions || []).map((v) => {
      const name = String(v.name || '');
      const lower = name.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        const tl = t.toLowerCase();
        if (tl.length < 2) continue;
        if (lower.includes(tl) || tl.includes(lower.replace(/版$/g, ''))) score += 12;
      }
      if (/ai|产品|算法|研发|运营|设计/i.test(jd)) {
        if (/ai|产品|算法|研发|运营|设计/i.test(name)) score += 25;
      }
      if (/通用|默认/.test(name)) score += 5;
      return { ...v, score };
    }).sort((a, b) => b.score - a.score);
  },

  async suggestResumeVersion(jdText, versions, settings, options = {}) {
    const list = versions || [];
    if (!list.length) return { ok: false, error: '暂无简历版本' };
    const local = this.scoreVersionLocal(jdText, list);
    const top = local[0];

    if (!options.useAi || !settings?.ai?.enabled || !settings?.ai?.apiKey) {
      return {
        ok: true,
        suggestion: top,
        candidates: local.slice(0, 3),
        source: 'local',
        reason: top?.score > 0 ? `本地关键词匹配（${top.score}分）` : '默认推荐第一个版本'
      };
    }

    const keyValidation = JobTrackerSettings.validateApiKey(settings.ai.apiKey);
    if (!keyValidation.valid) {
      return { ok: true, suggestion: top, candidates: local.slice(0, 3), source: 'local', reason: 'API Key 无效，已用本地匹配' };
    }

    const versionList = list.map((v) => v.name).join('、');
    const prompt =
      `根据岗位描述，从以下简历版本中推荐最合适的一个。只输出JSON：{"versionName":"","reason":""}\n` +
      `版本列表：${versionList}\n` +
      `岗位描述：${String(jdText || '').slice(0, 600)}`;

    try {
      const raw = await this._chat(prompt, settings, { max_tokens: 80, json: true });
      const data = this.parseJsonContent(raw);
      const matched = list.find((v) => v.name === data.versionName) || list.find((v) => data.versionName && v.name.includes(data.versionName));
      return {
        ok: true,
        suggestion: matched || top,
        candidates: local.slice(0, 3),
        source: 'ai',
        reason: data.reason || 'AI 推荐'
      };
    } catch (_) {
      return { ok: true, suggestion: top, candidates: local.slice(0, 3), source: 'local', reason: 'AI 失败，已用本地匹配' };
    }
  },

  async _chat(prompt, settings, options = {}) {
    const keyValidation = JobTrackerSettings.validateApiKey(settings.ai.apiKey);
    if (!keyValidation.valid) throw new Error(keyValidation.error || 'API Key 无效');
    const apiKey = keyValidation.key;
    const baseUrl = JobTrackerSettings.sanitizeUrl(settings.ai.baseUrl).replace(/\/$/, '');
    const model = JobTrackerSettings.sanitizeModel(settings.ai.model) || 'deepseek-chat';
    const timeoutMs = options.timeoutMs || this.TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      const body = {
        model,
        temperature: 0.3,
        max_tokens: options.max_tokens || this.MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      };
      if (options.json) body.response_format = { type: 'json_object' };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`AI ${res.status}: ${errText.slice(0, 160)}`);
      }
      const json = await res.json();
      return json?.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timer);
    }
  },

  async extract(ctx, settings, recordForCache, options = {}) {
    const compact = this.compactContext(ctx);
    const key = this.cacheKey(compact, recordForCache);
    const cached = this.getCached(key);
    if (cached) return cached;

    const timeoutMs = options.timeoutMs || this.TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      const keyValidation = JobTrackerSettings.validateApiKey(settings.ai.apiKey);
      if (!keyValidation.valid) {
        throw new Error(
          keyValidation.error ||
            'API Key 含非法字符（常见于复制时带入中文或空格），请重新粘贴纯英文 Key'
        );
      }
      const apiKey = keyValidation.key;
      const baseUrl = JobTrackerSettings.sanitizeUrl(settings.ai.baseUrl).replace(/\/$/, '');
      const model = JobTrackerSettings.sanitizeModel(settings.ai.model) || 'deepseek-chat';
      if (!JobTrackerSettings.isAsciiHeaderValue(apiKey)) {
        throw new Error(
          'API Key 含非法字符（常见于复制时带入中文或空格），请重新粘贴纯英文 Key'
        );
      }
      if (!baseUrl.startsWith('http')) {
        throw new Error('Base URL 无效：请使用 https://api.deepseek.com/v1');
      }
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: this.MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: this.buildPrompt(compact) }]
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`AI ${res.status}: ${errText.slice(0, 160)}`);
      }
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      const normalized = this.normalizeAiResult(this.parseJsonContent(content));
      this.setCached(key, normalized);
      return normalized;
    } catch (err) {
      if (err?.name === 'AbortError' || String(err?.message || '').includes('aborted')) {
        throw new Error(
          `请求超时（${Math.round(timeoutMs / 1000)} 秒）。请检查：1) Base URL 是否为 https://api.deepseek.com/v1；2) 网络能否访问 DeepSeek；3) API Key 是否有效`
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
};