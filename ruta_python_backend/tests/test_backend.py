from __future__ import annotations

import json
import shutil
import unittest
from pathlib import Path
from uuid import uuid4

from ruta_python_backend.core.models import ComputeRouteRequest, FeedbackRequest, ResolveRouteRequest
from ruta_python_backend.core.service import RouteService


class RouteBackendTests(unittest.TestCase):
    def setUp(self) -> None:
        root = Path("ruta_python_backend/.tmp-tests")
        root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = str(root / uuid4().hex)
        source = Path("ruta_python_backend/ruta_dataset_v4")
        destination = Path(self.temp_dir) / "ruta_dataset_v4"
        shutil.copytree(source, destination)
        self.service = RouteService(dataset_dir=destination)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _dataset_file(self, filename: str) -> Path:
        return Path(self.temp_dir) / "ruta_dataset_v4" / filename

    def _write_dataset_json(self, filename: str, payload: object) -> None:
        path = self._dataset_file(filename)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")

    def _reload_service(self) -> None:
        self.service = RouteService(dataset_dir=Path(self.temp_dir) / "ruta_dataset_v4")

    def test_resolve_requires_confirmation(self) -> None:
        response = self.service.resolve_query(
            ResolveRouteRequest(query="gaisano near colon to ACT")
        )
        self.assertEqual(response["status"], "needs_confirmation")
        self.assertEqual(response["normalized"]["origin"]["place_id"], "pl_gaisano_main_colon")
        self.assertEqual(response["normalized"]["destination"]["place_id"], "pl_act")

    def test_compute_prefers_truth_table(self) -> None:
        response = self.service.compute_route(
            ComputeRouteRequest(
                origin_place_id="pl_it_park",
                destination_place_id="pl_colon",
                confirmed=True,
            )
        )
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["route_plan"]["type"], "direct")
        self.assertEqual(response["route_plan"]["steps"][0]["route_code"], "17B")
        self.assertIn("17B", response["route_plan"]["steps"][0]["routes"])

    def test_compute_walk_only_route(self) -> None:
        response = self.service.compute_route(
            ComputeRouteRequest(
                origin_place_id="pl_gaisano_main_colon",
                destination_place_id="pl_act",
                confirmed=True,
            )
        )
        self.assertEqual(response["route_plan"]["type"], "walk_only")
        self.assertIn("maglakaw", response["message"])

    def test_compute_multi_hop_route(self) -> None:
        response = self.service.compute_route(
            ComputeRouteRequest(
                origin_place_id="pl_as_fortuna_dunkin",
                destination_place_id="pl_guadalupe_church",
                confirmed=True,
            )
        )
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["route_plan"]["type"], "multi_hop")
        ride_codes = [
            step["route_code"]
            for step in response["route_plan"]["steps"]
            if step["mode"] == "ride"
        ]
        self.assertGreaterEqual(len(ride_codes), 2)
        self.assertEqual(
            response["route_plan"]["steps"][-1]["to_place_id"],
            "pl_guadalupe_church",
        )

    def test_feedback_creates_candidate_patch(self) -> None:
        response = self.service.submit_feedback(
            FeedbackRequest(
                query="Zapatera to Fuente",
                system_answer="01K",
                user_verdict="incorrect",
                notes="No direct jeepney route.",
            )
        )
        self.assertEqual(response["status"], "feedback_saved")
        dataset_file = Path(self.temp_dir) / "ruta_dataset_v4" / "candidate_routes_needing_validation.json"
        self.assertTrue(dataset_file.exists())
        self.assertIn("candidate_patch_created", response)

    def test_invalid_truth_table_falls_back_to_verified_search(self) -> None:
        self._write_dataset_json(
            "od_truth_table.json",
            [
                {
                    "origin_place_id": "pl_it_park",
                    "destination_place_id": "pl_colon",
                    "route_type": "direct",
                    "routes": ["99Z"],
                    "confidence": "high",
                    "validated": True,
                }
            ],
        )
        self._reload_service()

        response = self.service.compute_route(
            ComputeRouteRequest(
                origin_place_id="pl_it_park",
                destination_place_id="pl_colon",
                confirmed=True,
            )
        )
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["route_plan"]["type"], "direct")
        self.assertNotIn("99Z", response["route_plan"]["steps"][0]["routes"])
        self.assertIn("17B", response["route_plan"]["steps"][0]["routes"])

    def test_direct_search_respects_pickup_and_dropoff_constraints(self) -> None:
        self._write_dataset_json("od_truth_table.json", [])

        route_links = json.loads(self._dataset_file("route_place_links.json").read_text(encoding="utf-8"))
        direct_routes = {
            link["route_code"]
            for link in route_links
            if link["place_id"] == "pl_it_park"
            and link.get("access_type", "direct_access") == "direct_access"
            and link.get("pickup", True)
        } & {
            link["route_code"]
            for link in route_links
            if link["place_id"] == "pl_colon"
            and link.get("access_type", "direct_access") == "direct_access"
            and link.get("dropoff", True)
        }
        updated_links = []
        for link in route_links:
            if link["route_code"] in direct_routes and link["place_id"] == "pl_colon":
                link = {**link, "dropoff": False}
            updated_links.append(link)
        self._write_dataset_json("route_place_links.json", updated_links)
        self._reload_service()

        response = self.service.compute_route(
            ComputeRouteRequest(
                origin_place_id="pl_it_park",
                destination_place_id="pl_colon",
                confirmed=True,
            )
        )
        self.assertEqual(response["status"], "success")
        self.assertNotEqual(response["route_plan"]["type"], "direct")
        self.assertFalse(
            any(
                step["mode"] == "ride"
                and step.get("route_code") == "17B"
                and step.get("to_place_id") == "pl_colon"
                for step in response["route_plan"]["steps"]
            )
        )

    def test_inferred_walk_only_route_is_downgraded_to_medium_confidence(self) -> None:
        walk_links = json.loads(self._dataset_file("walk_links.json").read_text(encoding="utf-8"))
        updated_walk_links = [
            link
            for link in walk_links
            if not (
                link["from_place_id"] == "pl_gaisano_main_colon"
                and link["to_place_id"] == "pl_act"
            )
            and not (
                link["from_place_id"] == "pl_act"
                and link["to_place_id"] == "pl_gaisano_main_colon"
            )
        ]
        self._write_dataset_json("walk_links.json", updated_walk_links)
        self._reload_service()

        response = self.service.compute_route(
            ComputeRouteRequest(
                origin_place_id="pl_gaisano_main_colon",
                destination_place_id="pl_act",
                confirmed=True,
            )
        )
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["route_plan"]["type"], "walk_only")
        self.assertEqual(response["route_plan"]["confidence"], "medium")

    def test_dataset_bootstrap_has_broad_coverage(self) -> None:
        self.assertGreaterEqual(len(self.service.dataset.places), 90)
        self.assertGreaterEqual(len(self.service.dataset.routes), 60)
        self.assertGreaterEqual(len(self.service.dataset.route_directions), 60)
        self.assertGreaterEqual(len(self.service.dataset.route_links), 500)


if __name__ == "__main__":
    unittest.main()
