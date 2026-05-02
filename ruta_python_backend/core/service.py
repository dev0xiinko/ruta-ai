from __future__ import annotations

from pathlib import Path

from ruta_python_backend.core.dataset import RouteDataset
from ruta_python_backend.core.engine import RouteEngine
from ruta_python_backend.core.extractor import QueryExtractor
from ruta_python_backend.core.formatter import format_route_plan
from ruta_python_backend.core.models import (
    ComputeRouteRequest,
    FeedbackEntry,
    FeedbackRequest,
    ResolveRouteRequest,
    RoutePlan,
)
from ruta_python_backend.core.resolver import PlaceResolver
from ruta_python_backend.core.scorer import score_route_plan
from ruta_python_backend.core.validator import RoutePlanValidator


class RouteService:
    def __init__(self, dataset_dir: str | Path | None = None) -> None:
        self.dataset = RouteDataset(dataset_dir=dataset_dir)
        self.extractor = QueryExtractor()
        self.resolver = PlaceResolver(self.dataset)
        self.engine = RouteEngine(self.dataset)
        self.validator = RoutePlanValidator(self.dataset)

    def resolve_query(self, payload: ResolveRouteRequest) -> dict[str, object]:
        extracted = self.extractor.extract(payload.query, payload.language_hint)
        if not extracted.needs_route_answer or not extracted.origin_text or not extracted.destination_text:
            raise ValueError("Please use a place-to-place query like 'IT Park to Colon'.")

        origin_candidates = self.resolver.resolve_candidates(extracted.origin_text)
        destination_candidates = self.resolver.resolve_candidates(extracted.destination_text)
        if not origin_candidates or not destination_candidates:
            raise ValueError("I could not safely resolve both places from that query yet.")

        return {
            "status": "needs_confirmation",
            "extracted": extracted.model_dump(),
            "normalized": {
                "origin": origin_candidates[0].model_dump(),
                "destination": destination_candidates[0].model_dump(),
            },
            "origin_candidates": [candidate.model_dump() for candidate in origin_candidates],
            "destination_candidates": [candidate.model_dump() for candidate in destination_candidates],
            "message": self.resolver.build_confirmation_message(
                origin_candidates,
                destination_candidates,
            ),
        }

    def compute_route(self, payload: ComputeRouteRequest) -> dict[str, object]:
        if not payload.confirmed:
            raise ValueError("Routing can only start after the user confirms the normalized places.")
        if payload.origin_place_id not in self.dataset.places:
            raise ValueError(f"Unknown origin_place_id: {payload.origin_place_id}")
        if payload.destination_place_id not in self.dataset.places:
            raise ValueError(f"Unknown destination_place_id: {payload.destination_place_id}")

        truth_plan = self.engine.plan_from_truth(payload.origin_place_id, payload.destination_place_id)
        if truth_plan:
            finalized_truth = self._finalize_plan(truth_plan)
            if finalized_truth.validation.passed:
                return self._success_response(finalized_truth)

        best_candidate = self._pick_best(
            self.engine.build_candidate_plans(
                payload.origin_place_id,
                payload.destination_place_id,
            )
        )
        if best_candidate:
            return self._success_response(best_candidate)

        return {
            "status": "no_verified_route",
            "route_plan": None,
            "message": "No verified route found in the current dataset.",
            "candidate_patch_allowed": True,
        }

    def submit_feedback(self, payload: FeedbackRequest) -> dict[str, object]:
        correct_route = payload.correct_route
        if isinstance(correct_route, str):
            correct_routes = [item.strip() for item in correct_route.split(",") if item.strip()]
        elif isinstance(correct_route, list):
            correct_routes = [item.strip() for item in correct_route if item.strip()]
        else:
            correct_routes = []

        feedback = FeedbackEntry(
            query=payload.query,
            system_answer=payload.system_answer,
            user_verdict=payload.user_verdict,
            correct_route=correct_routes,
            notes=payload.notes,
        )
        self.dataset.append_feedback(feedback)
        return {
            "status": "feedback_saved",
            "candidate_patch_created": payload.user_verdict != "correct",
        }

    def _pick_best(self, candidates: list[RoutePlan]) -> RoutePlan | None:
        finalized: list[RoutePlan] = []
        for candidate in candidates:
            plan = self._finalize_plan(candidate)
            if plan.validation.passed:
                finalized.append(plan)
        if not finalized:
            return None
        return max(finalized, key=self._plan_rank)

    def _finalize_plan(self, plan: RoutePlan) -> RoutePlan:
        validation = self.validator.validate(plan)
        plan.validation = validation
        if not validation.passed:
            plan.confidence = "low"
            plan.score = -999
            return plan

        if validation.warnings and plan.confidence == "high":
            plan.confidence = "medium"

        plan.score = score_route_plan(plan, self.dataset)
        return plan

    def _success_response(self, plan: RoutePlan) -> dict[str, object]:
        return {
            "status": "success",
            "route_plan": plan.model_dump(),
            "message": format_route_plan(plan, self.dataset),
        }

    def _plan_rank(self, plan: RoutePlan) -> tuple[int, int, int, int, int, int]:
        ride_count = sum(1 for step in plan.steps if step.mode == "ride")
        walk_count = sum(1 for step in plan.steps if step.mode == "walk")
        walk_minutes = sum(step.walk_minutes or 0 for step in plan.steps if step.mode == "walk")
        confidence_rank = {"low": 0, "medium": 1, "high": 2}[plan.confidence]
        return (
            plan.score,
            -ride_count,
            -walk_count,
            -walk_minutes,
            confidence_rank,
            -len(plan.steps),
        )
