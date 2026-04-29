from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import FeedbackResponse, RouteFeedbackRequest
from .deps import get_query_logger

router = APIRouter()


@router.post("/api/route-feedback")
@router.post("/api/feedback")
def route_feedback(body: RouteFeedbackRequest) -> FeedbackResponse:
    raw_query = body.raw_query.strip()
    if not raw_query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        payload = get_query_logger().log_feedback_submission(
            session_id=body.session_id,
            page_context=body.page_context.strip() or "simulation",
            raw_query=raw_query,
            feedback_verdict=body.feedback_verdict,
            feedback_notes=body.feedback_notes.strip() if body.feedback_notes else None,
            response=body.response,
            user_agent=body.user_agent,
        )
        return FeedbackResponse(**payload)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
