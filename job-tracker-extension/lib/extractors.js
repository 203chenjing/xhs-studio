const JobTrackerExtractors = (() => {
  function textOf(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function firstText(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        const t = textOf(el);
        if (t && t.length < 120) return t;
      } catch (_) {}
    }
    return '';
  }

  function cleanCompany(name) {
    return (name || '')
      .replace(/[-_|·].*?(招聘|校招|校园|官网|人才).*$/i, '')
      .replace(/\s*(校园招聘|社会招聘|校招|秋招|春招|官方招聘|人才招聘|加入我们|招聘官网).*$/i, '')
      .replace(/^(欢迎|加入|关于)/, '')
      .trim();
  }

  function cleanPosition(name) {
    return (name || '')
      .replace(/\s*[-_|]\s*.*?(公司|集团|科技|有限).*$/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .replace(/\s*(招聘|校招|实习).*$/i, '')
      .trim();
  }

  function decodeHostSlug(slug) {
    if (!slug || /^(www|app|campus|jobs|job|hr|zhaopin|recruit|hire|career|talent|join|m|mobile)$/i.test(slug)) return '';
    return cleanCompany(slug.replace(/-/g, ' '));
  }

  function companyFromHost(hostname = location.hostname) {
    const host = hostname.toLowerCase();
    const rules = [
      [/^([^.]+)\.mokahr\.com$/, 1],
      [/^([^.]+)\.moka\.co$/, 1],
      [/^([^.]+)\.hotjob\.cn$/, 1],
      [/^([^.]+)\.zhiye\.com$/, 1],
      [/^([^.]+)\.zhaopin\.com$/, 1],
      [/^([^.]+)\.51job\.com$/, 1],
      [/^([^.]+)\.beisen\.com$/, 1],
      [/^([^.]+)\.beisen\.cn$/, 1],
      [/^(campus|jobs|job|hr|zhaopin|recruit|career|talent)\.([^.]+)\.(com|cn|net)$/, 2],
      [/^([^.]+)\.(com|cn|net)$/, 1]
    ];
    for (const [re, idx] of rules) {
      const m = host.match(re);
      if (m?.[idx]) {
        const name = decodeHostSlug(m[idx]);
        if (name && name.length >= 2) return name;
      }
    }
    return '';
  }

  function fromTitle() {
    const title = document.title || '';
    const parts = title.split(/[-_|·—–/／]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const first = parts[0];
      if (/招聘|校招|校园|人才|join|career|jobs/i.test(last)) {
        return { company: cleanCompany(parts[parts.length - 2] || ''), position: cleanPosition(first) };
      }
      return { company: cleanCompany(last), position: cleanPosition(first) };
    }
    return { company: companyFromHost(), position: cleanPosition(parts[0] || '') };
  }

  function fromMeta() {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    const desc = document.querySelector('meta[name="description"]')?.content || '';
    let info = { company: '', position: '' };
    if (ogTitle) {
      const parts = ogTitle.split(/[-_|·—–/／]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        info = { company: cleanCompany(parts[parts.length - 1]), position: cleanPosition(parts[0]) };
      }
    }
    const companyInDesc = desc.match(/(.{2,20}?)(?:公司|集团|科技|银行|网络)?(?:招聘|校招)/);
    if (!info.company && companyInDesc) info.company = cleanCompany(companyInDesc[1]);
    return info;
  }

  function fromDom() {
    const company = firstText([
      '[class*="company-name"]', '[class*="companyName"]', '[class*="corp-name"]',
      '[class*="org-name"]', '[class*="employer"]', '[class*="enterprise"]',
      '[class*="brand-name"]', '.company', '.corp-name', 'h2.company',
      '[data-company]', '[data-company-name]', '.employer-name', '.corp_title'
    ]);
    const position = firstText([
      '[class*="job-title"]', '[class*="jobTitle"]', '[class*="position-name"]',
      '[class*="post-name"]', '[class*="job_name"]', '[class*="jobName"]',
      'h1', 'h2.title', '.job-name', '.position-title', '.job-title',
      '[data-position]', '[data-job-title]', '.post-title', '.position-name'
    ]);
    return { company: cleanCompany(company), position: cleanPosition(position) };
  }

  function fromBodyPatterns() {
    const text = document.body?.innerText?.slice(0, 8000) || '';
    let company = '';
    let position = '';
    const companyMatch = text.match(/(?:招聘(?:主体|单位|公司)|所属(?:公司|组织|部门)|公司名称)[：:\s]+([^\n，,；;]{2,30})/);
    const positionMatch = text.match(/(?:职位名称|岗位名称|应聘职位|申请职位|职位)[：:\s]+([^\n，,；;]{2,40})/);
    if (companyMatch) company = cleanCompany(companyMatch[1]);
    if (positionMatch) position = cleanPosition(positionMatch[1]);
    return { company, position };
  }

  function mergeInfo(...sources) {
    let company = companyFromHost();
    let position = '';
    for (const s of sources) {
      if (!company && s.company) company = s.company;
      if (!position && s.position) position = s.position;
    }
    return { company, position };
  }

  function applyHeuristics(url, base, ruleId) {
    if (typeof JobTrackerExtractHeuristics === 'undefined') return base;
    const h = JobTrackerExtractHeuristics.extract(url, ruleId);
    const sources = [...new Set([...(base.extractionSources || []), ...(h.extractionSources || [])])];
    const matchQuality = Math.max(
      base.matchQuality || 0,
      h.matchQuality || 0,
      JobTrackerExtractHeuristics.computeQuality(
        base.company || h.company,
        base.position || h.position,
        sources.map((s) => ({ source: s, priority: 1 })),
        ruleId
      )
    );
    return {
      ...base,
      company: base.company || h.company,
      position: base.position || h.position,
      matchQuality,
      extractionSources: sources
    };
  }

  function finalizeInfo(info, url, ruleId) {
    const merged = applyHeuristics(url, info, ruleId);
    if (!merged.matchQuality && (merged.company || merged.position)) {
      merged.matchQuality = JobTrackerExtractHeuristics?.computeQuality?.(
        { company: merged.company, position: merged.position, sources: merged.extractionSources },
        ruleId
      ) || 40;
    }
    return merged;
  }

  function standardExtract(platform, defaultNote, defaultStatus = '已投递', extra = () => ({})) {
    const info = mergeInfo(fromDom(), fromTitle(), fromMeta(), fromBodyPatterns(), extra());
    return {
      ...info,
      platform,
      defaultStatus,
      defaultNote: defaultNote || '校招'
    };
  }

  function standardRule(id, test, platform, defaultNote, opts = {}) {
    return {
      id,
      test,
      platform,
      extract: () => standardExtract(platform, defaultNote, opts.defaultStatus || '已投递', opts.extra),
      detectSuccess: opts.detectSuccess || ((text) => /投递成功|申请成功|提交成功|网申成功|已成功|感谢您的申请|thank\s*you|application\s+submitted|successfully\s+submitted/i.test(text)),
      successNote: opts.successNote || `${platform}·投递成功`
    };
  }

  const SITE_RULES = [
    // ── 互联网 / 科技 ──
    standardRule('alibaba', (u) => /(?:\.|^)(?:alibaba|ali)\.com|talent\.alibaba|campus\.alibaba|job\.alibaba/i.test(u), '阿里校招', '阿里校招', {
      extra: () => {
        const info = {};
        const breadcrumb = firstText(['[class*="breadcrumb"]', '[class*="bread-crumb"]']);
        if (breadcrumb) {
          const seg = breadcrumb.split(/[>/]/).map((s) => s.trim()).filter(Boolean);
          info.company = cleanCompany(seg.find((s) => /集团|事业|公司|部|闪购|飞猪|高德|盒马|健康|灵犀|淘天|蚂蚁|千问|阿里云|国际|Token/i.test(s)) || seg[0] || '');
        }
        return info;
      },
      successNote: '阿里校招·投递成功'
    }),
    standardRule('tencent', (u) => /join\.qq\.com|careers\.tencent|hr\.tencent|tencent/i.test(u), '腾讯校招', '腾讯校招'),
    standardRule('bytedance', (u) => /jobs\.bytedance|career\.bytedance|feishu\.cn\/hire/i.test(u), '字节校招', '字节校招'),
    standardRule('baidu', (u) => /talent\.baidu|zhaopin\.baidu|campus\.baidu/i.test(u), '百度校招', '百度校招'),
    standardRule('jd', (u) => /zhaopin\.jd|campus\.jd|join\.jd/i.test(u), '京东校招', '京东校招', {
      extra: () => {
        const ctx = document.body?.innerText?.slice(0, 4000) || '';
        if (/CHO|人力/i.test(ctx)) return { note: '京东CHO体系' };
        if (/零售|商城/i.test(ctx)) return { note: '京东零售' };
        return {};
      }
    }),
    standardRule('meituan', (u) => /zhaopin\.meituan|campus\.meituan|job\.meituan/i.test(u), '美团校招', '美团校招'),
    standardRule('pdd', (u) => /careers\.pinduoduo|pinduoduo\.com.*(?:job|campus|zhaopin)/i.test(u), '拼多多校招', '拼多多校招'),
    standardRule('netease', (u) => /game\.campus\.163|campus\.163|hr\.163|netease\.com.*(?:campus|job)/i.test(u), '网易校招', '网易校招'),
    standardRule('xiaomi', (u) => /hr\.xiaomi|zhaopin\.mi|xiaomi\.com.*(?:job|campus|zhaopin)/i.test(u), '小米校招', '小米校招'),
    standardRule('huawei', (u) => /career\.huawei|huawei\.com.*(?:career|campus|job)/i.test(u), '华为校招', '华为校招'),
    standardRule('oppo', (u) => /careers\.oppo|oppo\.com.*(?:campus|job|zhaopin)/i.test(u), 'OPPO校招', 'OPPO校招'),
    standardRule('vivo', (u) => /hr\.vivo|vivo\.com.*(?:campus|job|zhaopin)/i.test(u), 'vivo校招', 'vivo校招'),
    standardRule('honor', (u) => /career\.honor|honor\.com.*(?:job|campus)/i.test(u), '荣耀校招', '荣耀校招'),
    standardRule('dji', (u) => /we\.dji|dji\.com.*(?:job|campus|hire)/i.test(u), '大疆校招', '大疆校招'),
    standardRule('insta360', (u) => /insta360|arashivision/i.test(u), '影石校招', '影石校招'),
    standardRule('nio', (u) => /nio\.com.*(?:career|job|campus)|nioinc/i.test(u), '蔚来校招', '蔚来校招'),
    standardRule('lixiang', (u) => /lixiang|chehejia/i.test(u), '理想校招', '理想校招'),
    standardRule('ant', (u) => /talent\.antgroup|antgroup\.com.*(?:campus|job)/i.test(u), '蚂蚁校招', '蚂蚁校招'),
    standardRule('ctrip', (u) => /ctrip\.com.*(?:job|campus|career)|trip\.com.*job/i.test(u), '携程校招', '携程校招'),
    standardRule('qunar', (u) => /qunar\.com.*(?:job|campus|zhaopin)/i.test(u), '去哪儿校招', '去哪儿校招'),
    standardRule('dewu', (u) => /dewu|shizhuang-inc|poizon/i.test(u), '得物校招', '得物校招'),
    standardRule('bilibili', (u) => /jobs\.bilibili|bilibili\.com.*(?:campus|job)/i.test(u), 'B站校招', 'B站校招'),
    standardRule('kuaishou', (u) => /zhaopin\.kuaishou|campus\.kuaishou/i.test(u), '快手校招', '快手校招'),
    standardRule('mihoyo', (u) => /mihoyo|hoyoverse|miHoYo/i.test(u), '米哈游校招', '米哈游校招'),
    standardRule('hypergryph', (u) => /hypergryph|gryphline/i.test(u), '鹰角校招', '鹰角校招'),
    standardRule('lilith', (u) => /lilithgames/i.test(u), '莉莉丝校招', '莉莉丝校招'),
    standardRule('mojang-cn', (u) => /mojtd|沐瞳/i.test(u), '沐瞳校招', '沐瞳校招'),
    standardRule('iflytek', (u) => /iflytek|科大讯飞/i.test(u), '科大讯飞校招', '科大讯飞校招'),
    standardRule('sensetime', (u) => /sensetime|商汤/i.test(u), '商汤校招', '商汤校招'),
    standardRule('megvii', (u) => /megvii|旷视/i.test(u), '旷视校招', '旷视校招'),
    standardRule('zhipu', (u) => /zhipu|智谱|chatglm/i.test(u), '智谱校招', '智谱校招'),
    standardRule('stepfun', (u) => /stepfun|阶跃/i.test(u), '阶跃校招', '阶跃校招'),
    standardRule('deepseek', (u) => /deepseek/i.test(u), 'DeepSeek校招', 'DeepSeek校招'),

    // ── 硬件 / 制造 / 新能源 ──
    standardRule('byd', (u) => /byd\.com.*(?:job|campus|zhaopin)/i.test(u), '比亚迪校招', '比亚迪校招'),
    standardRule('catl', (u) => /catl|宁德时代/i.test(u), '宁德时代校招', '宁德时代校招'),
    standardRule('gree', (u) => /gree\.com.*(?:job|campus)/i.test(u), '格力校招', '格力校招'),
    standardRule('midea', (u) => /midea\.com.*(?:job|campus)/i.test(u), '美的校招', '美的校招'),
    standardRule('haier', (u) => /haier\.com.*(?:job|campus)/i.test(u), '海尔校招', '海尔校招'),
    standardRule('lenovo', (u) => /lenovo\.com.*(?:job|campus)|jobs\.lenovo/i.test(u), '联想校招', '联想校招'),
    standardRule('hikvision', (u) => /hikvision|海康/i.test(u), '海康校招', '海康校招'),
    standardRule('univ', (u) => /uniview|宇视/i.test(u), '宇视校招', '宇视校招'),
    standardRule('inspur', (u) => /inspur|浪潮/i.test(u), '浪潮校招', '浪潮校招'),
    standardRule('cxmt', (u) => /cxmt|长鑫/i.test(u), '长鑫校招', '长鑫校招'),
    standardRule('smic', (u) => /smic|中芯/i.test(u), '中芯校招', '中芯校招'),
    standardRule('boe', (u) => /boe|京东方/i.test(u), '京东方校招', '京东方校招'),
    standardRule('sgmw', (u) => /sgmw|上汽通用/i.test(u), '上汽通用校招', '上汽通用校招'),
    standardRule('geely', (u) => /geely|吉利/i.test(u), '吉利校招', '吉利校招'),
    standardRule('xpeng', (u) => /xpeng|小鹏/i.test(u), '小鹏校招', '小鹏校招'),
    standardRule('zeekr', (u) => /zeekr|极氪/i.test(u), '极氪校招', '极氪校招'),
    standardRule('leapmotor', (u) => /leapmotor|零跑/i.test(u), '零跑校招', '零跑校招'),

    // ── 金融 / 咨询 / 快消 ──
    standardRule('cmb', (u) => /cmbchina|招商银行/i.test(u), '招商银行校招', '招商银行校招'),
    standardRule('pingan', (u) => /pingan\.com.*(?:job|campus)|talent\.pingan/i.test(u), '平安校招', '平安校招'),
    standardRule('mybank', (u) => /mybank|网商银行/i.test(u), '网商银行校招', '网商银行校招'),
    standardRule('eastmoney', (u) => /eastmoney|东方财富/i.test(u), '东方财富校招', '东方财富校招'),
    standardRule('deloitte', (u) => /deloitte|德勤/i.test(u), '德勤校招', '德勤校招'),
    standardRule('ey', (u) => /ey\.com|安永|EY/i.test(u), '安永校招', '安永校招'),
    standardRule('kpmg', (u) => /kpmg|毕马威/i.test(u), '毕马威校招', '毕马威校招'),
    standardRule('pwc', (u) => /pwc|普华永道/i.test(u), '普华永道校招', '普华永道校招'),
    standardRule('mckinsey', (u) => /mckinsey|麦肯锡/i.test(u), '麦肯锡校招', '麦肯锡校招'),
    standardRule('bcg', (u) => /bcg\.com|波士顿咨询/i.test(u), 'BCG校招', 'BCG校招'),
    standardRule('genki', (u) => /genkiforest|元气森林/i.test(u), '元气森林校招', '元气森林校招'),
    standardRule('huolala', (u) => /huolala|货拉拉|lalamove/i.test(u), '货拉拉校招', '货拉拉校招'),
    standardRule('finereport', (u) => /finereport|fanruan|帆软/i.test(u), '帆软校招', '帆软校招'),

    // ── 招聘 ATS（一套系统覆盖大量公司）──
    standardRule('moka', (u) => /moka\.co|mokahr\.com/i.test(u), 'Moka', 'Moka校招'),
    {
      id: 'beisen',
      test: (u) => /beisen\.(com|cn)/i.test(u),
      platform: '北森',
      extract: () => {
        const info = standardExtract('北森', '北森测评', '测评');
        const bodyText = document.body?.innerText?.slice(0, 6000) || '';
        const companyMatch = bodyText.match(/(?:欢迎参加|您好，)?(.{2,24}?)(?:的)?(?:在线)?(?:测评|考试|面试)/);
        if (companyMatch && !info.company) info.company = cleanCompany(companyMatch[1]);
        if (/测评|考试|能力测试|性格测试/i.test(bodyText + location.href)) {
          info.defaultStatus = '测评';
          info.defaultNote = '北森测评';
        } else {
          info.defaultStatus = '已投递';
          info.defaultNote = '北森校招';
        }
        return info;
      },
      detectSuccess: (text) => /投递成功|提交成功|申请成功/.test(text),
      successNote: '北森校招·投递成功'
    },
    standardRule('dayee', (u) => /dayee\.com|大易/i.test(u), '大易', '大易校招'),
    standardRule('hotjob', (u) => /hotjob\.cn/i.test(u), 'Hotjob', 'Hotjob校招'),
    standardRule('zhiye', (u) => /zhiye\.com/i.test(u), '北森职页', '北森职页'),
    standardRule('nowcoder', (u) => /nowcoder\.com/i.test(u), '牛客', '牛客', {
      defaultStatus: '笔试',
      detectSuccess: (text) => /提交成功|已完成|测评|笔试/.test(text),
      successNote: '牛客笔试/测评'
    }),
    standardRule('showmebug', (u) => /showmebug\.com/i.test(u), 'ShowMeBug', 'ShowMeBug测评', {
      defaultStatus: '测评'
    }),
    standardRule('shixiseng', (u) => /shixiseng\.com/i.test(u), '实习僧', '实习僧'),
    standardRule('liepin', (u) => /liepin\.com/i.test(u), '猎聘', '猎聘'),
    standardRule('zhaopin', (u) => /zhaopin\.com|51job/i.test(u), '智联/前程', '智联校招'),
    standardRule('boss', (u) => /zhipin\.com/i.test(u), 'Boss直聘', 'Boss直聘'),
    standardRule('lagou', (u) => /lagou\.com/i.test(u), '拉勾', '拉勾'),
    standardRule('yingjiesheng', (u) => /yingjiesheng\.com/i.test(u), '应届生求职网', '应届生求职网'),
    standardRule('workday', (u) => /\.myworkdayjobs\.com|workday\.com.*(?:job|career)/i.test(u), 'Workday', 'Workday校招'),
    standardRule('successfactors', (u) => /successfactors\.com|performancemanager/i.test(u), 'SAP SuccessFactors', 'SF校招'),
    standardRule('taleo', (u) => /taleo\.net|oraclecloud\.com.*candidate/i.test(u), 'Taleo', 'Taleo校招'),
    standardRule('greenhouse', (u) => /greenhouse\.io|boards\.greenhouse/i.test(u), 'Greenhouse', 'Greenhouse'),
    standardRule('lever', (u) => /lever\.co|jobs\.lever/i.test(u), 'Lever', 'Lever'),
    standardRule('icims', (u) => /icims\.com/i.test(u), 'iCIMS', 'iCIMS校招'),

    // ── 国企 / 研究院 / 其他常见校招域 ──
    standardRule('spacetalent', (u) => /spacetalent\.com\.cn/i.test(u), '国聘', '国聘网'),
    standardRule('jobui', (u) => /jobui\.com/i.test(u), '职友集', '职友集'),
    standardRule('guopin', (u) => /guopin\.com\.cn|国聘/i.test(u), '国聘', '国聘网'),
    standardRule('cnipa', (u) => /cnipa|知识产权/i.test(u), '国知局', '国知局'),
    standardRule('sgcc', (u) => /sgcc\.com\.cn|国家电网/i.test(u), '国家电网校招', '国家电网校招'),
    standardRule('chinaunicom', (u) => /chinaunicom|联通/i.test(u), '联通校招', '联通校招'),
    standardRule('chinamobile', (u) => /chinamobile|中国移动/i.test(u), '移动校招', '移动校招'),
    standardRule('csg', (u) => /csg\.cn|南方电网/i.test(u), '南网校招', '南网校招'),
    standardRule('cssc', (u) => /cssc|中国船舶/i.test(u), '中船校招', '中船校招'),
    standardRule('avic', (u) => /avic|中国航空/i.test(u), '中航校招', '中航校招'),
    standardRule('casic', (u) => /casic|航天科工/i.test(u), '航天科工校招', '航天科工校招'),
    standardRule('casc', (u) => /casc|航天科技/i.test(u), '航天科技校招', '航天科技校招'),
    standardRule('cssn', (u) => /cssn|中国星网/i.test(u), '星网校招', '星网校招'),
    standardRule('cas', (u) => /\.cas\.cn|中科院/i.test(u), '中科院校招', '中科院校招'),
    standardRule('shlab', (u) => /shlab|上海人工智能实验室/i.test(u), '上海AI Lab', '上海AI Lab'),

    // ── 泛匹配：campus/jobs 子域 ──
    standardRule('generic-campus', (u) => /(?:campus|school|university|graduate|intern)\.[a-z0-9-]+\.(?:com|cn)/i.test(u), '校招官网', '校招'),
    standardRule('generic-zhaopin', (u) => /(?:zhaopin|jobs|job|hr|recruit|career|talent|hire|join)\.[a-z0-9-]+\.(?:com|cn)/i.test(u), '官网招聘', '校招'),
    standardRule('generic-path', (u) => /\/(?:campus|school|graduate|intern|university|zhaopin|recruit|career|jobs|position|apply)(?:\/|\\?|$)/i.test(u), '招聘页', '校招')
  ];

  function matchRule(url) {
    return SITE_RULES.find((r) => r.test(url)) || null;
  }

  function isRecruitmentPage(url) {
    if (matchRule(url)) return true;
    const host = location.hostname + location.pathname + location.search;
    const title = document.title || '';
    const keywords = /campus|zhaopin|recruit|hire|career|position|apply|graduate|intern|校招|秋招|春招|网申|投递|测评|beisen|moka|mokahr|nowcoder|hotjob|join/i;
    return keywords.test(host) || keywords.test(title);
  }

  /** 职位列表 / 搜索页 — 浏览选岗，不自动记录 */
  function isListPage(url = location.href) {
    const path = (location.pathname || '').toLowerCase();
    const full = path + (location.search || '').toLowerCase();

    if (/\/(?:success|complete|confirm|done|sent|result|thank|thanks|submitted|finish)(?:\/|$|\?)/i.test(full)) {
      return false;
    }

    const bodyHead = (document.body?.innerText || '').slice(0, 1200);
    if (/投递成功|申请成功|提交成功|网申成功|已成功|感谢您的申请/.test(bodyHead)) return false;

    const listUrl =
      /\/(?:jobs|job-list|joblist|positions|position-list|positionlist|post-list|openings|vacancies|recruit-list|campus-list)(?:\/|$|\?)/i.test(full) ||
      /\/(?:jobs|positions|posts|openings|recruit|campus|zhaopin|job|position)(?:\/index)?(?:\/?$|\?)/i.test(full) ||
      /\/(?:list|search|category|categories|filter|browse|all|index)(?:\/|$|\?)/i.test(full) ||
      /\/offcampus(?:\/?$|\?)/i.test(full) ||
      /[?&](?:page|pageNo|pageNum|p|pn|offset)=\d+/i.test(full);

    if (listUrl) return true;

    const title = document.title || '';
    const h1 = textOf(document.querySelector('h1'));
    if (/职位列表|岗位列表|在招职位|全部职位|热招岗位|搜索结果|职位搜索|校招职位|职位概览|职位浏览|岗位浏览|招聘首页/.test(title + h1)) {
      return true;
    }

    const jobItems = document.querySelectorAll(
      [
        '[class*="job-item"]',
        '[class*="jobItem"]',
        '[class*="job-card"]',
        '[class*="jobCard"]',
        '[class*="position-item"]',
        '[class*="positionItem"]',
        '[class*="position-card"]',
        '[class*="post-item"]',
        '[class*="job-list"] > *',
        '[class*="jobList"] > *',
        '[class*="position-list"] > *',
        'tr[class*="job"]',
        'li[class*="job"]'
      ].join(', ')
    );
    if (jobItems.length >= 4) return true;

    const browseLinks = [...document.querySelectorAll('a, button')].filter((el) =>
      /查看详情|查看职位|职位详情|立即投递|投递简历|申请职位/.test(textOf(el))
    );
    if (browseLinks.length >= 5) return true;

    return false;
  }

  /** 详情 / 投递 / 成功 / 测评页 — 允许自动记录 */
  function isCapturePage(url = location.href) {
    if (isListPage(url)) return false;

    const path = (location.pathname || '').toLowerCase();
    const full = path + (location.search || '').toLowerCase();

    if (
      /\/(?:apply|application|submit|success|confirm|complete|done|sent|result|detail|view|preview|description|info|assessment|exam|test|evaluate|resume|form|questionnaire|survey|invite|delivery|thank|thanks|submitted|finished|finish)(?:\/|$|\?)/i.test(full) ||
      /[?&](?:job_?id|position_?id|post_?id|postid|jobid|positionid|id)=\w+/i.test(full) ||
      /\/(?:job|position|post|opening|role|campus|offcampus|graduate)\/[\w-]{3,}/i.test(full) ||
      /\/\d{4,}(?:\/|$|\?)/.test(path)
    ) {
      return true;
    }

    if (/beisen\.(com|cn)|nowcoder\.com|showmebug\.com/i.test(url)) return true;

    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      const ft = form.innerText || '';
      if (/上传简历|个人简历|基本信息|教育经历|工作经历|验证码/.test(ft)) return true;
    }

    return false;
  }

  function extractPageInfo(url = location.href) {
    const rule = matchRule(url);
    if (rule) {
      const data = rule.extract(url);
      const info = finalizeInfo(
        {
          company: data.company || '',
          position: data.position || '',
          platform: data.platform || rule.platform,
          defaultStatus: data.defaultStatus || '已投递',
          defaultNote: data.defaultNote || '',
          ruleId: rule.id,
          url
        },
        url,
        rule.id
      );
      return info;
    }

    if (!isRecruitmentPage(url)) {
      return {
        company: '',
        position: '',
        platform: '',
        defaultStatus: '已投递',
        defaultNote: '',
        ruleId: 'none',
        url,
        matchQuality: 0,
        extractionSources: []
      };
    }

    const base = mergeInfo(fromDom(), fromTitle(), fromMeta(), fromBodyPatterns());
    const info = finalizeInfo(
      {
        ...base,
        platform: '通用',
        defaultStatus: '已投递',
        defaultNote: '校招',
        ruleId: 'generic',
        url
      },
      url,
      'generic'
    );
    return info;
  }

  function detectAutoStatus(bodyText, rule) {
    const text = bodyText || document.body?.innerText || '';
    const url = location.href;

    if (isListPage(url)) return null;

    if (/nowcoder\.com/i.test(url) && /笔试|测评|考试|提交成功|已完成/i.test(text)) {
      return { status: '笔试', note: '牛客笔试/测评' };
    }
    if (/showmebug\.com/i.test(url)) {
      return { status: '测评', note: 'ShowMeBug测评' };
    }
    if (/beisen\.(com|cn)/i.test(url) && /测评|考试|能力测试|性格测试|开始作答/i.test(text + url)) {
      return { status: '测评', note: '北森测评' };
    }

    for (const kw of JobTrackerConstants.ASSESSMENT_KEYWORDS) {
      if (text.includes(kw)) {
        return { status: '测评', note: kw.includes('北森') ? '北森测评' : '在线测评' };
      }
    }
    for (const kw of JobTrackerConstants.SUCCESS_KEYWORDS) {
      if (text.includes(kw)) {
        const note = rule?.successNote || rule?.platform || '官网投递确认';
        return { status: '已投递', note: note.includes('成功') ? note : `${note}·投递成功` };
      }
    }
    if (rule?.detectSuccess?.(text)) {
      return { status: '已投递', note: rule.successNote || `${rule.platform}·投递成功` };
    }
    return null;
  }

  return { extractPageInfo, matchRule, isRecruitmentPage, isListPage, isCapturePage, detectAutoStatus, SITE_RULES };
})();
