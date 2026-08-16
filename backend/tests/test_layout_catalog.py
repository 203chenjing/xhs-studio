# -*- coding: utf-8 -*-
from prompts.layout_catalog import (
    apply_recipe_defaults,
    apply_recipe_slot_variants,
    build_catalog_prompt_section,
    build_variants_prompt_section,
    get_recipe,
    get_variant,
    is_valid_variant,
    list_recipes,
    list_variants_for_type,
    load_catalog,
    load_variants,
)


def test_catalog_loads():
    cat = load_catalog()
    assert cat.get("version")
    recipes = list_recipes()
    assert len(recipes) >= 25


def test_variants_load():
    v = load_variants()
    assert v.get("page_types")
    assert len(list_variants_for_type("cover")) >= 4
    assert is_valid_variant("quote", "invert-dark")
    assert not is_valid_variant("quote", "nonexistent")


def test_variants_prompt_section():
    text = build_variants_prompt_section()
    assert "layoutVariant" in text
    assert "cover:" in text


def test_catalog_prompt_includes_variants():
    text = build_catalog_prompt_section()
    assert "autumn-interview-mix" in text
    assert "单页排版变体" in text


def test_get_recipe():
    r = get_recipe("interview-star-arc")
    assert r is not None
    assert r.get("name") == "面经 STAR 叙事"
    assert get_recipe("nonexistent") is None


def test_apply_recipe_defaults_points():
    page = {"type": "points", "title": "T", "items": []}
    out = apply_recipe_defaults(page, "ledger-buying-guide")
    assert out["layoutRecipe"] == "ledger-buying-guide"
    assert out["density"] == "compact"
    assert out["pointsStyle"] == "ledger"


def test_apply_recipe_slot_variants():
    pages = [
        {"type": "cover", "title": "T"},
        {"type": "points", "title": "P", "items": []},
        {"type": "ending", "title": "E"},
    ]
    out = apply_recipe_slot_variants(pages, "tag-wall-dispatch")
    assert out[0].get("layoutVariant") == "default"
    assert out[1].get("layoutVariant") == "cards"
    assert out[2].get("layoutVariant") == "tag-wall"


def test_text_layout_variants_valid():
    assert is_valid_variant("free", "magazine-columns")
    assert is_valid_variant("card", "minimal-center")
    assert is_valid_variant("chapter", "roman-numeral")
    assert is_valid_variant("points", "pill-tags")
    assert is_valid_variant("summary", "checklist")
    assert is_valid_variant("quote", "center-hero")


def test_set_page_layout_variant_op():
    from ops import apply_page_ops

    page = {"type": "quote", "text": "金句"}
    out, applied, _ = apply_page_ops(
        page,
        [{"op": "setPageLayoutVariant", "variant": "invert-dark"}],
    )
    assert len(applied) == 1
    assert out["layoutVariant"] == "invert-dark"


def test_set_layout_recipe_op():
    from ops import apply_page_ops

    page = {"type": "points", "title": "T", "items": [{"head": "1", "body": "x"}]}
    out, applied, _ = apply_page_ops(
        page,
        [{"op": "setLayoutRecipe", "recipeId": "closing-ledger-cta"}],
    )
    assert len(applied) == 1
    assert out["layoutRecipe"] == "closing-ledger-cta"
    assert out["pointsStyle"] == "ledger"
