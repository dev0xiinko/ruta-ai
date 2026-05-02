import sys
sys.path.insert(0, '.')
from ruta_python_backend.core.service import RouteService

svc = RouteService()

total_routes = len(svc.dataset.routes)
routes_with_dirs = len(svc.dataset.directions_by_route)
print(f"Routes total: {total_routes}, With direction data: {routes_with_dirs}")

# Sample failures and their direction check
checks = [
    ("17C", "pl_it_park", "pl_colon"),
    ("04I", "pl_cim", "pl_mango_ave"),
    ("21A", "pl_mandaue", "pl_benedicto_st"),
    ("06B", "pl_guadalupe", "pl_cebu_doctors_university_hospital"),
    ("01C", "pl_private", "pl_swu"),
    ("MI-03B", "pl_mactan", "pl_lapu_lapu"),
]

print()
for route, orig, dest in checks:
    d = svc.dataset.evaluate_direction(route, orig, dest)
    dirs = svc.dataset.directions_by_route.get(route, [])
    orig_in = any(orig in dr.stop_place_ids for dr in dirs)
    dest_in = any(dest in dr.stop_place_ids for dr in dirs)
    print(f"Route {route:8s} {orig[:20]:20s} -> {dest[:25]:25s}  status={d.status:10s}  orig_in_stops={orig_in}  dest_in_stops={dest_in}")
