from __future__ import annotations

from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from ..core.db import DatabaseClient
from ..models import FeedbackRecord


class LogRepository:
    """Repository for query and feedback logging tables."""

    def __init__(self, db: DatabaseClient):
        self._db = db

    def insert_query_log(
        self,
        *,
        raw_query: str,
        query_kind: str,
        parsed_origin: str | None,
        parsed_destination: str | None,
        parsed_route_code: str | None,
        matched_place_ids: list[str],
        matched_cluster_ids: list[str],
        chosen_routes: list[str],
        confidence: float,
        response_type: str,
        response_payload: dict[str, Any],
    ) -> None:
        """Insert a routing query log row into public.query_logs."""
        try:
            with self._db.connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        insert into public.query_logs (
                          raw_query,
                          query_kind,
                          parsed_origin,
                          parsed_destination,
                          parsed_route_code,
                          matched_place_ids,
                          matched_cluster_ids,
                          chosen_routes,
                          confidence,
                          response_type,
                          response_payload
                        ) values (
                          %(raw_query)s,
                          %(query_kind)s,
                          %(parsed_origin)s,
                          %(parsed_destination)s,
                          %(parsed_route_code)s,
                          %(matched_place_ids)s,
                          %(matched_cluster_ids)s,
                          %(chosen_routes)s,
                          %(confidence)s,
                          %(response_type)s,
                          %(response_payload)s
                        )
                        """,
                        {
                            "raw_query": raw_query,
                            "query_kind": query_kind,
                            "parsed_origin": parsed_origin,
                            "parsed_destination": parsed_destination,
                            "parsed_route_code": parsed_route_code,
                            "matched_place_ids": Jsonb(matched_place_ids),
                            "matched_cluster_ids": Jsonb(matched_cluster_ids),
                            "chosen_routes": Jsonb(chosen_routes),
                            "confidence": confidence,
                            "response_type": response_type,
                            "response_payload": Jsonb(response_payload),
                        },
                    )
                conn.commit()
        except psycopg.OperationalError:
            self._db.rest().insert_row(
                "query_logs",
                {
                    "raw_query": raw_query,
                    "query_kind": query_kind,
                    "parsed_origin": parsed_origin,
                    "parsed_destination": parsed_destination,
                    "parsed_route_code": parsed_route_code,
                    "matched_place_ids": matched_place_ids,
                    "matched_cluster_ids": matched_cluster_ids,
                    "chosen_routes": chosen_routes,
                    "confidence": confidence,
                    "response_type": response_type,
                    "response_payload": response_payload,
                },
            )

    def insert_route_query_feedback(
        self,
        *,
        session_id: str | None,
        page_context: str,
        raw_query: str,
        feedback_verdict: str,
        feedback_notes: str | None,
        response_mode: str | None,
        response_title: str | None,
        response_confidence: str | None,
        response_payload: dict[str, Any],
        user_agent: str | None,
    ) -> None:
        """Insert a feedback row into public.route_query_feedback."""
        payload = {
            "session_id": session_id,
            "page_context": page_context,
            "raw_query": raw_query,
            "feedback_verdict": feedback_verdict,
            "feedback_notes": feedback_notes,
            "response_mode": response_mode,
            "response_title": response_title,
            "response_confidence": response_confidence,
            "response_payload": response_payload,
            "user_agent": user_agent,
        }
        try:
            with self._db.connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        insert into public.route_query_feedback (
                          session_id,
                          page_context,
                          raw_query,
                          feedback_verdict,
                          feedback_notes,
                          response_mode,
                          response_title,
                          response_confidence,
                          response_payload,
                          user_agent
                        ) values (
                          %(session_id)s,
                          %(page_context)s,
                          %(raw_query)s,
                          %(feedback_verdict)s,
                          %(feedback_notes)s,
                          %(response_mode)s,
                          %(response_title)s,
                          %(response_confidence)s,
                          %(response_payload)s,
                          %(user_agent)s
                        )
                        """,
                        {
                            **payload,
                            "response_payload": Jsonb(response_payload),
                        },
                    )
                conn.commit()
        except psycopg.OperationalError:
            self._db.rest().insert_row("route_query_feedback", payload)

    def list_feedback(
        self,
        *,
        feedback_verdict: str | None = None,
        page_context: str | None = None,
        limit: int = 200,
    ) -> list[FeedbackRecord]:
        """List feedback rows with optional verdict and page filters."""
        filters: list[str] = []
        params: dict[str, Any] = {"limit": max(1, limit)}

        if feedback_verdict:
            filters.append("feedback_verdict = %(feedback_verdict)s")
            params["feedback_verdict"] = feedback_verdict
        if page_context:
            filters.append("page_context = %(page_context)s")
            params["page_context"] = page_context

        where_clause = f"where {' and '.join(filters)}" if filters else ""
        query = f"""
            select
              feedback_id,
              session_id,
              page_context,
              raw_query,
              feedback_verdict,
              feedback_notes,
              response_mode,
              response_title,
              response_confidence,
              response_payload,
              user_agent,
              created_at
            from public.route_query_feedback
            {where_clause}
            order by created_at desc
            limit %(limit)s
        """

        try:
            with self._db.connect() as conn:
                with conn.cursor() as cur:
                    rows = cur.execute(query, params).fetchall()
        except psycopg.OperationalError:
            rows = self._db.rest().select_all("route_query_feedback")
            if feedback_verdict:
                rows = [row for row in rows if row.get("feedback_verdict") == feedback_verdict]
            if page_context:
                rows = [row for row in rows if row.get("page_context") == page_context]
            rows = sorted(rows, key=lambda row: str(row.get("created_at") or ""), reverse=True)[:limit]

        return [
            FeedbackRecord(
                feedback_id=str(row["feedback_id"]),
                session_id=row.get("session_id"),
                page_context=row.get("page_context") or "simulation",
                raw_query=row.get("raw_query") or "",
                feedback_verdict=row.get("feedback_verdict") or "",
                feedback_notes=row.get("feedback_notes"),
                response_mode=row.get("response_mode"),
                response_title=row.get("response_title"),
                response_confidence=row.get("response_confidence"),
                response_payload=row.get("response_payload") or {},
                user_agent=row.get("user_agent"),
                created_at=str(row.get("created_at")) if row.get("created_at") else None,
            )
            for row in rows
        ]
