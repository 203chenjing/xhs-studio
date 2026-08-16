# -*- coding: utf-8 -*-
"""patchPath + composite list paths for page ops."""
from __future__ import annotations

import copy

from ops import _get_at_path, _parse_path, _set_at_path, apply_page_ops


def test_parse_path_blocks():
    assert _parse_path("blocks[0].items[1].head") == ["blocks", 0, "items", 1, "head"]


def test_set_at_path_blocks_title():
    page = {"type": "composite", "blocks": [{"type": "points", "title": "旧"}]}
    _set_at_path(page, "blocks[0].title", "新标题")
    assert page["blocks"][0]["title"] == "新标题"


def test_patch_path_op():
    page = {
        "type": "composite",
        "blocks": [{"type": "points", "title": "A", "items": [{"head": "1", "body": "x"}]}],
    }
    out, applied, _ = apply_page_ops(
        page, [{"op": "patchPath", "path": "blocks[0].title", "value": "B"}]
    )
    assert len(applied) == 1
    assert out["blocks"][0]["title"] == "B"


def test_delete_item_nested_list_path():
    page = {
        "type": "composite",
        "blocks": [
            {
                "type": "points",
                "title": "T",
                "items": [{"head": "1", "body": "a"}, {"head": "2", "body": "b"}],
            }
        ],
    }
    out, applied, _ = apply_page_ops(
        copy.deepcopy(page),
        [{"op": "deleteItem", "listPath": "blocks[0].items", "index": 2}],
    )
    assert len(applied) == 1
    assert len(out["blocks"][0]["items"]) == 1
    assert out["blocks"][0]["items"][0]["head"] == "1"


def test_move_item_nested_list_path():
    page = {
        "type": "composite",
        "blocks": [
            {
                "type": "summary",
                "title": "S",
                "items": ["一", "二", "三"],
            }
        ],
    }
    out, applied, _ = apply_page_ops(
        copy.deepcopy(page),
        [{"op": "moveItem", "listPath": "blocks[0].items", "from": 1, "to": 3}],
    )
    assert len(applied) == 1
    assert out["blocks"][0]["items"] == ["二", "三", "一"]


def test_set_points_layout_op():
    page = {
        "type": "points",
        "title": "要点",
        "items": [{"head": "1", "body": "a"}, {"head": "2", "body": "b"}],
    }
    out, applied, _ = apply_page_ops(
        copy.deepcopy(page),
        [{"op": "setPointsLayout", "layout": "ledger"}],
    )
    assert len(applied) == 1
    assert out["pointsStyle"] == "ledger"
    assert out["style"]["pointsStyle"] == "ledger"


def test_get_at_path_missing():
    assert _get_at_path({"blocks": []}, "blocks[0].title") is None
