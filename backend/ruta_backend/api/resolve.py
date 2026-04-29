from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import ResolveRequest, ResolveResponse
from ..services import Resolver
from .deps import get_route_repository

router = APIRouter()


@router.post("/api/resolve", response_model=ResolveResponse)
def resolve(body: ResolveRequest) -> ResolveResponse:
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    snapshot = get_route_repository().get_snapshot()
    return ResolveResponse(resolution=Resolver(snapshot).resolve_text(text))
