from __future__ import annotations

from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row

from .config import Settings


class SupabaseRestClient:
    """Small REST fallback for environments without direct Postgres access."""

    def __init__(self, settings: Settings):
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for REST fallback.")

        self._base_url = settings.supabase_url.rstrip("/")
        self._api_key = settings.supabase_service_role_key
        self._headers = {
            "apikey": self._api_key,
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def select_all(self, table: str) -> list[dict[str, Any]]:
        import httpx

        with httpx.Client(timeout=60.0) as client:
            response = client.get(
                f"{self._base_url}/rest/v1/{table}",
                headers=self._headers,
                params={"select": "*"},
            )
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, list) else []

    def insert_row(self, table: str, row: dict[str, Any]) -> None:
        import httpx

        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{self._base_url}/rest/v1/{table}",
                headers={**self._headers, "Prefer": "return=minimal"},
                json=row,
            )
            response.raise_for_status()

    def upsert_rows(
        self,
        table: str,
        rows: Iterable[dict[str, Any]],
        *,
        on_conflict: str,
        chunk_size: int = 500,
    ) -> None:
        buffered: list[dict[str, Any]] = []
        for row in rows:
            buffered.append(row)
            if len(buffered) >= chunk_size:
                self._upsert_chunk(table, buffered, on_conflict)
                buffered = []

        if buffered:
            self._upsert_chunk(table, buffered, on_conflict)

    def _upsert_chunk(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
        import httpx

        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                f"{self._base_url}/rest/v1/{table}",
                headers={**self._headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": on_conflict},
                json=rows,
            )
            response.raise_for_status()


class DatabaseClient:
    """Shared DB helper that keeps direct SQL and REST fallback access aligned."""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._rest_client: SupabaseRestClient | None = None

    @property
    def settings(self) -> Settings:
        return self._settings

    def connect(self) -> psycopg.Connection[Any]:
        return psycopg.connect(self._settings.database_url, row_factory=dict_row)

    def rest(self) -> SupabaseRestClient:
        if self._rest_client is None:
            self._rest_client = SupabaseRestClient(self._settings)
        return self._rest_client
