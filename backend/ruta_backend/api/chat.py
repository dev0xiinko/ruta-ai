from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import ChatRequest, ChatResponse
from .deps import get_chat_service

router = APIRouter()


@router.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> dict:
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")

    try:
        return get_chat_service().answer(message, force_refresh=body.force_refresh)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
