# -*- coding: utf-8 -*-
"""page revise delete / bridge parsing."""
from __future__ import annotations

from pipeline import (
    _apply_delete_sentence,
    _parse_revise_input,
    _rule_ops_resolvable,
)


def _quote_page() -> dict:
    return {
        "type": "quote",
        "text": "与其海投碰运气，不如先把底层打牢",
        "bridge": "接上页「给同样在准备AI产品面试的你」",
        "role": "金句",
    }


def test_parse_trailing_delete_on_bridge():
    instr = "接上页「给同样在准备AI产品面试的你」 删除"
    page = _quote_page()
    clean, pasted = _parse_revise_input(instr, page)
    assert clean == instr
    assert pasted == "接上页「给同样在准备AI产品面试的你」"


def test_delete_bridge_via_rules_fallback():
    page = _quote_page()
    instr = "接上页「给同样在准备AI产品面试的你」 删除"
    clean, pasted = _parse_revise_input(instr, page)
    ok, ruled, applied, summary = _rule_ops_resolvable(page, clean, pasted, [], "copy")
    assert ok is True
    assert ruled is not None
    assert "bridge" not in ruled or not str(ruled.get("bridge") or "").strip()
    assert ruled.get("text") == page["text"]


def test_apply_delete_sentence_keeps_quote_text():
    page = _quote_page()
    instr = "接上页「给同样在准备AI产品面试的你」 删除"
    clean, pasted = _parse_revise_input(instr, page)
    out, summary = _apply_delete_sentence(page, clean, pasted)
    assert out is not None
    assert not str(out.get("bridge") or "").strip()
    assert out.get("text") == page["text"]
    assert "已删除" in summary
