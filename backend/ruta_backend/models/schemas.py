from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SchemaModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RouteQueryRequest(SchemaModel):
    query: str = Field(..., min_length=1)
    force_refresh: bool = False


class RouteFeedbackRequest(SchemaModel):
    session_id: str | None = None
    page_context: str = "simulation"
    raw_query: str = Field(..., min_length=1)
    feedback_verdict: str = Field(..., pattern="^(good|bad)$")
    feedback_notes: str | None = None
    response: dict[str, Any] | None = None
    user_agent: str | None = None


class ChatRequest(SchemaModel):
    message: str = Field(..., min_length=1)
    force_refresh: bool = False


class ParseResult(SchemaModel):
    intent: Literal["route_query", "route_check", "route_lookup"] = "route_query"
    origin_text: str | None = None
    destination_text: str | None = None
    route_code: str | None = None
    language: Literal["ceb", "en", "mixed"] = "mixed"
    confidence: Literal["high", "medium", "low"] = "low"


class ResolutionCandidate(SchemaModel):
    id: str
    name: str
    entity_type: Literal["place", "cluster"]
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: str


class ResolutionResult(SchemaModel):
    text: str
    top_match: ResolutionCandidate | None = None
    candidates: list[ResolutionCandidate] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "low"
    match_type: Literal["place", "cluster", "override", "none"] = "none"
    reason: str = "No match yet."


class ResolveRequest(SchemaModel):
    text: str = Field(..., min_length=1)


class ResolveResponse(SchemaModel):
    status: Literal["success"] = "success"
    resolution: ResolutionResult


class RouteRequest(SchemaModel):
    origin_text: str = Field(..., min_length=1)
    destination_text: str = Field(..., min_length=1)
    language: Literal["ceb", "en", "mixed"] = "mixed"
    force_refresh: bool = False


class RouteLeg(SchemaModel):
    route_code: str
    route_name: str | None = None
    relation: str
    walk_minutes: int | None = None
    distance_m: float | None = None
    stop_hint: str | None = None


class RouteOption(SchemaModel):
    rank: int = Field(..., ge=1)
    route_codes: list[str] = Field(default_factory=list)
    transfers: int = Field(default=0, ge=0)
    legs: list[RouteLeg] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    why: str


class RouteComputationResult(SchemaModel):
    status: Literal["success", "no_match"] = "success"
    mode: Literal["direct", "transfer", "fallback", "no_match"]
    origin: ResolutionResult | None = None
    destination: ResolutionResult | None = None
    options: list[RouteOption] = Field(default_factory=list)
    message: str | None = None


class RouteResponse(SchemaModel):
    status: Literal["success"] = "success"
    result: RouteComputationResult


class ChatData(SchemaModel):
    parse: ParseResult
    route: RouteResponse


class ChatResponse(SchemaModel):
    status: Literal["success"] = "success"
    data: ChatData


class FeedbackRequest(SchemaModel):
    session_id: str | None = None
    page_context: str = "simulation"
    raw_query: str = Field(..., min_length=1)
    feedback_verdict: str = Field(..., pattern="^(good|bad)$")
    feedback_notes: str | None = None
    response_mode: str | None = None
    response_title: str | None = None
    response_confidence: str | None = None
    response_payload: dict[str, Any] = Field(default_factory=dict)
    user_agent: str | None = None


class FeedbackResponse(SchemaModel):
    ok: Literal[True] = True


class HealthResponse(SchemaModel):
    status: Literal["ok"] = "ok"
    db_status: Literal["ok", "configured", "missing_database_url", "unreachable"] = "configured"
    ollama_status: Literal["ok", "not_configured", "unreachable"] = "not_configured"
