from __future__ import annotations

from ruta_backend.models import AccessMatch, RoutePlan
from ruta_backend.services.ranker import Ranker


def test_ranker_prefers_exact_place_match() -> None:
    ranker = Ranker()

    assert ranker.score_candidate_key("it park", "it park") > ranker.score_candidate_key("rob galleria", "galleria")


def test_ranker_prefers_direct_over_nearby() -> None:
    ranker = Ranker()
    direct_origin = AccessMatch("r1", "17B", "direct_access", 0.93, ["p1"], [])
    direct_destination = AccessMatch("r1", "17B", "direct_access", 0.91, ["p2"], [])
    nearby_origin = AccessMatch("r2", "10H", "nearby_access", 0.75, ["p1"], [], walk_minutes=6, distance_m=420)
    nearby_destination = AccessMatch("r2", "10H", "nearby_access", 0.74, ["p2"], [], walk_minutes=5, distance_m=350)

    direct_score, direct_type = ranker.score_direct_option(direct_origin, direct_destination)
    nearby_score, nearby_type = ranker.score_direct_option(nearby_origin, nearby_destination)

    assert direct_type == "direct_access"
    assert nearby_type == "nearby_access"
    assert direct_score > nearby_score


def test_ranker_route_plan_bonus_prefers_direct_modes() -> None:
    ranker = Ranker()

    direct_plan = RoutePlan("direct_access", 0.8, ["17B"], "direct", [])
    transfer_plan = RoutePlan("transfer_required", 0.8, ["10H", "MI-02B"], "transfer", [])

    assert ranker.route_plan_bonus(direct_plan) > ranker.route_plan_bonus(transfer_plan)
