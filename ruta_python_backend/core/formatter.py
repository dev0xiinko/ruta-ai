from __future__ import annotations

from ruta_python_backend.core.dataset import RouteDataset
from ruta_python_backend.core.models import RoutePlan, RouteStep


def _join_codes(codes: list[str]) -> str:
    if not codes:
        return ""
    if len(codes) == 1:
        return codes[0]
    if len(codes) == 2:
        return f"{codes[0]} or {codes[1]}"
    return f"{', '.join(codes[:-1])}, or {codes[-1]}"


def _ride_codes(step: RouteStep) -> list[str]:
    return step.routes or ([step.route_code] if step.route_code else [])


def format_route_plan(plan: RoutePlan, dataset: RouteDataset, language: str = "ceb-en") -> str:
    if plan.type == "no_verified_route":
        return "Wala pa koy verified route ani sa current dataset. Please confirm the nearest landmark or pickup point."

    origin_name = dataset.place_name(plan.origin_place_id)
    destination_name = dataset.place_name(plan.destination_place_id)

    if plan.type == "walk_only":
        walk_step = plan.steps[0] if plan.steps else None
        if walk_step and walk_step.walk_minutes:
            return (
                f"Duol ra kaayo. From {origin_name}, pwede ra ka maglakaw padung "
                f"{destination_name} in about {walk_step.walk_minutes} minutes."
            )
        return f"Duol ra kaayo. From {origin_name}, pwede ra ka maglakaw padung {destination_name}."

    parts: list[str] = []
    for step in plan.steps:
        from_name = dataset.place_name(step.from_place_id)
        to_name = dataset.place_name(step.to_place_id)
        if step.mode == "walk":
            minutes = f" for about {step.walk_minutes} minutes" if step.walk_minutes else ""
            parts.append(f"Lakaw gikan {from_name} padung {to_name}{minutes}.")
            continue

        codes = _ride_codes(step)
        code_text = _join_codes(codes)
        parts.append(f"Sakay og {code_text} gikan {from_name}. Naog sa {to_name}.")

    if any(step.direction_status == "unknown" for step in plan.steps if step.mode == "ride"):
        parts.append("Confirm the jeep signboard or headsign before riding.")

    return " ".join(parts)
