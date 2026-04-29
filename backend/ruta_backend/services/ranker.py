from __future__ import annotations

from difflib import SequenceMatcher

from ..models import AccessMatch, AccessType, RoutePlan
from ..utils import normalize_text

STRONG_DIRECT_SOURCE_FIELDS = {"origin", "destination", "stops", "terminals"}
WEAK_DIRECT_SOURCE_FIELDS = {"roads", "schools", "malls_groceries", "health", "government", "churches", "hotels"}
SOURCE_FIELD_BASE_WEIGHTS = {
    "origin": 0.18,
    "destination": 0.18,
    "stops": 0.16,
    "terminals": 0.14,
    "info": 0.08,
    "roads": -0.12,
    "schools": -0.18,
    "malls_groceries": -0.14,
    "health": -0.16,
    "government": -0.17,
    "churches": -0.18,
    "hotels": -0.18,
    "raw_sections": -0.08,
    "area_cluster": -0.2,
}
TRANSFER_REASON_WEIGHTS = {
    "shared_place": 0.08,
    "shared_area": 0.02,
}
DIRECT_ROUTE_MODE_BONUS = {
    "direct_access": 0.08,
    "nearby_access": 0.06,
    "area_access": 0.04,
    "transfer_required": 0.0,
}
TRANSFER_ROUTE_BONUS_THRESHOLD = 0.84
TRANSFER_ROUTE_MODE_BONUS = 0.02
MIN_PLACE_CANDIDATE_SCORE = 0.56
MIN_CLUSTER_CANDIDATE_SCORE = 0.54


class Ranker:
    """Central scoring helpers for place resolution and route option ranking."""

    def score_candidate_key(self, normalized_text_value: str, candidate_key: str) -> float:
        if not normalized_text_value or not candidate_key:
            return 0.0

        query_compact = self._compact_text(normalized_text_value)
        candidate_compact = self._compact_text(candidate_key)

        if normalized_text_value == candidate_key:
            return 1.0
        if query_compact == candidate_compact:
            return 0.98

        score = 0.0
        if (
            normalized_text_value in candidate_key
            or candidate_key in normalized_text_value
            or query_compact in candidate_compact
            or candidate_compact in query_compact
        ):
            score = max(score, 0.84)

        query_tokens = {token for token in normalized_text_value.split() if token}
        candidate_tokens = {token for token in candidate_key.split() if token}
        if query_tokens and candidate_tokens:
            overlap = len(query_tokens & candidate_tokens) / max(len(query_tokens), len(candidate_tokens))
            if overlap >= 1.0:
                score = max(score, 0.9)
            elif overlap >= 0.66:
                score = max(score, 0.8)
            elif overlap >= 0.5:
                score = max(score, 0.72)
            elif overlap >= 0.34:
                score = max(score, 0.62)

        if query_compact.startswith(candidate_compact) or candidate_compact.startswith(query_compact):
            score = max(score, 0.76)

        similarity = SequenceMatcher(None, query_compact, candidate_compact).ratio()
        if similarity >= 0.92:
            score = max(score, 0.82)
        elif similarity >= 0.84:
            score = max(score, 0.74)
        elif similarity >= 0.74:
            score = max(score, 0.66)
        elif similarity >= 0.66:
            score = max(score, 0.58)

        return min(score, 0.95)

    def score_place_record_for_query(self, normalized_text_value: str, place) -> float:
        compact_query = self._compact_text(normalized_text_value)
        candidates = [
            place.name,
            place.canonical_name,
            place.address or "",
            *place.aliases,
            *place.normalized_aliases,
            *place.address_aliases,
        ]
        best = 0.0
        for candidate in candidates:
            normalized_candidate = normalize_text(candidate)
            if not normalized_candidate:
                continue
            score = self.score_candidate_key(normalized_text_value, normalized_candidate)
            candidate_compact = self._compact_text(normalized_candidate)
            if compact_query == candidate_compact:
                score = max(score, 0.99)
            if normalized_candidate.startswith(normalized_text_value):
                score = max(score, 0.86)
            if normalized_candidate == normalize_text(place.name):
                score += 0.03
            best = max(best, min(score, 1.0))
        return best

    def normalized_access_type_for_link(
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

    def relation_score(
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

    def cluster_access_score(self, entity_type: str) -> float:
        return 0.52 if entity_type == "cluster" else 0.44

    def transfer_bonus(
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

    def transfer_leg_bonus(self, first_access: AccessType, second_access: AccessType) -> float:
        if first_access == "direct_access" and second_access == "direct_access":
            return 0.04
        if "direct_access" in {first_access, second_access}:
            return 0.02
        if "nearby_access" in {first_access, second_access}:
            return 0.01
        return 0.0

    def score_direct_option(self, origin_match: AccessMatch, destination_match: AccessMatch) -> tuple[float, AccessType]:
        response_type = self.combine_access_types(origin_match.access_type, destination_match.access_type)
        score = min(0.99, origin_match.score * 0.47 + destination_match.score * 0.47 + 0.06)
        return score, response_type

    def score_transfer_option(self, first_leg: AccessMatch, second_leg: AccessMatch, transfer_bonus: float, leg_bonus: float) -> float:
        return min(0.88, first_leg.score * 0.36 + second_leg.score * 0.36 + transfer_bonus + leg_bonus)

    def score_fallback_option(
        self,
        first_leg: AccessMatch,
        second_leg: AccessMatch,
        origin_confidence: float,
        destination_confidence: float,
    ) -> float:
        return min(
            0.78,
            first_leg.score * 0.34 + second_leg.score * 0.34 + origin_confidence * 0.16 + destination_confidence * 0.16,
        )

    def score_plan_with_resolution_confidence(
        self,
        plan: RoutePlan,
        origin_confidence: float,
        destination_confidence: float,
    ) -> float:
        return min(0.99, plan.confidence * 0.82 + origin_confidence * 0.09 + destination_confidence * 0.09)

    def route_plan_bonus(self, plan: RoutePlan) -> float:
        if plan.response_type == "transfer_required":
            return TRANSFER_ROUTE_MODE_BONUS if plan.confidence >= TRANSFER_ROUTE_BONUS_THRESHOLD else 0.0
        return DIRECT_ROUTE_MODE_BONUS.get(plan.response_type, 0.0)

    def combine_access_types(self, origin_access: AccessType, destination_access: AccessType) -> AccessType:
        if origin_access == "direct_access" and destination_access == "direct_access":
            return "direct_access"
        if "nearby_access" in {origin_access, destination_access}:
            return "nearby_access"
        return "area_access"

    def humanize_access_type(self, access_type: AccessType) -> str:
        return access_type.replace("_", " ")

    def article_for_access_type(self, access_type: AccessType) -> str:
        return "an" if access_type.startswith("area") else "a"

    def _compact_text(self, value: str) -> str:
        return value.replace(" ", "").replace("-", "")
