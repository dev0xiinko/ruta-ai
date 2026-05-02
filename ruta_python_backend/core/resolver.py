from __future__ import annotations

import re
from collections import defaultdict

from ruta_python_backend.core.dataset import RouteDataset
from ruta_python_backend.core.models import Place, PlaceCandidate

# Strip leading/trailing punctuation wrappers like ('Parkmall') or "Lahug"
_STRIP_WRAPPERS = re.compile(r"^[\s('\"]+|[\s)'\"]+$")
# Collapse multiple spaces
_MULTI_SPACE = re.compile(r"\s+")

# Common noise/filler words to strip before matching
_NOISE_WORDS = frozenset(
    {"near", "sa", "dol", "duol", "padulong", "gikan", "from", "the", "ang", "ng"}
)


def normalize_text(value: str) -> str:
    """Lowercase, strip punctuation to spaces, collapse whitespace."""
    cleaned = "".join(
        char.lower() if char.isalnum() or char.isspace() else " " for char in value
    )
    return _MULTI_SPACE.sub(" ", cleaned).strip()


def clean_query_fragment(text: str) -> str:
    """
    Extra pre-processing applied only to user query fragments before scoring.
    Strips wrapper punctuation like ('...') and removes noise words.
    """
    # Strip outer punctuation wrappers like (' or ')
    stripped = _STRIP_WRAPPERS.sub("", text)
    normalized = normalize_text(stripped)
    # Remove leading noise words (e.g. "near colon" → "colon")
    tokens = [t for t in normalized.split() if t not in _NOISE_WORDS]
    return " ".join(tokens)


def token_overlap_score(left: str, right: str) -> float:
    """Jaccard-style token overlap."""
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    if not left_tokens or not right_tokens:
        return 0.0
    shared = len(left_tokens & right_tokens)
    return shared / max(len(left_tokens), len(right_tokens))


def _starts_with_score(query: str, alias: str) -> float:
    """Reward when query starts with the alias (strong directional match)."""
    if alias and query.startswith(alias):
        return len(alias) / max(len(query), 1)
    return 0.0


class PlaceResolver:
    def __init__(self, dataset: RouteDataset) -> None:
        self.dataset = dataset
        self.min_confidence = float(self.dataset.resolver_rules.get("min_confidence", 0.2))
        # Disambiguation: reject top candidate if gap to 2nd is < this threshold
        self.ambiguity_gap = float(
            self.dataset.resolver_rules.get("ambiguity_gap", 0.08)
        )
        self.alias_index: dict[str, list[Place]] = defaultdict(list)
        self.cluster_aliases: dict[str, list[str]] = {}
        self._build_indexes()

    def _build_indexes(self) -> None:
        for cluster in self.dataset.area_clusters:
            self.cluster_aliases[cluster.cluster_id] = [
                normalize_text(alias) for alias in cluster.aliases
            ]

        for place in self.dataset.places.values():
            aliases = {place.name, *place.aliases}
            if place.area:
                aliases.add(place.area)
            for alias in aliases:
                normalized_alias = normalize_text(alias)
                if normalized_alias:
                    self.alias_index[normalized_alias].append(place)

    def resolve_candidates(self, text: str) -> list[PlaceCandidate]:
        # Apply extra pre-cleaning to user query fragments
        cleaned = clean_query_fragment(text)
        if not cleaned:
            # Fallback: try plain normalize if pre-cleaning produced empty string
            cleaned = normalize_text(text)
        if not cleaned:
            return []

        scored: list[PlaceCandidate] = []
        for place in self.dataset.places.values():
            score, reason = self._score_place(cleaned, place)
            if score >= self.min_confidence:
                scored.append(
                    PlaceCandidate(
                        place_id=place.place_id,
                        name=place.name,
                        confidence=round(min(score, 0.99), 2),
                        match_reason=reason,
                    )
                )

        scored.sort(key=lambda item: (-item.confidence, item.name))
        top5 = scored[:5]

        # Disambiguation: if top-2 are too close in score, flag ambiguity
        if len(top5) >= 2:
            gap = top5[0].confidence - top5[1].confidence
            if gap < self.ambiguity_gap:
                # Mark top candidate as ambiguous so caller can surface both options
                top5[0] = PlaceCandidate(
                    place_id=top5[0].place_id,
                    name=top5[0].name,
                    confidence=top5[0].confidence,
                    match_reason=top5[0].match_reason + " [ambiguous]",
                )

        return top5

    def top_candidate(self, text: str) -> PlaceCandidate | None:
        candidates = self.resolve_candidates(text)
        return candidates[0] if candidates else None

    def build_confirmation_message(
        self,
        origin_candidates: list[PlaceCandidate],
        destination_candidates: list[PlaceCandidate],
    ) -> str:
        if not origin_candidates or not destination_candidates:
            return "I could not safely normalize both points yet. Please provide a clearer landmark."

        origin = origin_candidates[0]
        destination = destination_candidates[0]

        origin_note = " *(please confirm — similar places exist)*" if "[ambiguous]" in (origin.match_reason or "") else ""
        dest_note = " *(please confirm — similar places exist)*" if "[ambiguous]" in (destination.match_reason or "") else ""

        return (
            "I normalized your points as:\n\n"
            f"Point A: {origin.name}{origin_note}\n"
            f"Point B: {destination.name}{dest_note}\n\n"
            "Is this correct?"
        )

    def _score_place(self, cleaned_query: str, place: Place) -> tuple[float, str]:
        aliases = {normalize_text(place.name), *(normalize_text(alias) for alias in place.aliases)}
        aliases.discard("")

        score = 0.0
        reasons: list[str] = []

        # --- Exact full match (highest signal) ---
        if cleaned_query in aliases:
            score += 0.80
            reasons.append("exact alias")

        # --- Alias is fully contained in query (e.g. "carbon" in "near carbon market") ---
        contains_match = [a for a in aliases if a and a in cleaned_query]
        if contains_match:
            # Weight by length of longest match to prefer specific over generic
            best_len = max(len(a) for a in contains_match)
            weight = min(0.20, 0.10 + best_len / (len(cleaned_query) + 1) * 0.15)
            score += weight
            reasons.append("alias contained")

        # --- Token overlap (Jaccard) ---
        overlap = max((token_overlap_score(cleaned_query, alias) for alias in aliases), default=0.0)
        if overlap > 0:
            score += overlap * 0.30
            reasons.append("token overlap")

        # --- Starts-with bonus (e.g. "it park" starts alias "it park cebu") ---
        sw = max((_starts_with_score(alias, cleaned_query) for alias in aliases), default=0.0)
        if sw > 0:
            score += sw * 0.10
            reasons.append("starts-with")

        # --- Area context bonus ---
        if place.area and normalize_text(place.area) in cleaned_query:
            score += 0.08
            reasons.append(f"area {place.area}")

        # --- Cluster alias bonus ---
        cluster_aliases = self.cluster_aliases.get(place.cluster_id or "", [])
        matched_cluster = next((a for a in cluster_aliases if a in cleaned_query), None)
        if matched_cluster:
            score += 0.06
            reasons.append("area cluster")

        # --- Importance tiebreaker (scaled 0–0.1) ---
        score += min(place.importance_rank, 100) / 1000

        reason = " + ".join(reasons) if reasons else "fuzzy name match"
        return score, reason
