# page_editor prompt 包

专业单页编辑 prompt 实现为同目录 `page_editor.py`，由 `pipeline` / `prompts/__init__.py` 引用：

- `SYSTEM_PAGE_EDITOR`
- `STYLE_VOICE`
- `build_page_editor_user`
- `few_shot_block`

## 产品语义

- **主路径**：有 API Key 时，`page/revise` 始终先调 LLM（本 prompt）→ `{ ops, summary }` → 服务端 ops 执行器 + soft_flow
- **规则兜底**：无 Key / LLM 失败时，服务端可用规则生成同类 ops，但响应标明 `rules_fallback`，不得冒充深度 AI
- ops 执行器是解释器，不是「编辑智能」

## 必须包含的条款

1. 整体风格：主题 style 气质 + theme / logic_summary + 邻页
2. 不编造事实；只基于当前页与用户指令
3. 用户要删就删，禁止为「信息量」加回
4. 输出约定 JSON（字段级 **ops** + summary），无 emoji、无 markdown 代码块

**禁止随意弱化**上述条款。
