# -*- coding: utf-8 -*-
"""Structured page/document ops — shared with frontend ops.js."""
from __future__ import annotations

from copy import deepcopy
import re
from typing import Any

from prompts.layout_catalog import apply_recipe_defaults, get_recipe, is_valid_variant
from pipeline import (  # noqa: F401 — reuse fallbacks & helpers
    _PAGE_TYPES,
    _REWRITE_FIELDS,
    _apply_page_density,
    _clone_page,
    _fallback_compact_points,
    _fallback_to_card,
    _fallback_to_free_quote,
    _fallback_to_timeline,
    _list_key_for_page,
    _mark_user_edited,
    _summary_from_ops,
)


def _parse_path(path: str) -> list:
    parts: list = []
    for m in re.finditer(r"([^.\[\]]+)|\[(\d+)\]", str(path or "")):
        if m.group(1):
            parts.append(m.group(1))
        else:
            parts.append(int(m.group(2)))
    return parts


def _get_at_path(obj: Any, path: str) -> Any:
    cur = obj
    for p in _parse_path(path):
        if cur is None:
            return None
        if isinstance(cur, list) and isinstance(p, int):
            if p < 0 or p >= len(cur):
                return None
            cur = cur[p]
        elif isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
    return cur


def _set_at_path(obj: Any, path: str, value: Any) -> None:
    parts = _parse_path(path)
    if not parts:
        return
    cur = obj
    for i, p in enumerate(parts[:-1]):
        nxt = parts[i + 1]
        if isinstance(cur, list) and isinstance(p, int):
            while len(cur) <= p:
                cur.append([] if isinstance(nxt, int) else {})
            child = cur[p]
        else:
            child = cur.get(p) if isinstance(cur, dict) else None
        if child is None or not isinstance(child, (dict, list)):
            child = [] if isinstance(nxt, int) else {}
            if isinstance(cur, list) and isinstance(p, int):
                cur[p] = child
            elif isinstance(cur, dict):
                cur[p] = child
        cur = child
    last = parts[-1]
    if isinstance(cur, list) and isinstance(last, int):
        while len(cur) <= last:
            cur.append(None)
        cur[last] = value
    elif isinstance(cur, dict):
        cur[last] = value


def _list_path_spec(op: dict[str, Any]) -> tuple[str, bool] | None:
    lp = str(op.get("listPath") or "").strip()
    if lp:
        return lp, True
    lst = str(op.get("list") or "").strip()
    if lst:
        return lst, "[" in lst
    return None


def _read_list(page: dict, spec: tuple[str, bool]) -> list | None:
    path, nested = spec
    if nested:
        val = _get_at_path(page, path)
        return list(val) if isinstance(val, list) else None
    val = page.get(path)
    return list(val) if isinstance(val, list) else None


def _write_list(page: dict, spec: tuple[str, bool], items: list) -> None:
    path, nested = spec
    if nested:
        _set_at_path(page, path, items)
    else:
        page[path] = items


def _normalize_op(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    name = str(raw.get("op") or "").strip()
    allowed = {
        "setDensity",
        "setFontScale",
        "rewriteField",
        "deleteItem",
        "updateItem",
        "insertItem",
        "moveItem",
        "setPageType",
        "setPointsLayout",
        "setPageLayoutVariant",
        "setLayoutRecipe",
        "setImage",
        "setImageFocus",
        "patchPath",
    }
    if name not in allowed:
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
    elif name in ("deleteItem", "updateItem", "insertItem"):
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
        lp = str(raw.get("listPath") or "").strip()
        if lp:
            out["listPath"] = lp
        if name == "insertItem":
            out["item"] = raw.get("item")
        if name == "updateItem":
            for k in ("head", "body", "value", "text", "time", "label"):
                if k in raw and raw[k] is not None:
                    out[k] = str(raw[k])
            try:
                vi = int(raw.get("valueIndex"))
                if vi >= 1:
                    out["valueIndex"] = vi
            except (TypeError, ValueError):
                pass
    elif name == "moveItem":
        try:
            fr = int(raw.get("from"))
            to = int(raw.get("to"))
        except (TypeError, ValueError):
            return None
        if fr < 1 or to < 1:
            return None
        out["from"] = fr
        out["to"] = to
        lst = str(raw.get("list") or "").strip()
        if lst:
            out["list"] = lst
        lp = str(raw.get("listPath") or "").strip()
        if lp:
            out["listPath"] = lp
    elif name == "patchPath":
        p = str(raw.get("path") or "").strip()
        if not p:
            return None
        out["path"] = p
        out["value"] = raw.get("value")
    elif name == "setImage":
        out["slot"] = str(raw.get("slot") or "image")
        out["url"] = str(raw.get("url") or "")
        if raw.get("focus"):
            out["focus"] = raw["focus"]
    elif name == "setImageFocus":
        out["slot"] = str(raw.get("slot") or "image")
        try:
            out["x"] = max(0, min(100, float(raw.get("x", 50))))
            out["y"] = max(0, min(100, float(raw.get("y", 50))))
        except (TypeError, ValueError):
            out["x"] = 50
            out["y"] = 50
    elif name == "setPageType":
        t = str(raw.get("type") or "").strip()
        if t not in _PAGE_TYPES:
            return None
        out["type"] = t
    elif name == "setPointsLayout":
        layout = str(raw.get("layout") or "").lower()
        if layout not in ("ledger", "cards"):
            return None
        out["layout"] = layout
    elif name == "setPageLayoutVariant":
        variant = str(raw.get("variant") or raw.get("layoutVariant") or "").strip()
        if not variant:
            return None
        out["variant"] = variant
    elif name == "setLayoutRecipe":
        rid = str(raw.get("recipeId") or "").strip()
        if not rid or not get_recipe(rid):
            return None
        out["recipeId"] = rid
    return out


def apply_page_ops(
    page: dict, ops: list[dict[str, Any]]
) -> tuple[dict, list[dict[str, Any]], str]:
    out = _clone_page(page) if isinstance(page, dict) else {"type": "card", "title": "内容", "body": ""}
    applied: list[dict[str, Any]] = []
    for raw in ops or []:
        op = _normalize_op(raw)
        if not op:
            continue
        name = op["op"]
        if name == "setDensity":
            out = _apply_page_density(out, op["density"])
            op = {**op, "fontScale": out.get("fontScale")}
        elif name == "setFontScale":
            fs = op["fontScale"]
            out["fontScale"] = fs
            dens = str(out.get("density") or "normal")
            if fs <= 0.9:
                dens = "compact"
            elif fs >= 1.1:
                dens = "airy"
            out["density"] = dens
            style = out.get("style") if isinstance(out.get("style"), dict) else {}
            out["style"] = {**style, "density": dens, "fontScale": fs}
            op = {**op, "density": dens}
        elif name == "rewriteField":
            out[op["field"]] = op["value"]
        elif name == "patchPath":
            _set_at_path(out, op["path"], op["value"])
        elif name == "deleteItem":
            spec = _list_path_spec(op)
            if not spec:
                key = _list_key_for_page(out)
                if not key:
                    continue
                spec = (key, False)
            items = _read_list(out, spec)
            if items is None:
                continue
            idx = int(op["index"])
            if not (1 <= idx <= len(items)):
                continue
            items = items[: idx - 1] + items[idx:]
            _write_list(out, spec, items)
        elif name == "insertItem":
            spec = _list_path_spec(op)
            if not spec:
                key = _list_key_for_page(out)
                if not key:
                    continue
                spec = (key, False)
            items = _read_list(out, spec) or []
            idx = min(int(op["index"]), len(items) + 1)
            tail = spec[0].split(".")[-1] if spec[1] else spec[0]
            item = op.get("item") or (
                {"head": "新条目", "body": ""} if tail in ("items", "steps", "tips") else "新条目"
            )
            items = items[: idx - 1] + [item] + items[idx - 1 :]
            _write_list(out, spec, items)
        elif name == "moveItem":
            spec = _list_path_spec(op)
            if not spec:
                key = _list_key_for_page(out)
                if not key:
                    continue
                spec = (key, False)
            items = _read_list(out, spec)
            if items is None:
                continue
            fr = int(op["from"]) - 1
            to = int(op["to"]) - 1
            if not (0 <= fr < len(items) and 0 <= to < len(items)):
                continue
            moved = items.pop(fr)
            items.insert(to, moved)
            _write_list(out, spec, items)
        elif name == "updateItem":
            spec = _list_path_spec(op)
            if not spec:
                key = _list_key_for_page(out)
                if not key:
                    continue
                spec = (key, False)
            items = _read_list(out, spec)
            if items is None:
                continue
            idx = int(op["index"])
            if not (1 <= idx <= len(items)):
                continue
            cur = items[idx - 1]
            new_text = op.get("body") or op.get("value") or op.get("text")
            if isinstance(cur, dict):
                nxt = {**cur}
                for k in ("head", "body", "value", "text", "time", "label"):
                    if op.get(k) is not None:
                        nxt[k] = op[k]
                vi_raw = op.get("valueIndex")
                if vi_raw is not None:
                    try:
                        vi = int(vi_raw) - 1
                    except (TypeError, ValueError):
                        vi = -1
                    if vi >= 0:
                        vals = list(nxt.get("values") or [])
                        while len(vals) <= vi:
                            vals.append("")
                        cell_val = op.get("value")
                        if cell_val is None:
                            cell_val = new_text
                        if cell_val is not None:
                            vals[vi] = str(cell_val)
                        nxt["values"] = vals
                if new_text is not None and op.get("body") is None and op.get("value") is None and op.get("text") is None and vi_raw is None:
                    tail = spec[0].split(".")[-1] if spec[1] else spec[0]
                    if "body" in cur or tail in ("items", "steps", "tips"):
                        nxt["body"] = new_text
                    elif "text" in cur:
                        nxt["text"] = new_text
                    else:
                        nxt["body"] = new_text
                items[idx - 1] = nxt
            else:
                items[idx - 1] = new_text if new_text is not None else cur
            _write_list(out, spec, items)
        elif name == "setImage":
            slot = op.get("slot") or "image"
            if isinstance(slot, str) and slot.startswith("images["):
                import re

                m = re.match(r"images\[(\d+)\]", slot)
                if m:
                    i = int(m.group(1))
                    imgs = list(out.get("images") or [])
                    while len(imgs) <= i:
                        imgs.append("")
                    imgs[i] = op["url"]
                    out["images"] = imgs
            else:
                out["image"] = op["url"]
            if op.get("focus"):
                out["imageFocus"] = op["focus"]
        elif name == "setImageFocus":
            out["imageFocus"] = {"x": op["x"], "y": op["y"]}
        elif name == "setPageType":
            new_type = op["type"]
            if new_type != out.get("type"):
                if new_type == "timeline":
                    out = _fallback_to_timeline(out)
                elif new_type == "points":
                    out = _fallback_compact_points(out)
                elif new_type == "quote":
                    out = _fallback_to_free_quote(out)
                    out["type"] = "quote"
                elif new_type == "card":
                    out = _fallback_to_card(out)
                elif new_type == "free":
                    out = _fallback_to_free_quote(out)
                    out["type"] = "free"
                else:
                    out["type"] = new_type
            else:
                out["type"] = new_type
        elif name == "setPointsLayout":
            if out.get("type") != "points":
                continue
            layout = op["layout"]
            out["pointsStyle"] = layout
            style = out.get("style") if isinstance(out.get("style"), dict) else {}
            out["style"] = {**style, "pointsStyle": layout}
            out["layoutVariant"] = layout
            out["style"]["layoutVariant"] = layout
        elif name == "setPageLayoutVariant":
            ptype = str(out.get("type") or "")
            variant = op["variant"]
            if not ptype or not is_valid_variant(ptype, variant):
                continue
            out["layoutVariant"] = variant
            style = out.get("style") if isinstance(out.get("style"), dict) else {}
            out["style"] = {**style, "layoutVariant": variant}
            if ptype == "points" and variant in ("cards", "ledger"):
                out["pointsStyle"] = variant
                out["style"]["pointsStyle"] = variant
        elif name == "setLayoutRecipe":
            out = apply_recipe_defaults(out, op["recipeId"])
        applied.append(op)
    out = _mark_user_edited(out)
    summary = _summary_from_ops(applied)
    return out, applied, summary


def _blank_page(page_type: str | None = None) -> dict[str, Any]:
    t = page_type or "card"
    templates: dict[str, dict[str, Any]] = {
        "cover": {"type": "cover", "title": "新封面", "subtitle": "副标题"},
        "ending": {"type": "ending", "title": "结尾", "desc": "行动号召", "cta": ["收藏备用"]},
        "points": {"type": "points", "title": "要点", "items": [{"head": "1", "body": "内容"}]},
        "timeline": {"type": "timeline", "title": "步骤", "steps": [{"time": "Day1", "head": "步骤", "body": "说明"}]},
        "card": {"type": "card", "title": "卡片", "body": "正文"},
        "quote": {"type": "quote", "text": "金句"},
        "compare": {
            "type": "compare",
            "title": "对比",
            "cols": [{"head": "维度"}, {"head": "A", "tone": "neg"}, {"head": "B", "tone": "pos"}],
            "rows": [{"label": "项", "values": ["", ""]}],
        },
        "summary": {"type": "summary", "title": "总结", "items": ["要点一"]},
        "free": {"type": "free", "title": "展开", "paragraphs": ["正文"]},
        "photo": {"type": "photo", "title": "配图", "body": "说明"},
        "gallery": {"type": "gallery", "title": "图集", "images": []},
    }
    return deepcopy(templates.get(t, templates["card"]))


def apply_document_ops(data: dict, ops: list[dict[str, Any]]) -> tuple[dict, list[dict[str, Any]]]:
    out = deepcopy(data) if isinstance(data, dict) else {"meta": {}, "pages": []}
    if not isinstance(out.get("pages"), list):
        out["pages"] = []
    applied: list[dict[str, Any]] = []
    for raw in ops or []:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("op") or "")
        if name == "movePage":
            try:
                fr = int(raw.get("from")) - 1
                to = int(raw.get("to")) - 1
            except (TypeError, ValueError):
                continue
            pages = out["pages"]
            if not (0 <= fr < len(pages) and 0 <= to < len(pages)):
                continue
            p = pages.pop(fr)
            pages.insert(to, p)
            applied.append(raw)
        elif name == "duplicatePage":
            try:
                idx = int(raw.get("index")) - 1
            except (TypeError, ValueError):
                continue
            pages = out["pages"]
            if not (0 <= idx < len(pages)) or len(pages) >= 12:
                continue
            pages.insert(idx + 1, _mark_user_edited(deepcopy(pages[idx])))
            applied.append(raw)
        elif name == "insertPage":
            try:
                idx = int(raw.get("index")) - 1
            except (TypeError, ValueError):
                continue
            pg = raw.get("page") or _blank_page(str(raw.get("type") or "card"))
            at = max(0, min(idx + 1, len(out["pages"])))
            out["pages"].insert(at, _mark_user_edited(pg))
            applied.append(raw)
        elif name == "deletePage":
            try:
                idx = int(raw.get("index")) - 1
            except (TypeError, ValueError):
                continue
            pages = out["pages"]
            if not (0 <= idx < len(pages)):
                continue
            t = pages[idx].get("type")
            if t in ("cover", "ending"):
                if sum(1 for p in pages if p.get("type") == t) <= 1:
                    continue
            pages.pop(idx)
            applied.append(raw)
    return out, applied
