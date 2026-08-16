# -*- coding: utf-8 -*-
"""Lightweight timing tracker for LLM / copy generation steps."""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_log = logging.getLogger("xhs.timing")
_LOG_DIR = Path(__file__).resolve().parent / "logs"
_NDJSON = _LOG_DIR / "timing.ndjson"


def _iso_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class _PhaseContext:
    def __init__(self, tracker: TimingTracker, name: str) -> None:
        self._tracker = tracker
        self._name = name
        self._t0 = 0.0

    def __enter__(self) -> _PhaseContext:
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, *_args: object) -> None:
        self._tracker.end_phase(self._name, self._t0)


class TimingTracker:
    """Track wall-clock duration and named phases for one API step."""

    def __init__(self, step: str, *, intent_snippet: str = "") -> None:
        self.step = step
        self.request_id = uuid.uuid4().hex[:12]
        self.intent_snippet = (intent_snippet or "").strip()[:80]
        self.started_at = _iso_now()
        self._t0 = time.perf_counter()
        self.phases: list[dict[str, Any]] = []

    def phase(self, name: str) -> _PhaseContext:
        return _PhaseContext(self, name)

    def end_phase(self, name: str, started: float) -> None:
        ms = max(0, int((time.perf_counter() - started) * 1000))
        self.phases.append({"name": name, "duration_ms": ms})

    def finish(self) -> dict[str, Any]:
        duration_ms = max(0, int((time.perf_counter() - self._t0) * 1000))
        return {
            "request_id": self.request_id,
            "step": self.step,
            "started_at": self.started_at,
            "ended_at": _iso_now(),
            "duration_ms": duration_ms,
            "phases": list(self.phases),
        }

    def log_and_persist(
        self,
        *,
        mode: str = "",
        ok: bool = True,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        timing = self.finish()
        snippet = f" intent={self.intent_snippet!r}" if self.intent_snippet else ""
        _log.info(
            "timing step=%s id=%s duration_ms=%s mode=%s ok=%s%s phases=%s",
            self.step,
            timing["request_id"],
            timing["duration_ms"],
            mode,
            ok,
            snippet,
            [p["name"] for p in timing["phases"]],
        )
        record: dict[str, Any] = {
            **timing,
            "mode": mode,
            "ok": ok,
            **(extra or {}),
        }
        try:
            _LOG_DIR.mkdir(parents=True, exist_ok=True)
            with _NDJSON.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError:
            _log.warning("timing ndjson write failed", exc_info=True)
        return timing
