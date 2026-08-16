#!/usr/bin/env node
/**
 * xhs-studio Design Lint (P0 stub) — 0 LLM, JSON-only structural checks.
 * Usage: node scripts/design-lint.js path/to/data.json
 *        cat data.json | node scripts/design-lint.js
 *
 * Future: wire Playwright render + bbox metrics (P1), optional vision (P2).
 */
"use strict";

const fs = require("fs");

const MAX_SAME_TYPE_RUN = 3;
const SUBSTANCE_TYPES = new Set([
  "points", "timeline", "card", "compare", "summary", "composite", "photo", "gallery", "free",
]);

function norm(s) {
  return String(s || "").replace(/\s+/g, "");
}

function pullQuoteDuplicatesParagraph(quote, paragraph) {
  const q = norm(quote);
  const p = norm(paragraph);
  if (!q || !p) return false;
  return q === p || (q.length >= 12 && p.includes(q));
}

function lintPage(page, index) {
  const findings = [];
  const i = index + 1;
  const type = page.type || "?";
  const where = (suffix) => `第${i}页·${type}${suffix ? "·" + suffix : ""}`;

  if (type === "free") {
    const pq = String(page.pullQuote || "").trim();
    if (pq) {
      const paras = (page.paragraphs || []).map((x) => String(x).trim()).filter(Boolean);
      if (paras.some((p) => pullQuoteDuplicatesParagraph(pq, p))) {
        findings.push({
          severity: "warn",
          code: "pull_quote_duplicate",
          message: "pullQuote 与正文段落重复，视觉会像两段一样的话叠在一起",
          where: where("pullQuote"),
          fix: { op: "deleteField", field: "pullQuote" },
        });
      }
      if (pq.length > 48) {
        findings.push({
          severity: "warn",
          code: "pull_quote_too_long",
          message: "拉引金句过长，quote/free 页易字堆",
          where: where("pullQuote"),
          fix: { op: "rewriteField", field: "pullQuote", hint: "≤24字或面试官原话" },
        });
      }
    }
    const paras = page.paragraphs || [];
    if (paras.length >= 4 && paras.every((p) => norm(p).length > 80)) {
      findings.push({
        severity: "warn",
        code: "text_pile_up",
        message: "free 页多段长文，易密排堆字",
        where: where("paragraphs"),
        fix: { op: "setDensity", value: "compact" },
      });
    }
  }

  if (type === "compare") {
    const rows = page.rows || [];
    const cols = page.columns || page.cols || [];
    if (rows.length > 6) {
      findings.push({
        severity: "warn",
        code: "compare_too_dense",
        message: "对比行数 >6，易 Excel 表格感",
        where: where("rows"),
        fix: { op: "setPageType", value: "summary" },
      });
    }
    const emptySides = rows.filter((r) => {
      const vals = r.values || r.cols || [];
      return vals.some((v) => norm(v).length < 2);
    }).length;
    if (emptySides > 0) {
      findings.push({
        severity: "error",
        code: "compare_incomplete",
        message: "对比格有空值或过短，版面会缺一块",
        where: where("rows"),
      });
    }
    if (cols.length === 2 && rows.length >= 4) {
      findings.push({
        severity: "info",
        code: "compare_variant_hint",
        message: "建议试 layout recipe compare:swipe-before-after 减表格感",
        where: where("layoutVariant"),
        fix: { op: "setLayoutVariant", value: "swipe-before-after" },
      });
    }
  }

  if (type === "timeline") {
    const steps = page.steps || [];
    if (steps.length > 5) {
      findings.push({
        severity: "warn",
        code: "timeline_too_many_steps",
        message: "时间线 >5 步，竖版易挤/溢出",
        where: where("steps"),
        fix: { op: "deleteItem", list: "steps", from: 5 },
      });
    }
    const longBodies = steps.filter((s) => norm(s.body || "").length > 72).length;
    if (longBodies >= 2) {
      findings.push({
        severity: "warn",
        code: "timeline_body_pile",
        message: "多步正文过长，timeline 易字堆",
        where: where("steps"),
        fix: { op: "setDensity", value: "compact" },
      });
    }
  }

  if (type === "quote") {
    const text = String(page.text || "").trim();
    if (text.length > 120) {
      findings.push({
        severity: "warn",
        code: "quote_too_long",
        message: "金句页文字过长，失去「一眼金句」观感",
        where: where("text"),
      });
    }
  }

  return findings;
}

function lintDocument(data) {
  const findings = [];
  const pages = (data && data.pages) || [];
  if (!pages.length) {
    return [{ severity: "error", code: "no_pages", message: "无页面", where: "pages" }];
  }

  let runType = null;
  let runLen = 0;
  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    if (!page || typeof page !== "object") continue;
    findings.push(...lintPage(page, idx));

    const t = page.type;
    if (SUBSTANCE_TYPES.has(t)) {
      if (t === runType) runLen += 1;
      else {
        runType = t;
        runLen = 1;
      }
      if (runLen > MAX_SAME_TYPE_RUN) {
        findings.push({
          severity: "warn",
          code: "same_type_run",
          message: `连续 ${runLen} 页同为 ${t}，节奏单调易审美疲劳`,
          where: `第${idx + 1}页·${t}`,
        });
      }
    } else {
      runType = null;
      runLen = 0;
    }
  }

  return findings;
}

function main() {
  const arg = process.argv[2];
  const raw = arg ? fs.readFileSync(arg, "utf8") : fs.readFileSync(0, "utf8");
  const data = JSON.parse(raw);
  const findings = lintDocument(data);
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const out = { ok: errors === 0, errors, warns, findings };
  console.log(JSON.stringify(out, null, 2));
  process.exit(errors > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = { lintDocument, lintPage };
