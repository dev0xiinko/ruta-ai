from __future__ import annotations

from typing import Any

from ..models import ParseResult, RouteQueryResponse
from .query_logger import QueryLogger
from .query_parser import QueryParser
from .resolver import Resolver
from .route_engine import RouteEngine


class RouteQueryService:
    """Serve the legacy /api/route-query contract via the modular planner."""

    def __init__(
        self,
        *,
        snapshot_loader,
        query_logger: QueryLogger,
        legacy_service,
        query_parser: QueryParser | None = None,
    ):
        self._snapshot_loader = snapshot_loader
        self._query_logger = query_logger
        self._legacy_service = legacy_service
        self._query_parser = query_parser or QueryParser()

    def answer(self, query: str, *, force_refresh: bool = False) -> dict[str, Any]:
        parse_result = self._query_parser.parse(query)

        if parse_result.intent != "route_query" or not parse_result.origin_text or not parse_result.destination_text:
            return self._legacy_service.answer(query, force_refresh=force_refresh)

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

        computation = None
        if origin_candidates and destination_candidates:
            computation = route_engine.compute_route_options(origin_candidates, destination_candidates)

        if computation is None and (
            len(origin_candidates) != len(all_origin_candidates)
            or len(destination_candidates) != len(all_destination_candidates)
        ):
            computation = route_engine.compute_route_options(all_origin_candidates, all_destination_candidates)

        if computation is None:
            response = RouteQueryResponse(
                query=query,
                query_kind="place_to_place",
                origin=origin_candidates[0] if origin_candidates else None,
                destination=destination_candidates[0] if destination_candidates else None,
                route_code=None,
                response_type="no_match",
                confidence=0.0,
                answer="I could not confirm a dependable route from the current data yet.",
                routes=[],
                metadata={"parsed": self._parse_metadata(query, parse_result)},
            )
            return self._query_logger.log_query_response(response)

        origin_entity, destination_entity, plan = computation
        response = RouteQueryResponse(
            query=query,
            query_kind="place_to_place",
            origin=origin_entity,
            destination=destination_entity,
            route_code=plan.routes[0] if plan.routes else None,
            response_type=plan.response_type,
            confidence=plan.confidence,
            answer=plan.summary,
            routes=plan.details,
            metadata={"parsed": self._parse_metadata(query, parse_result)},
        )
        return self._query_logger.log_query_response(response)

    def _parse_metadata(self, query: str, parse_result: ParseResult) -> dict[str, Any]:
        return {
            "kind": "place_to_place",
            "raw_query": query,
            "origin_text": parse_result.origin_text,
            "destination_text": parse_result.destination_text,
            "route_code": parse_result.route_code,
            "target_text": None,
        }
