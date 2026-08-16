# -*- coding: utf-8 -*-
"""Normalize and rule-assign image URLs into page DATA."""
from __future__ import annotations

from copy import deepcopy
from typing import Any
from urllib.parse import urlparse


MAX_IMAGES = 9


def normalize_image_urls(urls: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for u in urls or []:
        s = str(u or "").strip()
        if not s or s in seen:
            continue
        # allow same-origin /uploads/... or data:/http(s)
        if s.startswith("/uploads/") or s.startswith("data:image/") or s.startswith("http://") or s.startswith("https://"):
            out.append(s)
            seen.add(s)
        elif s.startswith("uploads/"):
            out.append("/" + s)
            seen.add("/" + s)
        if len(out) >= MAX_IMAGES:
            break
    return out


def _collect_used(pages: list[dict]) -> set[str]:
    used: set[str] = set()
    for p in pages:
        if not isinstance(p, dict):
            continue
        img = p.get("image")
        if isinstance(img, str) and img.strip():
            used.add(img.strip())
        for u in p.get("images") or []:
            if isinstance(u, str) and u.strip():
                used.add(u.strip())
    return used


def assign_images_to_pages(data: dict[str, Any], image_urls: list[str] | None) -> dict[str, Any]:
    """
    Ensure uploaded images appear in pages.
    - First unused URL → cover.image
    - Next → existing card/points without image
    - Rest → insert photo / gallery pages before ending
    Idempotent: already-placed URLs are skipped.
    """
    urls = normalize_image_urls(image_urls)
    if not urls:
        return data

    out = deepcopy(data)
    pages = out.get("pages")
    if not isinstance(pages, list):
        pages = []
        out["pages"] = pages

    used = _collect_used(pages)
    pending = [u for u in urls if u not in used]
    if not pending:
        return out

    # Cover hero
    cover = next((p for p in pages if isinstance(p, dict) and p.get("type") == "cover"), None)
    if cover is not None and not (isinstance(cover.get("image"), str) and cover["image"].strip()):
        cover["image"] = pending.pop(0)
        used.add(cover["image"])

    # Attach to existing content pages
    for p in pages:
        if not pending:
            break
        if not isinstance(p, dict):
            continue
        t = p.get("type")
        if t in ("card", "points") and not (isinstance(p.get("image"), str) and p["image"].strip()):
            p["image"] = pending.pop(0)

    if not pending:
        return out

    # 插在干货中后段：最后一个 points/timeline/card/compare/composite 之后，
    # summary/quote/ending 之前；避免紧贴封面打断叙事。
    dry = {"points", "timeline", "card", "compare", "composite"}
    closing = {"summary", "quote", "ending"}
    last_dry = -1
    first_close = -1
    ending_at = len(pages)
    for i, p in enumerate(pages):
        if not isinstance(p, dict):
            continue
        t = p.get("type")
        if t in dry:
            last_dry = i
        if t in closing and first_close < 0:
            first_close = i
        if t == "ending":
            ending_at = i
            break
    if last_dry >= 0:
        insert_at = last_dry + 1
    elif first_close >= 0:
        insert_at = first_close
    else:
        insert_at = ending_at
    if insert_at <= 1 and any(
        isinstance(p, dict) and p.get("type") in dry for p in pages
    ):
        for i, p in enumerate(pages):
            if isinstance(p, dict) and p.get("type") in dry:
                insert_at = i + 1
                break

    extras: list[dict] = []
    while pending:
        if len(pending) >= 3:
            batch = pending[:4]
            pending = pending[4:]
            extras.append({
                "type": "gallery",
                "title": "精选图集",
                "images": batch,
                "caption": "承接上文干货，用实拍把方法看清楚",
            })
        else:
            u = pending.pop(0)
            extras.append({
                "type": "photo",
                "title": "配图瞬间",
                "body": "真实场景对照，方便按上文步骤执行",
                "image": u,
            })

    pages[insert_at:insert_at] = extras
    # hard cap page count
    if len(pages) > 12:
        # keep cover + ending priority: drop from middle extras if needed
        head, tail = pages[:1], pages[-1:]
        mid = pages[1:-1]
        non_media = [p for p in mid if not (
            isinstance(p, dict) and p.get("type") in ("photo", "gallery")
        )]
        media = [p for p in mid if isinstance(p, dict) and p.get("type") in ("photo", "gallery")]
        budget = 10
        kept = non_media[:budget]
        room = budget - len(kept)
        if room > 0:
            kept.extend(media[:room])
        out["pages"] = head + kept + tail
    return out


def is_safe_upload_url(url: str) -> bool:
    """Reject path traversal; allow /uploads/{file} or /uploads/{session}/{file}."""
    s = (url or "").strip()
    if not s.startswith("/uploads/"):
        return False
    rest = s[len("/uploads/") :]
    if not rest or ".." in rest or "\\" in rest or rest.startswith("/"):
        return False
    parts = [p for p in rest.split("/") if p]
    if len(parts) == 1:
        return "." in parts[0] and all(c.isalnum() or c in "._-" for c in parts[0])
    if len(parts) == 2:
        sess, name = parts
        return (
            len(sess) >= 8
            and all(c.isalnum() or c in "-_" for c in sess)
            and "." in name
            and all(c.isalnum() or c in "._-" for c in name)
        )
    return False


def basename_ok(filename: str) -> str | None:
    """Return lowercased safe extension or None."""
    name = (filename or "").strip().lower()
    if "." not in name:
        return None
    ext = "." + name.rsplit(".", 1)[-1]
    if ext in {".jpg", ".jpeg", ".png", ".webp"}:
        return ".jpg" if ext == ".jpeg" else ext
    return None


def host_ok_for_absolute(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False
