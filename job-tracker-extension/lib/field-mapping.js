const JobTrackerFieldMapping = {
  CN_NUM: { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 },

  CATEGORY_ALIASES: {

    internship: ['实习', 'intern', 'internship'],

    work: ['工作', '全职', '正式', 'work', 'employ'],

    project: ['项目', 'project'],

    research: ['科研', '研究', '实验室', 'research'],

    competition: ['竞赛', '比赛', 'contest'],

    campus: ['校园', '社团', '学生会', 'campus'],

    other: ['其他', 'other']

  },



  INDEX_WORDS: [

    { re: /最近|最新|当前/, index: 0 },

    { re: /第一|第1|一段/, index: 0 },

    { re: /第二|第2|二段/, index: 1 },

    { re: /第三|第3|三段/, index: 2 },

    { re: /第四|第4|四段/, index: 3 },

    { re: /第五|第5|五段/, index: 4 }

  ],



  RULES: [
    { keywords: ['证件号码', 'ID Number', '身份证件号码'], path: 'personalInfo.idNumber', priority: 110 },
    { keywords: ['国家/地区', 'Country/Region', '国籍/地区'], path: 'personalInfo.country', priority: 109 },
    { keywords: ['学校所在国家/地区', 'School Country', '院校所在国家', '学校所在国家'], path: 'education.schoolCountry', section: 'education', priority: 108 },
    { keywords: ['学历类型', 'Education Type', 'Degree Type'], path: 'education.degreeType', section: 'education', priority: 107 },
    { keywords: ['成绩排名', 'GPA Ranking', '班级排名', '专业排名'], path: 'education.ranking', section: 'education', priority: 106 },
    { keywords: ['是否全日制', 'Full-time or Not', 'Full-time'], path: 'education.trainingMode', section: 'education', priority: 105 },
    { keywords: ['是否有亲属在吉利', '亲属在吉利控股集团', '是否有亲属在吉利控股', '是否有亲属在吉利控股集团任职'], path: '_static.no', priority: 104 },
    { keywords: ['是否服从调配', '服从调配', '接受调配', '愿意调配'], path: '_static.yes', priority: 104 },
    { keywords: ['英语水平', 'English Level', '外语水平'], path: 'languages.level', section: 'languages', priority: 103 },
    { keywords: ['听说能力', '听说', '口语能力', '口语'], path: 'languages.speaking', section: 'languages', priority: 102 },
    { keywords: ['读写能力', '读写'], path: 'languages.reading', section: 'languages', priority: 102 },
    { keywords: ['技能证书', '证书名称', '资格证书', 'Certificate'], path: 'certificates.name', section: 'certificates', priority: 101 },
    { keywords: ['校园经历', '在校经历', '校园活动'], path: 'campus.title', section: 'campus', priority: 100 },
    { keywords: ['校园经历描述', '在校经历描述', '校园活动描述'], path: 'campus.description', section: 'campus', priority: 98 },
    { keywords: ['获奖名称', '获奖', '奖项名称', '奖励名称', '获奖经历'], path: 'awards.name', section: 'awards', priority: 101 },
    { keywords: ['自我评价', '个人评价', '自我介绍', 'about me', 'summary'], path: 'special.selfIntroduction', priority: 100 },

    { keywords: ['姓名', '真实姓名', '申请人姓名', '名字', 'name', 'full name', 'Name', 'Legal Name'], path: 'personalInfo.name', priority: 100 },
    { keywords: ['联系电话', '联系方式', 'contact phone', 'cell phone'], path: 'personalInfo.phone', priority: 99 },
    { keywords: ['现居住地', '现住址', '居住城市', 'current address'], path: 'personalInfo.currentCity', priority: 86 },
    { keywords: ['期望工作地', '意向工作地', 'preferred location'], path: 'jobIntent.expectedCity', priority: 89 },
    { keywords: ['就读时间', '在校时间', '学习时间'], path: 'education.startDate', section: 'education', priority: 84 },
    { keywords: ['毕业时间', '预计毕业'], path: 'education.endDate', section: 'education', priority: 84 },

    { keywords: ['移动电话', 'Mobile Phone', 'Mobile'], path: 'personalInfo.phone', priority: 108 },

    { keywords: ['电子邮箱', 'Email Address', 'Email'], path: 'personalInfo.email', priority: 108 },

    { keywords: ['性别', 'gender', 'Gender'], path: 'personalInfo.gender', priority: 100 },

    { keywords: ['出生', '生日', 'birth', 'birthday', 'dob', 'Date of Birth'], path: 'personalInfo.birthDate', priority: 100 },

    { keywords: ['手机', 'phone', 'mobile'], path: 'personalInfo.phone', priority: 98 },

    { keywords: ['电话', 'tel'], path: 'personalInfo.phone', priority: 85 },

    { keywords: ['邮箱', '邮件', 'email', 'e-mail'], path: 'personalInfo.email', priority: 100 },

    { keywords: ['证件类别', '证件类型', '身份证', 'Types of Certificates'], path: 'personalInfo.idType', priority: 94 },

    { keywords: ['证件号码', 'ID Number'], path: 'personalInfo.idNumber', priority: 96 },

    { keywords: ['id card', 'identity'], path: 'personalInfo.idNumber', priority: 88 },

    { keywords: ['民族', 'Ethnic Group'], path: 'personalInfo.ethnicity', priority: 90 },

    { keywords: ['政治面貌', 'Political Status'], path: 'personalInfo.politicalStatus', priority: 90 },

    { keywords: ['籍贯'], path: 'personalInfo.nativePlace', priority: 96 },

    { keywords: ['户籍', '户口'], path: 'personalInfo.nativePlace', priority: 84 },

    { keywords: ['现居', '居住', 'location', 'current city'], path: 'personalInfo.currentCity', priority: 80 },

    { keywords: ['微信', 'wechat', 'WeChat'], path: 'personalInfo.wechat', priority: 85 },

    { keywords: ['国家', '地区', '国籍', 'Nationality'], path: 'personalInfo.country', priority: 80 },

    { keywords: ['应届生届别', 'Graduation Year'], path: 'personalInfo.graduationYear', priority: 92 },

    { keywords: ['学习成绩', '绩点', 'Grade Point Average', 'GPA'], path: 'education@highest.gpa', section: 'education', priority: 94 },

    { keywords: ['成绩排名', 'GPA Ranking'], path: 'education@highest.ranking', section: 'education', priority: 93 },

    { keywords: ['语言等级', 'Language Proficiency Level'], path: 'languages.certificate', section: 'languages', priority: 90 },

    { keywords: ['语种', 'Language'], path: 'languages.language', section: 'languages', priority: 92 },

    { keywords: ['获得时间', 'Obtained Time'], path: 'languages.date', section: 'languages', priority: 85 },

    { keywords: ['毕业学校', 'School of Graduation', 'Graduation School'], path: 'education.school', section: 'education', priority: 104 },

    { keywords: ['是否全日制', 'Full-time or Not', 'Full-time'], path: 'education.trainingMode', section: 'education', priority: 93 },

    { keywords: ['是否统招', 'Unified Enrollment'], path: 'education.trainingMode', section: 'education', priority: 91 },

    { keywords: ['公司/单位名称', '公司/单位', 'Company/Organization', 'Company Name'], path: 'experience.organization', section: 'experience', category: 'internship', priority: 113 },

    { keywords: ['岗位（职务）名称', '岗位（职务）', 'Position', 'Job Title'], path: 'experience.role', section: 'experience', priority: 113 },

    { keywords: ['部门'], path: 'experience.department', section: 'experience', priority: 80 },

    { keywords: ['学习成绩', '绩点'], path: 'education@highest.gpa', section: 'education', priority: 94 },

    { keywords: ['成绩排名'], path: 'education@highest.ranking', section: 'education', priority: 93 },

    { keywords: ['应届生届别'], path: 'personalInfo.graduationYear', priority: 92 },

    { keywords: ['最低期望年薪'], path: 'jobIntent.expectedSalaryMin', priority: 88 },

    { keywords: ['最高期望年薪'], path: 'jobIntent.expectedSalaryMax', priority: 88 },

    { keywords: ['意向工作地点一', '意向工作地点'], path: 'jobIntent.expectedCity', priority: 94 },

    { keywords: ['特长爱好'], path: 'special.hobbies', priority: 88 },

    { keywords: ['语言等级'], path: 'languages.certificate', section: 'languages', priority: 90 },

    { keywords: ['语种'], path: 'languages.language', section: 'languages', priority: 92 },

    { keywords: ['学校名称', '学校', '院校', 'university', 'college', 'school'], path: 'education.school', section: 'education', priority: 102 },

    { keywords: ['学院', '院系', 'faculty', 'department'], path: 'education.college', section: 'education', priority: 90 },

    { keywords: ['年龄'], path: 'personalInfo.age', priority: 90 },

    { keywords: ['是否境外教育', '是否境外'], path: '_static.no', priority: 82 },

    { keywords: ['是否有境外工作', '是否有境外'], path: '_static.no', priority: 82 },

    { keywords: ['是否在比亚迪', '是否在本公司'], path: '_static.no', priority: 80 },

    { keywords: ['公司内是否有亲属', '是否有亲属'], path: '_static.no', priority: 80 },

    { keywords: ['是否受过处分'], path: '_static.no', priority: 78 },

    { keywords: ['挂科门数'], path: '_static.zero', priority: 78 },

    { keywords: ['电话所在区域'], path: '_static.phoneRegion', priority: 86 },

    { keywords: ['专业'], path: 'education.major', section: 'education', priority: 101 },

    { keywords: ['专业名称', 'major', 'Major'], path: 'education.major', section: 'education', priority: 102 },

    { keywords: ['学历', '学位', 'degree', 'Academic Qualifications'], path: 'education.type', section: 'education', priority: 95 },

    { keywords: ['gpa', '绩点'], path: 'education.gpa', section: 'education', priority: 95 },

    { keywords: ['排名', 'rank'], path: 'education.ranking', section: 'education', priority: 90 },

    { keywords: ['四级', 'cet4', 'cet-4'], path: 'education.cet4', section: 'education', priority: 90 },

    { keywords: ['六级', 'cet6', 'cet-6'], path: 'education.cet6', section: 'education', priority: 90 },

    { keywords: ['起止时间', 'Start - End Time', 'Start-End Time', 'Start and End'], path: 'education.startDate', section: 'education', priority: 88 },

    { keywords: ['入学', '开始时间', 'start date', 'from'], path: 'education.startDate', section: 'education', priority: 85 },

    { keywords: ['毕业', '结束时间', 'graduation', 'end date', 'to'], path: 'education.endDate', section: 'education', priority: 85 },

    { keywords: ['培养方式', '学制', '全日制'], path: 'education.trainingMode', section: 'education', priority: 80 },
    { keywords: ['硕士学校', '研究生学校', '硕士院校'], path: 'education@master.school', section: 'education', priority: 102 },
    { keywords: ['硕士专业', '研究生专业'], path: 'education@master.major', section: 'education', priority: 102 },
    { keywords: ['本科学校', '学士学校', '本科院校'], path: 'education@bachelor.school', section: 'education', priority: 102 },
    { keywords: ['本科专业', '学士专业'], path: 'education@bachelor.major', section: 'education', priority: 102 },
    { keywords: ['最高学历学校', '最高学历'], path: 'education@highest.school', section: 'education', priority: 101 },
    { keywords: ['单位名称', '实习单位', '实习公司'], path: 'experience.organization', section: 'experience', category: 'internship', priority: 110 },
    { keywords: ['实习岗位', '实习职位'], path: 'experience.role', section: 'experience', category: 'internship', priority: 110 },
    { keywords: ['实习内容', '实习描述'], path: 'experience.description', section: 'experience', category: 'internship', priority: 108 },

    { keywords: ['项目名称', '项目名', 'project name'], path: 'experience.organization', section: 'experience', category: 'project', priority: 108 },
    { keywords: ['项目描述', '项目介绍', '项目内容'], path: 'experience.description', section: 'experience', category: 'project', priority: 106 },
    { keywords: ['项目中职责', '项目职责', '本人职责'], path: 'experience.description', section: 'experience', category: 'project', priority: 104 },

    { keywords: ['在校职务名称', '职务名称', '校园职务'], path: 'campus.title', section: 'campus', priority: 105 },
    { keywords: ['在校职务描述', '职务描述'], path: 'campus.description', section: 'campus', priority: 103 },

    { keywords: ['公司', '单位', 'employer', 'organization', 'company'], path: 'experience.organization', section: 'experience', priority: 100 },

    { keywords: ['职位', '岗位', '职务', 'role', 'position', 'title'], path: 'experience.role', section: 'experience', priority: 100 },

    { keywords: ['工作内容', '工作描述', '职责', 'description', 'responsibilities'], path: 'experience.description', section: 'experience', priority: 90 },

    { keywords: ['起止时间', 'Start - End Time', 'Start-End Time'], path: 'experience.startDate', section: 'experience', priority: 88 },

    { keywords: ['实习开始', '工作开始', '项目开始'], path: 'experience.startDate', section: 'experience', priority: 85 },

    { keywords: ['实习结束', '工作结束', '项目结束'], path: 'experience.endDate', section: 'experience', priority: 85 },

    { keywords: ['自我评价', '自我介绍', '个人简介', 'about me', 'summary'], path: 'special.selfIntroduction', priority: 70 },

    { keywords: ['意向城市', '工作城市', 'work location'], path: 'personalInfo.targetCity', priority: 85 },

    { keywords: ['意向岗位', '期望岗位', 'applied position'], path: 'personalInfo.targetPosition', priority: 85 },

    { keywords: ['qq'], path: 'personalInfo.qq', priority: 88 },
    { keywords: ['证件类型'], path: 'personalInfo.idType', priority: 88 },
    { keywords: ['婚姻', 'marital'], path: 'personalInfo.maritalStatus', priority: 85 },
    { keywords: ['通信地址', '联系地址', '现居地址'], path: 'personalInfo.mailingAddress', priority: 88 },
    { keywords: ['国家', '地区', '国籍'], path: 'personalInfo.country', priority: 80 },
    { keywords: ['最高学历'], path: 'personalInfo.highestDegree', priority: 90 },
    { keywords: ['身高'], path: 'personalInfo.height', priority: 75 },
    { keywords: ['体重'], path: 'personalInfo.weight', priority: 75 },
    { keywords: ['健康'], path: 'personalInfo.healthStatus', priority: 75 },
    { keywords: ['特长', '爱好特长'], path: 'personalInfo.specialty', priority: 75 },
    { keywords: ['工作年限', '工龄'], path: 'personalInfo.workYears', priority: 80 },
    { keywords: ['紧急联系人', '紧急联系'], path: 'personalInfo.emergencyContactName', priority: 85 },
    { keywords: ['紧急联系人电话', '紧急联系电话'], path: 'personalInfo.emergencyContactPhone', priority: 85 },

    { keywords: ['预计入职', '入职时间', '到岗时间'], path: 'jobIntent.expectedStartDate', priority: 90 },
    { keywords: ['期望薪资', '期望工资', '薪资要求'], path: 'jobIntent.expectedSalary', priority: 90 },
    { keywords: ['期望城市', '期望工作城市'], path: 'jobIntent.expectedCity', priority: 90 },

    { keywords: ['奖励名称', '获奖名称', '奖项'], path: 'awards.name', section: 'awards', priority: 90 },
    { keywords: ['获奖时间', '奖励时间'], path: 'awards.date', section: 'awards', priority: 85 },
    { keywords: ['奖励等级', '奖项等级'], path: 'awards.level', section: 'awards', priority: 80 },

    { keywords: ['外语语种', '语种'], path: 'languages.language', section: 'languages', priority: 90 },
    { keywords: ['证书名称', '外语证书'], path: 'languages.certificate', section: 'languages', priority: 88 },
    { keywords: ['英语水平', '外语水平'], path: 'languages.level', section: 'languages', priority: 85 },
    { keywords: ['外语成绩', '雅思', '托福', 'ielts'], path: 'languages.score', section: 'languages', priority: 88 },
    { keywords: ['听说能力', '听说'], path: 'languages.speaking', section: 'languages', priority: 80 },
    { keywords: ['读写能力', '读写'], path: 'languages.reading', section: 'languages', priority: 80 },

    { keywords: ['技能类型', '计算机技能', '技能名称'], path: 'computerSkills.name', section: 'computerSkills', priority: 88 },
    { keywords: ['掌握程度', '熟练程度'], path: 'computerSkills.proficiency', section: 'computerSkills', priority: 85 },

    { keywords: ['证书编号'], path: 'certificates.number', section: 'certificates', priority: 85 },
    { keywords: ['证书说明'], path: 'certificates.description', section: 'certificates', priority: 80 },
    { keywords: ['获得时间', '证书时间'], path: 'certificates.date', section: 'certificates', priority: 85 },

    { keywords: ['家庭成员', '家属姓名', '父亲', '母亲'], path: 'family.name', section: 'family', priority: 85 },
    { keywords: ['关系', '与本人关系'], path: 'family.relation', section: 'family', priority: 85 },
    { keywords: ['家属电话', '家庭成员电话'], path: 'family.phone', section: 'family', priority: 85 },
    { keywords: ['家属公司', '家庭成员单位'], path: 'family.company', section: 'family', priority: 80 },
    { keywords: ['家属职位'], path: 'family.role', section: 'family', priority: 80 },

    { keywords: ['兴趣爱好', '爱好'], path: 'special.hobbies', priority: 75 },

    { keywords: ['生源地'], path: 'personalInfo.originPlace', priority: 90 },
    { keywords: ['最高学位'], path: 'personalInfo.highestDegree', priority: 88 },
    { keywords: ['学习形式', '培养方式'], path: 'education.trainingMode', section: 'education', priority: 85 },
    { keywords: ['英语等级成绩', '外语成绩', '雅思成绩'], path: 'languages.score', section: 'languages', priority: 92 },
    { keywords: ['英语等级', '外语等级'], path: 'languages.certificate', section: 'languages', priority: 90 },
    { keywords: ['语言类型', '外语语种'], path: 'languages.language', section: 'languages', priority: 90 },
    { keywords: ['掌握程度'], path: 'languages.proficiency', section: 'languages', priority: 82 },
    { keywords: ['到岗时间', '期望到岗'], path: 'jobIntent.expectedStartDate', priority: 88 },
    { keywords: ['期望工作城市', '工作城市'], path: 'jobIntent.expectedCity', priority: 92 },
    { keywords: ['班级排名', '专业排名'], path: 'education.ranking', section: 'education', priority: 88 },
    { keywords: ['成绩', 'gpa', '绩点'], path: 'education.gpa', section: 'education', priority: 90 }

  ],



  parseIndex(label) {

    const text = String(label || '');

    for (const { re, index } of this.INDEX_WORDS) {

      if (re.test(text)) return index;

    }

    const m = text.match(/第([一二三四五六七八九十\d]+)/);

    if (m) {

      const n = this.CN_NUM?.[m[1]] || parseInt(m[1], 10);

      if (n > 0) return n - 1;

    }

    return 0;

  },



  parseCategory(label) {

    const text = String(label || '').toLowerCase();

    for (const [cat, aliases] of Object.entries(this.CATEGORY_ALIASES)) {

      if (aliases.some((a) => text.includes(a.toLowerCase()))) return cat;

    }

    return null;

  },



  getNestedValue(obj, path) {

    const parts = path.split('.');

    let cur = obj;

    for (const p of parts) {

      if (!cur || typeof cur !== 'object') return '';

      cur = cur[p];

    }

    if (Array.isArray(cur)) return cur.join('、');

    return cur == null ? '' : String(cur);

  },



  ANCHOR_FIELDS: {
    education: 'school',
    experience: 'organization',
    awards: 'name',
    family: 'name',
    campus: 'title',
    languages: 'language',
    certificates: 'name',
    computerSkills: 'name'
  },

  DEPENDENT_FIELDS: {
    education: ['startDate', 'endDate', 'major', 'type', 'degree', 'gpa', 'ranking', 'college', 'trainingMode', 'schoolCountry', 'degreeType', 'cet4', 'cet6'],
    experience: ['startDate', 'endDate', 'role', 'description', 'department'],
    awards: ['date', 'level'],
    family: ['relation', 'phone', 'company', 'role'],
    campus: ['description'],
    languages: ['certificate', 'level', 'score', 'speaking', 'reading', 'proficiency', 'date'],
    certificates: ['number', 'description', 'date'],
    computerSkills: ['proficiency']
  },

  inferSection(sectionCtx) {
    if (sectionCtx?.section) return sectionCtx.section;
    const title = sectionCtx?.sectionTitle || '';
    if (/教育经历|教育背景|Education Experience/i.test(title)) return 'education';
    if (/工作\/实习|Work.*Internship|实习经历/i.test(title)) return 'experience';
    if (/工作经历|Work Experience/i.test(title)) return 'experience';
    if (/项目经历|Project/i.test(title)) return 'experience';
    if (/获奖|award/i.test(title)) return 'awards';
    if (/家庭|家属|family/i.test(title)) return 'family';
    if (/校园|Campus/i.test(title)) return 'campus';
    if (/语言|Language/i.test(title)) return 'languages';
    if (/证书/i.test(title)) return 'certificates';
    return null;
  },

  getSectionList(profile, section, sectionContext) {
    if (section === 'education') {
      if (this.shouldUseEducationChronological(sectionContext)) {
        return this.getEducationChronological(profile);
      }
      return profile.education || [];
    }
    if (section === 'experience') {
      const category = sectionContext?.category || null;
      return this.getExperienceList(profile, category, sectionContext);
    }
    return profile[section] || [];
  },

  anchorMatches(a, b) {
    const sa = String(a || '').trim();
    const sb = String(b || '').trim();
    if (!sa || !sb) return false;
    if (sa === sb) return true;
    const normA = JobTrackerTextUtils.stripCompanySuffix(sa);
    const normB = JobTrackerTextUtils.stripCompanySuffix(sb);
    if (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) return true;
    return JobTrackerTextUtils.similarity(sa, sb) >= 0.72;
  },

  findEntryByAnchor(list, anchorField, anchorName) {
    if (!anchorName || !list?.length) return null;
    let best = null;
    let bestScore = 0;
    for (const entry of list) {
      const val = entry[anchorField];
      if (!this.anchorMatches(val, anchorName)) continue;
      const score = JobTrackerTextUtils.similarity(String(val || ''), anchorName);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return best;
  },

  isDependentField(section, field) {
    const anchor = this.ANCHOR_FIELDS[section];
    if (!anchor || !field || field === anchor) return false;
    const deps = this.DEPENDENT_FIELDS[section];
    return deps ? deps.includes(field) : true;
  },

  resolveBlockEntry(profile, sectionCtx, options = {}) {
    const section = this.inferSection(sectionCtx);
    if (!section) return null;
    const list = this.getSectionList(profile, section, sectionCtx);
    if (!list.length) return null;

    const index = sectionCtx?.blockIndex ?? 0;
    let entry = list[index] ?? list[0];
    const field = options.field;
    const anchorName = sectionCtx?.blockAnchorName;
    const anchorField = this.ANCHOR_FIELDS[section];

    if (anchorName && anchorField && field && this.isDependentField(section, field)) {
      const matched = this.findEntryByAnchor(list, anchorField, anchorName);
      if (matched) return matched;
      if (entry && !this.anchorMatches(entry[anchorField], anchorName)) return null;
    }
    return entry;
  },

  findEducation(profile, hint) {
    return JobTrackerResumeStorage.pickEducation(profile.education, hint);
  },

  getEducationChronological(profile) {
    return [...(profile.education || [])].sort((a, b) =>
      String(a.startDate || '9999').localeCompare(String(b.startDate || '9999'))
    );
  },

  /** 仅「教育经历-N」等编号区块按时间正序；教育背景/无编号走简历数组顺序 */
  shouldUseEducationChronological(sectionContext) {
    if (!sectionContext) return false;
    const title = String(sectionContext.sectionTitle || '').replace(/\s/g, '');
    if (!title) return false;
    if (/教育背景|Education Background/i.test(title)) return false;
    if (/教育经历-\d+|Education Experience-\d+/i.test(title)) return true;
    if (typeof JobTrackerFormSection !== 'undefined') {
      const numbered = JobTrackerFormSection.matchNumberedSection(title);
      if (numbered && /教育经历|Education Experience/i.test(numbered.blockKey || '')) return true;
    }
    return false;
  },

  getEducationValue(profile, field, index = 0, degreeHint = null, sectionContext = null) {
    let entry;
    if (degreeHint) {
      entry = this.findEducation(profile, degreeHint);
    } else {
      const ctx = { ...(sectionContext || {}), section: 'education', blockIndex: index };
      entry = this.resolveBlockEntry(profile, ctx, { field });
    }
    if (!entry) return '';
    if (field === 'schoolCountry') {
      return entry.schoolCountry || profile.personalInfo?.country || '中国';
    }
    if (field === 'degreeType') {
      return this.normalizeDegreeType(entry.degreeType || entry.trainingMode || '');
    }
    let val = entry[field] == null ? '' : String(entry[field]);
    if (/trainingMode|全日制|统招/.test(field) || (sectionContext && /是否/.test(sectionContext.sectionTitle || ''))) {
      val = this.normalizeYesNoTraining(val);
    }
    return val;
  },

  normalizeYesNoTraining(val) {
    const s = String(val || '').trim();
    if (!s) return '';
    if (/全日制|统招|是/.test(s)) return '是';
    return s;
  },

  normalizeDegreeType(val) {
    const s = String(val || '').trim();
    if (!s) return '';
    if (/普通高等院校|统招|全日制/.test(s)) return '普通高等教育';
    if (/成人/.test(s)) return '成人高等教育';
    if (/自考|自学/.test(s)) return '自学考试';
    if (/网络/.test(s)) return '网络教育';
    return s;
  },

  normalizeDegreeLabel(val) {
    const s = String(val || '').trim();
    if (!s) return '';
    if (/博士/.test(s)) return '博士';
    if (/硕士|研究生/.test(s)) return '硕士';
    if (/本科|学士/.test(s)) return '本科';
    if (/专科|大专|高职/.test(s)) return '大专';
    if (/高中/.test(s)) return '高中';
    return s;
  },

  resolveDateField(field, label, sectionContext) {
    if (!/起止/.test(label || '')) return field;
    if (field !== 'startDate' && field !== 'endDate') return field;
    return 'startDate';
  },

  formatFillValue(value, label, rule, sectionContext) {
    let v = String(value ?? '').trim();
    if (!v) return '';
    const lab = `${label || ''} ${rule?.path || ''}`;
    if (/是否全日制|是否统招/.test(lab) && /全日制|统招/.test(v)) return '是';
    if (/是否境外/.test(lab) && !v) return '否';
    if (/是否有境外/.test(lab) && !v) return '否';
    if (/trainingMode/.test(rule?.path || '') && /是否/.test(label || '')) return this.normalizeYesNoTraining(v);
    if (/degreeType/.test(rule?.path || '') || /学历类型/.test(label || '')) {
      v = this.normalizeDegreeType(v);
    }
    if (/education\.(type|degree)/.test(rule?.path || '') || (/学历/.test(label || '') && !/学历类型/.test(label || ''))) {
      v = this.normalizeDegreeLabel(v);
    }
    if (/gender|性别/.test(`${rule?.path || ''}${label || ''}`)) {
      if (/男/.test(v)) return '男';
      if (/女/.test(v)) return '女';
    }
    return v;
  },

  getExperienceList(profile, category, sectionContext) {
    let list = profile.experience || [];
    const title = sectionContext?.sectionTitle || '';
    if (/工作\/实习/.test(title)) {
      return list.filter((x) => x.category === 'internship' || x.category === 'work');
    }
    if (category) list = list.filter((x) => x.category === category);
    return list;
  },

  getEducationValueLegacy(profile, field, index = 0, degreeHint = null) {
    const list = profile.education || [];
    let entry;
    if (degreeHint) entry = this.findEducation(profile, degreeHint);
    else entry = list[index] || list[0];
    if (!entry) return '';
    return entry[field] == null ? '' : String(entry[field]);
  },



  getExperienceValue(profile, field, index = 0, category = null, sectionContext = null) {
    const ctx = {
      ...(sectionContext || {}),
      section: sectionContext?.section || this.inferSection(sectionContext) || 'experience',
      category: category || sectionContext?.category,
      blockIndex: index
    };
    const entry = this.resolveBlockEntry(profile, ctx, { field });
    if (!entry) return '';
    let val = entry[field] == null ? '' : String(entry[field]);
    if (field === 'endDate' && !val.trim()) return '至今';
    return val;
  },

  getArraySectionValue(profile, section, field, index = 0, sectionContext = null) {
    const ctx = { ...(sectionContext || {}), section, blockIndex: index };
    const entry = this.resolveBlockEntry(profile, ctx, { field });
    if (!entry) return '';
    return entry[field] == null ? '' : String(entry[field]);
  },



  computeAge(birthDate) {
    const raw = String(birthDate || '').trim();
    if (!raw) return '';
    const m = raw.match(/(\d{4})[-/.](\d{1,2})/);
    if (!m) return '';
    const birth = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const md = now.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
    return age > 0 && age < 80 ? String(age) : '';
  },

  getStaticDefault(profile, rawLabel, label, sectionContext) {
    const text = `${rawLabel || ''} ${label || ''}`;
    const p = profile.personalInfo || {};
    if (/是否境外|是否有境外|是否在比亚迪|是否有亲属|是否受过处分|是否有亲属在吉利|亲属在吉利/.test(text)) return '否';
    if (/是否服从调配|服从调配|接受调配/.test(text)) return '是';
    if (/挂科/.test(text)) return '0';
    if (/电话所在区域/.test(text)) return '+86';
    if (/年龄/.test(text)) return this.computeAge(p.birthDate);
    if (/国籍/.test(text) && p.country) return p.country;
    if (/民族/.test(text) && p.ethnicity) return p.ethnicity;
    if (/政治面貌/.test(text) && p.politicalStatus) return p.politicalStatus;
    if (/证件类别|证件类型/.test(text) && p.idType) return p.idType;
    if (/学校所在/.test(text) && /国家|地区/.test(text)) return p.country || '中国';
    if (/籍贯/.test(text)) return p.nativePlacePath || p.nativePlace || p.originPlace || '';
    if (/生源地/.test(text) && p.originPlace) return p.originPlace;
    if (/现居|居住/.test(text) && p.currentCity) return p.currentCity;
    if (/语言等级/.test(text) && profile.languages?.[0]?.certificate) {
      return profile.languages[0].certificate;
    }
    if (/成绩/.test(text) && /语言/.test(text) && profile.languages?.[0]?.score) {
      return profile.languages[0].score;
    }
    return '';
  },

  getRangeDates(profile, sectionContext) {
    const index = sectionContext?.blockIndex ?? 0;
    const section = sectionContext?.section || this.inferSection(sectionContext) || 'education';
    const category = sectionContext?.category;
    const ctx = { ...(sectionContext || {}), section, blockIndex: index };
    if (section === 'experience') {
      return {
        start: this.getExperienceValue(profile, 'startDate', index, category, ctx),
        end: this.getExperienceValue(profile, 'endDate', index, category, ctx)
      };
    }
    return {
      start: this.getEducationValue(profile, 'startDate', index, null, ctx),
      end: this.getEducationValue(profile, 'endDate', index, null, ctx)
    };
  },

  resolveFieldValue(profile, rawLabel, label, sectionCtx, hints) {
    const rule = this.matchLabel(label, hints || {});
    let value = rule ? this.getValueForRule(profile, rule, label, sectionCtx) : '';
    if (!value) value = this.matchSidebarItem(label, profile.sidebarGroups);
    if (!value) value = this.getStaticDefault(profile, rawLabel, label, sectionCtx);
    if (!value && rule?.path?.startsWith('_static.')) {
      if (rule.path === '_static.no') value = '否';
      if (rule.path === '_static.yes') value = '是';
      if (rule.path === '_static.zero') value = '0';
      if (rule.path === '_static.phoneRegion') value = '+86';
    }
    return { rule, value };
  },

  getValue(profile, path, label = '') {
    const alt = String(path).match(/^education@(master|bachelor|highest)\.(\w+)$/);
    if (alt) path = `education.${alt[2]}@${alt[1]}`;
    const rule = { path, section: path.startsWith('education') ? 'education' : path.startsWith('experience') ? 'experience' : null };

    return this.getValueForRule(profile, rule, label);
  },

  getValueForRule(profile, rule, label = '', sectionContext = null) {
    if (!rule?.path) return '';
    let path = rule.path;
    let degreeHint = null;
    const inlineEdu = path.match(/^education@(master|bachelor|highest)\.(\w+)$/);
    if (inlineEdu) {
      degreeHint = inlineEdu[1];
      path = 'education.' + inlineEdu[2];
    } else {
      const degreeM = path.match(/@(master|bachelor|highest)$/);
      if (degreeM) {
        degreeHint = degreeM[1];
        path = path.replace(/@(master|bachelor|highest)$/, '');
      }
    }
    const parts = path.split('.');
    let field = parts[parts.length - 1];
    field = this.resolveDateField(field, label, sectionContext);
    const index = sectionContext?.blockIndex ?? this.parseIndex(label);
    const category = rule.category || sectionContext?.category || this.parseCategory(label);

    if (rule.section === 'education' || path.startsWith('education.')) {
      let idx = index;
      if (/最高|最近/.test(label || '') && (profile.education || []).length) idx = 0;
      const raw = this.getEducationValue(profile, field, idx, degreeHint, sectionContext);
      return this.formatFillValue(raw, label, rule, sectionContext);
    }
    if (rule.section === 'experience' || path.startsWith('experience.')) {
      const raw = this.getExperienceValue(profile, field, index, category, sectionContext);
      return this.formatFillValue(raw, label, rule, sectionContext);
    }
    const arraySections = ['awards', 'languages', 'computerSkills', 'certificates', 'family', 'campus'];
    if (arraySections.includes(rule.section) || arraySections.some((s) => path.startsWith(`${s}.`))) {
      const sec = rule.section || path.split('.')[0];
      return this.getArraySectionValue(profile, sec, field, index, sectionContext);
    }
    if (path.startsWith('jobIntent.')) {
      return this.getNestedValue(profile, path);
    }
    if (path === 'personalInfo.nativePlace' && /籍贯/.test(label || '')) {
      const p = profile.personalInfo || {};
      return p.nativePlacePath || p.nativePlace || '';
    }
    if (path === 'personalInfo.graduationYear') {
      const direct = this.getNestedValue(profile, path);
      if (direct) return direct;
      const highest = this.findEducation(profile, 'highest');
      const y = String(highest?.endDate || '').match(/\d{4}/);
      return y ? y[0] : '';
    }
    if (path === 'personalInfo.age') {
      return this.computeAge(profile.personalInfo?.birthDate);
    }
    if (path.startsWith('_static.')) {
      if (path === '_static.no') return '否';
      if (path === '_static.yes') return '是';
      if (path === '_static.zero') return '0';
      if (path === '_static.phoneRegion') return '+86';
    }
    return this.getNestedValue(profile, path);
  },



  matchLabel(label, hints) {

    const result = JobTrackerFieldMatcher.matchLabel(label, hints);

    return result.rule;

  },



  matchLabelDetailed(label, hints) {

    return JobTrackerFieldMatcher.matchLabel(label, hints);

  },



  matchSidebarItem(label, groups) {

    const q = (label || '').trim().toLowerCase();

    if (!q) return '';

    for (const g of groups || []) {

      for (const item of g.items || []) {

        const l = (item.label || '').toLowerCase();

        if (l === q || q.includes(l) || l.includes(q)) return item.value || '';

      }

    }

    return '';

  }

};

