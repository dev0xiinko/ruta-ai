from __future__ import annotations

from ruta_backend.models import ResolvedEntity, RouteQueryResponse
from ruta_backend.services.query_logger import QueryLogger


class FakeLogRepository:
    def __init__(self) -> None:
        self.query_payload: dict | None = None
        self.feedback_payload: dict | None = None

    def insert_query_log(self, **payload) -> None:
        self.query_payload = payload

    def insert_route_query_feedback(self, **payload) -> None:
        self.feedback_payload = payload


def test_query_logger_builds_query_log_payload() -> None:
    repository = FakeLogRepository()
    query_logger = QueryLogger(repository)  # type: ignore[arg-type]

    response = RouteQueryResponse(
        query="IT Park to Carbon",
        query_kind="place_to_place",
        origin=ResolvedEntity(entity_type="place", display_name="IT Park", matched_text="IT Park", place_ids=["pl_it_park"], cluster_ids=["it_park"], confidence=1.0),
        destination=ResolvedEntity(entity_type="place", display_name="Carbon", matched_text="Carbon", place_ids=["pl_carbon"], cluster_ids=[], confidence=1.0),
        route_code=None,
        response_type="direct_access",
        confidence=0.97,
        answer="Ride 17B.",
        routes=[{"route_code": "17B"}],
        metadata={"parsed": {"kind": "place_to_place"}},
    )

    payload = query_logger.log_query_response(response)

    assert repository.query_payload is not None
    assert repository.query_payload["raw_query"] == "IT Park to Carbon"
    assert repository.query_payload["matched_place_ids"] == ["pl_it_park", "pl_carbon"]
    assert repository.query_payload["chosen_routes"] == ["17B"]
    assert payload["response_type"] == "direct_access"


def test_query_logger_builds_feedback_payload() -> None:
    repository = FakeLogRepository()
    query_logger = QueryLogger(repository)  # type: ignore[arg-type]

    result = query_logger.log_feedback_submission(
        session_id="session-1",
        page_context="simulation",
        raw_query="IT Park to Carbon",
        feedback_verdict="good",
        feedback_notes="Looks right.",
        response={"mode": "direct", "title": "Route Results", "confidence": 0.91},
        user_agent="pytest",
    )

    assert result == {"ok": True}
    assert repository.feedback_payload is not None
    assert repository.feedback_payload["response_mode"] == "direct"
    assert repository.feedback_payload["response_title"] == "Route Results"
    assert repository.feedback_payload["response_confidence"] == "0.91"


def test_query_logger_builds_structured_chat_payload() -> None:
    repository = FakeLogRepository()
    query_logger = QueryLogger(repository)  # type: ignore[arg-type]

    result = query_logger.log_structured_chat(
        raw_query="IT Park to Carbon",
        parse_result={
            "intent": "route_query",
            "origin_text": "IT Park",
            "destination_text": "Carbon",
            "route_code": None,
            "language": "en",
            "confidence": "medium",
        },
        origin={
            "top_match": {
                "id": "pl_it_park",
                "name": "IT Park",
                "entity_type": "place",
            }
        },
        destination={
            "top_match": {
                "id": "pl_carbon",
                "name": "Carbon",
                "entity_type": "place",
            }
        },
        route_payload={
            "result": {
                "mode": "direct",
                "options": [
                    {
                        "route_codes": ["17B"],
                        "confidence": 0.97,
                    }
                ],
            }
        },
    )

    assert result["result"]["mode"] == "direct"
    assert repository.query_payload is not None
    assert repository.query_payload["query_kind"] == "route_query"
    assert repository.query_payload["matched_place_ids"] == ["pl_it_park", "pl_carbon"]
    assert repository.query_payload["chosen_routes"] == ["17B"]
    assert repository.query_payload["response_type"] == "direct"
