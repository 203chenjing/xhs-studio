# 静态交互 Demo 方法论

> 以 xhs-studio 的 `demo/` 为例：如何在不接后端、不花模型调用费的前提下，做一个**看起来像真实产品、点得动、能导出**的 Demo，并适配手机与 PC。

---

## 0. 一页执行版（TL;DR）

| 阶段 | 做什么 | 产出 | 参考耗时 |
|------|--------|------|----------|
| 1 | 真跑一次完整流程，保存输出 JSON | `deck` 数据 | 0.5h |
| 2 | 复用渲染器 + 写手机三屏壳 | `index.html` | 6–8h |
| 3 | 写 PC 三栏工作台 | `pc.html` | 4–6h |
| 4 | 浏览器内导出 + 扫码页 | ZIP / QR | 2–3h |
| 5 | 构建脚本 + 多端验收 | 可维护的 `demo/` | 2–3h |

**最短路径**：先做「一屏能滑动的成品」→ 再补审核与导出 → 最后做 PC 与扫码。
**不要**先做登录、账号、真后端；这些和「让人看懂产品」无关。

交付物固定为：`demo/` 静态目录 + 3 个 URL（手机 / PC / 扫码）+ 一份构建脚本。

---

## 1. 目标与约束

| 约束 | 结论 |
|------|------|
| 不能依赖后端 / 数据库 | 纯静态，`index.html` 丢到任意静态托管即可 |
| 不能每次演示都调模型（成本、延迟、不稳定） | 内容**预生成**，演示时只回放 |
| 不能是“假图 + 假按钮” | 必须用产品真实的渲染器、字体、导出链路 |
| 手机、PC 都要好看 | 两套壳层共享同一份数据和渲染层 |
| 可维护 | 数据与资源用脚本生成，壳层手写 |

**核心一句话：把产品的一次真实运行“冻结”成数据，再用产品自己的渲染器把它重放出来。**

---

## 2. 五层结构

```
┌──────────────────────────────────────────────────────────────┐
│ 5. 交付层   index.html（手机） · pc.html（桌面） · qr.html（扫码）│
├──────────────────────────────────────────────────────────────┤
│ 4. 交互层   demo.js / pc.js / qr.js（流程、翻页、主题、导出）      │
├──────────────────────────────────────────────────────────────┤
│ 3. 渲染层   engine.js + page.css + themes.js + 子集字体           │
│            ↑ 与真实产品完全同一套，不是复刻                        │
├──────────────────────────────────────────────────────────────┤
│ 2. 数据层   deck.js（title / hooks / caption / pages[] / meta）   │
│            ↑ 由真实模型输出冻结而来                                │
├──────────────────────────────────────────────────────────────┤
│ 1. 构建层   tools/build_demo.py（数据 → deck.js，同步 assets）     │
└──────────────────────────────────────────────────────────────┘
```

目录对应：

```
tools/demo/data/*.json     真实模型输出（qiuzhao / team）
tools/build_demo.py        构建：润色数据、写 deck.js、复制渲染层
demo/
  index.html + demo.css/js 手机版（三屏）
  pc.html + pc.css/js      桌面版（工作台）
  qr.html + qr.css/js      扫码页
  deck.js                  生成物
  assets/                  生成物：page.css / engine.js / themes.js / fonts / vendor
```

---

## 3. 制作步骤（可复用到别的产品）

### Step 0 · 选一个“能一眼看懂价值”的场景

不要选功能列表，选**一条完整主路径**。xhs-studio 选的是：
`一句意图 → 出稿审核 → 排版 → 导出发布包`。
再准备 1–2 个真实案例（本项目：秋招避坑清单 7 页 / 第一次带团队 8 页），覆盖不同页型。

### Step 1 · 真的跑一次，把输出冻结下来

用产品自己的 API 生成，保存完整 JSON（`title / hooks / caption / pages / meta / style`）。
xhs-studio 是两次真实 LLM 调用（生成 + 审核），约 20 秒、成本可忽略；**这份 JSON 就是 Demo 的全部内容**。

### Step 2 · 数据润色（只改展示，不改事实）

- 作者/品牌改成示例人设（小秋 / 阿岚），避免“创作者 / 你的昵称”的出戏
- 结尾话题裁到 4 个，防止页脚拥挤
- 金句去掉外层引号（页面本身有引号装饰）
- 重算每页 `progress`（01 / 07），保证页数与实际一致
- 所有页型、标题、正文保持模型原样，不重新编内容

润色逻辑放在 `tools/build_demo.py` 的 `OVERRIDES` 里，**可复现**。

### Step 3 · 复用真实渲染器，而不是重画

直接复制产品的 `page.css`、`engine.js`、`themes.js`、字体：
页面 DOM、字号、圆角、阴影、7 套主题、导出逻辑全部一致。
Demo 里唯一“假”的是进度条动画，其余都是真链路。

> 判断标准：Demo 截出来的页面，和产品导出的 PNG 应该像素级接近。

### Step 4 · 写两套薄壳

- **手机版**（`index.html`）：三屏线性叙事——选案例 / 审核文案 / 排版导出；全屏、底部固定 CTA、滑动翻页。
- **桌面版**（`pc.html`）：三栏工作台——左侧写稿审核、中间 3:4 画布、右侧页面缩略图 + 主题 + 导出。
- **扫码页**（`qr.html`）：桌面 → 手机的桥；二维码在浏览器本地生成，默认指向当前部署地址。

壳层只负责布局和状态，不碰页面内部样式。

### Step 5 · 用“回放”代替实时生成

点「生成并审核」后，用 2 秒进度条回放 `① 写稿 → ② 审核`，然后直接进入审核结果。
文案里明确写“预生成内容回放”，不伪装成实时模型——**诚实反而增加可信度**。

### Step 6 · 做真的导出

- `html-to-image` 在浏览器内把每页渲染成 2160×2880 PNG
- `JSZip` 打包 `pages/*.png + title.txt + caption.txt + publish.json + meta.json`
- 导出前 `await document.fonts.ready`，并对每页跑一次 `fitPage()`，保证与预览一致
- 实测产物：7 页、8.2MB、ZIP 可下载

### Step 7 · 扫码页的两个细节

1. **二维码本地生成**（qrcodejs，MIT），不依赖第三方 API，离线可用
2. **下载图必须有 4 模块静区**：qrcodejs 画布是满幅的，需要再合成一张 640×640、四周留 64px 的画布；我用 OpenCV 解码验证过
3. 地址可编辑并记住，方便在 localhost 阶段先粘贴线上地址预览；手机打开时自动隐藏二维码、改成“直接打开”

### Step 8 · 构建脚本保证可维护

`python tools/build_demo.py`：

- 读 `tools/demo/data/*.json` → 套用 overrides → 写 `demo/deck.js`
- 从 `frontend/` 复制 `page.css / engine.js / themes.js / fonts`
- 从 `tools/demo/vendor/` 复制二维码库
- 手写壳层不被覆盖

产品改版后重跑一次，Demo 自动跟上，不会出现“Demo 是三个月前的版式”。

### Step 9 · 验证清单

- Chromium + WebKit（Safari 内核）各走一遍
- 360×640 / 390×844 / 1280×800 / 1440×900
- 页面无横向溢出；`document.scrollWidth === viewport`
- 导出 ZIP 解压后 PNG 为 2160×2880
- 二维码下载后用解码器验证内容
- PC 版窄窗（<980）降级到“请用手机版”提示

---

## 4. 数据契约（deck.js）

```js
window.XHS_DEMO = {
  decks: [{
    id: "qiuzhao",
    label: "秋招避坑清单",
    kicker: "清单型 · 7 页",
    intent: "写一份秋招投递避坑清单…",
    style: "ins",
    title: "26届秋招投递避坑清单：…",
    hooks: ["…", "…", "…"],
    caption: "…\n\n#秋招 #26届…",
    data: { meta: { author, avatar, brand }, pages: [ /* product schema */ ] }
  }]
};
```

页面部分与产品 schema 完全一致，所以 `XHSEngine.renderPage(page, meta, opts)` 可以直接吃。

---

## 5. 关键决策与权衡

| 决策 | 为什么 | 代价 |
|------|--------|------|
| 预生成，不实时调模型 | 零成本、零延迟、演示稳定、可离线 | 用户不能“输入任意内容” |
| 复用产品渲染器 | 真实感、维护成本低 | 需要把 assets 同步进 demo |
| 手机 + PC 两套壳 | 手机适合扫码传播，PC 适合投屏/评审 | 两套交互代码 |
| 导出放浏览器 | 不接后端也能给“真产物” | 移动端导出较慢、占内存 |
| 二维码本地生成 | 隐私、离线、无第三方 | 多一个 19KB 库 |
| 明确标注“回放” | 建立信任，避免误解 | 少一点“AI 魔法感” |

---

## 6. 踩过的坑（直接抄作业）

1. **Google Fonts + html-to-image = 导出字形错乱**：CORS 读不到 `cssRules`，静默回退系统字体，字宽变化导致换行/裁切。解决：页面字体改为**本地子集 woff2**，预览/导出/CI 同一份字形。
2. **移动端 font boosting**：手机浏览器自动放大字号，标签「面试前」折成两行压住标题。解决：`.xhs-page` 加 `text-size-adjust: none`，壳层 `100%`。
3. **等宽字体没有中文字形**：`ui-monospace` 的 CJK 回退各设备不一致；短标签改用正文字体 + `white-space: nowrap`。
4. **二维码没有静区**：满幅画布扫码率低、下载图完全扫不出。解决：合成 640×640 + 64px 白边。
5. **flex 栏位互相重叠**：右栏内容超出时 flex 子项被压缩，文字溢出压到下一个模块。解决：`flex-shrink: 0` + 整栏滚动。
6. **相对路径**：Demo 必须能挂在任意子路径；不要出现 `/static/...`，资源统一 `assets/...`。
7. **缓存**：部署后旧 CSS 被缓存，务必强刷；构建文件名可按需加 hash（当前用强刷 + 说明）。
8. **WorkBuddy / 静态托管的 MIME**：`.woff2` 要以 `font/woff2` 返回；产品端已在启动时注册 MIME。

---

## 7. 新项目复用 Checklist

- [ ] 选一条完整主路径 + 1–2 个真实案例
- [ ] 真跑一次，保存完整输出 JSON
- [ ] 只做展示层润色，事实不改
- [ ] 复用真实渲染器 / 样式 / 字体
- [ ] 手机版：全屏、固定 CTA、滑动翻页
- [ ] PC 版：三栏工作台、缩略图、主题、导出
- [ ] 2 秒回放，明确标注“预生成”
- [ ] 浏览器内真实导出（字体就绪 + 逐页 fit）
- [ ] 扫码页（本地二维码 + 静区 + 可编辑地址）
- [ ] 构建脚本同步数据与 assets
- [ ] Chromium + WebKit、4 个典型分辨率
- [ ] 静态托管路径 / MIME / 缓存检查

---

## 8. 这套方法的适用边界

**适合**：产品形态稳定、有一条可演示的主路径、需要给客户/面试官/投资人快速看效果、希望零运维。
**不适合**：需要用户自由输入并实时看到不同结果、需要账号/协作/数据闭环的深度试用。

折中方案：Demo 里保留“输入框”作为叙事的一部分，但明确说明是预生成案例；真正开放输入放到产品环境。

---

## 附录 A · 目录模板

```
<repo>/
  tools/
    build_demo.py            # 唯一构建入口
    demo/
      data/*.json            # 真实输出，按案例一份
      vendor/*.js            # 只有 Demo 用的第三方库
  demo/                      # 发布目录（站点根）
    index.html               # 手机版
    pc.html                  # PC 版（可选）
    qr.html                  # 扫码页（可选）
    deck.js                  # 生成物：数据
    assets/
      page.css / engine.js / themes.js
      fonts.css + fonts/
      vendor/
```

原则：`demo/` 里**只有生成物和手写壳**；原始数据与源资源放 `tools/`，避免“改 Demo 等于改产品”。

---

## 附录 B · `build_demo.py` 最小骨架

```python
ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo"
ASSETS = DEMO / "assets"
DATA = ROOT / "tools" / "demo" / "data"

def polish(raw, ov):
    data = raw["data"]
    data["meta"] = {**data.get("meta", {}), **ov["meta"]}
    for p in data["pages"]:
        if p.get("type") == "ending":
            p["tags"] = ov["endingTags"]
    # 只改展示字段，不动事实
    return {"id": ov["id"], "intent": ov["intent"], "title": raw["title"],
            "hooks": raw["hooks"], "caption": raw["caption"], "data": data}

# 1) 数据 -> deck.js
decks = [polish(json.loads((DATA / f"{k}.json").read_text()), v) for k, v in OVERRIDES.items()]
(DEMO / "deck.js").write_text("window.XHS_DEMO = " + json.dumps({"decks": decks}, ensure_ascii=False))

# 2) 同步渲染层
for src, dst in COPIES:          # page.css / engine.js / themes.js / fonts / vendor
    shutil.copyfile(ROOT / src, DEMO / dst)

# 3) 修正字体路径：/static/fonts/ -> fonts/
css = (ROOT / "frontend/css/fonts.css").read_text()
(ASSETS / "fonts.css").write_text(css.replace("/static/fonts/", "fonts/"))
```

完整实现见 [`tools/build_demo.py`](../tools/build_demo.py)。

---

## 附录 C · 壳层状态机

```
状态：deck / theme / page / step / started / generating / exporting
事件：选案例 / 生成 / 下一步 / 翻页 / 换主题 / 导出

render():
  sidebar  ← deck + review + publishTitle
  canvas   ← pages[page] 经 renderPage()
  rail     ← thumbs + themes + export 可用性
```

三条纪律：

1. **单一数据源**：`deck.js` 是唯一内容来源，壳层不硬编码文案。
2. **render 幂等**：任何状态变化都整体重渲染当前页，不做局部 DOM 拼接。
3. **渲染与壳分离**：壳层不覆盖 `.xhs-page` 内部样式，主题只通过 CSS 变量切换。

---

## 附录 D · 验收脚本（最小版）

```python
with sync_playwright() as p:
    page = p.chromium.launch().new_page(viewport={"width": 1440, "height": 900})
    page.goto(base + "/pc.html"); page.wait_for_timeout(600)
    assert page.is_visible("#stage-empty")

    page.click("#primary"); page.wait_for_timeout(2400)      # 回放
    assert page.is_visible("#review-block")
    page.click("#primary"); page.wait_for_timeout(600)      # 进入排版

    page.click("#next")
    assert page.inner_text("#page-count").startswith("02")
    page.click("[data-theme='terminal']")
    assert "TERMINAL" in page.inner_text("#style-name")

    with page.expect_download() as dl:
        page.click("#export")
        page.wait_for_selector("#export-actions:not([hidden])", timeout=120000)
        page.click("#download")
    assert dl.value.suggested_filename.endswith(".zip")
```

再加三组断言：`document.scrollWidth === innerWidth`（360/390）、字体 `document.fonts.check()`、二维码图片能被解码。

---

## 附录 E · 工作量与变体

| 变体 | 复用方式 | 额外工作 |
|------|----------|----------|
| SaaS 后台 / 工作台 | 冻结一条操作流 + 真实图表组件 | 状态与表格数据要可重放 |
| 开发者工具 / CLI | 录真实终端输出，做逐行回放 | 录制脚本、节奏控制 |
| 移动 App | 静态截图 + 原生式转场（或 WebView） | 手势/转场细节 |
| 内容站 / 作品集 | 直接静态渲染，无需“回放” | 排版与 SEO |

参考工期：**一个终端 1–1.5 天**；每多一个终端（手机/PC/扫码）+0.5 天；有真实导出链路 +0.5 天。

---

## 附录 F · 交接清单

给托管方 / 同事的最小信息包：

- [ ] 仓库 + 分支 + 目录（或 zip）
- [ ] 站点根要求（`index.html` 在根）
- [ ] 3 个入口地址（手机 / PC / 扫码）
- [ ] MIME 要求（`font/woff2`）
- [ ] 验收结果（截图 + 导出 ZIP 尺寸）
- [ ] 重新生成命令（`python tools/build_demo.py`）
- [ ] 方法论文档（本文）与部署任务书（[`WORKBUDDY-DEPLOY.md`](./WORKBUDDY-DEPLOY.md)）

