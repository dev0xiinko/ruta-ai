from __future__ import annotations

from .core.db import DatabaseClient
from .models import FeedbackRecord, RoutingSnapshot
from .repositories import LogRepository, RouteRepository
from .settings import Settings


class DatabaseRepository:
    """Compatibility facade over the new route and log repositories."""

    def __init__(self, settings: Settings):
        db = DatabaseClient(settings)
        self._routes = RouteRepository(db)
        self._logs = LogRepository(db)

    def get_snapshot(self, force_refresh: bool = False) -> RoutingSnapshot:
        return self._routes.get_snapshot(force_refresh=force_refresh)

    def log_query(self, **payload: object) -> None:
        self._logs.insert_query_log(**payload)

    def log_feedback(self, **payload: object) -> None:
        self._logs.insert_route_query_feedback(**payload)

    def list_feedback(
        self,
        *,
        feedback_verdict: str | None = None,
        page_context: str | None = None,
        limit: int = 200,
    ) -> list[FeedbackRecord]:
        return self._logs.list_feedback(
            feedback_verdict=feedback_verdict,
            page_context=page_context,
            limit=limit,
        )
