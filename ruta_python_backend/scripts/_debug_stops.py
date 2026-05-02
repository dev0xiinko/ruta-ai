import json, pathlib, sys
sys.path.insert(0, '.')
from ruta_python_backend.core.service import RouteService

svc = RouteService()

# Check 17C stops for it_park and colon
dirs_17c = svc.dataset.directions_by_route.get("17C", [])
print("=== 17C directions ===")
for d in dirs_17c:
    stops = d.stop_place_ids
    it = stops.index("pl_it_park") if "pl_it_park" in stops else None
    col = stops.index("pl_colon") if "pl_colon" in stops else None
    print(f"  dir={d.direction_id} headsign={d.headsign}")
    print(f"  it_park idx={it}  colon idx={col}  (need it < col for valid)")
    print(f"  first 12 stops: {stops[:12]}")

print()
print("=== 21A directions (mandaue -> benedicto_st) ===")
for d in svc.dataset.directions_by_route.get("21A", []):
    stops = d.stop_place_ids
    orig = stops.index("pl_mandaue") if "pl_mandaue" in stops else None
    dest = stops.index("pl_benedicto_st") if "pl_benedicto_st" in stops else None
    print(f"  mandaue idx={orig}  benedicto_st idx={dest}")
    print(f"  benedicto_st in stops: {'pl_benedicto_st' in stops}")
    print(f"  stops: {stops[:15]}")
