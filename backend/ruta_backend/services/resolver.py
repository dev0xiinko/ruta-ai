from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from ..models import (
    AreaClusterMemberRecord,
    ManualOverrideRecord,
    ResolutionCandidate,
    ResolutionResult,
    ResolvedEntity,
    RoutingSnapshot,
)
from .ranker import MIN_CLUSTER_CANDIDATE_SCORE, MIN_PLACE_CANDIDATE_SCORE, Ranker
from ..utils import dedupe_keep_order, normalize_text

AREA_EXPANSION_RULES = {
    "lapulapu": ["lapu lapu", "mactan", "opon", "airport"],
    "lapu lapu": ["lapu lapu", "mactan", "opon", "airport"],
    "mactan": ["mactan", "lapu lapu", "opon", "airport"],
    "bulacao": ["bulacao", "pardo"],
    "pardo": ["pardo", "bulacao"],
    "colon": ["colon", "metro colon", "carbon"],
    "fuente": ["fuente", "fuente osmena", "cebu doc"],
    "ayala": ["ayala", "ayala center", "cebu business park"],
    "it park": ["it park", "cebu it park", "lahug", "jy square"],
    "jy": ["jy square", "lahug"],
    "jy square": ["jy square", "lahug", "it park"],
    "cebu doc": ["cebu doc", "cebu doctors", "fuente"],
    "emall": ["e mall", "emall", "elizabeth mall"],
    "e mall": ["e mall", "emall", "elizabeth mall"],
    "rob galleria": ["robinsons galleria", "galleria", "galleria pier"],
    "galleria": ["galleria", "robinsons galleria", "galleria pier"],
}
CURATED_LOOKUP_EXPANSIONS = {
    "usc tc": ["usc talamban", "usc-talamban", "university of san carlos talamban"],
    "usc talamban": ["usc talamban", "usc-talamban", "university of san carlos talamban"],
    "usc main": ["university of san carlos main campus", "university of san carlos main", "usc south"],
    "usc downtown": ["university of san carlos main campus", "university of san carlos main", "usc south"],
    "cebu doc": ["cebu doctors hospital", "cebu doctors university hospital", "cebu doc area"],
    "rob galleria": ["robinsons galleria cebu", "robinsons galleria", "galleria"],
    "galleria": ["robinsons galleria cebu", "robinsons galleria", "galleria"],
    "emall": ["e mall", "elizabeth mall"],
    "e mall": ["emall", "elizabeth mall"],
    "act": ["asian college of technology"],
    "cit u": ["cit-u", "citu", "cebu institute of technology university"],
    "cit-u": ["cit u", "citu", "cebu institute of technology university"],
    "citu": ["cit-u", "cit u", "cebu institute of technology university"],
    "uc main": ["university of cebu main campus", "university of cebu main", "ucm"],
    "uv main": ["university of the visayas main campus", "university of visayas main campus", "uv"],
    "ctu main": ["cebu technological university main campus", "ctu"],
    "up cebu": ["university of the philippines cebu", "up lahug", "upc"],
}
class Resolver:
    """Resolve raw user text into ranked place and cluster candidates."""

    def __init__(self, snapshot: RoutingSnapshot):
        self.snapshot = snapshot
        self.ranker = Ranker()
        self.places_by_key: dict[str, set[str]] = defaultdict(set)
        self.clusters_by_key: dict[str, set[str]] = defaultdict(set)
        self.cluster_members: dict[str, list[AreaClusterMemberRecord]] = defaultdict(list)
        self.overrides_by_key: dict[str, list[ManualOverrideRecord]] = defaultdict(list)
        self._build_indexes()

    def resolve_text(self, text: str) -> ResolutionResult:
        candidates = self.resolve_candidates(text)
        top_match = candidates[0] if candidates else None
        public_candidates = [self._to_resolution_candidate(entity, reason) for entity, reason in candidates]
        top_public_match = public_candidates[0] if public_candidates else None
        match_type = self._match_type(top_public_match)
        confidence = self._confidence_tier(top_public_match)
        reason = top_public_match.reason if top_public_match else "No active place or cluster match found."
        return ResolutionResult(
            text=text,
            top_match=top_public_match,
            candidates=public_candidates,
            confidence=confidence,
            match_type=match_type,
            reason=reason,
        )

    def resolve_origin_destination(self, origin_text: str, destination_text: str) -> tuple[ResolutionResult, ResolutionResult]:
        return self.resolve_text(origin_text), self.resolve_text(destination_text)

    def resolve_entity(self, text: str | None) -> ResolvedEntity | None:
        candidates = self.resolve_candidates(text, limit=1)
        return candidates[0][0] if candidates else None

    def resolve_candidates(
        self,
        text: str | None,
        limit: int = 5,
    ) -> list[tuple[ResolvedEntity, str]]:
        return self._resolve_candidates(text, limit=limit)

    def resolve_routing_candidates(
        self,
        text: str | None,
        *,
        limit: int = 5,
        confidence_window: float = 0.05,
    ) -> list[tuple[ResolvedEntity, str]]:
        candidates = self.resolve_candidates(text, limit=limit)
        if not candidates:
            return []

        top_entity = candidates[0][0]
        preferred = [
            (entity, reason)
            for entity, reason in candidates
            if entity.entity_type == top_entity.entity_type
            and entity.confidence >= top_entity.confidence - confidence_window
        ]
        return preferred or [candidates[0]]

    def _build_indexes(self) -> None:
        for place in self.snapshot.places.values():
            keys = {
                place.normalized_name,
                normalize_text(place.name),
                normalize_text(place.canonical_name),
                normalize_text(place.address or ""),
                *(normalize_text(alias) for alias in place.aliases),
                *(normalize_text(alias) for alias in place.normalized_aliases),
                *(normalize_text(alias) for alias in place.address_aliases),
            }
            for key in keys:
                if key:
                    self.places_by_key[key].add(place.place_id)

        for cluster in self.snapshot.area_clusters.values():
            keys = {
                normalize_text(cluster.name),
                *(normalize_text(alias) for alias in cluster.aliases),
                *(normalize_text(alias) for alias in cluster.normalized_aliases),
                *(normalize_text(keyword) for keyword in cluster.keywords),
            }
            for key in keys:
                if key:
                    self.clusters_by_key[key].add(cluster.cluster_id)

        for member in self.snapshot.area_cluster_members:
            self.cluster_members[member.cluster_id].append(member)

        for override in sorted(self.snapshot.manual_overrides, key=lambda item: item.priority, reverse=True):
            self.overrides_by_key[override.normalized_match_key].append(override)

    def _resolve_candidates(self, text: str | None, limit: int = 5) -> list[tuple[ResolvedEntity, str]]:
        if not text:
            return []

        normalized = normalize_text(text)
        if not normalized:
            return []

        candidates: dict[tuple[str, tuple[str, ...], tuple[str, ...]], tuple[ResolvedEntity, str, str]] = {}

        def add_candidate(entity: ResolvedEntity | None, score: float, match_type: str, reason: str) -> None:
            if entity is None or score <= 0:
                return
            entity.confidence = max(entity.confidence, score)
            key = (entity.entity_type, tuple(entity.place_ids), tuple(entity.cluster_ids))
            current = candidates.get(key)
            if current is None or entity.confidence > current[0].confidence:
                candidates[key] = (entity, match_type, reason)

        override = self._apply_override(normalized)
        if override is not None:
            add_candidate(override, 1.0, "override", f"Manual override matched `{normalized}`.")

        direct_place = self.places_by_key.get(normalized)
        if direct_place:
            add_candidate(
                self._build_place_entity(text, direct_place, 1.0),
                1.0,
                "place",
                "Exact place or alias match from active place records.",
            )

        direct_cluster = self.clusters_by_key.get(normalized)
        if direct_cluster:
            add_candidate(
                self._build_cluster_entity(text, direct_cluster, 0.98),
                0.98,
                "cluster",
                "Exact cluster or area alias match from active cluster records.",
            )

        for expansion_key in self._expanded_lookup_keys(normalized):
            if expansion_key == normalized:
                continue
            expanded_place_ids = self.places_by_key.get(expansion_key)
            if expanded_place_ids:
                add_candidate(
                    self._build_place_entity(text, expanded_place_ids, 0.92),
                    0.92,
                    "place",
                    "Expanded through curated Cebu alias rules into active place records.",
                )
            expanded_cluster_ids = self.clusters_by_key.get(expansion_key)
            if expanded_cluster_ids:
                add_candidate(
                    self._build_cluster_entity(text, expanded_cluster_ids, 0.9),
                    0.9,
                    "cluster",
                    "Expanded through curated Cebu area rules into active cluster records.",
                )

        for key, place_ids in self.places_by_key.items():
            score = self.ranker.score_candidate_key(normalized, key)
            if score >= MIN_PLACE_CANDIDATE_SCORE:
                add_candidate(
                    self._build_place_entity(text, place_ids, score),
                    score,
                    "place",
                    "Fuzzy place match from active place names and aliases.",
                )

        for key, cluster_ids in self.clusters_by_key.items():
            score = self.ranker.score_candidate_key(normalized, key)
            if score >= MIN_CLUSTER_CANDIDATE_SCORE:
                add_candidate(
                    self._build_cluster_entity(text, cluster_ids, score),
                    score,
                    "cluster",
                    "Area inference from active cluster aliases and keywords.",
                )

        ordered = sorted(
            candidates.values(),
            key=lambda item: (
                -item[0].confidence,
                0 if item[0].entity_type == "place" else 1,
                len(item[0].place_ids),
                item[0].display_name.lower(),
            ),
        )
        return [(entity, reason) for entity, _match_type, reason in ordered[:limit]]

    def _apply_override(self, normalized_text_value: str) -> ResolvedEntity | None:
        for override in self.overrides_by_key.get(normalized_text_value, []):
            if not override.is_active:
                continue
            if override.override_type == "place_alias" and override.target_place_id:
                return self._build_place_entity(override.match_key, [override.target_place_id], 1.0)
            if override.override_type == "cluster_alias" and override.target_cluster_id:
                return self._build_cluster_entity(override.match_key, [override.target_cluster_id], 1.0)
        return None

    def _expanded_lookup_keys(self, normalized_text_value: str) -> list[str]:
        expanded = {normalized_text_value}
        compact_value = self._compact_text(normalized_text_value)

        for source_key, targets in CURATED_LOOKUP_EXPANSIONS.items():
            normalized_source = normalize_text(source_key)
            if normalized_source == normalized_text_value or self._compact_text(normalized_source) == compact_value:
                expanded.update(normalize_text(target) for target in targets)

        for source_key, targets in AREA_EXPANSION_RULES.items():
            normalized_source = normalize_text(source_key)
            if normalized_source == normalized_text_value or self._compact_text(normalized_source) == compact_value:
                expanded.update(normalize_text(target) for target in targets)

        return [value for value in expanded if value]

    def _compact_text(self, value: str) -> str:
        return value.replace(" ", "").replace("-", "")

    def _build_place_entity(self, matched_text: str, place_ids: Iterable[str], confidence: float) -> ResolvedEntity:
        ordered_place_ids = self._rank_place_ids_for_query(matched_text, place_ids)
        first_place = self.snapshot.places[ordered_place_ids[0]]
        normalized_matched_text = normalize_text(matched_text)
        exact_label_candidates = [
            first_place.name,
            first_place.canonical_name,
            *first_place.aliases,
            *first_place.address_aliases,
        ]
        preferred_exact_label = next(
            (
                candidate.strip()
                for candidate in exact_label_candidates
                if candidate and normalize_text(candidate) == normalized_matched_text
            ),
            matched_text.strip(),
        )
        exact_user_facing_match = normalized_matched_text in {
            first_place.normalized_name,
            normalize_text(first_place.canonical_name),
            *(normalize_text(alias) for alias in first_place.aliases),
            *(normalize_text(alias) for alias in first_place.normalized_aliases),
            *(normalize_text(alias) for alias in first_place.address_aliases),
        }
        display_name = (
            matched_text.strip()
            if matched_text.strip() and len(ordered_place_ids) > 1
            else preferred_exact_label
            if matched_text.strip() and (confidence < 0.95 or exact_user_facing_match)
            else first_place.name
        )
        cluster_ids = dedupe_keep_order(
            cluster_id
            for place_id in ordered_place_ids
            for cluster_id in self.snapshot.places[place_id].area_clusters
        )
        return ResolvedEntity(
            entity_type="place",
            display_name=display_name,
            matched_text=matched_text,
            place_ids=ordered_place_ids,
            cluster_ids=cluster_ids,
            confidence=confidence,
        )

    def _build_cluster_entity(self, matched_text: str, cluster_ids: Iterable[str], confidence: float) -> ResolvedEntity:
        ordered_cluster_ids = sorted(set(cluster_ids))
        first_cluster = self.snapshot.area_clusters[ordered_cluster_ids[0]]
        normalized_matched_text = normalize_text(matched_text)
        exact_label_candidates = [first_cluster.name, *first_cluster.aliases]
        preferred_exact_label = next(
            (
                matched_text.strip() if matched_text.strip() else candidate.strip()
                for candidate in exact_label_candidates
                if candidate and normalize_text(candidate) == normalized_matched_text
            ),
            matched_text.strip(),
        )
        place_ids = dedupe_keep_order(
            member.place_id
            for cluster_id in ordered_cluster_ids
            for member in self.cluster_members.get(cluster_id, [])
        )
        return ResolvedEntity(
            entity_type="cluster",
            display_name=preferred_exact_label or first_cluster.name,
            matched_text=matched_text,
            place_ids=place_ids,
            cluster_ids=ordered_cluster_ids,
            confidence=confidence,
        )

    def _rank_place_ids_for_query(self, matched_text: str, place_ids: Iterable[str]) -> list[str]:
        normalized_text_value = normalize_text(matched_text)
        unique_place_ids = sorted(set(place_ids))
        if len(unique_place_ids) <= 1:
            return unique_place_ids

        enriched = []
        for place_id in unique_place_ids:
            place = self.snapshot.places[place_id]
            enriched.append(
                (
                    self._place_identity_score(normalized_text_value, place),
                    self.ranker.score_place_record_for_query(normalized_text_value, place),
                    self._place_match_priority(normalized_text_value, place),
                    self._route_like_name_penalty(place.name),
                    place_id,
                )
            )

        scored = sorted(
            enriched,
            key=lambda item: (
                -item[0],
                -item[1],
                -item[2],
                item[3],
                self.snapshot.places[item[4]].name.lower(),
            ),
        )
        best_identity = scored[0][0]
        best_score = scored[0][1]
        best_priority = scored[0][2]
        keep_threshold = max(0.72, best_score - 0.08)
        keep_identity = 0.0
        if best_identity >= 0.84:
            keep_identity = max(0.84, best_identity - 0.16)
        filtered = [
            place_id
            for identity_score, score, priority, _penalty, place_id in scored
            if score >= keep_threshold
            and priority >= best_priority
            and identity_score >= keep_identity
        ]
        return filtered[:5]

    def _place_identity_score(self, normalized_text_value: str, place) -> float:
        identity_candidates = [
            place.name,
            place.canonical_name,
            *place.aliases,
        ]
        return max(
            (
                self.ranker.score_candidate_key(normalized_text_value, normalize_text(candidate))
                for candidate in identity_candidates
                if candidate and normalize_text(candidate)
            ),
            default=0.0,
        )

    def _place_match_priority(self, normalized_text_value: str, place) -> int:
        canonical_keys = {
            place.normalized_name,
            normalize_text(place.name),
            normalize_text(place.canonical_name),
        }
        alias_keys = {
            *(normalize_text(alias) for alias in place.aliases),
            *(normalize_text(alias) for alias in place.normalized_aliases),
        }
        address_keys = {
            normalize_text(place.address or ""),
            *(normalize_text(alias) for alias in place.address_aliases),
        }

        if normalized_text_value in canonical_keys:
            return 3
        if normalized_text_value in alias_keys:
            return 2
        if normalized_text_value in address_keys:
            return 1
        return 0

    def _route_like_name_penalty(self, name: str) -> int:
        normalized_name = normalize_text(name)
        return 1 if any(marker in normalized_name for marker in (" to ", " via ", " and vice versa")) else 0

    def _to_resolution_candidate(self, entity: ResolvedEntity, reason: str) -> ResolutionCandidate:
        if entity.entity_type == "place":
            candidate_id = entity.place_ids[0]
        else:
            candidate_id = entity.cluster_ids[0]
        return ResolutionCandidate(
            id=candidate_id,
            name=entity.display_name,
            entity_type=entity.entity_type,
            confidence=round(entity.confidence, 3),
            reason=reason,
        )

    def _match_type(self, top_match: ResolutionCandidate | None) -> str:
        if top_match is None:
            return "none"
        if top_match.reason.startswith("Manual override"):
            return "override"
        return top_match.entity_type

    def _confidence_tier(self, top_match: ResolutionCandidate | None) -> str:
        if top_match is None:
            return "low"
        if top_match.reason.startswith("Manual override") or top_match.confidence >= 0.95:
            if top_match.entity_type == "cluster":
                return "low"
            return "high"
        if top_match.entity_type == "cluster":
            return "low"
        return "medium"
