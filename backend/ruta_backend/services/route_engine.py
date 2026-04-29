from __future__ import annotations

from collections import defaultdict

from ..models import AccessMatch, AccessType, ResolvedEntity, RoutePlan, RoutingSnapshot
from ..utils import dedupe_keep_order
from .ranker import Ranker


class RouteEngine:
    """Deterministic planner for direct, transfer, and fallback route options."""

    def __init__(self, snapshot: RoutingSnapshot):
        self.snapshot = snapshot
        self.ranker = Ranker()
        self.links_by_place_id = defaultdict(list)
        self.transfers_by_route_id = defaultdict(list)
        self.routes_by_cluster_id = defaultdict(set)
        self._build_indexes()

    def build_access_matches(self, entity: ResolvedEntity) -> dict[str, AccessMatch]:
        matches: dict[str, AccessMatch] = {}

        for place_id in entity.place_ids:
            for link in self.links_by_place_id.get(place_id, []):
                access_type = self._normalized_access_type_for_link(
                    link.relation,
                    link.source_field,
                    link.walk_minutes,
                    link.distance_m,
                )
                score = self._relation_score(
                    access_type,
                    link.confidence,
                    link.source_field,
                    link.walk_minutes,
                    link.distance_m,
                )
                current = matches.get(link.route_id)
                if current is None or score > current.score:
                    matches[link.route_id] = AccessMatch(
                        route_id=link.route_id,
                        route_code=self.snapshot.routes[link.route_id].code,
                        access_type=access_type,
                        score=score,
                        matched_place_ids=[place_id],
                        matched_cluster_ids=[],
                        walk_minutes=link.walk_minutes,
                        distance_m=link.distance_m,
                        dropoff_stop=link.dropoff_stop,
                        source_fields=[link.source_field],
                    )
                else:
                    current.matched_place_ids = dedupe_keep_order([*current.matched_place_ids, place_id])
                    current.source_fields = dedupe_keep_order([*current.source_fields, link.source_field])
                    current.walk_minutes = self._min_optional_int(current.walk_minutes, link.walk_minutes)
                    current.distance_m = self._min_optional_float(current.distance_m, link.distance_m)

        for cluster_id in entity.cluster_ids:
            for route_id in self.routes_by_cluster_id.get(cluster_id, set()):
                current = matches.get(route_id)
                cluster_score = self._cluster_access_score(entity.entity_type)
                if current is None or cluster_score > current.score:
                    matches[route_id] = AccessMatch(
                        route_id=route_id,
                        route_code=self.snapshot.routes[route_id].code,
                        access_type="area_access",
                        score=cluster_score,
                        matched_place_ids=[],
                        matched_cluster_ids=[cluster_id],
                        source_fields=[f"area_cluster:{cluster_id}"],
                    )
                else:
                    current.matched_cluster_ids = dedupe_keep_order([*current.matched_cluster_ids, cluster_id])

        return matches

    def find_direct_routes(self, origin_resolution: ResolvedEntity, destination_resolution: ResolvedEntity) -> RoutePlan | None:
        origin_access = self.build_access_matches(origin_resolution)
        destination_access = self.build_access_matches(destination_resolution)
        candidates: list[tuple[AccessMatch, AccessMatch, float, AccessType]] = []

        for route_id, origin_match in origin_access.items():
            destination_match = destination_access.get(route_id)
            if not destination_match:
                continue

            score, response_type = self.ranker.score_direct_option(origin_match, destination_match)
            candidates.append((origin_match, destination_match, score, response_type))

        if not candidates:
            return None

        candidates.sort(key=lambda item: item[2], reverse=True)
        top = candidates[:3]
        best_origin, best_destination, confidence, response_type = top[0]

        answer = self._format_direct_plan_answer(
            origin_resolution.display_name,
            destination_resolution.display_name,
            best_origin,
            best_destination,
        )
        details = [
            {
                "route_code": self.snapshot.routes[origin_match.route_id].code,
                "route_name": self.snapshot.routes[origin_match.route_id].route_name,
                "match_type": combined_type,
                "origin_access": origin_match.access_type,
                "destination_access": destination_match.access_type,
                "origin_walk_minutes": origin_match.walk_minutes,
                "destination_walk_minutes": destination_match.walk_minutes,
                "dropoff_stop": destination_match.dropoff_stop,
                "score": round(score, 3),
            }
            for origin_match, destination_match, score, combined_type in top
        ]

        return RoutePlan(
            response_type=response_type,
            confidence=confidence,
            routes=[detail["route_code"] for detail in details],
            summary=answer,
            details=details,
        )

    def find_transfer_routes(
        self,
        origin_resolution: ResolvedEntity,
        destination_resolution: ResolvedEntity,
        max_transfers: int = 1,
    ) -> RoutePlan | None:
        if max_transfers != 1:
            raise ValueError("Only max_transfers=1 is supported right now.")

        origin_access = self.build_access_matches(origin_resolution)
        destination_access = self.build_access_matches(destination_resolution)
        options: list[tuple[AccessMatch, AccessMatch, float, str, list[str], list[str]]] = []

        for first_leg in origin_access.values():
            for transfer in self.transfers_by_route_id.get(first_leg.route_id, []):
                second_leg = destination_access.get(transfer.connects_to_route_id)
                if not second_leg:
                    continue
                transfer_bonus = self._transfer_bonus(
                    transfer.transfer_reason,
                    transfer.confidence,
                    transfer.shared_places,
                    transfer.shared_areas,
                )
                leg_bonus = self._transfer_leg_bonus(first_leg.access_type, second_leg.access_type)
                score = self.ranker.score_transfer_option(first_leg, second_leg, transfer_bonus, leg_bonus)
                options.append(
                    (
                        first_leg,
                        second_leg,
                        score,
                        transfer.transfer_reason,
                        transfer.shared_places,
                        transfer.shared_areas,
                    )
                )

        if not options:
            return None

        options.sort(key=lambda item: item[2], reverse=True)
        top = options[:3]
        first_leg, second_leg, confidence, _reason, shared_places, shared_areas = top[0]
        transfer_hint = self._humanize_transfer_hint(shared_places, shared_areas)

        details = [
            {
                "first_route": first.route_code,
                "second_route": second.route_code,
                "origin_access": first.access_type,
                "destination_access": second.access_type,
                "transfer_hint": self._humanize_transfer_hint(places, areas),
                "score": round(score, 3),
            }
            for first, second, score, _reason, places, areas in top
        ]
        answer = (
            f"There is no strong one-seat ride from {origin_resolution.display_name} to {destination_resolution.display_name}, "
            f"but you can likely do it in two legs: ride {first_leg.route_code} first, then transfer to "
            f"{second_leg.route_code} around {transfer_hint}."
        )

        return RoutePlan(
            response_type="transfer_required",
            confidence=confidence,
            routes=dedupe_keep_order(
                route_code
                for detail in details
                for route_code in [detail["first_route"], detail["second_route"]]
            ),
            summary=answer,
            details=details,
        )

    def find_best_effort_plan(
        self,
        origin_candidates: list[ResolvedEntity],
        destination_candidates: list[ResolvedEntity],
    ) -> tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None:
        origin_options = [
            (origin, match)
            for origin in origin_candidates
            for match in sorted(self.build_access_matches(origin).values(), key=lambda item: item.score, reverse=True)[:3]
        ]
        destination_options = [
            (destination, match)
            for destination in destination_candidates
            for match in sorted(self.build_access_matches(destination).values(), key=lambda item: item.score, reverse=True)[:3]
        ]

        if not origin_options or not destination_options:
            return None

        best_match: tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None = None
        best_score = 0.0

        for origin, first_leg in origin_options:
            for destination, second_leg in destination_options:
                if first_leg.route_id == second_leg.route_id:
                    continue

                shared_clusters = dedupe_keep_order(
                    cluster_id
                    for cluster_id in self.snapshot.routes[first_leg.route_id].area_clusters
                    if cluster_id in self.snapshot.routes[second_leg.route_id].area_clusters
                )
                transfer_hint = (
                    self.snapshot.area_clusters[shared_clusters[0]].name
                    if shared_clusters
                    else self._clean_stop_hint(second_leg.dropoff_stop)
                    or self._clean_stop_hint(first_leg.dropoff_stop)
                    or "a major transfer point"
                )
                score = self.ranker.score_fallback_option(first_leg, second_leg, origin.confidence, destination.confidence)
                plan = RoutePlan(
                    response_type="transfer_required",
                    confidence=score,
                    routes=dedupe_keep_order([first_leg.route_code, second_leg.route_code]),
                    summary=(
                        f"A practical fallback from {origin.display_name} to {destination.display_name} is to ride "
                        f"{first_leg.route_code} first, then continue with {second_leg.route_code}. "
                        f"Try transferring around {transfer_hint} and confirm with the driver on the ground."
                    ),
                    details=[
                        {
                            "first_route": first_leg.route_code,
                            "second_route": second_leg.route_code,
                            "origin_access": first_leg.access_type,
                            "destination_access": second_leg.access_type,
                            "transfer_hint": transfer_hint,
                            "score": round(score, 3),
                            "fallback": True,
                        }
                    ],
                )
                if best_match is None or score > best_score:
                    best_match = (origin, destination, plan)
                    best_score = score

        return best_match

    def compute_route_options(
        self,
        origin_candidates: list[ResolvedEntity],
        destination_candidates: list[ResolvedEntity],
    ) -> tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None:
        scored_matches: list[tuple[float, ResolvedEntity, ResolvedEntity, RoutePlan]] = []

        direct_match = self._find_best_plan_across_candidates(origin_candidates, destination_candidates, self.find_direct_routes)
        if direct_match:
            origin, destination, direct_plan = direct_match
            direct_bonus = self.ranker.route_plan_bonus(direct_plan)
            scored_matches.append((direct_plan.confidence + direct_bonus, origin, destination, direct_plan))

        transfer_match = self._find_best_plan_across_candidates(origin_candidates, destination_candidates, self.find_transfer_routes)
        if transfer_match:
            origin, destination, transfer_plan = transfer_match
            transfer_bonus = self.ranker.route_plan_bonus(transfer_plan)
            scored_matches.append((transfer_plan.confidence + transfer_bonus, origin, destination, transfer_plan))

        fallback_match = self.find_best_effort_plan(origin_candidates, destination_candidates)
        if fallback_match:
            origin, destination, fallback_plan = fallback_match
            scored_matches.append((fallback_plan.confidence, origin, destination, fallback_plan))

        if not scored_matches:
            return None

        _score, origin, destination, plan = max(scored_matches, key=lambda item: item[0])
        return origin, destination, plan

    def _build_indexes(self) -> None:
        for route in self.snapshot.routes.values():
            for cluster_id in route.area_clusters:
                self.routes_by_cluster_id[cluster_id].add(route.route_id)

        for link in self.snapshot.route_place_links:
            self.links_by_place_id[link.place_id].append(link)
            place = self.snapshot.places.get(link.place_id)
            if place:
                for cluster_id in place.area_clusters:
                    self.routes_by_cluster_id[cluster_id].add(link.route_id)

        for transfer in self.snapshot.route_transfers:
            self.transfers_by_route_id[transfer.route_id].append(transfer)

    def _find_best_plan_across_candidates(self, origin_candidates, destination_candidates, planner):
        best_match: tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None = None
        best_score = 0.0

        for origin in origin_candidates:
            for destination in destination_candidates:
                plan = planner(origin, destination)
                if not plan:
                    continue
                combined_score = self.ranker.score_plan_with_resolution_confidence(
                    plan,
                    origin.confidence,
                    destination.confidence,
                )
                if best_match is None or combined_score > best_score:
                    plan.confidence = combined_score
                    best_match = (origin, destination, plan)
                    best_score = combined_score

        return best_match

    def _format_direct_plan_answer(
        self,
        origin_name: str,
        destination_name: str,
        origin_match: AccessMatch,
        destination_match: AccessMatch,
    ) -> str:
        route = self.snapshot.routes[origin_match.route_id]
        parts = [
            f"From {origin_name} to {destination_name}, ride {route.code}.",
            f"It looks like {self._article_for_access_type(self._combine_access_types(origin_match.access_type, destination_match.access_type))} "
            f"{self._humanize_access_type(self._combine_access_types(origin_match.access_type, destination_match.access_type))} option.",
        ]
        if origin_match.walk_minutes:
            parts.append(f"Expect around {origin_match.walk_minutes} minutes of walking to board.")
        if destination_match.walk_minutes:
            parts.append(f"Expect around {destination_match.walk_minutes} minutes of walking after you get off.")
        dropoff_hint = self._clean_stop_hint(destination_match.dropoff_stop)
        if dropoff_hint:
            parts.append(f"Best drop-off clue: {dropoff_hint}.")
        return " ".join(parts)

    def _combine_access_types(self, origin_access: AccessType, destination_access: AccessType) -> AccessType:
        return self.ranker.combine_access_types(origin_access, destination_access)

    def _humanize_access_type(self, access_type: AccessType) -> str:
        return self.ranker.humanize_access_type(access_type)

    def _article_for_access_type(self, access_type: AccessType) -> str:
        return self.ranker.article_for_access_type(access_type)

    def _normalized_access_type_for_link(
        self,
        relation: str,
        source_field: str,
        walk_minutes: int | None,
        distance_m: float | None,
    ) -> AccessType:
        return self.ranker.normalized_access_type_for_link(relation, source_field, walk_minutes, distance_m)

    def _cluster_access_score(self, entity_type: str) -> float:
        return self.ranker.cluster_access_score(entity_type)

    def _transfer_bonus(
        self,
        transfer_reason: str,
        confidence: str,
        shared_places: list[str],
        shared_areas: list[str],
    ) -> float:
        return self.ranker.transfer_bonus(transfer_reason, confidence, shared_places, shared_areas)

    def _transfer_leg_bonus(self, first_access: AccessType, second_access: AccessType) -> float:
        return self.ranker.transfer_leg_bonus(first_access, second_access)

    def _humanize_transfer_hint(self, shared_places: list[str], shared_areas: list[str]) -> str:
        if shared_places:
            return self._clean_stop_hint(shared_places[0]) or shared_places[0]
        if shared_areas:
            cluster = self.snapshot.area_clusters.get(shared_areas[0])
            if cluster:
                return cluster.name
            return shared_areas[0].replace("_", " ")
        return "a common transfer point"

    def _clean_stop_hint(self, hint: str | None) -> str | None:
        if not hint:
            return None
        value = " ".join(str(hint).split()).strip(" .")
        if not value:
            return None
        normalized_value = value.lower()
        noisy_markers = (" to ", " via ", " - ", "puj", "terminal -", "route")
        if (
            len(value) > 48
            or sum(marker in normalized_value for marker in noisy_markers) >= 2
            or (" to " in normalized_value and len(value.split()) >= 4)
        ):
            return None
        return value

    def _relation_score(
        self,
        relation: str,
        confidence: str,
        source_field: str | None = None,
        walk_minutes: int | None = None,
        distance_m: float | None = None,
    ) -> float:
        return self.ranker.relation_score(relation, confidence, source_field, walk_minutes, distance_m)

    def _min_optional_int(self, left: int | None, right: int | None) -> int | None:
        values = [value for value in [left, right] if value is not None]
        return min(values) if values else None

    def _min_optional_float(self, left: float | None, right: float | None) -> float | None:
        values = [value for value in [left, right] if value is not None]
        return min(values) if values else None
