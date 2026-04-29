from __future__ import annotations

import hashlib
import re
from typing import Iterable


ROUTE_CODE_RE = re.compile(r"\b(mi-\d{2}[a-z]?|\d{1,2}[a-z]?)\b", re.I)
MULTISPACE_RE = re.compile(r"\s+")
NON_WORD_RE = re.compile(r"[^a-z0-9\s-]")


def normalize_text(value: str | None) -> str:
    lowered = (value or "").lower()
    cleaned = NON_WORD_RE.sub(" ", lowered)
    return MULTISPACE_RE.sub(" ", cleaned).strip()


def dedupe_keep_order(values: Iterable[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()

    for value in values:
        normalized = normalize_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(value.strip())

    return output


def parse_json_path_key(payload: dict[str, object], *keys: str) -> object | None:
    current: object = payload
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def stable_text_id(prefix: str, *values: object) -> str:
    joined = "::".join(str(value) for value in values)
    digest = hashlib.md5(joined.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def safe_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return []


def extract_route_code(text: str) -> str | None:
    match = ROUTE_CODE_RE.search(normalize_text(text))
    return match.group(1).upper() if match else None
