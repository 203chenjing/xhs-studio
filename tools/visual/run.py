# -*- coding: utf-8 -*-
"""Visual regression for the xhs-studio canvas.

Runs the app in deterministic Demo mode (no API key), captures the empty
state, every generated page at 1080x1440 and the mobile landing page, then
compares against committed baselines pixel by pixel.

Usage:
    python tools/visual/run.py            # compare against baselines
    python tools/visual/run.py --update   # regenerate baselines
    python tools/visual/run.py --base-url http://127.0.0.1:8765  # use a running server

Exit code 1 when any shot exceeds the allowed mismatch ratio.
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASELINE_DIR = Path(__file__).resolve().parent / "baselines"
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"

INTENT = "写一套秋招投递避坑清单：投递前自查、简历常见问题、面试跟进三个部分，语气真诚，适合收藏"
VIEWPORT = {"width": 1512, "height": 950}
CANVAS_VIEWPORT = {"width": 1200, "height": 1560}


def wait_port(port: int, timeout: float = 60.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False


def backend_python() -> str:
    """Prefer the backend venv locally; CI pip-installs into the active Python."""
    candidates = [
        ROOT / "backend" / ".venv" / "Scripts" / "python.exe",
        ROOT / "backend" / ".venv" / "bin" / "python",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return sys.executable


def start_server(port: int) -> subprocess.Popen:
    env = dict(os.environ)
    # 一个空格而不是空串：PowerShell 里把变量设为空串会直接删除它，
    # 随后 dotenv 又会把 backend/.env 的真实 key 读进来。
    env["XHS_LLM_API_KEY"] = " "
    env["XHS_PORT"] = str(port)
    env["PYTHONIOENCODING"] = "utf-8"
    log = ARTIFACT_DIR / "server.log"
    with open(log, "w", encoding="utf-8") as fh:
        proc = subprocess.Popen(
            [backend_python(), "main.py"],
            cwd=str(ROOT / "backend"),
            env=env,
            stdout=fh,
            stderr=subprocess.STDOUT,
        )
    if not wait_port(port):
        proc.terminate()
        raise RuntimeError(f"backend did not start (see {log})")
    for _ in range(40):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2) as r:
                if b'"ok":true' in r.read():
                    return proc
        except OSError:
            pass
        time.sleep(0.3)
    proc.terminate()
    raise RuntimeError("backend health check failed")


def launch_browser(p):
    exe = os.environ.get("XHS_VISUAL_CHROME", "").strip()
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()


def compare(name: str, shot_path: Path, update: bool, tolerance: int, max_ratio: float) -> bool:
    baseline = BASELINE_DIR / f"{name}.png"
    if update or not baseline.exists():
        BASELINE_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(shot_path, baseline)
        print(f"[update] {name}")
        return True

    a = Image.open(baseline).convert("RGB")
    b = Image.open(shot_path).convert("RGB")
    if a.size != b.size:
        print(f"[FAIL] {name}: size {a.size} != {b.size}")
        return False
    diff = ImageChops.difference(a, b).convert("L")
    # Pillow's point() maps every channel difference above tolerance to 255.
    mask = diff.point(lambda v: 255 if v > tolerance else 0)
    bad = sum(1 for v in mask.getdata() if v)
    ratio = bad / (a.size[0] * a.size[1])
    if ratio > max_ratio:
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        heat = Image.merge("RGB", (mask, Image.new("L", a.size), Image.new("L", a.size)))
        heat.save(ARTIFACT_DIR / f"{name}.diff.png")
        shutil.copyfile(shot_path, ARTIFACT_DIR / f"{name}.actual.png")
        print(f"[FAIL] {name}: {bad} px differ ({ratio:.3%})")
        return False
    print(f"[ok]   {name}: {bad} px differ ({ratio:.4%})")
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true")
    ap.add_argument("--base-url", default="")
    ap.add_argument("--port", type=int, default=8799)
    ap.add_argument("--tolerance", type=int, default=10, help="per-channel difference allowed (0-255)")
    ap.add_argument("--max-ratio", type=float, default=0.001, help="max share of differing pixels")
    args = ap.parse_args()

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    server = None
    base = args.base_url.rstrip("/")
    if not base:
        server = start_server(args.port)
        base = f"http://127.0.0.1:{args.port}"

    ok = True
    try:
        with sync_playwright() as p:
            browser = launch_browser(p)
            page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1, locale="zh-CN")
            page.goto(base + "/", wait_until="networkidle")
            page.evaluate("() => document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=str(ARTIFACT_DIR / "01-landing.png"))
            ok &= compare("01-landing", ARTIFACT_DIR / "01-landing.png", args.update, args.tolerance, args.max_ratio)

            page.fill("#intent", INTENT)
            page.click("#btn-generate")
            page.wait_for_selector("#review-panel:not([hidden])", timeout=60000)
            page.wait_for_function(
                "() => !document.querySelector('#review-verdict').textContent.includes('等待审核')",
                timeout=60000,
            )
            page.wait_for_timeout(600)
            if page.is_visible("#btn-confirm-layout"):
                page.click("#btn-confirm-layout")
                page.wait_for_timeout(800)

            # 显式加载画布字体，避免 fallback 字形进入基线
            page.evaluate(
                """async () => {
                  await Promise.all([
                    document.fonts.load('700 100px "XHS Serif"'),
                    document.fonts.load('400 30px "XHS Sans"'),
                    document.fonts.load('700 30px "XHS Sans"')
                  ]);
                  await document.fonts.ready;
                }"""
            )
            page.wait_for_timeout(300)

            page.set_viewport_size(CANVAS_VIEWPORT)
            page.wait_for_timeout(400)
            # 隐藏壳层，只留画布，避免工具栏/页脚叠进截图
            page.evaluate(
                """() => {
                  for (const sel of ['.app-header', '.flow-bar', '.preview-toolbar', '.page-controls', '.panel']) {
                    const el = document.querySelector(sel);
                    if (el) el.style.display = 'none';
                  }
                  document.querySelector('.app-main').style.gridTemplateColumns = '1fr';
                  document.querySelector('#preview-wrap').style.padding = '0';
                  document.querySelector('#preview-wrap').style.overflow = 'visible';
                }"""
            )
            page.wait_for_timeout(300)
            # 鼠标移出画布，避免 editable 的 hover 高亮混进基线
            page.mouse.move(2, 2)
            page.evaluate("() => document.activeElement && document.activeElement.blur()")
            total = page.evaluate("() => document.querySelectorAll('#page-nav .nav-btn').length")
            for i in range(total):
                page.evaluate(f"() => document.querySelectorAll('#page-nav .nav-btn')[{i}].click()")
                page.wait_for_timeout(350)
                page.evaluate(
                    """() => {
                      const s = document.querySelector('#preview-stage');
                      s.style.transform = 'none';
                      s.style.margin = '0';
                      document.querySelector('#preview-wrap').style.overflow = 'visible';
                    }"""
                )
                page.wait_for_timeout(150)
                name = f"page-{i + 1:02d}"
                shot = ARTIFACT_DIR / f"{name}.png"
                page.query_selector("#preview-stage").screenshot(path=str(shot))
                ok &= compare(name, shot, args.update, args.tolerance, args.max_ratio)

            mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1, locale="zh-CN")
            mobile.goto(base + "/", wait_until="networkidle")
            mobile.evaluate("() => document.fonts.ready")
            mobile.wait_for_timeout(500)
            mobile.screenshot(path=str(ARTIFACT_DIR / "mobile-landing.png"))
            ok &= compare(
                "mobile-landing", ARTIFACT_DIR / "mobile-landing.png", args.update, args.tolerance, args.max_ratio
            )
            browser.close()
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
