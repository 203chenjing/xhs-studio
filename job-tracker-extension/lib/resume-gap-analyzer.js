const JobTrackerResumeGapAnalyzer = {
  /** @returns {{ id:string, path:string, label:string, question:string, placeholder:string, priority:string, inputType:string }[]} */
  analyze(profile, options = {}) {
    const max = options.maxQuestions ?? 8;
    const gaps = [];
    const p = profile?.personalInfo || {};
    const ji = profile?.jobIntent || {};
    const s = profile?.special || {};

    const push = (path, label, question, placeholder = '', priority = 'medium', inputType = 'text') => {
      if (this.getPathValue(profile, path)) return;
      gaps.push({ id: path, path, label, question, placeholder, priority, inputType });
    };

    push('personalInfo.name', '姓名', '请填写您的姓名', '张三', 'high');
    push('personalInfo.phone', '手机号', '请填写手机号码', '13812345678', 'high');
    push('personalInfo.email', '邮箱', '请填写常用邮箱', 'name@example.com', 'high');
    push('personalInfo.gender', '性别', '请填写性别', '男/女', 'medium');
    push('personalInfo.birthDate', '出生日期', '请填写出生日期', '2000-01-01', 'medium');
    push('personalInfo.idNumber', '证件号码', '请填写身份证号', '', 'medium');
    push('personalInfo.wechat', '微信号', '请填写微信号', '', 'low');
    push('personalInfo.qq', 'QQ', '请填写 QQ 号', '', 'low');
    push('personalInfo.ethnicity', '民族', '请填写民族', '汉族', 'low');
    push('personalInfo.politicalStatus', '政治面貌', '请填写政治面貌', '中共党员/群众', 'low');
    push('personalInfo.mailingAddress', '通信地址', '请填写现居/通信地址', '', 'medium');
    push('personalInfo.currentCity', '现居城市', '请填写现居城市', '上海', 'medium');
    push('personalInfo.emergencyContactName', '紧急联系人', '请填写紧急联系人姓名', '', 'low');
    push('personalInfo.emergencyContactPhone', '紧急联系人电话', '请填写紧急联系人电话', '', 'low');

    push('jobIntent.expectedStartDate', '预计入职', '预计何时可以入职？', '2026-08-31', 'medium');
    push('jobIntent.expectedCity', '期望城市', '期望工作在哪个城市？', '上海/北京', 'medium');
    push('jobIntent.expectedSalary', '期望薪资', '期望月薪（税前）？', '15000', 'low');

    const educations = profile?.education || [];
    if (!educations.length || !educations.some((e) => e.school)) {
      push('education.0.school', '学校', '请填写最高学历学校名称', '上海大学', 'high');
      push('education.0.major', '专业', '请填写所学专业', '管理科学与工程', 'high');
    } else {
      educations.forEach((e, i) => {
        const tag = e.type || e.degree || `第${i + 1}段`;
        if (!e.school) {
          push(`education.${i}.school`, `${tag}·学校`, `请补充${tag}的学校名称`, '', 'high');
        }
        if (!e.major) {
          push(`education.${i}.major`, `${tag}·专业`, `请补充${tag}的专业`, '', 'medium');
        }
        if (!e.startDate || !e.endDate) {
          push(
            `education.${i}.startDate`,
            `${tag}·时间`,
            `请补充${tag}的起止时间（如 2020-09 至 2024-06）`,
            '2020-09-01',
            'medium'
          );
        }
      });
    }

    const experiences = (profile?.experience || []).filter(
      (x) => x.organization || x.role || x.description
    );
    if (!experiences.length) {
      push(
        'experience.0.organization',
        '项目/经历',
        '是否有项目或实习经历？请填写公司/项目名称',
        'ResumeAI',
        'medium',
        'text'
      );
    } else {
      experiences.forEach((x, i) => {
        if (!x.description || x.description.length < 40) {
          push(
            `experience.${i}.description`,
            `${x.organization || '经历'}·描述`,
            `请补充「${x.organization || x.role || '该段经历'}」的主要工作内容（可粘贴 bullet）`,
            '负责…；实现…',
            'medium',
            'textarea'
          );
        }
      });
    }

    if (!s.selfIntroduction || s.selfIntroduction.length < 30) {
      push(
        'special.selfIntroduction',
        '自我评价',
        '请用 2-3 句话介绍您的优势（或粘贴自我评价段落）',
        '',
        'low',
        'textarea'
      );
    }

    if (!(profile?.languages || []).some((l) => l.language || l.score)) {
      push('languages.0.language', '外语', '是否有外语成绩？如：英语 雅思 7', '英语', 'low');
    }

    const order = { high: 0, medium: 1, low: 2 };
    return gaps.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, max);
  },

  getPathValue(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return '';
      if (/^\d+$/.test(part)) {
        cur = cur[Number(part)];
      } else {
        cur = cur[part];
      }
    }
    if (cur == null) return '';
    return String(cur).trim();
  },

  setPathValue(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextIsIndex = /^\d+$/.test(parts[i + 1]);
      if (/^\d+$/.test(part)) {
        const idx = Number(part);
        if (!Array.isArray(cur)) return;
        if (!cur[idx]) cur[idx] = nextIsIndex ? [] : {};
        cur = cur[idx];
      } else {
        if (!cur[part]) cur[part] = nextIsIndex ? [] : {};
        cur = cur[part];
      }
    }
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      cur[Number(last)] = value;
    } else {
      cur[last] = value;
    }
  },

  applyAnswers(profile, answers = []) {
    const next = JSON.parse(JSON.stringify(profile || {}));
    for (const a of answers) {
      const val = String(a?.value ?? '').trim();
      if (!a?.path || !val) continue;
      this.ensurePathContainers(next, a.path);
      this.setPathValue(next, a.path, val);
    }
    return JobTrackerResumeStorage.normalizeProfile(next);
  },

  ensurePathContainers(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];
      if (/^\d+$/.test(part)) {
        const idx = Number(part);
        if (!Array.isArray(cur)) return;
        while (cur.length <= idx) {
          if (nextPart && /^\d+$/.test(nextPart)) cur.push([]);
          else if (path.startsWith('education.')) cur.push(JobTrackerResumeStorage.defaultEducation());
          else if (path.startsWith('experience.')) cur.push(JobTrackerResumeStorage.defaultExperience('project'));
          else if (path.startsWith('languages.')) cur.push(JobTrackerResumeStorage.defaultLanguage());
          else cur.push({});
        }
        cur = cur[idx];
      } else {
        if (!cur[part]) {
          if (part === 'education' || part === 'experience' || part === 'languages') cur[part] = [];
          else if (part === 'jobIntent') cur[part] = JobTrackerResumeStorage.defaultJobIntent();
          else if (part === 'personalInfo') cur[part] = {};
          else if (part === 'special') cur[part] = { selfIntroduction: '', hobbies: '' };
          else cur[part] = {};
        }
        cur = cur[part];
      }
    }
  }
};
