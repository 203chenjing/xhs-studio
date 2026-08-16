# xhs-studio 模板脑暴笔记

> 基于真实小红书爆款图文结构 + 本地 `xhs-templates` 七套主题 + `page-layout-variants.json` 变体库。画布 1080×1440，生成内容无 emoji。

## 一、真实爆款结构（调研摘要）

| 爆款类型 | 典型页序 | 小红书常见手法 | xhs-studio 映射 |
|---------|---------|---------------|----------------|
| 干货合集 | 封面→分点×N→总结→结尾 | 数字标题、清单体、收藏引导 | `number-shock` + `numbered-pill`/`ledger` + `checklist-cards` |
| 避坑排雷 | 封面→坑点清单→对比→正确做法 | 紧张感开头、后果说明 | `question-hook` + `ledger` + `swipe-before-after` |
| 教程攻略 | 封面→步骤→注意事项 | 第一步/第二步分段 | `horizontal-steps` / `vertical-rail` |
| 对比测评 | 封面→维度表→建议 | A vs B、before/after | `swipe-before-after` + `two-col` |
| 个人故事/面经 | 封面→经历→转折金句→收束 | STAR、面试官原话 | `number-ladder` + `invert-dark` + `metrics-tower` |
| 杂志干货 | 封面左右分栏→内页分栏 | 左文右图、冷色调高级 | `magazine` + `split-column` |

参考：红薯编辑器 6 大模版、妙妙经验网「杂志风/上下拼图/全屏长图」、海鲸 AI 教程「钩子+干货+收尾」。

## 二、变体矩阵（按页型）

| 页型 | 变体数 | 变体 id | 预览差异 |
|------|--------|---------|----------|
| cover | 5 | default, magazine, number-shock, question-hook, hero-split | 居中大字 / 左对齐杂志 / 超大 stat / 问号 / 上图下文 |
| points | 4 | cards, ledger, numbered-pill, left-bar | 卡片 pill / 账本行 / 实心圆号 / 粗色条无号 |
| timeline | 3 | vertical-rail, horizontal-steps, number-ladder | 竖轨 / 横向箭头步 / 巨号阶梯 |
| quote | 3 | sidebar, centered-hero, invert-dark | 左竖线 / 居中大字 / 黑底白字 |
| compare | 3 | three-col, two-col, swipe-before-after | 三列表 / 双列 / 左右色块滑动感 |
| summary | 3 | checklist-cards, metrics-tower, one-liner-close | 编号清单 / 大数字指标 / 一句收束 |
| ending | 3 | cta-pill, tag-wall, follow-guide | 实心 CTA / 标签铺满 / 关注理由列表 |
| photo | 3 | hero-dominant, caption-overlay, split-caption | 大图 / 叠字 / 对半 |
| gallery | 3 | grid-balanced, mosaic-feature, filmstrip | 均衡网格 / 马赛克 / 胶片条 |
| chapter | 3 | number-hero, minimal-rule, progress-band | 巨号章 / 细线章 / 进度带 |
| composite | 3 | stack-blocks, split-dual, accent-rail | 纵栈 / 上下双块 / 侧轨 |
| free | 3 | editorial, split-column, pull-quote-inline | 长文 / 分栏 / 文内拉引 |
| card | 3 | accent-label, tip-box, inset-thumb | 标签卡 / 提示框 / 缩略图 |

**合计**：13 页型 × 3–5 变体 = **40 个命名变体**（见 `page-layout-variants.json`）。

## 三、菜谱与变体槽

每条 `layout-recipes.json` 菜谱含 `page_variant_slots`：按页序为每槽指定 `{ type, variant }`，**同篇各页尽量不同变体**。

当前菜谱 **27 条**（v2.0），原 15 条已补全变体槽 + 新增 12 条。

### 示例：秋招面经 `autumn-interview-mix`

```json
{
  "id": "autumn-interview-mix",
  "page_variant_slots": [
    {"type": "cover", "variant": "number-shock"},
    {"type": "chapter", "variant": "progress-band"},
    {"type": "timeline", "variant": "number-ladder"},
    {"type": "points", "variant": "numbered-pill"},
    {"type": "quote", "variant": "invert-dark"},
    {"type": "summary", "variant": "metrics-tower"},
    {"type": "ending", "variant": "tag-wall"}
  ]
}
```

| 槽位 | 变体 | 用户预览所见 |
|------|------|-------------|
| 封面 | number-shock | 超大数字（如「5」）+ 秋招面经标题 |
| 章节 | progress-band | 顶部进度 + PART 01 笔试 |
| 时间线 | number-ladder | 01/02/03 阶梯 STAR 步骤 |
| 要点 | numbered-pill | 实心圆号卡片踩坑清单 |
| 金句 | invert-dark | 黑底白字面试官原话 |
| 总结 | metrics-tower | 大号 14天/3 offer 指标 |
| 结尾 | tag-wall | #秋招 #面经 标签铺满 |

## 四、引擎与 ops

- 页 JSON 字段：`layoutVariant`（或 `style.layoutVariant`）
- 渲染：`engine.js` 的 `layoutVariantOf` + `variantPageClass` → `page.css` 变体类
- points 兼容：`layoutVariant: ledger` ≡ `setPointsLayout: ledger`
- 新 op：`setPageLayoutVariant` — `{ "op": "setPageLayoutVariant", "variant": "invert-dark" }`
- 生成 prompt：`layout_catalog.build_catalog_prompt_section()` 注入菜谱 + 变体库

## 五、已实现 CSS 高影响变体（8 组）

1. cover: magazine, number-shock, question-hook, hero-split  
2. points: numbered-pill, left-bar  
3. timeline: horizontal-steps, number-ladder  
4. quote: centered-hero, invert-dark  
5. compare: swipe-before-after  
6. summary: metrics-tower, one-liner-close  
7. ending: cta-pill, tag-wall, follow-guide  

其余变体已在 catalog 中供 LLM 选型，后续可按需补 CSS。

## 六、新增菜谱一览（12）

| id | 名称 | 亮点 |
|----|------|------|
| autumn-interview-mix | 秋招面经混搭 | 面经全变体示范 |
| number-shock-listicle | 数字冲击清单 | 双 points 不同变体 |
| question-journey-story | 问题式叙事 | 问句封面 + 居中金句 |
| magazine-editorial-arc | 杂志专题弧 | 杂志封面 + 分栏长文 |
| horizontal-tutorial-flow | 横向教程流 | 横向步骤条 |
| quote-invert-rhythm | 黑底金句节奏 | invert 穿插要点 |
| swipe-compare-decide | 滑动对比决策 | 双 compare 不同变体 |
| metrics-checklist-finale | 指标清单终章 | ledger + 指标塔 |
| tag-wall-dispatch | 标签墙分发 | 搜索流量导向 |
| mosaic-evidence-flow | 马赛克证据流 | 截图面经 |
| ladder-star-interview | 阶梯 STAR 面经 | 双 timeline 变体 |
| pullquote-essay-arc | 拉引长文弧 | 深度概念文 |
