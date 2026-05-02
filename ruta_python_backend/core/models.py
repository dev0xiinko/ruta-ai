from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

RoutePlanType = Literal[
    "direct",
    "walk_only",
    "walk_ride",
    "ride_walk",
    "multi_hop",
    "no_verified_route",
]
ConfidenceBand = Literal["high", "medium", "low"]


class Place(BaseModel):
    place_id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    area: str | None = None
    cluster_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    importance_rank: int = 50


class Route(BaseModel):
    route_code: str
    name: str
    description: str | None = None
    qa_status: str = "high_confidence"
    confidence: float = 0.9


class RoutePlaceLink(BaseModel):
    route_code: str
    place_id: str
    access_type: Literal["direct_access", "nearby_access", "area_access"] = "direct_access"
    pickup: bool = True
    dropoff: bool = True


class RouteTransfer(BaseModel):
    from_route_code: str
    to_route_code: str
    transfer_place_id: str
    bidirectional: bool = True


class WalkLink(BaseModel):
    from_place_id: str
    to_place_id: str
    walk_minutes: int
    distance_m: int | None = None
    bidirectional: bool = True


class RouteDirection(BaseModel):
    direction_id: str
    route_code: str
    headsign: str
    stop_place_ids: list[str] = Field(default_factory=list)


class RouteStep(BaseModel):
    step_no: int
    mode: Literal["walk", "ride"]
    from_place_id: str | None = None
    to_place_id: str | None = None
    walk_minutes: int | None = None
    distance_m: int | None = None
    route_code: str | None = None
    routes: list[str] = Field(default_factory=list)
    dropoff_place_id: str | None = None
    direction_id: str | None = None
    headsign: str | None = None
    direction_status: Literal["valid", "unknown", "invalid"] | None = None
    instruction: str | None = None
    notes: list[str] = Field(default_factory=list)


class ValidationResult(BaseModel):
    passed: bool
    rules_checked: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class RoutePlan(BaseModel):
    route_plan_id: str
    origin_place_id: str
    destination_place_id: str
    type: RoutePlanType
    confidence: ConfidenceBand
    steps: list[RouteStep] = Field(default_factory=list)
    validation: ValidationResult = Field(
        default_factory=lambda: ValidationResult(passed=False)
    )
    score: int = 0


class ODTruthEntry(BaseModel):
    origin_place_id: str
    destination_place_id: str
    route_type: RoutePlanType
    routes: list[str] = Field(default_factory=list)
    confidence: ConfidenceBand = "high"
    validated: bool = True
    steps: list[RouteStep] = Field(default_factory=list)


class PlaceCandidate(BaseModel):
    place_id: str
    name: str
    confidence: float
    match_reason: str


class ExtractedQuery(BaseModel):
    origin_text: str | None = None
    destination_text: str | None = None
    query_language: str = "en"
    needs_route_answer: bool = True


class ResolveRouteRequest(BaseModel):
    query: str
    language_hint: str = "auto"


class ComputeRouteRequest(BaseModel):
    origin_place_id: str
    destination_place_id: str
    confirmed: bool = False


class FeedbackRequest(BaseModel):
    query: str
    system_answer: str
    user_verdict: Literal["correct", "incorrect", "needs_clarification"]
    correct_route: str | list[str] | None = None
    notes: str | None = None


class FeedbackEntry(BaseModel):
    query: str
    system_answer: str
    user_verdict: str
    correct_route: list[str] = Field(default_factory=list)
    notes: str | None = None
    source: str = "user_feedback"


class AreaCluster(BaseModel):
    cluster_id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    place_ids: list[str] = Field(default_factory=list)


class DirectionCheck(BaseModel):
    status: Literal["valid", "unknown", "invalid"]
    direction_id: str | None = None
    headsign: str | None = None


class CandidatePatch(BaseModel):
    status: Literal["candidate_patch"] = "candidate_patch"
    origin_text: str
    destination_text: str
    suggested_routes: list[str] = Field(default_factory=list)
    source: str = "llm_suggestion"
    needs_validation: bool = True
    notes: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)
