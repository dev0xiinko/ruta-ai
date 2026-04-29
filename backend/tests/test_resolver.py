from __future__ import annotations

from ruta_backend.models import PlaceRecord
from ruta_backend.services.resolver import Resolver

from test_engine import build_snapshot
from ruta_backend.utils import normalize_text


def test_resolver_exact_place_match() -> None:
    resolver = Resolver(build_snapshot())

    result = resolver.resolve_text("IT Park")

    assert result.top_match is not None
    assert result.top_match.entity_type == "place"
    assert result.top_match.id == "pl_it_park"
    assert result.top_match.name == "IT Park"
    assert result.confidence == "high"


def test_resolver_cluster_fallback() -> None:
    resolver = Resolver(build_snapshot())

    result = resolver.resolve_text("Pier")

    assert result.top_match is not None
    assert result.top_match.entity_type == "cluster"
    assert result.top_match.id == "galleria_pier"
    assert result.top_match.name == "Pier"
    assert result.confidence == "low"
    assert "cluster" in result.reason.lower() or "area" in result.reason.lower()


def test_resolver_prefers_exact_place_name_over_broad_address_alias_matches() -> None:
    snapshot = build_snapshot()
    snapshot.places["pl_it_park_noisy_1"] = PlaceRecord(
        place_id="pl_it_park_noisy_1",
        name="AS Fortuna Street",
        canonical_name="AS Fortuna Street",
        normalized_name=normalize_text("AS Fortuna Street"),
        type="road",
        aliases=["AS Fortuna Street"],
        normalized_aliases=[
            normalize_text("AS Fortuna Street"),
            normalize_text("it park"),
            normalize_text("cebu it park"),
        ],
        address=None,
        address_aliases=["it park", "cebu it park", "lahug it park"],
        street="AS Fortuna Street",
        barangay=None,
        city="Mandaue City",
        province="Cebu",
        lat=None,
        lng=None,
        area_clusters=["it_park"],
        raw_payload={},
    )
    snapshot.places["pl_it_park_noisy_2"] = PlaceRecord(
        place_id="pl_it_park_noisy_2",
        name="Carbon to Lahug via Osmena Boulevard. Carbon",
        canonical_name="Carbon to Lahug via Osmena Boulevard. Carbon",
        normalized_name=normalize_text("Carbon to Lahug via Osmena Boulevard. Carbon"),
        type="route_phrase",
        aliases=["Carbon to Lahug via Osmena Boulevard. Carbon"],
        normalized_aliases=[
            normalize_text("Carbon to Lahug via Osmena Boulevard. Carbon"),
            normalize_text("it park"),
        ],
        address=None,
        address_aliases=["it park", "cebu it park", "lahug it park"],
        street=None,
        barangay=None,
        city="Cebu City",
        province="Cebu",
        lat=None,
        lng=None,
        area_clusters=["it_park"],
        raw_payload={},
    )

    resolver = Resolver(snapshot)
    result = resolver.resolve_text("IT Park")

    assert result.top_match is not None
    assert result.top_match.entity_type == "place"
    assert result.top_match.id == "pl_it_park"
    assert result.top_match.name == "IT Park"

    entity = resolver.resolve_entity("IT Park")

    assert entity is not None
    assert entity.place_ids == ["pl_it_park"]
