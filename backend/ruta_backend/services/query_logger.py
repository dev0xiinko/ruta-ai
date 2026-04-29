from __future__ import annotations

from dataclasses import asdict
from typing import Any

from ..models import RouteQueryResponse
from ..repositories import LogRepository


class QueryLogger:
    """Small service wrapper to keep logging concerns out of route handlers."""

    def __init__(self, repository: LogRepository):
        self._repository = repository

    def log_query(self, **payload: Any) -> None:
        self._repository.insert_query_log(**payload)

    def log_feedback(self, **payload: Any) -> None:
        self._repository.insert_route_query_feedback(**payload)

    def log_query_response(self, response: RouteQueryResponse) -> dict[str, Any]:
        payload = asdict(response)

        matched_place_ids: list[str] = []
        matched_cluster_ids: list[str] = []
        if response.origin:
            matched_place_ids.extend(response.origin.place_ids)
            matched_cluster_ids.extend(response.origin.cluster_ids)
        if response.destination:
            matched_place_ids.extend(response.destination.place_ids)
            matched_cluster_ids.extend(response.destination.cluster_ids)

        chosen_routes: list[str] = []
        for item in response.routes:
            if "route_code" in item and item["route_code"]:
                chosen_routes.append(str(item["route_code"]))
            if "first_route" in item and item["first_route"]:
                chosen_routes.append(str(item["first_route"]))
            if "second_route" in item and item["second_route"]:
                chosen_routes.append(str(item["second_route"]))

        self.log_query(
            raw_query=response.query,
            query_kind=response.query_kind,
            parsed_origin=response.origin.display_name if response.origin else None,
            parsed_destination=response.destination.display_name if response.destination else None,
            parsed_route_code=response.route_code,
            matched_place_ids=list(dict.fromkeys(matched_place_ids)),
            matched_cluster_ids=list(dict.fromkeys(matched_cluster_ids)),
            chosen_routes=list(dict.fromkeys(chosen_routes)),
            confidence=response.confidence,
            response_type=response.response_type,
            response_payload=payload,
        )
        return payload

    def log_feedback_submission(
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
        self.log_feedback(
            session_id=session_id,
            page_context=page_context,
            raw_query=raw_query,
            feedback_verdict=feedback_verdict,
            feedback_notes=feedback_notes,
            response_mode=str(response.get("mode")) if isinstance(response, dict) and response.get("mode") else None,
            response_title=str(response.get("title")) if isinstance(response, dict) and response.get("title") else None,
            response_confidence=(
                str(response.get("confidence"))
                if isinstance(response, dict) and response.get("confidence")
                else None
            ),
            response_payload=response or {},
            user_agent=user_agent,
        )
        return {"ok": True}

    def log_structured_chat(
        self,
        *,
        raw_query: str,
        parse_result: dict[str, Any],
        origin: dict[str, Any] | None,
        destination: dict[str, Any] | None,
        route_payload: dict[str, Any],
    ) -> dict[str, Any]:
        route_result = route_payload.get("result", {}) if isinstance(route_payload, dict) else {}
        options = route_result.get("options", []) if isinstance(route_result, dict) else []

        chosen_routes: list[str] = []
        for option in options:
            route_codes = option.get("route_codes", []) if isinstance(option, dict) else []
            chosen_routes.extend(str(code) for code in route_codes if code)

        origin_match = origin.get("top_match") if isinstance(origin, dict) else None
        destination_match = destination.get("top_match") if isinstance(destination, dict) else None

        matched_place_ids = [
            item["id"]
            for item in [origin_match, destination_match]
            if isinstance(item, dict) and item.get("entity_type") == "place" and item.get("id")
        ]
        matched_cluster_ids = [
            item["id"]
            for item in [origin_match, destination_match]
            if isinstance(item, dict) and item.get("entity_type") == "cluster" and item.get("id")
        ]

        self.log_query(
            raw_query=raw_query,
            query_kind=str(parse_result.get("intent") or "route_query"),
            parsed_origin=str(origin_match.get("name")) if isinstance(origin_match, dict) and origin_match.get("name") else None,
            parsed_destination=(
                str(destination_match.get("name"))
                if isinstance(destination_match, dict) and destination_match.get("name")
                else None
            ),
            parsed_route_code=str(parse_result.get("route_code")) if parse_result.get("route_code") else None,
            matched_place_ids=list(dict.fromkeys(matched_place_ids)),
            matched_cluster_ids=list(dict.fromkeys(matched_cluster_ids)),
            chosen_routes=list(dict.fromkeys(chosen_routes)),
            confidence=float(options[0].get("confidence", 0.0)) if options else 0.0,
            response_type=str(route_result.get("mode") or "no_match"),
            response_payload=route_payload,
        )
        return route_payload
