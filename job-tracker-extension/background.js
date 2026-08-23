importScripts(

  'lib/constants.js',

  'lib/text-utils.js',

  'lib/entity-resolution.js',

  'lib/fusion-scorer.js',

  'lib/fill-session.js',

  'lib/storage.js',

  'lib/pending-storage.js',

  'lib/confidence.js',

  'lib/settings.js',

  'lib/ai.js',

  'lib/resume-storage.js',

  'lib/resume-parser.js',

  'lib/resume-gap-analyzer.js'

);



chrome.runtime.onInstalled.addListener(() => {

  JobTrackerStorage.updateBadge();

});



async function enhanceRecord(record, pageContext) {

  const settings = await JobTrackerSettings.get();

  if (!settings.ai?.autoEnhance) return record;

  if (!JobTrackerAI.shouldUseAi(settings, record, pageContext?.source || record.source)) {

    return record;

  }

  try {

    const aiData = await JobTrackerAI.extract(pageContext || { url: record.url }, settings, record);

    return JobTrackerAI.mergeRecord(record, aiData, settings.ai.mode);

  } catch (_) {

    return record;

  }

}



function applyFusion(record, pageContext) {

  const fusion = JobTrackerFusionScorer.score(record, pageContext);

  const out = { ...record };

  if (fusion.company) out.company = fusion.company;

  if (fusion.position) out.position = fusion.position;

  out.confidence = fusion.confidence;

  out.fusionSignals = fusion.signals;

  return out;

}



async function mergeFillSession(record, pageContext) {
  const session = await JobTrackerFillSession.get();
  if (!session || !JobTrackerFillSession.isRecent(session)) return record;
  const draft = { ...record, url: record.url || pageContext?.url || session.url };
  return JobTrackerFillSession.mergeIntoRecord(draft, session);
}

async function saveWithRouting(record, pageContext) {
  const now = new Date();
  let enhanced = applyFusion(await enhanceRecord(record, pageContext), pageContext);
  enhanced = await mergeFillSession(enhanced, pageContext);

  const auto = pageContext?.ruleExtraction?.auto;
  const hasIdentity = enhanced.company || enhanced.position;
  const hasSuccessContext = auto?.status && (enhanced.platform || enhanced.note);

  if (!hasIdentity && !hasSuccessContext) {
    return { ok: false, error: '无法识别公司与岗位' };
  }

  if (!enhanced.company && enhanced.platform && auto?.status) {
    enhanced.company = enhanced.platform;
  }

  if (!enhanced.applyDate) {
    enhanced.applyDate = JobTrackerConstants.formatApplyDate(now);
  }
  if (!enhanced.recordDate) {
    enhanced.recordDate = JobTrackerConstants.formatDate(now);
  }
  if (!enhanced.url && pageContext?.url) {
    enhanced.url = pageContext.url;
  }

  const active = await JobTrackerResumeStorage.getActiveProfile();
  const meta = await JobTrackerResumeStorage.getVersions();
  if (!enhanced.resumeVersion && active._versionName) {
    enhanced.resumeVersion = active._versionName;
  }
  if (!enhanced.resumeVersionId && meta.activeVersionId) {
    enhanced.resumeVersionId = meta.activeVersionId;
  }
  if (!enhanced.fillStatus && enhanced.status) {
    enhanced.fillStatus = enhanced.status;
  }

  if (JobTrackerConfidence.shouldConfirm(enhanced.confidence, enhanced.source, pageContext)) {
    enhanced.confirmed = false;
    enhanced.pendingMeta = '自动捕获，待你确认';
    const pending = await JobTrackerPending.add(enhanced);
    return { ok: true, pending: true, record: pending, confidence: enhanced.confidence };
  }



  enhanced.confirmed = true;

  const saved = await JobTrackerStorage.save(enhanced);

  return {

    ok: true,

    pending: false,

    record: saved,

    confidence: enhanced.confidence,

    aiUsed: enhanced.source?.includes('ai')

  };

}



chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  (async () => {

    if (msg.type === 'SAVE_RECORD') {

      sendResponse(await saveWithRouting(msg.record, msg.pageContext));

      return;

    }

    if (msg.type === 'GET_ALL') {

      sendResponse({ ok: true, records: await JobTrackerStorage.getAll() });

      return;

    }

    if (msg.type === 'GET_PENDING') {

      sendResponse({ ok: true, pending: await JobTrackerPending.getAll() });

      return;

    }

    if (msg.type === 'CONFIRM_PENDING') {

      const saved = await JobTrackerPending.confirm(msg.id, msg.patch || {});

      sendResponse({ ok: true, record: saved });

      return;

    }

    if (msg.type === 'DISMISS_PENDING') {

      await JobTrackerPending.remove(msg.id);

      sendResponse({ ok: true });

      return;

    }

    if (msg.type === 'AI_ENHANCE_PENDING') {

      const settings = await JobTrackerSettings.get();

      if (!settings.ai?.useForPending) {

        sendResponse({ ok: false, error: '待确认 AI 补充已关闭' });

        return;

      }

      if (!settings.ai?.enabled) {

        sendResponse({ ok: false, error: '请先在设置页启用 AI 并保存 API Key' });

        return;

      }

      const list = await JobTrackerPending.getAll();

      const item = list.find((r) => r.id === msg.id);

      if (!item) {

        sendResponse({ ok: false, error: '待确认记录不存在' });

        return;

      }

      const pageContext = msg.pageContext || {

        url: item.url,

        title: '',

        text: '',

        ruleExtraction: {

          company: item.company,

          position: item.position,

          platform: item.platform

        }

      };

      try {

        const aiData = await JobTrackerAI.extract(pageContext, settings, item);

        const merged = applyFusion(JobTrackerAI.mergeRecord(item, aiData, 'fallback'), pageContext);

        merged.source = item.source ? `${item.source}+ai-pending` : 'ai-pending';

        const updated = await JobTrackerPending.update(msg.id, merged);

        sendResponse({ ok: true, record: updated });

      } catch (err) {

        sendResponse({ ok: false, error: err.message || 'AI 补充失败' });

      }

      return;

    }

    if (msg.type === 'DELETE_RECORD') {

      await JobTrackerStorage.remove(msg.id);

      sendResponse({ ok: true });

      return;

    }

    if (msg.type === 'UPDATE_RECORD') {

      const updated = await JobTrackerStorage.update(msg.id, msg.patch);

      sendResponse({ ok: true, record: updated });

      return;

    }

    if (msg.type === 'IMPORT_RECORDS') {

      const count = await JobTrackerStorage.importRecords(msg.records);

      sendResponse({ ok: true, count });

      return;

    }

    if (msg.type === 'GET_SETTINGS') {

      sendResponse({ ok: true, settings: await JobTrackerSettings.get() });

      return;

    }

    if (msg.type === 'SAVE_SETTINGS') {

      try {

        sendResponse({ ok: true, settings: await JobTrackerSettings.save(msg.patch) });

      } catch (err) {

        sendResponse({ ok: false, error: err.message || '保存设置失败' });

      }

      return;

    }

    if (msg.type === 'GET_RESUME') {

      sendResponse({ ok: true, profile: await JobTrackerResumeStorage.getActiveProfile() });

      return;

    }

    if (msg.type === 'GET_RESUME_VERSIONS') {

      const meta = await JobTrackerResumeStorage.getVersions();

      sendResponse({ ok: true, meta });

      return;

    }

    if (msg.type === 'OPEN_EXTENSION_PAGE') {
      const path = String(msg.path || 'resume/resume.html').replace(/^\//, '');
      await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'IMPORT_SEED_PROFILE') {
      try {
        const url = chrome.runtime.getURL('data/profile-ai-product-general.json');
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('无法读取内置档案');
        const data = await resp.json();
        const profile = JobTrackerResumeStorage.normalizeProfile(data.profile || data);
        await JobTrackerResumeStorage.save(profile);
        sendResponse({ ok: true, name: data.name || 'AI产品通用', profile });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || '导入失败' });
      }
      return true;
    }

    if (msg.type === 'SET_ACTIVE_VERSION') {

      const meta = await JobTrackerResumeStorage.setActiveVersion(msg.id);

      sendResponse({ ok: true, meta });

      return;

    }

    if (msg.type === 'ADD_RESUME_VERSION') {

      const meta = await JobTrackerResumeStorage.addVersion(msg.name);

      sendResponse({ ok: true, meta });

      return;

    }

    if (msg.type === 'SAVE_RESUME') {

      const profile = await JobTrackerResumeStorage.save(msg.profile);

      sendResponse({ ok: true, profile });

      return;

    }

    if (msg.type === 'AI_PARSE_RESUME') {

      const text = String(msg.text || '').trim();

      if (!text) {

        sendResponse({ ok: false, error: '请先粘贴简历文本' });

        return;

      }

      const settings = await JobTrackerSettings.get();

      const mode = JobTrackerSettings.normalizeResumeParseMode(settings.ai?.resumeParseMode);

      const forceLocal = !!msg.forceLocal;

      if (forceLocal || mode === 'local-only') {

        const localResult = JobTrackerResumeParser.parse(text);

        const localProfile = JobTrackerResumeParser.parseText(text);

        const localQuestions = JobTrackerResumeGapAnalyzer.analyze(localProfile);

        sendResponse({

          ok: true,

          profile: localProfile,

          source: 'local',

          summary: JobTrackerResumeParser.previewSummary(localResult),

          stats: localResult.stats,

          questions: localQuestions,

          needsFollowUp: localQuestions.length > 0

        });

        return;

      }

      const keyValidation = JobTrackerSettings.validateApiKey(settings.ai?.apiKey);

      const resumeParseOn = settings.ai?.resumeParse !== false;

      if (!resumeParseOn) {

        const localResult = JobTrackerResumeParser.parse(text);

        const localProfile = JobTrackerResumeParser.parseText(text);

        const localQuestions = JobTrackerResumeGapAnalyzer.analyze(localProfile);

        sendResponse({

          ok: true,

          profile: localProfile,

          source: 'local',

          summary: JobTrackerResumeParser.previewSummary(localResult),

          stats: localResult.stats,

          questions: localQuestions,

          needsFollowUp: localQuestions.length > 0

        });

        return;

      }

      if (!keyValidation.valid) {

        sendResponse({ ok: false, error: '请先在设置配置 API Key' });

        return;

      }

      try {

        const aiProfile = await JobTrackerAI.parseResume(text, settings);

        let profile = aiProfile;

        let source = 'ai';

        if (mode === 'ai-first') {

          const localParsed = JobTrackerResumeParser.parseText(text);

          profile = JobTrackerResumeParser.mergeProfile(aiProfile, localParsed, { overwrite: false });

          source = 'ai-first';

        }

        const previewResult = { profile, stats: JobTrackerResumeParser.parse(text).stats };

        const localGaps = JobTrackerResumeGapAnalyzer.analyze(profile);
        let questions = localGaps;
        if (localGaps.length && !msg.skipFollowUp) {
          try {
            questions = await JobTrackerAI.generateFollowUpQuestions(profile, text, settings, localGaps);
          } catch (_) {
            questions = localGaps;
          }
        }

        sendResponse({

          ok: true,

          profile,

          source,

          summary: JobTrackerResumeParser.previewSummary(previewResult),

          stats: previewResult.stats,

          questions,

          needsFollowUp: questions.length > 0

        });

      } catch (err) {

        if (mode === 'ai-only') {

          sendResponse({ ok: false, error: err.message || 'AI 解析失败' });

          return;

        }

        const localResult = JobTrackerResumeParser.parse(text);

        const localProfile = JobTrackerResumeParser.parseText(text);

        const localQuestions = JobTrackerResumeGapAnalyzer.analyze(localProfile);

        sendResponse({

          ok: true,

          profile: localProfile,

          source: 'local-fallback',

          fallback: true,

          summary: JobTrackerResumeParser.previewSummary(localResult),

          stats: localResult.stats,

          questions: localQuestions,

          needsFollowUp: localQuestions.length > 0,

          error: err.message || 'AI 解析失败'

        });

      }

      return;

    }

    if (msg.type === 'AI_RESUME_MERGE_ANSWERS') {

      const settings = await JobTrackerSettings.get();

      const profile = msg.profile || {};

      const answers = msg.answers || [];

      const freeform = msg.freeform || '';

      const sourceText = msg.sourceText || '';

      try {

        let merged = await JobTrackerAI.mergeResumeFollowUp(profile, answers, freeform, sourceText, settings);

        const questions = JobTrackerResumeGapAnalyzer.analyze(merged);

        sendResponse({

          ok: true,

          profile: merged,

          questions,

          needsFollowUp: questions.length > 0,

          summary: JobTrackerResumeParser.previewSummary({ profile: merged })

        });

      } catch (err) {

        sendResponse({ ok: false, error: err.message || '合并补充信息失败' });

      }

      return;

    }

    if (msg.type === 'AI_EXTRACT') {

      const settings = await JobTrackerSettings.get();

      const hasKey = !!String(settings.ai?.apiKey || '').trim();

      if (!settings.ai?.enabled) {

        sendResponse({ ok: false, error: '请先在设置页勾选「启用 AI 增强」并点击「保存设置」' });

        return;

      }

      if (!hasKey) {

        sendResponse({ ok: false, error: 'API Key 未保存：请在设置页填写 Key 后点击「保存设置」' });

        return;

      }

      const aiData = await JobTrackerAI.extract(msg.pageContext, settings, null, {

        timeoutMs: JobTrackerAI.TEST_TIMEOUT_MS

      });

      sendResponse({ ok: true, data: aiData });

      return;

    }

    if (msg.type === 'GET_FILL_SESSION') {
      const session = await JobTrackerFillSession.get();
      sendResponse({ ok: true, session, summary: JobTrackerFillSession.getSummary(session) });
      return;
    }

    if (msg.type === 'FILL_SESSION_START') {
      const session = await JobTrackerFillSession.ensureSession(msg.ctx || {});
      sendResponse({ ok: true, session, summary: JobTrackerFillSession.getSummary(session) });
      return;
    }

    if (msg.type === 'FILL_SESSION_TRACK') {
      const session = await JobTrackerFillSession.trackFill(msg.label, msg.meta || {});
      sendResponse({ ok: true, session, summary: JobTrackerFillSession.getSummary(session) });
      return;
    }

    if (msg.type === 'FILL_SESSION_TRACK_BULK') {
      const session = await JobTrackerFillSession.trackBulk(msg.items || []);
      sendResponse({ ok: true, session, summary: JobTrackerFillSession.getSummary(session) });
      return;
    }

    if (msg.type === 'FILL_SESSION_COMPLETE') {
      const session = await JobTrackerFillSession.complete();
      sendResponse({ ok: true, session, summary: JobTrackerFillSession.getSummary(session) });
      return;
    }

    if (msg.type === 'AI_FILL_ESSAY') {
      const settings = await JobTrackerSettings.get();
      const profile = await JobTrackerResumeStorage.getActiveProfile();
      try {
        const result = await JobTrackerAI.fillAssistEssay(msg.question, profile, settings);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'AI 写开放题失败' });
      }
      return;
    }

    if (msg.type === 'AI_MATCH_AUTOFILL_FIELD') {

      const settings = await JobTrackerSettings.get();

      if (settings.ai?.autofillAssist === false) {

        sendResponse({ ok: false, error: 'AI 填表辅助已关闭' });

        return;

      }

      const profile = await JobTrackerResumeStorage.getActiveProfile();

      try {

        const result = await JobTrackerAI.matchAutofillField(msg.field || {}, profile, settings);

        sendResponse(result);

      } catch (err) {

        sendResponse({ ok: false, error: err.message || 'AI 字段匹配失败' });

      }

      return;

    }

    if (msg.type === 'AI_MATCH_AUTOFILL_FIELDS_BATCH') {
      const settings = await JobTrackerSettings.get();
      if (settings.ai?.autofillAssist === false) {
        sendResponse({ ok: false, error: 'AI 填表辅助已关闭' });
        return;
      }
      const profile = await JobTrackerResumeStorage.getActiveProfile();
      try {
        const result = await JobTrackerAI.matchAutofillFieldsBatch(msg.fields || [], profile, settings);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'AI 批量匹配失败' });
      }
      return;
    }

    if (msg.type === 'AI_AGENT_FORM_PLAN') {
      const settings = await JobTrackerSettings.get();
      if (settings.ai?.autofillAssist === false || settings.ai?.autofillAgent === false) {
        sendResponse({ ok: false, error: 'Agent 填表已关闭' });
        return;
      }
      const profile = await JobTrackerResumeStorage.getActiveProfile();
      try {
        const result = await JobTrackerAI.planAgentFormFill(msg.snapshot || {}, profile, settings, msg.round || 0);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'Agent 规划失败' });
      }
      return;
    }

    if (msg.type === 'AI_SUGGEST_RESUME') {
      const settings = await JobTrackerSettings.get();
      const meta = await JobTrackerResumeStorage.getVersions();
      try {
        const result = await JobTrackerAI.suggestResumeVersion(
          msg.jdText || '',
          meta.versions || [],
          settings,
          { useAi: !!msg.useAi }
        );
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message || '推荐失败' });
      }
      return;
    }

  })().catch((err) => sendResponse({ ok: false, error: err.message }));

  return true;

});

