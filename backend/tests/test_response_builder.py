from __future__ import annotations

from ruta_backend.services.response_builder import ResponseBuilder
from ruta_backend.services.resolver import Resolver
from ruta_backend.services.route_engine import RouteEngine

from test_engine import build_snapshot


def test_response_builder_direct_mode() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)
    response_builder = ResponseBuilder()

    origin = resolver.resolve_text("IT Park")
    destination = resolver.resolve_text("Carbon")
    origin_candidates = [entity for entity, _reason in resolver.resolve_candidates("IT Park")]
    destination_candidates = [entity for entity, _reason in resolver.resolve_candidates("Carbon")]
    result = route_engine.compute_route_options(origin_candidates, destination_candidates)

    assert result is not None
    _origin_entity, _destination_entity, plan = result
    response = response_builder.build_route_response(origin=origin, destination=destination, plan=plan)

    assert response.result.mode == "direct"
    assert response.result.options[0].route_codes == ["17B"]


def test_response_builder_fallback_mode() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)
    response_builder = ResponseBuilder()

    origin = resolver.resolve_text("IT Park")
    destination = resolver.resolve_text("Mactan Airport")
    origin_candidates = [entity for entity, _reason in resolver.resolve_candidates("IT Park")]
    destination_candidates = [entity for entity, _reason in resolver.resolve_candidates("Mactan Airport")]
    result = route_engine.compute_route_options(origin_candidates, destination_candidates)

    assert result is not None
    _origin_entity, _destination_entity, plan = result
    response = response_builder.build_route_response(origin=origin, destination=destination, plan=plan)

    assert response.result.mode == "fallback"
    assert response.result.options[0].route_codes == ["17B", "MI-02B"]


def test_response_builder_no_match_response() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    response_builder = ResponseBuilder()

    origin = resolver.resolve_text("Unknown Origin")
    destination = resolver.resolve_text("Unknown Destination")
    response = response_builder.build_no_match_response(
        origin=origin,
        destination=destination,
        reason="Could not confidently resolve the origin or destination from the active place graph.",
    )

    assert response.result.status == "no_match"
    assert response.result.mode == "no_match"
    assert response.result.options == []
