from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_env_file(path: Path) -> None:
    """Populate environment variables from a dotenv-style file if present."""
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip('"').strip("'")


@dataclass(slots=True)
class Settings:
    database_url: str
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    snapshot_ttl_seconds: int = 60

    @classmethod
    def from_env(cls) -> "Settings":
        load_env_file(Path(".env.local"))
        database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        return cls(
            database_url=database_url or "",
            supabase_url=os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
            snapshot_ttl_seconds=int(os.getenv("RUTA_SNAPSHOT_TTL_SECONDS", "60")),
        )
