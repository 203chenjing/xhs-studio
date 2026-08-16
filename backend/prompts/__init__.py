# -*- coding: utf-8 -*-
"""Prompt packs for xhs-studio pipelines."""

from .copy_playbook import (
    build_playbook_prompt_section,
    build_type_guidance,
    check_copy_quality,
    infer_content_type,
    list_content_types,
    load_playbook,
)
from .layout_catalog import (
    apply_recipe_defaults,
    apply_recipe_slot_variants,
    build_catalog_prompt_section,
    build_recipe_hint,
    build_variants_prompt_section,
    get_recipe,
    get_variant,
    is_valid_variant,
    list_recipes,
    list_variants_for_type,
    load_catalog,
    load_variants,
)
from .page_editor import (
    SYSTEM_PAGE_EDITOR,
    STYLE_VOICE,
    build_page_editor_user,
    few_shot_block,
)

__all__ = [
    "SYSTEM_PAGE_EDITOR",
    "STYLE_VOICE",
    "build_page_editor_user",
    "few_shot_block",
    "load_playbook",
    "list_content_types",
    "infer_content_type",
    "build_playbook_prompt_section",
    "build_type_guidance",
    "check_copy_quality",
    "load_catalog",
    "load_variants",
    "list_recipes",
    "list_variants_for_type",
    "get_recipe",
    "get_variant",
    "is_valid_variant",
    "build_catalog_prompt_section",
    "build_variants_prompt_section",
    "build_recipe_hint",
    "apply_recipe_defaults",
    "apply_recipe_slot_variants",
]
