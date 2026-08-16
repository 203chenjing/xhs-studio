# -*- coding: utf-8 -*-
"""Layout recipe + per-page variant catalog for xhs-studio AI pipelines.

Loads ``knowledge/layout-recipes.json`` and ``knowledge/page-layout-variants.json``,
builds compact prompt sections for generate / layout-ideas (json-render catalog pattern).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
_CATALOG_PATH = _ROOT / "knowledge" / "layout-recipes.json"
_VARIANTS_PATH = _ROOT / "knowledge" / "page-layout-variants.json"


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    if not _CATALOG_PATH.is_file():
        return {"version": "0", "recipes": [], "sources": []}
    with _CATALOG_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"version": "0", "recipes": [], "sources": []}
    recipes = data.get("recipes")
    if not isinstance(recipes, list):
        data["recipes"] = []
    return data


@lru_cache(maxsize=1)
def load_variants() -> dict[str, Any]:
    if not _VARIANTS_PATH.is_file():
        return {"version": "0", "page_types": {}}
    with _VARIANTS_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"version": "0", "page_types": {}}
    page_types = data.get("page_types")
    if not isinstance(page_types, dict):
        data["page_types"] = {}
    return data


def list_recipes() -> list[dict[str, Any]]:
    return [r for r in load_catalog().get("recipes", []) if isinstance(r, dict)]


def get_recipe(recipe_id: str) -> dict[str, Any] | None:
    rid = (recipe_id or "").strip()
    if not rid:
        return None
    for r in list_recipes():
        if str(r.get("id") or "") == rid:
            return r
    return None


def list_variants_for_type(page_type: str) -> list[dict[str, Any]]:
    pt = (page_type or "").strip()
    block = load_variants().get("page_types", {}).get(pt)
    if not isinstance(block, dict):
        return []
    variants = block.get("variants")
    return [v for v in variants if isinstance(v, dict)] if isinstance(variants, list) else []


def get_variant(page_type: str, variant_id: str) -> dict[str, Any] | None:
    vid = (variant_id or "").strip()
    if not vid:
        return None
    for v in list_variants_for_type(page_type):
        if str(v.get("id") or "") == vid:
            return v
    return None


def is_valid_variant(page_type: str, variant_id: str) -> bool:
    return get_variant(page_type, variant_id) is not None


def default_variant_for_type(page_type: str) -> str:
    block = load_variants().get("page_types", {}).get(page_type) or {}
    if isinstance(block, dict) and block.get("default"):
        return str(block["default"])
    return "default"


def _recipe_line(r: dict[str, Any]) -> str:
    rid = r.get("id", "")
    name = r.get("name", "")
    best = "/".join(r.get("best_for") or [])
    types = "→".join(r.get("page_types") or [])
    arc = r.get("arc", "")
    dens = r.get("density", "normal")
    hint = r.get("style_hint", "")
    notes = str(r.get("visual_notes") or "")[:100]
    slots = r.get("page_variant_slots") or []
    slot_s = ""
    if isinstance(slots, list) and slots:
        parts = []
        for s in slots[:6]:
            if isinstance(s, dict):
                parts.append(f"{s.get('type', '?')}:{s.get('variant', 'default')}")
        if parts:
            slot_s = f" | 变体:{','.join(parts)}"
    return (
        f"- {rid}「{name}」arc={arc} density={dens} style={hint} "
        f"适合:{best} | 页型:{types} | {notes}{slot_s}"
    )


def build_variants_prompt_section(*, max_types: int = 12) -> str:
    """Compact per-page-type variant catalog for generate prompts."""
    cat = load_variants()
    page_types = cat.get("page_types") or {}
    if not isinstance(page_types, dict) or not page_types:
        return ""

    lines = [
        "## 单页排版变体（每页输出 layoutVariant，同篇勿全用 default）",
        "生成 pages[] 时：除 type/density 外，为每页设 layoutVariant（从下列 id 选）。",
        "points 的 ledger 可用 layoutVariant=ledger 或 pointsStyle=ledger。",
        "",
    ]
    count = 0
    for ptype, block in page_types.items():
        if count >= max_types:
            break
        if not isinstance(block, dict):
            continue
        variants = block.get("variants") or []
        if not isinstance(variants, list):
            continue
        ids = [str(v.get("id", "")) for v in variants if isinstance(v, dict) and v.get("id")]
        if not ids:
            continue
        default = block.get("default", ids[0])
        lines.append(f"- {ptype}: default={default} | 可选 {', '.join(ids)}")
        count += 1
    lines.append("")
    lines.append(
        "选型：封面 hook→cover:number-shock/question-hook/magazine；"
        "长文→free:magazine-columns/wide-lead/pull-quote-inline（pullQuote 须为短句/原话，勿复制整段 paragraphs）；"
        "清单→points:ledger/pill-tags/left-bar-minimal；"
        "章节→chapter:roman-numeral/big-number；"
        "面经 STAR→timeline:number-ladder + quote:center-hero；"
        "对比→compare:swipe-before-after；收束→summary:checklist/metric-cards/one-liner-stack；"
        "结尾→ending:tag-wall/cta-pill。"
    )
    return "\n".join(lines)


def build_catalog_prompt_section(*, max_recipes: int = 28) -> str:
    """Compact catalog block for SYSTEM_GENERATE / layout-ideas."""
    cat = load_catalog()
    recipes = list_recipes()[:max_recipes]
    if not recipes:
        return build_variants_prompt_section()

    lines = [
        "## 排版菜谱库（从 catalog 选 1 个主 recipe，可局部变形）",
        "生成时：brief 输出 layout_recipe（recipe id）；按 page_mix 组页；",
        "每页设 layoutVariant（见下方变体库），同篇各页尽量不同变体。",
        "画布 1080×1440；无 emoji；信息密度 ≥60% 画面高度。",
        "",
    ]
    for r in recipes:
        lines.append(_recipe_line(r))
    lines.append("")
    lines.append(
        "选型提示：清单/导购→ledger-buying-guide 或 ins-minimal-scan；"
        "面经→interview-star-arc 或 autumn-interview-mix；对比→before-after-compare；"
        "教程→step-pipeline 或 horizontal-tutorial-flow；多图→evidence-wall；"
        "长文→chapter-pacing-long；金句节奏→quote-invert-rhythm。"
    )
    sources = cat.get("sources") or []
    if sources:
        lines.append(f"（菜谱来源：{'; '.join(str(s) for s in sources[:4])}…）")
    variant_block = build_variants_prompt_section()
    if variant_block:
        lines.append("")
        lines.append(variant_block)
    return "\n".join(lines)


def build_recipe_hint(recipe_id: str) -> str:
    """Single-recipe detail for setLayoutRecipe / revise context."""
    r = get_recipe(recipe_id)
    if not r:
        return ""
    mix = r.get("page_mix") or {}
    mix_s = ", ".join(f"{k}×{v}" for k, v in mix.items()) if isinstance(mix, dict) else ""
    parts = [
        f"菜谱 {r.get('id')}「{r.get('name')}」",
        str(r.get("description") or ""),
        f"建议页型组合: {mix_s}",
        f"visual: {r.get('visual_notes', '')}",
    ]
    if r.get("points_style"):
        parts.append(f"points 默认 layout={r['points_style']}")
    slots = r.get("page_variant_slots")
    if isinstance(slots, list) and slots:
        slot_parts = []
        for s in slots:
            if isinstance(s, dict):
                slot_parts.append(f"{s.get('type')}→{s.get('variant')}")
        if slot_parts:
            parts.append("页变体槽: " + " | ".join(slot_parts))
    if r.get("html_ref"):
        parts.append(f"HTML 参考: {r['html_ref']}")
    return " | ".join(p for p in parts if p)


def _apply_variant_to_page(page: dict[str, Any], page_type: str, variant_id: str) -> dict[str, Any]:
    out = dict(page)
    vid = (variant_id or "").strip()
    if not vid or not is_valid_variant(page_type, vid):
        return out
    out["layoutVariant"] = vid
    style = out.get("style") if isinstance(out.get("style"), dict) else {}
    out["style"] = {**style, "layoutVariant": vid}
    if page_type == "points":
        vdef = get_variant("points", vid)
        layout_key = (vdef or {}).get("layout_key") or vid
        if layout_key in ("cards", "ledger"):
            out["pointsStyle"] = layout_key
            out["style"]["pointsStyle"] = layout_key
    return out


def apply_recipe_defaults(page: dict[str, Any], recipe_id: str) -> dict[str, Any]:
    """Apply non-destructive style defaults from a recipe to a page dict."""
    r = get_recipe(recipe_id)
    if not r or not isinstance(page, dict):
        return page
    out = dict(page)
    dens = r.get("density")
    if dens in ("compact", "normal", "airy"):
        out["density"] = dens
    ptype = str(out.get("type") or "")
    ps = r.get("points_style")
    if ps in ("cards", "ledger") and ptype == "points":
        out = _apply_variant_to_page(out, "points", ps)
    # per-type default from recipe.page_variants map
    pv = r.get("page_variants")
    if isinstance(pv, dict) and ptype and ptype in pv:
        out = _apply_variant_to_page(out, ptype, str(pv[ptype]))
    out["layoutRecipe"] = str(r.get("id") or recipe_id)
    return out


def apply_recipe_slot_variants(pages: list[dict[str, Any]], recipe_id: str) -> list[dict[str, Any]]:
    """Apply page_variant_slots from a recipe onto a pages list (by order)."""
    r = get_recipe(recipe_id)
    if not r or not isinstance(pages, list):
        return pages
    slots = r.get("page_variant_slots")
    if not isinstance(slots, list) or not slots:
        return pages
    out_pages = [dict(p) if isinstance(p, dict) else p for p in pages]
    slot_idx = 0
    for i, page in enumerate(out_pages):
        if not isinstance(page, dict):
            continue
        ptype = str(page.get("type") or "")
        while slot_idx < len(slots):
            slot = slots[slot_idx]
            slot_idx += 1
            if not isinstance(slot, dict):
                continue
            if str(slot.get("type") or "") == ptype:
                variant = str(slot.get("variant") or "")
                out_pages[i] = _apply_variant_to_page(page, ptype, variant)
                dens = slot.get("density")
                if dens in ("compact", "normal", "airy"):
                    out_pages[i]["density"] = dens
                break
    return out_pages
