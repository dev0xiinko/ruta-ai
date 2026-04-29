from __future__ import annotations

from fastapi.testclient import TestClient

from ruta_backend.api import app
from ruta_backend.api import chat as chat_api
from ruta_backend.api import feedback as feedback_api
from ruta_backend.api import resolve as resolve_api
from ruta_backend.api import route as route_api
from ruta_backend.services import ChatService, QueryLogger, RouteQueryService

from test_engine import build_snapshot


class FakeRouteRepository:
    def __init__(self, snapshot) -> None:
        self._snapshot = snapshot

    def get_snapshot(self, force_refresh: bool = False):
        return self._snapshot


class FakeLogRepository:
    def __init__(self) -> None:
        self.query_payload: dict | None = None
        self.feedback_payload: dict | None = None

    def insert_query_log(self, **payload) -> None:
        self.query_payload = payload

    def insert_route_query_feedback(self, **payload) -> None:
        self.feedback_payload = payload


class FakeLegacyService:
    def answer(self, query: str, *, force_refresh: bool = False) -> dict:
        return {"legacy": True, "query": query, "force_refresh": force_refresh}


def test_resolve_endpoint_returns_ranked_candidates(monkeypatch) -> None:
    snapshot = build_snapshot()
    monkeypatch.setattr(resolve_api, "get_route_repository", lambda: FakeRouteRepository(snapshot))
    client = TestClient(app)

    response = client.post("/api/resolve", json={"text": "IT Park"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["resolution"]["top_match"]["id"] == "pl_it_park"
    assert payload["resolution"]["top_match"]["entity_type"] == "place"


def test_route_endpoint_returns_structured_result(monkeypatch) -> None:
    snapshot = build_snapshot()
    monkeypatch.setattr(route_api, "get_route_repository", lambda: FakeRouteRepository(snapshot))
    client = TestClient(app)

    response = client.post(
        "/api/route",
        json={"origin_text": "IT Park", "destination_text": "Carbon", "language": "en"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["result"]["mode"] == "direct"
    assert payload["result"]["options"][0]["route_codes"] == ["17B"]
    assert "ride 17B" in payload["result"]["message"]


def test_route_query_endpoint_uses_modular_route_service(monkeypatch) -> None:
    snapshot = build_snapshot()
    fake_log_repository = FakeLogRepository()
    route_query_service = RouteQueryService(
        snapshot_loader=lambda force_refresh=False: snapshot,
        query_logger=QueryLogger(fake_log_repository),  # type: ignore[arg-type]
        legacy_service=FakeLegacyService(),
    )
    monkeypatch.setattr(route_api, "get_route_query_service", lambda: route_query_service)
    client = TestClient(app)

    response = client.post("/api/route-query", json={"query": "IT Park to Carbon"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["query_kind"] == "place_to_place"
    assert payload["routes"][0]["route_code"] == "17B"
    assert fake_log_repository.query_payload is not None
    assert fake_log_repository.query_payload["response_type"] in {"direct_access", "nearby_access"}


def test_feedback_endpoint_writes_feedback_via_query_logger(monkeypatch) -> None:
    fake_log_repository = FakeLogRepository()
    monkeypatch.setattr(feedback_api, "get_query_logger", lambda: QueryLogger(fake_log_repository))  # type: ignore[arg-type]
    client = TestClient(app)

    response = client.post(
        "/api/feedback",
        json={
            "session_id": "session-1",
            "page_context": "simulation",
            "raw_query": "IT Park to Carbon",
            "feedback_verdict": "good",
            "feedback_notes": "Looks right.",
            "response": {"mode": "direct", "title": "Route Results", "confidence": 0.91},
            "user_agent": "pytest",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert fake_log_repository.feedback_payload is not None
    assert fake_log_repository.feedback_payload["response_mode"] == "direct"
    assert fake_log_repository.feedback_payload["raw_query"] == "IT Park to Carbon"


def test_chat_endpoint_uses_modular_route_query_flow(monkeypatch) -> None:
    snapshot = build_snapshot()
    fake_log_repository = FakeLogRepository()
    chat_service = ChatService(
        snapshot_loader=lambda force_refresh=False: snapshot,
        query_logger=QueryLogger(fake_log_repository),  # type: ignore[arg-type]
        legacy_service=FakeLegacyService(),
    )
    monkeypatch.setattr(chat_api, "get_chat_service", lambda: chat_service)
    client = TestClient(app)

    response = client.post("/api/chat", json={"message": "IT Park to Carbon"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"]["parse"]["intent"] == "route_query"
    assert payload["data"]["route"]["result"]["mode"] == "direct"
    assert payload["data"]["route"]["result"]["options"][0]["route_codes"] == ["17B"]
    assert fake_log_repository.query_payload is not None
    assert fake_log_repository.query_payload["response_type"] == "direct"
