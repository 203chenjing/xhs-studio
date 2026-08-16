# -*- coding: utf-8 -*-
"""Copywriting playbook for xhs-studio generate / review pipelines.

Loads ``knowledge/copywriting-playbook.json`` and builds compact prompt sections
aligned with top GitHub skills (guizang, Auto-Redbook, xiaohongshu-guide).
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from schema import _pull_quote_duplicates_paragraph

_ROOT = Path(__file__).resolve().parents[2]
_PLAYBOOK_PATH = _ROOT / "knowledge" / "copywriting-playbook.json"

_CONTENT_TYPES = ("面经", "干货", "清单")

# Resume / generic tone signals (page + title + caption)
_RESUME_RE = re.compile(
    r"(负责|参与|协助|具备.{0,6}能力|熟悉.{0,8}框架|项目经历|工作职责|任职于|岗位职责)"
)
_WEAK_HOOK_RE = re.compile(
    r"^(关于|浅谈|记录|分享一篇|笔记|总结一下|XX的|一篇)"
)
_EMOJI_RE = re.compile(
    r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F600-\U0001F64F]"
)
_VAGUE_RE = re.compile(r"(很重要|要注意|因人而异|仅供参考|多多练习|因人而异)")
_STUFFING_RE = re.compile(r"(最全|独家|必看|天花板|绝绝子)")


@lru_cache(maxsize=1)
def load_playbook() -> dict[str, Any]:
    if not _PLAYBOOK_PATH.is_file():
        return {"version": "0", "content_types": {}, "anti_patterns": []}
    with _PLAYBOOK_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {"version": "0"}


def list_content_types() -> list[str]:
    ct = load_playbook().get("content_types") or {}
    if isinstance(ct, dict):
        return [k for k in ct if k in _CONTENT_TYPES]
    return list(_CONTENT_TYPES)


def infer_content_type(intent: str, explicit: str | None = None) -> str:
    """Infer 面经 / 干货 / 清单 from brief field or user intent."""
    exp = (explicit or "").strip()
    if exp in _CONTENT_TYPES:
        return exp
    t = (intent or "").lower()
    pb = load_playbook().get("content_types") or {}
    if isinstance(pb, dict):
        for ctype, block in pb.items():
            if ctype not in _CONTENT_TYPES or not isinstance(block, dict):
                continue
            aliases = block.get("aliases") or []
            for alias in aliases:
                if str(alias).lower() in t:
                    return ctype
    # fallback heuristics (aligned with demo._detect_category)
    if any(k in t for k in ("面经", "面试", "秋招", "校招", "群面", "hr面", "笔试", "反问", "offer")):
        return "面经"
    if any(k in t for k in ("清单", "checklist", "避坑", "排雷", "自查", "todo", "必备")):
        return "清单"
    if any(k in t for k in ("干货", "教程", "攻略", "方法", "技巧", "怎么", "步骤")):
        return "干货"
    return "干货"


def get_content_type_block(content_type: str) -> dict[str, Any]:
    ct = (content_type or "").strip()
    block = (load_playbook().get("content_types") or {}).get(ct)
    return block if isinstance(block, dict) else {}


def build_playbook_prompt_section() -> str:
    """Compact copy rules block for SYSTEM_GENERATE (paired with layout catalog)."""
    pb = load_playbook()
    if not pb.get("version"):
        return ""

    policy = pb.get("studio_policy") or {}
    titles = pb.get("title_formulas") or {}
    hooks = titles.get("hook_types") or []
    caption = pb.get("caption_structure") or {}
    anti = pb.get("anti_patterns") or []

    lines = [
        "## 文案 playbook（高互动抽象模式，勿抄袭具体帖子）",
        f"页内禁止 emoji；{policy.get('tone', '口语干货')}。",
        f"发布 title 约 {titles.get('max_chars_publish', 28)} 字；封面 hook 优先 ≤{titles.get('max_chars_push', 20)} 字。",
        "brief 必须输出 content_type：面经 | 干货 | 清单（从 intent 推断或用户明示）。",
        "",
        "### 标题 hook 类型（选 1 种贯穿 title/hooks/cover）",
    ]
    for h in hooks[:6]:
        if not isinstance(h, dict):
            continue
        lines.append(
            f"- {h.get('id', '')}「{h.get('name', '')}」：{h.get('pattern', '')} "
            f"例（抽象）：{h.get('example_abstract', '')}"
        )

    sub = titles.get("cover_subtitle") or {}
    if sub:
        lines.append("")
        lines.append(f"### 封面副标：{sub.get('structure', '')}")
        for p in (sub.get("patterns") or [])[:2]:
            lines.append(f"- {p}")

    lines.append("")
    lines.append("### caption 结构")
    for b in (caption.get("blocks") or [])[:5]:
        lines.append(f"- {b}")
    for c in (caption.get("cta_patterns") or [])[:2]:
        lines.append(f"- CTA 例：{c}")

    lines.append("")
    lines.append("### 品类语气（按 brief.content_type 选用）")
    for ctype in list_content_types():
        block = get_content_type_block(ctype)
        if not block:
            continue
        recipe = block.get("default_recipe", "")
        hooks_ids = "/".join(block.get("title_hooks") or [])
        lines.append(
            f"- {ctype}：{block.get('tone', '')} "
            f"| hook→{hooks_ids} | recipe→{recipe}"
        )

    lines.append("")
    lines.append("### 反模式（生成时主动避开）")
    for a in anti[:5]:
        if isinstance(a, dict):
            lines.append(f"- {a.get('name', '')}：{a.get('fix', '')}")

    lines.append("")
    lines.append(
        "页内文案密度见 playbook；面经用 STAR+原话；清单用后果导向条目；"
        "干货用「做法+例子」。ending 攒人品 CTA，勿夸张承诺。"
    )
    return "\n".join(lines)


def build_type_guidance(content_type: str) -> str:
    """Focused guidance for generate user message."""
    block = get_content_type_block(content_type)
    if not block:
        return ""

    lines = [
        f"【文案 playbook · {content_type}】",
        f"语气：{block.get('tone', '')}",
        f"建议 layout_recipe：{block.get('default_recipe', '')}",
    ]
    hooks = block.get("title_hooks") or []
    if hooks:
        lines.append(f"标题 hook 优先：{', '.join(str(h) for h in hooks)}")

    page_copy = block.get("page_copy") or {}
    if isinstance(page_copy, dict):
        lines.append("页型文案要点：")
        for ptype, hint in list(page_copy.items())[:6]:
            lines.append(f"  · {ptype}：{hint}")

    density = block.get("density") or {}
    if isinstance(density, dict) and density:
        lines.append("密度：" + "；".join(f"{k}={v}" for k, v in density.items()))

    patterns = load_playbook().get("high_score_patterns") or []
    for p in patterns:
        if isinstance(p, dict) and p.get("content_type") == content_type:
            lines.append(f"高分结构（抽象）：{p.get('abstract', '')}")
            break

    return "\n".join(lines)


def _text_blob(data: dict, title: str = "", caption: str = "") -> str:
    parts = [title, caption]
    pages = data.get("pages") if isinstance(data, dict) else None
    if isinstance(pages, list):
        for page in pages:
            if isinstance(page, dict):
                parts.append(json.dumps(page, ensure_ascii=False))
    return "\n".join(parts)


def check_copy_quality(
    data: dict,
    *,
    title: str = "",
    caption: str = "",
    content_type: str = "",
) -> list[dict[str, str]]:
    """Rule-based copy checks aligned with playbook (for review merge)."""
    issues: list[dict[str, str]] = []

    def add(sev: str, msg: str, where: str) -> None:
        issues.append({"severity": sev, "message": msg, "where": where})

    blob = _text_blob(data, title, caption)
    t = (title or "").strip()

    if _EMOJI_RE.search(blob):
        add("warn", "页内或标题含 emoji，违反 studio 规则（应用 # 标签替代）", "文案")

    if t and _WEAK_HOOK_RE.search(t):
        add("warn", "标题像「无 hook」陈述句，建议加数字/问句/反差（playbook）", "title")

    if t and len(re.sub(r"\s+", "", t)) > 28:
        add("warn", "标题超过 28 字，信息流展示可能被截断", "title")

    if t and _STUFFING_RE.search(t):
        add("warn", "标题含夸张堆砌词（最全/必看等），建议改成具体收益", "title")

    if _RESUME_RE.search(blob):
        add("warn", "文案偏简历腔（负责/参与/具备能力…），建议改场景口语", "文案")

    if _VAGUE_RE.search(blob):
        add("info", "存在空洞套话（很重要/因人而异），建议补场景或动作", "文案")

    pages = data.get("pages") if isinstance(data, dict) else None
    if isinstance(pages, list):
        for i, page in enumerate(pages):
            if not isinstance(page, dict) or page.get("type") != "free":
                continue
            pq = str(page.get("pullQuote") or "").strip()
            if not pq:
                continue
            paras = [
                str(x).strip()
                for x in (page.get("paragraphs") or [])
                if str(x).strip()
            ]
            if any(_pull_quote_duplicates_paragraph(pq, p) for p in paras):
                add(
                    "warn",
                    "文内拉引金句与正文段落重复，建议删 pullQuote 或改成面试官原话",
                    f"第{i + 1}页·free·pullQuote",
                )

        cover = next((p for p in pages if isinstance(p, dict) and p.get("type") == "cover"), None)
        if cover:
            sub = str(cover.get("subtitle") or "").strip()
            if sub and len(sub) < 8:
                add("warn", "封面副标信息量偏少（playbook：人群+场景+收益）", "第1页·cover")
            if not sub:
                add("info", "封面建议补 subtitle（人群+收益）", "第1页·cover")

        ending = next((p for p in pages if isinstance(p, dict) and p.get("type") == "ending"), None)
        if ending:
            cta = ending.get("cta") if isinstance(ending.get("cta"), list) else []
            if not cta and content_type == "面经":
                add("info", "面经结尾建议加攒人品式 CTA（收藏/祝 offer）", "ending")

    c = (caption or "").strip()
    if c and "#" not in c:
        add("warn", "caption 缺少 #话题标签（playbook：5-8 个）", "caption")
    if c and len(re.sub(r"\s+", "", c)) < 40:
        add("warn", "caption 过短，建议 hook+展开+CTA+标签", "caption")

    return issues
