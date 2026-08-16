# -*- coding: utf-8 -*-
from prompts.copy_playbook import (
    build_playbook_prompt_section,
    build_type_guidance,
    check_copy_quality,
    infer_content_type,
    load_playbook,
)


def test_playbook_loads():
    pb = load_playbook()
    assert pb.get("version")
    assert "面经" in (pb.get("content_types") or {})


def test_infer_content_type():
    assert infer_content_type("秋招产品岗面经复盘") == "面经"
    assert infer_content_type("求职避坑清单") == "清单"
    assert infer_content_type("AI产品经理干货教程") == "干货"
    assert infer_content_type("随便写写", "清单") == "清单"


def test_playbook_prompt_section():
    text = build_playbook_prompt_section()
    assert "文案 playbook" in text
    assert "content_type" in text
    assert "反模式" in text


def test_type_guidance_mianjing():
    g = build_type_guidance("面经")
    assert "面经" in g
    assert "autumn-interview-mix" in g


def test_check_copy_resume_tone():
    data = {
        "pages": [
            {
                "type": "points",
                "title": "经历",
                "items": [{"head": "项目", "body": "负责需求分析与项目经历整理"}],
            }
        ]
    }
    issues = check_copy_quality(data, title="关于面试的笔记分享", caption="短")
    msgs = " ".join(i["message"] for i in issues)
    assert "简历" in msgs or "hook" in msgs or "caption" in msgs


def test_check_copy_emoji():
    data = {"pages": [{"type": "cover", "title": "测试🔥", "subtitle": "副标题够长够信息量"}]}
    issues = check_copy_quality(data, title="正常标题够长够吸引人", caption="正文\n\n#干货")
    assert any("emoji" in i["message"] for i in issues)
