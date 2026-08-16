# -*- coding: utf-8 -*-
"""Seven visual themes metadata (aligned with xhs-templates)."""

THEMES = {
    "ins": {
        "id": "ins",
        "title": "简约 INS",
        "desc": "浅色留白 · 低饱和 · 细线",
        "mood": ["简约", "清爽", "职场", "干货", "教程"],
    },
    "literary": {
        "id": "literary",
        "title": "清新文艺",
        "desc": "暖米色 · 莫兰迪 · 衬线",
        "mood": ["文艺", "生活", "读书", "心情", "治愈"],
    },
    "orange": {
        "id": "orange",
        "title": "INDUSTRIAL",
        "desc": "白底 · 安全橙 · 零圆角",
        "mood": ["效率", "清单", "工业", "工具", "硬核"],
    },
    "bold-signal": {
        "id": "bold-signal",
        "title": "SIGNAL",
        "desc": "纯黑暗底 · 橙红卡片",
        "mood": ["冲击", "爆款", "态度", "警告", "强烈"],
    },
    "terminal": {
        "id": "terminal",
        "title": "TERMINAL",
        "desc": "GitHub 深色 · 终端绿",
        "mood": ["技术", "程序员", "AI", "代码", "极客"],
    },
    "brutalist": {
        "id": "brutalist",
        "title": "BRUTAL",
        "desc": "白底 · 粗黑边框 · 硬阴影",
        "mood": ["大胆", "叛逆", "设计", "潮流", "先锋"],
    },
    "botanical": {
        "id": "botanical",
        "title": "BOTANICAL",
        "desc": "深黑底 · 暖金/粉点缀",
        "mood": ["高级", "质感", "品牌", "美学", "精致"],
    },
}


def list_themes() -> list[dict]:
    return [
        {
            "id": t["id"],
            "title": t["title"],
            "desc": t["desc"],
            "mood": t["mood"],
        }
        for t in THEMES.values()
    ]


def match_style(brief: dict | None, preferred: str | None = None) -> str:
    if preferred and preferred in THEMES:
        return preferred
    text = ""
    if isinstance(brief, dict):
        text = " ".join(
            str(brief.get(k, ""))
            for k in ("topic", "tone", "audience", "keywords", "intent", "style_hint")
        ).lower()
    else:
        text = str(brief or "").lower()

    scores: dict[str, int] = {k: 0 for k in THEMES}
    for tid, meta in THEMES.items():
        for m in meta["mood"]:
            if m.lower() in text or m in text:
                scores[tid] += 2
    # keyword heuristics
    rules = [
        ("terminal", ["技术", "代码", "程序员", "开发", "ai", "github", "极客", "编程"]),
        ("bold-signal", ["爆款", "避坑", "别再", "警告", "强烈", "态度"]),
        ("literary", ["文艺", "读书", "生活", "治愈", "散文", "心情"]),
        ("orange", ["清单", "效率", "步骤", "工业", "工具", "checklist"]),
        ("brutalist", ["设计", "潮流", "先锋", "叛逆", "brutal"]),
        ("botanical", ["高级", "质感", "品牌", "美学", "精致", "奢"]),
        ("ins", ["简约", "干货", "教程", "职场", "实习", "秋招", "学习"]),
    ]
    for tid, kws in rules:
        for kw in kws:
            if kw in text:
                scores[tid] += 1

    best = max(scores, key=lambda k: (scores[k], -list(THEMES.keys()).index(k)))
    if scores[best] == 0:
        return "ins"
    return best
