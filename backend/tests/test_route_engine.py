from __future__ import annotations

from ruta_backend.services.resolver import Resolver
from ruta_backend.services.route_engine import RouteEngine

from test_engine import build_snapshot


def test_route_engine_direct_route() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)

    origin = resolver.resolve_entity("IT Park")
    destination = resolver.resolve_entity("Carbon")

    assert origin is not None
    assert destination is not None

    plan = route_engine.find_direct_routes(origin, destination)

    assert plan is not None
    assert plan.response_type == "direct_access"
    assert plan.details[0]["route_code"] == "17B"


def test_route_engine_transfer_route() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)

    origin = resolver.resolve_entity("Bulacao")
    destination = resolver.resolve_entity("Mactan Airport")

    assert origin is not None
    assert destination is not None

    plan = route_engine.find_transfer_routes(origin, destination)

    assert plan is not None
    assert plan.response_type == "transfer_required"
    assert plan.details[0]["first_route"] == "10H"
    assert plan.details[0]["second_route"] == "MI-02B"


def test_route_engine_best_effort_fallback() -> None:
    snapshot = build_snapshot()
    resolver = Resolver(snapshot)
    route_engine = RouteEngine(snapshot)

    origin_candidates = [entity for entity, _reason in resolver.resolve_candidates("IT Park")]
    destination_candidates = [entity for entity, _reason in resolver.resolve_candidates("Mactan Airport")]

    result = route_engine.compute_route_options(origin_candidates, destination_candidates)

    assert result is not None
    _origin, _destination, plan = result
    assert plan.response_type == "transfer_required"
    assert plan.details[0]["first_route"] == "17B"
    assert plan.details[0]["second_route"] == "MI-02B"
    assert plan.details[0]["fallback"] is True
