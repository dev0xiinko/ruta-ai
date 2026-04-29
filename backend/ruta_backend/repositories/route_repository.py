from __future__ import annotations

import time
from difflib import SequenceMatcher
from typing import Any

import psycopg

from ..core.db import DatabaseClient
from ..models import (
    AreaClusterMemberRecord,
    AreaClusterRecord,
    ManualOverrideRecord,
    PlaceRecord,
    RoutePlaceLinkRecord,
    RouteRecord,
    RouteTransferRecord,
    RoutingSnapshot,
)
from ..utils import normalize_text, tokenize_text


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return []


class RouteRepository:
    """Repository around the active route graph schema."""

    def __init__(self, db: DatabaseClient):
        self._db = db
        self._snapshot: RoutingSnapshot | None = None
        self._snapshot_loaded_at = 0.0

    def get_snapshot(self, force_refresh: bool = False) -> RoutingSnapshot:
        """Return a cached in-memory view of the active routing tables."""
        now = time.time()
        if (
            not force_refresh
            and self._snapshot is not None
            and now - self._snapshot_loaded_at < self._db.settings.snapshot_ttl_seconds
        ):
            return self._snapshot

        try:
            with self._db.connect() as conn:
                with conn.cursor() as cur:
                    routes_rows = cur.execute("select * from public.routes").fetchall()
                    places_rows = cur.execute("select * from public.places").fetchall()
                    route_place_links_rows = cur.execute("select * from public.route_place_links").fetchall()
                    route_transfers_rows = cur.execute("select * from public.route_transfers").fetchall()
                    area_clusters_rows = cur.execute("select * from public.area_clusters").fetchall()
                    area_cluster_members_rows = cur.execute("select * from public.area_cluster_members").fetchall()
                    manual_overrides_rows = cur.execute(
                        "select * from public.manual_overrides where is_active = true order by priority desc"
                    ).fetchall()
        except psycopg.OperationalError:
            rest = self._db.rest()
            routes_rows = rest.select_all("routes")
            places_rows = rest.select_all("places")
            route_place_links_rows = rest.select_all("route_place_links")
            route_transfers_rows = rest.select_all("route_transfers")
            area_clusters_rows = rest.select_all("area_clusters")
            area_cluster_members_rows = rest.select_all("area_cluster_members")
            manual_overrides_rows = [row for row in rest.select_all("manual_overrides") if row.get("is_active") is True]

        self._snapshot = RoutingSnapshot(
            routes={
                row["route_id"]: RouteRecord(
                    route_id=row["route_id"],
                    code=row["code"],
                    label=row["label"],
                    route_name=row["route_name"],
                    origin=row["origin"],
                    destination=row["destination"],
                    source_urls=_as_list(row["source_urls"]),
                    area_clusters=_as_list(row["area_clusters"]),
                    search_text=row["search_text"] or "",
                    raw_payload=row["raw_payload"] or {},
                )
                for row in routes_rows
            },
            places={
                row["place_id"]: PlaceRecord(
                    place_id=row["place_id"],
                    name=row["name"],
                    canonical_name=row["canonical_name"],
                    normalized_name=row["normalized_name"],
                    type=row["type"],
                    aliases=_as_list(row["aliases"]),
                    normalized_aliases=_as_list(row["normalized_aliases"]),
                    address=row["address"],
                    address_aliases=_as_list(row["address_aliases"]),
                    street=row["street"],
                    barangay=row["barangay"],
                    city=row["city"],
                    province=row["province"],
                    lat=row["lat"],
                    lng=row["lng"],
                    area_clusters=_as_list(row["area_clusters"]),
                    raw_payload=row["raw_payload"] or {},
                )
                for row in places_rows
            },
            route_place_links=[
                RoutePlaceLinkRecord(
                    link_id=row["link_id"],
                    route_id=row["route_id"],
                    place_id=row["place_id"],
                    relation=row["relation"],
                    source_field=row["source_field"],
                    dropoff_stop=row["dropoff_stop"],
                    walk_minutes=row["walk_minutes"],
                    distance_m=row["distance_m"],
                    confidence=row["confidence"],
                    raw_payload=row["raw_payload"] or {},
                )
                for row in route_place_links_rows
            ],
            route_transfers=[
                RouteTransferRecord(
                    transfer_id=row["transfer_id"],
                    route_id=row["route_id"],
                    connects_to_route_id=row["connects_to_route_id"],
                    shared_places=_as_list(row["shared_places"]),
                    shared_areas=_as_list(row["shared_areas"]),
                    transfer_reason=row["transfer_reason"],
                    confidence=row["confidence"],
                    raw_payload=row["raw_payload"] or {},
                )
                for row in route_transfers_rows
            ],
            area_clusters={
                row["cluster_id"]: AreaClusterRecord(
                    cluster_id=row["cluster_id"],
                    name=row["name"],
                    aliases=_as_list(row["aliases"]),
                    normalized_aliases=_as_list(row["normalized_aliases"]),
                    keywords=_as_list(row["keywords"]),
                    raw_payload=row["raw_payload"] or {},
                )
                for row in area_clusters_rows
            },
            area_cluster_members=[
                AreaClusterMemberRecord(
                    membership_id=row["membership_id"],
                    cluster_id=row["cluster_id"],
                    place_id=row["place_id"],
                    place_name=row["place_name"],
                    place_type=row["place_type"],
                    raw_payload=row["raw_payload"] or {},
                )
                for row in area_cluster_members_rows
            ],
            manual_overrides=[
                ManualOverrideRecord(
                    override_id=str(row["override_id"]),
                    override_type=row["override_type"],
                    match_key=row["match_key"],
                    normalized_match_key=row["normalized_match_key"],
                    target_place_id=row["target_place_id"],
                    target_cluster_id=row["target_cluster_id"],
                    target_route_id=row["target_route_id"],
                    priority=row["priority"],
                    is_active=row["is_active"],
                    payload=row["payload"] or {},
                    notes=row["notes"],
                )
                for row in manual_overrides_rows
            ],
        )
        self._snapshot_loaded_at = now
        return self._snapshot

    def get_place_candidates_by_text(self, text: str) -> list[PlaceRecord]:
        """Return ranked place candidates from the active places table."""
        normalized = normalize_text(text)
        if not normalized:
            return []

        snapshot = self.get_snapshot()
        scored: list[tuple[float, PlaceRecord]] = []
        for place in snapshot.places.values():
            candidates = [
                place.normalized_name,
                normalize_text(place.name),
                normalize_text(place.canonical_name),
                *(normalize_text(alias) for alias in place.aliases),
                *(normalize_text(alias) for alias in place.normalized_aliases),
                *(normalize_text(alias) for alias in place.address_aliases),
            ]
            score = max((self._score_text_match(normalized, candidate) for candidate in candidates if candidate), default=0.0)
            if score > 0:
                scored.append((score, place))

        scored.sort(key=lambda item: (-item[0], item[1].name.lower()))
        return [place for _score, place in scored[:10]]

    def get_cluster_candidates_by_text(self, text: str) -> list[AreaClusterRecord]:
        """Return ranked area-cluster candidates from the active cluster tables."""
        normalized = normalize_text(text)
        if not normalized:
            return []

        snapshot = self.get_snapshot()
        scored: list[tuple[float, AreaClusterRecord]] = []
        for cluster in snapshot.area_clusters.values():
            candidates = [
                normalize_text(cluster.name),
                *(normalize_text(alias) for alias in cluster.aliases),
                *(normalize_text(alias) for alias in cluster.normalized_aliases),
                *(normalize_text(keyword) for keyword in cluster.keywords),
            ]
            score = max((self._score_text_match(normalized, candidate) for candidate in candidates if candidate), default=0.0)
            if score > 0:
                scored.append((score, cluster))

        scored.sort(key=lambda item: (-item[0], item[1].name.lower()))
        return [cluster for _score, cluster in scored[:10]]

    def get_manual_override(self, text: str, override_type: str | None = None) -> ManualOverrideRecord | None:
        """Return the highest-priority active override for the normalized text."""
        normalized = normalize_text(text)
        if not normalized:
            return None

        snapshot = self.get_snapshot()
        for override in snapshot.manual_overrides:
            if not override.is_active or override.normalized_match_key != normalized:
                continue
            if override_type is not None and override.override_type != override_type:
                continue
            return override
        return None

    def get_route_links_for_place_ids(self, place_ids: list[str]) -> list[RoutePlaceLinkRecord]:
        """Return all route-place links attached to the given place ids."""
        place_id_set = set(place_ids)
        if not place_id_set:
            return []

        snapshot = self.get_snapshot()
        return [link for link in snapshot.route_place_links if link.place_id in place_id_set]

    def get_direct_routes_between_places(self, origin_place_ids: list[str], destination_place_ids: list[str]) -> list[RouteRecord]:
        """Return routes that touch both the origin and destination place sets."""
        origin_route_ids = {link.route_id for link in self.get_route_links_for_place_ids(origin_place_ids)}
        destination_route_ids = {link.route_id for link in self.get_route_links_for_place_ids(destination_place_ids)}
        route_ids = sorted(origin_route_ids & destination_route_ids)
        return self.get_routes_by_ids(route_ids)

    def get_transfer_routes_between_places(
        self,
        origin_place_ids: list[str],
        destination_place_ids: list[str],
        max_transfers: int = 1,
    ) -> list[tuple[RouteRecord, RouteRecord, RouteTransferRecord]]:
        """Return one-transfer route pairs that connect origin-linked and destination-linked routes."""
        if max_transfers != 1:
            raise ValueError("Only max_transfers=1 is supported in the current incremental refactor.")

        snapshot = self.get_snapshot()
        origin_route_ids = {link.route_id for link in self.get_route_links_for_place_ids(origin_place_ids)}
        destination_route_ids = {link.route_id for link in self.get_route_links_for_place_ids(destination_place_ids)}

        results: list[tuple[RouteRecord, RouteRecord, RouteTransferRecord]] = []
        for transfer in snapshot.route_transfers:
            if transfer.route_id not in origin_route_ids or transfer.connects_to_route_id not in destination_route_ids:
                continue
            first = snapshot.routes.get(transfer.route_id)
            second = snapshot.routes.get(transfer.connects_to_route_id)
            if first is None or second is None:
                continue
            results.append((first, second, transfer))
        return results

    def get_cluster_members(self, cluster_ids: list[str]) -> list[AreaClusterMemberRecord]:
        """Return all place memberships for the given cluster ids."""
        cluster_id_set = set(cluster_ids)
        if not cluster_id_set:
            return []

        snapshot = self.get_snapshot()
        return [member for member in snapshot.area_cluster_members if member.cluster_id in cluster_id_set]

    def get_routes_by_ids(self, route_ids: list[str]) -> list[RouteRecord]:
        """Return route records in the same order as the provided ids."""
        snapshot = self.get_snapshot()
        return [snapshot.routes[route_id] for route_id in route_ids if route_id in snapshot.routes]

    def _score_text_match(self, query: str, candidate: str) -> float:
        query_tokens = set(tokenize_text(query))
        candidate_tokens = set(tokenize_text(candidate))
        if not query or not candidate:
            return 0.0
        if query == candidate:
            return 1.0
        if query.replace(" ", "") == candidate.replace(" ", ""):
            return 0.98

        score = 0.0
        if query in candidate or candidate in query:
            score = max(score, 0.84)

        if query_tokens and candidate_tokens:
            overlap = len(query_tokens & candidate_tokens) / max(len(query_tokens), len(candidate_tokens))
            if overlap >= 1.0:
                score = max(score, 0.9)
            elif overlap >= 0.66:
                score = max(score, 0.8)
            elif overlap >= 0.5:
                score = max(score, 0.72)

        similarity = SequenceMatcher(None, query.replace(" ", ""), candidate.replace(" ", "")).ratio()
        if similarity >= 0.92:
            score = max(score, 0.82)
        elif similarity >= 0.84:
            score = max(score, 0.74)
        elif similarity >= 0.74:
            score = max(score, 0.62)

        return score if score >= 0.58 else 0.0
