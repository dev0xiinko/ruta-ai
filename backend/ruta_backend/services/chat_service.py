from __future__ import annotations

from typing import Any

from ..models import ChatData, ChatResponse
from .formatter import Formatter
from .query_logger import QueryLogger
from .query_parser import QueryParser
from .response_builder import ResponseBuilder
from .resolver import Resolver
from .route_engine import RouteEngine


class ChatService:
    """Compose modular services for /api/chat while preserving legacy fallback paths."""

    def __init__(
        self,
        *,
        snapshot_loader,
        query_logger: QueryLogger,
        legacy_service,
        query_parser: QueryParser | None = None,
        formatter: Formatter | None = None,
        response_builder: ResponseBuilder | None = None,
    ):
        self._snapshot_loader = snapshot_loader
        self._query_logger = query_logger
        self._legacy_service = legacy_service
        self._query_parser = query_parser or QueryParser()
        self._formatter = formatter or Formatter()
        self._response_builder = response_builder or ResponseBuilder()

    def answer(self, message: str, *, force_refresh: bool = False) -> dict[str, Any]:
        parse_result = self._query_parser.parse(message)

        # Keep non-route-query intents on the legacy path until those response modes are modularized.
        if parse_result.intent != "route_query" or not parse_result.origin_text or not parse_result.destination_text:
            return self._legacy_service.answer(message, force_refresh=force_refresh)

        snapshot = self._snapshot_loader(force_refresh=force_refresh)
        resolver = Resolver(snapshot)
        route_engine = RouteEngine(snapshot)

        origin_result, destination_result = resolver.resolve_origin_destination(
            parse_result.origin_text,
            parse_result.destination_text,
        )
        origin_candidates = [entity for entity, _reason in resolver.resolve_routing_candidates(parse_result.origin_text)]
        destination_candidates = [entity for entity, _reason in resolver.resolve_routing_candidates(parse_result.destination_text)]
        all_origin_candidates = [entity for entity, _reason in resolver.resolve_candidates(parse_result.origin_text)]
        all_destination_candidates = [entity for entity, _reason in resolver.resolve_candidates(parse_result.destination_text)]

        if not origin_candidates or not destination_candidates:
            route_response = self._response_builder.build_no_match_response(
                origin=origin_result,
                destination=destination_result,
                reason="Could not confidently resolve the origin or destination from the active place graph.",
            )
        else:
            computation = route_engine.compute_route_options(origin_candidates, destination_candidates)
            if computation is None and (
                len(origin_candidates) != len(all_origin_candidates)
                or len(destination_candidates) != len(all_destination_candidates)
            ):
                computation = route_engine.compute_route_options(all_origin_candidates, all_destination_candidates)
            route_response = self._response_builder.build_route_response(
                origin=origin_result,
                destination=destination_result,
                plan=computation[2] if computation else None,
            )

        route_response.result.message = self._formatter.format_route_result(
            route_response.result,
            language=parse_result.language,
        )
        payload = ChatResponse(
            data=ChatData(
                parse=parse_result,
                route=route_response,
            )
        ).model_dump(mode="json")

        self._query_logger.log_structured_chat(
            raw_query=message,
            parse_result=parse_result.model_dump(mode="json"),
            origin=origin_result.model_dump(mode="json"),
            destination=destination_result.model_dump(mode="json"),
            route_payload=route_response.model_dump(mode="json"),
        )

        return payload
