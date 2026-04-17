# Cebu jeepney route dataset starter

Included files:
- `scrape_cebu_jeepneys.py` — Python scraper you can run locally
- `cebu_jeepney_routes_seed.json` — starter JSON with indexed route codes + a few parsed examples

Notes:
- This is a community-data starter, not an official LTFRB/CCPO transport feed.
- Public sources can change their HTML at any time.
- Before production use, you should validate:
  - exact termini
  - one-way vs two-way behavior
  - franchise updates / reroutes
  - modern jeepney variants
  - fare tables

Recommended next step:
- run the scraper
- manually QA each code
- enrich each route with:
  - aliases
  - major landmarks
  - polygons / polylines
  - transfer points
  - fare brackets
  - operating hours