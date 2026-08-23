const JobTrackerResumeStorage = {

  STORAGE_KEY: 'job_tracker_resume',

  META_KEY: 'job_tracker_resume_meta',



  CATEGORY_LABELS: {

    internship: '实习',

    work: '工作',

    project: '项目',

    research: '科研',

    competition: '竞赛',

    campus: '校园',

    other: '其他'

  },



  defaultEducation() {

    return {

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

      trainingMode: ''

    };

  },

  defaultJobIntent() {
    return { expectedStartDate: '', expectedCity: '', expectedSalary: '' };
  },

  defaultAward() {
    return { date: '', name: '', level: '', description: '' };
  },

  defaultLanguage() {
    return { language: '', certificate: '', level: '', score: '', proficiency: '', speaking: '', reading: '' };
  },

  defaultComputerSkill() {
    return { name: '', proficiency: '' };
  },

  defaultCertificate() {
    return { date: '', name: '', number: '', description: '' };
  },

  defaultFamilyMember() {
    return { name: '', relation: '', phone: '', company: '', role: '', politicalStatus: '' };
  },

  defaultCampusEntry() {
    return { title: '', organization: '', description: '', startDate: '', endDate: '' };
  },



  defaultEducationEntry() {
    return this.defaultEducation();
  },

  defaultExperienceEntry(category = 'internship') {
    return this.defaultExperience(category);
  },

  syncEducationFields(entry) {
    if (!entry) return entry;
    if (entry.degree && !entry.type) {
      const map = { 硕士: '硕士研究生', 本科: '本科', 博士: '博士研究生', 专科: '专科' };
      entry.type = map[entry.degree] || entry.degree;
    }
    if (entry.type && !entry.degree) {
      if (/博士/.test(entry.type)) entry.degree = '博士';
      else if (/硕士|研究生/.test(entry.type)) entry.degree = '硕士';
      else if (/本科|学士/.test(entry.type)) entry.degree = '本科';
      else if (/专科|大专/.test(entry.type)) entry.degree = '专科';
    }
    return entry;
  },

  normalizeProfile(raw) {
    const profile = this.migrateProfile(raw);
    profile.education = (profile.education || []).map((e) => this.syncEducationFields({ ...this.defaultEducation(), ...e }));
    profile.experience = (profile.experience || []).map((x) => ({ ...this.defaultExperience(x.category || 'internship'), ...x }));
    profile.awards = (profile.awards || []).map((a) => ({ ...this.defaultAward(), ...a }));
    profile.languages = (profile.languages || []).map((l) => ({ ...this.defaultLanguage(), ...l }));
    profile.computerSkills = (profile.computerSkills || []).map((s) => ({ ...this.defaultComputerSkill(), ...s }));
    profile.certificates = (profile.certificates || []).map((c) => ({ ...this.defaultCertificate(), ...c }));
    profile.family = (profile.family || []).map((f) => ({ ...this.defaultFamilyMember(), ...f }));
    profile.campus = (profile.campus || []).map((c) => ({ ...this.defaultCampusEntry(), ...c }));
    profile.jobIntent = { ...this.defaultJobIntent(), ...(profile.jobIntent || {}) };
    profile.special = { selfIntroduction: '', hobbies: '', ...(profile.special || {}) };
    profile.sidebarGroups = this.buildSidebarGroups(profile);
    return profile;
  },

  defaultExperience(category = 'internship') {

    return {

      category,

      organization: '',

      role: '',

      startDate: '',

      endDate: '',

      description: ''

    };

  },



  defaultProfile() {

    return {

      personalInfo: {

        name: '',

        gender: '',

        birthDate: '',

        phone: '',

        email: '',

        idNumber: '',

        idType: '',

        ethnicity: '',

        politicalStatus: '',

        maritalStatus: '',

        nativePlace: '',

        nativePlacePath: '',

        originPlace: '',

        currentCity: '',

        mailingAddress: '',

        country: '',

        qq: '',

        wechat: '',

        github: '',

        targetCity: '',

        targetPosition: '',

        highestDegree: '',

        height: '',

        weight: '',

        healthStatus: '',

        specialty: '',

        workYears: '',

        emergencyContactName: '',

        emergencyContactPhone: ''

      },

      jobIntent: { expectedStartDate: '', expectedCity: '', expectedSalary: '' },

      education: [],

      experience: [],

      awards: [],

      languages: [],

      computerSkills: [],

      certificates: [],

      family: [],

      campus: [],

      special: { selfIntroduction: '', hobbies: '' },

      sidebarGroups: []

    };

  },



  migrateProfile(raw) {

    const profile = { ...this.defaultProfile(), ...(raw || {}) };

    profile.personalInfo = { ...this.defaultProfile().personalInfo, ...(raw?.personalInfo || {}) };

    profile.jobIntent = { ...this.defaultJobIntent(), ...(raw?.jobIntent || {}) };

    profile.special = { ...this.defaultProfile().special, ...(raw?.special || {}) };

    const arrayDefaults = {
      awards: 'defaultAward',
      languages: 'defaultLanguage',
      computerSkills: 'defaultComputerSkill',
      certificates: 'defaultCertificate',
      family: 'defaultFamilyMember',
      campus: 'defaultCampusEntry'
    };
    for (const [key, fn] of Object.entries(arrayDefaults)) {
      profile[key] = Array.isArray(raw?.[key])
        ? raw[key].map((item) => ({ ...this[fn](), ...item }))
        : [];
    }



    if (raw?.education && !Array.isArray(raw.education)) {

      const e = raw.education;

      const has = Object.values(e).some((v) => v);

      profile.education = has ? [{ ...this.defaultEducation(), ...e, type: e.type || e.degree || '', degree: e.degree || e.type || '' }] : [];

    } else if (Array.isArray(raw?.education)) {

      profile.education = raw.education.map((e) => ({
        ...this.defaultEducation(),
        ...e,
        type: e.type || e.degree || '',
        degree: e.degree || e.type || ''
      }));

    }



    if (raw?.experience && !Array.isArray(raw.experience)) {

      const x = raw.experience;

      const has = Object.values(x).some((v) => v);

      profile.experience = has

        ? [{ ...this.defaultExperience('internship'), ...x, category: x.category || 'internship' }]

        : [];

    } else if (Array.isArray(raw?.experience)) {

      profile.experience = raw.experience.map((x) => ({

        ...this.defaultExperience(x.category || 'internship'),

        ...x

      }));

    }

    if (!profile.education.length) profile.education = [this.defaultEducation()];
    if (!profile.experience.length) profile.experience = [this.defaultExperience('project')];

    return profile;

  },

  degreeRank(type) {
    const d = String(type || '');
    if (/博士/.test(d)) return 4;
    if (/硕士|研究生/.test(d)) return 3;
    if (/本科|学士/.test(d)) return 2;
    if (/专科|大专/.test(d)) return 1;
    return 0;
  },

  pickEducation(educations, hint) {
    const list = educations || [];
    if (!list.length) return this.defaultEducation();
    if (hint === 'highest') {
      return [...list].sort((a, b) => this.degreeRank(b.type) - this.degreeRank(a.type))[0];
    }
    const typeRe =
      hint === 'master' ? /硕士|研究生|master/i : hint === 'bachelor' ? /本科|学士|bachelor/i : null;
    if (typeRe) {
      const hit = list.find((e) => typeRe.test(e.type || e.degree || ''));
      if (hit) return hit;
    }
    return list[hint === 'bachelor' ? list.length - 1 : 0] || list[0];
  },



  buildSidebarGroups(profile) {

    const p = profile.personalInfo || {};

    const s = profile.special || {};

    const groups = [];



    const basicItems = [

      { label: '姓名', value: p.name },

      { label: '性别', value: p.gender },

      { label: '民族', value: p.ethnicity },

      { label: '政治面貌', value: p.politicalStatus },

      { label: '婚姻状况', value: p.maritalStatus },

      { label: '出生日期', value: p.birthDate },

      { label: '手机号', value: p.phone },

      { label: '邮箱', value: p.email },

      { label: 'QQ', value: p.qq },

      { label: '微信', value: p.wechat },

      { label: '证件类型', value: p.idType },

      { label: '身份证', value: p.idNumber },

      { label: '国家/地区', value: p.country },

      { label: '籍贯', value: p.nativePlacePath || p.nativePlace },

      { label: '生源地', value: p.originPlace },

      { label: '现居住地', value: p.currentCity },

      { label: '通信地址', value: p.mailingAddress },

      { label: '最高学历', value: p.highestDegree },

      { label: '身高', value: p.height },

      { label: '体重', value: p.weight },

      { label: '健康状况', value: p.healthStatus },

      { label: '特长', value: p.specialty },

      { label: '工作年限', value: p.workYears },

      { label: '紧急联系人', value: p.emergencyContactName },

      { label: '紧急联系人电话', value: p.emergencyContactPhone },

      { label: 'GitHub', value: p.github }

    ].filter((i) => i.value);

    if (basicItems.length) groups.push({ group: '基本信息', items: basicItems });

    const ji = profile.jobIntent || {};
    const intentItems = [
      { label: '预计入职时间', value: ji.expectedStartDate },
      { label: '期望工作城市', value: ji.expectedCity },
      { label: '期望薪资', value: ji.expectedSalary }
    ].filter((i) => i.value);
    if (intentItems.length) groups.push({ group: '求职意向', items: intentItems });



    const eduItems = [];

    (profile.education || []).forEach((e, i) => {

      const tag = [e.degree || e.type, e.school].filter(Boolean).join('·') || `教育${i + 1}`;

      const prefix = `教育·${tag}`;

      const fields = [

        ['学校', e.school],

        ['学院', e.college],

        ['专业', e.major],

        ['学历', e.degree || e.type],

        ['GPA', e.gpa],

        ['排名', e.ranking],

        ['入学时间', e.startDate],

        ['毕业时间', e.endDate],

        ['四级', e.cet4],

        ['六级', e.cet6]

      ];

      fields.forEach(([k, v]) => {

        if (v) eduItems.push({ label: `${prefix}·${k}`, value: v });

      });

    });

    if (eduItems.length) groups.push({ group: '教育经历', items: eduItems });



    const expItems = [];

    (profile.experience || []).forEach((x, i) => {

      const cat = this.CATEGORY_LABELS[x.category] || x.category || '经历';

      const name = x.organization || x.role || '';

      const tag = name ? `${cat}·${name}` : `${cat}${i + 1}`;

      const fields = [

        ['公司/组织', x.organization],

        ['岗位/角色', x.role],

        ['开始时间', x.startDate],

        ['结束时间', x.endDate],

        ['描述', x.description]

      ];

      fields.forEach(([k, v]) => {

        if (v) expItems.push({ label: `${tag}·${k}`, value: v });

      });

    });

    if (expItems.length) groups.push({ group: '实习与工作', items: expItems });

    const appendListItems = (items, tag, fieldPairs) => {
      fieldPairs.forEach(([k, v]) => {
        if (v) items.push({ label: `${tag}·${k}`, value: v });
      });
    };

    const awardItems = [];
    (profile.awards || []).forEach((e, i) => {
      appendListItems(awardItems, e.name || `获奖${i + 1}`, [
        ['奖励名称', e.name], ['获奖时间', e.date], ['奖励等级', e.level], ['奖励描述', e.description]
      ]);
    });
    if (awardItems.length) groups.push({ group: '获奖情况', items: awardItems });

    const langItems = [];
    (profile.languages || []).forEach((e, i) => {
      appendListItems(langItems, e.language || `外语${i + 1}`, [
        ['语种', e.language], ['证书', e.certificate], ['水平', e.level], ['成绩', e.score],
        ['掌握程度', e.proficiency], ['听说', e.speaking], ['读写', e.reading]
      ]);
    });
    if (langItems.length) groups.push({ group: '外语能力', items: langItems });

    const skillItems = [];
    (profile.computerSkills || []).forEach((e, i) => {
      appendListItems(skillItems, e.name || `技能${i + 1}`, [['技能', e.name], ['掌握程度', e.proficiency]]);
    });
    if (skillItems.length) groups.push({ group: '计算机技能', items: skillItems });

    const certItems = [];
    (profile.certificates || []).forEach((e, i) => {
      appendListItems(certItems, e.name || `证书${i + 1}`, [
        ['证书名称', e.name], ['获得时间', e.date], ['证书编号', e.number], ['说明', e.description]
      ]);
    });
    if (certItems.length) groups.push({ group: '资格证书', items: certItems });

    const familyItems = [];
    (profile.family || []).forEach((e, i) => {
      appendListItems(familyItems, e.name || `家庭成员${i + 1}`, [
        ['姓名', e.name], ['关系', e.relation], ['电话', e.phone],
        ['公司', e.company], ['职位', e.role], ['政治面貌', e.politicalStatus]
      ]);
    });
    if (familyItems.length) groups.push({ group: '家庭情况', items: familyItems });

    const campusItems = [];
    (profile.campus || []).forEach((e, i) => {
      appendListItems(campusItems, e.title || `在校职务${i + 1}`, [
        ['职务名称', e.title],
        ['组织', e.organization],
        ['描述', e.description],
        ['开始', e.startDate],
        ['结束', e.endDate]
      ]);
    });
    if (campusItems.length) groups.push({ group: '在校经历', items: campusItems });

    const otherItems = [
      { label: '自我评价', value: s.selfIntroduction },
      { label: '兴趣爱好', value: s.hobbies }
    ].filter((i) => i.value);

    if (otherItems.length) groups.push({ group: '其他', items: otherItems });



    return groups;

  },



  async getMeta() {

    const data = await chrome.storage.local.get(this.META_KEY);

    return data[this.META_KEY] || { activeVersionId: 'default', versions: [] };

  },



  async getVersions() {

    const meta = await this.getMeta();

    if (meta.versions?.length) return meta;

    const legacy = await chrome.storage.local.get(this.STORAGE_KEY);

    const old = legacy[this.STORAGE_KEY];

    if (old) {

      meta.versions = [{ id: 'default', name: '通用版', profile: this.migrateProfile(old) }];

      meta.activeVersionId = 'default';

      await chrome.storage.local.set({ [this.META_KEY]: meta });

      return meta;

    }

    meta.versions = [{ id: 'default', name: '通用版', profile: this.defaultProfile() }];

    meta.activeVersionId = 'default';

    await chrome.storage.local.set({ [this.META_KEY]: meta });

    return meta;

  },



  async getActiveProfile() {

    const meta = await this.getVersions();

    const v = meta.versions.find((x) => x.id === meta.activeVersionId) || meta.versions[0];

    const profile = this.migrateProfile(v?.profile);

    profile.sidebarGroups = this.buildSidebarGroups(profile);

    profile._versionName = v?.name || '通用版';

    profile._versionId = v?.id || 'default';

    return profile;

  },



  async setActiveVersion(id) {

    const meta = await this.getVersions();

    if (!meta.versions.some((v) => v.id === id)) throw new Error('简历版本不存在');

    meta.activeVersionId = id;

    await chrome.storage.local.set({ [this.META_KEY]: meta });

    return meta;

  },



  async saveVersion(id, name, profile) {

    const meta = await this.getVersions();

    const idx = meta.versions.findIndex((v) => v.id === id);

    const migrated = this.migrateProfile(profile);

    const entry = { id, name: name || '未命名', profile: migrated };

    if (idx >= 0) meta.versions[idx] = entry;

    else meta.versions.push(entry);

    await chrome.storage.local.set({ [this.META_KEY]: meta });

    await chrome.storage.local.set({ [this.STORAGE_KEY]: entry.profile });

    return entry;

  },



  async addVersion(name) {

    const id = JobTrackerConstants.uuid();

    const meta = await this.getVersions();

    const base = meta.versions.find((v) => v.id === meta.activeVersionId)?.profile || this.defaultProfile();

    meta.versions.push({ id, name: name || `简历${meta.versions.length + 1}`, profile: JSON.parse(JSON.stringify(this.migrateProfile(base))) });

    meta.activeVersionId = id;

    await chrome.storage.local.set({ [this.META_KEY]: meta });

    return meta;

  },



  async get() {

    return this.getActiveProfile();

  },



  async save(profile) {

    const meta = await this.getVersions();

    const id = meta.activeVersionId || 'default';

    const v = meta.versions.find((x) => x.id === id);

    const name = v?.name || '通用版';

    return this.saveVersion(id, name, profile);

  }

};

