from __future__ import annotations

import re

from ruta_python_backend.core.models import ExtractedQuery

PLACE_PATTERNS = [
    re.compile(r"^\s*from\s+(?P<origin>.+?)\s+to\s+(?P<destination>.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(?P<origin>.+?)\s+to\s+(?P<destination>.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(?P<origin>.+?)\s*->\s*(?P<destination>.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*gikan\s+(?P<origin>.+?)\s+padung\s+(?P<destination>.+?)\s*$", re.IGNORECASE),
]

CEB_TOKENS = {"sakay", "lakaw", "gikan", "padung", "naog", "duol", "unsa", "og"}


class QueryExtractor:
    def extract(self, query: str, language_hint: str = "auto") -> ExtractedQuery:
        cleaned = " ".join(query.split())
        if not cleaned:
            raise ValueError("Query is required.")

        language = self._detect_language(cleaned) if language_hint == "auto" else language_hint
        for pattern in PLACE_PATTERNS:
            match = pattern.match(cleaned)
            if match:
                return ExtractedQuery(
                    origin_text=match.group("origin").strip(),
                    destination_text=match.group("destination").strip(),
                    query_language=language,
                    needs_route_answer=True,
                )

        return ExtractedQuery(
            origin_text=None,
            destination_text=None,
            query_language=language,
            needs_route_answer=False,
        )

    def _detect_language(self, query: str) -> str:
        normalized = re.sub(r"[^a-z0-9\s-]", " ", query.lower())
        tokens = set(normalized.split())
        return "ceb-en" if tokens & CEB_TOKENS else "en"
