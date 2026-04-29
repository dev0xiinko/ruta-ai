from __future__ import annotations

from ruta_backend.services.chat_service import ChatService
from ruta_backend.services.query_logger import QueryLogger

from test_engine import build_snapshot


class FakeLogRepository:
    def __init__(self) -> None:
        self.query_payload: dict | None = None

    def insert_query_log(self, **payload) -> None:
        self.query_payload = payload

    def insert_route_query_feedback(self, **payload) -> None:
        raise AssertionError("feedback logging should not be called in this test")


class FakeLegacyService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, bool]] = []

    def answer(self, query: str, *, force_refresh: bool = False) -> dict:
        self.calls.append((query, force_refresh))
        return {"legacy": True, "query": query}


def test_chat_service_uses_modular_route_query_flow() -> None:
    repository = FakeLogRepository()
    legacy_service = FakeLegacyService()
    chat_service = ChatService(
        snapshot_loader=lambda force_refresh=False: build_snapshot(),
        query_logger=QueryLogger(repository),  # type: ignore[arg-type]
        legacy_service=legacy_service,
    )

    payload = chat_service.answer("IT Park to Carbon")

    assert payload["status"] == "success"
    assert payload["data"]["parse"]["intent"] == "route_query"
    assert payload["data"]["route"]["result"]["mode"] == "direct"
    assert payload["data"]["route"]["result"]["options"][0]["route_codes"] == ["17B"]
    assert repository.query_payload is not None
    assert repository.query_payload["response_type"] == "direct"
    assert legacy_service.calls == []


def test_chat_service_falls_back_to_legacy_for_route_lookup() -> None:
    repository = FakeLogRepository()
    legacy_service = FakeLegacyService()
    chat_service = ChatService(
        snapshot_loader=lambda force_refresh=False: build_snapshot(),
        query_logger=QueryLogger(repository),  # type: ignore[arg-type]
        legacy_service=legacy_service,
    )

    payload = chat_service.answer("17B route details", force_refresh=True)

    assert payload == {"legacy": True, "query": "17B route details"}
    assert legacy_service.calls == [("17B route details", True)]
    assert repository.query_payload is None
