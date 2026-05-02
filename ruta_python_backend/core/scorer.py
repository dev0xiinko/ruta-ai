from __future__ import annotations

from ruta_python_backend.core.dataset import RouteDataset
from ruta_python_backend.core.models import RoutePlan


def score_route_plan(plan: RoutePlan, dataset: RouteDataset) -> int:
    scoring = dataset.route_scoring or {}
    base = scoring.get("base", {})
    penalties = scoring.get("penalties", {})

    ride_steps = [step for step in plan.steps if step.mode == "ride"]
    walk_steps = [step for step in plan.steps if step.mode == "walk"]
    transfer_count = max(len(ride_steps) - 1, 0)

    if plan.type == "walk_only":
        score = int(base.get("walk_only", 110))
    elif plan.type == "direct":
        score = int(base.get("direct", 100))
    elif plan.type in {"walk_ride", "ride_walk"}:
        score = int(base.get(plan.type, 70))
    else:
        if transfer_count <= 1:
            score = int(base.get("one_transfer", 60))
        else:
            score = int(base.get("two_transfers", 40))

    score -= int(penalties.get("extra_ride", 15)) * transfer_count
    score -= int(penalties.get("walk_segment", 5)) * len(walk_steps)
    score -= int(penalties.get("walk_minute", 1)) * sum(step.walk_minutes or 0 for step in walk_steps)

    unknown_directions = sum(1 for step in ride_steps if step.direction_status == "unknown")
    score -= int(penalties.get("direction_unknown", 20)) * unknown_directions

    if plan.confidence == "medium":
        score -= int(penalties.get("confidence_medium", 30))
    elif plan.confidence == "low":
        score -= int(penalties.get("confidence_low", 999))

    return score
