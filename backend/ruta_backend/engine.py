from __future__ import annotations

from dataclasses import asdict

from .models import (
    AccessMatch,
    AccessType,
    ParsedQuery,
    ResolvedEntity,
    RoutePlan,
    RouteQueryResponse,
    RoutingSnapshot,
)
from .services.query_parser import QueryParser
from .services.resolver import Resolver
from .services.route_engine import RouteEngine
from .utils import dedupe_keep_order


class RutaQueryEngine:
    def __init__(self, snapshot: RoutingSnapshot):
        self.snapshot = snapshot
        self.query_parser = QueryParser()
        self.resolver = Resolver(snapshot)
        self.route_engine = RouteEngine(snapshot)

    def parse_query(self, raw_query: str) -> ParsedQuery:
        raw_query = raw_query.strip()
        parsed = self.query_parser.parse(raw_query)

        if parsed.intent == "route_lookup":
            return ParsedQuery(kind="route_lookup", raw_query=raw_query, route_code=parsed.route_code)

        if parsed.intent == "route_check":
            return ParsedQuery(
                kind="route_check",
                raw_query=raw_query,
                route_code=parsed.route_code,
                target_text=parsed.destination_text,
            )

        if parsed.origin_text and parsed.destination_text:
            return ParsedQuery(
                kind="place_to_place",
                raw_query=raw_query,
                origin_text=parsed.origin_text,
                destination_text=parsed.destination_text,
                route_code=parsed.route_code,
            )

        return ParsedQuery(
            kind="place_search",
            raw_query=raw_query,
            route_code=parsed.route_code,
            target_text=parsed.destination_text or raw_query,
        )

    def resolve_candidates(self, text: str | None, limit: int = 5) -> list[ResolvedEntity]:
        return [entity for entity, _reason in self.resolver.resolve_candidates(text, limit=limit)]

    def resolve_text(self, text: str | None) -> ResolvedEntity | None:
        return self.resolver.resolve_entity(text)

    def build_access_matches(self, entity: ResolvedEntity) -> dict[str, AccessMatch]:
        return self.route_engine.build_access_matches(entity)

    def answer_query(self, raw_query: str) -> RouteQueryResponse:
        parsed = self.parse_query(raw_query)

        if parsed.kind == "route_lookup":
            return self._answer_route_lookup(parsed)
        if parsed.kind == "route_check":
            return self._answer_route_check(parsed)
        if parsed.kind == "place_to_place":
            return self._answer_place_to_place(parsed)
        return self._answer_place_search(parsed)

    def _answer_route_lookup(self, parsed: ParsedQuery) -> RouteQueryResponse:
        route = self.snapshot.routes.get((parsed.route_code or "").upper())
        if not route:
            return RouteQueryResponse(
                query=parsed.raw_query,
                query_kind=parsed.kind,
                origin=None,
                destination=None,
                route_code=parsed.route_code,
                response_type="no_match",
                confidence=0.0,
                answer="I could not find that jeep code in the current database yet.",
                routes=[],
                metadata={"parsed": asdict(parsed)},
            )

        landmarks = self._route_landmarks(route)
        roads = self._route_road_clues(route)
        signboard = self._route_signboard(route)
        lines = [
            f"{route.code} usually runs {signboard}.",
            f"What to look for: Ride a jeep marked {route.code} and check if the signboard says {signboard}.",
        ]
        if landmarks:
            lines.append(f"Key landmarks: {', '.join(landmarks)}.")
        if roads:
            lines.append(f"Road clues: {', '.join(roads)}.")
        lines.append("Tip: If the signboard looks different, ask the driver before boarding.")

        return RouteQueryResponse(
            query=parsed.raw_query,
            query_kind=parsed.kind,
            origin=None,
            destination=None,
            route_code=route.code,
            response_type="route_lookup",
            confidence=0.95,
            answer=" ".join(lines),
            routes=[
                {
                    "route_code": route.code,
                    "route_name": route.route_name,
                    "signboard": signboard,
                    "origin": route.origin,
                    "destination": route.destination,
                    "key_landmarks": landmarks,
                    "road_clues": roads,
                }
            ],
            metadata={"parsed": asdict(parsed)},
        )

    def _answer_route_check(self, parsed: ParsedQuery) -> RouteQueryResponse:
        route = self.snapshot.routes.get((parsed.route_code or "").upper())
        target_candidates = self.resolve_candidates(parsed.target_text, limit=6)

        if not route or not target_candidates:
            return RouteQueryResponse(
                query=parsed.raw_query,
                query_kind=parsed.kind,
                origin=None,
                destination=target_candidates[0] if target_candidates else None,
                route_code=parsed.route_code,
                response_type="no_match",
                confidence=0.0,
                answer="I could not confirm that route check from the current database yet.",
                routes=[],
                metadata={"parsed": asdict(parsed)},
            )

        best_match: tuple[ResolvedEntity, AccessMatch, float] | None = None
        for target in target_candidates:
            access = self.build_access_matches(target).get(route.route_id)
            if not access:
                continue
            combined_score = min(0.99, access.score * 0.88 + target.confidence * 0.12)
            if best_match is None or combined_score > best_match[2]:
                best_match = (target, access, combined_score)

        if not best_match:
            best_target = target_candidates[0]
            return RouteQueryResponse(
                query=parsed.raw_query,
                query_kind=parsed.kind,
                origin=None,
                destination=best_target,
                route_code=route.code,
                response_type="area_access" if best_target.cluster_ids else "no_match",
                confidence=max(0.3, best_target.confidence * 0.55),
                answer=(
                    f"{route.code} is not a clean exact match for {best_target.display_name}, "
                    "but it may still be worth confirming with the driver if you are heading to that area."
                ),
                routes=[],
                metadata={"parsed": asdict(parsed)},
            )

        target, access, combined_score = best_match
        answer = self._format_route_check_answer(route.code, target.display_name, access)
        return RouteQueryResponse(
            query=parsed.raw_query,
            query_kind=parsed.kind,
            origin=None,
            destination=target,
            route_code=route.code,
            response_type=access.access_type,
            confidence=combined_score,
            answer=answer,
            routes=[
                {
                    "route_code": route.code,
                    "route_name": route.route_name,
                    "match_type": access.access_type,
                    "walk_minutes": access.walk_minutes,
                    "distance_m": access.distance_m,
                    "dropoff_stop": access.dropoff_stop,
                }
            ],
            metadata={"parsed": asdict(parsed)},
        )

    def _answer_place_to_place(self, parsed: ParsedQuery) -> RouteQueryResponse:
        origin_candidates = self.resolve_candidates(parsed.origin_text, limit=5)
        destination_candidates = self.resolve_candidates(parsed.destination_text, limit=5)

        if not origin_candidates or not destination_candidates:
            partial_response = self._build_partial_trip_response(parsed, origin_candidates, destination_candidates)
            if partial_response:
                return partial_response
            return RouteQueryResponse(
                query=parsed.raw_query,
                query_kind=parsed.kind,
                origin=origin_candidates[0] if origin_candidates else None,
                destination=destination_candidates[0] if destination_candidates else None,
                route_code=None,
                response_type="no_match",
                confidence=0.0,
                answer="I could not confidently resolve your origin or destination yet.",
                routes=[],
                metadata={"parsed": asdict(parsed)},
            )

        scored_matches: list[tuple[float, ResolvedEntity, ResolvedEntity, RoutePlan]] = []

        direct_match = self._find_best_plan_across_candidates(origin_candidates, destination_candidates, self._find_direct_plan)
        if direct_match:
            origin, destination, direct_plan = direct_match
            direct_bonus = {
                "direct_access": 0.08,
                "nearby_access": 0.06,
                "area_access": 0.04,
                "transfer_required": 0.0,
            }.get(direct_plan.response_type, 0.0)
            scored_matches.append((direct_plan.confidence + direct_bonus, origin, destination, direct_plan))

        transfer_match = self._find_best_plan_across_candidates(origin_candidates, destination_candidates, self._find_transfer_plan)
        if transfer_match:
            origin, destination, transfer_plan = transfer_match
            transfer_bonus = 0.02 if transfer_plan.confidence >= 0.84 else 0.0
            scored_matches.append((transfer_plan.confidence + transfer_bonus, origin, destination, transfer_plan))

        fallback_match = self._find_best_effort_plan(origin_candidates, destination_candidates)
        if fallback_match:
            origin, destination, fallback_plan = fallback_match
            scored_matches.append((fallback_plan.confidence, origin, destination, fallback_plan))

        if scored_matches:
            _score, origin, destination, plan = max(scored_matches, key=lambda item: item[0])
            return self._to_query_response(parsed, origin, destination, plan)

        return RouteQueryResponse(
            query=parsed.raw_query,
            query_kind=parsed.kind,
            origin=origin_candidates[0],
            destination=destination_candidates[0],
            route_code=None,
            response_type="no_match",
            confidence=0.22,
            answer=(
                f"I could not confirm a practical jeep path from {origin_candidates[0].display_name} to "
                f"{destination_candidates[0].display_name} from the current database."
            ),
            routes=[],
            metadata={"parsed": asdict(parsed)},
        )

    def _answer_place_search(self, parsed: ParsedQuery) -> RouteQueryResponse:
        target_candidates = self.resolve_candidates(parsed.target_text, limit=5)
        if not target_candidates:
            return RouteQueryResponse(
                query=parsed.raw_query,
                query_kind=parsed.kind,
                origin=None,
                destination=None,
                route_code=None,
                response_type="no_match",
                confidence=0.0,
                answer="I could not resolve that place or area yet.",
                routes=[],
                metadata={"parsed": asdict(parsed)},
            )

        target = target_candidates[0]
        top_matches = sorted(self.build_access_matches(target).values(), key=lambda item: item.score, reverse=True)[:3]
        if not top_matches:
            return RouteQueryResponse(
                query=parsed.raw_query,
                query_kind=parsed.kind,
                origin=None,
                destination=target,
                route_code=None,
                response_type="no_match",
                confidence=target.confidence,
                answer=f"I found {target.display_name}, but there are no route links for it yet.",
                routes=[],
                metadata={"parsed": asdict(parsed)},
            )

        answer = (
            f"For {target.display_name}, the strongest jeep options right now are "
            + ", ".join(match.route_code for match in top_matches)
            + "."
        )
        return RouteQueryResponse(
            query=parsed.raw_query,
            query_kind=parsed.kind,
            origin=None,
            destination=target,
            route_code=None,
            response_type=top_matches[0].access_type,
            confidence=top_matches[0].score,
            answer=answer,
            routes=[
                {
                    "route_code": match.route_code,
                    "match_type": match.access_type,
                    "walk_minutes": match.walk_minutes,
                    "distance_m": match.distance_m,
                    "dropoff_stop": match.dropoff_stop,
                }
                for match in top_matches
            ],
            metadata={"parsed": asdict(parsed)},
        )

    def _find_best_plan_across_candidates(
        self,
        origin_candidates: list[ResolvedEntity],
        destination_candidates: list[ResolvedEntity],
        planner,
    ) -> tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None:
        best_match: tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None = None
        best_score = 0.0

        for origin in origin_candidates:
            for destination in destination_candidates:
                plan = planner(origin, destination)
                if not plan:
                    continue
                combined_score = min(0.99, plan.confidence * 0.82 + origin.confidence * 0.09 + destination.confidence * 0.09)
                if best_match is None or combined_score > best_score:
                    plan.confidence = combined_score
                    best_match = (origin, destination, plan)
                    best_score = combined_score

        return best_match

    def _build_partial_trip_response(
        self,
        parsed: ParsedQuery,
        origin_candidates: list[ResolvedEntity],
        destination_candidates: list[ResolvedEntity],
    ) -> RouteQueryResponse | None:
        known_side = origin_candidates[0] if origin_candidates else destination_candidates[0] if destination_candidates else None
        if known_side is None:
            return None

        nearby_routes = sorted(self.build_access_matches(known_side).values(), key=lambda item: item.score, reverse=True)[:3]
        answer = (
            f"I could place {known_side.display_name}, but I still need a clearer "
            f"{'destination' if origin_candidates else 'origin'}. "
        )
        if nearby_routes:
            answer += (
                f"Useful jeep options around {known_side.display_name} include "
                + ", ".join(match.route_code for match in nearby_routes)
                + "."
            )
        else:
            answer += f"Try using a nearby landmark, school, mall, terminal, or barangay name for {known_side.display_name}."

        return RouteQueryResponse(
            query=parsed.raw_query,
            query_kind=parsed.kind,
            origin=origin_candidates[0] if origin_candidates else None,
            destination=destination_candidates[0] if destination_candidates else None,
            route_code=None,
            response_type=nearby_routes[0].access_type if nearby_routes else "no_match",
            confidence=max(known_side.confidence * 0.7, nearby_routes[0].score if nearby_routes else 0.25),
            answer=answer,
            routes=[
                {
                    "route_code": match.route_code,
                    "match_type": match.access_type,
                    "walk_minutes": match.walk_minutes,
                    "distance_m": match.distance_m,
                    "dropoff_stop": match.dropoff_stop,
                }
                for match in nearby_routes
            ],
            metadata={"parsed": asdict(parsed)},
        )

    def _find_direct_plan(self, origin: ResolvedEntity, destination: ResolvedEntity) -> RoutePlan | None:
        return self.route_engine.find_direct_routes(origin, destination)

    def _find_transfer_plan(self, origin: ResolvedEntity, destination: ResolvedEntity) -> RoutePlan | None:
        return self.route_engine.find_transfer_routes(origin, destination)

    def _find_best_effort_plan(
        self,
        origin_candidates: list[ResolvedEntity],
        destination_candidates: list[ResolvedEntity],
    ) -> tuple[ResolvedEntity, ResolvedEntity, RoutePlan] | None:
        return self.route_engine.find_best_effort_plan(origin_candidates, destination_candidates)

    def _format_route_check_answer(self, route_code: str, target_name: str, access: AccessMatch) -> str:
        if access.access_type == "direct_access":
            return f"Yes, {route_code} is a direct match for {target_name}."
        if access.access_type == "nearby_access":
            walk_note = f" with about a {access.walk_minutes}-minute walk" if access.walk_minutes else ""
            dropoff = f" Best to get off near {access.dropoff_stop}." if access.dropoff_stop else ""
            return f"Yes, {route_code} looks usable for {target_name}{walk_note}.{dropoff}".strip()
        return (
            f"{route_code} reaches the {target_name} area, so it can still be a practical ride. "
            "Confirm the exact drop-off point with the driver before boarding."
        )

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

    def _route_signboard(self, route) -> str:
        if route.origin and route.destination:
            return f"from {route.origin} to {route.destination}"
        if route.route_name:
            return route.route_name
        return route.code

    def _route_landmarks(self, route) -> list[str]:
        raw = route.raw_payload or {}
        values = [
            *self._safe_str_list(raw.get("malls_groceries")),
            *self._safe_str_list(raw.get("terminals")),
            *self._safe_str_list(raw.get("schools")),
            *self._safe_str_list(raw.get("health")),
            *self._safe_str_list(raw.get("government")),
            *self._safe_str_list(raw.get("churches")),
        ]
        return dedupe_keep_order(values)[:6]

    def _route_road_clues(self, route) -> list[str]:
        raw = route.raw_payload or {}
        return dedupe_keep_order(self._safe_str_list(raw.get("roads")))[:4]

    def _safe_str_list(self, value: object) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return []

    def _combine_access_types(self, origin_access: AccessType, destination_access: AccessType) -> AccessType:
        if origin_access == "direct_access" and destination_access == "direct_access":
            return "direct_access"
        if "nearby_access" in {origin_access, destination_access}:
            return "nearby_access"
        return "area_access"

    def _humanize_access_type(self, access_type: AccessType) -> str:
        return access_type.replace("_", " ")

    def _article_for_access_type(self, access_type: AccessType) -> str:
        return "an" if access_type.startswith("area") else "a"

    def _normalized_access_type_for_link(
        self,
        relation: str,
        source_field: str,
        walk_minutes: int | None,
        distance_m: float | None,
    ) -> AccessType:
        if relation != "direct_access":
            if relation == "nearby_access" and (walk_minutes is None and distance_m is None):
                return "area_access"
            return relation

        if source_field in STRONG_DIRECT_SOURCE_FIELDS:
            return "direct_access"
        if source_field == "roads":
            return "nearby_access"
        if source_field in WEAK_DIRECT_SOURCE_FIELDS:
            if (walk_minutes is not None and walk_minutes <= 5) or (distance_m is not None and distance_m <= 350):
                return "nearby_access"
            return "area_access"
        return "nearby_access"

    def _cluster_access_score(self, entity_type: str) -> float:
        return 0.52 if entity_type == "cluster" else 0.44

    def _transfer_bonus(
        self,
        transfer_reason: str,
        confidence: str,
        shared_places: list[str],
        shared_areas: list[str],
    ) -> float:
        reason_bonus = TRANSFER_REASON_WEIGHTS.get(transfer_reason, 0.05)
        confidence_bonus = {"high": 0.03, "medium": 0.015, "low": 0.0}.get(confidence.lower(), 0.0)
        place_bonus = 0.02 if shared_places else 0.0
        area_penalty = -0.02 if shared_areas and not shared_places else 0.0
        return reason_bonus + confidence_bonus + place_bonus + area_penalty

    def _transfer_leg_bonus(self, first_access: AccessType, second_access: AccessType) -> float:
        if first_access == "direct_access" and second_access == "direct_access":
            return 0.04
        if "direct_access" in {first_access, second_access}:
            return 0.02
        if "nearby_access" in {first_access, second_access}:
            return 0.01
        return 0.0

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
        base = {
            "direct_access": 0.88,
            "nearby_access": 0.68,
            "area_access": 0.48,
        }.get(relation, 0.35)
        confidence_bonus = {"high": 0.05, "medium": 0.0, "low": -0.06}.get(confidence.lower(), 0.0)
        source_bonus = SOURCE_FIELD_BASE_WEIGHTS.get(source_field or "", 0.0)
        walk_bonus = 0.0
        if relation == "nearby_access":
            if walk_minutes is not None:
                if walk_minutes <= 3:
                    walk_bonus += 0.06
                elif walk_minutes <= 6:
                    walk_bonus += 0.02
                elif walk_minutes >= 10:
                    walk_bonus -= 0.08
            if distance_m is not None:
                if distance_m <= 250:
                    walk_bonus += 0.04
                elif distance_m <= 500:
                    walk_bonus += 0.01
                elif distance_m >= 900:
                    walk_bonus -= 0.08
        return max(0.1, min(0.97, base + confidence_bonus + source_bonus + walk_bonus))

    def _min_optional_int(self, left: int | None, right: int | None) -> int | None:
        values = [value for value in [left, right] if value is not None]
        return min(values) if values else None

    def _min_optional_float(self, left: float | None, right: float | None) -> float | None:
        values = [value for value in [left, right] if value is not None]
        return min(values) if values else None

    def _to_query_response(
        self,
        parsed: ParsedQuery,
        origin: ResolvedEntity,
        destination: ResolvedEntity,
        plan: RoutePlan,
    ) -> RouteQueryResponse:
        return RouteQueryResponse(
            query=parsed.raw_query,
            query_kind=parsed.kind,
            origin=origin,
            destination=destination,
            route_code=None,
            response_type=plan.response_type,
            confidence=plan.confidence,
            answer=plan.summary,
            routes=plan.details,
            metadata={"parsed": asdict(parsed)},
        )
