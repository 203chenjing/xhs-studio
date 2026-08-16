# -*- coding: utf-8 -*-
from design_lint import design_lint, lint_page
from review import rule_review


def _minimal_data(pages):
    return {"pages": pages}


def test_pull_quote_duplicate():
    pages = [
        {
            "type": "free",
            "title": "复盘",
            "paragraphs": ["面试官问：你最大的缺点是什么？我说太追求完美。"],
            "pullQuote": "面试官问：你最大的缺点是什么？我说太追求完美。",
        }
    ]
    findings = lint_page(pages[0], 0)
    codes = [f["code"] for f in findings]
    assert "pull_quote_duplicate" in codes
    assert all(f["category"] == "layout" for f in findings)


def test_same_type_run():
    pages = [{"type": "points", "title": f"P{i}", "items": [{"head": "a", "body": "body long enough"}]} for i in range(5)]
    findings = design_lint(_minimal_data(pages))
    assert any(f["code"] == "same_type_run" for f in findings)
    run = next(f for f in findings if f["code"] == "same_type_run")
    assert run["page_index"] == 3
    assert run["severity"] == "warn"


def test_timeline_error_at_eight_steps():
    steps = [{"title": f"S{i}", "body": "一步说明"} for i in range(9)]
    findings = lint_page({"type": "timeline", "title": "流程", "steps": steps}, 2)
    tl = [f for f in findings if f["code"] == "timeline_too_many_steps"]
    assert len(tl) == 1
    assert tl[0]["severity"] == "error"
    assert tl[0]["page_index"] == 2


def test_rule_review_merges_layout_issues():
    data = _minimal_data(
        [
            {"type": "cover", "title": "秋招产品面经", "subtitle": "27届上岸复盘与避坑清单"},
            {"type": "quote", "text": "短金句", "layoutVariant": "sidebar"},
            {
                "type": "free",
                "title": "经历",
                "paragraphs": ["同一段话重复出现。"],
                "pullQuote": "同一段话重复出现。",
            },
            {"type": "ending", "cta": ["收藏"], "tags": ["秋招", "面经", "产品"]},
        ]
    )
    out = rule_review(
        data,
        title="秋招产品面经复盘：三面通关笔记",
        caption="复盘我的秋招产品面试经历，从简历到终面全流程。\n\n#秋招 #产品经理 #面经",
    )
    issues = out["issues"]
    layout = [i for i in issues if i.get("category") == "layout"]
    copy = [i for i in issues if i.get("category") != "layout"]
    assert layout
    assert copy
    assert any(i.get("code") == "pull_quote_duplicate" for i in layout)
    assert any(i.get("code") == "quote_sidebar_short_text" for i in layout)
    assert out["verdict"] in ("warn", "pass", "fail")
