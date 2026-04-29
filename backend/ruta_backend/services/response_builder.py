from __future__ import annotations

from ..models import (
    ResolutionResult,
    RouteComputationResult,
    RouteLeg,
    RouteOption,
    RoutePlan,
    RouteResponse,
)


class ResponseBuilder:
    """Convert internal route computation results into stable API DTOs."""

    def build_route_response(
        self,
        *,
        origin: ResolutionResult,
        destination: ResolutionResult,
        plan: RoutePlan | None,
    ) -> RouteResponse:
        if plan is None:
            return self.build_no_match_response(
                origin=origin,
                destination=destination,
                reason=self._build_no_match_reason(origin, destination),
            )

        options = [self._build_option(rank=index + 1, detail=detail, plan=plan) for index, detail in enumerate(plan.details)]
        return RouteResponse(
            result=RouteComputationResult(
                status="success",
                mode=self._mode_for_plan(plan),
                origin=origin,
                destination=destination,
                options=options,
                message=plan.summary,
            )
        )

    def build_no_match_response(
        self,
        *,
        origin: ResolutionResult | None,
        destination: ResolutionResult | None,
        reason: str,
    ) -> RouteResponse:
        return RouteResponse(
            result=RouteComputationResult(
                status="no_match",
                mode="no_match",
                origin=origin,
                destination=destination,
                options=[],
                message=reason,
            )
        )

    def _build_option(self, *, rank: int, detail: dict, plan: RoutePlan) -> RouteOption:
        route_codes = [code for code in [detail.get("route_code"), detail.get("first_route"), detail.get("second_route")] if code]
        transfers = max(0, len(route_codes) - 1)
        return RouteOption(
            rank=rank,
            route_codes=[str(code) for code in route_codes],
            transfers=transfers,
            legs=self._build_legs(detail),
            confidence=float(detail.get("score", plan.confidence)),
            why=self._why(detail, plan),
        )

    def _build_legs(self, detail: dict) -> list[RouteLeg]:
        if detail.get("route_code"):
            return [
                RouteLeg(
                    route_code=str(detail["route_code"]),
                    route_name=detail.get("route_name"),
                    relation=str(detail.get("match_type") or detail.get("destination_access") or "unknown"),
                    walk_minutes=detail.get("destination_walk_minutes") or detail.get("origin_walk_minutes"),
                    distance_m=None,
                    stop_hint=detail.get("dropoff_stop"),
                )
            ]

        legs: list[RouteLeg] = []
        if detail.get("first_route"):
            legs.append(
                RouteLeg(
                    route_code=str(detail["first_route"]),
                    route_name=None,
                    relation=str(detail.get("origin_access") or "unknown"),
                    walk_minutes=None,
                    distance_m=None,
                    stop_hint=detail.get("transfer_hint"),
                )
            )
        if detail.get("second_route"):
            legs.append(
                RouteLeg(
                    route_code=str(detail["second_route"]),
                    route_name=None,
                    relation=str(detail.get("destination_access") or "unknown"),
                    walk_minutes=None,
                    distance_m=None,
                    stop_hint=detail.get("transfer_hint"),
                )
            )
        return legs

    def _mode_for_plan(self, plan: RoutePlan) -> str:
        if any(detail.get("fallback") for detail in plan.details):
            return "fallback"
        if plan.response_type == "transfer_required":
            return "transfer"
        return "direct"

    def _why(self, detail: dict, plan: RoutePlan) -> str:
        if detail.get("fallback"):
            return "Fallback transfer path based on the strongest reachable route pair."
        if detail.get("route_code"):
            match_type = str(detail.get("match_type") or "direct_access").replace("_", " ")
            return f"Single-ride option ranked by {match_type} access and walking effort."
        return "Transfer option ranked by fewer transfers, access quality, and confidence."

    def _build_no_match_reason(self, origin: ResolutionResult, destination: ResolutionResult) -> str:
        weak_resolution = origin.top_match is None or destination.top_match is None
        if weak_resolution:
            return "Could not confidently resolve the origin or destination from the active place graph."
        return "Resolved both endpoints, but no deterministic graph path was found in the active route data."
