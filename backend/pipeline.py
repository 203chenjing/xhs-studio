# -*- coding: utf-8 -*-
"""LLM pipeline for xhs-studio — 「2+1」调用架构（禁止串行多 Agent）。

主路径 2 次 LLM：
  ① generate — 全篇一次出 JSON（文案 + 页结构）
  ② review   — 生成后内容审核（见 review.py）

+1（仅用户主动点才调用）：
  · page/revise   — 单页编辑：有 Key 时 LLM 优先（专业 prompt → ops）；
                     无 Key / LLM 失败时规则兜底出 ops，并标明 rules_fallback
  · layout-ideas  — 三种排版思路

禁止：为单页修改再开「协调 Agent」。
审核只在生成后、以及用户点「重新审核 / 大改后复审」时跑，不在每次改页后自动全量 review。
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from demo import build_demo_payload
from images import assign_images_to_pages, normalize_image_urls
from prompts.copy_playbook import (
    build_playbook_prompt_section,
    build_type_guidance,
    infer_content_type,
)
from prompts.layout_catalog import apply_recipe_defaults, build_catalog_prompt_section, get_recipe
from prompts.page_editor import (
    SYSTEM_PAGE_EDITOR,
    STYLE_VOICE,
    build_page_editor_user,
    supplement_context_block,
)
from schema import validate_and_repair
from themes import match_style
from timing import TimingTracker

_log = logging.getLogger("xhs.revise")


def _api_meta(
    step: str,
    llm_calls: int,
    estimated_seconds: int | float,
    timing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Lightweight response meta for UI step / ETA display."""
    meta: dict[str, Any] = {
        "step": step,
        "llm_calls": int(llm_calls),
        "estimated_seconds": int(estimated_seconds),
    }
    if timing:
        meta["timing"] = timing
    return meta


def _logic_fields(data: dict, raw: dict | None = None) -> tuple[str, list[str]]:
    """Pick theme + logic_summary from repaired data / LLM raw."""
    theme = ""
    summary: list[str] = []
    if isinstance(data, dict):
        theme = str(data.get("theme") or "").strip()
        ls = data.get("logic_summary")
        if isinstance(ls, list):
            summary = [str(x).strip() for x in ls if str(x).strip()][:6]
    if isinstance(raw, dict):
        if not theme:
            theme = str(raw.get("theme") or "").strip()
        if not summary and isinstance(raw.get("logic_summary"), list):
            summary = [str(x).strip() for x in raw["logic_summary"] if str(x).strip()][:6]
    return theme, summary

SYSTEM_GENERATE = """你是小红书图文「编排导演」+ 资深博主。视觉系统（主题色/字体/边距/1080×1440）已固定；你负责按内容需要自由组页，不要套固定七页模板。

一次输出完整 JSON（不要 markdown 代码块）。禁止 emoji（可用 > * ◆ —）。

## 逻辑清晰（最高优先级）
读者翻页必须立刻懂：这篇在讲什么、现在讲到哪、下一页为什么出现。
- 整篇用一句话主题贯穿（输出 theme）
- 每页必须有叙事角色 role（短中文标签：钩子/痛点/共鸣/方法/证据/对比/总结/金句/章节/配图/行动 等）
- 每页建议 progress（如 "03 / 08"）与 bridge（一句承接上一页，可作 intro/小字）
- 每页标题单独读懂且不跳戏；禁止同义反复、无关对比、拼盘感
- 输出 logic_summary：3–6 条「本篇结构」大纲（如 ①钩子 · … ②痛点 · …）

## 角色与叙事
你不是填空机器。按内容选模块，页数建议 5–12。
叙事目标（软引导，可变形）：钩子 → 痛点/价值 → 证据/方法 → 总结 → 行动。
中间结构随意图变化，例如：
- 清单型：points / free / composite 为主
- 故事型：chapter + free + quote + timeline
- 对比型：compare 为核心，前后用 free/card 铺垫与收束
鼓励用 composite 做「一页内图文/多模块混排」。结构可灵活，但主线必须一眼可读。

## 信息密度（硬性）
每页文案要让人感觉内容占画面高度约 60%+，禁止只有 3 个超短句撑一整页。
- cover：强 hook；subtitle 含人群+收益+场景
- points：3-5 条；body 2-3 句（场景+细节/数字+结论），约 35-70 字
- timeline：3-5 步；body 含「做什么 + 小贴士/避坑」
- compare：cols 必须 3 列 [{head:"维度",tone:"neutral"},{head:"方案A",tone:"neg"},{head:"方案B",tone:"pos"}]；rows 4-6；values 长度=2，两侧完整短句（8-18字）
- card：body 2-4 句；tips 可选
- free：title + paragraphs[1-4] + bullets[可选] + image?；大字可读、信息铺满
- quote / summary / ending：有记忆点与 CTA
- composite：blocks 2-4 个可混排模块（见下）

## 发布文案（与页内分开，必须输出）
- title：主推标题，约 16–28 字，尽量单行
- hooks：3–5 个标题候选
- caption：可直接粘贴的笔记正文（钩子 → 干货展开 → 空行 → 5–8 个 #话题）

## Schema
{
  "brief": { "topic":"主题", "audience":"受众", "tone":"语气", "content_type":"面经|干货|清单", "pages_hint":7, "arc":"list|story|compare|mixed", "keywords":["关键词"] },
  "theme": "一句话主题（贯穿全文）",
  "logic_summary": ["①钩子 · …", "②痛点 · …", "③方法 · …"],
  "outline": [ {"intent":"钩子/痛点/方法/行动…", "type":"可选建议模块"} ],
  "style_hint": "ins|literary|orange|bold-signal|terminal|brutalist|botanical 之一或留空",
  "title": "主推标题",
  "hooks": ["候选1","候选2"],
  "caption": "笔记正文\n\n#话题",
  "data": {
    "meta": { "author":"昵称", "avatar":"单字", "brand":"@账号" },
    "theme": "可与顶层相同",
    "pages": [ /* 5-12 页；每页带 role，建议 progress/bridge */ ]
  }
}

outline 只定「叙事意图」，type 为建议不必与最终 pages 锁死。
pages[].type 可选：
cover|chapter|points|timeline|card|quote|compare|summary|ending|composite|photo|gallery|free
未知 type 系统会降级为 card，仍请尽量用上表。

字段（多为可选，缺了系统会兜底）：
- 每页通用：role（必填叙事角色）；可选 progress/step、bridge
- cover: title；可选 kicker,subtitle,tags,image
- chapter: no,title；可选 desc
- points: title,items[{head,body}]；可选 intro,image
- timeline: title,steps[{time,head,body}]
- card: title,body；可选 label,tips[],image
- free: title；paragraphs[]；可选 bullets[],image,kicker
- photo: title；可选 body；image
- gallery: title；images[]；可选 caption
- quote: text；可选 from
- compare: 见上方规则
- summary: title,items[]；可选 metrics[{num,unit}]
- ending: title；可选 desc,cta[],tags[],contact
- composite: 可选 title；blocks 为 points/timeline/card/quote/compare/summary/free，最多 4；勿嵌套 cover/chapter/ending
  任意页若自带 blocks 字段，系统会按 composite 渲染

## compare 正确示例
{
  "type":"compare",
  "role":"对比",
  "progress":"05 / 08",
  "bridge":"方法讲完，用一张表帮你拍板",
  "title":"白天 vs 夜游，差别有多大",
  "cols":[
    {"head":"维度","tone":"neutral"},
    {"head":"白天","tone":"neg"},
    {"head":"夜游","tone":"pos"}
  ],
  "rows":[
    {"label":"人流体验","values":["景区扎堆排队久","光线柔和更好出片"]},
    {"label":"适合谁","values":["想赶行程打卡党","喜欢氛围和拍照的人"]}
  ]
}

若用户提供了 image_urls：必须原样写入 image/images；封面用最吸睛一张；其余分到 photo/gallery/card/points/free；勿丢图。
作者信息用用户提供的 author/brand。

brief 额外字段：
- content_type：面经 | 干货 | 清单（从 intent 推断；决定文案语气与 hook，见 playbook）
- layout_recipe（从排版菜谱库选一个 id，如 ledger-buying-guide / interview-star-arc / autumn-interview-mix）
"""

_CATALOG_SECTION = build_catalog_prompt_section()
_COPY_SECTION = build_playbook_prompt_section()
if _CATALOG_SECTION:
    SYSTEM_GENERATE = SYSTEM_GENERATE.rstrip() + "\n\n" + _CATALOG_SECTION + "\n"
if _COPY_SECTION:
    SYSTEM_GENERATE = SYSTEM_GENERATE.rstrip() + "\n\n" + _COPY_SECTION + "\n"

SYSTEM_REVISE = """你是小红书图文笔记编辑。按用户自然语言修改 DATA JSON。
只输出 JSON：{ "data": { "meta":..., "pages":..., "theme":"可选" }, "title": "可选", "caption": "可选", "logic_summary": ["可选大纲"] }
你是编排导演：可调整中间页模块与顺序，但必须保持逻辑清晰——读者要懂「现在讲到哪」。
建议保留 cover 开头、ending 结尾；保留或补齐每页 role / progress / bridge。
可用 type：cover|chapter|points|timeline|card|quote|compare|summary|ending|composite|photo|gallery|free
composite.blocks 可含 free；未知 type 会被降级为 card。
保留已有 image/images URL，除非用户要求替换。不要 emoji。不要 markdown 代码块。
保持高信息密度；compare 须 3 列表头且 values 长度=2。
若指定 page_index（从 0 起），优先改该页，可微调相邻页。
若提供 issues（审核意见），优先修复：补全空洞、纠正矛盾、补齐 compare、理顺主线、弱化可疑数字；结构建议不必死守固定七页。
"""

def _has_api_key() -> bool:
    return bool(os.getenv("XHS_LLM_API_KEY", "").strip())


def _one_line(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ").replace("\r", " ")).strip()


def _cover_ending(data: dict) -> tuple[dict | None, dict | None]:
    pages = data.get("pages") if isinstance(data, dict) else None
    if not isinstance(pages, list):
        return None, None
    cover = next((p for p in pages if isinstance(p, dict) and p.get("type") == "cover"), None)
    ending = next((p for p in pages if isinstance(p, dict) and p.get("type") == "ending"), None)
    return cover, ending


def fill_publish_fields(
    *,
    title: str | None,
    caption: str | None,
    hooks: list | None,
    data: dict,
    intent: str = "",
) -> tuple[str, str, list[str]]:
    """Ensure title/caption/hooks exist; backfill from cover/ending/hooks when empty."""
    hook_list = [str(h).strip() for h in (hooks or []) if str(h).strip()][:5]
    cover, ending = _cover_ending(data)

    t = _one_line(title or "")
    if not t and hook_list:
        t = _one_line(hook_list[0])
    if not t and cover:
        t = _one_line(_as_page_title(cover.get("title")))
    if not t:
        t = _one_line(intent)[:28] or "小红书干货笔记"

    c = (caption or "").strip()
    if not c:
        parts: list[str] = []
        if cover:
            sub = str(cover.get("subtitle") or "").strip()
            if sub:
                parts.append(sub)
            tags = cover.get("tags") if isinstance(cover.get("tags"), list) else []
        else:
            tags = []
        if ending:
            desc = str(ending.get("desc") or "").strip()
            if desc:
                parts.append(desc)
            cta = ending.get("cta") if isinstance(ending.get("cta"), list) else []
            for x in cta[:2]:
                s = str(x).strip()
                if s:
                    parts.append(s)
            etags = ending.get("tags") if isinstance(ending.get("tags"), list) else []
            if etags:
                tags = etags
        body = "\n".join(parts) if parts else f"关于「{t}」的实用笔记，建议收藏对照。"
        tag_line = " ".join(
            (x if str(x).startswith("#") else f"#{x}")
            for x in tags[:8]
            if str(x).strip()
        ) or "#干货 #小红书"
        c = f"{body}\n\n{tag_line}"

    if not hook_list:
        hook_list = [t]
        if cover and cover.get("subtitle"):
            hook_list.append(_one_line(str(cover.get("subtitle")))[:28])
        hook_list = [h for h in hook_list if h][:5]

    return t, c, hook_list


def _as_page_title(v: Any) -> str:
    return str(v or "").strip()


_CTRL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _sanitize_json_text(text: str) -> str:
    """Strip illegal control chars that break json.loads (common in LLM output)."""
    return _CTRL_CHAR_RE.sub("", text)


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValueError("empty LLM response")
    # strip ```json fences
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    text = _sanitize_json_text(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(_sanitize_json_text(text[start : end + 1]))
        raise


async def _chat_json(system: str, user: str, *, temperature: float = 0.7) -> dict:
    api_key = os.getenv("XHS_LLM_API_KEY", "").strip()
    base = os.getenv("XHS_LLM_BASE_URL", "https://api.deepseek.com/v1").rstrip("/")
    model = os.getenv("XHS_LLM_MODEL", "deepseek-chat")
    url = f"{base}/chat/completions"
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(60.0, connect=10.0)
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(2):
            try:
                req_payload = dict(payload)
                r = await client.post(url, headers=headers, json=req_payload)
                if r.status_code >= 400 and "response_format" in req_payload:
                    req_payload.pop("response_format", None)
                    r = await client.post(url, headers=headers, json=req_payload)
                r.raise_for_status()
                body = r.json()
                content = body["choices"][0]["message"]["content"]
                return _extract_json(content)
            except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as exc:
                last_err = exc
                if attempt == 0:
                    continue
                raise
            except httpx.HTTPStatusError:
                raise
    if last_err:
        raise last_err
    raise RuntimeError("LLM request failed")


async def generate(
    intent: str,
    *,
    author: str | None = None,
    brand: str | None = None,
    style: str | None = None,
    force_demo: bool = False,
    image_urls: list[str] | None = None,
    supplement_context: str | None = None,
) -> dict[str, Any]:
    timer = TimingTracker("generate", intent_snippet=intent[:80])
    author = (author or "创作者").strip() or "创作者"
    brand = (brand or "@XHSStudio").strip() or "@XHSStudio"
    if not brand.startswith("@"):
        brand = "@" + brand
    images = normalize_image_urls(image_urls)

    if force_demo or not _has_api_key():
        with timer.phase("demo_build"):
            payload = build_demo_payload(
                intent, author=author, brand=brand, style=style, image_urls=images,
            )
        with timer.phase("validate_repair"):
            data, warnings = validate_and_repair(
                payload["data"],
                {"author": author, "brand": brand, "avatar": author[0]},
            )
            data = assign_images_to_pages(data, images)
            data, w2 = validate_and_repair(data, data.get("meta"))
        style_id = match_style(payload["brief"], style or payload.get("style"))
        title, caption, hooks = fill_publish_fields(
            title=payload.get("title"),
            caption=payload.get("caption"),
            hooks=payload.get("hooks"),
            data=data,
            intent=intent,
        )
        theme, logic_summary = _logic_fields(data, payload)
        timing = timer.log_and_persist(mode="demo", ok=True)
        return {
            "brief": payload["brief"],
            "style": style_id,
            "data": data,
            "title": title,
            "caption": caption,
            "hooks": hooks,
            "theme": theme,
            "logic_summary": logic_summary,
            "mode": "demo",
            "warnings": warnings + w2,
            "image_count": len(images),
            "meta": _api_meta("generate", 0, 1, timing),
        }

    content_type = infer_content_type(intent)
    copy_guidance = build_type_guidance(content_type)
    supp = (supplement_context or "").strip()
    user_obj: dict[str, Any] = {
        "intent": intent,
        "author": author,
        "brand": brand,
        "preferred_style": style or "",
        "image_urls": images,
        "content_type_hint": content_type,
        "copy_guidance": copy_guidance,
    }
    if supp:
        user_obj["supplement_context"] = supp
    user = json.dumps(user_obj, ensure_ascii=False) + supplement_context_block(supp)
    try:
        with timer.phase("llm_generate"):
            raw = await _chat_json(SYSTEM_GENERATE, user)
    except Exception as exc:  # noqa: BLE001 — fallback must never empty-fail
        with timer.phase("demo_fallback"):
            payload = build_demo_payload(
                intent, author=author, brand=brand, style=style, image_urls=images,
            )
            data, warnings = validate_and_repair(
                payload["data"],
                {"author": author, "brand": brand, "avatar": author[0]},
            )
            data = assign_images_to_pages(data, images)
            data, w2 = validate_and_repair(data, data.get("meta"))
            style_id = match_style(payload["brief"], style or payload.get("style"))
            title, caption, hooks = fill_publish_fields(
                title=payload.get("title"),
                caption=payload.get("caption"),
                hooks=payload.get("hooks"),
                data=data,
                intent=intent,
            )
            theme, logic_summary = _logic_fields(data, payload)
        timing = timer.log_and_persist(
            mode="demo_fallback",
            ok=True,
            extra={"error": str(exc)[:120]},
        )
        return {
            "brief": payload["brief"],
            "style": style_id,
            "data": data,
            "title": title,
            "caption": caption,
            "hooks": hooks,
            "theme": theme,
            "logic_summary": logic_summary,
            "mode": "demo_fallback",
            "warnings": warnings + w2 + [f"LLM 失败已降级: {exc}"],
            "image_count": len(images),
            "meta": _api_meta("generate", 1, 10, timing),
        }

    brief = raw.get("brief") if isinstance(raw.get("brief"), dict) else {
        "topic": intent[:40],
        "tone": "干货口语",
        "intent": intent,
    }
    if isinstance(brief, dict) and not brief.get("content_type"):
        brief = {**brief, "content_type": infer_content_type(intent, brief.get("content_type"))}
    data_in = raw.get("data") if isinstance(raw.get("data"), dict) else raw
    # 把顶层 outline / theme / logic_summary 挂到 data 上
    if isinstance(data_in, dict):
        extra = {}
        if isinstance(raw.get("outline"), list):
            extra["outline"] = raw.get("outline")
        if raw.get("theme"):
            extra["theme"] = raw.get("theme")
        if isinstance(raw.get("logic_summary"), list):
            extra["logic_summary"] = raw.get("logic_summary")
        if extra:
            data_in = {**data_in, **extra}
    with timer.phase("validate_repair"):
        data, warnings = validate_and_repair(
            data_in,
            {"author": author, "brand": brand, "avatar": author[0]},
        )
        # force user meta
        data["meta"]["author"] = author
        data["meta"]["brand"] = brand
        data["meta"]["avatar"] = author[0]
        # ensure all uploaded images are placed (LLM may miss some)
        data = assign_images_to_pages(data, images)
        data, w2 = validate_and_repair(data, data.get("meta"))
        warnings = warnings + w2

    style_id = match_style(
        {**brief, "style_hint": raw.get("style_hint", "")},
        style or (raw.get("style_hint") if raw.get("style_hint") in {
            "ins", "literary", "orange", "bold-signal", "terminal", "brutalist", "botanical",
        } else None),
    )
    hooks = raw.get("hooks") if isinstance(raw.get("hooks"), list) else []
    title, caption, hooks = fill_publish_fields(
        title=raw.get("title"),
        caption=raw.get("caption"),
        hooks=hooks,
        data=data,
        intent=intent,
    )
    theme, logic_summary = _logic_fields(data, raw)
    timing = timer.log_and_persist(mode="llm", ok=True)

    return {
        "brief": brief,
        "style": style_id,
        "data": data,
        "title": title,
        "caption": caption,
        "hooks": hooks,
        "theme": theme,
        "logic_summary": logic_summary,
        "mode": "llm",
        "warnings": warnings,
        "image_count": len(images),
        "meta": _api_meta("generate", 1, 10, timing),
    }


async def revise(
    data: dict,
    instruction: str,
    *,
    page_index: int | None = None,
    caption: str | None = None,
    title: str | None = None,
    issues: list | None = None,
    supplement_context: str | None = None,
) -> dict[str, Any]:
    data, warnings = validate_and_repair(data)
    issue_list = [x for x in (issues or []) if isinstance(x, dict)]
    instr = (instruction or "").strip()
    if issue_list and (not instr or "审核" in instr or "根据审核" in instr):
        bits = []
        for it in issue_list[:20]:
            sev = it.get("severity") or "warn"
            where = it.get("where") or ""
            msg = it.get("message") or ""
            bits.append(f"[{sev}] {where}: {msg}")
        instr = (
            "根据以下审核意见修改文案与页面内容，修复错误、补全空洞，"
            "保持小红书口语与信息密度；不要 emoji。\n" + "\n".join(bits)
        )

    if not _has_api_key():
        # demo revise: light local tweak
        pages = data.get("pages") or []
        idx = page_index if page_index is not None else 0
        if 0 <= idx < len(pages):
            p = pages[idx]
            tip = instr[:40]
            if p.get("type") == "cover" and tip:
                p["subtitle"] = tip
            elif p.get("type") == "quote" and tip:
                p["text"] = tip
            elif "title" in p and tip:
                # append hint into intro/desc rather than destroy title
                if p.get("type") == "points":
                    p["intro"] = tip
                elif p.get("type") == "chapter":
                    p["desc"] = tip
                else:
                    p["title"] = p.get("title") or tip
            warnings.append("无 API Key：已本地轻量改写（demo）")
        # apply simple caption pad when revising from review issues
        if issue_list and caption and len(caption.strip()) < 40:
            caption = (caption.strip() + "\n\n补充说明：按审核意见完善细节后发布。\n\n#干货 #小红书").strip()
        data, w2 = validate_and_repair(data)
        theme, logic_summary = _logic_fields(data)
        return {
            "data": data,
            "title": title,
            "caption": caption,
            "theme": theme,
            "logic_summary": logic_summary,
            "mode": "demo",
            "warnings": warnings + w2,
            "meta": _api_meta("revise", 0, 1),
        }

    supp = (supplement_context or "").strip()
    user_obj: dict[str, Any] = {
        "instruction": instr,
        "page_index": page_index,
        "data": data,
        "title": title or "",
        "caption": caption or "",
        "issues": issue_list,
    }
    if supp:
        user_obj["supplement_context"] = supp
    try:
        raw = await _chat_json(
            SYSTEM_REVISE,
            json.dumps(user_obj, ensure_ascii=False) + supplement_context_block(supp),
            temperature=0.5,
        )
    except Exception as exc:  # noqa: BLE001
        return {
            "data": data,
            "caption": caption,
            "mode": "demo_fallback",
            "warnings": warnings + [f"改写失败，保持原文: {exc}"],
            "meta": _api_meta("revise", 1, 8),
        }

    new_data = raw.get("data") if isinstance(raw.get("data"), dict) else data
    if isinstance(new_data, dict) and isinstance(raw.get("logic_summary"), list):
        new_data = {**new_data, "logic_summary": raw.get("logic_summary")}
    if isinstance(new_data, dict) and raw.get("theme"):
        new_data = {**new_data, "theme": raw.get("theme")}
    new_data, w2 = validate_and_repair(new_data, data.get("meta"))
    new_caption = raw.get("caption")
    if isinstance(new_caption, str) and new_caption.strip():
        caption = new_caption.strip()
    new_title = raw.get("title")
    if isinstance(new_title, str) and new_title.strip():
        title = new_title.strip()
    theme, logic_summary = _logic_fields(new_data, raw)
    return {
        "data": new_data,
        "title": title,
        "caption": caption,
        "theme": theme,
        "logic_summary": logic_summary,
        "mode": "llm",
        "warnings": warnings + w2,
        "meta": _api_meta("revise", 1, 8),
    }


# 专业字段级编辑器 prompt → prompts/page_editor.py
SYSTEM_PAGE_REVISE = SYSTEM_PAGE_EDITOR

_LAYOUT_CATALOG_HINT = build_catalog_prompt_section(max_recipes=8)

SYSTEM_LAYOUT_IDEAS = """你是小红书图文「排版顾问」。针对指定页给出 3 种真正不同的排版方案。
只输出 JSON：
{
  "ideas": [
    { "id": "a", "name": "方案名", "rationale": "为何适合本页/主线（一句）", "page": {..完整单页..} },
    { "id": "b", "name": "...", "rationale": "...", "page": {..} },
    { "id": "c", "name": "...", "rationale": "...", "page": {..} }
  ]
}
要求：
- 3 个方案 type/结构必须明显不同（如 紧凑清单 points / 步骤时间线 timeline / 大字金句+要点 quote 或 free/card）
- 不是同质微调；文案可改写以适配结构，但服务整篇 theme 与前后页 role
- 中文；无 emoji；保留 image/images
- name 示例：「紧凑清单」「步骤时间线」「大字金句+要点」
- 可参考排版菜谱库中的 visual_notes / points_style（ledger vs cards）
"""
if _LAYOUT_CATALOG_HINT:
    SYSTEM_LAYOUT_IDEAS = SYSTEM_LAYOUT_IDEAS.rstrip() + "\n\n" + _LAYOUT_CATALOG_HINT + "\n"


def _page_neighbors(pages: list, idx: int) -> dict[str, Any]:
    def brief(p: Any) -> dict[str, str]:
        if not isinstance(p, dict):
            return {}
        return {
            "type": str(p.get("type") or ""),
            "title": _one_line(_as_page_title(p.get("title") or p.get("text") or p.get("no"))),
            "role": str(p.get("role") or ""),
        }

    return {
        "prev": brief(pages[idx - 1]) if idx > 0 else None,
        "next": brief(pages[idx + 1]) if idx + 1 < len(pages) else None,
    }


def _clone_page(page: dict) -> dict:
    return json.loads(json.dumps(page, ensure_ascii=False))


def _items_from_page(page: dict) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for it in page.get("items") or []:
        if isinstance(it, dict):
            head = str(it.get("head") or "").strip()
            body = str(it.get("body") or it.get("text") or "").strip()
            if head or body:
                items.append({"head": head or "要点", "body": body or head})
        else:
            s = str(it).strip()
            if s:
                items.append({"head": s[:18], "body": s})
    for st in page.get("steps") or []:
        if isinstance(st, dict):
            head = str(st.get("head") or st.get("time") or "").strip()
            body = str(st.get("body") or "").strip()
            if head or body:
                items.append({"head": head or "步骤", "body": body or head})
    if page.get("type") == "free":
        for b in page.get("bullets") or []:
            s = str(b).strip()
            if s:
                items.append({"head": s[:18], "body": s})
        for para in page.get("paragraphs") or []:
            s = str(para).strip()
            if s and len(items) < 5:
                items.append({"head": s[:16], "body": s})
    if page.get("type") == "card" and page.get("body"):
        tips = page.get("tips") if isinstance(page.get("tips"), list) else []
        if tips:
            for t in tips[:5]:
                s = str(t).strip()
                if s:
                    items.append({"head": s[:18], "body": s})
        else:
            body = str(page.get("body") or "").strip()
            parts = [x.strip() for x in re.split(r"[。！？\n]+", body) if x.strip()]
            for i, p in enumerate(parts[:4], 1):
                items.append({"head": f"第{i}点", "body": p})
    if page.get("type") == "quote" and page.get("text"):
        items.append({"head": "金句", "body": str(page.get("text")).strip()})
    return items[:6] or [{"head": "要点一", "body": "补充具体内容"}]


def _fallback_compact_points(page: dict) -> dict:
    """Rule: tighten points copy / structure into compact list."""
    out = _clone_page(page)
    items = _items_from_page(out)
    nums = ("①", "②", "③", "④", "⑤", "⑥")
    compact = []
    for i, it in enumerate(items[:5]):
        head = it["head"]
        # ensure ordinal sits with title on one line
        if not any(head.startswith(n) for n in nums) and not re.match(r"^[0-9一二三四五六]", head):
            head = f"{nums[i]} {head}"
        body = _one_line(it["body"])
        if len(body) > 70:
            body = body[:68] + "…"
        compact.append({"head": head, "body": body})
    out["type"] = "points"
    out["title"] = out.get("title") or "核心要点"
    out["items"] = compact
    out.pop("steps", None)
    out.pop("paragraphs", None)
    out.pop("bullets", None)
    out.pop("text", None)
    out.pop("body", None)
    out.pop("tips", None)
    out.pop("blocks", None)
    return out


def _fallback_to_timeline(page: dict) -> dict:
    items = _items_from_page(page)
    steps = []
    for i, it in enumerate(items[:5], 1):
        steps.append({
            "time": f"0{i}" if i < 10 else str(i),
            "head": re.sub(r"^[①②③④⑤⑥⑦⑧⑨]\s*", "", it["head"]),
            "body": it["body"],
        })
    out = {
        "type": "timeline",
        "title": page.get("title") or "行动步骤",
        "role": page.get("role") or "方法",
        "steps": steps,
    }
    for k in ("progress", "bridge", "image", "images", "intro"):
        if page.get(k) is not None:
            out[k] = page.get(k)
    return out


def _fallback_to_free_quote(page: dict) -> dict:
    items = _items_from_page(page)
    hook = items[0]["body"] if items else str(page.get("title") or "记住这一句")
    bullets = [f"{it['head']}：{it['body']}" if it["head"] not in it["body"] else it["body"] for it in items[:4]]
    out = {
        "type": "free",
        "title": page.get("title") or "先记住这句",
        "role": page.get("role") or "金句",
        "kicker": "大字要点",
        "paragraphs": [_one_line(hook)[:80]],
        "bullets": bullets,
    }
    for k in ("progress", "bridge", "image", "images"):
        if page.get(k) is not None:
            out[k] = page.get(k)
    return out


def _fallback_to_card(page: dict) -> dict:
    items = _items_from_page(page)
    body_bits = [it["body"] for it in items[:3]]
    out = {
        "type": "card",
        "title": page.get("title") or "重点说明",
        "role": page.get("role") or "方法",
        "label": "FOCUS",
        "body": "。".join(body_bits) if body_bits else "补充这一页的核心说明。",
        "tips": [it["head"] + "：" + it["body"] for it in items[:4]],
    }
    for k in ("progress", "bridge", "image", "images"):
        if page.get(k) is not None:
            out[k] = page.get(k)
    return out


def _apply_page_to_data(data: dict, page_index: int, new_page: dict) -> dict:
    pages = list(data.get("pages") or [])
    if not (0 <= page_index < len(pages)):
        raise ValueError(f"page_index 越界: {page_index}")
    pages[page_index] = new_page
    out = {**data, "pages": pages}
    return out


_DENSITY_SCALE = {"compact": 0.88, "normal": 1.0, "airy": 1.12}
# 二次「字体变小/变大」时按阶梯推进，避免卡在同一档看起来「没改」
_COMPACT_STEPS = (0.88, 0.80, 0.74, 0.70)
_AIRY_STEPS = (1.12, 1.20, 1.28, 1.35)

_CN_NUM = {
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}

_DELETE_VERBS = ("删掉", "删除", "去掉", "移除", "清掉")
_DELETE_HERE = ("删掉这里", "删除这里", "去掉这里", "删这里", "去掉这句", "删掉这句", "删除这句")


def _parse_cn_index(token: str) -> int | None:
    s = (token or "").strip()
    if not s:
        return None
    if s.isdigit():
        return int(s)
    if s in _CN_NUM:
        return _CN_NUM[s]
    if len(s) == 2 and s[0] == "十" and s[1] in _CN_NUM:
        return 10 + _CN_NUM[s[1]]
    if len(s) == 2 and s[1] == "十" and s[0] in _CN_NUM:
        return _CN_NUM[s[0]] * 10
    return None


def _strip_quotes(s: str) -> str:
    t = (s or "").strip()
    for a, b in (('"', '"'), ("'", "'"), ("「", "」"), ("『", "』"), ("“", "”"), ("‘", "’")):
        if t.startswith(a) and t.endswith(b) and len(t) >= 2:
            return t[len(a) : -len(b)].strip()
    return t


def _page_primary_text(page: dict) -> str:
    if not isinstance(page, dict):
        return ""
    t = page.get("type")
    if t == "quote":
        return str(page.get("text") or "").strip()
    if t == "card":
        return str(page.get("body") or "").strip()
    if t == "cover":
        return str(page.get("subtitle") or page.get("title") or "").strip()
    if t == "free":
        paras = page.get("paragraphs") or []
        if paras:
            return str(paras[0]).strip()
    return str(page.get("title") or page.get("text") or page.get("body") or "").strip()


def _extract_delete_target(
    tip: str, pasted: str | None = None, page: dict | None = None
) -> str:
    """Resolve delete target from pasted snippet, instruction text, or page fields."""
    target = (pasted or "").strip()
    if target:
        return target
    tip = (tip or "").strip()
    if not tip:
        return ""

    m = re.search(r"(?:删掉|删除|去掉|移除|清掉)\s*[「『\"“'](.+?)[」』\"”']", tip)
    if m:
        return m.group(1).strip()

    m2 = re.match(r"^(?:删掉|删除|去掉|移除|清掉)\s*(.+)$", tip)
    if m2:
        rest = _strip_quotes(m2.group(1).strip())
        if rest and rest not in ("这里", "这句", "这句话", "这个", "它", "第"):
            if not re.match(r"^第\s*[0-9一二两三四五六七八九十]+", rest):
                return rest

    # 「接上页「…」 删除」等尾部动词
    m3 = re.match(r"^(.+?)\s*(?:删掉|删除|去掉|移除|清掉)\s*$", tip)
    if m3:
        rest = _strip_quotes(m3.group(1).strip())
        if rest and rest not in ("这里", "这句", "这句话", "这个", "它"):
            return rest

    if any(h in tip for h in _DELETE_HERE) and page:
        return _page_primary_text(page) or ""

    if page and isinstance(page, dict):
        bridge = str(page.get("bridge") or "").strip()
        if bridge and any(v in tip for v in _DELETE_VERBS):
            if any(h in tip for h in ("接上页", "过渡", "bridge", "衔接", "承接")):
                return bridge
            inner = re.sub(r"^接上页[「『]?", "", bridge)
            inner = re.sub(r"[」』]$", "", inner).strip()
            compact_tip = re.sub(r"[\s，。！？、,.!?;；:：\"'「」『』]", "", tip)
            compact_inner = re.sub(r"[\s，。！？、,.!?;；:：\"'「」『』]", "", inner)
            if compact_inner and len(compact_inner) >= 4 and compact_inner in compact_tip:
                return bridge

    return ""


def _clean_bridge_after_delete(page: dict) -> dict:
    bridge = str(page.get("bridge") or "").strip()
    if not bridge:
        page.pop("bridge", None)
        return page
    if re.fullmatch(r"接上页[「『]?\s*[」』]?", bridge):
        page.pop("bridge", None)
    return page


def _parse_revise_input(raw: str, page: dict | None = None) -> tuple[str, str | None]:
    """
    Split pasted「原文 + 指令」→ (clean_instruction, pasted_snippet|None).
    """
    text = (raw or "").strip()
    if not text:
        return "", None
    lines = [ln.strip() for ln in re.split(r"[\r\n]+", text) if ln.strip()]
    pasted: str | None = None
    instr = text

    if len(lines) >= 2:
        cmd_idx = [
            i
            for i, ln in enumerate(lines)
            if any(k in ln for k in _DELETE_VERBS + ("清空", "改成", "改写", "重写", "只留", "字体", "字号"))
            or ln in _DELETE_HERE
        ]
        content_idx = [i for i in range(len(lines)) if i not in cmd_idx]
        if cmd_idx and content_idx:
            pasted = lines[content_idx[0]]
            instr = "\n".join(lines[i] for i in cmd_idx).strip() or text

    if any(v in instr for v in _DELETE_VERBS) or any(h in instr for h in _DELETE_HERE):
        target = _extract_delete_target(instr, pasted, page)
        if target:
            pasted = target

    return instr.strip(), pasted


def _infer_density_from_instruction(tip: str) -> tuple[str | None, str]:
    """Parse visual density intent → (density, summary)."""
    t = (tip or "").strip()
    if not t:
        return None, ""
    # 删/改文案指令里的「小一点」不应当成字号
    if any(k in t for k in _DELETE_VERBS + ("只留", "第", "清空", "重写列表")):
        if "字体" not in t and "字号" not in t and "紧凑" not in t and "疏朗" not in t:
            # 仍允许「字体变小」类；纯删句不进 density
            if not any(k in t for k in ("字体", "字号", "字变", "字小", "字大", "紧凑", "疏朗", "留白")):
                return None, ""

    quote_dazi = ("大字" in t) and ("字体" not in t) and ("字号" not in t) and ("字大" not in t)

    smaller = any(
        k in t
        for k in (
            "字体变小",
            "字号变小",
            "字变小",
            "字小",
            "缩小字",
            "字号小",
            "字体小",
        )
    )
    # 「变小一点/小一点」仅在字号语境
    if any(k in t for k in ("字体", "字号", "字变", "字小")) and any(
        k in t for k in ("变小", "小一点", "缩小")
    ):
        smaller = True
    larger = any(
        k in t
        for k in (
            "字体变大",
            "字号变大",
            "字变大",
            "字大一点",
            "放大字",
            "字号大",
            "字体大",
        )
    )
    if any(k in t for k in ("字体", "字号", "字变", "字大")) and any(
        k in t for k in ("变大", "大一点", "放大")
    ):
        larger = True
    if quote_dazi:
        larger = False
    tighter = any(k in t for k in ("更紧凑", "紧凑一点", "排紧", "密一点", "间距小", "紧凑"))
    airier = any(k in t for k in ("疏朗", "松一点", "留白多", "宽松", "间距大", "松散"))

    if "字号" in t or "字体" in t:
        if "小" in t:
            smaller = True
        elif "大" in t and not quote_dazi:
            larger = True

    if smaller:
        return "compact", "已调整版式：字号调小"
    if larger:
        return "airy", "已调整版式：字号调大"
    if tighter and not airier:
        return "compact", "已调整版式：更紧凑"
    if airier:
        return "airy", "已调整版式：更疏朗"
    return None, ""


def _has_layout_intent(tip: str) -> bool:
    t = tip or ""
    # 纯删句/列表操作里的「金句」正文不应触发换版式
    if any(v in t for v in _DELETE_VERBS) and not any(
        k in t for k in ("改成", "换成", "变成", "换版式", "换结构", "改排版")
    ):
        return False
    keys = (
        "改成时间线",
        "时间线",
        "改成步骤",
        "步骤页",
        "改成对比",
        "换版式",
        "版式",
        "改成要点",
        "改成清单",
        "换模板",
        "改成卡片",
        "改成金句",
        "改成 free",
        "timeline",
        "compare",
        "改排版",
        "换结构",
        "变成时间",
        "quote",
        "进度",
    )
    if any(k in t for k in keys):
        return True
    if re.search(r"改成\s*(对比|清单|要点|卡片|金句|时间线|步骤)", t):
        return True
    if ("大字" in t) and ("字体" not in t) and ("字号" not in t) and ("字大" not in t):
        return True
    if ("步骤" in t) and ("字" not in t) and ("第" not in t):
        return True
    # 单独「对比/清单/金句/卡片」作换版式意图时需伴随改成/换成
    if any(k in t for k in ("对比", "清单", "金句", "卡片")) and any(
        k in t for k in ("改成", "换成", "变成", "用", "改成")
    ):
        return True
    return False


def _has_list_intent(tip: str) -> bool:
    t = tip or ""
    if re.search(r"第\s*[0-9一二两三四五六七八九十]+\s*(条|点|项|步)", t):
        return True
    keys = (
        "只留",
        "只保留",
        "增加一条",
        "加一条",
        "添一条",
        "重写列表",
        "重排",
        "排序",
        "第一条",
        "第二条",
        "第三条",
        "最后一条",
        "清空列表",
        "删掉第",
        "删除第",
        "去掉第",
    )
    return any(k in t for k in keys)


def _has_copy_intent(tip: str) -> bool:
    t = tip or ""
    if _has_list_intent(t):
        return True
    if any(v in t for v in _DELETE_VERBS) or any(h in t for h in _DELETE_HERE):
        return True
    # 「改成时间线/金句…」是版式，不算文案
    if _has_layout_intent(t) and not any(
        k in t for k in ("文案", "标题", "第", "删", "写具体", "润色", "改写", "重写列表")
    ):
        return False
    keys = (
        "改写",
        "更具体",
        "具体一点",
        "具体些",
        "语气",
        "口语",
        "精简",
        "加上",
        "标题",
        "文案",
        "说法",
        "润色",
        "重写",
        "补充",
        "改一下文字",
        "换个说法",
        "清空",
        "把标题",
        "把第",
        "写成",
    )
    return any(k in t for k in keys)


def _has_gui_intent(tip: str) -> bool:
    dens, _ = _infer_density_from_instruction(tip)
    return dens is not None or _has_layout_intent(tip)


def _route_revise_mode(instruction: str, mode: str) -> tuple[str, str | None, str]:
    """
    Resolve auto/explicit mode.
    Returns (exec_mode, density|None, summary).
    exec_mode: density | copy | layout | both
    """
    tip = (instruction or "").strip()
    m = (mode or "auto").strip().lower()
    dens, dens_summary = _infer_density_from_instruction(tip)
    has_layout = _has_layout_intent(tip)
    has_list = _has_list_intent(tip)
    has_copy = _has_copy_intent(tip)
    has_visual = dens is not None
    # 删/改/重写类绝不进纯 density
    force_content = has_list or any(v in tip for v in _DELETE_VERBS) or any(
        h in tip for h in _DELETE_HERE
    ) or any(k in tip for k in ("重写", "清空", "改标题", "把标题"))

    if m in ("copy", "layout", "both"):
        if m == "copy" or has_list or force_content:
            summary = dens_summary or (
                "已更新列表" if has_list else "已改写本页文案"
            )
        elif m == "layout":
            summary = dens_summary or "已调整版式"
        else:
            summary = dens_summary or "已优化本页文案与排版"
        return m, dens, summary

    # auto
    if has_visual and not has_layout and not has_copy and not force_content:
        return "density", dens, dens_summary
    if (has_layout or has_visual) and (has_copy or force_content):
        return "both", dens, dens_summary or (
            "已更新列表与版式" if has_list else "已同时调整文案与版式"
        )
    if has_layout and has_visual:
        return "layout", dens, dens_summary or "已调整版式与字号疏密"
    if has_layout:
        return "layout", dens, dens_summary or "已调整版式"
    if has_list or force_content or has_copy:
        return "copy", dens if has_visual else None, (
            dens_summary
            or ("已更新列表" if has_list else "已改写本页文案")
        )
    if has_visual:
        return "density", dens, dens_summary
    return "both", dens, "已优化本页"


def _current_font_scale(page: dict) -> float:
    if not isinstance(page, dict):
        return 1.0
    for src in (page, page.get("style") if isinstance(page.get("style"), dict) else {}):
        try:
            n = float(src.get("fontScale"))  # type: ignore[union-attr]
            if 0.65 <= n <= 1.4:
                return round(n, 3)
        except (TypeError, ValueError, AttributeError):
            pass
    d = str(page.get("density") or "").lower()
    return float(_DENSITY_SCALE.get(d, 1.0))


def _apply_page_density(page: dict, density: str) -> dict:
    """Apply density; repeating compact/airy nudges fontScale further."""
    d = density if density in _DENSITY_SCALE else "normal"
    out = _clone_page(page) if isinstance(page, dict) else {"type": "card", "title": "内容", "body": ""}
    cur = _current_font_scale(out)
    if d == "compact":
        scale = _DENSITY_SCALE["compact"]
        if cur <= scale + 0.01:
            nxt = next((s for s in _COMPACT_STEPS if s < cur - 0.005), _COMPACT_STEPS[-1])
            scale = nxt
        summary_scale = scale
    elif d == "airy":
        scale = _DENSITY_SCALE["airy"]
        if cur >= scale - 0.01:
            nxt = next((s for s in _AIRY_STEPS if s > cur + 0.005), _AIRY_STEPS[-1])
            scale = nxt
        summary_scale = scale
    else:
        scale = _DENSITY_SCALE["normal"]
        summary_scale = scale
    out["density"] = d
    out["fontScale"] = round(float(summary_scale), 3)
    style = out.get("style") if isinstance(out.get("style"), dict) else {}
    out["style"] = {**style, "density": d, "fontScale": out["fontScale"]}
    return out


def _merge_density(page: dict, density: str | None) -> dict:
    if not density:
        return page if isinstance(page, dict) else {}
    return _apply_page_density(page if isinstance(page, dict) else {}, density)


def _mark_user_edited(page: dict) -> dict:
    out = page if isinstance(page, dict) else {"type": "card", "title": "内容", "body": ""}
    out = _clone_page(out)
    out["_user_edited"] = True
    return out


def _applied_payload(
    exec_mode: str,
    density: str | None,
    summary: str,
    ops: list[dict[str, Any]] | None = None,
    *,
    source: str = "llm",
) -> dict[str, Any]:
    src = source if source in ("llm", "rules_fallback") else "llm"
    out: dict[str, Any] = {
        "mode": exec_mode,
        "source": src,
        "summary": summary or "已更新本页",
        "ops": list(ops or []),
    }
    if density:
        out["density"] = density
    return out


_REWRITE_FIELDS = (
    "title",
    "subtitle",
    "text",
    "body",
    "intro",
    "desc",
    "caption",
    "from",
    "bridge",
    "role",
    "progress",
)

_PAGE_TYPES = {
    "cover",
    "chapter",
    "points",
    "timeline",
    "card",
    "quote",
    "compare",
    "summary",
    "ending",
    "composite",
    "photo",
    "gallery",
    "free",
}


def _humanize_op(op: dict[str, Any]) -> str:
    if op.get("label"):
        return str(op.get("label")).strip()
    name = str(op.get("op") or "").strip()
    if name == "setDensity":
        d = str(op.get("density") or "").lower()
        return {"compact": "变紧凑", "airy": "更疏朗", "normal": "疏密复位"}.get(d, "调疏密")
    if name == "setFontScale":
        try:
            fs = float(op.get("fontScale"))
            return f"字号 {fs:.2f}"
        except (TypeError, ValueError):
            return "调字号"
    if name == "deleteItem":
        idx = op.get("index")
        return f"删第{idx}条" if idx else "删条目"
    if name == "updateItem":
        idx = op.get("index")
        return f"改第{idx}条" if idx else "改条目"
    if name == "rewriteField":
        field = str(op.get("field") or "")
        labels = {
            "title": "改标题",
            "subtitle": "改副标题",
            "text": "改金句",
            "body": "改正文",
            "intro": "改导语",
            "desc": "改描述",
            "caption": "改配文",
        }
        return labels.get(field, f"改{field}" if field else "改字段")
    if name == "setPageType":
        t = str(op.get("type") or "")
        labels = {
            "timeline": "改成时间线",
            "points": "改成清单",
            "quote": "改成金句",
            "card": "改成卡片",
            "free": "改成展开",
            "compare": "改成对比",
            "summary": "改成总结",
        }
        return labels.get(t, f"换结构·{t}" if t else "换结构")
    return name or "改本页"


def _summary_from_ops(ops: list[dict[str, Any]], fallback: str = "") -> str:
    parts = [_humanize_op(o) for o in ops if isinstance(o, dict)]
    parts = [p for p in parts if p]
    if not parts:
        return (fallback or "已更新本页").removeprefix("已").strip() or "已更新本页"
    # UI 会加「已：」前缀；这里给裸短语
    return " · ".join(parts)


def _normalize_op(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    name = str(raw.get("op") or "").strip()
    if name not in {
        "setDensity",
        "setFontScale",
        "rewriteField",
        "deleteItem",
        "updateItem",
        "setPageType",
    }:
        return None
    out: dict[str, Any] = {"op": name}
    if name == "setDensity":
        d = str(raw.get("density") or "").lower()
        if d not in ("compact", "normal", "airy"):
            return None
        out["density"] = d
    elif name == "setFontScale":
        try:
            fs = float(raw.get("fontScale"))
        except (TypeError, ValueError):
            return None
        out["fontScale"] = round(max(0.65, min(1.4, fs)), 3)
    elif name == "rewriteField":
        field = str(raw.get("field") or "").strip()
        if field not in _REWRITE_FIELDS:
            return None
        out["field"] = field
        out["value"] = "" if raw.get("value") is None else str(raw.get("value"))
    elif name == "deleteItem":
        try:
            idx = int(raw.get("index"))
        except (TypeError, ValueError):
            return None
        if idx < 1:
            return None
        out["index"] = idx
        lst = str(raw.get("list") or "").strip()
        if lst:
            out["list"] = lst
    elif name == "updateItem":
        try:
            idx = int(raw.get("index"))
        except (TypeError, ValueError):
            return None
        if idx < 1:
            return None
        out["index"] = idx
        lst = str(raw.get("list") or "").strip()
        if lst:
            out["list"] = lst
        for k in ("head", "body", "value", "text", "time", "label"):
            if k in raw and raw[k] is not None:
                out[k] = str(raw[k])
        try:
            vi = int(raw.get("valueIndex"))
            if vi >= 1:
                out["valueIndex"] = vi
        except (TypeError, ValueError):
            pass
    elif name == "setPageType":
        t = str(raw.get("type") or "").strip()
        if t not in _PAGE_TYPES:
            return None
        out["type"] = t
    return out


def _apply_page_ops(
    page: dict, ops: list[dict[str, Any]]
) -> tuple[dict, list[dict[str, Any]], str]:
    from ops import apply_page_ops

    return apply_page_ops(page, ops)


def _ops_from_list_edit(page: dict, instruction: str) -> list[dict[str, Any]]:
    """Mirror _apply_list_edit as structured ops (no page mutate)."""
    tip = (instruction or "").strip()
    if not tip or not isinstance(page, dict):
        return []
    key = _list_key_for_page(page)
    if not key:
        return []
    items = list(page.get(key) or [])
    if not isinstance(items, list):
        return []

    m_keep = re.search(r"只(?:留|保留)\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步|行)?", tip)
    if m_keep:
        n = _parse_cn_index(m_keep.group(1))
        if n and n > 0 and len(items) > n:
            # delete from the end
            return [
                {"op": "deleteItem", "list": key, "index": i}
                for i in range(len(items), n, -1)
            ]

    if "清空" in tip and ("列表" in tip or "全部" in tip or "所有" in tip):
        return [
            {"op": "deleteItem", "list": key, "index": i}
            for i in range(len(items), 0, -1)
        ]

    m_del = re.search(
        r"(?:删掉|删除|去掉|移除)\s*第\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步|行)",
        tip,
    )
    if not m_del:
        m_del = re.search(
            r"第\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步|行).{0,6}(?:删掉|删除|去掉)",
            tip,
        )
    if m_del:
        idx = _parse_cn_index(m_del.group(1))
        if idx and 1 <= idx <= len(items):
            return [{"op": "deleteItem", "list": key, "index": idx}]

    m_chg = re.search(
        r"(?:把)?第\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步|行)\s*(?:改成|写成|改为)\s*(.+)$",
        tip,
    )
    if m_chg:
        idx = _parse_cn_index(m_chg.group(1))
        new_text = _strip_quotes(m_chg.group(2)).strip()
        if idx and new_text and 1 <= idx <= len(items):
            return [{"op": "updateItem", "list": key, "index": idx, "body": new_text}]
    return []


def _ops_from_title_edit(instruction: str) -> list[dict[str, Any]]:
    tip = (instruction or "").strip()
    m = re.search(r"(?:把)?标题\s*(?:改成|写成|改为|为|：|:)\s*(.+)$", tip)
    if not m:
        m = re.search(r"改标题\s*(?:为|成|：|:)\s*(.+)$", tip)
    if not m:
        return []
    title = _strip_quotes(m.group(1)).strip()
    if not title:
        return []
    return [{"op": "rewriteField", "field": "title", "value": title}]


def _ops_from_type_intent(instruction: str) -> list[dict[str, Any]]:
    tip = (instruction or "").strip()
    low = tip.lower()
    if not tip:
        return []
    if any(k in tip for k in ("改成时间线", "换成时间线", "变成时间线")) or (
        ("时间线" in tip or "步骤" in tip) and any(k in tip for k in ("改成", "换成", "变成"))
    ):
        return [{"op": "setPageType", "type": "timeline"}]
    if any(k in tip for k in ("改成清单", "改成要点", "换成清单")):
        return [{"op": "setPageType", "type": "points"}]
    if ("改成金句" in tip or "换成金句" in tip) or (
        ("大字" in tip or "quote" in low) and any(k in tip for k in ("改成", "换成"))
    ):
        return [{"op": "setPageType", "type": "quote"}]
    if "改成卡片" in tip or "换成卡片" in tip:
        return [{"op": "setPageType", "type": "card"}]
    return []


def _collect_rule_ops(
    page: dict, instruction: str, pasted: str | None = None
) -> list[dict[str, Any]]:
    """Deterministic ops from natural language (0 LLM)."""
    tip = (instruction or "").strip()
    ops: list[dict[str, Any]] = []
    dens, _ = _infer_density_from_instruction(tip)
    if dens:
        ops.append({"op": "setDensity", "density": dens})

    ops.extend(_ops_from_list_edit(page, tip))
    ops.extend(_ops_from_title_edit(tip))
    ops.extend(_ops_from_type_intent(tip))

    # 删句（粘贴/引用）——用 delete 语义落到 rewriteField 清空或既有删除逻辑
    # 仍走 _apply_delete_sentence 更稳；这里标记为可规则完成
    return ops


def _instruction_needs_llm(tip: str) -> bool:
    """复杂改写/叙事类指令：规则不得冒充成功，应交 LLM 或报错重试。"""
    t = (tip or "").strip()
    if not t:
        return True
    keys = (
        "润色",
        "换风格",
        "更狠",
        "智能优化",
        "改写",
        "重写",
        "叙事",
        "口语",
        "更具体",
        "补充",
        "扩写",
        "升华",
        "降调",
        "语气",
        "气质",
        "品牌感",
        "整体优化",
        "全文",
        "换个说法",
        "写具体",
    )
    return any(k in t for k in keys)


def _rule_ops_resolvable(
    page: dict,
    instruction: str,
    pasted: str | None,
    ops: list[dict[str, Any]],
    exec_mode: str,
) -> tuple[bool, dict | None, list[dict[str, Any]], str]:
    """
    明确、可瞬时完成的安全操作 → 规则出 ops 并应用。
    复杂润色/叙事类一律不可走此路径。
    """
    tip = (instruction or "").strip()
    if _instruction_needs_llm(tip):
        # 仍允许「删第N条 / 更紧凑」等与复杂词并存时的明确结构 ops
        structural = [
            o
            for o in ops
            if o.get("op") in ("deleteItem", "updateItem", "setDensity", "setFontScale", "setPageType")
        ]
        title_ops = [o for o in ops if o.get("op") == "rewriteField" and o.get("field") == "title"]
        if not structural and not title_ops and not pasted:
            return False, None, [], ""

    content_ops = [
        o
        for o in ops
        if o.get("op") in ("deleteItem", "updateItem", "rewriteField", "setPageType")
    ]
    dens_ops = [o for o in ops if o.get("op") in ("setDensity", "setFontScale")]

    if content_ops:
        new_page, applied, summary = _apply_page_ops(page, ops)
        return True, new_page, applied, summary

    deleted, del_summary = _apply_delete_sentence(page, tip, pasted)
    if deleted is not None:
        short = ""
        if "已删除：" in del_summary:
            short = del_summary.split("：", 1)[-1]
        del_op: dict[str, Any] = {
            "op": "rewriteField",
            "field": "text" if page.get("type") == "quote" else "body",
            "value": "",
            "label": f"删「{short}」" if short else "删内容",
        }
        if dens_ops:
            new_page, applied, _ = _apply_page_ops(deleted, dens_ops)
            applied_ops = [del_op] + applied
        else:
            new_page = _mark_user_edited(deleted)
            applied_ops = [del_op]
        return True, new_page, applied_ops, _summary_from_ops(applied_ops)

    # 纯疏密：明确指令才允许规则（不限 exec_mode，便于兜底）
    if dens_ops and (
        exec_mode == "density"
        or _infer_density_from_instruction(tip)[0]
    ) and not _instruction_needs_llm(tip):
        new_page, applied, summary = _apply_page_ops(page, dens_ops)
        return True, new_page, applied, summary

    return False, None, [], ""


def _remove_substring_from_value(val: Any, target: str) -> tuple[Any, bool]:
    """Remove target from nested strings/lists/dicts. Returns (new_val, changed)."""
    if not target:
        return val, False
    changed = False
    if isinstance(val, str):
        if target in val:
            return val.replace(target, "").strip(), True
        # 宽松：去标点后包含
        compact_t = re.sub(r"[\s，。！？、,.!?;；:：\"'「」『』]", "", target)
        compact_v = re.sub(r"[\s，。！？、,.!?;；:：\"'「」『』]", "", val)
        if compact_t and compact_t in compact_v and len(compact_t) >= 4:
            # 逐字对齐困难时直接整段替换为去掉目标句
            return "", True
        return val, False
    if isinstance(val, list):
        new_list = []
        for item in val:
            ni, ch = _remove_substring_from_value(item, target)
            changed = changed or ch
            if isinstance(ni, str) and not ni.strip():
                continue
            if isinstance(ni, dict):
                head = str(ni.get("head") or "").strip()
                body = str(ni.get("body") or ni.get("text") or "").strip()
                if not head and not body and not any(
                    str(ni.get(k) or "").strip() for k in ("time", "label", "desc")
                ):
                    continue
            new_list.append(ni)
        return new_list, changed
    if isinstance(val, dict):
        out = {}
        for k, v in val.items():
            if k in ("type", "image", "images", "density", "fontScale", "style", "_user_edited"):
                out[k] = v
                continue
            nv, ch = _remove_substring_from_value(v, target)
            changed = changed or ch
            out[k] = nv
        return out, changed
    return val, False


def _apply_delete_sentence(page: dict, instruction: str, pasted: str | None = None) -> tuple[dict | None, str]:
    """Rule: remove quoted/pasted/primary sentence from page string fields."""
    tip = (instruction or "").strip()
    if not tip and not pasted:
        return None, ""
    wants_delete = any(v in tip for v in _DELETE_VERBS) or any(h in tip for h in _DELETE_HERE)
    if not wants_delete:
        return None, ""

    target = _extract_delete_target(tip, pasted, page)
    if not target:
        return None, ""

    out, changed = _remove_substring_from_value(_clone_page(page), target)
    if not changed:
        # 整页主文案等于目标 → 清空
        primary = _page_primary_text(page)
        if primary and (target in primary or primary in target or primary == target):
            out = _clone_page(page)
            t = out.get("type")
            if t == "quote":
                out["text"] = ""
            elif t == "card":
                out["body"] = ""
            elif t == "cover":
                out["subtitle"] = ""
            elif t == "free":
                out["paragraphs"] = []
            else:
                out, changed = _remove_substring_from_value(out, primary)
            changed = True
            target = primary
    if not changed:
        return None, ""

    out = out if isinstance(out, dict) else _clone_page(page)
    out = _clean_bridge_after_delete(out)
    # quote 删光：保留空 quote（_user_edited 阻止 repair 回填）；勿改成中间 ending（页流会降级并注水）
    if out.get("type") == "quote" and not str(out.get("text") or "").strip():
        out["text"] = ""
        out.pop("from", None)
    out["_user_edited"] = True
    short = target if len(target) <= 24 else target[:22] + "…"
    return out, f"已删除：{short}"


def _list_key_for_page(page: dict) -> str | None:
    t = (page or {}).get("type")
    if t in ("points", "summary"):
        return "items"
    if t == "timeline":
        return "steps"
    if t == "compare":
        return "rows"
    if t == "free":
        if page.get("bullets"):
            return "bullets"
        if page.get("paragraphs"):
            return "paragraphs"
        return None
    if t == "card" and isinstance(page.get("tips"), list):
        return "tips"
    if t == "ending":
        return "cta"
    return None


def _apply_list_edit(page: dict, instruction: str) -> tuple[dict | None, str]:
    """Rule edits for points/timeline/summary lists: delete Nth / keep N / clear."""
    tip = (instruction or "").strip()
    if not tip or not isinstance(page, dict):
        return None, ""
    key = _list_key_for_page(page)
    if not key:
        return None, ""
    items = list(page.get(key) or [])
    if not isinstance(items, list):
        return None, ""

    out = _clone_page(page)

    # 只留 N 条
    m_keep = re.search(r"只(?:留|保留)\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步)?", tip)
    if m_keep:
        n = _parse_cn_index(m_keep.group(1))
        if n and n > 0:
            out[key] = items[:n]
            out["_user_edited"] = True
            return out, f"已更新列表：只留 {n} 条"

    # 清空列表
    if "清空" in tip and ("列表" in tip or "全部" in tip or "所有" in tip):
        out[key] = []
        out["_user_edited"] = True
        return out, "已更新列表：已清空"

    # 删掉第 N 条/步/行
    m_del = re.search(
        r"(?:删掉|删除|去掉|移除)\s*第\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步|行)",
        tip,
    )
    if not m_del:
        m_del = re.search(
            r"第\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步|行).{0,6}(?:删掉|删除|去掉)",
            tip,
        )
    if m_del:
        idx = _parse_cn_index(m_del.group(1))
        if idx and 1 <= idx <= len(items):
            removed = items[idx - 1]
            new_items = items[: idx - 1] + items[idx:]
            out[key] = new_items
            out["_user_edited"] = True
            label = ""
            if isinstance(removed, dict):
                label = str(removed.get("head") or removed.get("body") or removed.get("text") or "")
            else:
                label = str(removed)
            label = label.strip()
            short = label if len(label) <= 20 else label[:18] + "…"
            return out, f"已更新列表：已删除第 {idx} 条" + (f"（{short}）" if short else "")

    # 把第 N 条改成 xxx
    m_chg = re.search(
        r"(?:把)?第\s*([0-9一二两三四五六七八九十]+)\s*(?:条|点|项|步)\s*(?:改成|写成|改为)\s*(.+)$",
        tip,
    )
    if m_chg:
        idx = _parse_cn_index(m_chg.group(1))
        new_text = _strip_quotes(m_chg.group(2)).strip()
        if idx and new_text and 1 <= idx <= len(items):
            cur = items[idx - 1]
            if isinstance(cur, dict):
                items[idx - 1] = {**cur, "body": new_text, "head": cur.get("head") or f"要点{idx}"}
            else:
                items[idx - 1] = new_text
            out[key] = items
            out["_user_edited"] = True
            return out, f"已更新列表：已改第 {idx} 条"

    return None, ""


def _apply_title_edit(page: dict, instruction: str) -> tuple[dict | None, str]:
    tip = (instruction or "").strip()
    m = re.search(r"(?:把)?标题\s*(?:改成|写成|改为|为|：|:)\s*(.+)$", tip)
    if not m:
        m = re.search(r"改标题\s*(?:为|成|：|:)\s*(.+)$", tip)
    if not m:
        return None, ""
    title = _strip_quotes(m.group(1)).strip()
    if not title:
        return None, ""
    out = _clone_page(page)
    if out.get("type") == "quote":
        out["text"] = title
    else:
        out["title"] = title
    out["_user_edited"] = True
    return out, f"已改标题：{title[:24]}"


def _try_rule_page_revise(
    page: dict, instruction: str, pasted: str | None = None
) -> tuple[dict | None, str]:
    """Deterministic edits before/instead of LLM. Returns (page|None, summary)."""
    edited, summary = _apply_list_edit(page, instruction)
    if edited is not None:
        return edited, summary
    edited, summary = _apply_title_edit(page, instruction)
    if edited is not None:
        return edited, summary
    edited, summary = _apply_delete_sentence(page, instruction, pasted)
    if edited is not None:
        return edited, summary
    return None, ""


def _fallback_page_revise(
    page: dict, mode: str, instruction: str, pasted: str | None = None
) -> dict:
    tip = (instruction or "").strip()
    m = (mode or "both").lower()
    dens, _ = _infer_density_from_instruction(tip)

    ruled, _ = _try_rule_page_revise(page, tip, pasted)
    if ruled is not None:
        return _merge_density(ruled, dens)

    if m == "density":
        return _mark_user_edited(_apply_page_density(page, dens or "compact"))

    if m == "copy":
        out = _clone_page(page)
        if tip and dens and not _has_copy_intent(tip):
            return _mark_user_edited(_merge_density(out, dens))
        # 不再把整段 instruction 写进 quote.text（会把「删掉…」留下来）
        if tip and _has_copy_intent(tip) and not any(v in tip for v in _DELETE_VERBS):
            t = page.get("type")
            if t == "points":
                m_chg = re.search(r"第\s*[一二三四五六七八九十0-9]+\s*点.{0,4}(更具体|具体)", tip)
                if not m_chg:
                    out["intro"] = (out.get("intro") or "")  # keep
            elif t == "cover":
                if "标题" in tip:
                    pass
            elif t == "card" and ("改写" in tip or "重写" in tip):
                pass
        return _mark_user_edited(_merge_density(out, dens))

    if m == "layout":
        low = tip.lower()
        out = page
        if "时间" in tip or "步骤" in tip or "timeline" in low:
            out = _fallback_to_timeline(page)
        elif ("金句" in tip or "quote" in low or "free" in low) or (
            "大字" in tip and "字体" not in tip and "字号" not in tip and "字大" not in tip
        ):
            out = _fallback_to_free_quote(page)
        elif "对比" in tip or "compare" in low:
            out = _clone_page(_fallback_compact_points(page))
        elif "卡片" in tip or "card" in low:
            out = _fallback_to_card(page)
        elif "清单" in tip or "要点" in tip:
            out = _fallback_compact_points(page)
        elif page.get("type") == "points":
            out = _fallback_to_timeline(page)
        else:
            out = _fallback_compact_points(page)
        return _mark_user_edited(_merge_density(out, dens))

    # both
    if dens and not _has_layout_intent(tip) and not _has_copy_intent(tip):
        return _mark_user_edited(_apply_page_density(page, dens))
    if "时间" in tip or "步骤" in tip:
        return _mark_user_edited(_merge_density(_fallback_to_timeline(page), dens))
    if ("改成金句" in tip or "大字" in tip) and "字体" not in tip and "字号" not in tip:
        return _mark_user_edited(_merge_density(_fallback_to_free_quote(page), dens))
    return _mark_user_edited(_merge_density(_clone_page(page), dens))


def _fallback_layout_ideas(page: dict) -> list[dict[str, Any]]:
    a = _fallback_compact_points(page)
    b = _fallback_to_timeline(page)
    c = _fallback_to_free_quote(page)
    return [
        {
            "id": "compact-list",
            "name": "紧凑清单",
            "rationale": "要点卡片顶部堆叠，适合方法/清单扫读",
            "page": a,
        },
        {
            "id": "step-timeline",
            "name": "步骤时间线",
            "rationale": "按顺序推进，适合行动步骤与节奏",
            "page": b,
        },
        {
            "id": "quote-bullets",
            "name": "大字金句+要点",
            "rationale": "先抛记忆点再列补充，适合收束或强调",
            "page": c,
        },
    ]


async def revise_page(
    data: dict,
    page_index: int,
    *,
    mode: str = "auto",
    instruction: str | None = None,
    title: str | None = None,
    caption: str | None = None,
    page: dict | None = None,
    style: str | None = None,
    logic_summary: list | None = None,
    neighbors: dict | None = None,
    field_path: str | None = None,
    force_rules_fallback: bool = False,
    supplement_context: str | None = None,
) -> dict[str, Any]:
    """字段级编辑器：LLM 优先 → ops 执行；无 Key/失败时规则兜底（标明 rules_fallback）。"""
    timer = TimingTracker("page_revise", intent_snippet=(instruction or "")[:80])
    with timer.phase("prepare"):
        # 可选：前端传来的当前页快照优先，避免 data 与预览不一致
        if isinstance(page, dict) and isinstance(data, dict):
            pages0 = list(data.get("pages") or [])
            if 0 <= page_index < len(pages0):
                pages0[page_index] = page
                data = {**data, "pages": pages0}

        pages_before = len((data or {}).get("pages") or [])
        # soft_flow：禁止插痛点/方法占位页，避免 page_index 漂移
        data, warnings = validate_and_repair(data, soft_flow=True)
        pages = data.get("pages") or []
        if not isinstance(pages, list) or not (0 <= page_index < len(pages)):
            raise ValueError(f"page_index 无效: {page_index}")
        if len(pages) != pages_before:
            _log.warning(
                "page_revise soft_flow still changed page count %s → %s",
                pages_before,
                len(pages),
            )
        mode_n = (mode or "auto").strip().lower()
        if mode_n not in ("auto", "copy", "layout", "both"):
            raise ValueError("mode 必须是 auto|copy|layout|both")

        cur = pages[page_index] if isinstance(pages[page_index], dict) else {}
        if isinstance(page, dict):
            cur = {**cur, **{k: v for k, v in page.items() if k != "_user_edited" or v}}
            for k in (
                "text",
                "title",
                "body",
                "items",
                "steps",
                "tips",
                "paragraphs",
                "bullets",
                "rows",
                "type",
                "density",
                "fontScale",
            ):
                if k in page:
                    cur[k] = page[k]

        instr_raw = (instruction or "").strip()
        instr, pasted = _parse_revise_input(instr_raw, cur)
        nbr = neighbors if isinstance(neighbors, dict) else _page_neighbors(pages, page_index)
        # 封面 hook 注入邻页上下文，供风格一致
        if isinstance(pages[0], dict) and pages[0].get("type") == "cover":
            nbr = {
                **nbr,
                "cover": {
                    "title": _one_line(_as_page_title(pages[0].get("title") or "")),
                    "role": str(pages[0].get("role") or ""),
                },
            }
        theme = str(data.get("theme") or "").strip()
        style_id = (style or data.get("style") or "ins").strip() or "ins"
        if style_id not in STYLE_VOICE:
            style_id = match_style({"style_hint": style_id}, style_id)
        ls_in = logic_summary if isinstance(logic_summary, list) else data.get("logic_summary")
        logic_lines = [str(x).strip() for x in (ls_in or []) if str(x).strip()][:6]

        exec_mode, dens, summary = _route_revise_mode(instr, mode_n)
        rule_ops = _collect_rule_ops(cur, instr, pasted)
        has_key = _has_api_key()
        _log.info(
            "page_revise recv idx=%s type=%s mode_in=%s routed=%s dens=%s style=%s has_key=%s force_rules=%s instr=%r",
            page_index,
            (cur or {}).get("type"),
            mode_n,
            exec_mode,
            dens,
            style_id,
            has_key,
            force_rules_fallback,
            instr[:120],
        )

    def _soft_repair(payload: dict) -> tuple[dict, list[str]]:
        return validate_and_repair(payload, payload.get("meta") or data.get("meta"), soft_flow=True)

    def _pack(
        new_data: dict,
        run_mode: str,
        w_extra: list[str] | None = None,
        *,
        ops: list[dict[str, Any]] | None = None,
        summary_override: str | None = None,
        llm_calls: int | None = None,
    ) -> dict[str, Any]:
        th, logic_out = _logic_fields(new_data)
        page_out = new_data["pages"][page_index]
        d_out = page_out.get("density") if isinstance(page_out, dict) else dens
        fs_out = page_out.get("fontScale") if isinstance(page_out, dict) else None
        ops_out = list(ops or [])
        sum_out = summary_override or _summary_from_ops(ops_out, summary)
        if ops_out and any(o.get("op") == "setDensity" for o in ops_out) and isinstance(
            fs_out, (int, float)
        ):
            for o in ops_out:
                if o.get("op") == "setDensity" and o.get("fontScale") is None:
                    o["fontScale"] = fs_out
        source = "llm" if run_mode == "llm" else "rules_fallback"
        applied_out = _applied_payload(
            exec_mode,
            d_out or dens,
            sum_out,
            ops_out,
            source=source,
        )
        if fs_out is not None:
            applied_out["fontScale"] = fs_out
        if not applied_out.get("density"):
            applied_out.pop("density", None)
        if llm_calls is None:
            llm_calls = 1 if run_mode == "llm" else 0
        eta = 0 if llm_calls == 0 else 5
        timing = timer.log_and_persist(mode=run_mode, ok=True)
        _log.info(
            "page_revise applied mode=%s source=%s summary=%r ops=%s pages=%s",
            run_mode,
            source,
            sum_out,
            [o.get("op") for o in ops_out],
            len(new_data.get("pages") or []),
        )
        return {
            "data": new_data,
            "page": page_out,
            "page_index": page_index,
            "title": title,
            "caption": caption,
            "theme": th,
            "logic_summary": logic_out,
            "mode": run_mode,
            "applied": applied_out,
            "warnings": warnings + (w_extra or []),
            "meta": _api_meta("page_revise", llm_calls, eta, timing),
        }

    def _try_rules_fallback(
        *,
        reason: str,
        llm_calls: int,
        w_extra: list[str] | None = None,
    ) -> dict[str, Any] | None:
        ok, ruled_page, applied_ops, rule_summary = _rule_ops_resolvable(
            cur, instr, pasted, rule_ops, exec_mode
        )
        if not ok or ruled_page is None:
            return None
        _log.info(
            "page_revise path=rules_fallback reason=%s summary=%r ops=%s",
            reason,
            rule_summary,
            applied_ops,
        )
        new_data = _apply_page_to_data(data, page_index, ruled_page)
        new_data, w2 = _soft_repair(new_data)
        page_check = (new_data.get("pages") or [None])[page_index]
        if pasted and isinstance(page_check, dict):
            blob = json.dumps(page_check, ensure_ascii=False)
            if pasted in blob and any("删" in _humanize_op(o) for o in applied_ops):
                _log.warning("page_revise schema rolled back delete; re-applying")
                again, _ = _apply_delete_sentence(page_check, instr, pasted)
                if again is not None:
                    new_data = _apply_page_to_data(new_data, page_index, _mark_user_edited(again))
                    new_data, w2b = _soft_repair(new_data)
                    w2 = w2 + w2b
        notes = list(w_extra or [])
        notes.append(f"rules_fallback：{reason}")
        return _pack(
            new_data,
            "rules_fallback",
            w2 + notes,
            ops=applied_ops,
            summary_override=rule_summary,
            llm_calls=llm_calls,
        )

    # 调试：强制走规则兜底（不调用 LLM）
    if force_rules_fallback:
        with timer.phase("rules_fallback"):
            packed = _try_rules_fallback(reason="force_rules_fallback", llm_calls=0)
        if packed:
            return packed
        raise ValueError(
            "强制规则兜底失败：指令不够明确（仅支持删第N条/更紧凑/改标题等安全操作）。"
            "复杂改写请去掉 force_rules_fallback，走 LLM。"
        )

    llm_mode = exec_mode if exec_mode in ("copy", "layout", "both") else "both"

    # 无 Key：仅明确安全操作可规则兜底；复杂指令报错（不冒充 AI）
    if not has_key:
        with timer.phase("rules_fallback"):
            packed = _try_rules_fallback(reason="未配置 API Key", llm_calls=0)
        if packed:
            return packed
        raise ValueError(
            "未配置 LLM，无法 AI 编辑。请在 backend/.env 配置 XHS_LLM_API_KEY；"
            "或改用「删掉第N条 / 更紧凑 / 字体变小」等明确操作走快速规则。"
        )

    user_msg = build_page_editor_user(
        instruction=instr
        or (
            "按用户意图做最小必要字段修改；要删就删"
            if llm_mode == "copy"
            else "调整版式/结构；文案可微调"
            if llm_mode == "layout"
            else "文案与版式都按指令改；禁止加回已删内容"
        ),
        page=cur,
        page_index=page_index,
        style=style_id,
        theme=theme,
        logic_summary=logic_lines,
        neighbors=nbr,
        title=title or "",
        caption=caption or "",
        delete_target=pasted or "",
        suggested_density=dens,
        mode=llm_mode,
        field_path=(field_path or "").strip() or None,
        supplement_context=supplement_context,
    )
    try:
        with timer.phase("llm_revise"):
            raw = await _chat_json(SYSTEM_PAGE_EDITOR, user_msg, temperature=0.35)
            ops_raw = raw.get("ops") if isinstance(raw.get("ops"), list) else []
            llm_ops = [o for o in (_normalize_op(x) for x in ops_raw) if o]
            llm_summary = str(raw.get("summary") or "").strip()

            if not llm_ops and isinstance(raw.get("page"), dict):
                _log.warning("page_revise LLM returned page without ops; refusing blind rewrite")
                raise ValueError("模型未返回可解释 ops")
            if not llm_ops:
                raise ValueError("模型未返回可解释 ops")

            new_page, applied_ops, ops_summary = _apply_page_ops(cur, llm_ops)
            if not applied_ops:
                raise ValueError("ops 未能应用到当前页（索引或字段无效）")

            new_page = _mark_user_edited(new_page)
            new_data = _apply_page_to_data(data, page_index, new_page)
        with timer.phase("validate_repair"):
            new_data, w2 = _soft_repair(new_data)
        sum_out = llm_summary or ops_summary or _summary_from_ops(applied_ops, summary)
        _log.info("page_revise path=llm summary=%r ops=%s", sum_out, applied_ops)
        return _pack(
            new_data,
            "llm",
            w2,
            ops=applied_ops,
            summary_override=sum_out,
            llm_calls=1,
        )
    except Exception as exc:  # noqa: BLE001
        _log.warning("page_revise LLM failed: %s", exc)
        with timer.phase("rules_fallback"):
            packed = _try_rules_fallback(
                reason=f"LLM 失败：{exc}",
                llm_calls=1,
                w_extra=[f"LLM 调用失败，已尝试规则兜底: {exc}"],
            )
        if packed:
            return packed
        raise ValueError(
            f"AI 编辑失败，请重试（快速规则也无法处理此指令）：{exc}"
        ) from exc


async def revise_page_stream(
    data: dict,
    page_index: int,
    *,
    mode: str = "auto",
    instruction: str | None = None,
    title: str | None = None,
    caption: str | None = None,
    page: dict | None = None,
    style: str | None = None,
    logic_summary: list | None = None,
    neighbors: dict | None = None,
    field_path: str | None = None,
    force_rules_fallback: bool = False,
    supplement_context: str | None = None,
):
    """NDJSON stream: op events → meta → done (or error)."""
    try:
        result = await revise_page(
            data,
            page_index,
            mode=mode,
            instruction=instruction,
            title=title,
            caption=caption,
            page=page,
            style=style,
            logic_summary=logic_summary,
            neighbors=neighbors,
            field_path=field_path,
            force_rules_fallback=force_rules_fallback,
            supplement_context=supplement_context,
        )
    except ValueError as exc:
        yield json.dumps({"event": "error", "message": str(exc)}, ensure_ascii=False) + "\n"
        return

    applied = result.get("applied") if isinstance(result.get("applied"), dict) else {}
    ops = applied.get("ops") if isinstance(applied.get("ops"), list) else []
    for op in ops:
        if isinstance(op, dict):
            yield json.dumps({"event": "op", "op": op}, ensure_ascii=False) + "\n"
    meta = result.get("meta") if isinstance(result.get("meta"), dict) else {}
    yield (
        json.dumps(
            {
                "event": "meta",
                "mode": result.get("mode"),
                "llm_calls": meta.get("llm_calls", 0),
                "timing": meta.get("timing"),
            },
            ensure_ascii=False,
        )
        + "\n"
    )
    yield (
        json.dumps(
            {
                "event": "done",
                "data": result.get("data"),
                "applied": applied,
                "title": result.get("title"),
                "caption": result.get("caption"),
                "theme": result.get("theme"),
                "logic_summary": result.get("logic_summary"),
                "mode": result.get("mode"),
                "meta": meta,
                "warnings": result.get("warnings"),
                "page_index": result.get("page_index"),
            },
            ensure_ascii=False,
        )
        + "\n"
    )


async def layout_ideas(
    data: dict,
    page_index: int,
    *,
    intent: str | None = None,
) -> dict[str, Any]:
    timer = TimingTracker("layout_ideas", intent_snippet=(intent or "")[:80])
    with timer.phase("prepare"):
        data, warnings = validate_and_repair(data)
        pages = data.get("pages") or []
        if not isinstance(pages, list) or not (0 <= page_index < len(pages)):
            raise ValueError(f"page_index 无效: {page_index}")
        cur = pages[page_index] if isinstance(pages[page_index], dict) else {}
        neighbors = _page_neighbors(pages, page_index)
        theme = str(data.get("theme") or "").strip()

    if not _has_api_key():
        with timer.phase("fallback_ideas"):
            ideas = _fallback_layout_ideas(cur)
        timing = timer.log_and_persist(mode="demo", ok=True)
        return {
            "ideas": ideas,
            "page_index": page_index,
            "mode": "demo",
            "warnings": warnings + ["无 API Key：已返回预置 3 种排版转换"],
            "meta": _api_meta("layout_ideas", 0, 1, timing),
        }

    user_obj = {
        "intent": (intent or "").strip(),
        "page_index": page_index,
        "theme": theme,
        "neighbors": neighbors,
        "page": cur,
        "outline": data.get("logic_summary") or [],
        "pages_brief": [
            {
                "i": i,
                "type": p.get("type"),
                "title": _one_line(_as_page_title(p.get("title") or p.get("text") or "")),
                "role": p.get("role") or "",
            }
            for i, p in enumerate(pages)
            if isinstance(p, dict)
        ],
    }
    try:
        with timer.phase("llm_layout"):
            raw = await _chat_json(
                SYSTEM_LAYOUT_IDEAS,
                json.dumps(user_obj, ensure_ascii=False),
                temperature=0.7,
            )
            ideas_raw = raw.get("ideas") if isinstance(raw.get("ideas"), list) else []
            ideas: list[dict[str, Any]] = []
            for i, it in enumerate(ideas_raw[:3]):
                if not isinstance(it, dict) or not isinstance(it.get("page"), dict):
                    continue
                ideas.append({
                    "id": str(it.get("id") or f"idea-{i+1}"),
                    "name": str(it.get("name") or f"方案{i+1}"),
                    "rationale": str(it.get("rationale") or ""),
                    "page": it["page"],
                })
            if len(ideas) < 3:
                raise ValueError(f"方案不足 3 个（得 {len(ideas)}）")
        with timer.phase("validate_repair"):
            # validate each page via temp merge
            ok_ideas = []
            for idea in ideas:
                tmp = _apply_page_to_data(data, page_index, idea["page"])
                repaired, _w = validate_and_repair(tmp, data.get("meta"))
                idea["page"] = repaired["pages"][page_index]
                ok_ideas.append(idea)
        timing = timer.log_and_persist(mode="llm", ok=True)
        return {
            "ideas": ok_ideas,
            "page_index": page_index,
            "mode": "llm",
            "warnings": warnings,
            "meta": _api_meta("layout_ideas", 1, 6, timing),
        }
    except Exception as exc:  # noqa: BLE001
        with timer.phase("fallback_ideas"):
            ideas = _fallback_layout_ideas(cur)
        timing = timer.log_and_persist(
            mode="demo_fallback",
            ok=True,
            extra={"error": str(exc)[:120]},
        )
        return {
            "ideas": ideas,
            "page_index": page_index,
            "mode": "demo_fallback",
            "warnings": warnings + [f"排版思路生成失败，已预置转换: {exc}"],
            "meta": _api_meta("layout_ideas", 1, 6, timing),
        }
