/**
 * 离线逻辑测试（Node）。用法：node scripts/test-logic.mjs
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

if (typeof globalThis.MouseEvent === 'undefined') {
  globalThis.MouseEvent = class {
    constructor(type, opts = {}) {
      this.type = type;
      this.bubbles = opts.bubbles;
      this.cancelable = opts.cancelable;
      this.view = opts.view;
    }
  };
}

function loadLib(name) {
  const code = fs.readFileSync(path.join(root, 'lib', name), 'utf8');
  vm.runInThisContext(code, { filename: name });
}

function mockPage(url, { title = '', bodyText = '', html = '' }) {
  const u = new URL(url);
  const jobItemCount = (html.match(/data-job-item/g) || []).length;
  const linkCount = (html.match(/data-apply-link/g) || []).length;

  global.location = {
    href: url,
    hostname: u.hostname,
    pathname: u.pathname,
    search: u.search
  };
  global.document = {
    title,
    body: {
      innerText: bodyText,
      cloneNode() {
        return {
          querySelectorAll(sel) {
            if (sel.includes('script')) return [];
            return [];
          },
          innerText: bodyText
        };
      }
    },
    querySelector(sel) {
      if (sel === 'h1') return title ? { textContent: title, innerText: title } : null;
      if (sel.includes('success')) return null;
      if (sel.includes('detail') || sel === 'main') return bodyText ? { innerText: bodyText.slice(0, 500) } : null;
      if (sel.includes('og:title')) return null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel.includes('job-item') || sel.includes('jobItem')) {
        return Array.from({ length: jobItemCount }, (_, i) => ({ textContent: `job${i}` }));
      }
      if (sel.includes('job-list') || sel.includes('position-list')) {
        return Array.from({ length: jobItemCount }, (_, i) => ({ textContent: `job${i}` }));
      }
      if (sel === 'form') return [];
      if (sel.includes('ld+json')) return [];
      return [];
    }
  };

  const origQuery = global.document.querySelectorAll.bind(global.document);
  global.document.querySelectorAll = (sel) => {
    if (sel.includes('a, button') || sel === 'a, button') {
      return Array.from({ length: linkCount }, () => ({ textContent: '立即投递' }));
    }
    return origQuery(sel);
  };
}

loadLib('constants.js');
loadLib('text-utils.js');
loadLib('resume-storage.js');
loadLib('entity-resolution.js');
loadLib('fusion-scorer.js');
loadLib('confidence.js');
loadLib('extract-heuristics.js');
loadLib('extractors.js');
loadLib('field-mapping.js');
loadLib('field-matcher.js');
loadLib('resume-parser.js');
loadLib('resume-gap-analyzer.js');
loadLib('settings.js');
global.chrome = {
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {}
    },
    session: {
      _data: {},
      get: async (keys) => {
        if (typeof keys === 'string') return { [keys]: global.chrome.storage.session._data[keys] };
        return { ...global.chrome.storage.session._data };
      },
      set: async (obj) => {
        Object.assign(global.chrome.storage.session._data, obj);
      },
      remove: async (keys) => {
        delete global.chrome.storage.session._data[keys];
      }
    }
  }
};
loadLib('fill-session.js');
loadLib('fill-engine.js');
loadLib('dom-scanner.js');
loadLib('playwright-fill.js');
loadLib('form-section-context.js');
loadLib('ats-profiles.js');
loadLib('ai.js');

const cases = [
  {
    name: '阿里列表页 - 不捕获',
    url: 'https://talent.alibaba.com/campus/position-list?page=1',
    title: '校招职位列表',
    bodyText: 'AI产品经理 立即投递 查看详情',
    html: 'data-job-item data-job-item data-job-item data-apply-link data-apply-link data-apply-link data-apply-link',
    expect: { list: true, capture: false, auto: null }
  },
  {
    name: '阿里投递成功页 - 捕获',
    url: 'https://talent.alibaba.com/campus/apply/success?jobId=123',
    title: '投递成功 - AI产品经理 - 淘天集团',
    bodyText: '您的简历已成功投递至 AI产品经理 岗位。阿里校招 投递成功',
    expect: { list: false, capture: true, autoStatus: '已投递' }
  },
  {
    name: '京东详情页 - 可捕获页',
    url: 'https://zhaopin.jd.com/job/detail/12345',
    title: 'AI产品经理 - 京东校招',
    bodyText: '岗位描述 立即申请',
    expect: { list: false, capture: true }
  },
  {
    name: '北森测评页 - 测评',
    url: 'https://xxx.beisen.com/exam/abc',
    title: '在线测评',
    bodyText: '欢迎参加影石的在线测评 开始作答',
    expect: { list: false, capture: true, autoStatus: '测评' }
  },
  {
    name: '普通浏览页 - 非招聘',
    url: 'https://www.baidu.com/',
    title: '百度一下',
    bodyText: '搜索',
    expect: { recruit: false }
  },
  {
    name: '成功页含列表路径 - 不误判列表',
    url: 'https://talent.alibaba.com/campus/list/apply/success?jobId=123',
    title: '投递成功',
    bodyText: '您的简历已成功投递至 AI产品经理 岗位。投递成功',
    expect: { list: false, capture: true, autoStatus: '已投递' }
  }
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  mockPage(c.url, c);
  const list = JobTrackerExtractors.isListPage(c.url);
  const capture = JobTrackerExtractors.isCapturePage(c.url);
  const recruit = JobTrackerExtractors.isRecruitmentPage(c.url);
  const auto = JobTrackerExtractors.detectAutoStatus(c.bodyText, JobTrackerExtractors.matchRule(c.url));
  const info = JobTrackerExtractors.extractPageInfo(c.url);

  const errors = [];
  if (c.expect.list !== undefined && list !== c.expect.list) errors.push(`list=${list} want ${c.expect.list}`);
  if (c.expect.capture !== undefined && capture !== c.expect.capture) errors.push(`capture=${capture} want ${c.expect.capture}`);
  if (c.expect.recruit !== undefined && recruit !== c.expect.recruit) errors.push(`recruit=${recruit} want ${c.expect.recruit}`);
  if (c.expect.auto === null && auto !== null) errors.push(`auto should be null got ${JSON.stringify(auto)}`);
  if (c.expect.autoStatus && auto?.status !== c.expect.autoStatus) errors.push(`auto.status=${auto?.status} want ${c.expect.autoStatus}`);

  if (errors.length) {
    console.log(`❌ ${c.name}`);
    errors.forEach((e) => console.log('   ', e));
    failed++;
  } else {
    console.log(`✅ ${c.name}${info.platform ? ` [${info.platform}]` : ''}`);
    passed++;
  }
}

console.log('\n--- API Key 清洗 ---');
const keyCases = [
  {
    name: '正常 sk- Key',
    raw: 'sk-abcdefghijklmnopqrstuvwxyz123456',
    valid: true,
    key: 'sk-abcdefghijklmnopqrstuvwxyz123456'
  },
  {
    name: '首尾空格',
    raw: '  sk-abcdefghijklmnopqrstuvwxyz123456  ',
    valid: true,
    key: 'sk-abcdefghijklmnopqrstuvwxyz123456'
  },
  {
    name: '零宽字符',
    raw: 'sk-abc\u200Bdef\uFEFFghijklmnopqrstuvwxyz123456',
    valid: true,
    key: 'sk-abcdefghijklmnopqrstuvwxyz123456'
  },
  {
    name: '中文标点混入',
    raw: '「sk-abcdefghijklmnopqrstuvwxyz123456」',
    valid: true,
    key: 'sk-abcdefghijklmnopqrstuvwxyz123456'
  },
  {
    name: '纯中文',
    raw: '这是中文密钥',
    valid: false
  },
  {
    name: 'Key 后带中文说明（自动剥离）',
    raw: 'sk-abcdefghijklmnopqrstuvwxyz123456，请妥善保管',
    valid: true,
    key: 'sk-abcdefghijklmnopqrstuvwxyz123456',
    hadIllegalChars: true
  }
];

for (const kc of keyCases) {
  const v = JobTrackerSettings.validateApiKey(kc.raw);
  const ok =
    v.valid === kc.valid &&
    (kc.key == null || v.key === kc.key) &&
    (kc.hadIllegalChars == null || v.hadIllegalChars === kc.hadIllegalChars);
  if (ok) {
    console.log(`✅ ${kc.name}`);
    passed++;
  } else {
    console.log(`❌ ${kc.name} → valid=${v.valid} key=${v.key} err=${v.error}`);
    failed++;
  }
}

const asciiOk = JobTrackerSettings.isAsciiHeaderValue('sk-abcdefghijklmnopqrstuvwxyz123456');
console.log(asciiOk ? '✅ Authorization 值 ASCII 校验' : '❌ Authorization 值 ASCII 校验失败');
asciiOk ? passed++ : failed++;

console.log('\n--- Fusion Scorer ---');
const fusionCases = [
  {
    name: '规则齐全 + 成功关键词 → 高置信',
    record: { company: '淘天集团', position: 'AI产品经理', source: 'auto-detect' },
    ctx: {
      url: 'https://talent.alibaba.com/apply/success',
      title: '投递成功 - AI产品经理 - 淘天集团',
      text: '投递成功 简历已提交',
      ruleExtraction: { company: '淘天集团', position: 'AI产品经理', platform: '阿里校招', auto: { status: '已投递' } }
    },
    minConfidence: 80
  },
  {
    name: '缺公司 → 低置信',
    record: { company: '', position: 'AI产品经理', source: 'auto-detect' },
    ctx: {
      url: 'https://example.com/apply',
      title: '申请职位',
      text: '',
      ruleExtraction: { company: '', position: 'AI产品经理', platform: '通用' }
    },
    maxConfidence: 60
  }
];

for (const fc of fusionCases) {
  const result = JobTrackerFusionScorer.score(fc.record, fc.ctx);
  const ok =
    (fc.minConfidence == null || result.confidence >= fc.minConfidence) &&
    (fc.maxConfidence == null || result.confidence <= fc.maxConfidence) &&
    Array.isArray(result.signals) &&
    result.signals.length > 0;
  if (ok) {
    console.log(`✅ ${fc.name} → ${result.confidence}% (${result.signals.map((s) => s.name).join(', ')})`);
    passed++;
  } else {
    console.log(`❌ ${fc.name} → confidence=${result.confidence}`);
    failed++;
  }
}

console.log('\n--- Confidence Routing ---');
const successCtx = {
  url: 'https://talent.alibaba.com/apply/success',
  title: '投递成功 - AI产品经理 - 淘天集团',
  text: '投递成功 简历已提交 申请成功',
  ruleExtraction: {
    company: '淘天集团',
    position: 'AI产品经理',
    platform: '阿里校招',
    auto: { status: '已投递', note: '阿里校招·投递成功' }
  }
};
const successRecord = { company: '淘天集团', position: 'AI产品经理', source: 'auto-detect' };
const successFusion = JobTrackerFusionScorer.score(successRecord, successCtx);
const successConfirm = JobTrackerConfidence.shouldConfirm(successFusion.confidence, 'auto-detect', successCtx);
const successRouteOk = !successConfirm && successFusion.confidence >= JobTrackerConfidence.THRESHOLD;
console.log(
  successRouteOk
    ? `✅ 成功页公司+岗位+关键词 → 直接入库 (${successFusion.confidence}%)`
    : `❌ 成功页不应进待确认 confidence=${successFusion.confidence} confirm=${successConfirm}`
);
successRouteOk ? passed++ : failed++;

console.log('\n--- Capture Schedule ---');
const delays = JobTrackerConstants.CAPTURE_SUBMIT_DELAYS_MS;
const scheduleOk =
  Array.isArray(delays) &&
  delays.length === 2 &&
  delays[0] === 2800 &&
  delays[1] === 6000;
console.log(scheduleOk ? `✅ 提交后重试间隔 ${delays.join('ms / ')}ms` : '❌ 提交重试间隔配置错误');
scheduleOk ? passed++ : failed++;

console.log('\n--- Entity Resolution ---');
const dup = JobTrackerEntityResolution.isDuplicate(
  { company: '阿里巴巴集团控股有限公司', position: 'AI产品经理', applyDate: '2026-08-19' },
  { company: '阿里巴巴', position: 'AI 产品经理', applyDate: '2026-08-19' }
);
console.log(dup ? '✅ 公司别名去重识别' : '❌ 公司别名去重失败');
dup ? passed++ : failed++;

const mergedNote = JobTrackerEntityResolution.mergeNotes('阿里校招', '阿里校招·投递成功');
const noteOk = mergedNote.includes('投递成功');
console.log(noteOk ? `✅ 合并备注保留成功关键词: ${mergedNote}` : '❌ 合并备注丢失成功关键词');
noteOk ? passed++ : failed++;

console.log('\n--- Field Matcher ---');
const phoneMatch = JobTrackerFieldMatcher.matchLabel('手机号码', { type: 'tel', name: 'mobile' });
const phoneOk = phoneMatch.rule?.path === 'personalInfo.phone' && phoneMatch.score >= 0.52;
console.log(phoneOk ? `✅ 手机号字段匹配 score=${Math.round(phoneMatch.score * 100)}` : '❌ 手机号字段匹配失败');
phoneOk ? passed++ : failed++;

const skipMatch = JobTrackerFieldMatcher.matchLabel('验证码', {});
const skipOk = !skipMatch.rule && skipMatch.skipReason;
console.log(skipOk ? `✅ 无关字段跳过: ${skipMatch.skipReason}` : '❌ 无关字段应跳过');
skipOk ? passed++ : failed++;

console.log('\n--- Resume Parse Settings ---');
const defaultSettings = JobTrackerSettings.defaults.ai;
const defaultResumeParseOk = defaultSettings.resumeParse === true;
const defaultModeOk = defaultSettings.resumeParseMode === 'ai-first';
console.log(defaultResumeParseOk ? '✅ resumeParse 默认 true' : '❌ resumeParse 默认应为 true');
defaultResumeParseOk ? passed++ : failed++;
console.log(defaultModeOk ? '✅ resumeParseMode 默认 ai-first' : '❌ resumeParseMode 默认应为 ai-first');
defaultModeOk ? passed++ : failed++;
const modeNormOk =
  JobTrackerSettings.normalizeResumeParseMode('ai-first') === 'ai-first' &&
  JobTrackerSettings.normalizeResumeParseMode('bogus') === 'ai-first';
console.log(modeNormOk ? '✅ resumeParseMode 归一化' : '❌ resumeParseMode 归一化失败');
modeNormOk ? passed++ : failed++;

console.log('\n--- AI token 策略 ---');
const settings = { ai: { enabled: true, autoEnhance: false, apiKey: 'test', mode: 'fallback' } };
const fullRecord = { company: '淘天', position: 'AI产品经理', note: '阿里校招' };
const partialRecord = { company: '', position: 'AI产品经理', note: '校招' };
console.log('autoEnhance关 → 调AI:', JobTrackerAI.shouldUseAi(settings, partialRecord, 'auto-detect') ? '是' : '否（正确）');
if (!JobTrackerAI.shouldUseAi(settings, partialRecord, 'auto-detect')) passed++;
else failed++;

const settingsOn = { ai: { enabled: true, autoEnhance: true, apiKey: 'test', mode: 'fallback' } };
console.log('缺公司+autoEnhance → 调AI:', JobTrackerAI.shouldUseAi(settingsOn, partialRecord, 'auto-detect') ? '是（正确）' : '否');
if (JobTrackerAI.shouldUseAi(settingsOn, partialRecord, 'auto-detect')) passed++;
else failed++;
console.log('规则齐全 → 调AI:', JobTrackerAI.shouldUseAi(settingsOn, fullRecord, 'auto-detect') ? '是' : '否（省token）');
if (!JobTrackerAI.shouldUseAi(settingsOn, fullRecord, 'auto-detect')) passed++;
else failed++;

const prompt = JobTrackerAI.buildPrompt(
  JobTrackerAI.compactContext({
    url: 'https://talent.alibaba.com/apply/success',
    title: '投递成功-AI产品经理-淘天',
    text: '简历已成功投递'.repeat(20),
    ruleExtraction: { company: '', position: 'AI产品经理', platform: '阿里校招', auto: { status: '已投递' } }
  })
);
console.log('Prompt 长度:', prompt.length, '字符（约', Math.ceil(prompt.length / 2), 'input tokens）');

console.log('\n--- Resume Parse Mode ---');
const modeCases = [
  { in: 'ai-first', out: 'ai-first' },
  { in: 'ai-only', out: 'ai-only' },
  { in: 'local-only', out: 'local-only' },
  { in: '', out: 'ai-first' },
  { in: 'invalid', out: 'ai-first' }
];
for (const mc of modeCases) {
  const got = JobTrackerSettings.normalizeResumeParseMode(mc.in);
  if (got === mc.out) {
    console.log(`✅ normalizeResumeParseMode("${mc.in}") → ${got}`);
    passed++;
  } else {
    console.log(`❌ normalizeResumeParseMode("${mc.in}") → ${got} want ${mc.out}`);
    failed++;
  }
}

console.log('\n--- AI Resume Parse Prompt ---');
const longResumeText = '张三 清华大学 硕士 '.repeat(300);
const resumePrompt = JobTrackerAI.buildResumeParsePrompt(longResumeText);
const resumePromptOk =
  resumePrompt.includes('personalInfo') &&
  resumePrompt.includes('education') &&
  resumePrompt.includes('experience') &&
  resumePrompt.length <= JobTrackerAI.RESUME_PARSE_MAX_CHARS + 800;
console.log(resumePromptOk ? `✅ 简历解析 Prompt ${resumePrompt.length} 字符` : `❌ 简历解析 Prompt 异常 len=${resumePrompt.length}`);
resumePromptOk ? passed++ : failed++;

const normalizedAiResume = JobTrackerAI.normalizeResumeProfile({
  personalInfo: { name: '张三', phone: '13812345678' },
  education: [{ type: '硕士', school: '清华大学', major: '计算机' }],
  experience: [{ category: 'internship', organization: '字节跳动', role: '产品实习' }],
  special: { selfIntroduction: '热爱产品' }
});
const normOk =
  normalizedAiResume.personalInfo.name === '张三' &&
  normalizedAiResume.education.length === 1 &&
  normalizedAiResume.experience[0].category === 'internship';
console.log(normOk ? '✅ AI 简历结果规范化' : '❌ AI 简历结果规范化失败');
normOk ? passed++ : failed++;

console.log('\n--- Resume Parser ---');
const sampleResume = `张三
手机：13812345678
邮箱：zhangsan@example.com

教育经历
硕士 清华大学 计算机科学与技术 2023.09-2026.06 GPA 3.8
本科 浙江大学 软件工程 2019.09-2023.06

实习经历
字节跳动 产品经理实习 2024.06-2024.09`;

const parsed = JobTrackerResumeParser.parseText(sampleResume);
const phoneOk2 = parsed.personalInfo.phone === '13812345678';
const eduOk = parsed.education.length >= 2 &&
  parsed.education.some((e) => /硕士/.test(e.degree || e.type) && /清华/.test(e.school)) &&
  parsed.education.some((e) => /本科/.test(e.degree || e.type) && /浙江/.test(e.school));
console.log(phoneOk2 ? `✅ 解析手机号 ${parsed.personalInfo.phone}` : '❌ 手机号解析失败');
phoneOk2 ? passed++ : failed++;
console.log(eduOk ? `✅ 解析本科+硕士 ${parsed.education.length} 段` : `❌ 学历解析失败: ${JSON.stringify(parsed.education)}`);
eduOk ? passed++ : failed++;

const majorSample = `教育经历
硕士 清华大学 计算机科学与技术 2023.09-2026.06
本科 浙江大学 软件工程 2019.09-2023.06`;
const majorParsed = JobTrackerResumeParser.parseText(majorSample);
const masterEdu = majorParsed.education.find((e) => /硕士/.test(e.degree || e.type));
const majorOk = masterEdu && masterEdu.major === '计算机科学与技术' && !/硕士/.test(masterEdu.major);
console.log(
  majorOk
    ? `✅ 专业不含学历词 major="${masterEdu.major}"`
    : `❌ 专业解析含学历词: ${JSON.stringify(masterEdu)}`
);
majorOk ? passed++ : failed++;

const dateSample = `教育经历
硕士 复旦大学 金融学 2023年9月-2026年6月`;
const dateParsed = JobTrackerResumeParser.parseText(dateSample);
const dateEdu = dateParsed.education[0];
const dateOk = dateEdu?.startDate === '2023/09' && dateEdu?.endDate === '2026/06';
console.log(dateOk ? `✅ 日期归一化 ${dateEdu.startDate}-${dateEdu.endDate}` : `❌ 日期归一化失败: ${JSON.stringify(dateEdu)}`);
dateOk ? passed++ : failed++;

const tabSample = `教育经历
清华大学\t计算机科学与技术\t硕士\t2023.09-2026.06`;
const tabParsed = JobTrackerResumeParser.parseText(tabSample);
const tabOk = tabParsed.education.some((e) => /清华/.test(e.school) && e.major === '计算机科学与技术');
console.log(tabOk ? '✅ Tab 分隔行解析' : `❌ Tab 分隔行解析失败: ${JSON.stringify(tabParsed.education)}`);
tabOk ? passed++ : failed++;

const headSample = `张三
13812345678
zhangsan@example.com

教育经历
硕士 北京大学 法学 2023.09-2026.06`;
const headParsed = JobTrackerResumeParser.parseText(headSample);
const headOk = headParsed.personalInfo.name === '张三' &&
  headParsed.personalInfo.phone === '13812345678' &&
  headParsed.personalInfo.email === 'zhangsan@example.com';
console.log(headOk ? '✅ 前5行优先提取联系信息' : `❌ 联系信息提取失败: ${JSON.stringify(headParsed.personalInfo)}`);
headOk ? passed++ : failed++;

const mergeDiff = JobTrackerResumeParser.buildMergeDiff(
  { personalInfo: { name: '张三' }, education: [{ school: '清华大学', degree: '硕士' }], experience: [] },
  { personalInfo: { name: '张三', phone: '13800000000' }, education: [{ school: '浙江大学', degree: '本科' }], experience: [{ category: 'internship', organization: '字节跳动' }] }
);
const mergeSummary = JobTrackerResumeParser.formatMergeSummary(mergeDiff);
const mergeOk = mergeDiff.education.length === 1 && mergeDiff.experience.length === 1 && mergeSummary.includes('段教育');
console.log(mergeOk ? `✅ 合并预览 ${mergeSummary}` : `❌ 合并预览失败: ${mergeSummary}`);
mergeOk ? passed++ : failed++;

const multiExpSample = `实习经历
字节跳动 产品经理实习生 2024/06 - 2024/09
腾讯 产品策划 2023/06 - 2023/09

项目经历
校招助手 Chrome插件 2024/01 - 2024/05
独立开发浏览器扩展`;
const multiParsed = JobTrackerResumeParser.parseText(multiExpSample);
const multiExpOk =
  multiParsed.experience.length >= 3 &&
  multiParsed.experience.filter((x) => x.category === 'internship').length >= 2 &&
  multiParsed.experience.some((x) => x.category === 'project' && /校招/.test(x.organization || ''));
console.log(
  multiExpOk
    ? `✅ 多段实习+项目解析 ${multiParsed.experience.length} 段`
    : `❌ 多经历解析失败: ${JSON.stringify(multiParsed.experience.map((x) => x.category + ':' + x.organization))}`
);
multiExpOk ? passed++ : failed++;

const messyResume = `李四　　１３８００１３８０００
ｚｈａｎｇｓｉ@example.com

硕士　复旦大学　金融学　２０２３．０９—２０２６．０６
本科　武汉大学　经济学　２０１９－２０２３`;
const messyParsed = JobTrackerResumeParser.parseText(messyResume);
const messyOk =
  messyParsed.personalInfo.phone === '13800138000' &&
  messyParsed.personalInfo.email === 'zhangsi@example.com' &&
  messyParsed.education.length >= 2;
console.log(messyOk ? '✅ 全角/混合格式解析' : `❌ 乱格式解析失败 ${JSON.stringify(messyParsed.personalInfo)}`);
messyOk ? passed++ : failed++;

const noHeaderResume = `王五 13900001111 wang@qq.com
2019.09-2023.06 本科 华中科技大学 计算机科学
2023.09-2026.06 硕士 清华大学 软件工程
2024.06-2024.09 阿里巴巴 产品实习生`;
const noHeaderParsed = JobTrackerResumeParser.parseText(noHeaderResume);
const noHeaderOk =
  noHeaderParsed.education.length >= 2 &&
  noHeaderParsed.experience.length >= 1 &&
  /阿里/.test(noHeaderParsed.experience[0]?.organization || '');
console.log(
  noHeaderOk
    ? `✅ 无标题推断 ${noHeaderParsed.education.length} 教育 ${noHeaderParsed.experience.length} 经历`
    : `❌ 无标题推断失败`
);
noHeaderOk ? passed++ : failed++;

const fullResult = JobTrackerResumeParser.parse(sampleResume);
const statsOk = fullResult.stats.educationCount >= 2 && fullResult.stats.experienceCount >= 1;
console.log(statsOk ? `✅ 解析统计 stats=${JSON.stringify(fullResult.stats)}` : '❌ 解析统计失败');
statsOk ? passed++ : failed++;

const migrated = JobTrackerResumeStorage.migrateProfile({
  education: { school: '复旦大学', type: '本科', major: '经济学' }
});
const migrateOk = Array.isArray(migrated.education) && migrated.education[0].school === '复旦大学' && migrated.education[0].type === '本科';
console.log(migrateOk ? '✅ 旧版单条学历迁移' : '❌ 学历迁移失败');
migrateOk ? passed++ : failed++;

const profile = {
  education: [
    { type: '硕士', school: '清华大学', major: '计算机' },
    { type: '本科', school: '浙江大学', major: '软件工程' }
  ]
};
const masterSchool = JobTrackerFieldMapping.getValueForRule(profile, { path: 'education@master.school', section: 'education' }, '硕士院校');
const bachelorSchool = JobTrackerFieldMapping.getValueForRule(profile, { path: 'education@bachelor.school', section: 'education' }, '本科院校');
const mappingOk = masterSchool === '清华大学' && bachelorSchool === '浙江大学';
console.log(mappingOk ? `✅ 硕/本字段映射 ${masterSchool}/${bachelorSchool}` : '❌ 硕本映射失败');
mappingOk ? passed++ : failed++;

const masterMatch = JobTrackerFieldMatcher.matchLabel('硕士院校', {});
const masterMatchOk = masterMatch.rule?.path === 'education@master.school';
console.log(masterMatchOk ? '✅ 硕士院校标签匹配' : '❌ 硕士院校标签匹配失败');
masterMatchOk ? passed++ : failed++;

const expProfile = JobTrackerResumeStorage.migrateProfile({
  experience: [
    { category: 'internship', organization: '字节跳动', role: '产品实习生' },
    { category: 'internship', organization: '腾讯', role: '产品策划' },
    { category: 'project', organization: '校招助手', role: '开发者' }
  ]
});
const secondIntern = JobTrackerFieldMapping.getValueForRule(
  expProfile,
  { path: 'experience.organization', section: 'experience', category: 'internship' },
  '第二段实习公司'
);
const projectName = JobTrackerFieldMapping.getValueForRule(
  expProfile,
  { path: 'experience.organization', section: 'experience', category: 'project' },
  '项目名称'
);
const expMapOk = secondIntern === '腾讯' && projectName === '校招助手';
console.log(expMapOk ? `✅ 二段实习=${secondIntern} 项目=${projectName}` : `❌ 经历映射失败 intern2=${secondIntern} project=${projectName}`);
expMapOk ? passed++ : failed++;

const bydProfile = {
  personalInfo: { graduationYear: '' },
  education: [
    { type: '硕士研究生', school: '上海大学', major: '管理科学与工程', startDate: '2024-09', endDate: '2027-05', trainingMode: '全国普通高等院校全日制' },
    { type: '本科', school: '深圳大学', major: '工商管理', startDate: '2020-09', endDate: '2024-06', trainingMode: '全国普通高等院校全日制' }
  ],
  experience: [
    { category: 'internship', organization: '携程计算机技术（上海）有限公司', role: '产品实习生', startDate: '2025-12', endDate: '' },
    { category: 'internship', organization: '博世中国投资有限公司', role: '产品实习生', startDate: '2025-06', endDate: '2025-12' }
  ]
};
const eduCtx1 = { sectionTitle: '教育经历-1', blockIndex: 0, dateRangeIndex: 0 };
const eduCtx2 = { sectionTitle: '教育经历-2', blockIndex: 1, dateRangeIndex: 0 };
const bydEdu1 = JobTrackerFieldMapping.getValueForRule(
  bydProfile,
  { path: 'education.school', section: 'education' },
  '教育经历-1·毕业学校',
  eduCtx1
);
const bydEdu2 = JobTrackerFieldMapping.getValueForRule(
  bydProfile,
  { path: 'education.school', section: 'education' },
  '教育经历-2·毕业学校',
  eduCtx2
);
const bydDegree2 = JobTrackerFieldMapping.getValueForRule(
  bydProfile,
  { path: 'education.type', section: 'education' },
  '教育经历-2·学历',
  eduCtx2
);
const bydExpCtx1 = { sectionTitle: '工作/实习经历-1', blockIndex: 0, category: 'internship' };
const bydExp1 = JobTrackerFieldMapping.getValueForRule(
  bydProfile,
  { path: 'experience.organization', section: 'experience', category: 'internship' },
  '工作/实习经历-1·公司/单位名称',
  bydExpCtx1
);
const bydExpCtx2 = { sectionTitle: '工作/实习经历-2', blockIndex: 1, category: 'internship' };
const bydExp2 = JobTrackerFieldMapping.getValueForRule(
  bydProfile,
  { path: 'experience.organization', section: 'experience', category: 'internship' },
  '工作/实习经历-2·公司/单位名称',
  bydExpCtx2
);
const bydDates1 = JobTrackerFieldMapping.getRangeDates(bydProfile, eduCtx1);
const bydDates2 = JobTrackerFieldMapping.getRangeDates(bydProfile, eduCtx2);
const eduCtx2NoTitle = { section: 'education', blockIndex: 1, dateRangeIndex: 0 };
const bydDates2NoTitle = JobTrackerFieldMapping.getRangeDates(bydProfile, eduCtx2NoTitle);
const bydDateEnd = bydDates1.end;
const bydGradYear = JobTrackerFieldMapping.getValueForRule(
  bydProfile,
  { path: 'personalInfo.graduationYear' },
  '应届生届别'
);
const bydOk =
  bydEdu1 === '深圳大学' &&
  bydEdu2 === '上海大学' &&
  bydDegree2 === '硕士' &&
  bydExp1.includes('携程') &&
  bydExp2.includes('博世') &&
  bydDates1.start === '2020-09' &&
  bydDateEnd === '2024-06' &&
  bydDates2.start === '2024-09' &&
  bydDates2.end === '2027-05' &&
  bydDates2NoTitle.start === '2020-09' &&
  bydDates2NoTitle.end === '2024-06' &&
  bydGradYear === '2027';
console.log(
  bydOk
    ? `✅ 比亚迪区块映射 本=${bydEdu1} 硕=${bydEdu2} 日期=${bydDates1.start}~${bydDateEnd}/${bydDates2.start}~${bydDates2.end}`
    : `❌ 比亚迪映射失败 edu1=${bydEdu1} edu2=${bydEdu2} deg=${bydDegree2} exp1=${bydExp1} exp2=${bydExp2} d1=${bydDates1.start}~${bydDateEnd} d2=${bydDates2.start}~${bydDates2.end} d2nt=${bydDates2NoTitle.start}~${bydDates2NoTitle.end} year=${bydGradYear}`
);
bydOk ? passed++ : failed++;

const geelyUrl = 'https://campus.geely.com/campus-recruitment/geely/78436?locale=zh-CN#/job/44b5ec60-f4ed-4738-8005-582a07c0b08c/apply';
const geelyAts = JobTrackerATS.detect(geelyUrl);
const geelyAtsOk = geelyAts?.name === '吉利校招';
console.log(geelyAtsOk ? `✅ 吉利 ATS 识别 ${geelyAts.name}` : `❌ 吉利 ATS 识别失败 ${geelyAts?.name}`);
geelyAtsOk ? passed++ : failed++;

const bydUrl = 'https://job.byd.com/campus/apply';
const prevQuerySelector = global.document.querySelector;
global.document.querySelector = (sel) => {
  if (sel.includes('apply-form') || sel.includes('campus-recruitment')) return { matched: true };
  return prevQuerySelector(sel);
};
const bydAts = JobTrackerATS.detect(bydUrl);
global.document.querySelector = prevQuerySelector;
const bydAtsOk = bydAts?.name === '比亚迪校招' && bydAts.loadDelay === 2800 && bydAts.localSweepRounds === 2;
console.log(
  bydAtsOk
    ? `✅ 比亚迪 URL 优先于吉利 DOM ${bydAts.name} delay=${bydAts.loadDelay}`
    : `❌ 比亚迪 ATS 误识别 name=${bydAts?.name} delay=${bydAts?.loadDelay}`
);
bydAtsOk ? passed++ : failed++;

const geelyMerged = JobTrackerATS._withGenericDefaults({ name: '智联', urlPatterns: [/\.zhaopin\.com/i], loadDelay: 1000 });
const mergeLeakOk = !geelyMerged.domSelectors && geelyMerged.formSelectors && geelyMerged.loadDelay === 1000;
console.log(mergeLeakOk ? '✅ 通用默认不泄漏 domSelectors' : `❌ 通用默认泄漏 dom=${JSON.stringify(geelyMerged.domSelectors)}`);
mergeLeakOk ? passed++ : failed++;

const unknownCampusUrl = 'https://campus.unknown-corp.com/recruitment/apply?id=99';
const unknownAts = JobTrackerATS.detect(unknownCampusUrl);
const unknownAtsOk =
  unknownAts?.name === '通用' &&
  !!unknownAts?.formSelectors &&
  unknownAts.localSweepRounds >= 3 &&
  unknownAts.agentRounds >= 3 &&
  Array.isArray(unknownAts.multiPassDelays) &&
  unknownAts.multiPassDelays.length >= 3;
console.log(
  unknownAtsOk
    ? `✅ 未知校招 URL 通用 ATS ${unknownAts.name} sweep=${unknownAts.localSweepRounds}`
    : `❌ 未知校招 ATS 失败 name=${unknownAts?.name} sweep=${unknownAts?.localSweepRounds}`
);
unknownAtsOk ? passed++ : failed++;

const chronoNumbered = JobTrackerFieldMapping.shouldUseEducationChronological({ sectionTitle: '教育经历-2' });
const chronoBackground = JobTrackerFieldMapping.shouldUseEducationChronological({
  sectionTitle: '教育背景',
  section: 'education',
  blockIndex: 0
});
const chronoBare = JobTrackerFieldMapping.shouldUseEducationChronological({ section: 'education', blockIndex: 1 });
const chronoOk = chronoNumbered && !chronoBackground && !chronoBare;
console.log(
  chronoOk
    ? '✅ 教育排序启发式 编号=chrono 背景=数组'
    : `❌ 教育排序启发式 numbered=${chronoNumbered} background=${chronoBackground} bare=${chronoBare}`
);
chronoOk ? passed++ : failed++;

const geelyProfile = JobTrackerResumeStorage.normalizeProfile({
  personalInfo: {
    name: '邱井晨',
    idNumber: '44028120020619841X',
    idType: '身份证',
    country: '中国',
    nativePlacePath: '广东省/韶关市/乐昌市'
  },
  education: [
    {
      type: '硕士研究生',
      school: '上海大学',
      major: '管理科学与工程',
      ranking: '前5%',
      trainingMode: '全国普通高等院校全日制',
      startDate: '2024-09',
      endDate: '2027-05'
    },
    {
      type: '本科',
      school: '深圳大学',
      major: '工商管理',
      ranking: '前3%',
      trainingMode: '全国普通高等院校全日制',
      startDate: '2020-09',
      endDate: '2024-06'
    }
  ],
  languages: [{ language: '英语', level: 'IELTS（雅思）', speaking: '熟练', reading: '熟练' }],
  awards: [{ name: '深圳大学优秀毕业生' }],
  certificates: [{ name: '雅思' }],
  special: { selfIntroduction: 'AI产品经理，雅思7分' }
});
const geelyEduCtx1 = { section: 'education', sectionTitle: '教育背景', blockIndex: 0 };
const geelyEduCtx2 = { section: 'education', sectionTitle: '教育背景', blockIndex: 1 };
const geelyId = JobTrackerFieldMapping.getValueForRule(geelyProfile, JobTrackerFieldMatcher.matchLabel('证件号码').rule, '证件号码');
const geelyCountry = JobTrackerFieldMapping.getValueForRule(geelyProfile, JobTrackerFieldMatcher.matchLabel('国家/地区').rule, '国家/地区');
const geelyNative = JobTrackerFieldMapping.getValueForRule(geelyProfile, JobTrackerFieldMatcher.matchLabel('籍贯').rule, '籍贯');
const geelyLang = JobTrackerFieldMapping.getValueForRule(geelyProfile, JobTrackerFieldMatcher.matchLabel('英语水平').rule, '英语水平');
const geelyDegreeType1 = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('学历类型').rule,
  '学历类型',
  geelyEduCtx1
);
const geelyRanking1 = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('成绩排名').rule,
  '成绩排名',
  geelyEduCtx1
);
const geelySchoolCountry = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('学校所在国家/地区').rule,
  '学校所在国家/地区',
  geelyEduCtx1
);
const geelyFullTime = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('是否全日制').rule,
  '是否全日制',
  geelyEduCtx1
);
const geelyRelative = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('是否有亲属在吉利控股集团任职').rule,
  '是否有亲属在吉利控股集团任职'
);
const geelyTransfer = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('是否服从调配').rule,
  '是否服从调配'
);
const geelySpeaking = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('听说能力').rule,
  '听说能力'
);
const geelyReading = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('读写能力').rule,
  '读写能力'
);
const geelyCert = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('技能证书').rule,
  '技能证书'
);
const geelyAward = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('获奖名称').rule,
  '获奖名称'
);
const geelySelf = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('自我评价').rule,
  '自我评价'
);
const geelyRanking2 = JobTrackerFieldMapping.getValueForRule(
  geelyProfile,
  JobTrackerFieldMatcher.matchLabel('成绩排名').rule,
  '成绩排名',
  geelyEduCtx2
);
const geelyOk =
  geelyId === '44028120020619841X' &&
  geelyCountry === '中国' &&
  geelyNative === '广东省/韶关市/乐昌市' &&
  geelyLang === 'IELTS（雅思）' &&
  geelyDegreeType1 === '普通高等教育' &&
  geelyRanking1 === '前5%' &&
  geelyRanking2 === '前3%' &&
  geelySchoolCountry === '中国' &&
  geelyFullTime === '是' &&
  geelyRelative === '否' &&
  geelyTransfer === '是' &&
  geelySpeaking === '熟练' &&
  geelyReading === '熟练' &&
  geelyCert === '雅思' &&
  geelyAward === '深圳大学优秀毕业生' &&
  geelySelf.includes('AI产品经理');
console.log(
  geelyOk
    ? `✅ 吉利字段映射 id=${geelyId} 学历类型=${geelyDegreeType1} 排名=${geelyRanking1}/${geelyRanking2}`
    : `❌ 吉利映射失败 id=${geelyId} country=${geelyCountry} native=${geelyNative} lang=${geelyLang} deg=${geelyDegreeType1} rank=${geelyRanking1}/${geelyRanking2} schoolC=${geelySchoolCountry} ft=${geelyFullTime} rel=${geelyRelative} xfer=${geelyTransfer} speak=${geelySpeaking} read=${geelyReading} cert=${geelyCert} award=${geelyAward} self=${geelySelf?.slice(0, 20)}`
);
geelyOk ? passed++ : failed++;

const edu1Dates = JobTrackerFieldMapping.getRangeDates(bydProfile, eduCtx1);
const edu2Dates = JobTrackerFieldMapping.getRangeDates(bydProfile, eduCtx2);
const eduDatesOk =
  edu1Dates.start === '2020-09' && edu1Dates.end === '2024-06' &&
  edu2Dates.start === '2024-09' && edu2Dates.end === '2027-05';
console.log(
  eduDatesOk
    ? `✅ 教育区块日期 edu1=${edu1Dates.start}~${edu1Dates.end} edu2=${edu2Dates.start}~${edu2Dates.end}`
    : `❌ 教育区块日期失败 edu1=${JSON.stringify(edu1Dates)} edu2=${JSON.stringify(edu2Dates)}`
);
eduDatesOk ? passed++ : failed++;

const exp1Dates = JobTrackerFieldMapping.getRangeDates(bydProfile, { ...bydExpCtx1, section: 'experience' });
const exp2Dates = JobTrackerFieldMapping.getRangeDates(bydProfile, { ...bydExpCtx2, section: 'experience' });
const expDatesOk =
  exp1Dates.start === '2025-12' && exp2Dates.start === '2025-06' &&
  exp1Dates.end === '至今' && exp2Dates.end === '2025-12';
console.log(
  expDatesOk
    ? `✅ 实习区块日期 exp1=${exp1Dates.start}~${exp1Dates.end} exp2=${exp2Dates.start}~${exp2Dates.end}`
    : `❌ 实习区块日期失败 exp1=${JSON.stringify(exp1Dates)} exp2=${JSON.stringify(exp2Dates)}`
);
expDatesOk ? passed++ : failed++;

const mismatchCtx = {
  section: 'experience',
  sectionTitle: '工作/实习经历-2',
  blockIndex: 1,
  category: 'internship',
  blockAnchorName: '携程计算机技术'
};
const mismatchDates = JobTrackerFieldMapping.getRangeDates(bydProfile, mismatchCtx);
const mismatchOk = mismatchDates.start === '2025-12';
console.log(
  mismatchOk
    ? `✅ 锚点纠错 blockIndex=1+携程 → ${mismatchDates.start}`
    : `❌ 锚点纠错失败 start=${mismatchDates.start} want 2025-12`
);
mismatchOk ? passed++ : failed++;

const workProfile = {
  experience: [
    { category: 'work', organization: '华为技术有限公司', role: '产品经理', startDate: '2024-07', endDate: '2025-06' },
    { category: 'work', organization: '阿里巴巴集团', role: '高级产品经理', startDate: '2025-07', endDate: '' }
  ]
};
const workCtx1 = { section: 'experience', sectionTitle: '工作经历-1', blockIndex: 0, category: 'work' };
const workCtx2 = { section: 'experience', sectionTitle: '工作经历-2', blockIndex: 1, category: 'work' };
const work1 = JobTrackerFieldMapping.getValueForRule(
  workProfile,
  { path: 'experience.organization', section: 'experience', category: 'work' },
  '工作经历-1·公司',
  workCtx1
);
const work2 = JobTrackerFieldMapping.getValueForRule(
  workProfile,
  { path: 'experience.role', section: 'experience', category: 'work' },
  '工作经历-2·职位',
  workCtx2
);
const workDates2 = JobTrackerFieldMapping.getRangeDates(workProfile, workCtx2);
const workOk = work1.includes('华为') && work2.includes('高级产品') && workDates2.start === '2025-07';
console.log(workOk ? `✅ 工作经历区块 ${work1.slice(0, 4)}… / ${work2}` : `❌ 工作经历区块失败 org=${work1} role=${work2}`);
workOk ? passed++ : failed++;

const ageVal = JobTrackerFieldMapping.computeAge('2002-06-19');
const staticNo = JobTrackerFieldMapping.getStaticDefault({ personalInfo: {} }, '是否境外教育', '是否境外教育', null);
const ageOk = parseInt(ageVal, 10) >= 20 && staticNo === '否';
console.log(ageOk ? `✅ 静态默认 年龄=${ageVal} 境外=${staticNo}` : `❌ 静态默认失败 age=${ageVal} no=${staticNo}`);
ageOk ? passed++ : failed++;

const numberedHit = JobTrackerFormSection.matchNumberedSection('教育经历-1学历请选择');
const numberedOk = numberedHit?.blockIndex === 0 && numberedHit?.sectionTitle === '教育经历-1';
console.log(numberedOk ? '✅ 编号区块标题解析' : `❌ 编号区块解析失败 ${JSON.stringify(numberedHit)}`);
numberedOk ? passed++ : failed++;

const pwNorm = JobTrackerPlaywrightFill.normLabel('Start - End Time');
const pwNormOk = pwNorm.includes('start') && pwNorm.includes('end');
console.log(pwNormOk ? '✅ Playwright getByLabel 归一化' : `❌ Playwright 归一化 ${pwNorm}`);
pwNormOk ? passed++ : failed++;

const mockInput = {
  id: 'user-email',
  tagName: 'INPUT',
  type: 'email',
  getAttribute(k) {
    if (k === 'aria-label') return 'Email Address';
    if (k === 'placeholder') return 'Enter email';
    return null;
  },
  closest() { return null; },
  previousElementSibling: null
};
document.getElementById = () => null;
document.querySelector = (sel) => (sel.includes('label[for') ? { textContent: 'Email Address' } : null);
const det = JobTrackerDomScanner.extractLabel(mockInput);
const scanOk = det.label === 'Email Address' && det.confidence >= 0.9;
console.log(scanOk ? `✅ DomScanner 标签提取 ${det.label}` : `❌ DomScanner 失败 ${JSON.stringify(det)}`);
scanOk ? passed++ : failed++;

const sidebar = JobTrackerResumeStorage.buildSidebarGroups(expProfile);
const sidebarOk = sidebar.some((g) => g.items.some((i) => /实习·字节/.test(i.label)));
console.log(sidebarOk ? '✅ 侧边栏含「实习·字节」标签' : '❌ 侧边栏标签失败');
sidebarOk ? passed++ : failed++;

console.log('\n--- Fill Session ---');
(async () => {
  await JobTrackerFillSession.clear();
  const session = await JobTrackerFillSession.ensureSession({
    url: 'https://job.example.com/apply',
    company: '字节跳动',
    position: '产品经理',
    resumeVersionId: 'v-ai',
    resumeVersionName: 'AI专版'
  });
  const sessionOk = session?.id && session.resumeVersionName === 'AI专版';
  console.log(sessionOk ? '✅ 创建填表会话' : '❌ 创建填表会话失败');
  sessionOk ? passed++ : failed++;

  await JobTrackerFillSession.trackBulk([{ label: '手机号' }, { label: '邮箱' }]);
  const updated = await JobTrackerFillSession.get();
  const trackOk = updated.filledFieldCount === 2;
  console.log(trackOk ? `✅ 追踪已填 ${updated.filledFieldCount} 字段` : '❌ 字段追踪失败');
  trackOk ? passed++ : failed++;

  const merged = JobTrackerFillSession.mergeIntoRecord(
    { company: '字节跳动', position: '产品经理', url: session.url, status: '已投递' },
    updated
  );
  const mergeOk = merged.resumeVersion === 'AI专版' && merged.filledFieldCount === 2 && merged.fillSessionId;
  console.log(mergeOk ? '✅ 填表会话合并到记录' : '❌ 填表会话合并失败');
  mergeOk ? passed++ : failed++;

  const built = JobTrackerFillSession.buildRecordFromSession(updated, { source: 'mark-filled' });
  const buildOk = built?.status === '已填表' && built.resumeVersion === 'AI专版';
  console.log(buildOk ? '✅ 标记已填表记录构建' : '❌ 标记已填表记录构建失败');
  buildOk ? passed++ : failed++;

  loadLib('export.js');
  const tsv = JobTrackerExport.toTSV([{ company: '阿里', position: 'PM', status: '已填表', fillStatus: '已填表', resumeVersion: '通用版', resumeVersionId: 'v1', filledFieldCount: 8 }]);
  const exportOk = tsv.includes('填表状态') && tsv.includes('已填字段数');
  console.log(exportOk ? '✅ 导出含新列' : '❌ 导出格式不完整');
  exportOk ? passed++ : failed++;

  const scored = JobTrackerAI.scoreVersionLocal('AI产品经理 深度学习', [
    { id: '1', name: '通用版' },
    { id: '2', name: 'AI专版' }
  ]);
  const suggestOk = scored[0]?.name === 'AI专版';
  console.log(suggestOk ? `✅ 本地推荐 ${scored[0].name}` : '❌ 本地版本推荐失败');
  suggestOk ? passed++ : failed++;

  const extProfile = JobTrackerResumeStorage.normalizeProfile({
    personalInfo: { name: '邱井晨', qq: '1067842447', emergencyContactName: '邱锦河' },
    jobIntent: { expectedSalary: '15000' },
    awards: [{ name: '优秀毕业生' }],
    languages: [{ language: '英语', score: '7' }],
    computerSkills: [{ name: '数据分析', proficiency: '熟练' }],
    certificates: [{ name: '雅思', description: '7分' }],
    family: [{ name: '邱锦河', relation: '父亲' }],
    special: { hobbies: '乒乓球' }
  });
  const extOk =
    extProfile.personalInfo.qq === '1067842447' &&
    extProfile.jobIntent.expectedSalary === '15000' &&
    extProfile.awards.length === 1 &&
    extProfile.sidebarGroups.some((g) => g.group === '外语能力') &&
    JobTrackerFieldMapping.getValue(extProfile, 'languages.score', '外语成绩') === '7' &&
    JobTrackerFieldMapping.getValue(extProfile, 'special.hobbies', '兴趣爱好') === '乒乓球';
  console.log(extOk ? '✅ 扩展简历 schema 与字段映射' : '❌ 扩展简历 schema 失败');
  extOk ? passed++ : failed++;

  const sparseProfile = JobTrackerResumeStorage.normalizeProfile({ personalInfo: { name: '李四' } });
  const gaps = JobTrackerResumeGapAnalyzer.analyze(sparseProfile);
  const gapOk = gaps.some((g) => g.path === 'personalInfo.phone') && gaps.some((g) => g.path === 'personalInfo.email');
  console.log(gapOk ? `✅ 缺口追问 ${gaps.length} 项` : '❌ 缺口分析失败');
  gapOk ? passed++ : failed++;

  const filled = JobTrackerResumeGapAnalyzer.applyAnswers(sparseProfile, [
    { path: 'personalInfo.phone', value: '13800138000' },
    { path: 'jobIntent.expectedSalary', value: '15000' }
  ]);
  const fillOk = filled.personalInfo.phone === '13800138000' && filled.jobIntent.expectedSalary === '15000';
  console.log(fillOk ? '✅ 追问答案合并' : '❌ 追问答案合并失败');
  fillOk ? passed++ : failed++;

  const dateNormOk =
    JobTrackerFillEngine.normalizeDateValue('2024-09') === '2024-09-01' &&
    JobTrackerFillEngine.normalizeDateValue('2002-06-19') === '2002-06-19';
  console.log(dateNormOk ? '✅ 日期格式归一化' : '❌ 日期格式归一化失败');
  dateNormOk ? passed++ : failed++;

  const optScoreOk =
    JobTrackerFillEngine.scoreOptionMatch('广东省', '广东省') === 1 &&
    JobTrackerFillEngine.scoreOptionMatch('广东', '广东省') >= 0.88 &&
    JobTrackerFillEngine.scoreOptionMatch('前5%', '前5%') >= 0.9;
  console.log(optScoreOk ? '✅ 下拉选项模糊匹配' : '❌ 下拉选项匹配失败');
  optScoreOk ? passed++ : failed++;

  const pickMock = {
    closest: () => null,
    classList: { contains: () => false },
    getAttribute: (k) => (k === 'title' ? '上海市' : null),
    textContent: '上海市',
    scrollIntoView: () => {}
  };
  const picked = JobTrackerFillEngine.pickBestOption([pickMock], '上海');
  const pickOk = picked === pickMock;
  console.log(pickOk ? '✅ pickBestOption 模糊命中' : '❌ pickBestOption 失败');
  pickOk ? passed++ : failed++;

  const collapseHeader = {
    textContent: '教育经历',
    getBoundingClientRect: () => ({ width: 100, height: 24 }),
    closest: () => null,
    dispatchEvent: () => true
  };
  const collapseDoc = {
    querySelectorAll(sel) {
      if (sel.includes('el-collapse-item')) return [collapseHeader];
      return [];
    }
  };
  global.window = { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  const expanded = await JobTrackerFillEngine.expandCollapsedSections(collapseDoc, null, 5);
  const expandOk = expanded >= 1;
  console.log(expandOk ? '✅ 折叠区块展开点击' : `❌ 折叠展开失败 clicks=${expanded}`);
  expandOk ? passed++ : failed++;

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})();
