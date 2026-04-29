from __future__ import annotations

from typing import Any

from .core.db import DatabaseClient
from .engine import RutaQueryEngine
from .feedback_loop import export_feedback_seed_entries
from .repositories import LogRepository
from .repository import DatabaseRepository
from .services import QueryLogger
from .settings import Settings


class RutaResponseService:
    def __init__(self, repository: DatabaseRepository, query_logger: QueryLogger):
        self._repository = repository
        self._query_logger = query_logger

    @classmethod
    def from_settings(cls, settings: Settings) -> "RutaResponseService":
        repository = DatabaseRepository(settings)
        query_logger = QueryLogger(LogRepository(DatabaseClient(settings)))
        return cls(repository, query_logger)

    def answer(self, query: str, *, force_refresh: bool = False) -> dict[str, Any]:
        snapshot = self._repository.get_snapshot(force_refresh=force_refresh)
        engine = RutaQueryEngine(snapshot)
        response = engine.answer_query(query)
        return self._query_logger.log_query_response(response)

    def save_feedback(
        self,
        *,
        session_id: str | None,
        page_context: str,
        raw_query: str,
        feedback_verdict: str,
        feedback_notes: str | None,
        response: dict[str, Any] | None,
        user_agent: str | None,
    ) -> dict[str, Any]:
        return self._query_logger.log_feedback_submission(
            session_id=session_id,
            page_context=page_context,
            raw_query=raw_query,
            feedback_verdict=feedback_verdict,
            feedback_notes=feedback_notes,
            response=response,
            user_agent=user_agent,
        )

    def export_feedback_regressions(
        self,
        *,
        feedback_verdict: str = "bad",
        page_context: str = "simulation",
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        feedback_rows = self._repository.list_feedback(
            feedback_verdict=feedback_verdict,
            page_context=page_context,
            limit=limit,
        )
        return export_feedback_seed_entries(feedback_rows)
