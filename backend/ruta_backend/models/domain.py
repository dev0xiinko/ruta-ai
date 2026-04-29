from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


AccessType = Literal["direct_access", "nearby_access", "area_access", "transfer_required"]
EntityType = Literal["place", "cluster"]
QueryKind = Literal["place_to_place", "route_check", "place_search", "route_lookup"]


@dataclass(slots=True)
class RouteRecord:
    route_id: str
    code: str
    label: str | None
    route_name: str | None
    origin: str | None
    destination: str | None
    source_urls: list[str]
    area_clusters: list[str]
    search_text: str
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class PlaceRecord:
    place_id: str
    name: str
    canonical_name: str
    normalized_name: str
    type: str
    aliases: list[str]
    normalized_aliases: list[str]
    address: str | None
    address_aliases: list[str]
    street: str | None
    barangay: str | None
    city: str
    province: str
    lat: float | None
    lng: float | None
    area_clusters: list[str]
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class RoutePlaceLinkRecord:
    link_id: str
    route_id: str
    place_id: str
    relation: AccessType | Literal["direct_access", "nearby_access", "area_access"]
    source_field: str
    dropoff_stop: str | None
    walk_minutes: int | None
    distance_m: float | None
    confidence: str
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class RouteTransferRecord:
    transfer_id: str
    route_id: str
    connects_to_route_id: str
    shared_places: list[str]
    shared_areas: list[str]
    transfer_reason: str
    confidence: str
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class AreaClusterRecord:
    cluster_id: str
    name: str
    aliases: list[str]
    normalized_aliases: list[str]
    keywords: list[str]
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class AreaClusterMemberRecord:
    membership_id: str
    cluster_id: str
    place_id: str
    place_name: str
    place_type: str | None
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class ManualOverrideRecord:
    override_id: str
    override_type: str
    match_key: str
    normalized_match_key: str
    target_place_id: str | None
    target_cluster_id: str | None
    target_route_id: str | None
    priority: int
    is_active: bool
    payload: dict[str, Any]
    notes: str | None


@dataclass(slots=True)
class FeedbackRecord:
    feedback_id: str
    session_id: str | None
    page_context: str
    raw_query: str
    feedback_verdict: str
    feedback_notes: str | None
    response_mode: str | None
    response_title: str | None
    response_confidence: str | None
    response_payload: dict[str, Any]
    user_agent: str | None
    created_at: str | None


@dataclass(slots=True)
class RoutingSnapshot:
    routes: dict[str, RouteRecord]
    places: dict[str, PlaceRecord]
    route_place_links: list[RoutePlaceLinkRecord]
    route_transfers: list[RouteTransferRecord]
    area_clusters: dict[str, AreaClusterRecord]
    area_cluster_members: list[AreaClusterMemberRecord]
    manual_overrides: list[ManualOverrideRecord]


@dataclass(slots=True)
class ParsedQuery:
    kind: QueryKind
    raw_query: str
    origin_text: str | None = None
    destination_text: str | None = None
    route_code: str | None = None
    target_text: str | None = None


@dataclass(slots=True)
class ResolvedEntity:
    entity_type: EntityType
    display_name: str
    matched_text: str
    place_ids: list[str] = field(default_factory=list)
    cluster_ids: list[str] = field(default_factory=list)
    confidence: float = 0.0


@dataclass(slots=True)
class AccessMatch:
    route_id: str
    route_code: str
    access_type: AccessType | Literal["direct_access", "nearby_access", "area_access"]
    score: float
    matched_place_ids: list[str]
    matched_cluster_ids: list[str]
    walk_minutes: int | None = None
    distance_m: float | None = None
    dropoff_stop: str | None = None
    source_fields: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RoutePlan:
    response_type: AccessType
    confidence: float
    routes: list[str]
    summary: str
    details: list[dict[str, Any]]


@dataclass(slots=True)
class RouteQueryResponse:
    query: str
    query_kind: QueryKind
    origin: ResolvedEntity | None
    destination: ResolvedEntity | None
    route_code: str | None
    response_type: AccessType | Literal["route_check", "place_search", "route_lookup", "no_match"]
    confidence: float
    answer: str
    routes: list[dict[str, Any]]
    metadata: dict[str, Any]
