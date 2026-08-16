# -*- coding: utf-8 -*-
"""Design / layout lint — 0 LLM, JSON-only structural checks (P0 Design Agent)."""
from __future__ import annotations

import re
from typing import Any

MAX_SAME_TYPE_RUN = 3
TIMELINE_WARN_STEPS = 5
TIMELINE_ERROR_STEPS = 8

SUBSTANCE_TYPES = frozenset(
    {
        "points",
        "timeline",
        "card",
        "compare",
        "summary",
        "composite",
        "photo",
        "gallery",
        "free",
    }
)


def _norm(s: Any) -> str:
    return re.sub(r"\s+", "", str(s or ""))


def _where(page_index: int, ptype: str, suffix: str = "") -> str:
    base = f"第{page_index + 1}页·{ptype or '?'}"
    return f"{base}·{suffix}" if suffix else base


def _fix_hint_from_fix(fix: dict[str, Any] | None) -> str:
    if not fix or not isinstance(fix, dict):
        return ""
    op = fix.get("op")
    if op == "deleteField":
        return f"删除字段 {fix.get('field', '')}"
    if op == "rewriteField":
        hint = fix.get("hint") or ""
        return f"改写 {fix.get('field', '')}" + (f"：{hint}" if hint else "")
    if op == "setDensity":
        return f"设置 density={fix.get('value', 'compact')}"
    if op == "setPageType":
        return f"改用页型 {fix.get('value', '')}"
    if op == "setLayoutVariant":
        return f"设置 layoutVariant={fix.get('value', '')}"
    if op == "deleteItem":
        return f"删减 {fix.get('list', 'items')} 至 ≤{fix.get('from', '')} 条"
    return ""


def _finding(
    *,
    code: str,
    severity: str,
    page_index: int,
    message: str,
    ptype: str,
    suffix: str = "",
    fix: dict[str, Any] | None = None,
    fix_hint: str = "",
) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "page_index": page_index,
        "message": message,
        "fix_hint": fix_hint or _fix_hint_from_fix(fix),
        "category": "layout",
        "where": _where(page_index, ptype, suffix),
    }


def _pull_quote_duplicates_paragraph(quote: str, paragraph: str) -> bool:
    q = _norm(quote)
    p = _norm(paragraph)
    if not q or not p:
        return False
    return q == p or (len(q) >= 12 and q in p)


def _layout_variant(page: dict) -> str:
    style = page.get("style") if isinstance(page.get("style"), dict) else {}
    return str(page.get("layoutVariant") or style.get("layoutVariant") or "").strip()


def lint_page(page: dict, index: int) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    ptype = str(page.get("type") or "?")

    if ptype == "free":
        pq = str(page.get("pullQuote") or "").strip()
        if pq:
            paras = [str(x).strip() for x in (page.get("paragraphs") or []) if str(x).strip()]
            if any(_pull_quote_duplicates_paragraph(pq, p) for p in paras):
                findings.append(
                    _finding(
                        code="pull_quote_duplicate",
                        severity="warn",
                        page_index=index,
                        message="pullQuote 与正文段落重复，视觉会像两段一样的话叠在一起",
                        ptype=ptype,
                        suffix="pullQuote",
                        fix={"op": "deleteField", "field": "pullQuote"},
                    )
                )
            if len(pq) > 48:
                findings.append(
                    _finding(
                        code="pull_quote_too_long",
                        severity="warn",
                        page_index=index,
                        message="拉引金句过长，quote/free 页易字堆",
                        ptype=ptype,
                        suffix="pullQuote",
                        fix={"op": "rewriteField", "field": "pullQuote", "hint": "≤24字或面试官原话"},
                    )
                )
        paras = page.get("paragraphs") or []
        if isinstance(paras, list) and len(paras) >= 4 and all(len(_norm(p)) > 80 for p in paras):
            findings.append(
                _finding(
                    code="text_pile_up",
                    severity="warn",
                    page_index=index,
                    message="free 页多段长文，易密排堆字",
                    ptype=ptype,
                    suffix="paragraphs",
                    fix={"op": "setDensity", "value": "compact"},
                )
            )

    if ptype == "compare":
        rows = page.get("rows") if isinstance(page.get("rows"), list) else []
        cols = page.get("columns") or page.get("cols") or []
        if not isinstance(cols, list):
            cols = []
        if len(rows) > 6:
            findings.append(
                _finding(
                    code="compare_too_dense",
                    severity="warn",
                    page_index=index,
                    message="对比行数 >6，易 Excel 表格感",
                    ptype=ptype,
                    suffix="rows",
                    fix={"op": "setPageType", "value": "summary"},
                )
            )
        empty_sides = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            vals = row.get("values") or row.get("cols") or []
            if not isinstance(vals, list):
                continue
            if any(len(_norm(v)) < 2 for v in vals):
                empty_sides += 1
        if empty_sides > 0:
            findings.append(
                _finding(
                    code="compare_incomplete",
                    severity="error",
                    page_index=index,
                    message="对比格有空值或过短，版面会缺一块",
                    ptype=ptype,
                    suffix="rows",
                )
            )
        if len(cols) == 2 and len(rows) >= 4:
            findings.append(
                _finding(
                    code="compare_variant_hint",
                    severity="info",
                    page_index=index,
                    message="建议试 layout recipe compare:swipe-before-after 减表格感",
                    ptype=ptype,
                    suffix="layoutVariant",
                    fix={"op": "setLayoutVariant", "value": "swipe-before-after"},
                )
            )

    if ptype == "timeline":
        steps = page.get("steps") if isinstance(page.get("steps"), list) else []
        n_steps = len(steps)
        if n_steps > TIMELINE_ERROR_STEPS:
            findings.append(
                _finding(
                    code="timeline_too_many_steps",
                    severity="error",
                    page_index=index,
                    message=f"时间线 {n_steps} 步，竖版极易溢出",
                    ptype=ptype,
                    suffix="steps",
                    fix={"op": "deleteItem", "list": "steps", "from": TIMELINE_WARN_STEPS},
                )
            )
        elif n_steps > TIMELINE_WARN_STEPS:
            findings.append(
                _finding(
                    code="timeline_too_many_steps",
                    severity="warn",
                    page_index=index,
                    message="时间线 >5 步，竖版易挤/溢出",
                    ptype=ptype,
                    suffix="steps",
                    fix={"op": "deleteItem", "list": "steps", "from": TIMELINE_WARN_STEPS},
                )
            )
        long_bodies = sum(
            1 for s in steps if isinstance(s, dict) and len(_norm(s.get("body"))) > 72
        )
        if long_bodies >= 2:
            findings.append(
                _finding(
                    code="timeline_body_pile",
                    severity="warn",
                    page_index=index,
                    message="多步正文过长，timeline 易字堆",
                    ptype=ptype,
                    suffix="steps",
                    fix={"op": "setDensity", "value": "compact"},
                )
            )

    if ptype == "quote":
        text = str(page.get("text") or "").strip()
        if len(text) > 120:
            findings.append(
                _finding(
                    code="quote_too_long",
                    severity="warn",
                    page_index=index,
                    message="金句页文字过长，失去「一眼金句」观感",
                    ptype=ptype,
                    suffix="text",
                )
            )
        variant = _layout_variant(page) or "sidebar"
        if text and len(_norm(text)) <= 24 and variant in ("sidebar", "left-bar", ""):
            findings.append(
                _finding(
                    code="quote_sidebar_short_text",
                    severity="info",
                    page_index=index,
                    message="金句较短，侧栏版式易显空，建议试 centered-hero 居中大字",
                    ptype=ptype,
                    suffix="layoutVariant",
                    fix={"op": "setLayoutVariant", "value": "centered-hero"},
                )
            )

    return findings


def design_lint(data: dict | None) -> list[dict[str, Any]]:
    """Run layout/design checks on publish DATA. Returns findings with category=layout."""
    findings: list[dict[str, Any]] = []
    pages = (data or {}).get("pages") if isinstance(data, dict) else None
    if not isinstance(pages, list) or not pages:
        return [
            {
                "code": "no_pages",
                "severity": "error",
                "page_index": 0,
                "message": "无页面",
                "fix_hint": "",
                "category": "layout",
                "where": "pages",
            }
        ]

    run_type: str | None = None
    run_len = 0
    for idx, page in enumerate(pages):
        if not isinstance(page, dict):
            continue
        findings.extend(lint_page(page, idx))

        t = page.get("type")
        if t in SUBSTANCE_TYPES:
            if t == run_type:
                run_len += 1
            else:
                run_type = str(t)
                run_len = 1
            if run_len > MAX_SAME_TYPE_RUN:
                findings.append(
                    _finding(
                        code="same_type_run",
                        severity="warn",
                        page_index=idx,
                        message=f"连续 {run_len} 页同为 {t}，节奏单调易审美疲劳",
                        ptype=str(t),
                    )
                )
        else:
            run_type = None
            run_len = 0

    return findings


__all__ = ["design_lint", "lint_page"]
