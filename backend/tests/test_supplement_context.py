# -*- coding: utf-8 -*-
from prompts.page_editor import SUPPLEMENT_HEADER, build_page_editor_user, supplement_context_block


def test_supplement_context_block_empty():
    assert supplement_context_block("") == ""
    assert supplement_context_block(None) == ""
    assert supplement_context_block("   ") == ""


def test_supplement_context_block_has_header():
    block = supplement_context_block("三面挂在项目细节")
    assert SUPPLEMENT_HEADER in block
    assert "三面挂在项目细节" in block
    assert "勿编造" in block


def test_build_page_editor_user_includes_supplement():
    msg = build_page_editor_user(
        instruction="标题更狠",
        page={"type": "cover", "title": "旧标题"},
        page_index=0,
        style="ins",
        theme="实习复盘",
        logic_summary=[],
        neighbors={},
        supplement_context="勿写公司全名",
    )
    assert "勿写公司全名" in msg
    assert SUPPLEMENT_HEADER in msg
