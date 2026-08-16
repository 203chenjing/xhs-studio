# -*- coding: utf-8 -*-
"""DATA schema validation and repair for XHS pages."""
from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

VALID_TYPES = frozenset({
    "cover", "chapter", "points", "timeline", "card",
    "quote", "compare", "summary", "ending", "composite",
    "photo", "gallery", "free",
})
COMPOSITE_ALLOWED = frozenset({
    "points", "timeline", "card", "quote", "compare", "summary", "free",
})
# 叙事主线「实质内容」页（chapter/quote 偏分隔与收束，不算实质干货）
SUBSTANCE_TYPES = frozenset({
    "points", "timeline", "card", "compare", "summary", "composite",
    "photo", "gallery", "free",
})
# 干货中段优先插入配图的锚点类型
DRY_GOODS_TYPES = frozenset({
    "points", "timeline", "card", "compare", "composite", "free",
})
CLOSING_TYPES = frozenset({"quote", "summary"})
VALID_TONES = frozenset({"neg", "pos", "neutral"})
_DIM_HEADS = frozenset({
    "维度", "项目", "对比项", "指标", "类别", "类型", "项", "对比", "方面",
    "item", "metric", "dimension", "vs",
})
# 同 type 连续软上限：超过仅 warn + 轻量打断
MAX_SAME_TYPE_RUN = 3
# 结构页（blocks 字段不抢类型）
_STRUCTURAL_TYPES = frozenset({"cover", "ending", "chapter"})
# 叙事角色（渲染用短标签；结构可灵活，但读者要一眼懂「讲到哪」）
VALID_ROLES = frozenset({
    "钩子", "痛点", "共鸣", "价值", "方法", "证据", "对比",
    "总结", "金句", "章节", "配图", "行动", "干货", "展开",
})
_PAIN_ROLES = frozenset({"痛点", "共鸣", "价值"})
_METHOD_TYPES = frozenset({
    "points", "timeline", "card", "compare", "composite", "free",
})
_DEFAULT_ROLE_BY_TYPE = {
    "cover": "钩子",
    "ending": "行动",
    "chapter": "章节",
    "points": "方法",
    "timeline": "方法",
    "compare": "对比",
    "summary": "总结",
    "quote": "金句",
    "photo": "配图",
    "gallery": "配图",
    "card": "干货",
    "free": "展开",
    "composite": "干货",
}


def _as_str(v: Any, default: str = "") -> str:
    if v is None:
        return default
    return str(v)


def _as_list(v: Any) -> list:
    return v if isinstance(v, list) else []


def _norm_compact_text(s: str) -> str:
    return re.sub(r"\s+", "", _as_str(s))


def _pull_quote_duplicates_paragraph(quote: str, paragraph: str) -> bool:
    q = _norm_compact_text(quote)
    p = _norm_compact_text(paragraph)
    if not q or not p:
        return False
    if q == p:
        return True
    return q in p and len(q) >= len(p) * 0.85


def _repair_free_pull_quote(page: dict) -> tuple[dict, str | None]:
    """Drop pullQuote when it repeats an existing paragraph (engine auto-fill guard)."""
    if page.get("type") != "free":
        return page, None
    pq = _as_str(page.get("pullQuote")).strip()
    if not pq:
        return page, None
    paras = [_as_str(x).strip() for x in _as_list(page.get("paragraphs")) if _as_str(x).strip()]
    for p in paras:
        if _pull_quote_duplicates_paragraph(pq, p):
            out = {**page}
            out.pop("pullQuote", None)
            return out, "pullQuote 与正文段落重复，已移除"
    if len(pq) > 120:
        out = {**page, "pullQuote": pq[:120]}
        return out, "pullQuote 过长已截断"
    return page, None


def _repair_item(it: Any) -> dict:
    if not isinstance(it, dict):
        return {"head": str(it), "body": ""}
    return {
        "head": _as_str(it.get("head") or it.get("title") or "要点"),
        "body": _as_str(it.get("body") or it.get("desc") or it.get("text") or ""),
    }


def _repair_step(st: Any) -> dict:
    if not isinstance(st, dict):
        return {"time": "", "head": str(st), "body": ""}
    return {
        "time": _as_str(st.get("time") or st.get("label") or ""),
        "head": _as_str(st.get("head") or st.get("title") or "步骤"),
        "body": _as_str(st.get("body") or st.get("desc") or ""),
    }


def _pick_image(block: dict) -> str:
    img = block.get("image") or block.get("img") or block.get("src")
    if isinstance(img, str) and img.strip():
        return img.strip()
    imgs = block.get("images")
    if isinstance(imgs, list):
        for u in imgs:
            if isinstance(u, str) and u.strip():
                return u.strip()
    return ""


def _pick_images(block: dict, *, limit: int = 9) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for u in _as_list(block.get("images")):
        s = _as_str(u).strip()
        if s and s not in seen:
            out.append(s)
            seen.add(s)
        if len(out) >= limit:
            return out
    single = _pick_image(block)
    if single and single not in seen and len(out) < limit:
        out.append(single)
    return out[:limit]


def _fallback_card(block: dict) -> dict:
    """Unknown / unsalvageable type → renderable card (never scrap the page)."""
    title = _as_str(
        block.get("title") or block.get("head") or block.get("label") or "内容"
    )
    body = _as_str(
        block.get("body") or block.get("text") or block.get("desc") or block.get("intro") or ""
    )
    if not body:
        bits: list[str] = []
        for x in _as_list(block.get("paragraphs")):
            s = _as_str(x).strip()
            if s:
                bits.append(s)
        for x in _as_list(block.get("bullets") or block.get("items")):
            if isinstance(x, dict):
                s = f"{_as_str(x.get('head'))}：{_as_str(x.get('body'))}".strip("：")
            else:
                s = _as_str(x)
            if s.strip():
                bits.append(s.strip())
        body = "\n".join(bits[:6])
    out: dict[str, Any] = {
        "type": "card",
        "title": title or "内容",
        "body": body or "补充正文",
    }
    if block.get("label"):
        out["label"] = _as_str(block["label"])
    img = _pick_image(block)
    if img:
        out["image"] = img
    return out


def _repair_block(block: dict) -> dict | None:
    """Repair a single page or composite child block. Always tries to salvage."""
    if not isinstance(block, dict):
        return None
    user_edited = bool(block.get("_user_edited"))
    t = _as_str(block.get("type")).strip().lower()
    has_blocks = bool(_as_list(block.get("blocks")))

    # 任意非结构页若自带 blocks → 归一化为 composite（AI 自由混排）
    if has_blocks and t not in _STRUCTURAL_TYPES and t != "composite":
        t = "composite"

    if t not in VALID_TYPES:
        # Guess from fields
        if has_blocks or "blocks" in block:
            t = "composite"
        elif "paragraphs" in block or "bullets" in block:
            t = "free"
        elif "steps" in block:
            t = "timeline"
        elif "cols" in block or "rows" in block:
            t = "compare"
        elif "items" in block and isinstance(block.get("items"), list):
            items = block["items"]
            if items and isinstance(items[0], dict) and ("head" in items[0] or "body" in items[0]):
                t = "points"
            else:
                t = "summary"
        elif "text" in block and not block.get("body"):
            t = "quote"
        elif "body" in block and "title" in block:
            t = "card"
        elif "no" in block:
            t = "chapter"
        elif "cta" in block or "contact" in block:
            t = "ending"
        elif _pick_images(block) and not block.get("title") and not block.get("items"):
            t = "gallery" if len(_pick_images(block)) > 1 else "photo"
        elif _pick_image(block) and block.get("title") and not block.get("items") and not block.get("body"):
            t = "photo"
        elif "title" in block and not block.get("body") and not block.get("items"):
            # 单独 title 不再默认 cover（避免中间页误判）；降级 card
            t = "card"
        else:
            return _fallback_card(block)

    out: dict[str, Any] = {"type": t}

    if t == "cover":
        out["title"] = _as_str(block.get("title") or "未命名笔记")
        if block.get("kicker"):
            out["kicker"] = _as_str(block["kicker"])
        if block.get("subtitle"):
            out["subtitle"] = _as_str(block["subtitle"])
        tags = [ _as_str(x) for x in _as_list(block.get("tags")) if _as_str(x) ]
        if tags:
            out["tags"] = tags[:8]
        img = _pick_image(block)
        if img:
            out["image"] = img

    elif t == "chapter":
        out["no"] = _as_str(block.get("no") or "01")
        out["title"] = _as_str(block.get("title") or "章节")
        if block.get("desc"):
            out["desc"] = _as_str(block["desc"])

    elif t == "points":
        out["title"] = _as_str(block.get("title") or ("要点" if not user_edited else ""))
        if not out["title"] and user_edited:
            out["title"] = "要点"
        if "intro" in block:
            out["intro"] = _as_str(block.get("intro"))
        elif block.get("intro"):
            out["intro"] = _as_str(block["intro"])
        items = [_repair_item(x) for x in _as_list(block.get("items"))]
        # 用户刚改过的页：允许条数变少甚至为空，禁止回填占位要点
        if not items and not user_edited:
            items = [{"head": "要点一", "body": "补充具体内容"}]
        out["items"] = items[:6]
        img = _pick_image(block)
        if img:
            out["image"] = img

    elif t == "timeline":
        out["title"] = _as_str(block.get("title") or "时间线")
        steps = [_repair_step(x) for x in _as_list(block.get("steps"))]
        if not steps and not user_edited:
            steps = [{"time": "Step1", "head": "开始", "body": "补充步骤说明"}]
        out["steps"] = steps[:6]

    elif t == "card":
        out["title"] = _as_str(block.get("title") or ("干货卡片" if not user_edited else "卡片"))
        if "body" in block:
            out["body"] = _as_str(block.get("body"))
        else:
            out["body"] = _as_str(block.get("body") or ("" if user_edited else "补充正文"))
        if block.get("label"):
            out["label"] = _as_str(block["label"])
        tips = [_as_str(x) for x in _as_list(block.get("tips")) if _as_str(x)]
        if tips:
            out["tips"] = tips[:5]
        img = _pick_image(block)
        if img:
            out["image"] = img

    elif t == "photo":
        out["title"] = _as_str(block.get("title") or "配图")
        body = _as_str(block.get("body") or block.get("subtitle") or block.get("desc") or "")
        if body:
            out["body"] = body
        img = _pick_image(block)
        out["image"] = img or ""

    elif t == "gallery":
        out["title"] = _as_str(block.get("title") or "图集")
        imgs = _pick_images(block, limit=9)
        out["images"] = imgs or ([_pick_image(block)] if _pick_image(block) else [])
        if block.get("caption"):
            out["caption"] = _as_str(block["caption"])
        elif block.get("subtitle"):
            out["caption"] = _as_str(block["subtitle"])

    elif t == "quote":
        # 允许很短/空金句；用户编辑后禁止用占位句把已删内容加回
        if "text" in block:
            text = _as_str(block.get("text"))
        elif block.get("title"):
            text = _as_str(block.get("title"))
        else:
            text = "" if user_edited else "一句值得记住的话"
        if not text and not user_edited:
            text = "一句值得记住的话"
        out["text"] = text
        if block.get("from"):
            out["from"] = _as_str(block["from"])

    elif t == "compare":
        out["title"] = _as_str(block.get("title") or "对比")
        cols_raw = _as_list(block.get("cols"))
        cols = []
        for c in cols_raw[:5]:
            if isinstance(c, dict):
                tone = _as_str(c.get("tone") or "neutral")
                if tone not in VALID_TONES:
                    tone = "neutral"
                cols.append({"head": _as_str(c.get("head") or "列"), "tone": tone})
            else:
                cols.append({"head": _as_str(c), "tone": "neutral"})
        if len(cols) < 2:
            cols = [
                {"head": "维度", "tone": "neutral"},
                {"head": "A", "tone": "neg"},
                {"head": "B", "tone": "pos"},
            ]

        rows_raw = [r for r in _as_list(block.get("rows"))[:8] if isinstance(r, dict)]
        max_vals = 0
        for r in rows_raw:
            max_vals = max(max_vals, len(_as_list(r.get("values"))))

        # LLM 常只给 [白天, 夜游] 两列；渲染会再插 label 列，导致首列空、values 被截成 1 个
        first_is_dim = bool(cols) and _as_str(cols[0].get("head")).strip().lower() in _DIM_HEADS
        if not first_is_dim:
            cols = [{"head": "维度", "tone": "neutral"}] + cols
            if len(cols) > 4:
                cols = cols[:4]
            # 若首列原不是维度但 tone 仍是 neutral，给左右列合理 tone
            if len(cols) >= 3:
                if cols[1].get("tone") == "neutral":
                    cols[1]["tone"] = "neg"
                if cols[2].get("tone") == "neutral":
                    cols[2]["tone"] = "pos"

        out["cols"] = cols
        n_vals = max(1, len(cols) - 1)
        rows = []
        for r in rows_raw:
            label = _as_str(r.get("label") or r.get("head") or r.get("item") or "")
            vals = [_as_str(v) for v in _as_list(r.get("values"))]
            # values 误含维度列：长度 == 总列数
            if len(vals) == len(cols):
                if not label:
                    label = vals[0]
                vals = vals[1:]
            # 按列名兜底：{"白天":"...", "夜游":"..."}
            if len(vals) < n_vals:
                keyed = []
                for c in cols[1:]:
                    key = _as_str(c.get("head"))
                    if key and key in r and r.get(key) is not None:
                        keyed.append(_as_str(r.get(key)))
                if len(keyed) == n_vals:
                    vals = keyed
            while len(vals) < n_vals:
                vals.append("—")
            if not label.strip():
                label = "对比项"
            rows.append({"label": label, "values": vals[:n_vals]})
        out["rows"] = rows or [
            {"label": "示例", "values": (["更弱", "更强"] + ["—"] * n_vals)[:n_vals]},
        ]

    elif t == "summary":
        out["title"] = _as_str(block.get("title") or "总结")
        items = []
        for x in _as_list(block.get("items")):
            if isinstance(x, dict):
                items.append(_as_str(x.get("head") or x.get("body") or x.get("text") or ""))
            else:
                items.append(_as_str(x))
        items = [i for i in items if i][:8]
        if not items and not user_edited:
            items = ["记住核心结论，立刻行动"]
        out["items"] = items
        metrics = []
        for m in _as_list(block.get("metrics"))[:4]:
            if isinstance(m, dict):
                metrics.append({
                    "num": _as_str(m.get("num") or "0"),
                    "unit": _as_str(m.get("unit") or ""),
                })
        if metrics:
            out["metrics"] = metrics

    elif t == "ending":
        out["title"] = _as_str(block.get("title") or ("收藏这篇\n开始行动" if not user_edited else ""))
        if not out["title"] and user_edited:
            out["title"] = " "
        if "desc" in block:
            out["desc"] = _as_str(block.get("desc"))
        elif block.get("desc"):
            out["desc"] = _as_str(block["desc"])
        cta = [_as_str(x) for x in _as_list(block.get("cta")) if _as_str(x)]
        if cta:
            out["cta"] = cta[:4]
        tags = [_as_str(x) for x in _as_list(block.get("tags")) if _as_str(x)]
        if tags:
            out["tags"] = tags[:8]
        if block.get("contact"):
            out["contact"] = _as_str(block["contact"])

    elif t == "free":
        # 松散自适应页：title + paragraphs[] + bullets[] + image?
        out["title"] = _as_str(block.get("title") or ("内容" if not user_edited else ""))
        if not out["title"]:
            out["title"] = "内容"
        paras: list[str] = []
        for x in _as_list(block.get("paragraphs")):
            s = _as_str(x).strip()
            if s:
                paras.append(s)
        if not paras and not user_edited:
            body = _as_str(block.get("body") or block.get("text") or block.get("desc") or "")
            if body:
                paras = [p.strip() for p in re.split(r"\n+", body) if p.strip()]
        elif not paras and user_edited:
            # 保留用户清空；若给了 body 仍可作段落
            body = _as_str(block.get("body") or block.get("text") or "")
            if body:
                paras = [p.strip() for p in re.split(r"\n+", body) if p.strip()]
        out["paragraphs"] = paras[:6]
        bullets: list[str] = []
        for x in _as_list(block.get("bullets") or block.get("items")):
            if isinstance(x, dict):
                s = f"{_as_str(x.get('head'))} {_as_str(x.get('body'))}".strip()
            else:
                s = _as_str(x).strip()
            if s:
                bullets.append(s)
        if bullets:
            out["bullets"] = bullets[:8]
        if not out["paragraphs"] and not out.get("bullets") and not user_edited:
            out["paragraphs"] = ["补充一段可执行说明，让这一页信息更满。"]
        img = _pick_image(block)
        if img:
            out["image"] = img
        if block.get("kicker"):
            out["kicker"] = _as_str(block["kicker"])
        pq = _as_str(block.get("pullQuote")).strip()
        if pq:
            out["pullQuote"] = pq[:120]

    elif t == "composite":
        blocks = []
        for b in _as_list(block.get("blocks")):
            rb = _repair_block(b if isinstance(b, dict) else {})
            if not rb:
                continue
            if rb["type"] not in COMPOSITE_ALLOWED:
                # 子块未知类型 → card，而不是丢弃
                rb = _fallback_card(b if isinstance(b, dict) else {"title": "模块"})
            if rb["type"] in COMPOSITE_ALLOWED:
                blocks.append(rb)
        if not blocks:
            blocks = [{
                "type": "summary",
                "title": "要点",
                "items": ["补充组合页内容"],
            }]
        out["blocks"] = blocks[:4]
        if block.get("title"):
            out["title"] = _as_str(block["title"])

    else:
        # 理论不可达；兜底 card
        return _fallback_card(block)

    return _attach_narrative_fields(block, out)


def _normalize_density(value: Any) -> str:
    s = _as_str(value).strip().lower()
    if s in ("compact", "tight", "dense", "小", "紧凑"):
        return "compact"
    if s in ("airy", "loose", "relaxed", "大", "疏朗"):
        return "airy"
    if s in ("normal", "default", "标准", "默认"):
        return "normal"
    return ""


def _normalize_font_scale(value: Any) -> float | None:
    try:
        if isinstance(value, bool):
            return None
        n = float(value)
    except (TypeError, ValueError):
        return None
    if 0.68 <= n <= 1.4:
        return round(n, 3)
    return None


def _attach_narrative_fields(src: dict, out: dict) -> dict:
    """Copy optional narrative chrome + per-page visual density fields."""
    role = _as_str(src.get("role")).strip()
    if role:
        # 允许自定义短标签；已知角色优先规范化空白
        out["role"] = role[:8]
    progress = _as_str(src.get("progress") or src.get("step")).strip()
    if progress:
        out["progress"] = progress[:16]
    bridge = _as_str(src.get("bridge")).strip()
    if bridge:
        out["bridge"] = bridge[:100]

    # 单页视觉密度（字体变小/变大）；勿在 repair 时丢掉
    style_in = src.get("style") if isinstance(src.get("style"), dict) else {}
    density = _normalize_density(src.get("density")) or _normalize_density(style_in.get("density"))
    font_scale = _normalize_font_scale(src.get("fontScale"))
    if font_scale is None:
        font_scale = _normalize_font_scale(style_in.get("fontScale"))
    if density:
        out["density"] = density
    elif font_scale is not None:
        # 有自定义缩放时补一个档位，便于前端 class
        if font_scale < 0.95:
            out["density"] = "compact"
        elif font_scale > 1.05:
            out["density"] = "airy"
        else:
            out["density"] = "normal"
    if font_scale is not None:
        out["fontScale"] = font_scale
    if density or font_scale is not None:
        style_out: dict[str, Any] = {}
        if out.get("density"):
            style_out["density"] = out["density"]
        if font_scale is not None:
            style_out["fontScale"] = font_scale
        out["style"] = style_out

    focus = src.get("imageFocus") or src.get("image_focus")
    if isinstance(focus, dict):
        try:
            x = max(0, min(100, float(focus.get("x", 50))))
            y = max(0, min(100, float(focus.get("y", 50))))
            out["imageFocus"] = {"x": x, "y": y}
        except (TypeError, ValueError):
            pass

    # 用户刚 revise 过的页：跳过激进补长文案
    if src.get("_user_edited"):
        out["_user_edited"] = True
    return out


def _page_title_line(page: dict) -> str:
    if not isinstance(page, dict):
        return ""
    t = page.get("type")
    if t == "quote":
        return re.sub(r"\s+", " ", _as_str(page.get("text"))).strip()[:40]
    raw = _as_str(page.get("title") or page.get("no") or page.get("label") or "")
    if not raw and t == "composite":
        for b in _as_list(page.get("blocks")):
            if isinstance(b, dict) and _as_str(b.get("title")).strip():
                raw = _as_str(b.get("title"))
                break
    if not raw:
        raw = _as_str(page.get("role") or "")
    return re.sub(r"\s+", " ", raw.replace("\n", " ")).strip()[:40]


def _default_role_for(page: dict, index: int, total: int) -> str:
    t = _as_str(page.get("type")).strip().lower()
    existing = _as_str(page.get("role")).strip()
    if existing:
        return existing[:8]
    # 封面后第一页实质内容：默认痛点/章节，帮助建立「现在讲到哪」
    if index == 1 and t in ("card", "free"):
        return "痛点"
    if index == 1 and t == "chapter":
        return "章节"
    if index == total - 1 and t == "ending":
        return "行动"
    return _DEFAULT_ROLE_BY_TYPE.get(t, "干货")


def _extract_theme(pages: list[dict], fallback: str = "") -> str:
    cover = next((p for p in pages if isinstance(p, dict) and p.get("type") == "cover"), None)
    if cover:
        title = re.sub(r"\s+", "", _as_str(cover.get("title")).replace("\n", ""))
        sub = re.sub(r"\s+", " ", _as_str(cover.get("subtitle"))).strip()
        if title and sub:
            return f"{title}：{sub}"[:48]
        if title:
            return title[:40]
    return (fallback or "把一件事讲清楚，并给出可执行下一步")[:48]


def build_logic_summary(pages: list[dict], *, theme: str = "") -> list[str]:
    """3–6 条「本篇结构」大纲，供审核面板一眼扫读。"""
    if not pages:
        return ["钩子 → 方法 → 行动"]
    beats: list[tuple[str, str]] = []
    for i, p in enumerate(pages):
        if not isinstance(p, dict):
            continue
        role = _default_role_for(p, i, len(pages))
        title = _page_title_line(p)
        if beats and beats[-1][0] == role:
            # 同角色合并：保留更清晰的标题
            if title and len(title) > len(beats[-1][1]):
                beats[-1] = (role, title)
            continue
        beats.append((role, title))
    # 压缩到 3–6：优先保留钩子/痛点/方法/对比/总结/行动
    priority = ("钩子", "痛点", "共鸣", "价值", "方法", "证据", "对比", "总结", "金句", "行动")
    if len(beats) > 6:
        ranked = sorted(
            enumerate(beats),
            key=lambda iv: (
                priority.index(iv[1][0]) if iv[1][0] in priority else 50,
                iv[0],
            ),
        )
        keep_idx = sorted(i for i, _ in ranked[:6])
        beats = [beats[i] for i in keep_idx]
    if len(beats) < 3 and theme:
        beats.append(("主线", theme[:28]))
    circ = "①②③④⑤⑥⑦⑧⑨⑩"
    out: list[str] = []
    for i, (role, title) in enumerate(beats[:6]):
        mark = circ[i] if i < len(circ) else f"{i + 1}."
        if title and title != role:
            out.append(f"{mark}{role} · {title}")
        else:
            out.append(f"{mark}{role}")
    return out or ["①钩子 · ②方法 · ③行动"]


def enrich_page_narrative(
    pages: list[dict],
    *,
    theme: str = "",
) -> tuple[list[dict], str, list[str]]:
    """为每页补齐 progress / role / bridge，并生成 theme + logic_summary。"""
    if not pages:
        return pages, theme or "", ["①钩子 · ②方法 · ③行动"]
    total = len(pages)
    theme = _as_str(theme).strip() or _extract_theme(pages)
    out: list[dict] = []
    for i, p in enumerate(pages):
        if not isinstance(p, dict):
            continue
        page = dict(p)
        role = _default_role_for(page, i, total)
        page["role"] = role
        # cover / ending 不强制展示进度，但仍写入便于审核
        page["progress"] = f"{i + 1:02d} / {total:02d}"
        if i > 0 and not _as_str(page.get("bridge")).strip():
            prev = out[-1] if out else None
            prev_title = _page_title_line(prev) if prev else ""
            if prev_title:
                page["bridge"] = f"接上页「{prev_title[:18]}」"
            elif role == "方法":
                page["bridge"] = "对齐问题后，这一页给方法"
            elif role == "行动":
                page["bridge"] = "收束全文，给出下一步"
        # bridge 可顺手填 intro（仅当缺 intro 且类型支持）
        if (
            page.get("bridge")
            and page.get("type") in ("points", "free", "card")
            and not _as_str(page.get("intro")).strip()
            and page.get("type") == "points"
        ):
            page["intro"] = page["bridge"]
        out.append(page)
    summary = build_logic_summary(out, theme=theme)
    return out, theme, summary


def _placeholder_cover(title: str = "小红书笔记") -> dict:
    return {
        "type": "cover",
        "role": "钩子",
        "title": title,
        "kicker": "NOTES",
        "subtitle": "把复杂事情拆成可执行步骤",
    }


def _placeholder_ending(brand: str = "XHSStudio") -> dict:
    return {
        "type": "ending",
        "role": "行动",
        "title": "收藏这篇\n开始行动",
        "desc": "点赞收藏，下次用得上",
        "cta": ["关注获取更多干货", "评论区聊聊你的想法"],
        "tags": ["#干货", "#笔记"],
        "contact": brand.lstrip("@") or "XHSStudio",
    }


def _placeholder_points(title: str = "核心要点") -> dict:
    return {
        "type": "points",
        "role": "方法",
        "title": title,
        "bridge": "承接上一页，把方法拆开讲",
        "intro": "承接上一页，把方法拆开讲",
        "items": [
            {"head": "① 先对齐目标", "body": "用一句话写清要解决什么。目标不清，后面步骤都会飘。"},
            {"head": "② 拆成可执行动作", "body": "每步最好能在短时间内完成。做完立刻有反馈，才愿意继续。"},
            {"head": "③ 留下可复用结论", "body": "记录有效动作，删掉无效步骤。下次直接套用，而不是重头摸索。"},
        ],
    }


def _placeholder_pain() -> dict:
    return {
        "type": "card",
        "role": "痛点",
        "label": "痛点",
        "title": "先对齐这个问题",
        "bridge": "封面抛出主题后，先对齐痛点",
        "body": "多数人卡在「知道重要，却不知从哪开始」。下一页直接给可执行方法，不绕弯。",
    }


def _compare_sides_complete(page: dict) -> bool:
    """compare 正反两侧都要有完整短句（非空、非单字占位）。"""
    if page.get("type") != "compare":
        return True
    rows = _as_list(page.get("rows"))
    if not rows:
        return False
    for r in rows:
        if not isinstance(r, dict):
            return False
        vals = [_as_str(v).strip() for v in _as_list(r.get("values"))]
        if len(vals) < 2:
            return False
        for v in vals[:2]:
            if not v or v in {"—", "-", "无", "空"} or len(v) < 2:
                return False
    return True


def _convert_run_overflow(page: dict, prev_type: str) -> dict:
    """把连续第 3 个同 type 转成不打断叙事的替代类型。"""
    t = page.get("type")
    if t == "quote":
        text = _as_str(page.get("text"))
        return {
            "type": "summary",
            "title": "收束一下",
            "items": [x.strip() for x in text.split("\n") if x.strip()][:4]
            or ["记住核心结论，立刻行动"],
        }
    if t == "points":
        items = _as_list(page.get("items"))
        body_bits = []
        for it in items[:3]:
            if isinstance(it, dict):
                body_bits.append(
                    f"{_as_str(it.get('head'))}：{_as_str(it.get('body'))}"[:80]
                )
        return {
            "type": "card",
            "label": "补充",
            "title": _as_str(page.get("title") or "再补一层"),
            "body": "\n".join(body_bits) or _as_str(page.get("intro") or "承接上文，补充可执行细节。"),
            "tips": ["对照上一页要点执行", "先做最小一步"],
        }
    if t == "timeline":
        steps = _as_list(page.get("steps"))
        items = []
        for st in steps[:5]:
            if isinstance(st, dict):
                items.append(
                    f"{_as_str(st.get('time'))} {_as_str(st.get('head'))}".strip()
                )
            else:
                items.append(_as_str(st))
        return {
            "type": "summary",
            "title": _as_str(page.get("title") or "步骤速览"),
            "items": [i for i in items if i] or ["按时间线推进，一步只做一件事"],
        }
    if t == "card":
        return {
            "type": "points",
            "title": _as_str(page.get("title") or "拆开看"),
            "items": [
                {"head": "要点", "body": _as_str(page.get("body") or "补充具体内容")[:120]},
                *[
                    {"head": f"提示{i+1}", "body": _as_str(tip)}
                    for i, tip in enumerate(_as_list(page.get("tips"))[:3])
                ],
            ][:5],
        }
    if t in ("photo", "gallery"):
        # 连续配图过多时保留内容，但改成 gallery 合并意图由上层处理；这里标 summary 会丢图
        return page
    if t == "summary":
        items = _as_list(page.get("items"))
        text = "\n".join(_as_str(x) for x in items[:3] if _as_str(x))
        return {
            "type": "quote",
            "text": text or "先记住结论，再回头执行。",
            "from": "本篇收束",
        }
    if t == "chapter":
        return {
            "type": "card",
            "label": "过渡",
            "title": _as_str(page.get("title") or "接着往下"),
            "body": _as_str(page.get("desc") or "上一页定了方向，这页把方法讲清。"),
        }
    if t == "compare" and prev_type == "compare":
        return {
            "type": "summary",
            "title": _as_str(page.get("title") or "对比结论"),
            "items": [
                f"{_as_str(r.get('label'))}：{' / '.join(_as_str(v) for v in _as_list(r.get('values'))[:2])}"
                for r in _as_list(page.get("rows"))[:4]
                if isinstance(r, dict)
            ] or ["按目标选更匹配的一侧，而不是更热闹的一侧"],
        }
    return page


def _reposition_media_pages(pages: list[dict]) -> tuple[list[dict], list[str]]:
    """配图页插在干货中后段：封面后不要立刻 photo/gallery，收束/ending 前落位。"""
    warnings: list[str] = []
    if len(pages) < 3:
        return pages, warnings

    media = []
    rest = []
    for p in pages:
        if p.get("type") in ("photo", "gallery"):
            media.append(p)
        else:
            rest.append(p)

    if not media:
        return pages, warnings

    # 找干货末尾：最后一个 DRY_GOODS，否则 summary/quote 之前
    insert_at = None
    last_dry = -1
    first_close = -1
    ending_at = len(rest)
    for i, p in enumerate(rest):
        t = p.get("type")
        if t in DRY_GOODS_TYPES:
            last_dry = i
        if t in CLOSING_TYPES and first_close < 0:
            first_close = i
        if t == "ending":
            ending_at = i
            break

    if last_dry >= 0:
        insert_at = last_dry + 1
    elif first_close >= 0:
        insert_at = first_close
    else:
        insert_at = ending_at

    # 不允许插在 cover 正后方（index 1）当后面还有干货
    if insert_at <= 1 and any(p.get("type") in DRY_GOODS_TYPES for p in rest):
        for i, p in enumerate(rest):
            if p.get("type") in DRY_GOODS_TYPES:
                insert_at = i + 1
                break

    new_pages = rest[:insert_at] + media + rest[insert_at:]
    if [p.get("type") for p in new_pages] != [p.get("type") for p in pages]:
        warnings.append("已将 photo/gallery 调整到干货中后段，避免打断叙事主线")
    return new_pages, warnings


def validate_page_flow(
    pages: list[dict],
    *,
    brand: str = "XHSStudio",
    soft_flow: bool = False,
) -> tuple[list[dict], list[str]]:
    """
    页流校验：逻辑清晰优先，模板形态其次。

    硬底线：cover 置顶、ending 置底；cover→ending 空壳补实质页；页数硬顶 12。
    软引导：中间自由组合，但须能抽出主题句；缺痛点/干货层时轻量补页（不乱插）；
    同 type 过长 warn/轻量打断；compare 缺信息补全或降级。

    soft_flow=True（单页 revise）：只做 cover/ending 归位与 compare 修补，
    **禁止插页/拆页/重排中间页**，避免 page_index 漂移导致「改了没反应」。
    """
    warnings: list[str] = []
    if not isinstance(pages, list) or not pages:
        return [
            _placeholder_cover(),
            _placeholder_points(),
            _placeholder_ending(brand),
        ], ["页流为空，已重建可渲染骨架（软兜底）"]

    pages = [p for p in pages if isinstance(p, dict) and p.get("type") in VALID_TYPES]
    if not pages:
        return [
            _placeholder_cover(),
            _placeholder_points(),
            _placeholder_ending(brand),
        ], ["无有效页，已重建可渲染骨架（软兜底）"]

    covers = [p for p in pages if p.get("type") == "cover"]
    non_covers = [p for p in pages if p.get("type") != "cover"]
    if not covers:
        pages = [_placeholder_cover()] + non_covers
        warnings.append("建议有封面：已补 cover 并置顶")
    else:
        cover = covers[0]
        demoted = []
        for extra in covers[1:]:
            demoted.append({
                "type": "card",
                "label": "补充",
                "title": _as_str(extra.get("title") or "补充说明"),
                "body": _as_str(
                    extra.get("subtitle") or extra.get("kicker") or "承接上文，补充关键信息。"
                ),
            })
            warnings.append("多余封面已降级为 card（保留内容）")
        pages = [cover] + demoted + non_covers

    endings = [p for p in pages if p.get("type") == "ending"]
    body = [p for p in pages if p.get("type") != "ending"]
    if not endings:
        pages = body + [_placeholder_ending(brand)]
        warnings.append("建议有结尾：已补 ending")
    else:
        ending = endings[-1]
        if len(endings) > 1:
            extras = []
            for ex in endings[:-1]:
                extras.append({
                    "type": "card",
                    "label": "收束",
                    "title": _as_str(ex.get("title") or "补充收束"),
                    "body": _as_str(
                        ex.get("desc") or " ".join(_as_list(ex.get("cta"))[:2]) or "记得行动起来"
                    ),
                })
            warnings.append("多余结尾已降级为 card，仅保留最后 ending")
            body = [p for p in body if p.get("type") != "ending"] + extras
        pages = body + [ending]

    if pages[0].get("type") != "cover":
        cover = next((p for p in pages if p.get("type") == "cover"), _placeholder_cover())
        pages = [cover] + [p for p in pages if p is not cover]
        warnings.append("已将 cover 移到第一页（软引导）")
    if pages[-1].get("type") != "ending":
        ending = next(
            (p for p in reversed(pages) if p.get("type") == "ending"),
            _placeholder_ending(brand),
        )
        pages = [p for p in pages if p is not ending] + [ending]
        warnings.append("已将 ending 移到最后一页（软引导）")

    fixed: list[dict] = []
    for i, p in enumerate(pages):
        if p.get("type") != "chapter":
            fixed.append(p)
            continue
        next_t = pages[i + 1].get("type") if i + 1 < len(pages) else None
        if next_t == "ending" or next_t is None:
            fixed.append({
                "type": "free",
                "title": _as_str(p.get("title") or "为什么值得看"),
                "paragraphs": [_as_str(p.get("desc") or "先对齐痛点，下一页给方法。")],
                "bullets": ["记住这一层动机，再往下看干货"],
            })
            warnings.append("chapter 后无实质内容：已轻量改为 free（保留文案）")
            continue
        if fixed and fixed[-1].get("type") == "chapter":
            warnings.append("连续 chapter：已保留（结构建议，未强制改写）")
        fixed.append(p)
    pages = fixed

    if not soft_flow:
        if len(pages) >= 2 and pages[0].get("type") == "cover" and pages[1].get("type") == "ending":
            pages = [pages[0], _placeholder_points(), pages[1]]
            warnings.append("封面后直接 ending，已插入要点页")
        elif len(pages) == 2 and pages[0].get("type") == "cover" and pages[1].get("type") != "ending":
            pages = [pages[0], pages[1], _placeholder_ending(brand)]
            warnings.append("过短页流，已补 ending")

        substance_count = sum(1 for p in pages if p.get("type") in SUBSTANCE_TYPES)
        if substance_count == 0:
            pages = [pages[0]] + [_placeholder_points()] + (
                pages[1:] if pages[-1].get("type") == "ending" else pages[1:] + [_placeholder_ending(brand)]
            )
            warnings.append("无实质干货页，已插入 points")

        # 逻辑清晰：缺痛点层 / 干货层时轻量补页（不锁死模板、不乱插对比）
        mid = [p for p in pages[1:-1] if isinstance(p, dict)]
        has_pain = any(
            _as_str(p.get("role")) in _PAIN_ROLES
            or p.get("type") == "chapter"
            or (
                p.get("type") in ("card", "free")
                and any(
                    k in (_page_title_line(p) + _as_str(p.get("body")) + _as_str(p.get("desc")))
                    for k in ("痛点", "卡在", "别再", "为什么", "困扰", "难处")
                )
            )
            for p in mid
        )
        has_method = any(p.get("type") in _METHOD_TYPES for p in mid)
        if pages and pages[0].get("type") == "cover" and pages[-1].get("type") == "ending":
            if not has_pain and len(pages) <= 10:
                pages = [pages[0], _placeholder_pain()] + pages[1:]
                warnings.append("中间缺少痛点/共鸣层，已轻量补一页（逻辑清晰优先）")
                mid = [p for p in pages[1:-1] if isinstance(p, dict)]
                has_method = any(p.get("type") in _METHOD_TYPES for p in mid)
            if not has_method and len(pages) <= 11:
                pages = pages[:-1] + [_placeholder_points("核心方法")] + [pages[-1]]
                warnings.append("中间缺少干货/方法层，已轻量补 points")

    new_pages = []
    for p in pages:
        if p.get("type") != "compare":
            new_pages.append(p)
            continue
        if _compare_sides_complete(p):
            new_pages.append(p)
            continue
        repaired = _repair_block(p) or p
        if _compare_sides_complete(repaired):
            new_pages.append(repaired)
            warnings.append("compare 列/值已自动补全")
        else:
            rows = _as_list(repaired.get("rows"))
            items = []
            for r in rows[:5]:
                if isinstance(r, dict):
                    label = _as_str(r.get("label"))
                    vals = " / ".join(
                        _as_str(v) for v in _as_list(r.get("values"))[:2] if _as_str(v).strip()
                    )
                    items.append(f"{label}：{vals}" if vals else label)
            new_pages.append({
                "type": "summary",
                "title": _as_str(repaired.get("title") or "对比结论"),
                "items": [i for i in items if i] or ["两侧信息不足，先记住决策标准再选"],
            })
            warnings.append("compare 两侧信息不完整，已降级为 summary")
    pages = new_pages

    if soft_flow:
        # 单页改写：不做连续同 type 转换，避免用户正在改的页被换成别的 type
        return pages[:12], warnings

    run_fixed: list[dict] = []
    run_type = None
    run_len = 0
    for p in pages:
        t = p.get("type")
        if t == run_type:
            run_len += 1
        else:
            run_type = t
            run_len = 1
        if run_len > MAX_SAME_TYPE_RUN and t not in ("cover", "ending"):
            if t in ("points", "timeline", "free", "composite") and run_len == MAX_SAME_TYPE_RUN + 1:
                warnings.append(
                    f"连续 {run_len} 个 {t}：结构建议穿插其他模块（已保留，未强制改）"
                )
                run_fixed.append(p)
                continue
            converted = _convert_run_overflow(p, run_type)
            if converted.get("type") != t:
                warnings.append(f"连续超过 {MAX_SAME_TYPE_RUN} 个 {t}，已轻量转换打断")
                run_fixed.append(converted)
                run_type = converted.get("type")
                run_len = 1
            elif t in ("photo", "gallery") and run_fixed:
                prev = run_fixed[-1]
                imgs = []
                if prev.get("type") == "gallery":
                    imgs = list(_as_list(prev.get("images")))
                elif prev.get("type") == "photo" and prev.get("image"):
                    imgs = [_as_str(prev.get("image"))]
                    prev = {
                        "type": "gallery",
                        "title": _as_str(prev.get("title") or "图集"),
                        "images": imgs,
                    }
                    run_fixed[-1] = prev
                add = _as_list(p.get("images")) if t == "gallery" else []
                if t == "photo" and p.get("image"):
                    add = [_as_str(p.get("image"))]
                for u in add:
                    s = _as_str(u).strip()
                    if s and s not in imgs:
                        imgs.append(s)
                prev["images"] = imgs[:9]
                warnings.append("连续配图已合并为 gallery")
                run_type = "gallery"
                run_len = 1
            else:
                run_fixed.append(p)
        else:
            run_fixed.append(p)
    pages = run_fixed

    pages, w_media = _reposition_media_pages(pages)
    warnings.extend(w_media)

    if pages[0].get("type") != "cover":
        pages.insert(0, _placeholder_cover())
    if pages[-1].get("type") != "ending":
        pages.append(_placeholder_ending(brand))
    if len(pages) > 12:
        head = [pages[0]]
        tail = [pages[-1]]
        mid = pages[1:-1]
        keep: list[dict] = []
        media_buf: list[dict] = []
        for p in mid:
            if p.get("type") in ("photo", "gallery"):
                media_buf.append(p)
            else:
                keep.append(p)
        budget = 12 - 2
        trimmed = keep[:budget]
        remain = budget - len(trimmed)
        if remain > 0:
            trimmed.extend(media_buf[:remain])
        pages = head + trimmed + tail
        warnings.append("页数超过 12，已裁剪中间页并保留首尾")
    elif len(pages) < 5:
        warnings.append(f"页数 {len(pages)} 偏少（建议 5–12），已保留 AI 编排未强制扩写")

    return pages, warnings


def outline_types_match_pages(outline: Any, pages: list[dict]) -> tuple[bool, str]:
    """outline 仅叙事意图参考；有 type 才软比对，不阻断。"""
    if not isinstance(outline, list) or not outline:
        return True, ""
    otypes = []
    intents = []
    for item in outline:
        if isinstance(item, dict):
            ot = _as_str(item.get("type")).strip().lower()
            if ot:
                otypes.append(ot)
            intent = _as_str(item.get("intent") or item.get("goal") or item.get("role") or "")
            if intent:
                intents.append(intent)
        else:
            s = _as_str(item).strip().lower()
            if s in VALID_TYPES:
                otypes.append(s)
            elif s:
                intents.append(s)
    if not otypes:
        return True, ""
    ptypes = [_as_str(p.get("type")).strip().lower() for p in pages if isinstance(p, dict)]
    if otypes != ptypes:
        return False, (
            f"outline.type 与 pages 不完全一致（已以 pages 为准，不阻断）: "
            f"outline={otypes} pages={ptypes}"
        )
    return True, ""


def _sync_outline_types_to_pages(outline: list, pages: list[dict]) -> list:
    """Repair 后以 pages 为准同步 outline.type，保留 intent 文案。"""
    ptypes = [_as_str(p.get("type")).strip().lower() for p in pages if isinstance(p, dict)]
    out: list = []
    for i, item in enumerate(outline):
        if isinstance(item, dict):
            row = dict(item)
            if i < len(ptypes):
                row["type"] = ptypes[i]
            out.append(row)
        elif i < len(ptypes):
            out.append({"type": ptypes[i], "intent": _as_str(item)})
        else:
            out.append(item)
    for j in range(len(outline), len(ptypes)):
        out.append({"type": ptypes[j], "intent": f"第{j + 1}页"})
    return out


def validate_and_repair(
    data: Any,
    meta_defaults: dict | None = None,
    *,
    soft_flow: bool = False,
) -> tuple[dict, list[str]]:
    """
    Validate DATA; repair illegal fields. Always returns a renderable structure.
    Returns (data, warnings).

    soft_flow=True：单页 revise 用，禁止插页式页流补强，保持 page_index 稳定。
    """
    warnings: list[str] = []
    defaults = meta_defaults or {}

    if not isinstance(data, dict):
        warnings.append("根对象非法，已重建")
        data = {}

    meta_in = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    author = _as_str(meta_in.get("author") or defaults.get("author") or "创作者")
    brand = _as_str(meta_in.get("brand") or defaults.get("brand") or "@XHSStudio")
    avatar = _as_str(meta_in.get("avatar") or defaults.get("avatar") or (author[0] if author else "X"))
    meta = {"author": author, "avatar": avatar[:2], "brand": brand}

    pages_in = data.get("pages")
    if not isinstance(pages_in, list) or not pages_in:
        warnings.append("pages 为空，已插入占位封面")
        pages_in = [{"type": "cover", "title": "未命名笔记", "subtitle": "请重新生成"}]

    pages: list[dict] = []
    for i, p in enumerate(pages_in[:12]):
        repaired = _repair_block(p if isinstance(p, dict) else {})
        if repaired is None:
            warnings.append(f"第 {i + 1} 页无法识别，已跳过")
            continue
        if repaired["type"] == "composite":
            raw_blocks = _as_list(p.get("blocks") if isinstance(p, dict) else [])
            unknown = [
                b for b in raw_blocks
                if isinstance(b, dict)
                and _as_str(b.get("type")).strip().lower() not in COMPOSITE_ALLOWED | {"", "free"}
            ]
            if unknown:
                warnings.append(f"第 {i + 1} 页 composite 含未知子块，已降级为 card 保留")
        repaired, pq_warn = _repair_free_pull_quote(repaired)
        if pq_warn:
            warnings.append(f"第 {i + 1} 页：{pq_warn}")
        pages.append(repaired)

    if not pages:
        pages = [{"type": "cover", "title": "未命名笔记", "kicker": "DEMO"}]
        warnings.append("全部页面修复失败，已使用占位")

    pages, flow_warnings = validate_page_flow(pages, brand=brand, soft_flow=soft_flow)
    warnings.extend(flow_warnings)

    # outline 一致性（若模型给了 outline）：仅软比对，不写入 warnings，避免用户误以为「排版被删」
    outline = data.get("outline")
    if isinstance(outline, list) and outline:
        ok, _msg = outline_types_match_pages(outline, pages)
        if not ok:
            # 以修复后 pages 为准，回写 outline.type 避免 JSON/调试里两套结构打架
            outline = _sync_outline_types_to_pages(outline, pages)

    theme_in = _as_str(data.get("theme")).strip()
    pages, theme, logic_summary = enrich_page_narrative(pages, theme=theme_in)
    # 大纲以修复后 pages.role 为准（补页后仍一眼可读）；模型稿仅作空结果兜底
    if not logic_summary:
        raw_summary = data.get("logic_summary")
        if isinstance(raw_summary, list):
            cleaned = [_as_str(x).strip() for x in raw_summary if _as_str(x).strip()]
            if cleaned:
                logic_summary = cleaned[:6]

    return {
        "meta": meta,
        "pages": pages,
        "theme": theme,
        "logic_summary": logic_summary,
        **({"outline": outline} if isinstance(outline, list) and outline else {}),
    }, warnings


def ensure_style_meta(data: dict, style: str) -> dict:
    out = deepcopy(data)
    out.setdefault("meta", {})
    return out
