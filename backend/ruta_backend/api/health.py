from __future__ import annotations

import httpx
from fastapi import APIRouter

from ..models import HealthResponse
from .deps import get_db_client, get_settings

router = APIRouter()


@router.get("/healthz", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
def healthz() -> HealthResponse:
    settings = get_settings()
    db_status = _db_status()
    ollama_status = _ollama_status()
    if not settings.database_url and db_status == "missing_database_url":
        return HealthResponse(status="ok", db_status=db_status, ollama_status=ollama_status)
    return HealthResponse(status="ok", db_status=db_status, ollama_status=ollama_status)


def _db_status() -> str:
    settings = get_settings()
    if not settings.database_url:
        return "missing_database_url"

    try:
        with get_db_client().connect() as conn:
            with conn.cursor() as cur:
                cur.execute("select 1")
        return "ok"
    except Exception:
        return "unreachable"


def _ollama_status() -> str:
    try:
        response = httpx.get("http://127.0.0.1:11434/api/tags", timeout=2.0)
        response.raise_for_status()
        return "ok"
    except httpx.HTTPError:
        return "unreachable"
