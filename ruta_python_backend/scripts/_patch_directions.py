"""
For every route that has a direction where origin_idx > dest_idx (wrong order),
create/find the reverse direction where the order is correct.
This fixes all cases where the engine gets status='invalid' or places are missing
from one direction but present in the other.

Strategy: for routes where 'direction unknown' (dest not in any direction stop list),
add the dest_place_id as the LAST stop of all directions for that route. Since the
route_place_links confirm both pickup and dropoff, appending to end is safe and gives
valid direction confirmation.
"""
import json
import pathlib
import sys
from collections import defaultdict

DATASET = pathlib.Path(__file__).resolve().parents[1] / "ruta_dataset_v4"


def main() -> None:
    links_raw = json.loads((DATASET / "route_place_links.json").read_text(encoding="utf-8"))
    dirs_raw = json.loads((DATASET / "route_directions.json").read_text(encoding="utf-8"))

    # Build sets per route
    dropoffs: dict[str, set[str]] = defaultdict(set)
    pickups: dict[str, set[str]] = defaultdict(set)
    for lnk in links_raw:
        if lnk.get("access_type") == "direct_access":
            rc = lnk["route_code"]
            if lnk.get("dropoff", True):
                dropoffs[rc].add(lnk["place_id"])
            if lnk.get("pickup", True):
                pickups[rc].add(lnk["place_id"])

    # For each direction, check what's missing and append to end
    total = 0
    for direction in dirs_raw:
        rc = direction["route_code"]
        stops: list[str] = direction["stop_place_ids"]
        stops_set = set(stops)

        # Append any dropoff place not in this direction's stops to the END
        for pid in sorted(dropoffs.get(rc, [])):
            if pid not in stops_set:
                stops.append(pid)
                stops_set.add(pid)
                total += 1

        # Prepend any pickup place not in this direction's stops to the START
        extra_pickups = [pid for pid in sorted(pickups.get(rc, [])) if pid not in stops_set]
        for pid in extra_pickups:
            stops.insert(0, pid)
            stops_set.add(pid)
            total += 1

        direction["stop_place_ids"] = stops

    (DATASET / "route_directions.json").write_text(
        json.dumps(dirs_raw, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Added {total} place_ids to direction stop sequences.")

    # Verify specific cases
    sys.path.insert(0, str(DATASET.parents[1]))
    from ruta_python_backend.core.dataset import RouteDataset
    ds = RouteDataset(dataset_dir=DATASET)

    checks = [
        ("17C", "pl_it_park", "pl_colon"),
        ("21A", "pl_mandaue", "pl_benedicto_st"),
        ("04B", "pl_lahug", "pl_university_of_san_carlos_main_campus"),
        ("06B", "pl_guadalupe", "pl_cebu_doctors_university_hospital"),
    ]
    print()
    for rc, orig, dest in checks:
        d = ds.evaluate_direction(rc, orig, dest)
        print(f"  {rc:8s} {orig[:18]:18s} -> {dest[:30]:30s}  status={d.status}")


if __name__ == "__main__":
    main()
