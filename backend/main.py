# -*- coding: utf-8 -*-
"""XHS Studio API — independent FastAPI service.

调用架构「2+1」（见 pipeline.py / README）：
  主路径 2：POST /api/generate + POST /api/review
  +1：用户主动 POST /api/page/revise 或 /api/page/layout-ideas
不拆成多个串行 Agent 服务。
page/revise：有 Key 时 LLM 优先；无 Key / 失败时规则兜底（mode=rules_fallback）。
"""
from __future__ import annotations

import os
import re
import shutil
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Load local .env only (never ResumeAI secrets)
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(BACKEND_DIR / ".env")

from images import basename_ok, is_safe_upload_url  # noqa: E402
from pipeline import generate, layout_ideas, revise, revise_page, revise_page_stream  # noqa: E402
from review import review_content  # noqa: E402
from themes import list_themes  # noqa: E402

app = FastAPI(title="小红书一键成图", version="1.3.0")

# 本地开发方便：允许任意 Origin。切勿把本服务直接裸奔公网；上线应收紧 allow_origins。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_COUNT = 9
UPLOAD_MAX_AGE_SEC = 24 * 3600
SESSION_RE = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")
ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class GenerateRequest(BaseModel):
    intent: str = Field(..., min_length=1, description="用户意图 / 主题素材")
    author: str | None = None
    brand: str | None = None
    style: str | None = None
    supplement_context: str | None = Field(
        default=None,
        description="用户补充事实/禁忌/语气偏好，生成与改写时作参考",
    )
    # API 保留 force_demo 供脚本/调试；产品 UI 不暴露
    force_demo: bool = False
    image_urls: list[str] = Field(default_factory=list, description="已上传图片 URL，最多 9 张")


class ReviseRequest(BaseModel):
    data: dict
    instruction: str = Field(default="", description="改写要求；可与 issues 联用")
    page_index: int | None = None
    caption: str | None = None
    title: str | None = None
    issues: list[dict] = Field(default_factory=list, description="审核意见，用于按意见改写")
    supplement_context: str | None = Field(
        default=None,
        description="用户补充事实/禁忌，改写时作参考",
    )


class ReviewRequest(BaseModel):
    data: dict
    title: str = ""
    caption: str = ""
    intent: str | None = None
    light: bool = Field(default=False, description="仅规则审核，跳过 LLM")


class ValidateExportRequest(BaseModel):
    data: dict
    title: str = ""
    caption: str = ""


class PageReviseRequest(BaseModel):
    data: dict
    page_index: int = Field(..., ge=0)
    mode: str = Field(default="auto", description="产品面仅用 auto；其它值供调试")
    instruction: str | None = None
    title: str | None = None
    caption: str | None = None
    page: dict | None = Field(default=None, description="当前页快照（优先于 data.pages[i]）")
    style: str | None = Field(default=None, description="视觉主题 id，供风格一致")
    logic_summary: list | None = Field(default=None, description="整篇结构大纲")
    neighbors: dict | None = Field(default=None, description="邻页 title/role 摘要")
    field_path: str | None = Field(default=None, description="WYSIWYG 选中字段 path，优先局部改写")
    force_rules_fallback: bool = Field(
        default=False,
        description="调试：跳过 LLM，仅测规则兜底（明确安全操作）",
    )
    supplement_context: str | None = Field(
        default=None,
        description="用户补充事实/禁忌，单页改文案时作参考",
    )


class PageLayoutIdeasRequest(BaseModel):
    data: dict
    page_index: int = Field(..., ge=0)
    intent: str | None = None


class CleanupUploadsRequest(BaseModel):
    session_id: str | None = None
    urls: list[str] = Field(default_factory=list)


def _safe_session_id(raw: str | None) -> str:
    s = (raw or "").strip()
    if s and SESSION_RE.match(s):
        return s
    return uuid.uuid4().hex


def _session_dir(session_id: str) -> Path:
    d = UPLOAD_DIR / session_id
    d.mkdir(parents=True, exist_ok=True)
    # 禁止目录索引：放空占位，避免误把 uploads 当站点根
    marker = d / ".keep"
    if not marker.exists():
        marker.write_text("", encoding="utf-8")
    return d


def _purge_old_uploads(max_age: int = UPLOAD_MAX_AGE_SEC) -> int:
    """删除超过 max_age 的会话目录与遗留平铺文件。"""
    now = time.time()
    removed = 0
    try:
        for child in UPLOAD_DIR.iterdir():
            try:
                age = now - child.stat().st_mtime
            except OSError:
                continue
            if age < max_age:
                continue
            try:
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                    removed += 1
                elif child.is_file() and child.name != ".keep":
                    child.unlink(missing_ok=True)
                    removed += 1
            except OSError:
                continue
    except OSError:
        pass
    return removed


def _resolve_upload_path(url: str) -> Path | None:
    if not is_safe_upload_url(url):
        return None
    rest = url[len("/uploads/") :]
    path = (UPLOAD_DIR / rest).resolve()
    try:
        path.relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        return None
    return path if path.is_file() else None


@app.on_event("startup")
async def _on_startup():
    _purge_old_uploads()


@app.get("/api/health")
async def health():
    has_key = bool(os.getenv("XHS_LLM_API_KEY", "").strip())
    return {
        "ok": True,
        "service": "xhs-studio",
        "llm_configured": has_key,
        "mode": "llm" if has_key else "demo",
        "upload": {
            "max_count": MAX_UPLOAD_COUNT,
            "max_bytes": MAX_UPLOAD_BYTES,
            "types": ["jpg", "png", "webp"],
            "session_subdir": True,
        },
    }


@app.get("/api/themes")
async def themes():
    return {"themes": list_themes()}


@app.post("/api/upload")
async def api_upload(
    files: list[UploadFile] = File(...),
    session_id: str | None = Form(default=None),
):
    if not files:
        raise HTTPException(400, "请选择至少一张图片")
    if len(files) > MAX_UPLOAD_COUNT:
        raise HTTPException(400, f"一次最多上传 {MAX_UPLOAD_COUNT} 张")

    sid = _safe_session_id(session_id)
    dest_dir = _session_dir(sid)
    results: list[dict] = []
    for f in files:
        ext = basename_ok(f.filename or "")
        ctype = (f.content_type or "").split(";")[0].strip().lower()
        if not ext and ctype in ALLOWED_MIME:
            ext = ALLOWED_MIME[ctype]
        if not ext:
            raise HTTPException(400, f"不支持的格式: {f.filename or 'unknown'}（仅 jpg/png/webp）")

        raw = await f.read()
        if not raw:
            raise HTTPException(400, f"空文件: {f.filename or 'unknown'}")
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(400, f"文件过大（上限 5MB）: {f.filename or 'unknown'}")

        if ext == ".jpg" and not (raw[:3] == b"\xff\xd8\xff"):
            if ctype not in ("image/jpeg", "image/jpg"):
                raise HTTPException(400, f"内容不是 JPEG: {f.filename}")
        if ext == ".png" and not raw.startswith(b"\x89PNG\r\n\x1a\n"):
            if ctype != "image/png":
                raise HTTPException(400, f"内容不是 PNG: {f.filename}")
        if ext == ".webp" and not (len(raw) >= 12 and raw[0:4] == b"RIFF" and raw[8:12] == b"WEBP"):
            if ctype != "image/webp":
                raise HTTPException(400, f"内容不是 WebP: {f.filename}")

        name = f"{uuid.uuid4().hex}{ext}"
        dest = dest_dir / name
        dest.write_bytes(raw)
        url = f"/uploads/{sid}/{name}"
        results.append({
            "url": url,
            "filename": f.filename or name,
            "size": len(raw),
            "content_type": ctype or ALLOWED_MIME.get(ext, "application/octet-stream"),
            "session_id": sid,
        })

    return {
        "ok": True,
        "session_id": sid,
        "files": results,
        "urls": [r["url"] for r in results],
    }


@app.post("/api/uploads/cleanup")
async def api_uploads_cleanup(req: CleanupUploadsRequest):
    """导出后或会话结束时可调用；也可只靠启动时的定期清理。"""
    removed = 0
    sid = (req.session_id or "").strip()
    if sid and SESSION_RE.match(sid):
        target = (UPLOAD_DIR / sid).resolve()
        try:
            target.relative_to(UPLOAD_DIR.resolve())
            if target.is_dir():
                shutil.rmtree(target, ignore_errors=True)
                removed += 1
        except ValueError:
            pass
    for u in req.urls or []:
        path = _resolve_upload_path(u)
        if path is None:
            continue
        try:
            path.unlink(missing_ok=True)
            removed += 1
            parent = path.parent
            if parent != UPLOAD_DIR.resolve() and parent.is_dir() and not any(parent.iterdir()):
                parent.rmdir()
        except OSError:
            continue
    # 顺带清过期
    removed += _purge_old_uploads()
    return {"ok": True, "removed": removed}


@app.post("/api/generate")
async def api_generate(req: GenerateRequest):
    urls = (req.image_urls or [])[:MAX_UPLOAD_COUNT]
    result = await generate(
        req.intent.strip(),
        author=req.author,
        brand=req.brand,
        style=req.style,
        force_demo=req.force_demo,
        image_urls=urls,
        supplement_context=req.supplement_context,
    )
    return result


@app.post("/api/review")
async def api_review(req: ReviewRequest):
    if not isinstance(req.data, dict):
        raise HTTPException(400, "data 必须是对象")
    result = await review_content(
        req.data,
        title=req.title or "",
        caption=req.caption or "",
        intent=(req.intent or "").strip(),
        light=bool(req.light),
    )
    return result


@app.post("/api/revise")
async def api_revise(req: ReviseRequest):
    instr = (req.instruction or "").strip()
    if not instr and not req.issues:
        raise HTTPException(400, "请提供 instruction 或 issues")
    result = await revise(
        req.data,
        instr or "根据审核意见修改",
        page_index=req.page_index,
        caption=req.caption,
        title=req.title,
        issues=req.issues,
        supplement_context=req.supplement_context,
    )
    return result


@app.post("/api/page/revise")
async def api_page_revise(req: PageReviseRequest):
    if not isinstance(req.data, dict):
        raise HTTPException(400, "data 必须是对象")
    # 产品面仅 auto；其它 mode 仍可走后端便于脚本，但默认强制 auto 语义
    mode = (req.mode or "auto").strip().lower()
    if mode not in ("auto", "copy", "layout", "both"):
        raise HTTPException(400, "mode 必须是 auto|copy|layout|both")
    try:
        return await revise_page(
            req.data,
            req.page_index,
            mode=mode,
            instruction=req.instruction,
            title=req.title,
            caption=req.caption,
            page=req.page,
            style=req.style,
            logic_summary=req.logic_summary,
            neighbors=req.neighbors,
            field_path=req.field_path,
            force_rules_fallback=bool(req.force_rules_fallback),
            supplement_context=req.supplement_context,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/page/revise/stream")
async def api_page_revise_stream(req: PageReviseRequest):
    if not isinstance(req.data, dict):
        raise HTTPException(400, "data 必须是对象")
    mode = (req.mode or "auto").strip().lower()
    if mode not in ("auto", "copy", "layout", "both"):
        raise HTTPException(400, "mode 必须是 auto|copy|layout|both")

    async def _ndjson():
        async for line in revise_page_stream(
            req.data,
            req.page_index,
            mode=mode,
            instruction=req.instruction,
            title=req.title,
            caption=req.caption,
            page=req.page,
            style=req.style,
            logic_summary=req.logic_summary,
            neighbors=req.neighbors,
            field_path=req.field_path,
            force_rules_fallback=bool(req.force_rules_fallback),
            supplement_context=req.supplement_context,
        ):
            yield line

    return StreamingResponse(_ndjson(), media_type="application/x-ndjson")


@app.post("/api/page/layout-ideas")
async def api_page_layout_ideas(req: PageLayoutIdeasRequest):
    if not isinstance(req.data, dict):
        raise HTTPException(400, "data 必须是对象")
    try:
        return await layout_ideas(
            req.data,
            req.page_index,
            intent=req.intent,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/validate-export")
async def api_validate_export(req: ValidateExportRequest):
    """0 LLM export gate — title/caption/pages presence (overflow checked client-side)."""
    if not isinstance(req.data, dict):
        raise HTTPException(400, "data 必须是对象")
    pages = req.data.get("pages") if isinstance(req.data.get("pages"), list) else []
    blockers: list[dict] = []
    warnings: list[dict] = []
    title = (req.title or "").strip()
    caption = (req.caption or "").strip()

    def _len(s: str) -> int:
        return len(re.sub(r"\s+", "", s or ""))

    if not pages:
        blockers.append({"code": "no_pages", "message": "没有可导出的页面", "field": "pages"})
    if not title:
        blockers.append({"code": "empty_title", "message": "标题为空", "field": "title"})
    elif _len(title) < 6:
        warnings.append({"code": "short_title", "message": "标题过短", "field": "title"})
    if not caption:
        blockers.append({"code": "empty_caption", "message": "发布正文 caption 为空", "field": "caption"})
    elif _len(caption) < 40:
        warnings.append({"code": "short_caption", "message": "正文过短", "field": "caption"})
    elif "#" not in caption:
        warnings.append({"code": "no_tags", "message": "正文缺少话题标签 #", "field": "caption"})

    return {"ok": not blockers, "blockers": blockers, "warnings": warnings}


@app.get("/")
async def index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)
    return {"message": "frontend missing", "hint": "ensure frontend/index.html exists"}


# html=False：不把目录当站点、不做目录列举；仅按文件名取对象
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR), html=False, check_dir=True),
    name="uploads",
)
if FRONTEND_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR), html=False), name="static")


def main():
    import logging

    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s:%(name)s:%(message)s",
    )
    port = int(os.getenv("XHS_PORT", "8765"))
    # 绑定本机回环；勿改 0.0.0.0 后直接公网裸奔
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
