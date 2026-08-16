# -*- coding: utf-8 -*-
"""Content review — 「2+1」主路径第 ② 次 LLM（生成后 / 用户主动复审）。

无 Key 或失败时走规则审核（0 次 LLM）。不要在每次单页改写后自动全量 review。
"""
from __future__ import annotations

import json
import re
from typing import Any

from design_lint import design_lint
from pipeline import _api_meta, _chat_json, _has_api_key
from prompts.copy_playbook import check_copy_quality, infer_content_type
from timing import TimingTracker

SYSTEM_REVIEW = """你是小红书图文内容审核员。检查文案是否有明显错误、空洞、矛盾、缺信息、对比表不完整、疑似编造精确数字、以及「整篇逻辑是否一眼可读」等问题。

只输出 JSON（不要 markdown）：
{
  "verdict": "pass" | "warn" | "fail",
  "issues": [
    { "severity": "error" | "warn" | "info", "message": "中文问题描述", "where": "位置，如 title / caption / 第3页·compare / 结构" }
  ],
  "suggestions": ["可选的中文修改建议"],
  "title": "若建议改标题可给出，否则省略或原样",
  "caption": "若建议改正文可给出，否则省略或原样"
}

判定：
- pass：无明显问题，可进入排版
- warn：有瑕疵但不阻断（空洞句、轻微缺信息、数字可疑、页标题跳跃、缺主线、结构建议、简历腔、无 hook 标题、页内 emoji 等）
- fail：仅事实/内容硬伤（标题或 caption 为空、关键页正文完全缺失、compare 两侧明显空、明显自相矛盾）
注意：页序/模块组合是软建议——中间结构可由 AI 自由编排，不要因「不是固定七页」「缺 chapter」「类型顺序不标准」判 fail。
但若翻页像拼盘、标题跳戏、看不出主题句，请给 warn（结构清晰度）。

要求：issues 用中文、具体可定位；不要吹毛求疵；不要编造用户未提供的事实。
文案对照 playbook：面经/干货/清单语气、标题 hook、caption 结构、禁止页内 emoji、避免简历腔。
"""


def _issue(
    severity: str,
    message: str,
    where: str,
    *,
    category: str = "copy",
    code: str = "",
    fix_hint: str = "",
    page_index: int | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "severity": severity,
        "message": message,
        "where": where,
        "category": category,
    }
    if code:
        out["code"] = code
    if fix_hint:
        out["fix_hint"] = fix_hint
    if page_index is not None:
        out["page_index"] = page_index
    return out


def _text_len(s: Any) -> int:
    return len(re.sub(r"\s+", "", str(s or "")))


def _looks_fabricated_numbers(text: str) -> bool:
    """Heuristic: suspiciously precise stats without soft wording."""
    t = text or ""
    if re.search(r"\d{2,3}%", t) and not re.search(r"(约|左右|大概|亲测|实测|据|官方)", t):
        return True
    if re.search(r"(提升|增长|下降|节省)\s*\d{2,}", t) and "约" not in t:
        return True
    return False


def _title_tokens(s: str) -> set[str]:
    s = re.sub(r"\s+", "", str(s or ""))
    # 粗粒度：连续 2 字片段，用于检测标题是否完全无关
    return {s[i : i + 2] for i in range(max(0, len(s) - 1))} if len(s) >= 2 else ({s} if s else set())


def _check_structure_clarity(
    pages: list,
    issues: list[dict[str, str]],
    suggestions: list[str],
    *,
    title: str = "",
    intent: str = "",
) -> None:
    """页标题跳跃 / 缺主线 → warn（逻辑清晰优先，不因模板形态 fail）。"""
    if not isinstance(pages, list) or len(pages) < 2:
        return

    titles: list[str] = []
    roles: list[str] = []
    for i, page in enumerate(pages):
        if not isinstance(page, dict):
            continue
        ptype = page.get("type") or "?"
        if ptype == "quote":
            pt = re.sub(r"\s+", " ", str(page.get("text") or "")).strip()[:36]
        else:
            pt = re.sub(r"\s+", " ", str(page.get("title") or "").replace("\n", " ")).strip()[:36]
        titles.append(pt)
        roles.append(str(page.get("role") or "").strip())

        if i > 0 and ptype not in ("cover", "ending") and not page.get("role"):
            issues.append(
                _issue("info", "建议补叙事角色 role（钩子/痛点/方法…），方便读者定位进度", f"第{i + 1}页·{ptype}")
            )

    # 相邻标题几乎无共享字元，且无 bridge → 可能跳戏
    jump_n = 0
    for i in range(1, len(pages)):
        a, b = pages[i - 1], pages[i]
        if not isinstance(a, dict) or not isinstance(b, dict):
            continue
        if b.get("type") in ("cover", "ending"):
            continue
        if a.get("type") == "cover" and i == 1:
            # 封面→第一页允许反差 hook；有角色/桥接则不算跳戏
            if b.get("bridge") or b.get("role") in ("痛点", "章节", "方法", "共鸣", "价值"):
                continue
        ta, tb = titles[i - 1] if i - 1 < len(titles) else "", titles[i] if i < len(titles) else ""
        if not ta or not tb or len(ta) < 4 or len(tb) < 4:
            continue
        overlap = _title_tokens(ta) & _title_tokens(tb)
        if not overlap and not b.get("bridge"):
            jump_n += 1
            if jump_n <= 2:
                issues.append(
                    _issue(
                        "warn",
                        f"页标题可能跳跃：「{ta[:14]}」→「{tb[:14]}」，读者不易看出承接",
                        f"第{i + 1}页·结构",
                    )
                )
    if jump_n >= 2:
        suggestions.append("给跳戏页补 bridge（承接上一页一句），或改标题让主线更清楚")

    # 缺主线：封面主题词几乎不出现在中间页
    cover = next((p for p in pages if isinstance(p, dict) and p.get("type") == "cover"), None)
    theme_bits = ""
    if cover:
        theme_bits = str(cover.get("title") or "") + str(cover.get("subtitle") or "")
    theme_bits = theme_bits or title or intent
    theme_tokens = {tok for tok in _title_tokens(theme_bits) if len(tok) >= 2}
    # 过滤过于常见的虚词片段
    stop = {"一个", "如何", "怎么", "可以", "我们", "自己", "这个", "就是", "什么", "不是"}
    theme_tokens = {t for t in theme_tokens if t not in stop}
    if theme_tokens and len(pages) >= 4:
        mid_blob = ""
        for p in pages[1:-1]:
            if isinstance(p, dict):
                mid_blob += str(p.get("title") or "") + str(p.get("intro") or "") + str(p.get("body") or "")
        mid_tokens = _title_tokens(mid_blob)
        hit = len(theme_tokens & mid_tokens)
        if hit == 0:
            issues.append(
                _issue("warn", "中间页几乎看不到封面主题词，主线可能断裂（像拼盘）", "结构")
            )
            suggestions.append("用一句话主题贯穿各页标题，或补 logic_summary 再改写跳戏页")

    # 角色序列是否只有「干货」堆叠、缺少钩子/行动感
    meaningful = [r for r in roles if r]
    if meaningful and "钩子" not in meaningful and pages[0].get("type") == "cover":
        pass  # cover 默认可视为钩子
    pain_like = any(r in ("痛点", "共鸣", "价值", "章节") for r in meaningful)
    method_like = any(r in ("方法", "证据", "对比", "干货", "展开") for r in meaningful)
    if len(pages) >= 5 and not pain_like:
        issues.append(_issue("warn", "结构上缺少痛点/共鸣层，读者可能不知道「为什么要看」", "结构"))
    if len(pages) >= 5 and not method_like:
        issues.append(_issue("warn", "结构上缺少方法/干货层，信息密度可能不足", "结构"))


def rule_review(
    data: dict,
    *,
    title: str = "",
    caption: str = "",
    intent: str = "",
) -> dict[str, Any]:
    """Deterministic checks used when LLM unavailable or as baseline merge."""
    issues: list[dict[str, str]] = []
    suggestions: list[str] = []
    pages = data.get("pages") if isinstance(data, dict) else None
    if not isinstance(pages, list) or not pages:
        issues.append(_issue("error", "没有页面内容，无法排版", "data.pages"))
        return {
            "verdict": "fail",
            "issues": issues,
            "suggestions": ["请重新生成一套完整图文"],
            "mode": "rules",
        }

    t = (title or "").strip()
    c = (caption or "").strip()
    if not t:
        issues.append(_issue("error", "标题为空", "title"))
    elif _text_len(t) < 6:
        issues.append(_issue("warn", "标题过短，吸引力可能不足", "title"))
        suggestions.append("把标题加长到约 16–28 字，可加数字或反差")

    if not c:
        issues.append(_issue("error", "发布正文 caption 为空", "caption"))
    elif _text_len(c) < 40:
        issues.append(_issue("warn", "发布正文过短，不像可直接粘贴的笔记", "caption"))
        suggestions.append("补充钩子 + 3–6 句干货 + 话题标签")
    elif "#" not in c:
        issues.append(_issue("warn", "正文缺少话题标签（#）", "caption"))
        suggestions.append("文末补 5–8 个相关 #话题")

    types = [p.get("type") for p in pages if isinstance(p, dict)]
    # 结构建议：不阻断（schema 会软补首尾）
    if "cover" not in types:
        issues.append(_issue("warn", "建议有封面 cover（系统可软补）", "pages"))
        suggestions.append("建议以 cover 开头增强点击欲，但不强制固定模板")
    if "ending" not in types:
        issues.append(_issue("warn", "建议有结尾 ending（系统可软补）", "pages"))
        suggestions.append("建议以 ending 收束 CTA/标签，中间页可自由编排")
    if types and types[0] != "cover":
        issues.append(_issue("info", "建议 cover 放在第一页（软引导）", "pages"))
    if types and types[-1] != "ending":
        issues.append(_issue("info", "建议 ending 放在最后一页（软引导）", "pages"))

    for i, page in enumerate(pages):
        if not isinstance(page, dict):
            issues.append(_issue("warn", "页面结构异常，系统将尝试兜底渲染", f"第{i + 1}页"))
            continue
        ptype = page.get("type") or "?"
        where = f"第{i + 1}页·{ptype}"

        if ptype == "cover":
            if _text_len(page.get("title")) < 4:
                issues.append(_issue("error", "封面标题过短或为空", where))
            if _text_len(page.get("subtitle") or "") < 8:
                issues.append(_issue("warn", "封面副标题信息量偏少", where))

        elif ptype == "points":
            items = page.get("items") if isinstance(page.get("items"), list) else []
            if len(items) < 2:
                issues.append(_issue("warn", "要点页条目偏少", where))
            for j, it in enumerate(items):
                if not isinstance(it, dict):
                    continue
                blen = _text_len(it.get("body"))
                if blen < 12:
                    issues.append(
                        _issue("warn", f"第 {j + 1} 条正文过短/空洞", f"{where}·item{j + 1}")
                    )
                if blen and blen < 20:
                    suggestions.append(f"{where} 第{j + 1}条：补场景+细节+结论，写到 2–3 句")

        elif ptype == "timeline":
            steps = page.get("steps") if isinstance(page.get("steps"), list) else []
            if len(steps) < 2:
                issues.append(_issue("warn", "时间线步骤偏少", where))
            for j, st in enumerate(steps):
                if isinstance(st, dict) and _text_len(st.get("body")) < 10:
                    issues.append(_issue("warn", f"步骤 {j + 1} 说明过短", f"{where}·step{j + 1}"))

        elif ptype == "card":
            if _text_len(page.get("body")) < 20:
                issues.append(_issue("warn", "卡片正文过短", where))

        elif ptype == "free":
            paras = page.get("paragraphs") if isinstance(page.get("paragraphs"), list) else []
            bullets = page.get("bullets") if isinstance(page.get("bullets"), list) else []
            plen = sum(_text_len(x) for x in paras) + sum(_text_len(x) for x in bullets)
            if plen < 20 and _text_len(page.get("body")) < 20:
                issues.append(_issue("warn", "自由页正文偏少", where))

        elif ptype == "compare":
            rows = page.get("rows") if isinstance(page.get("rows"), list) else []
            cols = page.get("cols") if isinstance(page.get("cols"), list) else []
            if len(cols) < 3:
                issues.append(_issue("warn", "对比表列数不足（建议维度+左右共 3 列）", where))
            if len(rows) < 2:
                issues.append(_issue("warn", "对比表行数偏少", where))
            for j, row in enumerate(rows):
                if not isinstance(row, dict):
                    continue
                vals = row.get("values")
                if not isinstance(vals, list) or len(vals) != 2:
                    issues.append(
                        _issue("warn", f"第 {j + 1} 行 values 建议长度为 2", f"{where}·row{j + 1}")
                    )
                    continue
                for k, v in enumerate(vals):
                    if _text_len(v) < 4:
                        issues.append(
                            _issue(
                                "error",
                                f"第 {j + 1} 行第 {k + 1} 侧内容过短或为空",
                                f"{where}·row{j + 1}",
                            )
                        )

        elif ptype == "summary":
            items = page.get("items") if isinstance(page.get("items"), list) else []
            if len(items) < 3:
                issues.append(_issue("warn", "总结条数偏少", where))

        elif ptype == "composite":
            blocks = page.get("blocks") if isinstance(page.get("blocks"), list) else []
            if len(blocks) < 1:
                issues.append(_issue("warn", "组合页缺少子模块", where))

        elif ptype == "ending":
            tags = page.get("tags") if isinstance(page.get("tags"), list) else []
            if len(tags) < 3:
                issues.append(_issue("warn", "结尾话题标签偏少", where))
            if not page.get("cta") and _text_len(page.get("desc")) < 8:
                issues.append(_issue("warn", "结尾缺少明确 CTA", where))

        elif ptype not in (
            "cover", "chapter", "points", "timeline", "card", "quote",
            "compare", "summary", "ending", "composite", "photo", "gallery", "free",
        ):
            issues.append(_issue("info", f"未知类型 {ptype}，渲染将降级为 card", where))

        # fabricated numbers scan on page texts
        blob = json.dumps(page, ensure_ascii=False)
        if _looks_fabricated_numbers(blob):
            issues.append(_issue("warn", "疑似编造精确数据（建议加「约/亲测」或删数字）", where))

    if _looks_fabricated_numbers(c):
        issues.append(_issue("warn", "发布正文含可疑精确数字", "caption"))

    if intent and t and intent[:8] not in t and intent[:8] not in c:
        # soft relevance check only
        pass

    # --- 结构清晰度：页标题是否跳跃、是否缺主线（warn，不阻断） ---
    _check_structure_clarity(pages, issues, suggestions, title=t, intent=intent)

    # --- 文案 playbook：hook / 简历腔 / emoji / caption ---
    ctype = infer_content_type(intent, "")
    for ci in check_copy_quality(data, title=t, caption=c, content_type=ctype):
        issues.append(
            _issue(ci["severity"], ci["message"], ci["where"], category="copy")
        )

    # --- 版式 / 排版 Agent（0 LLM，JSON 结构规则）---
    for fi in design_lint(data):
        issues.append(
            _issue(
                fi["severity"],
                fi["message"],
                fi.get("where") or "",
                category="layout",
                code=str(fi.get("code") or ""),
                fix_hint=str(fi.get("fix_hint") or ""),
                page_index=fi.get("page_index"),
            )
        )

    has_error = any(x["severity"] == "error" for x in issues)
    has_warn = any(x["severity"] == "warn" for x in issues)
    if has_error:
        verdict = "fail"
    elif has_warn:
        verdict = "warn"
    else:
        verdict = "pass"

    # dedupe suggestions
    seen: set[str] = set()
    uniq_sug: list[str] = []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            uniq_sug.append(s)
    if has_error and not uniq_sug:
        uniq_sug.append("先修复标为错误的问题，再确认排版")

    return {
        "verdict": verdict,
        "issues": issues,
        "suggestions": uniq_sug[:12],
        "mode": "rules",
    }


def _normalize_review(raw: dict, *, title: str, caption: str) -> dict[str, Any]:
    verdict = str(raw.get("verdict") or "warn").lower().strip()
    if verdict not in ("pass", "warn", "fail"):
        verdict = "warn"
    issues_in = raw.get("issues") if isinstance(raw.get("issues"), list) else []
    issues: list[dict[str, Any]] = []
    for it in issues_in:
        if not isinstance(it, dict):
            continue
        sev = str(it.get("severity") or "warn").lower()
        if sev not in ("error", "warn", "info"):
            sev = "warn"
        msg = str(it.get("message") or "").strip()
        where = str(it.get("where") or "整体").strip() or "整体"
        if msg:
            cat = str(it.get("category") or "copy")
            page_index = it.get("page_index")
            pi = page_index if isinstance(page_index, int) else None
            issues.append(
                _issue(
                    sev,
                    msg,
                    where,
                    category=cat,
                    code=str(it.get("code") or ""),
                    fix_hint=str(it.get("fix_hint") or ""),
                    page_index=pi,
                )
            )
    suggestions = [
        str(s).strip()
        for s in (raw.get("suggestions") or [])
        if str(s).strip()
    ][:12]
    out: dict[str, Any] = {
        "verdict": verdict,
        "issues": issues,
        "suggestions": suggestions,
    }
    nt = raw.get("title")
    nc = raw.get("caption")
    if isinstance(nt, str) and nt.strip() and nt.strip() != title.strip():
        out["title"] = nt.strip()
    if isinstance(nc, str) and nc.strip() and nc.strip() != caption.strip():
        out["caption"] = nc.strip()
    return out


def _merge_verdict(a: str, b: str) -> str:
    rank = {"pass": 0, "warn": 1, "fail": 2}
    return a if rank.get(a, 1) >= rank.get(b, 1) else b


async def review_content(
    data: dict,
    *,
    title: str = "",
    caption: str = "",
    intent: str = "",
    light: bool = False,
) -> dict[str, Any]:
    """Review publish package content. LLM + rules merge; rules alone on failure."""
    snippet = (intent or title or "")[:80]
    timer = TimingTracker("review", intent_snippet=snippet)
    with timer.phase("rule_baseline"):
        baseline = rule_review(data, title=title, caption=caption, intent=intent)

    if not _has_api_key():
        timing = timer.log_and_persist(mode="rules", ok=True)
        return {**baseline, "mode": "rules", "meta": _api_meta("review", 0, 1, timing)}

    if light:
        timing = timer.log_and_persist(mode="rules", ok=True)
        return {**baseline, "mode": "rules", "meta": _api_meta("review", 0, 1, timing)}

    user = json.dumps(
        {
            "intent": intent or "",
            "title": title or "",
            "caption": caption or "",
            "data": data,
            "rule_baseline": {
                "verdict": baseline["verdict"],
                "issues": baseline["issues"][:20],
            },
        },
        ensure_ascii=False,
    )
    try:
        with timer.phase("llm_review"):
            raw = await _chat_json(SYSTEM_REVIEW, user, temperature=0.2)
            llm = _normalize_review(raw, title=title, caption=caption)
        # Keep hard rule errors + layout findings from baseline; merge issues
        rule_keep = [
            i
            for i in baseline["issues"]
            if i["severity"] == "error" or i.get("category") == "layout"
        ]
        merged_issues = list(llm["issues"])
        keys = {(i["severity"], i["message"], i["where"]) for i in merged_issues}
        for i in rule_keep:
            k = (i["severity"], i["message"], i["where"])
            if k not in keys:
                merged_issues.append(i)
                keys.add(k)
        # also keep unique rule warns if LLM missed structural ones
        verdict = _merge_verdict(llm["verdict"], baseline["verdict"])
        if any(i["severity"] == "error" for i in merged_issues):
            verdict = "fail"
        suggestions = list(llm.get("suggestions") or [])
        for s in baseline.get("suggestions") or []:
            if s not in suggestions:
                suggestions.append(s)
        timing = timer.log_and_persist(mode="llm", ok=True)
        out: dict[str, Any] = {
            "verdict": verdict,
            "issues": merged_issues[:40],
            "suggestions": suggestions[:12],
            "mode": "llm",
            "meta": _api_meta("review", 1, 5, timing),
        }
        if "title" in llm:
            out["title"] = llm["title"]
        if "caption" in llm:
            out["caption"] = llm["caption"]
        return out
    except Exception as exc:  # noqa: BLE001
        timing = timer.log_and_persist(
            mode="rules_fallback",
            ok=True,
            extra={"error": str(exc)[:120]},
        )
        return {
            **baseline,
            "mode": "rules_fallback",
            "warnings": [f"LLM 审核失败，已用规则审核: {exc}"],
            "meta": _api_meta("review", 1, 5, timing),
        }


# silence unused import warning for re-export style helpers used only when testing
__all__ = ["review_content", "rule_review"]
