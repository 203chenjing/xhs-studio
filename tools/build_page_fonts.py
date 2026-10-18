# -*- coding: utf-8 -*-
"""Build the page-canvas charset and subset Source Han fonts to woff2.

The canvas text is arbitrary Chinese, so we keep the GB2312 hanzi set
(6763 chars) plus ASCII, CJK punctuation, full-width forms and the
numbered circles used by the copy playbook. Rare characters outside this
set fall back to the system serif via the CSS font stack.
"""
from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "frontend" / "fonts"
TMP = ROOT / ".font-build"

SOURCES = [
    (
        "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/SubsetOTF/CN/SourceHanSerifCN-Bold.otf",
        "SourceHanSerifCN-Bold.otf",
        "xhs-serif-bold.woff2",
    ),
    (
        "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/SubsetOTF/CN/SourceHanSansCN-Regular.otf",
        "SourceHanSansCN-Regular.otf",
        "xhs-sans-regular.woff2",
    ),
    (
        "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/SubsetOTF/CN/SourceHanSansCN-Bold.otf",
        "SourceHanSansCN-Bold.otf",
        "xhs-sans-bold.woff2",
    ),
]


def gb2312_chars() -> set[str]:
    chars: set[str] = set()
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                continue
    return chars


def build_charset() -> Path:
    chars = gb2312_chars()
    chars.update(chr(c) for c in range(0x20, 0x7F))
    chars.update("　·—…“”‘’《》〈〉【】「」『』（）《》、，。！？；：％‰°±×÷≈≤≥→←↑↓•·")
    chars.update("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳")
    chars.update("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    text = "".join(sorted(chars))
    TMP.mkdir(exist_ok=True)
    path = TMP / "charset.txt"
    path.write_text("".join(chars), encoding="utf-8")
    print(f"charset: {len(chars)} chars")
    return path


def main() -> int:
    TMP.mkdir(exist_ok=True)
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    charset = build_charset()
    for url, src_name, out_name in SOURCES:
        src = TMP / src_name
        if not src.exists():
            print(f"download {src_name} …")
            urllib.request.urlretrieve(url, src)
        out = FONT_DIR / out_name
        cmd = [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(src),
            f"--text-file={charset}",
            "--flavor=woff2",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
            f"--output-file={out}",
        ]
        subprocess.run(cmd, check=True)
        print(f"{out.name}: {out.stat().st_size / 1024 / 1024:.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
