from __future__ import annotations

import argparse
import json
from hashlib import sha1
from pathlib import Path
from typing import Any

from .models import FeedbackRecord
from .repository import DatabaseRepository
from .settings import Settings


def _extract_route_codes(response_payload: dict[str, Any]) -> list[str]:
    route_codes: list[str] = []
    primary_match = response_payload.get("primaryMatch")
    if isinstance(primary_match, dict) and primary_match.get("code"):
        route_codes.append(str(primary_match["code"]))

    for item in response_payload.get("matches", []):
        if isinstance(item, dict) and item.get("code"):
            route_codes.append(str(item["code"]))

    for item in response_payload.get("routes", []):
        if not isinstance(item, dict):
            continue
        for key in ("route_code", "first_route", "second_route"):
            value = item.get(key)
            if value:
                route_codes.append(str(value))
    return list(dict.fromkeys(route_codes))


def _suggest_assertions(feedback: FeedbackRecord) -> list[dict[str, str]]:
    payload = feedback.response_payload if isinstance(feedback.response_payload, dict) else {}
    response_type = str(payload.get("response_type") or payload.get("mode") or "").strip()
    query_kind = str(payload.get("query_kind") or payload.get("mode") or "").strip()
    suggestions: list[dict[str, str]] = []

    if feedback.feedback_verdict != "bad":
        return suggestions

    if response_type == "no_match":
        suggestions.append(
            {
                "kind": "not_response_type",
                "value": "no_match",
                "reason": "Bad feedback flagged a hard failure; future fix should return a practical route hint.",
            }
        )

    if query_kind in {"route_lookup", "route_code"} and not _extract_route_codes(payload):
        suggestions.append(
            {
                "kind": "expect_route_codes",
                "value": ">=1",
                "reason": "Route lookup feedback should eventually return at least one route code.",
            }
        )

    if query_kind in {"place_to_place", "trip_search"} and response_type in {"no_match", "area_access"}:
        suggestions.append(
            {
                "kind": "prefer_response_type",
                "value": "direct_access|nearby_access|transfer_required",
                "reason": "Trip planning feedback suggests the planner should produce a more useful commuter path.",
            }
        )

    return suggestions


def build_feedback_seed_entry(feedback: FeedbackRecord) -> dict[str, Any]:
    payload = feedback.response_payload if isinstance(feedback.response_payload, dict) else {}
    route_codes = _extract_route_codes(payload)
    stable_key = feedback.feedback_id or sha1(
        f"{feedback.raw_query}|{feedback.created_at or ''}".encode("utf-8")
    ).hexdigest()[:12]

    return {
        "seed_id": f"feedback:{stable_key}",
        "status": "triage",
        "source": {
            "feedback_id": feedback.feedback_id,
            "session_id": feedback.session_id,
            "page_context": feedback.page_context,
            "created_at": feedback.created_at,
        },
        "query": feedback.raw_query,
        "notes": feedback.feedback_notes,
        "current_response": {
            "response_type": payload.get("response_type") or payload.get("mode"),
            "query_kind": payload.get("query_kind") or payload.get("mode"),
            "confidence": payload.get("confidence") or feedback.response_confidence,
            "title": payload.get("title") or feedback.response_title,
            "mode": payload.get("mode") or feedback.response_mode,
            "route_codes": route_codes,
            "answer": payload.get("answer"),
        },
        "suggested_assertions": _suggest_assertions(feedback),
        "expected": {},
    }


def export_feedback_seed_entries(feedback_rows: list[FeedbackRecord]) -> list[dict[str, Any]]:
    return [build_feedback_seed_entry(row) for row in feedback_rows]


def _load_seed_file(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    content = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(content, list):
        return [item for item in content if isinstance(item, dict)]
    return []


def merge_seed_entries(
    existing_entries: list[dict[str, Any]],
    new_entries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_id = {
        str(entry.get("seed_id")): dict(entry)
        for entry in existing_entries
        if entry.get("seed_id")
    }

    for entry in new_entries:
        seed_id = str(entry.get("seed_id") or "")
        if not seed_id:
            continue

        current = by_id.get(seed_id)
        if not current:
            by_id[seed_id] = dict(entry)
            continue

        preserved = {
            "status": current.get("status"),
            "expected": current.get("expected"),
            "owner_notes": current.get("owner_notes"),
        }
        updated = dict(entry)
        for key, value in preserved.items():
            if value not in (None, {}, []):
                updated[key] = value
        by_id[seed_id] = updated

    return sorted(
        by_id.values(),
        key=lambda entry: str(entry.get("source", {}).get("created_at") or ""),
        reverse=True,
    )


def write_seed_file(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export route_query_feedback rows into regression seed entries."
    )
    parser.add_argument("--verdict", default="bad", choices=["good", "bad"])
    parser.add_argument("--page-context", default="simulation")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument(
        "--output",
        default="backend/tests/fixtures/feedback-regressions.seed.json",
    )
    args = parser.parse_args()

    settings = Settings.from_env()
    repository = DatabaseRepository(settings)
    feedback_rows = repository.list_feedback(
        feedback_verdict=args.verdict,
        page_context=args.page_context,
        limit=args.limit,
    )
    generated_entries = export_feedback_seed_entries(feedback_rows)

    output_path = Path(args.output)
    merged_entries = merge_seed_entries(_load_seed_file(output_path), generated_entries)
    write_seed_file(output_path, merged_entries)
    print(f"Wrote {len(merged_entries)} feedback regression seeds to {output_path}")


if __name__ == "__main__":
    main()
