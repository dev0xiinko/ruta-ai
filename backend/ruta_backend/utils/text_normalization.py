from __future__ import annotations

import re

MULTISPACE_RE = re.compile(r"\s+")
PUNCTUATION_RE = re.compile(r"[^a-z0-9\s-]")


def maybe_strip_punctuation(text: str) -> str:
    """Remove punctuation while preserving spaces and hyphens."""
    return PUNCTUATION_RE.sub(" ", text)


def normalize_text(text: str | None) -> str:
    """Lowercase and normalize user-facing text for deterministic matching."""
    lowered = (text or "").lower().strip()
    cleaned = maybe_strip_punctuation(lowered)
    return MULTISPACE_RE.sub(" ", cleaned).strip()


def tokenize_text(text: str) -> list[str]:
    """Tokenize normalized text into non-empty whitespace-separated tokens."""
    normalized = normalize_text(text)
    return [token for token in normalized.split(" ") if token]
