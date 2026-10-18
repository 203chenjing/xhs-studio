# -*- coding: utf-8 -*-
"""Demo 也要消费用户上传的图片：1 张 → photo，多张 → gallery。"""
from demo import build_demo_payload


def _pages(payload):
    return payload["data"]["pages"]


def test_single_image_creates_photo_page():
    payload = build_demo_payload("写一套秋招投递避坑清单", image_urls=["/uploads/s/a.jpg"])
    pages = _pages(payload)
    photos = [p for p in pages if p.get("type") == "photo"]
    assert len(photos) == 1
    assert photos[0]["image"] == "/uploads/s/a.jpg"
    assert pages[-1]["type"] == "ending"


def test_multiple_images_create_gallery_page():
    urls = ["/uploads/s/a.jpg", "/uploads/s/b.jpg", "/uploads/s/c.jpg"]
    payload = build_demo_payload("写一套秋招投递避坑清单", image_urls=urls)
    pages = _pages(payload)
    galleries = [p for p in pages if p.get("type") == "gallery"]
    assert len(galleries) == 1
    assert galleries[0]["images"] == urls
    # gallery 插在结尾页之前
    assert pages[-1]["type"] == "ending"


def test_no_image_no_media_page():
    payload = build_demo_payload("写一套秋招投递避坑清单")
    types = [p.get("type") for p in _pages(payload)]
    assert "photo" not in types
    assert "gallery" not in types
