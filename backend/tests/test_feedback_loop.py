from __future__ import annotations

from ruta_backend.feedback_loop import (
    build_feedback_seed_entry,
    merge_seed_entries,
)
from ruta_backend.models import FeedbackRecord


def make_feedback(
    *,
    feedback_id: str = "fb-1",
    raw_query: str = "IT Park to Galleria",
    verdict: str = "bad",
    notes: str | None = "Should not fail.",
    response_payload: dict | None = None,
) -> FeedbackRecord:
    return FeedbackRecord(
        feedback_id=feedback_id,
        session_id="session-1",
        page_context="simulation",
        raw_query=raw_query,
        feedback_verdict=verdict,
        feedback_notes=notes,
        response_mode="guide",
        response_title="Route results",
        response_confidence="low",
        response_payload=response_payload
        or {
            "query_kind": "place_to_place",
            "response_type": "no_match",
            "confidence": 0.23,
            "answer": "No match.",
            "routes": [],
        },
        user_agent="pytest",
        created_at="2026-04-21T12:00:00+08:00",
    )


def test_build_feedback_seed_entry_suggests_fix_for_no_match() -> None:
    entry = build_feedback_seed_entry(make_feedback())

    assert entry["seed_id"] == "feedback:fb-1"
    assert entry["status"] == "triage"
    assert entry["query"] == "IT Park to Galleria"
    assert entry["current_response"]["response_type"] == "no_match"
    assert entry["suggested_assertions"][0]["kind"] == "not_response_type"


def test_build_feedback_seed_entry_extracts_route_codes() -> None:
    entry = build_feedback_seed_entry(
        make_feedback(
            response_payload={
                "query_kind": "route_lookup",
                "response_type": "route_lookup",
                "confidence": 0.91,
                "answer": "Ride 17B.",
                "routes": [{"route_code": "17B"}, {"first_route": "10H", "second_route": "MI-02B"}],
            }
        )
    )

    assert entry["current_response"]["route_codes"] == ["17B", "10H", "MI-02B"]


def test_build_feedback_seed_entry_understands_frontend_bot_payload() -> None:
    entry = build_feedback_seed_entry(
        make_feedback(
            response_payload={
                "mode": "trip_search",
                "title": "IT Park to Colon",
                "confidence": "High confidence",
                "answer": "Ride 17B.",
                "primaryMatch": {"code": "17B"},
                "matches": [{"code": "17C"}],
            }
        )
    )

    assert entry["current_response"]["response_type"] == "trip_search"
    assert entry["current_response"]["query_kind"] == "trip_search"
    assert entry["current_response"]["route_codes"] == ["17B", "17C"]


def test_merge_seed_entries_preserves_manual_annotations() -> None:
    existing = [
        {
            "seed_id": "feedback:fb-1",
            "status": "approved",
            "query": "IT Park to Galleria",
            "owner_notes": "Confirmed with field tester.",
            "expected": {"response_type_in": ["nearby_access", "transfer_required"]},
            "source": {"created_at": "2026-04-21T12:00:00+08:00"},
        }
    ]
    new_entries = [
        build_feedback_seed_entry(
            make_feedback(
                notes="New export notes.",
                response_payload={"query_kind": "place_to_place", "response_type": "area_access", "routes": []},
            )
        )
    ]

    merged = merge_seed_entries(existing, new_entries)

    assert merged[0]["status"] == "approved"
    assert merged[0]["owner_notes"] == "Confirmed with field tester."
    assert merged[0]["expected"] == {"response_type_in": ["nearby_access", "transfer_required"]}
    assert merged[0]["notes"] == "New export notes."
