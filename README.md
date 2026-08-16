# 小红书一键成图（xhs-studio）

独立产品：用户意图 → **①写稿** → **②审核** → 确认排版预览 → 导出 ZIP（多页 PNG + title/caption/meta）。

与 ResumeAI **完全解耦**。渲染契约对齐 `xhs-templates` 的 DATA schema（含 `free` 等 type × 7 套主题）。

**改 UI / 页样式 / 导出前，先过 [`XHS-UI-UX-CHECKLIST.md`](./XHS-UI-UX-CHECKLIST.md)**（小红书风格验收）。

## Agent 约定

| 类型 | 管什么 | 路径 |
|------|--------|------|
| **Rule** | 改相关文件时的强制约束（字段级 ops、可解释可撤销、2+1、soft_flow、prompt 位置） | [`.cursor/rules/xhs-studio-ai-editor.mdc`](../.cursor/rules/xhs-studio-ai-editor.mdc) |
| **Skill** | 任务匹配时的工作流手册（架构、ops 约定、反模式、速查） | [`.cursor/skills/xhs-studio-agent/SKILL.md`](../.cursor/skills/xhs-studio-agent/SKILL.md) |
| UI Rule | 视觉/交互底线（与 AI Rule 并存） | [`.cursor/rules/xhs-studio-ui-ux.mdc`](../.cursor/rules/xhs-studio-ui-ux.mdc) |

Rule 管「不能破」；Skill 管「怎么做」。专业 prompt 放 `backend/prompts/`（见 `page_editor.md` 占位）。

## 产品原则（2026 改造）

- **AI 增强控制，不替代控制**：增删页、点字编辑、拖拽排序、换图、撤销均为原生控件；AI 与手工共用 schema / 可解释 **ops**。
- **本地持久化**：IndexedDB 自动保存草稿；刷新可恢复。
- **结构化 WYSIWYG**：预览区 `data-xhs-path` 点改 + 列表拖拽；与 `frontend/js/ops.js`、`backend/ops.py` 同构。
- **导出闸口**：title/caption 非空 + 逐页 overflow 校验；`meta.json` 含 warnings / 会话 LLM 计数。

## 「2+1」调用架构

主路径只打 **2 次 LLM**，单页改写最多再 **+1**（用户主动点才调用）：

| 次数 | 接口 | 何时 | UI 阶段文案 |
|------|------|------|-------------|
| ① | `POST /api/generate` | 点「生成并审核」→ 全篇一次出稿 | ① 写稿 |
| ② | `POST /api/review` | 生成后自动审核；或「重新审核」 | ② 审核 |
| +1 | `POST /api/page/revise`（产品面仅 `mode=auto`） | 排版阶段点「AI 优化」 | +1 单页 |
| 高级 | `POST /api/page/layout-ideas` | 折叠在「高级」里，主路径默认不可见 | — |

- **禁止**为单页修改再串行开「协调 Agent」。
- `page/revise` 的 `auto` 先走规则（density / 删句 / 删第 N 条等）→ **0 次 LLM**；规则解不了才打模型。
- 审核不在每次改页后自动全量跑（标记「已改需复审」；导出时二次确认或轻量复审）。
- 响应带 `meta: { step, llm_calls, estimated_seconds }`；步骤条显示当前步 + 预估耗时 + 已用时（不用假百分比）。
- Header **LLM ×N** pill 诚实累计本会话调用（含单页改/排版思路/复审），不假装封顶 2。
- `force_demo` 仅 API/调试保留，**不进产品 UI**。

## 主路径（强刷后自检）

1. 写意图 →「生成并审核」
2. **审时即可翻页看图**（只读预览）；左侧看结论 + 问题 + 主 CTA
3. 「确认无误，开始排版」→ 可单页 AI 改（可「撤销本页」）
4. 导出 ZIP（`needsRereview` 时会二次确认 / 可先复审）

Demo / `demo_fallback` / warnings 会在顶部强提示，**不会假装「已完美审核通过」**。

## 目录

```
xhs-studio/
  frontend/          # 静态向导（由后端托管）
    css/app.css
    css/page.css     # 1080×1440 页样式
    js/themes.js     # 七主题 CSS variables + 字体
    js/engine.js     # 渲染引擎
    js/app.js        # 一键流 UI
    js/api-client.js # 统一 fetch + 超时/取消
    js/project-store.js # IndexedDB 草稿
    js/ops.js        # 页内/文档级 ops（与 backend/ops.py 对齐）
    js/wysiwyg.js    # 结构化点改/拖拽
    js/export-guard.js
    js/deps.js       # 导出 vendor + CDN 兜底
    vendor/          # html-to-image / jszip 离线包
    index.html
  backend/
    main.py          # FastAPI
    pipeline.py      # LLM / Demo 流水线
    ops.py           # 结构化 ops 执行器
    schema.py        # 校验与 Repair
    demo.py          # 无 Key 可靠 fallback
    themes.py
    requirements.txt
    .env.example
  README.md
```

## 启动

```powershell
cd "e:\宿舍主机共享文件夹\简历\xhs-studio\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# 可选：填写 XHS_LLM_API_KEY 等；不填则走 Demo 模式
python main.py
```

浏览器打开：http://127.0.0.1:8765/  
**Ctrl+F5 强刷**后再走主路径。

### 安全提示（本地工具）

- 默认绑定 `127.0.0.1`，**勿**改成 `0.0.0.0` 后直接公网裸奔。
- CORS 为本地开发放开（`allow_origins=["*"]`）；上线须收紧。
- 上传写入会话子目录 `uploads/{session_id}/`；`StaticFiles(html=False)` 不做目录列举；导出后会调 `POST /api/uploads/cleanup`，启动时也会清超过 24h 的文件。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查；`llm_configured` / `mode` |
| GET | `/api/themes` | 七套主题元数据 |
| POST | `/api/generate` | `{ intent, author?, brand?, style?, force_demo?, image_urls? }` → 含 `meta` / `warnings?` |
| POST | `/api/review` | `{ data, title, caption, intent? }` → `{ verdict, issues[], suggestions?, mode, meta? }` |
| POST | `/api/revise` | 按审核意见改写 |
| POST | `/api/page/revise` | 单页改写（UI 固定 `auto`） |
| POST | `/api/page/layout-ideas` | 高级：3 种排版思路 |
| POST | `/api/upload` | multipart；可选 `session_id` Form 字段 |
| POST | `/api/uploads/cleanup` | `{ session_id? , urls? }` 清理上传 |

无 `XHS_LLM_API_KEY` 时自动 Demo：按意图关键词生成合法 DATA，不空失败。审核同理：无 Key / 失败时走规则审核。

## 使用流程

顶部步骤条始终可见，并标预估耗时（随 `/api/health` 在 LLM / Demo 间切换）：

1. **写意图** — 即时  
2. **生成全文（①写稿）** — LLM 约 10 秒 / Demo 约 1 秒  
3. **审核内容（②审核）** — 约 5 秒；此时右侧可翻页只读预览  
4. **预览排版** — 可单页改（LLM 约 3–8 秒，规则即时）；主题默认推荐一套，「换风格」再展开  
5. **导出发布包** — 本地出图，约数秒  

画布逻辑尺寸固定 **1080×1440**；预览仅 CSS scale，导出像素由 `pixelRatio` 控制。

## 环境变量

见 `backend/.env.example`：

- `XHS_LLM_API_KEY`
- `XHS_LLM_BASE_URL`（默认 `https://api.deepseek.com/v1`）
- `XHS_LLM_MODEL`（默认 `deepseek-chat`）
- `XHS_PORT`（默认 `8765`）

## 已知限制

- 首次需联网加载 Google Fonts / jsDelivr（html-to-image、JSZip、字体）
- 导出前等待 `document.fonts.ready`；字体未就绪可能导致字宽偏差
- 内容超高时显示「内容溢出」；不会自动拆页（可改写精简）
- Demo 改写为本地轻量修改，效果弱于 LLM
- `composite` 禁止嵌套与 cover/chapter/ending 子块
