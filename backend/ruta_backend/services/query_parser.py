from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import httpx

from ..models import ParseResult
from ..utils import extract_route_code, normalize_text

ROUTE_CHECK_RE = re.compile(
    r"\b(?:does|do|muagi|moagi|agi|does\s+\w+\s+pass|does\s+\w+\s+go)\b",
    re.IGNORECASE,
)
PLACE_TO_PLACE_SEPARATORS = (" to ", " ngadto sa ", " padulong sa ", " -> ")
ROUTE_LOOKUP_FILLER_WORDS = {
    "route",
    "routes",
    "code",
    "codes",
    "jeep",
    "jeepney",
    "details",
    "detail",
    "info",
    "information",
    "show",
    "me",
    "about",
    "for",
    "please",
    "pls",
}
CEBUANO_HINTS = ("unsa", "unsay", "padung", "adto", "sakyan", "gikan", "muagi", "moagi", "ngadto")


@dataclass(slots=True)
class OllamaProvider:
    """Thin Ollama client for strict JSON query parsing."""

    base_url: str = "http://127.0.0.1:11434"
    model: str = "qwen2.5:7b"
    timeout_seconds: float = 15.0

    def parse(self, raw_query: str) -> dict[str, Any] | None:
        prompt = self._build_prompt(raw_query)
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url.rstrip('/')}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError:
            return None

        payload = response.json()
        response_text = payload.get("response")
        if not isinstance(response_text, str) or not response_text.strip():
            return None

        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None

    def _build_prompt(self, raw_query: str) -> str:
        return (
            "You are a parser for a Cebu public transport app.\n"
            "Return JSON only.\n"
            "Do not invent routes.\n"
            "Do not answer the commute question.\n"
            "Only extract structured fields.\n"
            "Use this schema exactly:\n"
            '{"intent":"route_query","origin_text":null,"destination_text":null,"route_code":null,"language":"mixed"}\n'
            f"Query: {raw_query}"
        )


class QueryParser:
    """Query parser with optional Ollama-first parsing and deterministic fallback."""

    def __init__(self, provider: OllamaProvider | None = None):
        self._provider = provider

    def parse(self, raw_query: str) -> ParseResult:
        cleaned_query = raw_query.strip()
        if not cleaned_query:
            return ParseResult(intent="route_query", language="mixed", confidence="low")

        llm_result = self._parse_with_provider(cleaned_query)
        if llm_result is not None:
            return llm_result

        return self._parse_heuristically(cleaned_query)

    def _parse_with_provider(self, raw_query: str) -> ParseResult | None:
        if self._provider is None:
            return None

        payload = self._provider.parse(raw_query)
        if payload is None:
            return None

        try:
            return ParseResult.model_validate(
                {
                    "intent": payload.get("intent") or "route_query",
                    "origin_text": payload.get("origin_text"),
                    "destination_text": payload.get("destination_text"),
                    "route_code": payload.get("route_code"),
                    "language": payload.get("language") or self._detect_language(raw_query),
                    "confidence": "high",
                }
            )
        except Exception:
            return None

    def _parse_heuristically(self, raw_query: str) -> ParseResult:
        normalized = normalize_text(raw_query)
        route_code = extract_route_code(raw_query)
        language = self._detect_language(raw_query)

        if route_code and self._looks_like_route_lookup(normalized, route_code):
            return ParseResult(
                intent="route_lookup",
                route_code=route_code,
                language=language,
                confidence="high",
            )

        if route_code and ROUTE_CHECK_RE.search(normalized):
            return ParseResult(
                intent="route_check",
                destination_text=self._extract_route_check_target(raw_query, route_code),
                route_code=route_code,
                language=language,
                confidence="medium",
            )

        split_result = self._split_place_to_place(raw_query)
        if split_result is not None:
            origin_text, destination_text = split_result
            return ParseResult(
                intent="route_query",
                origin_text=origin_text,
                destination_text=destination_text,
                route_code=route_code,
                language=language,
                confidence="medium",
            )

        return ParseResult(
            intent="route_query",
            origin_text=None,
            destination_text=raw_query.strip(),
            route_code=route_code,
            language=language,
            confidence="low",
        )

    def _detect_language(self, raw_query: str) -> str:
        normalized = normalize_text(raw_query)
        if any(marker in normalized for marker in CEBUANO_HINTS):
            return "ceb"
        return "mixed" if any(word in normalized for word in ("to", "from", "does")) else "en"

    def _looks_like_route_lookup(self, normalized_query: str, route_code: str) -> bool:
        route_code_normalized = normalize_text(route_code)
        if normalized_query == route_code_normalized:
            return True

        remaining = re.sub(rf"\b{re.escape(route_code_normalized)}\b", " ", normalized_query)
        tokens = [token for token in remaining.split() if token]
        return bool(tokens) and all(token in ROUTE_LOOKUP_FILLER_WORDS for token in tokens)

    def _split_place_to_place(self, raw_query: str) -> tuple[str, str] | None:
        normalized = normalize_text(raw_query)

        if normalized.startswith("from ") and " to " in normalized:
            lowered = raw_query.lower()
            from_index = lowered.find("from ")
            to_index = lowered.find(" to ", from_index + 5)
            if from_index == 0 and to_index > 4:
                return raw_query[5:to_index].strip(), raw_query[to_index + 4 :].strip()

        lowered = raw_query.lower()
        for separator in PLACE_TO_PLACE_SEPARATORS:
            index = lowered.find(separator.strip() if separator == " -> " else separator)
            if separator == " -> ":
                index = raw_query.find("->")
                if index >= 0:
                    return raw_query[:index].strip(), raw_query[index + 2 :].strip()
                continue
            if index >= 0:
                return raw_query[:index].strip(), raw_query[index + len(separator) :].strip()

        return None

    def _extract_route_check_target(self, raw_query: str, route_code: str) -> str:
        target_text = raw_query
        removal_patterns = [
            rf"^\s*does\s+{re.escape(route_code)}\s+(?:pass|go|run)\s+",
            rf"^\s*{re.escape(route_code)}\s+",
            r"^\s*(?:muagi ba ni sa|muagi sa|agi sa|moagi sa)\s+",
        ]
        for pattern in removal_patterns:
            target_text = re.sub(pattern, "", target_text, flags=re.IGNORECASE)
        target_text = re.sub(re.escape(route_code), "", target_text, flags=re.IGNORECASE).strip(" ?.-")
        return target_text
