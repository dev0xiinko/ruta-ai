from __future__ import annotations

from ruta_backend.services.formatter import Formatter
from ruta_backend.services.response_builder import ResponseBuilder
from ruta_backend.services.resolver import Resolver
from ruta_backend.services.route_engine import RouteEngine

from test_engine import build_snapshot


def test_formatter_fallback_direct_en() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)
    response_builder = ResponseBuilder()
    formatter = Formatter()

    origin = resolver.resolve_text("IT Park")
    destination = resolver.resolve_text("Carbon")
    origin_candidates = [entity for entity, _reason in resolver.resolve_candidates("IT Park")]
    destination_candidates = [entity for entity, _reason in resolver.resolve_candidates("Carbon")]
    result = route_engine.compute_route_options(origin_candidates, destination_candidates)

    assert result is not None
    _origin_entity, _destination_entity, plan = result
    response = response_builder.build_route_response(origin=origin, destination=destination, plan=plan)

    message = formatter.format_route_result(response.result, language="en")

    assert "ride 17B" in message
    assert "Carbon" in message


def test_formatter_fallback_transfer_ceb() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)
    response_builder = ResponseBuilder()
    formatter = Formatter()

    origin = resolver.resolve_text("Bulacao")
    destination = resolver.resolve_text("Mactan Airport")
    origin_candidates = [entity for entity, _reason in resolver.resolve_candidates("Bulacao")]
    destination_candidates = [entity for entity, _reason in resolver.resolve_candidates("Mactan Airport")]
    result = route_engine.compute_route_options(origin_candidates, destination_candidates)

    assert result is not None
    _origin_entity, _destination_entity, plan = result
    response = response_builder.build_route_response(origin=origin, destination=destination, plan=plan)

    message = formatter.format_route_result(response.result, language="ceb")

    assert "sakay una" in message
    assert "10H" in message
    assert "MI-02B" in message


def test_formatter_fallback_no_match_mixed() -> None:
    formatter = Formatter()
    response_builder = ResponseBuilder()
    resolver = Resolver(build_snapshot())

    origin = resolver.resolve_text("Unknown Origin")
    destination = resolver.resolve_text("Unknown Destination")
    response = response_builder.build_no_match_response(
        origin=origin,
        destination=destination,
        reason="Could not confidently resolve the origin or destination from the active place graph.",
    )

    message = formatter.format_route_result(response.result, language="mixed")

    assert "deterministic route" in message.lower()
