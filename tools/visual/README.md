# 视觉回归（像素基线）

用同一套本地字体 + Demo 内容，把「空态、6 个页面画布、移动端首页」截成基准图，之后每次改动都用像素差比对。

## 本地运行

```powershell
# 需要：pip install playwright==1.60.0 pillow
python -m playwright install chromium

python tools/visual/run.py            # 对比基线，失败时把 diff 写到 artifacts/
python tools/visual/run.py --update   # 有意改版后重建基线
```

脚本会自己以 Demo 模式（`XHS_LLM_API_KEY=""`）在 8799 端口拉起后端，不消耗模型调用。
也可以对接已启动的服务：

```powershell
python tools/visual/run.py --base-url http://127.0.0.1:8765
```

## 判定规则

- 逐像素比较 RGB，单通道差 ≤ 10 视为一致
- 超出基线的像素占比 > 0.1% 即失败（默认参数可调）
- 失败时输出 `artifacts/<name>.diff.png`（红色像素）和 `<name>.actual.png`

## 基线说明

- 基线与 CI 都在 **windows-latest + Chromium 1223（playwright 1.60.0）** 下生成，
  页面字体是 `frontend/fonts/*.woff2` 本地子集，跨机器字形一致。
- CI 会跑 `backend/tests` + `tools/visual/run.py` 两个 job。
- 页面数量或 Demo 文案变化属于「有意改版」，需要 `--update` 并 review 图片差异。
