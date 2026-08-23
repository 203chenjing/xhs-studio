const JobTrackerExtractHeuristics = (() => {
  const PRIORITY = { jsonld: 80, meta: 60, title: 50, breadcrumb: 40, selectors: 35, urlpath: 30, body: 20 };

  function textOf(el) {
    return (el?.textContent || el?.content || el?.getAttribute?.('content') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanCompany(name) {
    const raw = String(name || '')
      .replace(/[-_|·].*?(招聘|校招|校园|官网|人才).*$/i, '')
      .replace(/\s*(校园招聘|社会招聘|校招|秋招|春招|官方招聘|人才招聘|加入我们|招聘官网).*$/i, '')
      .trim();
    if (typeof JobTrackerTextUtils !== 'undefined') {
      return JobTrackerTextUtils.normalizeCompany(raw);
    }
    return raw;
  }

  function cleanPosition(name) {
    return String(name || '')
      .replace(/\s*[-_|]\s*.*?(公司|集团|科技|有限).*$/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .replace(/\s*(招聘|校招|实习).*$/i, '')
      .trim();
  }

  function fromJsonLd() {
    const scripts = document.querySelectorAll?.('script[type="application/ld+json"]') || [];
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item) continue;
          const type = item['@type'];
          const types = Array.isArray(type) ? type : [type];
          if (types.some((t) => /JobPosting/i.test(t))) {
            const org = item.hiringOrganization || item.employer || {};
            const company = typeof org === 'string' ? org : org.name || org.legalName || '';
            const position = item.title || item.name || '';
            if (company || position) {
              return {
                source: 'jsonld',
                priority: PRIORITY.jsonld,
                company: cleanCompany(company),
                position: cleanPosition(position)
              };
            }
          }
        }
      } catch (_) {}
    }
    return null;
  }

  function fromMeta() {
    const ogTitle = document.querySelector?.('meta[property="og:title"]')?.content || '';
    const site = document.querySelector?.('meta[property="og:site_name"]')?.content || '';
    const desc = document.querySelector?.('meta[name="description"]')?.content || '';
    let company = cleanCompany(site);
    let position = '';
    if (ogTitle) {
      const parts = ogTitle.split(/[-_|·—–/／]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        company = company || cleanCompany(parts[parts.length - 1]);
        position = cleanPosition(parts[0]);
      } else if (!position) {
        position = cleanPosition(parts[0] || '');
      }
    }
    const companyInDesc = desc.match(/(.{2,20}?)(?:公司|集团|科技|银行|网络)?(?:招聘|校招)/);
    if (!company && companyInDesc) company = cleanCompany(companyInDesc[1]);
    if (!company && !position) return null;
    return { source: 'meta', priority: PRIORITY.meta, company, position };
  }

  function fromTitle() {
    const title = document.title || '';
    const parts = title.split(/[-_|·—–/／]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1];
    if (/招聘|校招|校园|人才|join|career|jobs/i.test(last)) {
      return {
        source: 'title',
        priority: PRIORITY.title,
        company: cleanCompany(parts[parts.length - 2] || ''),
        position: cleanPosition(parts[0])
      };
    }
    return {
      source: 'title',
      priority: PRIORITY.title,
      company: cleanCompany(last),
      position: cleanPosition(parts[0])
    };
  }

  function fromBreadcrumb() {
    const el = document.querySelector?.('[class*="breadcrumb"], [class*="bread-crumb"], nav[aria-label*="breadcrumb" i]');
    if (!el) return null;
    const seg = textOf(el)
      .split(/[>/›]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!seg.length) return null;
    const companySeg = seg.find((s) => /集团|事业|公司|部|科技|有限/i.test(s)) || seg[0];
    const positionSeg = seg.length >= 2 ? seg[seg.length - 1] : '';
    return {
      source: 'breadcrumb',
      priority: PRIORITY.breadcrumb,
      company: cleanCompany(companySeg),
      position: cleanPosition(positionSeg)
    };
  }

  function fromCommonSelectors() {
    const companySels = [
      '[itemprop="hiringOrganization"]',
      '[data-testid*="company"]',
      '[class*="employer-name"]',
      '[class*="corp-name"]'
    ];
    const positionSels = [
      '[itemprop="title"]',
      '[data-testid*="job-title"]',
      '[data-testid*="position"]',
      'h1[class*="job"]',
      'h1[class*="title"]'
    ];
    let company = '';
    let position = '';
    for (const sel of companySels) {
      const t = textOf(document.querySelector?.(sel));
      if (t && t.length < 60) {
        company = cleanCompany(t);
        break;
      }
    }
    for (const sel of positionSels) {
      const t = textOf(document.querySelector?.(sel));
      if (t && t.length < 80) {
        position = cleanPosition(t);
        break;
      }
    }
    if (!company && !position) return null;
    return { source: 'selectors', priority: PRIORITY.selectors, company, position };
  }

  function fromUrlPath(url = location.href) {
    try {
      const u = new URL(url);
      const qp = u.searchParams;
      const qTitle =
        qp.get('jobTitle') ||
        qp.get('positionName') ||
        qp.get('position') ||
        qp.get('job_name') ||
        qp.get('title') ||
        '';
      if (qTitle) {
        return {
          source: 'urlpath',
          priority: PRIORITY.urlpath,
          company: '',
          position: cleanPosition(decodeURIComponent(qTitle))
        };
      }
      const segs = u.pathname.split('/').filter(Boolean);
      const anchorIdx = segs.findIndex((s) =>
        /^(job|jobs|position|positions|post|posts|role|opening|campus|apply|detail)$/i.test(s)
      );
      if (anchorIdx >= 0) {
        const slug = decodeURIComponent(segs[anchorIdx + 1] || '');
        if (slug && !/^\d+$/.test(slug) && slug.length >= 2) {
          return {
            source: 'urlpath',
            priority: PRIORITY.urlpath,
            company: '',
            position: cleanPosition(slug.replace(/[-_+]/g, ' '))
          };
        }
      }
    } catch (_) {}
    return null;
  }

  function fromBodyPatterns() {
    const text = document.body?.innerText?.slice(0, 8000) || '';
    let company = '';
    let position = '';
    const companyMatch = text.match(/(?:招聘(?:主体|单位|公司)|所属(?:公司|组织|部门)|公司名称)[：:\s]+([^\n，,；;]{2,30})/);
    const positionMatch = text.match(/(?:职位名称|岗位名称|应聘职位|申请职位|职位)[：:\s]+([^\n，,；;]{2,40})/);
    if (companyMatch) company = cleanCompany(companyMatch[1]);
    if (positionMatch) position = cleanPosition(positionMatch[1]);
    if (!company && !position) return null;
    return { source: 'body', priority: PRIORITY.body, company, position };
  }

  function mergeField(sources, field) {
    const ranked = sources
      .filter((s) => s[field])
      .sort((a, b) => b.priority - a.priority);
    if (!ranked.length) return { value: '', source: '' };
    return { value: ranked[0][field], source: ranked[0].source };
  }

  function computeQuality(companyOrObj, position, sources, ruleId = '') {
    let company;
    let positionVal;
    let srcList;
    let rid;
    if (companyOrObj && typeof companyOrObj === 'object') {
      company = companyOrObj.company;
      positionVal = companyOrObj.position;
      const raw = companyOrObj.sources || companyOrObj.extractionSources || [];
      srcList = raw.map((s) => (typeof s === 'string' ? { source: s, priority: 1 } : s));
      rid = position;
    } else {
      company = companyOrObj;
      positionVal = position;
      srcList = sources || [];
      rid = ruleId;
    }
    let q = 0;
    if (company) q += 36;
    if (positionVal) q += 36;
    const names = srcList.map((s) => s.source);
    if (names.includes('jsonld')) q += 14;
    if (names.includes('meta')) q += 8;
    if (names.includes('breadcrumb')) q += 6;
    if (names.includes('selectors')) q += 6;
    if (names.includes('urlpath')) q += 5;
    if (rid && rid !== 'generic' && rid !== 'none') q += 8;
    if (company && positionVal) q += 6;
    return Math.min(100, q);
  }

  function extract(url = location.href, ruleId = '') {
    const sources = [];
    for (const fn of [fromJsonLd, fromMeta, fromTitle, fromBreadcrumb, fromCommonSelectors, () => fromUrlPath(url), fromBodyPatterns]) {
      const hit = fn();
      if (hit) sources.push(hit);
    }
    const company = mergeField(sources, 'company');
    const position = mergeField(sources, 'position');
    const extractionSources = [...new Set(sources.map((s) => s.source))];
    return {
      company: company.value,
      position: position.value,
      companySource: company.source,
      positionSource: position.source,
      extractionSources,
      matchQuality: computeQuality(company.value, position.value, sources, ruleId)
    };
  }

  return { extract, computeQuality, PRIORITY };
})();
