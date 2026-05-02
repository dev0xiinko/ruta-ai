from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from uuid import uuid4

from ruta_python_backend.core.dataset import RouteDataset
from ruta_python_backend.core.models import RoutePlan, RouteStep


@dataclass
class DirectRideMatch:
    route_code: str
    direction_id: str | None
    headsign: str | None
    direction_status: str
    route_confidence: float


@dataclass
class SearchState:
    current_place_id: str
    steps: list[RouteStep]
    ride_count: int
    walk_count: int
    previous_route_code: str | None
    visited_places: frozenset[str]


class RouteEngine:
    def __init__(self, dataset: RouteDataset) -> None:
        self.dataset = dataset

    def plan_from_truth(self, origin_place_id: str, destination_place_id: str) -> RoutePlan | None:
        truth = self.dataset.find_truth(origin_place_id, destination_place_id)
        if not truth:
            return None

        if truth.steps:
            steps = [step.model_copy(deep=True) for step in truth.steps]
        elif truth.route_type == "walk_only":
            steps = [
                RouteStep(
                    step_no=1,
                    mode="walk",
                    from_place_id=origin_place_id,
                    to_place_id=destination_place_id,
                    walk_minutes=self.dataset.estimate_walk_minutes(origin_place_id, destination_place_id),
                    distance_m=self.dataset.distance_between_places(origin_place_id, destination_place_id),
                )
            ]
        else:
            primary_route = truth.routes[0] if truth.routes else None
            direction = (
                self.dataset.evaluate_direction(primary_route, origin_place_id, destination_place_id)
                if primary_route
                else None
            )
            steps = [
                RouteStep(
                    step_no=1,
                    mode="ride",
                    from_place_id=origin_place_id,
                    to_place_id=destination_place_id,
                    dropoff_place_id=destination_place_id,
                    route_code=primary_route,
                    routes=truth.routes,
                    direction_id=direction.direction_id if direction else None,
                    headsign=direction.headsign if direction else None,
                    direction_status=direction.status if direction else None,
                )
            ]

        return RoutePlan(
            route_plan_id=self._new_plan_id(),
            origin_place_id=origin_place_id,
            destination_place_id=destination_place_id,
            type=truth.route_type,
            confidence=truth.confidence,
            steps=self._normalize_steps(steps),
        )

    def build_candidate_plans(self, origin_place_id: str, destination_place_id: str) -> list[RoutePlan]:
        candidates: list[RoutePlan] = []

        walk_only = self.find_walk_only(origin_place_id, destination_place_id)
        if walk_only:
            candidates.append(walk_only)

        direct = self.find_direct(origin_place_id, destination_place_id)
        if direct:
            candidates.append(direct)

        candidates.extend(self.find_walk_ride(origin_place_id, destination_place_id))
        candidates.extend(self.find_ride_walk(origin_place_id, destination_place_id))
        candidates.extend(self.find_multi_hop(origin_place_id, destination_place_id))

        return self._dedupe_candidates(candidates)

    def find_walk_only(self, origin_place_id: str, destination_place_id: str) -> RoutePlan | None:
        distance_m = self.dataset.distance_between_places(origin_place_id, destination_place_id)
        walk_link = self.dataset.get_walk_link(origin_place_id, destination_place_id)
        threshold = self.dataset.get_walk_threshold_m()
        if not walk_link and (distance_m is None or distance_m > threshold):
            return None

        confidence = "high" if self._is_explicit_walk(origin_place_id, destination_place_id) else "medium"
        return RoutePlan(
            route_plan_id=self._new_plan_id(),
            origin_place_id=origin_place_id,
            destination_place_id=destination_place_id,
            type="walk_only",
            confidence=confidence,
            steps=[
                RouteStep(
                    step_no=1,
                    mode="walk",
                    from_place_id=origin_place_id,
                    to_place_id=destination_place_id,
                    walk_minutes=self.dataset.estimate_walk_minutes(origin_place_id, destination_place_id),
                    distance_m=distance_m,
                )
            ],
        )

    def find_direct(self, origin_place_id: str, destination_place_id: str) -> RoutePlan | None:
        matches = self._preferred_matches(self._direct_matches(origin_place_id, destination_place_id))
        if not matches:
            return None

        best = matches[0]
        return RoutePlan(
            route_plan_id=self._new_plan_id(),
            origin_place_id=origin_place_id,
            destination_place_id=destination_place_id,
            type="direct",
            confidence=self._confidence_for_matches(matches),
            steps=[
                RouteStep(
                    step_no=1,
                    mode="ride",
                    from_place_id=origin_place_id,
                    to_place_id=destination_place_id,
                    dropoff_place_id=destination_place_id,
                    route_code=best.route_code,
                    routes=[match.route_code for match in matches],
                    direction_id=best.direction_id,
                    headsign=best.headsign,
                    direction_status=best.direction_status,
                )
            ],
        )

    def find_walk_ride(self, origin_place_id: str, destination_place_id: str) -> list[RoutePlan]:
        candidates: list[RoutePlan] = []
        for walk_link in self.dataset.get_walk_candidates(origin_place_id):
            pickup_place_id = walk_link.to_place_id
            if pickup_place_id == destination_place_id:
                continue

            matches = self._preferred_matches(
                self._direct_matches(pickup_place_id, destination_place_id)
            )
            if not matches:
                continue

            best = matches[0]
            confidence = self._merge_confidences(
                self._walk_confidence(origin_place_id, pickup_place_id),
                self._confidence_for_matches(matches),
            )
            candidates.append(
                RoutePlan(
                    route_plan_id=self._new_plan_id(),
                    origin_place_id=origin_place_id,
                    destination_place_id=destination_place_id,
                    type="walk_ride",
                    confidence=confidence,
                    steps=self._normalize_steps(
                        [
                            RouteStep(
                                step_no=1,
                                mode="walk",
                                from_place_id=origin_place_id,
                                to_place_id=pickup_place_id,
                                walk_minutes=walk_link.walk_minutes,
                                distance_m=walk_link.distance_m,
                            ),
                            RouteStep(
                                step_no=2,
                                mode="ride",
                                from_place_id=pickup_place_id,
                                to_place_id=destination_place_id,
                                dropoff_place_id=destination_place_id,
                                route_code=best.route_code,
                                routes=[match.route_code for match in matches],
                                direction_id=best.direction_id,
                                headsign=best.headsign,
                                direction_status=best.direction_status,
                            ),
                        ]
                    ),
                )
            )
        return candidates

    def find_ride_walk(self, origin_place_id: str, destination_place_id: str) -> list[RoutePlan]:
        candidates: list[RoutePlan] = []
        for walk_link in self.dataset.get_walk_candidates(destination_place_id):
            dropoff_place_id = walk_link.to_place_id
            if dropoff_place_id == origin_place_id:
                continue

            matches = self._preferred_matches(
                self._direct_matches(origin_place_id, dropoff_place_id)
            )
            if not matches:
                continue

            best = matches[0]
            confidence = self._merge_confidences(
                self._confidence_for_matches(matches),
                self._walk_confidence(dropoff_place_id, destination_place_id),
            )
            candidates.append(
                RoutePlan(
                    route_plan_id=self._new_plan_id(),
                    origin_place_id=origin_place_id,
                    destination_place_id=destination_place_id,
                    type="ride_walk",
                    confidence=confidence,
                    steps=self._normalize_steps(
                        [
                            RouteStep(
                                step_no=1,
                                mode="ride",
                                from_place_id=origin_place_id,
                                to_place_id=dropoff_place_id,
                                dropoff_place_id=dropoff_place_id,
                                route_code=best.route_code,
                                routes=[match.route_code for match in matches],
                                direction_id=best.direction_id,
                                headsign=best.headsign,
                                direction_status=best.direction_status,
                            ),
                            RouteStep(
                                step_no=2,
                                mode="walk",
                                from_place_id=dropoff_place_id,
                                to_place_id=destination_place_id,
                                walk_minutes=walk_link.walk_minutes,
                                distance_m=walk_link.distance_m,
                            ),
                        ]
                    ),
                )
            )
        return candidates

    def find_multi_hop(self, origin_place_id: str, destination_place_id: str) -> list[RoutePlan]:
        max_rides = self.dataset.get_max_rides()
        max_walk_segments = self.dataset.get_max_walk_segments()
        max_search_states = self.dataset.get_max_search_states()
        candidates: list[RoutePlan] = []

        initial_states = [
            SearchState(
                current_place_id=origin_place_id,
                steps=[],
                ride_count=0,
                walk_count=0,
                previous_route_code=None,
                visited_places=frozenset({origin_place_id}),
            )
        ]
        for walk_link in self._walk_expansions(origin_place_id, frozenset({origin_place_id})):
            initial_states.append(
                SearchState(
                    current_place_id=walk_link.to_place_id,
                    steps=[
                        RouteStep(
                            step_no=1,
                            mode="walk",
                            from_place_id=origin_place_id,
                            to_place_id=walk_link.to_place_id,
                            walk_minutes=walk_link.walk_minutes,
                            distance_m=walk_link.distance_m,
                        )
                    ],
                    ride_count=0,
                    walk_count=1,
                    previous_route_code=None,
                    visited_places=frozenset({origin_place_id, walk_link.to_place_id}),
                )
            )

        queue: deque[SearchState] = deque(initial_states)
        best_costs: dict[tuple[str, str | None, int, int], tuple[int, int]] = {}
        explored_states = 0

        while queue and explored_states < max_search_states:
            state = queue.popleft()
            explored_states += 1

            best_key = (
                state.current_place_id,
                state.previous_route_code,
                state.ride_count,
                state.walk_count,
            )
            state_cost = (self._walk_minutes_total(state.steps), len(state.steps))
            previous_best = best_costs.get(best_key)
            if previous_best and state_cost >= previous_best:
                continue
            best_costs[best_key] = state_cost

            if state.ride_count >= max_rides:
                continue

            for route_code in self.dataset.direct_routes_for_place(state.current_place_id, pickup=True):
                if state.previous_route_code and route_code == state.previous_route_code:
                    continue
                if state.previous_route_code and not self.dataset.allowed_transfer(
                    state.previous_route_code,
                    route_code,
                    state.current_place_id,
                ):
                    continue

                for dropoff_place_id, direction_id, headsign in self.dataset.downstream_stops(
                    route_code,
                    state.current_place_id,
                ):
                    if dropoff_place_id in state.visited_places and dropoff_place_id != destination_place_id:
                        continue

                    ride_step = RouteStep(
                        step_no=len(state.steps) + 1,
                        mode="ride",
                        from_place_id=state.current_place_id,
                        to_place_id=dropoff_place_id,
                        dropoff_place_id=dropoff_place_id,
                        route_code=route_code,
                        direction_id=direction_id,
                        headsign=headsign,
                        direction_status="valid" if direction_id else "unknown",
                    )
                    next_steps = self._normalize_steps([*state.steps, ride_step])
                    next_ride_count = state.ride_count + 1
                    next_visited_places = frozenset({*state.visited_places, dropoff_place_id})

                    if dropoff_place_id == destination_place_id and next_ride_count >= 2:
                        candidates.append(
                            RoutePlan(
                                route_plan_id=self._new_plan_id(),
                                origin_place_id=origin_place_id,
                                destination_place_id=destination_place_id,
                                type="multi_hop",
                                confidence=self._confidence_for_steps(next_steps),
                                steps=next_steps,
                            )
                        )
                        continue

                    walk_to_destination = self._best_walk_to_destination(
                        dropoff_place_id,
                        destination_place_id,
                    )
                    if walk_to_destination and (
                        next_ride_count >= 2 or state.walk_count > 0
                    ):
                        candidates.append(
                            RoutePlan(
                                route_plan_id=self._new_plan_id(),
                                origin_place_id=origin_place_id,
                                destination_place_id=destination_place_id,
                                type="multi_hop",
                                confidence=self._confidence_for_steps(
                                    [
                                        *next_steps,
                                        RouteStep(
                                            step_no=len(next_steps) + 1,
                                            mode="walk",
                                            from_place_id=dropoff_place_id,
                                            to_place_id=destination_place_id,
                                            walk_minutes=walk_to_destination.walk_minutes,
                                            distance_m=walk_to_destination.distance_m,
                                        ),
                                    ]
                                ),
                                steps=self._normalize_steps(
                                    [
                                        *next_steps,
                                        RouteStep(
                                            step_no=len(next_steps) + 1,
                                            mode="walk",
                                            from_place_id=dropoff_place_id,
                                            to_place_id=destination_place_id,
                                            walk_minutes=walk_to_destination.walk_minutes,
                                            distance_m=walk_to_destination.distance_m,
                                        ),
                                    ]
                                ),
                            )
                        )

                    queue.append(
                        SearchState(
                            current_place_id=dropoff_place_id,
                            steps=next_steps,
                            ride_count=next_ride_count,
                            walk_count=state.walk_count,
                            previous_route_code=route_code,
                            visited_places=next_visited_places,
                        )
                    )

                    if state.walk_count >= max_walk_segments:
                        continue

                    for walk_link in self._walk_expansions(dropoff_place_id, next_visited_places):
                        queue.append(
                            SearchState(
                                current_place_id=walk_link.to_place_id,
                                steps=self._normalize_steps(
                                    [
                                        *next_steps,
                                        RouteStep(
                                            step_no=len(next_steps) + 1,
                                            mode="walk",
                                            from_place_id=dropoff_place_id,
                                            to_place_id=walk_link.to_place_id,
                                            walk_minutes=walk_link.walk_minutes,
                                            distance_m=walk_link.distance_m,
                                        ),
                                    ]
                                ),
                                ride_count=next_ride_count,
                                walk_count=state.walk_count + 1,
                                previous_route_code=route_code,
                                visited_places=frozenset({*next_visited_places, walk_link.to_place_id}),
                            )
                        )

        return self._dedupe_candidates(candidates)

    def _direct_matches(self, origin_place_id: str, destination_place_id: str) -> list[DirectRideMatch]:
        shared_routes = set(
            self.dataset.direct_routes_for_place(origin_place_id, pickup=True)
        ) & set(self.dataset.direct_routes_for_place(destination_place_id, dropoff=True))

        matches: list[DirectRideMatch] = []
        for route_code in shared_routes:
            direction = self.dataset.evaluate_direction(route_code, origin_place_id, destination_place_id)
            if direction.status == "invalid":
                continue
            route = self.dataset.routes[route_code]
            matches.append(
                DirectRideMatch(
                    route_code=route_code,
                    direction_id=direction.direction_id,
                    headsign=direction.headsign,
                    direction_status=direction.status,
                    route_confidence=route.confidence,
                )
            )

        matches.sort(
            key=lambda item: (
                0 if item.direction_status == "valid" else 1,
                -item.route_confidence,
                item.route_code,
            )
        )
        return matches

    def _preferred_matches(self, matches: list[DirectRideMatch]) -> list[DirectRideMatch]:
        if not matches:
            return []
        valid_matches = [match for match in matches if match.direction_status == "valid"]
        preferred = valid_matches if valid_matches else matches
        return preferred[:3]

    def _walk_expansions(
        self,
        place_id: str,
        visited_places: frozenset[str],
    ) -> list:
        expansions = []
        for walk_link in self.dataset.get_walk_candidates(place_id):
            if walk_link.to_place_id in visited_places:
                continue
            expansions.append(walk_link)
        return expansions

    def _best_walk_to_destination(self, from_place_id: str, destination_place_id: str):
        for walk_link in self.dataset.get_walk_candidates(from_place_id):
            if walk_link.to_place_id == destination_place_id:
                return walk_link
        return None

    def _walk_confidence(self, from_place_id: str, to_place_id: str) -> str:
        return "high" if self._is_explicit_walk(from_place_id, to_place_id) else "medium"

    def _is_explicit_walk(self, from_place_id: str, to_place_id: str) -> bool:
        return self.dataset.get_walk_link(from_place_id, to_place_id) is not None

    def _confidence_for_matches(self, matches: list[DirectRideMatch]) -> str:
        if not matches:
            return "low"
        if any(match.direction_status == "unknown" for match in matches):
            return "medium"
        if matches[0].route_confidence < 0.75:
            return "medium"
        return "high"

    def _confidence_for_steps(self, steps: list[RouteStep]) -> str:
        for step in steps:
            if step.mode == "walk" and step.from_place_id and step.to_place_id:
                if not self._is_explicit_walk(step.from_place_id, step.to_place_id):
                    return "medium"
            if step.mode == "ride" and step.direction_status == "unknown":
                return "medium"
        return "high"

    def _merge_confidences(self, left: str, right: str) -> str:
        ranking = {"low": 0, "medium": 1, "high": 2}
        return left if ranking[left] <= ranking[right] else right

    def _walk_minutes_total(self, steps: list[RouteStep]) -> int:
        return sum(step.walk_minutes or 0 for step in steps if step.mode == "walk")

    def _normalize_steps(self, steps: list[RouteStep]) -> list[RouteStep]:
        normalized: list[RouteStep] = []
        for index, step in enumerate(steps, start=1):
            normalized.append(step.model_copy(update={"step_no": index}))
        return normalized

    def _dedupe_candidates(self, candidates: list[RoutePlan]) -> list[RoutePlan]:
        unique: dict[tuple[str, tuple[tuple[str, str | None, str | None], ...]], RoutePlan] = {}
        for plan in candidates:
            key = (
                plan.type,
                tuple((step.mode, step.route_code, step.to_place_id) for step in plan.steps),
            )
            unique[key] = plan
        return list(unique.values())

    def _new_plan_id(self) -> str:
        return f"rp_{uuid4().hex[:8]}"
