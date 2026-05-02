from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path
from threading import Lock

from ruta_python_backend.core.config import get_settings
from ruta_python_backend.core.models import (
    AreaCluster,
    DirectionCheck,
    FeedbackEntry,
    ODTruthEntry,
    Place,
    Route,
    RouteDirection,
    RoutePlaceLink,
    RouteTransfer,
    WalkLink,
)


class RouteDataset:
    def __init__(self, dataset_dir: str | Path | None = None) -> None:
        settings = get_settings()
        self.dataset_dir = Path(dataset_dir) if dataset_dir else settings.dataset_dir
        self._lock = Lock()
        self.reload()

    def _read_json(self, filename: str, default: object) -> object:
        path = self.dataset_dir / filename
        if not path.exists():
            return default
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def reload(self) -> None:
        self.places = {
            item.place_id: item
            for item in (Place.model_validate(raw) for raw in self._read_json("places.json", []))
        }
        self.routes = {
            item.route_code: item
            for item in (Route.model_validate(raw) for raw in self._read_json("routes.json", []))
        }
        self.route_links = [
            RoutePlaceLink.model_validate(raw)
            for raw in self._read_json("route_place_links.json", [])
        ]
        self.route_transfers = [
            RouteTransfer.model_validate(raw)
            for raw in self._read_json("route_transfers.json", [])
        ]
        self.walk_links = [
            WalkLink.model_validate(raw)
            for raw in self._read_json("walk_links.json", [])
        ]
        self.route_directions = [
            RouteDirection.model_validate(raw)
            for raw in self._read_json("route_directions.json", [])
        ]
        self.od_truth_entries = [
            ODTruthEntry.model_validate(raw)
            for raw in self._read_json("od_truth_table.json", [])
        ]
        self.area_clusters = [
            AreaCluster.model_validate(raw)
            for raw in self._read_json("area_clusters.json", [])
        ]
        self.route_tests = self._read_json("route_tests.json", [])
        self.route_scoring = self._read_json("route_scoring.json", {})
        self.resolver_rules = self._read_json("resolver_rules.json", {})
        self.route_engine_rules = self._read_json("route_engine_rules.json", {})
        self.corridors = self._read_json("corridors.json", [])
        self.validated_routes = self._read_json("validated_routes.json", [])
        self.validation_report = self._read_json("validation_report.json", {})

        self.links_by_route: dict[str, list[RoutePlaceLink]] = defaultdict(list)
        self.links_by_place: dict[str, list[RoutePlaceLink]] = defaultdict(list)
        for link in self.route_links:
            self.links_by_route[link.route_code].append(link)
            self.links_by_place[link.place_id].append(link)

        self.walk_links_by_origin: dict[str, list[WalkLink]] = defaultdict(list)
        for link in self.walk_links:
            self.walk_links_by_origin[link.from_place_id].append(link)
            if link.bidirectional:
                reverse = WalkLink(
                    from_place_id=link.to_place_id,
                    to_place_id=link.from_place_id,
                    walk_minutes=link.walk_minutes,
                    distance_m=link.distance_m,
                    bidirectional=True,
                )
                self.walk_links_by_origin[reverse.from_place_id].append(reverse)

        self.directions_by_route: dict[str, list[RouteDirection]] = defaultdict(list)
        for direction in self.route_directions:
            self.directions_by_route[direction.route_code].append(direction)

        self.od_truth_index = {
            (entry.origin_place_id, entry.destination_place_id): entry
            for entry in self.od_truth_entries
        }

        self.transfer_lookup: set[tuple[str, str, str]] = set()
        for transfer in self.route_transfers:
            self.transfer_lookup.add(
                (
                    transfer.from_route_code,
                    transfer.to_route_code,
                    transfer.transfer_place_id,
                )
            )
            if transfer.bidirectional:
                self.transfer_lookup.add(
                    (
                        transfer.to_route_code,
                        transfer.from_route_code,
                        transfer.transfer_place_id,
                    )
                )

    def place_name(self, place_id: str | None) -> str:
        if not place_id:
            return "Unknown place"
        place = self.places.get(place_id)
        return place.name if place else place_id

    def get_walk_threshold_m(self) -> int:
        return int(self.route_engine_rules.get("walk_threshold_m", 1000))

    def get_max_rides(self) -> int:
        return int(self.route_engine_rules.get("max_rides", 3))

    def get_max_walk_segments(self) -> int:
        return int(self.route_engine_rules.get("max_walk_segments", 3))

    def get_max_walk_minutes_per_segment(self) -> int:
        return int(self.route_engine_rules.get("max_walk_minutes_per_segment", 15))

    def get_max_search_states(self) -> int:
        return int(self.route_engine_rules.get("max_search_states", 500))

    def find_truth(self, origin_place_id: str, destination_place_id: str) -> ODTruthEntry | None:
        return self.od_truth_index.get((origin_place_id, destination_place_id))

    def route_serves_place(
        self,
        route_code: str,
        place_id: str,
        allowed_access: tuple[str, ...] = ("direct_access",),
        *,
        require_pickup: bool | None = None,
        require_dropoff: bool | None = None,
    ) -> bool:
        return any(
            link.place_id == place_id
            and link.access_type in allowed_access
            and (require_pickup is None or link.pickup == require_pickup)
            and (require_dropoff is None or link.dropoff == require_dropoff)
            for link in self.links_by_route.get(route_code, [])
        )

    def route_can_pickup(
        self,
        route_code: str,
        place_id: str,
        allowed_access: tuple[str, ...] = ("direct_access",),
    ) -> bool:
        return self.route_serves_place(
            route_code,
            place_id,
            allowed_access,
            require_pickup=True,
        )

    def route_can_dropoff(
        self,
        route_code: str,
        place_id: str,
        allowed_access: tuple[str, ...] = ("direct_access",),
    ) -> bool:
        return self.route_serves_place(
            route_code,
            place_id,
            allowed_access,
            require_dropoff=True,
        )

    def direct_routes_for_place(
        self,
        place_id: str,
        *,
        pickup: bool = False,
        dropoff: bool = False,
    ) -> list[str]:
        routes = {
            link.route_code
            for link in self.links_by_place.get(place_id, [])
            if link.access_type == "direct_access"
            and (not pickup or link.pickup)
            and (not dropoff or link.dropoff)
        }
        return sorted(routes)

    def get_walk_links(self, place_id: str) -> list[WalkLink]:
        return list(self.walk_links_by_origin.get(place_id, []))

    def get_walk_link(self, from_place_id: str, to_place_id: str) -> WalkLink | None:
        for link in self.walk_links_by_origin.get(from_place_id, []):
            if link.to_place_id == to_place_id:
                return link
        return None

    def get_walk_candidates(self, place_id: str) -> list[WalkLink]:
        threshold_m = self.get_walk_threshold_m()
        max_walk_minutes = self.get_max_walk_minutes_per_segment()
        candidates: dict[str, WalkLink] = {}

        for link in self.get_walk_links(place_id):
            if link.walk_minutes <= max_walk_minutes:
                candidates[link.to_place_id] = link

        for other_place_id in self.places:
            if other_place_id == place_id or other_place_id in candidates:
                continue
            distance_m = self.distance_between_places(place_id, other_place_id)
            if distance_m is None or distance_m > threshold_m:
                continue
            walk_minutes = max(1, math.ceil(distance_m / 80))
            if walk_minutes > max_walk_minutes:
                continue
            candidates[other_place_id] = WalkLink(
                from_place_id=place_id,
                to_place_id=other_place_id,
                walk_minutes=walk_minutes,
                distance_m=distance_m,
                bidirectional=True,
            )

        return sorted(
            candidates.values(),
            key=lambda link: (
                link.walk_minutes,
                link.distance_m if link.distance_m is not None else 10**9,
                self.place_name(link.to_place_id),
            ),
        )

    def allowed_transfer(self, from_route_code: str, to_route_code: str, place_id: str) -> bool:
        if from_route_code == to_route_code:
            return True
        return (from_route_code, to_route_code, place_id) in self.transfer_lookup

    def distance_between_places(self, from_place_id: str, to_place_id: str) -> int | None:
        walk_link = self.get_walk_link(from_place_id, to_place_id)
        if walk_link and walk_link.distance_m is not None:
            return walk_link.distance_m

        origin = self.places.get(from_place_id)
        destination = self.places.get(to_place_id)
        if not origin or not destination:
            return None
        if origin.latitude is None or origin.longitude is None:
            return None
        if destination.latitude is None or destination.longitude is None:
            return None

        radius_m = 6371000
        lat1 = math.radians(origin.latitude)
        lat2 = math.radians(destination.latitude)
        delta_lat = math.radians(destination.latitude - origin.latitude)
        delta_lon = math.radians(destination.longitude - origin.longitude)

        hav = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
        )
        distance = 2 * radius_m * math.asin(math.sqrt(hav))
        return int(distance)

    def estimate_walk_minutes(self, from_place_id: str, to_place_id: str) -> int | None:
        walk_link = self.get_walk_link(from_place_id, to_place_id)
        if walk_link:
            return walk_link.walk_minutes
        distance_m = self.distance_between_places(from_place_id, to_place_id)
        if distance_m is None:
            return None
        return max(1, math.ceil(distance_m / 80))

    def evaluate_direction(
        self, route_code: str, origin_place_id: str, destination_place_id: str
    ) -> DirectionCheck:
        directions = self.directions_by_route.get(route_code, [])
        if not directions:
            return DirectionCheck(status="unknown")

        unknown_seen = False
        for direction in directions:
            try:
                origin_index = direction.stop_place_ids.index(origin_place_id)
            except ValueError:
                origin_index = None
            try:
                destination_index = direction.stop_place_ids.index(destination_place_id)
            except ValueError:
                destination_index = None

            if origin_index is None or destination_index is None:
                unknown_seen = True
                continue
            if origin_index < destination_index:
                return DirectionCheck(
                    status="valid",
                    direction_id=direction.direction_id,
                    headsign=direction.headsign,
                )

        if unknown_seen:
            return DirectionCheck(status="unknown")
        return DirectionCheck(status="invalid")

    def downstream_stops(self, route_code: str, origin_place_id: str) -> list[tuple[str, str, str]]:
        results: list[tuple[str, str, str]] = []
        seen: set[tuple[str, str]] = set()
        for direction in self.directions_by_route.get(route_code, []):
            if origin_place_id not in direction.stop_place_ids:
                continue
            origin_index = direction.stop_place_ids.index(origin_place_id)
            for stop_place_id in direction.stop_place_ids[origin_index + 1 :]:
                if not self.route_can_dropoff(route_code, stop_place_id):
                    continue
                key = (direction.direction_id, stop_place_id)
                if key in seen:
                    continue
                seen.add(key)
                results.append((stop_place_id, direction.direction_id, direction.headsign))
        return results

    def append_feedback(self, feedback: FeedbackEntry) -> None:
        path = self.dataset_dir / "candidate_routes_needing_validation.json"
        with self._lock:
            existing = self._read_json("candidate_routes_needing_validation.json", [])
            if not isinstance(existing, list):
                existing = []
            existing.append(feedback.model_dump())
            with path.open("w", encoding="utf-8") as handle:
                json.dump(existing, handle, indent=2)
                handle.write("\n")

            report = self.validation_report if isinstance(self.validation_report, dict) else {}
            report.setdefault("feedback_count", 0)
            report["feedback_count"] += 1
            report.setdefault("last_feedback_query", feedback.query)
            report["last_feedback_query"] = feedback.query

            report_path = self.dataset_dir / "validation_report.json"
            with report_path.open("w", encoding="utf-8") as handle:
                json.dump(report, handle, indent=2)
                handle.write("\n")

        self.reload()
