from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ruta_python_backend.core.models import (
    ComputeRouteRequest,
    FeedbackRequest,
    ResolveRouteRequest,
)
from ruta_python_backend.core.service import RouteService

service = RouteService()

app = FastAPI(
    title="RUTA Python Backend",
    version="1.0.0",
    description="Dataset-first routing backend for RUTA commuter queries.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "dataset_dir": str(service.dataset.dataset_dir),
        "place_count": len(service.dataset.places),
        "route_count": len(service.dataset.routes),
    }


@app.post("/api/route/resolve")
def resolve_route(payload: ResolveRouteRequest) -> dict[str, object]:
    try:
        return service.resolve_query(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/route/compute")
def compute_route(payload: ComputeRouteRequest) -> dict[str, object]:
    try:
        return service.compute_route(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/route/feedback")
def submit_feedback(payload: FeedbackRequest) -> dict[str, object]:
    try:
        return service.submit_feedback(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
