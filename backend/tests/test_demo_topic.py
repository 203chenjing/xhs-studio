# -*- coding: utf-8 -*-
"""Demo 主题词：封面大标题必须短，否则 108px 字号会撑破 3:4 画布。"""
from demo import _topic_from_intent


def test_intent_with_colon_uses_first_clause():
    intent = "写一套秋招投递避坑清单：投递前自查、简历常见问题、面试跟进三个部分，语气真诚，适合收藏"
    assert _topic_from_intent(intent) == "秋招投递避坑清单"


def test_long_single_clause_is_capped():
    intent = "帮我总结一下我在大厂实习三个月里踩过的所有坑和复盘方法以及给后来人的建议"
    topic = _topic_from_intent(intent)
    assert len(topic) <= 16
    assert topic


def test_leading_verbs_are_stripped():
    assert _topic_from_intent("写一篇 实习第一周怎么破冰") == "实习第一周怎么破冰"


def test_empty_intent_falls_back():
    assert _topic_from_intent("   ") == "小红书干货笔记"


def test_topic_is_safe_for_cover_title():
    """封面标题 = topic + 换行 + 栏目词，总长度应能稳定排进 2–3 行。"""
    topic = _topic_from_intent("写一套秋招投递避坑清单：投递前自查、简历常见问题、面试跟进")
    assert len(topic + "\n行动清单") <= 20
