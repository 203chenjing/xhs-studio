# 小红书一键成图 · 交互 Demo

一个**纯静态、移动端优先**的产品演示：把「一句意图 → 审核 → 排版 → 导出发布包」完整走一遍。
内容来自真实模型输出，页面由产品同一套渲染引擎生成，导出在浏览器里完成。

## 目录

```
demo/
  index.html          # 入口（移动端优先，桌面显示为手机框）
  demo.css / demo.js  # 演示壳层交互
  deck.js             # 由 tools/build_demo.py 生成的两份真实数据
  assets/
    page.css          # 产品页面版式（从 frontend/css/page.css 复制）
    engine.js         # 产品渲染引擎（XHSEngine）
    themes.js         # 7 套主题 token
    fonts.css + fonts/# 本地子集字体
    vendor/           # html-to-image + jszip（浏览器内导出）
```

## 部署到云端（WorkBuddy 等静态托管）

把整个 `demo/` 目录作为站点根目录上传即可：

- `index.html` 必须在站点根路径
- 所有资源都是相对路径（`assets/...`），不依赖后端、不带 `/static` 前缀
- 确保 `.woff2` 以 `font/woff2` 返回；多数静态托管会自动识别，若控制台报字体 MIME，请在托管配置里补上
- 不需要 Node、Python 或任何构建步骤

## 本地预览

```powershell
cd demo
python -m http.server 8810
# 打开 http://127.0.0.1:8810/
```

## 重新生成

改内容或升级渲染器后：

```powershell
python tools/build_demo.py
```

- 数据源：`tools/demo/data/qiuzhao.json`、`team.json`（真实模型输出）
- 脚本会重新生成 `demo/deck.js`，并从 `frontend/` 同步 `page.css`、`engine.js`、`themes.js`、字体与导出库
- 演示壳层（`index.html` / `demo.css` / `demo.js`）是手写的，不会被覆盖

## 交互说明

1. **输入**：两份真实案例（秋招清单 / 带团队复盘），可切换
2. **审核**：发布风险、标题、候选 hook、正文 + 话题，可复制 / 替换标题
3. **排版**：左右滑动画布、7 套主题实时切换、页码与页面类型
4. **导出**：浏览器内逐页渲染 2160×2880 PNG，打包 `title.txt`、`caption.txt`、`publish.json`、`meta.json`

> 生成过程是预生成内容的回放（约 2 秒），不是现场调用模型；这样 Demo 在云端零成本、可离线演示。
