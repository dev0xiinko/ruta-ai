"""
Accuracy benchmark: runs every route_tests.json case through the live engine
and prints a real pass/fail rate.
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from ruta_python_backend.core.models import ComputeRouteRequest
from ruta_python_backend.core.service import RouteService


def main() -> None:
    svc = RouteService()
    tests_path = pathlib.Path(__file__).resolve().parents[1] / "ruta_dataset_v4" / "route_tests.json"
    tests = json.loads(tests_path.read_text(encoding="utf-8"))

    passed = 0
    failed = 0
    skipped = 0
    failures: list[str] = []

    for t in tests:
        orig = t.get("origin_place_id", "")
        dest = t.get("destination_place_id", "")
        expected_type = t.get("expected_type", "")
        expected_routes: list[str] = t.get("expected_routes", [])
        should_not: list[str] = t.get("should_not_include", [])

        if orig not in svc.dataset.places or dest not in svc.dataset.places:
            skipped += 1
            continue

        try:
            resp = svc.compute_route(
                ComputeRouteRequest(
                    origin_place_id=orig,
                    destination_place_id=dest,
                    confirmed=True,
                )
            )
        except Exception as ex:
            failures.append(f"ERROR  [{t['query'][:50]}]: {ex}")
            failed += 1
            continue

        plan = resp.get("route_plan")
        if plan is None:
            failures.append(f"NO ROUTE  [{t['query'][:50]}]")
            failed += 1
            continue

        actual_type = plan.get("type", "")
        all_routes: list[str] = []
        for step in plan.get("steps", []):
            all_routes.extend(step.get("routes") or ([step["route_code"]] if step.get("route_code") else []))

        type_ok = actual_type == expected_type
        routes_ok = all(r in all_routes for r in expected_routes)
        excl_ok = all(r not in all_routes for r in should_not)

        if type_ok and routes_ok and excl_ok:
            passed += 1
        else:
            errs: list[str] = []
            if not type_ok:
                errs.append(f"type={actual_type!r} want={expected_type!r}")
            if not routes_ok:
                missing = [r for r in expected_routes if r not in all_routes]
                errs.append(f"missing={missing}")
            if not excl_ok:
                bad = [r for r in should_not if r in all_routes]
                errs.append(f"should_not_include={bad}")
            failures.append(f"FAIL  [{t['query'][:50]}]  {' | '.join(errs)}")
            failed += 1

    total = passed + failed
    pct = round(passed / total * 100, 1) if total else 0.0

    print()
    print("=" * 55)
    print("  RUTA BACKEND — REAL ACCURACY BENCHMARK")
    print("=" * 55)
    print(f"  Passed  : {passed} / {total}  ({pct}%)")
    print(f"  Failed  : {failed}")
    print(f"  Skipped : {skipped}  (place_id not in dataset)")
    print("=" * 55)

    if failures:
        print(f"\n--- Failures ({len(failures)}) ---")
        for line in failures:
            print(" ", line)

    # Overall letter grade
    if pct >= 95:
        grade = "A+ (Excellent)"
    elif pct >= 88:
        grade = "A  (Very Good)"
    elif pct >= 80:
        grade = "B  (Good)"
    elif pct >= 70:
        grade = "C  (Fair)"
    else:
        grade = "D  (Needs Work)"

    print(f"\n  Grade: {grade}")
    print()


if __name__ == "__main__":
    main()
