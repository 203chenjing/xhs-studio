const form = document.getElementById('resume-form');
const statusEl = document.getElementById('status');
const versionSelect = document.getElementById('version-select');
const versionNameInput = document.getElementById('version-name');
const educationList = document.getElementById('education-list');
const experienceList = document.getElementById('experience-list');
const awardsList = document.getElementById('awards-list');
const languagesList = document.getElementById('languages-list');
const skillsList = document.getElementById('skills-list');
const certificatesList = document.getElementById('certificates-list');
const familyList = document.getElementById('family-list');
const pasteText = document.getElementById('paste-text');
const parseLocalLink = document.getElementById('parse-local-link');
const parsePasteBtn = document.getElementById('parse-paste');
const parseOverwrite = document.getElementById('parse-overwrite');
const parseStatus = document.getElementById('parse-status');
const previewCards = document.getElementById('preview-cards');
const previewSummary = document.getElementById('preview-summary');
const mergeDialog = document.getElementById('merge-dialog');
const mergeSummary = document.getElementById('merge-summary');
const mergeDetail = document.getElementById('merge-detail');
const followupSection = document.getElementById('followup-section');
const followupQuestions = document.getElementById('followup-questions');
const followupFreeform = document.getElementById('followup-freeform');
const followupProgress = document.getElementById('followup-progress');

let previewTimer = null;
let pendingParsedProfile = null;
let parseLoading = false;
let followUpContext = null;

let profileCache = JobTrackerResumeStorage.defaultProfile();

const DEGREE_OPTIONS = ['', '硕士', '本科', '博士', '专科'];
const CATEGORY_OPTIONS = [
  { value: 'internship', label: '实习' },
  { value: 'work', label: '工作' },
  { value: 'project', label: '项目' },
  { value: 'research', label: '科研' },
  { value: 'competition', label: '竞赛' },
  { value: 'campus', label: '校园' },
  { value: 'other', label: '其他' }
];

const ARRAY_NAME_PREFIXES = ['education.', 'experience.', 'awards.', 'languages.', 'computerSkills.', 'certificates.', 'family.'];

const EXTRA_LIST_CONFIGS = [
  {
    key: 'awards',
    listEl: awardsList,
    addId: 'add-award',
    title: '获奖',
    defaultEntry: () => JobTrackerResumeStorage.defaultAward(),
    fields: [
      { name: 'date', label: '获奖时间' },
      { name: 'name', label: '奖励名称' },
      { name: 'level', label: '奖励等级' },
      { name: 'description', label: '奖励描述', textarea: true }
    ]
  },
  {
    key: 'languages',
    listEl: languagesList,
    addId: 'add-language',
    title: '外语',
    defaultEntry: () => JobTrackerResumeStorage.defaultLanguage(),
    fields: [
      { name: 'language', label: '语种' },
      { name: 'certificate', label: '证书名称' },
      { name: 'level', label: '水平' },
      { name: 'score', label: '成绩' },
      { name: 'proficiency', label: '掌握程度' },
      { name: 'speaking', label: '听说' },
      { name: 'reading', label: '读写' }
    ]
  },
  {
    key: 'computerSkills',
    listEl: skillsList,
    addId: 'add-skill',
    title: '技能',
    defaultEntry: () => JobTrackerResumeStorage.defaultComputerSkill(),
    fields: [
      { name: 'name', label: '技能类型' },
      { name: 'proficiency', label: '掌握程度' }
    ]
  },
  {
    key: 'certificates',
    listEl: certificatesList,
    addId: 'add-certificate',
    title: '证书',
    defaultEntry: () => JobTrackerResumeStorage.defaultCertificate(),
    fields: [
      { name: 'date', label: '获得时间' },
      { name: 'name', label: '证书名称' },
      { name: 'number', label: '证书编号' },
      { name: 'description', label: '说明' }
    ]
  },
  {
    key: 'family',
    listEl: familyList,
    addId: 'add-family',
    title: '家庭成员',
    defaultEntry: () => JobTrackerResumeStorage.defaultFamilyMember(),
    fields: [
      { name: 'name', label: '姓名' },
      { name: 'relation', label: '关系' },
      { name: 'phone', label: '电话' },
      { name: 'company', label: '公司' },
      { name: 'role', label: '职位' },
      { name: 'politicalStatus', label: '政治面貌' }
    ]
  }
];

const PERSONAL_PREVIEW_FIELDS = [
  { key: 'name', label: '姓名' },
  { key: 'gender', label: '性别' },
  { key: 'birthDate', label: '出生日期' },
  { key: 'phone', label: '手机' },
  { key: 'email', label: '邮箱' },
  { key: 'idNumber', label: '身份证' },
  { key: 'currentCity', label: '现居城市' },
  { key: 'wechat', label: '微信' },
  { key: 'github', label: 'GitHub' }
];

const EDU_PREVIEW_FIELDS = [
  { key: 'type', label: '学历' },
  { key: 'school', label: '学校' },
  { key: 'college', label: '学院' },
  { key: 'major', label: '专业' },
  { key: 'gpa', label: 'GPA' },
  { key: 'ranking', label: '排名' },
  { key: 'startDate', label: '入学' },
  { key: 'endDate', label: '毕业' }
];

const EXP_PREVIEW_FIELDS = [
  { key: 'category', label: '类型' },
  { key: 'organization', label: '公司/组织' },
  { key: 'role', label: '岗位' },
  { key: 'startDate', label: '开始' },
  { key: 'endDate', label: '结束' }
];

async function bg(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function setNested(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : ''), obj) ?? '';
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function confBadge(score) {
  if (score == null || Number.isNaN(score)) return '';
  const pct = Math.round(score * 100);
  const cls = pct >= 75 ? 'confidence-high' : pct >= 50 ? 'confidence-mid' : 'confidence-low';
  return `<span class="confidence-badge ${cls}">${pct}%</span>`;
}

function hideFollowUpSection() {
  if (followupSection) followupSection.hidden = true;
  if (followupQuestions) followupQuestions.innerHTML = '';
  if (followupFreeform) followupFreeform.value = '';
  followUpContext = null;
}

function renderFollowUpQuestions(questions) {
  if (!followupQuestions) return;
  followupQuestions.innerHTML = questions
    .map(
      (q, i) => `
    <div class="followup-q followup-q-priority-${q.priority || 'medium'}" data-followup-index="${i}">
      <span class="followup-q-label">${esc(q.label || q.path)}</span>
      <p class="followup-q-text">${esc(q.question)}</p>
      ${
        q.inputType === 'textarea'
          ? `<textarea data-followup-index="${i}" rows="3" placeholder="${esc(q.placeholder || '')}"></textarea>`
          : `<input type="text" data-followup-index="${i}" placeholder="${esc(q.placeholder || '')}">`
      }
    </div>`
    )
    .join('');
}

function collectFollowUpAnswers(questions) {
  return (questions || []).map((q, i) => {
    const el = followupQuestions?.querySelector(`textarea[data-followup-index="${i}"], input[data-followup-index="${i}"]`);
    return {
      path: q.path,
      label: q.label,
      value: el?.value?.trim() || ''
    };
  });
}

function showFollowUpPanel(ctx) {
  followUpContext = ctx;
  pendingParsedProfile = ctx.profile;
  if (followupProgress) {
    followupProgress.textContent = ctx.questions?.length ? `待补充 ${ctx.questions.length} 项` : '';
  }
  renderFollowUpQuestions(ctx.questions || []);
  if (followupSection) followupSection.hidden = false;
  followupSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setParseStatus('请补充以下信息，或直接粘贴到自由补充框');
}

function finishParseFlow(profile, sourceLabel, summaryPrefix = '') {
  pendingParsedProfile = profile;
  renderPreviewCards(profile);
  updatePreviewSummary(`${summaryPrefix}${JobTrackerResumeParser.previewSummary({ profile: profile })}`);
  openMergeDialog(profile, sourceLabel);
  hideFollowUpSection();
}

function setParseStatus(text, loading = false) {
  parseLoading = loading;
  parsePasteBtn.disabled = loading;
  if (parseLocalLink) parseLocalLink.disabled = loading;
  if (!text) {
    parseStatus.hidden = true;
    parseStatus.textContent = '';
    return;
  }
  parseStatus.hidden = false;
  parseStatus.textContent = loading ? `${text}…` : text;
}

function renderEducationBlock(entry, index) {
  const typeVal = entry.type || entry.degree || '';
  const degreeOpts = DEGREE_OPTIONS.map(
    (d) => `<option value="${d}" ${typeVal === d ? 'selected' : ''}>${d || '请选择'}</option>`
  ).join('');
  return `
    <div class="entry-block" data-edu-index="${index}">
      <div class="entry-head">
        <strong>${typeVal ? `教育·${typeVal}` : `教育经历 ${index + 1}`}</strong>
        <div class="entry-actions">
          <button type="button" class="link-btn" data-move-edu-up="${index}" ${index === 0 ? 'disabled' : ''}>上移</button>
          <button type="button" class="link-btn" data-move-edu-down="${index}">下移</button>
          <button type="button" class="link-btn danger" data-remove-edu="${index}">删除</button>
        </div>
      </div>
      <div class="grid">
        <label>学历类型
          <select name="education.${index}.type">${degreeOpts}</select>
        </label>
        <label>学校<input name="education.${index}.school" value="${esc(entry.school)}"></label>
        <label>学院<input name="education.${index}.college" value="${esc(entry.college)}"></label>
        <label>专业<input name="education.${index}.major" value="${esc(entry.major)}"></label>
        <label>GPA<input name="education.${index}.gpa" value="${esc(entry.gpa)}"></label>
        <label>排名<input name="education.${index}.ranking" value="${esc(entry.ranking)}" placeholder="前10%"></label>
        <label>入学时间<input name="education.${index}.startDate" value="${esc(entry.startDate)}" placeholder="2023/09"></label>
        <label>毕业时间<input name="education.${index}.endDate" value="${esc(entry.endDate)}" placeholder="2026/06"></label>
        <label>培养方式<input name="education.${index}.trainingMode" value="${esc(entry.trainingMode)}" placeholder="全日制"></label>
        <label>四级<input name="education.${index}.cet4" value="${esc(entry.cet4)}"></label>
        <label>六级<input name="education.${index}.cet6" value="${esc(entry.cet6)}"></label>
      </div>
    </div>`;
}

function renderExperienceBlock(entry, index) {
  const cat = entry.category || 'internship';
  const catLabel = JobTrackerResumeStorage.CATEGORY_LABELS[cat] || '经历';
  const catOpts = CATEGORY_OPTIONS.map(
    (o) => `<option value="${o.value}" ${cat === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');
  return `
    <div class="entry-block" data-exp-index="${index}">
      <div class="entry-head">
        <strong>${entry.organization ? `${catLabel}·${entry.organization}` : `${catLabel} ${index + 1}`}</strong>
        <div class="entry-actions">
          <button type="button" class="link-btn" data-move-exp-up="${index}" ${index === 0 ? 'disabled' : ''}>上移</button>
          <button type="button" class="link-btn" data-move-exp-down="${index}">下移</button>
          <button type="button" class="link-btn danger" data-remove-exp="${index}">删除</button>
        </div>
      </div>
      <div class="grid">
        <label>类型
          <select name="experience.${index}.category">${catOpts}</select>
        </label>
        <label>公司/组织<input name="experience.${index}.organization" value="${esc(entry.organization)}"></label>
        <label>岗位<input name="experience.${index}.role" value="${esc(entry.role)}"></label>
        <label>开始<input name="experience.${index}.startDate" value="${esc(entry.startDate)}"></label>
        <label>结束<input name="experience.${index}.endDate" value="${esc(entry.endDate)}"></label>
      </div>
      <label>描述<textarea name="experience.${index}.description" rows="5">${esc(entry.description)}</textarea></label>
    </div>`;
}

function renderGenericListBlock(sectionKey, entry, index, config) {
  const titleField = config.fields.find((f) => f.name === 'name') || config.fields[0];
  const head = entry[titleField.name] || `${config.title} ${index + 1}`;
  const fieldsHtml = config.fields
    .map((f) => {
      const val = esc(entry[f.name]);
      const inputName = `${sectionKey}.${index}.${f.name}`;
      if (f.textarea) {
        return `<label>${f.label}<textarea name="${inputName}" rows="2">${val}</textarea></label>`;
      }
      return `<label>${f.label}<input name="${inputName}" value="${val}"></label>`;
    })
    .join('');
  return `
    <div class="entry-block" data-list-key="${sectionKey}" data-list-index="${index}">
      <div class="entry-head">
        <strong>${esc(head)}</strong>
        <div class="entry-actions">
          <button type="button" class="link-btn danger" data-remove-list="${sectionKey}" data-list-index="${index}">删除</button>
        </div>
      </div>
      <div class="grid">${fieldsHtml}</div>
    </div>`;
}

function renderExtraLists(profile) {
  for (const config of EXTRA_LIST_CONFIGS) {
    if (!config.listEl) continue;
    const entries = profile[config.key]?.length ? profile[config.key] : [];
    config.listEl.innerHTML = entries.map((e, i) => renderGenericListBlock(config.key, e, i, config)).join('');
  }
}

function renderDynamicSections(profile) {
  const educations = profile.education?.length ? profile.education : [JobTrackerResumeStorage.defaultEducation()];
  const experiences = profile.experience?.length ? profile.experience : [JobTrackerResumeStorage.defaultExperience('project')];
  educationList.innerHTML = educations.map((e, i) => renderEducationBlock(e, i)).join('');
  experienceList.innerHTML = experiences.map((e, i) => renderExperienceBlock(e, i)).join('');
  renderExtraLists(profile);
  bindDynamicEvents();
}

function isArrayFieldName(name) {
  return ARRAY_NAME_PREFIXES.some((p) => name.startsWith(p));
}

function collectExtraLists(profile) {
  for (const config of EXTRA_LIST_CONFIGS) {
    if (!config.listEl) continue;
    profile[config.key] = [];
    config.listEl.querySelectorAll('.entry-block').forEach((block, i) => {
      const entry = config.defaultEntry();
      block.querySelectorAll('[name]').forEach((el) => {
        entry[el.name.split('.').pop()] = el.value.trim();
      });
      profile[config.key][i] = entry;
    });
  }
}

function collectProfileFromForm() {
  const profile = JSON.parse(JSON.stringify(profileCache));
  form.querySelectorAll('[name]').forEach((el) => {
    if (isArrayFieldName(el.name)) return;
    setNested(profile, el.name, el.value.trim());
  });

  profile.education = [];
  educationList.querySelectorAll('.entry-block').forEach((block, i) => {
    const entry = JobTrackerResumeStorage.defaultEducation();
    block.querySelectorAll('[name]').forEach((el) => {
      entry[el.name.split('.').pop()] = el.value.trim();
    });
    profile.education[i] = entry;
  });

  profile.experience = [];
  experienceList.querySelectorAll('.entry-block').forEach((block, i) => {
    const entry = JobTrackerResumeStorage.defaultExperience();
    block.querySelectorAll('[name]').forEach((el) => {
      entry[el.name.split('.').pop()] = el.value.trim();
    });
    profile.experience[i] = entry;
  });

  collectExtraLists(profile);

  return JobTrackerResumeStorage.normalizeProfile(profile);
}

function bindDynamicEvents() {
  educationList.querySelectorAll('[data-remove-edu]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.removeEdu);
      const profile = collectProfileFromForm();
      if (profile.education.length <= 1) {
        statusEl.textContent = '至少保留一段教育经历';
        return;
      }
      profile.education.splice(idx, 1);
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });
  educationList.querySelectorAll('[data-move-edu-up]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.moveEduUp);
      if (idx <= 0) return;
      const profile = collectProfileFromForm();
      [profile.education[idx - 1], profile.education[idx]] = [profile.education[idx], profile.education[idx - 1]];
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });
  educationList.querySelectorAll('[data-move-edu-down]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.moveEduDown);
      const profile = collectProfileFromForm();
      if (idx >= profile.education.length - 1) return;
      [profile.education[idx], profile.education[idx + 1]] = [profile.education[idx + 1], profile.education[idx]];
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });

  experienceList.querySelectorAll('[data-remove-exp]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.removeExp);
      const profile = collectProfileFromForm();
      if (profile.experience.length <= 1) {
        statusEl.textContent = '至少保留一段经历';
        return;
      }
      profile.experience.splice(idx, 1);
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });
  experienceList.querySelectorAll('[data-move-exp-up]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.moveExpUp);
      if (idx <= 0) return;
      const profile = collectProfileFromForm();
      [profile.experience[idx - 1], profile.experience[idx]] = [profile.experience[idx], profile.experience[idx - 1]];
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });
  experienceList.querySelectorAll('[data-move-exp-down]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.moveExpDown);
      const profile = collectProfileFromForm();
      if (idx >= profile.experience.length - 1) return;
      [profile.experience[idx], profile.experience[idx + 1]] = [profile.experience[idx + 1], profile.experience[idx]];
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });

  document.querySelectorAll('[data-remove-list]').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.removeList;
      const idx = Number(btn.dataset.listIndex);
      const profile = collectProfileFromForm();
      profile[key].splice(idx, 1);
      profileCache = profile;
      renderDynamicSections(profile);
    };
  });
}

function initExtraListAddButtons() {
  for (const config of EXTRA_LIST_CONFIGS) {
    const addBtn = document.getElementById(config.addId);
    if (!addBtn || addBtn.dataset.bound) continue;
    addBtn.dataset.bound = '1';
    addBtn.addEventListener('click', () => {
      const profile = collectProfileFromForm();
      if (!profile[config.key]) profile[config.key] = [];
      profile[config.key].push(config.defaultEntry());
      profileCache = profile;
      renderDynamicSections(profile);
    });
  }
}

function fillBasicFields(profile) {
  form.querySelectorAll('[name]').forEach((el) => {
    if (isArrayFieldName(el.name)) return;
    el.value = getNested(profile, el.name);
  });
}

async function applyImportedBundle(data) {
  const profile = JobTrackerResumeStorage.normalizeProfile(data.profile || data);
  const versionName = data.name || versionNameInput.value || '导入版';
  profileCache = profile;
  fillBasicFields(profileCache);
  renderDynamicSections(profileCache);
  versionNameInput.value = versionName;
  await bg('SAVE_RESUME', { profile: profileCache });
  statusEl.textContent = `已导入并保存「${versionName}」`;
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
  chrome.runtime.sendMessage({ type: 'REFRESH_AUTOFILL' }).catch(() => {});
}

function renderPreviewFieldGrid(fields, entry) {
  return fields
    .map((f) => {
      const val = entry[f.key] || '';
      if (!val && f.key !== 'name' && f.key !== 'school' && f.key !== 'organization') return '';
      return `<label>${f.label}<input data-field="${f.key}" value="${esc(val)}"></label>`;
    })
    .filter(Boolean)
    .join('');
}

function renderPreviewCards(profile, previewMeta = null) {
  const pi = profile.personalInfo || {};
  const hasPersonal = PERSONAL_PREVIEW_FIELDS.some((f) => pi[f.key]);
  const cards = [];

  if (hasPersonal) {
    const fields = renderPreviewFieldGrid(PERSONAL_PREVIEW_FIELDS, pi);
    cards.push(`
      <div class="preview-card" data-card-type="personal">
        <div class="preview-card-head">
          <span class="preview-card-title">基本信息</span>
        </div>
        <div class="preview-card-fields">${fields}</div>
      </div>`);
  }

  const eduList = previewMeta?.education || profile.education || [];
  eduList.forEach((entry, i) => {
    const title = entry.school
      ? `教育·${entry.type || entry.degree || entry.school}`
      : `教育经历 ${i + 1}`;
    const fields = renderPreviewFieldGrid(EDU_PREVIEW_FIELDS, entry);
    if (!fields) return;
    cards.push(`
      <div class="preview-card" data-card-type="education" data-index="${i}">
        <div class="preview-card-head">
          <span class="preview-card-title">${esc(title)}</span>
          ${confBadge(entry._avgConfidence)}
        </div>
        <div class="preview-card-fields">${fields}</div>
      </div>`);
  });

  const expList = previewMeta?.experience || profile.experience || [];
  expList.forEach((entry, i) => {
    const cat = JobTrackerResumeStorage.CATEGORY_LABELS[entry.category] || '经历';
    const title = entry.organization ? `${cat}·${entry.organization}` : `${cat} ${i + 1}`;
    const fields = renderPreviewFieldGrid(EXP_PREVIEW_FIELDS, entry);
    const desc = entry.description
      ? `<label>描述<textarea data-field="description" rows="2">${esc(entry.description)}</textarea></label>`
      : '';
    if (!fields && !desc) return;
    cards.push(`
      <div class="preview-card" data-card-type="experience" data-index="${i}">
        <div class="preview-card-head">
          <span class="preview-card-title">${esc(title)}</span>
          ${confBadge(entry._avgConfidence)}
        </div>
        <div class="preview-card-fields">${fields}</div>
        ${desc}
      </div>`);
  });

  if (profile.special?.selfIntroduction) {
    cards.push(`
      <div class="preview-card" data-card-type="self">
        <div class="preview-card-head">
          <span class="preview-card-title">自我评价</span>
        </div>
        <label><textarea data-field="selfIntroduction" rows="3">${esc(profile.special.selfIntroduction)}</textarea></label>
      </div>`);
  }

  if (!cards.length) {
    previewCards.innerHTML = '<p class="empty-hint">未能识别到有效字段，请检查粘贴内容</p>';
    return;
  }
  previewCards.innerHTML = cards.join('');
}

function collectProfileFromPreviewCards() {
  const profile = {
    personalInfo: {},
    education: [],
    experience: [],
    special: { selfIntroduction: '' }
  };

  const personalCard = previewCards.querySelector('[data-card-type="personal"]');
  if (personalCard) {
    personalCard.querySelectorAll('[data-field]').forEach((el) => {
      const v = el.value.trim();
      if (v) profile.personalInfo[el.dataset.field] = v;
    });
  }

  previewCards.querySelectorAll('[data-card-type="education"]').forEach((card) => {
    const entry = {};
    card.querySelectorAll('[data-field]').forEach((el) => {
      entry[el.dataset.field] = el.value.trim();
    });
    if (entry.school || entry.type || entry.major) profile.education.push(entry);
  });

  previewCards.querySelectorAll('[data-card-type="experience"]').forEach((card) => {
    const entry = { category: 'other' };
    card.querySelectorAll('[data-field]').forEach((el) => {
      entry[el.dataset.field] = el.value.trim();
    });
    if (entry.organization || entry.role || entry.description) profile.experience.push(entry);
  });

  const selfCard = previewCards.querySelector('[data-card-type="self"]');
  if (selfCard) {
    const ta = selfCard.querySelector('[data-field="selfIntroduction"]');
    if (ta?.value.trim()) profile.special.selfIntroduction = ta.value.trim();
  }

  return JobTrackerResumeStorage.normalizeProfile(profile);
}

function updatePreviewSummary(text, showApplyLink = false) {
  if (showApplyLink) {
    previewSummary.innerHTML = `${esc(text)} <button type="button" class="link-btn" id="apply-preview-btn">确认填入表单</button>`;
    document.getElementById('apply-preview-btn').onclick = () => {
      pendingParsedProfile = collectProfileFromPreviewCards();
      openMergeDialog(pendingParsedProfile, '规则预览');
    };
  } else {
    previewSummary.textContent = text;
  }
}

function runLocalPreview(text, { showApplyLink = false, silent = false } = {}) {
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    if (!silent) {
      previewCards.innerHTML = '<p class="empty-hint">粘贴后自动本地预览，点「AI 解析并填入」走 AI 并合并到表单</p>';
      previewSummary.textContent = '';
    }
    return null;
  }
  const result = JobTrackerResumeParser.parseForPreview(trimmed);
  pendingParsedProfile = result.profile;
  renderPreviewCards(result.profile, result.preview);
  const summary = JobTrackerResumeParser.previewSummary(result);
  updatePreviewSummary(summary, showApplyLink);
  return result;
}

function applyProfileToForm(parsed, overwrite, sourceLabel) {
  const current = collectProfileFromForm();
  profileCache = JobTrackerResumeParser.mergeProfile(current, parsed, { overwrite });
  fillBasicFields(profileCache);
  renderDynamicSections(profileCache);
  statusEl.textContent = sourceLabel || (overwrite ? '已解析并覆盖填入' : '已解析并补充空白字段');
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

function buildMergeDetailHtml(diff) {
  const lines = [];
  const piLabels = { name: '姓名', phone: '手机', email: '邮箱', gender: '性别', birthDate: '出生日期' };
  if (diff.personalInfo.length) {
    lines.push(`基本信息：${diff.personalInfo.map((k) => piLabels[k] || k).join('、')}`);
  }
  for (const e of diff.education) {
    lines.push(`教育：${e.type || ''} ${e.school || ''} ${e.major || ''}`.trim());
  }
  for (const e of diff.experience) {
    const cat = JobTrackerResumeStorage.CATEGORY_LABELS[e.category] || '经历';
    lines.push(`${cat}：${e.organization || ''} ${e.role || ''}`.trim());
  }
  if (diff.selfIntro) lines.push('自我评价');
  return lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p>将用解析结果更新表单中对应空白字段</p>';
}

function openMergeDialog(parsed, sourceLabel) {
  const current = collectProfileFromForm();
  const overwrite = parseOverwrite.checked;
  const diff = overwrite
    ? null
    : JobTrackerResumeParser.buildMergeDiff(current, parsed);
  mergeSummary.textContent = overwrite
    ? `将${sourceLabel ? `以「${sourceLabel}」` : ''}覆盖表单已有内容`
    : JobTrackerResumeParser.formatMergeSummary(diff);
  mergeDetail.innerHTML = overwrite
    ? '<p>勾选「覆盖已有内容」时，教育/经历列表将被解析结果替换。</p>'
    : buildMergeDetailHtml(diff);
  pendingParsedProfile = parsed;
  mergeDialog.showModal();
}

async function loadVersions() {
  const res = await bg('GET_RESUME_VERSIONS');
  const meta = res.meta || { versions: [], activeVersionId: '' };
  versionSelect.innerHTML = meta.versions
    .map((v) => `<option value="${v.id}" ${v.id === meta.activeVersionId ? 'selected' : ''}>${v.name}</option>`)
    .join('');
  const active = meta.versions.find((v) => v.id === meta.activeVersionId);
  versionNameInput.value = active?.name || '';
  return meta;
}

async function loadProfileToForm() {
  const res = await bg('GET_RESUME');
  profileCache = JobTrackerResumeStorage.normalizeProfile(res.profile || {});
  fillBasicFields(profileCache);
  renderDynamicSections(profileCache);
}

async function load() {
  await loadVersions();
  await loadProfileToForm();
}

document.getElementById('back-to-popup')?.addEventListener('click', () => {
  window.close();
});

document.getElementById('open-options')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

versionSelect.addEventListener('change', async () => {
  await bg('SET_ACTIVE_VERSION', { id: versionSelect.value });
  await loadProfileToForm();
  const opt = versionSelect.selectedOptions[0];
  versionNameInput.value = opt?.textContent || '';
});

document.getElementById('add-version').addEventListener('click', async () => {
  const name = prompt('新版本名称', '英文简历专版');
  if (!name) return;
  await bg('ADD_RESUME_VERSION', { name });
  await load();
  statusEl.textContent = `已创建「${name}」`;
  setTimeout(() => { statusEl.textContent = ''; }, 2000);
});

document.getElementById('add-education').addEventListener('click', () => {
  const profile = collectProfileFromForm();
  profile.education.push(JobTrackerResumeStorage.defaultEducation());
  profileCache = profile;
  renderDynamicSections(profile);
});

document.getElementById('add-experience').addEventListener('click', () => {
  const profile = collectProfileFromForm();
  profile.experience.push(JobTrackerResumeStorage.defaultExperience());
  profileCache = profile;
  renderDynamicSections(profile);
});

if (parseLocalLink) {
  parseLocalLink.addEventListener('click', () => {
    const text = pasteText.value.trim();
    if (!text) {
      setParseStatus('请先粘贴简历文本');
      return;
    }
    setParseStatus('');
    const result = runLocalPreview(text, { showApplyLink: true });
    if (!result) {
      setParseStatus('文本过短，请粘贴更多内容');
      return;
    }
    if (result.profile && !JobTrackerResumeParser.previewSummary(result).includes('未能识别')) {
      setParseStatus('本地预览完成，可编辑后点「确认填入表单」');
    } else {
      setParseStatus('本地预览完成，识别字段较少');
    }
  });
}

parsePasteBtn.addEventListener('click', async () => {
  const text = pasteText.value.trim();
  if (!text) {
    setParseStatus('请先粘贴简历文本');
    return;
  }

  const settingsRes = await bg('GET_SETTINGS');
  const ai = settingsRes.settings?.ai || {};
  if (ai.resumeParse === false) {
    setParseStatus('AI 简历解析已关闭，请用「规则预览」或去设置页开启');
    return;
  }
  if (!String(ai.apiKey || '').trim()) {
    setParseStatus('请先在设置页配置 API Key');
    return;
  }

  setParseStatus('AI 解析中', true);
  statusEl.textContent = '';

  try {
    const res = await bg('AI_PARSE_RESUME', { text, overwrite: parseOverwrite.checked });
    if (!res?.ok) {
      setParseStatus(res?.error || 'AI 解析失败，可尝试「规则预览」');
      return;
    }

    pendingParsedProfile = res.profile;
    renderPreviewCards(res.profile);
    const sourceLabel = res.source === 'local-fallback'
      ? '本地兜底'
      : res.source === 'ai-first'
        ? 'AI 优先'
        : res.source === 'ai'
          ? 'AI'
          : res.source === 'local'
            ? '本地'
            : '解析';
    const summaryPrefix = res.fallback ? `${res.error || 'AI 失败'}，已本地兜底 · ` : '';
    updatePreviewSummary(`${summaryPrefix}${res.summary || JobTrackerResumeParser.previewSummary({ profile: res.profile })}`);

    if (res.needsFollowUp && res.questions?.length) {
      setParseStatus(res.fallback ? 'AI 失败，已本地兜底；请补充以下信息' : '解析完成，请补充以下信息');
      showFollowUpPanel({
        profile: res.profile,
        questions: res.questions,
        sourceText: text,
        sourceLabel,
        summaryPrefix
      });
    } else {
      setParseStatus(res.fallback ? 'AI 失败，已用本地结果' : `${sourceLabel}解析完成`);
      finishParseFlow(res.profile, sourceLabel, summaryPrefix);
    }
  } catch (err) {
    setParseStatus(`${err.message || 'AI 解析失败'}，可尝试「仅本地快速解析」`);
  } finally {
    parsePasteBtn.disabled = false;
    if (parseLocalLink) parseLocalLink.disabled = false;
  }
});

document.getElementById('merge-confirm').addEventListener('click', () => {
  const parsed = pendingParsedProfile || collectProfileFromPreviewCards();
  const overwrite = parseOverwrite.checked;
  mergeDialog.close();
  applyProfileToForm(
    parsed,
    overwrite,
    overwrite ? '已覆盖填入表单' : '已合并到表单（仅补充空白）'
  );
  setParseStatus('');
});

document.getElementById('merge-cancel').addEventListener('click', () => {
  mergeDialog.close();
  setParseStatus('已取消填入，预览卡片仍可编辑');
});

document.getElementById('followup-submit')?.addEventListener('click', async () => {
  if (!followUpContext) return;
  const answers = collectFollowUpAnswers(followUpContext.questions);
  const freeform = followupFreeform?.value?.trim() || '';
  const hasInput = answers.some((a) => a.value) || freeform;
  if (!hasInput) {
    setParseStatus('请至少填写一项补充，或使用「跳过」');
    return;
  }
  setParseStatus('正在合并补充信息', true);
  try {
    const res = await bg('AI_RESUME_MERGE_ANSWERS', {
      profile: followUpContext.profile,
      answers,
      freeform,
      sourceText: followUpContext.sourceText
    });
    if (!res?.ok) {
      setParseStatus(res?.error || '合并失败');
      return;
    }
    followUpContext.profile = res.profile;
    followUpContext.round = (followUpContext.round || 0) + 1;
    pendingParsedProfile = res.profile;
    renderPreviewCards(res.profile);
    updatePreviewSummary(res.summary || JobTrackerResumeParser.previewSummary({ profile: res.profile }));

    if (res.needsFollowUp && res.questions?.length && followUpContext.round < 3) {
      followUpContext.questions = res.questions;
      showFollowUpPanel(followUpContext);
      setParseStatus(`已更新，还有 ${res.questions.length} 项可补充`);
    } else {
      setParseStatus('补充完成');
      finishParseFlow(res.profile, followUpContext.sourceLabel, followUpContext.summaryPrefix || '');
    }
  } catch (err) {
    setParseStatus(err.message || '合并失败');
  } finally {
    parsePasteBtn.disabled = false;
  }
});

document.getElementById('followup-skip')?.addEventListener('click', () => {
  if (!followUpContext) return;
  finishParseFlow(
    followUpContext.profile,
    followUpContext.sourceLabel || '解析',
    followUpContext.summaryPrefix || ''
  );
  setParseStatus('已跳过追问，可直接确认填入');
});

pasteText.addEventListener('input', () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => runLocalPreview(pasteText.value, { silent: true }), 500);
});

pasteText.addEventListener('paste', () => {
  setTimeout(() => runLocalPreview(pasteText.value, { silent: true }), 80);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const profile = collectProfileFromForm();
  const versionName = versionNameInput.value.trim() || versionSelect.selectedOptions[0]?.textContent || '通用版';
  await bg('SAVE_RESUME', { profile });
  profileCache = profile;
  statusEl.textContent = `已保存「${versionName}」`;
  chrome.runtime.sendMessage({ type: 'REFRESH_AUTOFILL' }).catch(() => {});
  setTimeout(() => { statusEl.textContent = ''; }, 2500);
});

document.getElementById('import-profile-json')?.addEventListener('click', () => {
  document.getElementById('import-profile-file')?.click();
});

document.getElementById('import-profile-file')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    await applyImportedBundle(data);
  } catch (err) {
    statusEl.textContent = `导入失败：${err.message || 'JSON 格式错误'}`;
  }
  e.target.value = '';
});

document.getElementById('import-seed-profile')?.addEventListener('click', async () => {
  try {
    const url = chrome.runtime.getURL('data/profile-ai-product-general.json');
    const res = await fetch(url);
    if (!res.ok) throw new Error('无法读取内置档案');
    await applyImportedBundle(await res.json());
  } catch (err) {
    statusEl.textContent = `导入失败：${err.message}`;
  }
});

initExtraListAddButtons();
load();
