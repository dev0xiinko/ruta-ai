from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

from ..models import RouteComputationResult, RouteOption


@dataclass(slots=True)
class OllamaFormatterProvider:
    """Optional Ollama-backed phrasing helper for structured route results."""

    base_url: str = "http://127.0.0.1:11434"
    model: str = "qwen2.5:7b"
    timeout_seconds: float = 15.0

    def format(self, result: RouteComputationResult, language: str = "mixed") -> str | None:
        prompt = self._build_prompt(result, language)
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url.rstrip('/')}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError:
            return None

        payload = response.json()
        response_text = payload.get("response")
        if not isinstance(response_text, str):
            return None

        formatted = response_text.strip()
        return formatted or None

    def _build_prompt(self, result: RouteComputationResult, language: str) -> str:
        structured = json.dumps(result.model_dump(mode="json"), ensure_ascii=True)
        return (
            "You are formatting route results for commuters.\n"
            "Only rephrase. Do not alter route facts, codes, stops, or confidence.\n"
            "Use the requested language style exactly when possible: "
            f"{language}.\n"
            "Keep the answer concise and commuter-friendly.\n"
            f"Structured result: {structured}"
        )


class Formatter:
    """Optional LLM phrasing with deterministic fallback strings."""

    def __init__(self, provider: OllamaFormatterProvider | None = None):
        self._provider = provider

    def format_route_result(self, result: RouteComputationResult, language: str = "mixed") -> str:
        if self._provider is not None:
            formatted = self._provider.format(result, language=language)
            if formatted:
                return formatted
        return self._fallback_format(result, language)

    def _fallback_format(self, result: RouteComputationResult, language: str) -> str:
        if result.mode == "no_match":
            return self._no_match_text(result.message or "No deterministic route found.", language)

        top_option = result.options[0] if result.options else None
        if top_option is None:
            return self._no_match_text("No route options available.", language)

        origin_name = result.origin.top_match.name if result.origin and result.origin.top_match else "your origin"
        destination_name = result.destination.top_match.name if result.destination and result.destination.top_match else "your destination"

        if result.mode == "direct":
            return self._direct_text(origin_name, destination_name, top_option, language)
        if result.mode == "transfer":
            return self._transfer_text(origin_name, destination_name, top_option, language, fallback=False)
        if result.mode == "fallback":
            return self._transfer_text(origin_name, destination_name, top_option, language, fallback=True)
        return self._no_match_text(result.message or "No deterministic route found.", language)

    def _direct_text(self, origin_name: str, destination_name: str, option: RouteOption, language: str) -> str:
        route_code = option.route_codes[0] if option.route_codes else "the suggested route"
        if language == "ceb":
            return f"Gikan sa {origin_name} padulong {destination_name}, sakay og {route_code}. Usa ni ka diretso nga opsyon."
        if language == "en":
            return f"From {origin_name} to {destination_name}, ride {route_code}. This is the strongest direct option."
        return f"From {origin_name} to {destination_name}, sakay ug {route_code}. This is the strongest direct option."

    def _transfer_text(
        self,
        origin_name: str,
        destination_name: str,
        option: RouteOption,
        language: str,
        *,
        fallback: bool,
    ) -> str:
        first_route = option.route_codes[0] if option.route_codes else "the first route"
        second_route = option.route_codes[1] if len(option.route_codes) > 1 else "the connecting route"
        if language == "ceb":
            intro = "Practical fallback ni" if fallback else "Kinahanglan ni og transfer"
            return f"{intro} gikan sa {origin_name} padulong {destination_name}: sakay una og {first_route}, dayon balhin sa {second_route}."
        if language == "en":
            intro = "Best fallback option" if fallback else "This trip needs one transfer"
            return f"{intro} from {origin_name} to {destination_name}: ride {first_route} first, then transfer to {second_route}."
        intro = "Best fallback option" if fallback else "This trip needs one transfer"
        return f"{intro} gikan sa {origin_name} padulong {destination_name}: sakay una og {first_route}, then transfer to {second_route}."

    def _no_match_text(self, message: str, language: str) -> str:
        if language == "ceb":
            return f"Wala koy mahatag nga deterministic route karon. {message}"
        if language == "en":
            return f"I could not produce a deterministic route right now. {message}"
        return f"Wala koy deterministic route karon. {message}"
