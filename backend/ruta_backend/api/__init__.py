from __future__ import annotations

from fastapi import FastAPI

from .chat import router as chat_router
from .feedback import router as feedback_router
from .health import router as health_router
from .resolve import router as resolve_router
from .route import router as route_router

app = FastAPI(title="RUTA Route Query API", version="0.2.0")
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(resolve_router)
app.include_router(route_router)
app.include_router(feedback_router)

__all__ = ["app"]
