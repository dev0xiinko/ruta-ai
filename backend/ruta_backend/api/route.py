from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import RouteQueryRequest, RouteRequest, RouteResponse
from ..services import Formatter, Resolver, ResponseBuilder, RouteEngine
from .deps import get_route_query_service, get_route_repository

router = APIRouter()


@router.post("/api/route-query")
def route_query(body: RouteQueryRequest) -> dict:
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        return get_route_query_service().answer(query, force_refresh=body.force_refresh)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@router.post("/api/route", response_model=RouteResponse)
def route_by_places(body: RouteRequest) -> RouteResponse:
    origin_text = body.origin_text.strip()
    destination_text = body.destination_text.strip()
    if not origin_text or not destination_text:
        raise HTTPException(status_code=400, detail="Origin and destination are required.")

    try:
        snapshot = get_route_repository().get_snapshot(force_refresh=body.force_refresh)
        resolver = Resolver(snapshot)
        route_engine = RouteEngine(snapshot)
        response_builder = ResponseBuilder()
        formatter = Formatter()

        origin_result, destination_result = resolver.resolve_origin_destination(origin_text, destination_text)
        origin_candidates = [entity for entity, _reason in resolver.resolve_routing_candidates(origin_text)]
        destination_candidates = [entity for entity, _reason in resolver.resolve_routing_candidates(destination_text)]
        all_origin_candidates = [entity for entity, _reason in resolver.resolve_candidates(origin_text)]
        all_destination_candidates = [entity for entity, _reason in resolver.resolve_candidates(destination_text)]

        if not origin_candidates or not destination_candidates:
            response = response_builder.build_no_match_response(
                origin=origin_result,
                destination=destination_result,
                reason="Could not confidently resolve the origin or destination from the active place graph.",
            )
            response.result.message = formatter.format_route_result(response.result, language=body.language)
            return response

        computation = route_engine.compute_route_options(origin_candidates, destination_candidates)
        if computation is None and (
            len(origin_candidates) != len(all_origin_candidates)
            or len(destination_candidates) != len(all_destination_candidates)
        ):
            computation = route_engine.compute_route_options(all_origin_candidates, all_destination_candidates)
        if computation is None:
            response = response_builder.build_route_response(
                origin=origin_result,
                destination=destination_result,
                plan=None,
            )
            response.result.message = formatter.format_route_result(response.result, language=body.language)
            return response

        _origin_entity, _destination_entity, plan = computation
        response = response_builder.build_route_response(
            origin=origin_result,
            destination=destination_result,
            plan=plan,
        )
        response.result.message = formatter.format_route_result(response.result, language=body.language)
        return response
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
