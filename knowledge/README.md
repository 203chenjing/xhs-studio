# xhs-studio 知识库

为 AI 生成管线提供可扩展的**排版菜谱**与**文案 playbook**，采用 [json-render](https://github.com/vercel-labs/json-render) 的 **catalog 模式**：LLM 从预定义规则里选型，再填内容。

## 文件

| 路径 | 用途 |
|------|------|
| `layout-recipes.json` | 27 条排版菜谱（id、页型组合、密度、变体槽、HTML 参考） |
| `page-layout-variants.json` | 13 页型 × 40 个 `layoutVariant` |
| `copywriting-playbook.json` | 标题 hook、caption 结构、面经/干货/清单语气、反模式 |
| `../backend/prompts/layout_catalog.py` | 加载排版 JSON、生成 prompt 摘要、`apply_recipe_defaults` |
| `../backend/prompts/copy_playbook.py` | 加载文案 JSON、`infer_content_type`、审核规则 |
| `../frontend/js/layout-catalog.js` | 客户端 ops 用的精简 defaults 子集 |
| `TEMPLATE-BRAINSTORM.md` | 变体矩阵与秋招面经示例 |

## 文案 playbook

### 结构

- **title_formulas**：6 种 hook（数字收益、痛点问句、反常识、亲历、清单承诺、好奇留白）
- **caption_structure**：hook → body → CTA → #话题
- **content_types**：`面经` | `干货` | `清单`（各含 tone、default_recipe、页型文案要点、密度）
- **anti_patterns**：简历腔、无 hook、页内 emoji、空洞正文、标题堆砌
- **high_score_patterns**：抽象高分结构（不抄袭具体帖子）

### AI 如何使用

1. **生成（`/api/generate`）**  
   `pipeline.SYSTEM_GENERATE` 自动追加 `build_playbook_prompt_section()`。  
   用户 JSON 含 `content_type_hint` + `copy_guidance`（由 `infer_content_type(intent)` 推断）。  
   LLM 应在 `brief.content_type` 输出品类，并按 playbook 写 title / hooks / caption / 页内文案。

2. **审核（`/api/review`）**  
   `rule_review` 合并 `check_copy_quality()`：简历腔、弱 hook、emoji、caption 过短等；`design_lint()`：版式堆字、同型连页、对比表密度等（0 LLM）。

3. **与排版联动**  
   - 面经 → `autumn-interview-mix` / `interview-star-arc`  
   - 干货 → `ledger-buying-guide`  
   - 清单 → `number-shock-listicle`  

## 排版菜谱

```json
{
  "id": "ledger-buying-guide",
  "name": "账本清单导购",
  "description": "…",
  "best_for": ["清单", "干货"],
  "arc": "list",
  "page_types": ["cover", "points", "compare", "ending"],
  "page_mix": { "cover": 1, "points": 2 },
  "density": "compact",
  "points_style": "ledger",
  "style_hint": "ins",
  "visual_notes": "…",
  "html_ref": "xhs-templates/xhs-ins.html",
  "inspired_by": ["guizang:M05"]
}
```

- **page_types / page_mix**：映射 xhs-studio 已有 type（`cover|points|timeline|compare|composite|…`），不是新渲染器。
- **html_ref**：本地 HTML 参考，主要在 `xhs-templates/`（7 套主题 × 10 种块）。
- **style_hint**：对应 `themes.py` / `style_hint` 生成字段。

## AI 如何使用

1. **生成（`/api/generate`）**  
   `pipeline.SYSTEM_GENERATE` 自动追加 `build_catalog_prompt_section()`。  
   LLM 应输出 `brief.layout_recipe`（菜谱 id），并按 `page_mix` 组 5–12 页。

2. **排版思路（`/api/page/layout-ideas`）**  
   `SYSTEM_LAYOUT_IDEAS` 附带菜谱摘要，单页改版时参考 `visual_notes`、`points_style`。

3. **字段 ops**  
   - `setPointsLayout`：`ledger` | `cards`  
   - `setLayoutRecipe`：`{ "op": "setLayoutRecipe", "recipeId": "interview-star-arc" }`  
     写入 `page.layoutRecipe` 并套用 density / pointsStyle 默认值。

## 如何扩展

1. 在 `layout-recipes.json` 的 `recipes` 数组追加一条（保持 id 唯一、kebab-case）。
2. 若新菜谱含 `points_style` 或特殊 `density`，同步更新 `frontend/js/layout-catalog.js` 的 `DEFAULTS`（仅客户端本地 ops 需要）。
3. 文案：在 `copywriting-playbook.json` 追加 hook / content_type / anti_pattern；`copy_playbook.py` 动态读取，无需改 `pipeline.py`。
4. 排版：无需改 `pipeline.py`：catalog 段落由 `layout_catalog.py` 动态读取。
5. 跑校验：
   ```powershell
   cd xhs-studio/backend
   python -m py_compile prompts/layout_catalog.py prompts/copy_playbook.py pipeline.py review.py ops.py
   python -m pytest tests/test_layout_catalog.py tests/test_copy_playbook.py tests/test_ops_paths.py -q
   node --check ../frontend/js/ops.js
   node --check ../frontend/js/layout-catalog.js
   ```

## 参考来源

| 项目 | 借鉴点 |
|------|--------|
| [op7418/guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill) | Editorial/Swiss 28 骨架 → 精选为 15 条 xhs-studio 菜谱 |
| [comeonzhj/Auto-Redbook-Skills](https://github.com/comeonzhj/Auto-Redbook-Skills) | 8 主题、4 种分页模式、cover+card 结构 |
| [bozhouDev/xhs-article-to-images](https://github.com/bozhouDev/xhs-article-to-images) | 封面/清单/对比/金句页型 |
| [vercel-labs/json-render](https://github.com/vercel-labs/json-render) | Catalog 约束生成 |
| [adjfks/write-xiaohongshu](https://github.com/adjfks/write-xiaohongshu) | 标题公式、正文分段 → `copywriting-playbook.json` |
| [testany-io/xiaohongshu-guide](https://github.com/testany-io/xiaohongshu-guide) | 爆款结构、收藏动机 |
| 本地 `xhs-templates/*.html` | 7 套视觉与 DATA schema 样例 |

## 本地 HTML 索引

- `xhs-templates/xhs-ins.html` — 简约 INS
- `xhs-templates/xhs-literary.html` — 文艺衬线
- `xhs-templates/xhs-orange.html` — 工业橙
- `xhs-templates/xhs-bold-signal.html` — 暗色信号
- `xhs-templates/xhs-terminal.html` — 终端绿
- `xhs-templates/xhs-brutalist.html` — 粗野主义
- `xhs-templates/xhs-botanical.html` — 植物金饰

简历目录下另有 `resume-tailor/*.html` 等单页简历预览，不作为 xhs 画布模板，但可作文案密度参考。
