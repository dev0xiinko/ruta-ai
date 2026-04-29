from __future__ import annotations

from ruta_backend.importer import (
    build_link_row,
    build_manual_override_rows,
    build_transfer_row,
)


def test_build_link_row_downgrades_weak_direct_school_match() -> None:
    row = build_link_row(
        {
            "route_code": "17B",
            "place_id": "pl_cebu_doc",
            "relation": "direct_access",
            "source_field": "schools",
            "dropoff_stop": None,
            "walk_minutes": 0,
            "distance_m": 0.0,
            "confidence": "high",
        }
    )

    assert row["relation"] == "area_access"
    assert row["walk_minutes"] == 5
    assert row["distance_m"] == 350.0
    assert row["confidence"] == "low"


def test_build_link_row_keeps_strong_stop_direct_match() -> None:
    row = build_link_row(
        {
            "route_code": "17B",
            "place_id": "pl_it_park",
            "relation": "direct_access",
            "source_field": "stops",
            "dropoff_stop": "IT Park terminal",
            "walk_minutes": 0,
            "distance_m": 0.0,
            "confidence": "high",
        }
    )

    assert row["relation"] == "direct_access"
    assert row["confidence"] == "high"


def test_build_transfer_row_downgrades_shared_area_only_confidence() -> None:
    row = build_transfer_row(
        {
            "route_code": "10H",
            "connects_to": "MI-02B",
            "shared_places": [],
            "shared_areas": ["sm_city"],
            "transfer_reason": "shared_area",
            "confidence": "high",
        }
    )

    assert row["confidence"] == "low"


def test_build_manual_override_rows_resolves_curated_cebu_aliases() -> None:
    places = [
        {
            "place_id": "pl_usc_tc",
            "name": "University of San Carlos talamban",
            "canonical_name": "University of San Carlos talamban",
            "aliases": ["USC-talamban"],
            "address_aliases": [],
        },
        {
            "place_id": "pl_usc_main",
            "name": "University of San Carlos Main Campus",
            "canonical_name": "University of San Carlos Main Campus",
            "aliases": ["USC Main"],
            "address_aliases": [],
        },
        {
            "place_id": "pl_cebu_doc",
            "name": "Cebu Doctors Hospital",
            "canonical_name": "Cebu Doctors Hospital",
            "aliases": ["Cebu Doctors Hospital"],
            "address_aliases": [],
        },
        {
            "place_id": "pl_jy",
            "name": "Jy Square Mall",
            "canonical_name": "Jy Square Mall",
            "aliases": ["JY Square Mall"],
            "address_aliases": [],
        },
        {
            "place_id": "pl_emall",
            "name": "Elizabeth Mall",
            "canonical_name": "Elizabeth Mall",
            "aliases": ["EMall"],
            "address_aliases": [],
        },
        {
            "place_id": "pl_act",
            "name": "Asian College of Technology",
            "canonical_name": "Asian College of Technology",
            "aliases": ["ACT"],
            "address_aliases": [],
        },
        {
            "place_id": "pl_galleria",
            "name": "robinsons galleria cebu",
            "canonical_name": "robinsons galleria cebu",
            "aliases": ["Robinsons Galleria Cebu"],
            "address_aliases": [],
        },
    ]

    rows = build_manual_override_rows(places)
    by_key = {row["normalized_match_key"]: row for row in rows}

    assert by_key["usc tc"]["target_place_id"] == "pl_usc_tc"
    assert by_key["usc main"]["target_place_id"] == "pl_usc_main"
    assert by_key["cebu doc"]["target_place_id"] == "pl_cebu_doc"
    assert by_key["jy"]["target_place_id"] == "pl_jy"
    assert by_key["emall"]["target_place_id"] == "pl_emall"
    assert by_key["act"]["target_place_id"] == "pl_act"
    assert by_key["rob galleria"]["target_place_id"] == "pl_galleria"
