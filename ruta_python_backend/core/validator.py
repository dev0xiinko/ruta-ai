from __future__ import annotations

from ruta_python_backend.core.dataset import RouteDataset
from ruta_python_backend.core.models import RoutePlan, RouteStep, ValidationResult


class RoutePlanValidator:
    def __init__(self, dataset: RouteDataset) -> None:
        self.dataset = dataset

    def validate(self, plan: RoutePlan) -> ValidationResult:
        rules_checked: list[str] = []
        issues: list[str] = []
        warnings: list[str] = []

        if plan.type == "no_verified_route":
            return ValidationResult(
                passed=False,
                rules_checked=["route_exists"],
                issues=["No verified route was produced."],
                warnings=[],
            )

        ride_steps = [step for step in plan.steps if step.mode == "ride"]
        walk_steps = [step for step in plan.steps if step.mode == "walk"]

        issues.extend(self._validate_step_numbering(plan.steps))
        issues.extend(self._validate_route_type_shape(plan.type, plan.steps, ride_steps, walk_steps))
        issues.extend(self._validate_plan_path(plan))
        rules_checked.extend(
            [
                "step_numbering",
                "plan_shape",
                "path_continuity",
            ]
        )

        if len(ride_steps) > self.dataset.get_max_rides():
            issues.append("Plan exceeds the maximum number of ride segments.")
        if len(walk_steps) > self.dataset.get_max_walk_segments():
            issues.append("Plan exceeds the maximum number of walk segments.")
        rules_checked.extend(["max_rides", "max_walk_segments"])

        for step in plan.steps:
            if step.from_place_id and step.from_place_id not in self.dataset.places:
                issues.append(f"Unknown place_id: {step.from_place_id}")
            if step.to_place_id and step.to_place_id not in self.dataset.places:
                issues.append(f"Unknown place_id: {step.to_place_id}")
        rules_checked.append("places_exist")

        previous_ride_codes: list[str] | None = None
        for step in plan.steps:
            if step.mode == "walk":
                issues.extend(self._validate_walk_step(step))
                if step.from_place_id and step.to_place_id and step.distance_m is None:
                    step.distance_m = self.dataset.distance_between_places(step.from_place_id, step.to_place_id)
                if step.from_place_id and step.to_place_id and step.walk_minutes is None:
                    step.walk_minutes = self.dataset.estimate_walk_minutes(step.from_place_id, step.to_place_id)
                continue

            route_codes = step.routes or ([step.route_code] if step.route_code else [])
            if not route_codes:
                issues.append("Ride step is missing a route code.")
                continue

            for route_code in route_codes:
                issues.extend(self._validate_ride_step(step, route_code, warnings))

            if previous_ride_codes:
                transfer_place_id = step.from_place_id or ""
                if not any(
                    self.dataset.allowed_transfer(previous_code, route_code, transfer_place_id)
                    for previous_code in previous_ride_codes
                    for route_code in route_codes
                ):
                    issues.append(
                        f"Transfer to {', '.join(route_codes)} at {transfer_place_id} is not verified."
                    )
            previous_ride_codes = route_codes

        rules_checked.extend(
            [
                "route_exists",
                "direct_access_exists",
                "transfer_exists",
                "walk_exists",
                "direction_valid",
            ]
        )
        return ValidationResult(
            passed=not issues,
            rules_checked=rules_checked,
            issues=issues,
            warnings=warnings,
        )

    def _validate_step_numbering(self, steps: list[RouteStep]) -> list[str]:
        issues: list[str] = []
        for index, step in enumerate(steps, start=1):
            if step.step_no != index:
                issues.append("Step numbering must be sequential starting at 1.")
                break
        return issues

    def _validate_route_type_shape(
        self,
        plan_type: str,
        steps: list[RouteStep],
        ride_steps: list[RouteStep],
        walk_steps: list[RouteStep],
    ) -> list[str]:
        issues: list[str] = []
        total_steps = len(ride_steps) + len(walk_steps)
        modes = [step.mode for step in steps]

        if plan_type == "walk_only" and not (len(walk_steps) == 1 and len(ride_steps) == 0 and total_steps == 1):
            issues.append("walk_only plans must contain exactly one walk step.")
        if plan_type == "direct" and not (len(ride_steps) == 1 and len(walk_steps) == 0 and total_steps == 1):
            issues.append("direct plans must contain exactly one ride step.")
        if plan_type == "walk_ride" and not (
            len(walk_steps) == 1 and len(ride_steps) == 1 and total_steps == 2 and modes == ["walk", "ride"]
        ):
            issues.append("walk_ride plans must contain exactly one walk step followed by one ride step.")
        if plan_type == "ride_walk" and not (
            len(walk_steps) == 1 and len(ride_steps) == 1 and total_steps == 2 and modes == ["ride", "walk"]
        ):
            issues.append("ride_walk plans must contain exactly one ride step followed by one walk step.")
        if plan_type == "multi_hop":
            if not (len(ride_steps) >= 2 or (len(ride_steps) == 1 and len(walk_steps) >= 2)):
                issues.append("multi_hop plans must involve multiple movement segments beyond a simple one-ride trip.")
        return issues

    def _validate_plan_path(self, plan: RoutePlan) -> list[str]:
        issues: list[str] = []
        if not plan.steps:
            return ["Plan has no steps."]

        first_from = plan.steps[0].from_place_id
        last_to = plan.steps[-1].to_place_id
        if first_from != plan.origin_place_id:
            issues.append("The first step does not start at the confirmed origin.")
        if last_to != plan.destination_place_id:
            issues.append("The final step does not end at the confirmed destination.")

        for previous, current in zip(plan.steps, plan.steps[1:]):
            previous_end = previous.to_place_id
            current_start = current.from_place_id
            if previous_end != current_start:
                issues.append(
                    f"Plan path is disconnected between step {previous.step_no} and step {current.step_no}."
                )
        return issues

    def _validate_walk_step(self, step: RouteStep) -> list[str]:
        issues: list[str] = []
        if not step.from_place_id or not step.to_place_id:
            return ["Walk step is missing endpoints."]

        distance_m = self.dataset.distance_between_places(step.from_place_id, step.to_place_id)
        walk_link = self.dataset.get_walk_link(step.from_place_id, step.to_place_id)
        if walk_link is None and (distance_m is None or distance_m > self.dataset.get_walk_threshold_m()):
            issues.append(f"Walk step {step.from_place_id} -> {step.to_place_id} is not verified.")
        if step.from_place_id == step.to_place_id:
            issues.append("Walk step cannot start and end at the same place.")
        return issues

    def _validate_ride_step(
        self,
        step: RouteStep,
        route_code: str,
        warnings: list[str],
    ) -> list[str]:
        issues: list[str] = []
        if route_code not in self.dataset.routes:
            return [f"Unknown route_code: {route_code}"]
        if not step.from_place_id or not step.to_place_id:
            return [f"Ride step {route_code} is missing endpoints."]
        if step.from_place_id == step.to_place_id:
            issues.append(f"Ride step {route_code} cannot start and end at the same place.")

        if not self.dataset.route_can_pickup(route_code, step.from_place_id):
            issues.append(f"Route {route_code} does not directly serve pickup {step.from_place_id}.")
        if not self.dataset.route_can_dropoff(route_code, step.to_place_id):
            issues.append(f"Route {route_code} does not directly serve dropoff {step.to_place_id}.")

        direction = self.dataset.evaluate_direction(route_code, step.from_place_id, step.to_place_id)
        if direction.status == "invalid":
            issues.append(
                f"Direction conflict on {route_code} from {step.from_place_id} to {step.to_place_id}."
            )
        elif direction.status == "unknown":
            warnings.append(f"Direction unknown for {route_code}; confirm the signboard before riding.")
            step.direction_status = "unknown"
        else:
            step.direction_status = "valid"
            step.direction_id = step.direction_id or direction.direction_id
            step.headsign = step.headsign or direction.headsign

        return issues
