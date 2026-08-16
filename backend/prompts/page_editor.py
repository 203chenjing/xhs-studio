# -*- coding: utf-8 -*-
"""单页字段级编辑器 Agent — 专业 system / user prompt。

产品原则：创新点不是「AI 会点界面」，而是「AI 像编辑器一样改字段，
并且每一步可解释、可撤销」。所有改写服从整篇视觉风格 + 叙事语气。
"""
from __future__ import annotations

import json
from typing import Any

# 视觉主题气质（与 themes.py / 前端 XHS_THEMES 对齐）
STYLE_VOICE: dict[str, dict[str, str]] = {
    "ins": {
        "title": "简约 INS",
        "voice": "克制、清爽、职场干货感；短句利落，少煽情，留白意识强",
    },
    "literary": {
        "title": "清新文艺",
        "voice": "温暖、柔软、有呼吸感；可稍文学但不矫情，金句宜短而余韵",
    },
    "orange": {
        "title": "INDUSTRIAL",
        "voice": "效率、清单、工具感；动词开头，步骤清楚，拒绝空泛鸡汤",
    },
    "bold-signal": {
        "title": "SIGNAL",
        "voice": "冲击、态度、爆款钩子；标题可狠，但事实仍须来自原文，勿造谣",
    },
    "terminal": {
        "title": "TERMINAL",
        "voice": "技术极客、冷静精确；术语可用，但面向创作者仍要可读",
    },
    "brutalist": {
        "title": "BRUTAL",
        "voice": "大胆、硬核、设计感；用词可以冲，结构仍要清晰",
    },
    "botanical": {
        "title": "BOTANICAL",
        "voice": "高级、质感、品牌感；少口号堆砌，偏精致短句",
    },
}


SYSTEM_PAGE_EDITOR = """你是资深小红书图文「视觉编辑 + 文案编辑」合体，也是字段级编辑器 Agent。
你不是「会点界面的助手」，而是像 Figma/文档编辑器一样：只改该改的字段，每一步可解释。

## 输出格式（唯一合法）
只输出 JSON（不要 markdown 代码块、不要解释散文）：
{
  "ops": [
    {"op":"setDensity","density":"compact"|"normal"|"airy"},
    {"op":"setFontScale","fontScale":0.70到1.35的数},
    {"op":"rewriteField","field":"title|subtitle|text|body|intro|desc|caption|from","value":"新文案"},
    {"op":"deleteItem","list":"items|steps|tips|bullets|rows|paragraphs|cta","index":1},
    {"op":"updateItem","list":"items|steps|tips|bullets|rows|cta","index":1,"head":"可选","body":"可选","value":"可选","label":"可选","valueIndex":2},
    {"op":"setPageType","type":"points|timeline|quote|card|free|compare|summary|cover|ending|..."}
  ],
  "summary": "给人看的一句中文，如：变紧凑 · 删第2条"
}

硬性：
- 优先用 ops；禁止盲改 CSS、禁止输出整页 page 却说不清改了哪
- ops 按执行顺序；能 1 条说清就不要拆成 5 条废话
- index 从 1 开始（第 1 条 = index 1）
- list 可省略：服务端会按当前页 type 推断（points→items，timeline→steps…）

## 角色职责
1. 视觉：字号/疏密只用 density / fontScale；不发明主题色、不改 theme token、不写自定义 CSS
2. 文案：服从整篇 tone（theme + logic_summary + 封面 hook + 邻页 title/role）；语域与封面一致
3. 事实：不编造用户未提供的数据、数字、职级、结果；删就删，不要为「信息量」把已删内容加回
4. 风格：与 style 气质一致——ins 克制 / bold-signal 冲击 / literary 温暖 / orange 效率清单 / terminal 技术冷静 / brutalist 大胆 / botanical 高级质感

## 何时出哪类 op
- 「更紧凑 / 字体变小一点」→ setDensity=compact（可再带 setFontScale 微调）
- 「疏朗 / 字体变大」→ setDensity=airy
- 「删掉第2条/步/行」→ deleteItem index=2
- 「把第N条改成…」→ updateItem
- 「标题更狠 / 副标题缩短 / 换金句」→ rewriteField（保持风格，可更锋利，但不破主题）
- 「改成时间线/清单/金句」→ setPageType（必要时再配 rewriteField / updateItem）

## 禁止
- 禁止整页重写却只给一句含糊 summary
- 禁止为了「好看」擅自加回已删除条目
- 禁止 emoji
- 禁止输出除上述 JSON 以外的任何文字
"""


# few-shot：删条、变紧凑、改标题更狠且不破风格
FEW_SHOT_EXAMPLES: list[dict[str, Any]] = [
    {
        "note": "删第2条（结构化 deleteItem）",
        "instruction": "删掉第2条",
        "style": "ins",
        "page_type": "points",
        "output": {
            "ops": [{"op": "deleteItem", "list": "items", "index": 2}],
            "summary": "删第2条",
        },
    },
    {
        "note": "字体变小 / 变紧凑",
        "instruction": "字体变小一点",
        "style": "ins",
        "page_type": "quote",
        "output": {
            "ops": [{"op": "setDensity", "density": "compact"}],
            "summary": "变紧凑",
        },
    },
    {
        "note": "标题更狠，但保持 SIGNAL 冲击气质与主题",
        "instruction": "标题更狠更抓人",
        "style": "bold-signal",
        "theme": "实习三个月，我终于学会怎么推需求",
        "page_type": "cover",
        "page_title": "我的实习复盘",
        "output": {
            "ops": [
                {
                    "op": "rewriteField",
                    "field": "title",
                    "value": "别再闷头写需求\n先学会这样推",
                }
            ],
            "summary": "标题更狠",
        },
    },
]


def style_voice_line(style_id: str | None) -> str:
    sid = (style_id or "ins").strip() or "ins"
    meta = STYLE_VOICE.get(sid) or STYLE_VOICE["ins"]
    return f"{sid}（{meta['title']}）：{meta['voice']}"


def few_shot_block() -> str:
    lines = ["## 示例（严格模仿输出形态）"]
    for i, ex in enumerate(FEW_SHOT_EXAMPLES, 1):
        lines.append(f"### 例{i} · {ex.get('note')}")
        lines.append(f"用户指令：{ex.get('instruction')}")
        if ex.get("theme"):
            lines.append(f"theme：{ex['theme']}")
        lines.append(f"style：{ex.get('style')} · page.type：{ex.get('page_type')}")
        if ex.get("page_title"):
            lines.append(f"原 title：{ex['page_title']}")
        lines.append("输出：")
        lines.append(json.dumps(ex["output"], ensure_ascii=False))
    return "\n".join(lines)


SUPPLEMENT_HEADER = "用户补充材料（仅供参考，勿编造）"


def supplement_context_block(supplement_context: str | None) -> str:
    """Append user-provided facts/tone constraints to LLM user messages."""
    s = (supplement_context or "").strip()
    if not s:
        return ""
    return (
        f"\n\n## {SUPPLEMENT_HEADER}\n"
        "以下为用户提供的背景事实、语气偏好或禁忌。"
        "改写时仅可引用其中已陈述的事实；不得编造其中未出现的数字、职级、结果；"
        "若材料含「脱敏」标记，输出中勿暴露原始隐私信息。\n\n"
        f"{s}\n"
    )


def build_page_editor_user(
    *,
    instruction: str,
    page: dict,
    page_index: int,
    style: str | None,
    theme: str,
    logic_summary: list[str] | None,
    neighbors: dict[str, Any] | None,
    title: str = "",
    caption: str = "",
    delete_target: str = "",
    suggested_density: str | None = None,
    mode: str = "both",
    field_path: str | None = None,
    supplement_context: str | None = None,
) -> str:
    """拼装发给模型的 user 消息（含风格与邻页上下文）。"""
    cover_hook = ""
    # 调用方可把封面 title 放进 neighbors.cover；否则留空
    if isinstance(neighbors, dict):
        cover = neighbors.get("cover") if isinstance(neighbors.get("cover"), dict) else None
        if cover:
            cover_hook = str(cover.get("title") or "").strip()

    payload = {
        "mode": mode,
        "instruction": instruction or "按编辑意图做最小必要修改",
        "field_path": field_path or "",
        "delete_target": delete_target or "",
        "suggested_density": suggested_density,
        "page_index": page_index,
        "style": style or "ins",
        "style_voice": style_voice_line(style),
        "theme": theme or "",
        "logic_summary": logic_summary or [],
        "cover_hook": cover_hook,
        "neighbors": {
            "prev": (neighbors or {}).get("prev"),
            "next": (neighbors or {}).get("next"),
        },
        "note_title": title or "",
        "note_caption": caption or "",
        "page": page,
        "rules": [
            "输出 ops + summary；不要输出完整 page",
            "不破坏主题 token；字号/疏密只用 density/fontScale",
            "不编造未提供事实；删就删",
            "文案语域与 theme / 封面 hook / style_voice 一致",
            "summary 用人话，便于 UI 展示「做了什么」",
            "若提供 field_path，优先只改该字段或其所在 list 条目（如 items[1].body、rows[0].values[1]、cta[0]）",
        ],
    }
    supp = (supplement_context or "").strip()
    if supp:
        payload["supplement_context"] = supp
    return (
        few_shot_block()
        + "\n\n## 当前任务\n"
        + json.dumps(payload, ensure_ascii=False)
        + supplement_context_block(supp)
    )
