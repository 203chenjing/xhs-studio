# -*- coding: utf-8 -*-
"""Reliable demo/fallback DATA generation without LLM."""
from __future__ import annotations

import re
from typing import Any


def _topic_from_intent(intent: str) -> str:
    s = (intent or "").strip()
    if not s:
        return "小红书干货笔记"
    s = re.sub(
        r"^(帮我|请|想|我要|生成|写一篇|写一套|做一套|做一篇|关于)+",
        "",
        s,
    ).strip(" ：:，,")
    return s[:40] if s else "小红书干货笔记"


def _detect_category(intent: str) -> str:
    t = intent.lower()
    # 显式弧优先：清单 / 故事 / 对比
    if any(k in t for k in ("对比", "vs", "还是", "怎么选", "选择困难", "白天还是", "a还是b")):
        return "compare"
    if any(k in t for k in ("故事", "复盘", "我是怎么", "亲历", "成长曲线", "从…到")):
        return "story"
    if any(k in t for k in ("清单", "checklist", "步骤清单", "行动清单", "todo")):
        return "list"
    if any(k in t for k in ("秋招", "校招", "网申", "投递", "offer", "面试")):
        return "recruit"  # 清单型弧
    if any(k in t for k in ("实习", "入职", "职场", "mentor", "转正")):
        return "intern"  # 故事型弧
    if any(k in t for k in ("学习", "复习", "期末", "笔记法", "考研", "背书")):
        return "study"
    if any(k in t for k in ("ai", "产品", "prompt", "大模型", "agent")):
        return "ai_pm"
    if any(k in t for k in ("旅游", "旅行", "攻略", "夜游", "景点", "打卡", "周末去")):
        return "travel"  # 对比型弧
    return "general"


def _arc_of(cat: str) -> str:
    if cat in ("recruit", "ai_pm", "list", "general"):
        return "list"
    if cat in ("intern", "study", "story"):
        return "story"
    if cat in ("travel", "compare"):
        return "compare"
    return "mixed"


def build_demo_payload(
    intent: str,
    *,
    author: str = "创作者",
    brand: str = "@XHSStudio",
    style: str | None = None,
    image_urls: list[str] | None = None,
) -> dict[str, Any]:
    topic = _topic_from_intent(intent)
    cat = _detect_category(intent)
    arc = _arc_of(cat)
    avatar = author[:1] if author else "X"
    n_img = len(image_urls or [])

    brief = {
        "topic": topic,
        "audience": "小红书泛兴趣用户",
        "tone": "真诚干货、口语化、高信息密度",
        "pages_hint": 7,
        "category": cat,
        "arc": arc,
        "intent": intent,
        "demo": True,
        "image_count": n_img,
    }

    if cat == "list":
        data = _list_arc(topic, author, avatar, brand)
        title = f"{topic}｜可执行清单"
        caption = (
            f"别再收藏吃灰。\n\n"
            f"按清单拆开做，每一步都能立刻开工。"
            f"建议收藏，对照打勾。\n\n"
            f"#清单 #干货 #行动清单 #建议收藏"
        )
        hooks = [title, "一张清单搞定执行", f"{topic}｜照着做"]
    elif cat == "story":
        data = _story_arc(topic, author, avatar, brand)
        title = f"{topic}｜真实复盘"
        caption = (
            f"不是鸡汤，是走过弯路之后留下的方法。\n\n"
            f"从卡住到打通，按节点讲清楚。\n\n"
            f"#复盘 #成长 #真实故事 #建议收藏"
        )
        hooks = [title, "我是怎么一步步过来的", "复盘比鸡汤管用"]
    elif cat == "recruit":
        data = _recruit(topic, author, avatar, brand)
        title = f"{topic}｜亲测投递节奏"
        caption = (
            f"秋招别瞎投，先把流程跑通。\n\n"
            f"从信息收集到 Offer 决策，这篇按时间线拆开讲。"
            f"建议收藏，投递高峰期对照用。\n\n"
            f"#秋招 #校招 #求职 #避坑 #网申"
        )
        hooks = [title, "秋招别再无效海投", "校招信息差才是竞争力", f"{topic}｜收藏对照"]
    elif cat == "intern":
        data = _intern(topic, author, avatar, brand)
        title = f"{topic}｜30天复盘"
        caption = (
            f"实习前30天，真正拉开差距的不是加班。\n\n"
            f"破冰、独立任务、跨团队、复盘——按周拆给你。\n\n"
            f"#实习 #职场成长 #大学生 #转正"
        )
        hooks = [title, "实习第一周别急着表现", "学生思维 vs 职场思维"]
    elif cat == "study":
        data = _study(topic, author, avatar, brand)
        title = f"{topic}｜高效笔记法"
        caption = (
            f"别再死记硬背了。\n\n"
            f"框架 → 主动回忆 → 费曼输出，三步搭知识体系。\n\n"
            f"#学习方法 #笔记 #高效学习 #期末复习"
        )
        hooks = [title, "期末复习三步法亲测", "学习是为了能调用"]
    elif cat == "ai_pm":
        data = _ai_pm(topic, author, avatar, brand)
        title = f"{topic}｜落地清单"
        caption = (
            f"AI 产品怎么从想法落到可用功能？\n\n"
            f"场景 → 指标 → 交互 → 评估，四个槽位写清楚再开工。\n\n"
            f"#AI产品 #产品经理 #大模型 #Agent"
        )
        hooks = [title, "别先选模型，先写清场景", "AI 产品评估四问"]
    elif cat == "travel":
        data = _travel(topic, author, avatar, brand)
        title = f"{topic}｜白天还是夜游"
        caption = (
            f"白天打卡 vs 夜游，差别真的很大。\n\n"
            f"人流、花费、出片、体力——一张表帮你选。"
            f"建议收藏，下次出行别踩坑。\n\n"
            f"#旅游攻略 #夜游 #周末去哪儿 #避坑"
        )
        hooks = [title, "亲测：夜游更出片的3个点", "别再只会白天暴走"]
    elif cat == "compare":
        data = _compare(topic, author, avatar, brand)
        title = f"{topic}｜怎么选"
        caption = (
            f"别凭感觉选，用对比表拍板。\n\n"
            f"维度拆开、利弊写清，决策会轻松很多。\n\n"
            f"#决策 #对比 #干货 #选择困难"
        )
        hooks = [title, "一张表看懂差异", "别再纠结了"]
    else:
        data = _general(topic, author, avatar, brand)
        title = f"{topic}｜创作指南"
        caption = (
            f"从选题到发布的完整工作流。\n\n"
            f"封面决定点击，每页只讲一个重点，系列化更容易涨粉。\n\n"
            f"#小红书 #图文创作 #干货 #内容创作"
        )
        hooks = [title, "爆款图文结构拆解", "一句话开始你的第一篇"]

    if n_img:
        caption = caption.rstrip() + f"\n\n（本篇含 {n_img} 张实拍配图）"
        title = f"{title}｜含实拍"
        hooks = [title] + [h for h in hooks[1:] if h != title]

    theme = f"{topic}：把关键步骤讲清楚，并立刻能动手"
    # 粗大纲（validate 后会按 pages.role 再精炼）
    logic_summary = [
        f"①钩子 · {topic}",
        "②痛点/价值 · 先对齐为什么看",
        "③方法 · 可执行干货",
        "④行动 · 收藏并开工",
    ]
    if isinstance(data, dict):
        data = {**data, "theme": theme, "logic_summary": logic_summary}

    return {
        "brief": brief,
        "style": style or "ins",
        "data": data,
        "title": title,
        "caption": caption,
        "hooks": hooks,
        "theme": theme,
        "logic_summary": logic_summary,
        "mode": "demo",
    }


def _meta(author: str, avatar: str, brand: str) -> dict:
    return {"author": author, "avatar": avatar, "brand": brand}



def _list_arc(topic: str, author: str, avatar: str, brand: str) -> dict:
    """清单型：points / free / composite 为主。"""
    return {
        "meta": _meta(author, avatar, brand),
        "outline": [
            {"intent": "钩子", "type": "cover"},
            {"intent": "清单主体", "type": "points"},
            {"intent": "执行说明", "type": "free"},
            {"intent": "混排补充", "type": "composite"},
            {"intent": "行动", "type": "ending"},
        ],
        "pages": [
            {
                "type": "cover",
                "kicker": "CHECKLIST",
                "title": f"{topic}\n行动清单",
                "subtitle": "拆成可打勾的步骤，收藏对照比收藏吃灰有用",
                "tags": ["清单", "干货", "执行"],
            },
            {
                "type": "points",
                "title": "先做这 4 件",
                "intro": "按顺序打勾，别一上来铺太大摊子",
                "items": [
                    {
                        "head": "① 写清目标",
                        "body": "一句话写出现状和期望。写不清就先别开工，否则后面步骤都会飘。",
                    },
                    {
                        "head": "② 拆最小动作",
                        "body": "每步最好 25 分钟内能完成。太大就继续拆，阻力会小很多。",
                    },
                    {
                        "head": "③ 设检查点",
                        "body": "每做完两步停一下：有效就继续，无效就改方法，别闷头硬扛。",
                    },
                    {
                        "head": "④ 留下复用版",
                        "body": "把有效步骤写成自己的模板。下次直接套，而不是重头摸索。",
                    },
                ],
            },
            {
                "type": "free",
                "title": "怎么用这份清单",
                "paragraphs": [
                    f"围绕「{topic}」，今天只做清单上的第一步就够。",
                    "别追求一次做完美页——完成比完美更重要，完成才会有反馈。",
                ],
                "bullets": [
                    "手机备忘录复制标题当打勾栏",
                    "卡壳超过 15 分钟就换更小一步",
                    "做完三步发一条进度，给自己正反馈",
                ],
            },
            {
                "type": "composite",
                "blocks": [
                    {
                        "type": "card",
                        "label": "避坑",
                        "title": "最常见的三种拖延",
                        "body": "资料收藏过多、工具挑花眼、等「状态好了再开始」。先最小闭环，再谈优化。",
                    },
                    {
                        "type": "summary",
                        "title": "带走这句",
                        "items": ["清单是为了开工，不是为了好看", "一步做完再看下一步"],
                    },
                ],
            },
            {
                "type": "ending",
                "title": "收藏打勾\n今天就开始",
                "desc": "评论区报你完成了第几步",
                "cta": ["关注拿更多可执行清单", "转发给一起行动的朋友"],
                "tags": ["#清单", "#干货", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _story_arc(topic: str, author: str, avatar: str, brand: str) -> dict:
    """故事型：chapter + free + quote + timeline。"""
    return {
        "meta": _meta(author, avatar, brand),
        "outline": [
            {"intent": "钩子", "type": "cover"},
            {"intent": "场景铺垫", "type": "chapter"},
            {"intent": "转折叙述", "type": "free"},
            {"intent": "过程节点", "type": "timeline"},
            {"intent": "金句", "type": "quote"},
            {"intent": "行动", "type": "ending"},
        ],
        "pages": [
            {
                "type": "cover",
                "kicker": "STORY",
                "title": f"{topic}\n真实复盘",
                "subtitle": "从卡住到打通：不是鸡汤，是可复用的节点",
                "tags": ["复盘", "成长", "真实"],
            },
            {
                "type": "chapter",
                "no": "01",
                "title": "那时我卡在哪",
                "desc": "先对齐困境，后面的方法才站得住",
            },
            {
                "type": "free",
                "title": "转折发生在哪一步",
                "kicker": "TURNING POINT",
                "paragraphs": [
                    "真正改变的不是「更努力」，而是把模糊目标改成可验证的小实验。",
                    f"围绕「{topic}」，我只保留能带来反馈的动作，删掉了表演式忙碌。",
                ],
                "bullets": [
                    "每天只推进一个可验证点",
                    "把失败写成下次输入，而不是自我攻击",
                ],
            },
            {
                "type": "timeline",
                "title": "关键节点",
                "steps": [
                    {
                        "time": "卡住时",
                        "head": "承认无效努力",
                        "body": "列出过去两周做了但没反馈的事。小贴士：删掉一半，比再加一项工具更有效。",
                    },
                    {
                        "time": "转折后",
                        "head": "缩小实验",
                        "body": "用一周验证一个方法。避坑：别同时开三条新赛道，注意力会被撕碎。",
                    },
                    {
                        "time": "稳定期",
                        "head": "沉淀模板",
                        "body": "把有效动作写成可复用清单。下次从模板起步，而不是从焦虑起步。",
                    },
                ],
            },
            {
                "type": "quote",
                "text": "复盘的价值\n不是证明自己对，\n而是下次少走弯路。",
                "from": "个人笔记",
            },
            {
                "type": "ending",
                "title": "写下你的\n下一个节点",
                "desc": "评论区交换你的转折点",
                "cta": ["关注看更多真实复盘", "建议收藏，低谷时重读"],
                "tags": ["#复盘", "#成长", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _recruit(topic: str, author: str, avatar: str, brand: str) -> dict:
    """清单型：cover → points → free → composite → timeline → ending"""
    return {
        "meta": _meta(author, avatar, brand),
        "outline": [
            {"intent": "钩子"},
            {"intent": "信息源清单"},
            {"intent": "怎么用"},
            {"intent": "混排提醒"},
            {"intent": "时间节奏"},
            {"intent": "行动"},
        ],
        "pages": [
            {
                "type": "cover",
                "kicker": "CAMPUS HIRE",
                "title": f"{topic}\n投递清单",
                "subtitle": "亲测：先建清单再投，回复率比盲目海投高一截",
                "tags": ["秋招", "校招", "求职", "避坑"],
            },
            {
                "type": "points",
                "title": "5 个靠谱信息源",
                "intro": "多渠道并行，每天花 20 分钟更新清单就够",
                "items": [
                    {
                        "head": "① 官方招聘号",
                        "body": "公众号/官网第一时间拿网申与宣讲安排。建议开推送，提前批窗口往往只有几天。",
                    },
                    {
                        "head": "② 校招汇总表",
                        "body": "飞书/石墨类汇总按行业和城市筛选。亲测：先标「必投/可投/观望」，比收藏一百条链接管用。",
                    },
                    {
                        "head": "③ 学校就业网",
                        "body": "内推码、宣讲会、校友资源常被忽略。宣讲会现场要到的内推，回复率通常更高。",
                    },
                    {
                        "head": "④ 面经与 Timeline",
                        "body": "参考节奏可以，但注意时效。去年的流程今年可能改，重点看「考察点」而不是背题。",
                    },
                    {
                        "head": "⑤ 学长学姐内推",
                        "body": "成功率最高的渠道。提前维护关系，问具体团队和节奏，别只丢一句「能内推吗」。",
                    },
                ],
            },
            {
                "type": "free",
                "title": "每日投递怎么排",
                "paragraphs": [
                    "别一上来狂点投递。先把「必投/可投」标完，再进入执行。",
                    "建议每天固定时段投 5-8 家，投完立刻记进度表——跟进比海投更决定结果。",
                ],
                "bullets": [
                    "简历准备 2 版，别临时改",
                    "文件名写清学校+姓名+岗位",
                    "投前对照 JD 改关键词",
                ],
            },
            {
                "type": "composite",
                "blocks": [
                    {
                        "type": "card",
                        "label": "简历",
                        "title": "一页纸原则",
                        "body": "STAR 写项目、量化结果、关键词对齐 JD。先结论后细节，HR 10 秒能看懂你做了什么。",
                    },
                    {
                        "type": "summary",
                        "title": "记住",
                        "items": ["信息差就是竞争力", "少而精 > 盲目海投"],
                    },
                ],
            },
            {
                "type": "timeline",
                "title": "秋招时间线",
                "steps": [
                    {
                        "time": "7-8月",
                        "head": "提前批/实习转正",
                        "body": "同步关注头部提前批。小贴士：简历先准备 2 版，别临时改。",
                    },
                    {
                        "time": "8-9月",
                        "head": "正式批高峰",
                        "body": "每日投递 + 简历迭代。投完立刻记进度表，方便跟进。",
                    },
                    {
                        "time": "9-10月",
                        "head": "笔面并行",
                        "body": "按公司建面经库。避坑：别把所有面试挤在同一天。",
                    },
                    {
                        "time": "10-12月",
                        "head": "补录与决策",
                        "body": "Offer 比较看团队、成长和城市，不只看 base。",
                    },
                ],
            },
            {
                "type": "ending",
                "title": "收藏对照\n稳步推进",
                "desc": "信息差就是竞争力，建议收藏每周复盘一次",
                "cta": ["关注获取校招节奏提醒", "评论区报你的目标公司"],
                "tags": ["#秋招", "#校招", "#求职", "#避坑", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _intern(topic: str, author: str, avatar: str, brand: str) -> dict:
    return {
        "meta": _meta(author, avatar, brand),
        "pages": [
            {
                "type": "cover",
                "kicker": "INTERN LOG",
                "title": f"{topic}\n30天复盘",
                "subtitle": "从迷茫到能独当一面：亲测有效的四周节奏",
                "tags": ["实习", "职场", "成长"],
            },
            {
                "type": "chapter",
                "no": "01",
                "title": "为什么前 30 天最关键",
                "desc": "很多人不是能力差，是节奏乱：第一周装忙，第四周才找方向",
            },
            {
                "type": "free",
                "title": "我当时最容易踩的坑",
                "paragraphs": [
                    "把「看起来忙」当成成长：加了很多会，却说不清自己交付了什么。",
                    "转折点是开始写每日小结，并用书面方式对齐 Mentor 的验收标准。",
                ],
                "bullets": ["先问验收长什么样", "会后 5 行纪要确认"],
            },
            {
                "type": "points",
                "title": "入职 7 天行动清单",
                "intro": "封面说了「四周节奏」，先把第一周协作地图摸清",
                "items": [
                    {
                        "head": "① 协作地图",
                        "body": "记下同事职责、沟通偏好、常用工具。下次找人不用猜，效率直接上去。",
                    },
                    {
                        "head": "② 主动要文档",
                        "body": "模板与历史需求比反复问人更高效。先读再问，问题会更具体，Mentor 也更愿意帮。",
                    },
                    {
                        "head": "③ 每日小结",
                        "body": "写清：做了什么 / 学到什么 / 明天计划。两周后回头看，成长轨迹非常明显。",
                    },
                    {
                        "head": "④ 对齐 Mentor",
                        "body": "明确期望产出与评估标准。避坑：别默认「忙完就算完成」，先问验收长什么样。",
                    },
                ],
            },
            {
                "type": "timeline",
                "title": "30 天成长曲线",
                "steps": [
                    {
                        "time": "W1",
                        "head": "观察学习",
                        "body": "参会、读文档、辅助小需求。小贴士：每次会后写 5 行纪要发给相关人确认。",
                    },
                    {
                        "time": "W2",
                        "head": "独立小任务",
                        "body": "负责一个功能点梳理。先对齐范围和 Deadline，再动手，少做无用功。",
                    },
                    {
                        "time": "W3",
                        "head": "跨团队协作",
                        "body": "推动设计/开发对齐。用数据说话，比争论「我觉得」更容易推进。",
                    },
                    {
                        "time": "W4",
                        "head": "复盘输出",
                        "body": "整理成果与可复用模板，准备转正材料。把过程资产留下，比只交结果更加分。",
                    },
                ],
            },
            {
                "type": "compare",
                "title": "学生思维 vs 职场思维",
                "cols": [
                    {"head": "维度", "tone": "neutral"},
                    {"head": "学生", "tone": "neg"},
                    {"head": "职场", "tone": "pos"},
                ],
                "rows": [
                    {"label": "任务理解", "values": ["等布置再动手", "主动发现问题并提案"]},
                    {"label": "交付标准", "values": ["做完就算交差", "可复用、可度量、可交接"]},
                    {"label": "沟通方式", "values": ["口头说说容易忘", "书面留痕方便对齐"]},
                    {"label": "时间管理", "values": ["DDL 前突击", "拆里程碑提前同步风险"]},
                ],
            },
            {
                "type": "quote",
                "text": "实习的价值\n不在简历一行字，\n在于验证你适不适合。",
                "from": "个人感悟",
            },
            {
                "type": "ending",
                "title": "实习路上\n一起加油",
                "desc": "你的 30 天是怎样的？评论区交换经验",
                "cta": ["关注看更多实习干货", "建议收藏，入职第一周对照"],
                "tags": ["#实习", "#职场成长", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _study(topic: str, author: str, avatar: str, brand: str) -> dict:
    return {
        "meta": _meta(author, avatar, brand),
        "pages": [
            {
                "type": "cover",
                "kicker": "STUDY GUIDE",
                "title": f"{topic}\n高效笔记法",
                "subtitle": "亲测：3 步搭体系，比熬夜刷题更抗遗忘",
                "tags": ["学习方法", "笔记", "效率", "期末"],
            },
            {
                "type": "chapter",
                "no": "01",
                "title": "别再只会「看起来很努力」",
                "desc": "画线很多、记住很少——缺的是可调用的框架，不是时长",
            },
            {
                "type": "points",
                "title": "核心三步法",
                "intro": "承接痛点：下面三步把「输入」变成「能调用」",
                "items": [
                    {
                        "head": "① 框架先行",
                        "body": "先画骨架再填细节，避免越学越乱。打开目录标出考点层级，比直接抄笔记快很多。",
                    },
                    {
                        "head": "② 主动回忆",
                        "body": "合上书复述要点，间隔重复比连续刷题更有效。卡壳的地方才是真正该补的点。",
                    },
                    {
                        "head": "③ 费曼输出",
                        "body": "用大白话讲给别人听。讲不清就是没懂——这比自我感觉「我会了」更诚实。",
                    },
                    {
                        "head": "④ 错题回收",
                        "body": "错题只记「为什么错 + 正确思路」。考前只看这一本，比翻整本教材轻松。",
                    },
                ],
            },
            {
                "type": "timeline",
                "title": "14 天复习节奏",
                "steps": [
                    {
                        "time": "D1-3",
                        "head": "搭建框架",
                        "body": "通读目录，标注考点。小贴士：用一张纸画出章节关系，后面填充会快一倍。",
                    },
                    {
                        "time": "D4-9",
                        "head": "深度填充",
                        "body": "章节笔记 + 错题标记。每天收工前主动回忆 10 分钟，比多刷两页更值。",
                    },
                    {
                        "time": "D10-12",
                        "head": "真题冲刺",
                        "body": "限时模拟，回归薄弱点。避坑：别一边做题一边翻答案，先完整做完再对。",
                    },
                    {
                        "time": "D13-14",
                        "head": "轻量回顾",
                        "body": "只看框架与错题，保证睡眠。状态管理也是复习的一部分。",
                    },
                ],
            },
            {
                "type": "quote",
                "text": "学习的本质不是记住，\n而是能调用。",
                "from": "认知心理学",
            },
            {
                "type": "summary",
                "title": "今日回顾",
                "items": [
                    "框架 > 细节，先建骨架再填肉",
                    "主动回忆 + 间隔重复 = 高效记忆",
                    "14 天节奏：框架-填充-真题-回顾",
                    "休息也是学习，别用刷短视频当休息",
                ],
                "metrics": [
                    {"num": "3", "unit": "核心步骤"},
                    {"num": "14", "unit": "天计划"},
                ],
            },
            {
                "type": "ending",
                "title": "收藏这篇\n开始行动",
                "desc": "点赞 = 已读，收藏 = 会做",
                "cta": ["关注获取更多学习方法", "评论区说说你的复习痛点"],
                "tags": ["#学习方法", "#期末复习", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _ai_pm(topic: str, author: str, avatar: str, brand: str) -> dict:
    return {
        "meta": _meta(author, avatar, brand),
        "pages": [
            {
                "type": "cover",
                "kicker": "AI PRODUCT",
                "title": f"{topic}\n落地清单",
                "subtitle": "别先选模型：场景写不清，功能一定飘",
                "tags": ["AI产品", "产品经理", "大模型"],
            },
            {
                "type": "chapter",
                "no": "01",
                "title": "四个槽位",
                "desc": "场景 · 指标 · 交互 · 评估，写满再开工",
            },
            {
                "type": "points",
                "title": "开工前先填满",
                "items": [
                    {
                        "head": "① 场景",
                        "body": "谁在什么情境下，完成什么任务。写不出用户故事，就先别碰模型选型。",
                    },
                    {
                        "head": "② 指标",
                        "body": "成功率、时延、人工介入率怎么定义。没有指标，上线后只能靠感觉吵。",
                    },
                    {
                        "head": "③ 交互",
                        "body": "输入输出形态、失败时的兜底路径。用户卡住时，有没有一键转人工？",
                    },
                    {
                        "head": "④ 评估",
                        "body": "离线集 + 在线反馈，谁来判好坏。能评估，才能迭代，不然只能堆 prompt。",
                    },
                ],
            },
            {
                "type": "card",
                "label": "PITFALL",
                "title": "常见踩坑",
                "body": "槽位填完还不够：先选模型再找场景、忽略边界 case、没有人工兜底、用「感觉智能」当验收。把清单贴在 PRD 开头，开会少绕弯路。",
                "tips": ["先写用户故事", "定义不可用条件", "预留人工接管入口"],
            },
            {
                "type": "summary",
                "title": "开工前核对",
                "items": [
                    "场景写不清，先别碰模型选型",
                    "指标能定义，上线才吵得清楚",
                    "失败路径与人工兜底要预留",
                    "能评估，才能迭代——模型只是手段",
                ],
            },
            {
                "type": "ending",
                "title": "收藏对照\n下次开需求用",
                "desc": "把清单贴在 PRD 开头",
                "cta": ["关注 AI 产品实战笔记", "评论区丢你的场景"],
                "tags": ["#AI产品", "#产品经理", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _travel(topic: str, author: str, avatar: str, brand: str) -> dict:
    short = topic if len(topic) <= 18 else topic[:16] + "…"
    return {
        "meta": _meta(author, avatar, brand),
        "pages": [
            {
                "type": "cover",
                "kicker": "TRAVEL NOTE",
                "title": f"{short}\n白天还是夜游",
                "subtitle": "亲测对比：人流、花费、出片、体力一次看清",
                "tags": ["旅游攻略", "夜游", "避坑", "周末去哪儿"],
            },
            {
                "type": "chapter",
                "no": "01",
                "title": "时段选错，再好的攻略也白搭",
                "desc": "同样景点，白天扎堆与夜游氛围可以是两种体验",
            },
            {
                "type": "points",
                "title": "出行前先问自己",
                "intro": "先对齐目标，再看后面的一日节奏和对比表",
                "items": [
                    {
                        "head": "① 你更在意什么",
                        "body": "想打卡齐全，还是要氛围和出片？目标不同，白天/夜游的答案完全不一样。",
                    },
                    {
                        "head": "② 体力与行程密度",
                        "body": "暴走一天再夜游很容易崩。亲测：重要夜景留给精力最好的那天晚上。",
                    },
                    {
                        "head": "③ 预算怎么分配",
                        "body": "夜场票、灯光秀、夜市小吃也可能更值。别把预算全砸在白天全价门票上。",
                    },
                    {
                        "head": "④ 交通末班车",
                        "body": "夜游最大坑是回程。先查地铁/公交末班，或预留打车预算，别临时慌。",
                    },
                ],
            },
            {
                "type": "timeline",
                "title": "一日轻松节奏",
                "steps": [
                    {
                        "time": "09:00",
                        "head": "轻量热身",
                        "body": "去人少的观景点或博物馆。小贴士：热门景区尽量预约，别到门口才发现约满。",
                    },
                    {
                        "time": "13:00",
                        "head": "午后缓行",
                        "body": "留出休息和补给，别连轴转。避坑：大中午硬逛露天，下午会直接没电。",
                    },
                    {
                        "time": "17:30",
                        "head": "卡点转场",
                        "body": "赶在日落前后移动到夜游点位，黄金光线很好出片。",
                    },
                    {
                        "time": "19:30",
                        "head": "夜游主场",
                        "body": "灯光秀/夜市/河边步道任选其一做深，比打卡十个点更值得回味。",
                    },
                ],
            },
            {
                "type": "compare",
                "title": "白天 vs 夜游",
                "cols": [
                    {"head": "维度", "tone": "neutral"},
                    {"head": "白天", "tone": "neg"},
                    {"head": "夜游", "tone": "pos"},
                ],
                "rows": [
                    {"label": "人流体验", "values": ["热门点位容易扎堆排队", "光线柔和，节奏更松弛"]},
                    {"label": "出片效果", "values": ["阳光硬，阴影重难修", "灯火与氛围感更好出片"]},
                    {"label": "花费体感", "values": ["全价票+项目花费高", "夜场票/步道小吃更灵活"]},
                    {"label": "体力消耗", "values": ["暴走一天容易透支", "时段短但要盯末班车"]},
                    {"label": "适合谁", "values": ["想赶行程的打卡党", "喜欢氛围和拍照的人"]},
                ],
            },
            {
                "type": "summary",
                "title": "一句话结论",
                "items": [
                    "打卡齐全选白天，氛围出片优先夜游",
                    "精力好的晚上再上主场，别透支",
                    "先查末班车，夜游才安心",
                    "建议收藏，下次出行直接对照这张表",
                ],
            },
            {
                "type": "ending",
                "title": "收藏这张表\n下次别踩坑",
                "desc": "你更站白天还是夜游？评论区见",
                "cta": ["关注获取更多出行对照", "转发给一起纠结行程的同伴"],
                "tags": ["#旅游攻略", "#夜游", "#避坑", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _compare(topic: str, author: str, avatar: str, brand: str) -> dict:
    """对比型：cover → free → compare → composite → summary → ending"""
    return {
        "meta": _meta(author, avatar, brand),
        "outline": [
            {"intent": "钩子"},
            {"intent": "决策前置"},
            {"intent": "核心对照表"},
            {"intent": "图文混排补充"},
            {"intent": "结论"},
            {"intent": "行动"},
        ],
        "pages": [
            {
                "type": "cover",
                "kicker": "COMPARE",
                "title": f"{topic}\n怎么选",
                "subtitle": "一张表拍板：维度拆开，少纠结 30 分钟",
                "tags": ["对比", "决策", "干货"],
            },
            {
                "type": "free",
                "title": "先别急着看表",
                "paragraphs": [
                    "对比表只有在「目标写清」之后才有用。省时间、省钱，还是体验更好？先写一句。",
                    "约束（预算/时间/能力）就是筛选器，能直接砍掉一半选项。",
                ],
                "bullets": [
                    "可逆决策：小步试验即可",
                    "不可逆决策：把表做细再拍板",
                ],
            },
            {
                "type": "compare",
                "title": "关键差异对照",
                "cols": [
                    {"head": "维度", "tone": "neutral"},
                    {"head": "方案 A", "tone": "neg"},
                    {"head": "方案 B", "tone": "pos"},
                ],
                "rows": [
                    {"label": "上手成本", "values": ["门槛高，前期要熬", "更快上手，反馈更早"]},
                    {"label": "长期收益", "values": ["不确定，容易半途", "路径更清晰可积累"]},
                    {"label": "风险", "values": ["踩坑成本较大", "可小步验证更可控"]},
                    {"label": "推荐人群", "values": ["爱尝鲜、耐折腾", "要结果、时间紧的人"]},
                ],
            },
            {
                "type": "composite",
                "blocks": [
                    {
                        "type": "quote",
                        "text": "没有绝对更好，\n只有更匹配目标。",
                    },
                    {
                        "type": "free",
                        "title": "怎么用这张表",
                        "paragraphs": ["先圈出你最在意的 2 个维度，只看这两行谁胜出。"],
                        "bullets": ["拿不准就做最小验证", "别被「听起来更香」带偏"],
                    },
                ],
            },
            {
                "type": "summary",
                "title": "一句话结论",
                "items": [
                    "没有绝对更好，只有更匹配目标",
                    "先定成功标准，再看对比表",
                    "拿不准就做最小验证",
                    "建议收藏，下次纠结直接套用",
                ],
            },
            {
                "type": "ending",
                "title": "收藏这张表\n下次别纠结",
                "desc": "评论区说说你卡在哪一步",
                "cta": ["关注获取更多决策框架", "转发给正在纠结的朋友"],
                "tags": ["#对比", "#决策", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


def _general(topic: str, author: str, avatar: str, brand: str) -> dict:
    short = topic if len(topic) <= 16 else topic[:14] + "…"
    return {
        "meta": _meta(author, avatar, brand),
        "pages": [
            {
                "type": "cover",
                "kicker": "GUIDE",
                "title": f"{short}\n实用指南",
                "subtitle": "把复杂事情拆成可执行步骤，建议收藏对照",
                "tags": ["干货", "指南", "笔记"],
            },
            {
                "type": "chapter",
                "no": "01",
                "title": "先对齐目标",
                "desc": "搞清楚为谁、解决什么，再谈方法和工具",
            },
            {
                "type": "points",
                "title": "四步落地法",
                "intro": f"围绕「{topic}」可直接套用",
                "items": [
                    {
                        "head": "① 定义问题",
                        "body": "用一句话写清现状与期望差距。写不出来，说明还没想清楚，先别急着开工。",
                    },
                    {
                        "head": "② 拆成步骤",
                        "body": "每步最好能在 25 分钟内完成。步骤过大就继续拆，执行阻力会小很多。",
                    },
                    {
                        "head": "③ 做最小验证",
                        "body": "先跑通闭环，再谈优化。完美主义最常见的坑，是一直准备从不发布。",
                    },
                    {
                        "head": "④ 复盘迭代",
                        "body": "记录有效动作，删掉无效步骤。下次复用的是方法，不是一次性热情。",
                    },
                ],
            },
            {
                "type": "card",
                "label": "STRUCTURE",
                "title": "爆款图文结构",
                "body": "封面痛点 → 共鸣铺垫 → 3-5 个干货点 → 金句总结 → 行动号召。封面决定一半点击，每页只讲一个重点，系列化比单篇更容易涨粉。",
                "tips": ["标题带数字或反差", "正文要有场景和细节", "结尾给明确 CTA"],
            },
            {
                "type": "timeline",
                "title": "发布工作流",
                "steps": [
                    {
                        "time": "Step1",
                        "head": "写脚本",
                        "body": "定页数与每页核心信息。小贴士：先写封面钩子，再倒推中间页。",
                    },
                    {
                        "time": "Step2",
                        "head": "选风格",
                        "body": "匹配内容调性。干货偏简约，复盘偏文艺，别让风格抢走信息。",
                    },
                    {
                        "time": "Step3",
                        "head": "导出成图",
                        "body": "检查溢出后导出 PNG。避坑：导出前快速翻一遍，消灭截断和空表。",
                    },
                    {
                        "time": "Step4",
                        "head": "发布优化",
                        "body": "标题含关键词，标签 5-8 个。评论区抛一个问题，互动会更好。",
                    },
                ],
            },
            {
                "type": "summary",
                "title": "创作记住这几条",
                "items": [
                    "封面决定点击，每页只讲一个重点",
                    "结构：钩子 → 共鸣 → 干货 → 步骤 → 收束 → CTA",
                    "先写脚本再选风格，别让视觉抢走信息",
                    "持续发布比单篇完美更重要",
                ],
            },
            {
                "type": "ending",
                "title": "开始你的\n第一篇",
                "desc": "模板已备好，只差你的故事",
                "cta": ["一键导出你的图文", "关注获取更多创作工具"],
                "tags": ["#小红书", "#图文创作", "#建议收藏"],
                "contact": brand.lstrip("@"),
            },
        ],
    }


if __name__ == "__main__":
    import sys

    from schema import validate_and_repair

    intent = sys.argv[1] if len(sys.argv) > 1 else "秋招投递全流程指南"
    payload = build_demo_payload(intent)
    data, warnings = validate_and_repair(payload["data"])
    print(f"intent: {intent}")
    print(f"theme: {data.get('theme')}")
    print("logic_summary:")
    for line in data.get("logic_summary") or []:
        print(f"  {line}")
    print("pages (type + title + role):")
    for i, p in enumerate(data.get("pages") or []):
        if not isinstance(p, dict):
            continue
        if p.get("type") == "quote":
            title = re.sub(r"\s+", " ", str(p.get("text") or "")).strip()[:36]
        else:
            title = re.sub(r"\s+", " ", str(p.get("title") or "").replace("\n", " ")).strip()[:36]
        print(f"  {i + 1}. {p.get('type')} | {title} | {p.get('role')}")
    if warnings:
        print("warnings:")
        for w in warnings:
            print(f"  - {w}")
