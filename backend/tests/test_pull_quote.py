# -*- coding: utf-8 -*-
from schema import _pull_quote_duplicates_paragraph, validate_and_repair


def test_pull_quote_duplicate_removed_on_repair():
    data = {
        "meta": {"author": "测试"},
        "pages": [
            {
                "type": "free",
                "title": "挂面不可怕，可怕的是不知道为什么挂",
                "layoutVariant": "pull-quote-inline",
                "paragraphs": [
                    "第一段。",
                    "面试官问的每一个问题，都指向我真正欠缺的能力。与其海投碰运气，不如先把底层打牢。",
                    "第三段。",
                ],
                "pullQuote": "面试官问的每一个问题，都指向我真正欠缺的能力。与其海投碰运气，不如先把底层打牢。",
            }
        ],
    }
    repaired, warnings = validate_and_repair(data)
    page = repaired["pages"][0]
    assert "pullQuote" not in page
    assert any("pullQuote" in w for w in warnings)


def test_pull_quote_short_excerpt_kept():
  quote = "与其海投碰运气，不如先把底层打牢"
  para = "面试官问的每一个问题，都指向我真正欠缺的能力。与其海投碰运气，不如先把底层打牢。"
  assert not _pull_quote_duplicates_paragraph(quote, para)
