from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .service import RutaResponseService
from .settings import Settings


class RouteQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    force_refresh: bool = False


class RouteFeedbackRequest(BaseModel):
    session_id: str | None = None
    page_context: str = "simulation"
    raw_query: str = Field(..., min_length=1)
    feedback_verdict: str = Field(..., pattern="^(good|bad)$")
    feedback_notes: str | None = None
    response: dict | None = None
    user_agent: str | None = None


settings = Settings.from_env()
service = RutaResponseService.from_settings(settings)
app = FastAPI(title="RUTA Route Query API", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/route-query")
def route_query(body: RouteQueryRequest) -> dict:
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        return service.answer(query, force_refresh=body.force_refresh)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/route-feedback")
def route_feedback(body: RouteFeedbackRequest) -> dict:
    raw_query = body.raw_query.strip()
    if not raw_query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        return service.save_feedback(
            session_id=body.session_id,
            page_context=body.page_context.strip() or "simulation",
            raw_query=raw_query,
            feedback_verdict=body.feedback_verdict,
            feedback_notes=body.feedback_notes.strip() if body.feedback_notes else None,
            response=body.response,
            user_agent=body.user_agent,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
