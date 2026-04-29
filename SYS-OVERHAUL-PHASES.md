You are working inside the existing RUTA repository. Your job is to REBUILD the backend into a clean, modular architecture while preserving the CURRENT ACTIVE DATABASE SCHEMA and reusing useful existing code where possible.

You are NOT building a toy demo.
You are modifying the REAL repo in-place.

High-level goal:
Rebuild the RUTA backend so that:
- route computation is deterministic and database-driven
- the LLM is used only for query parsing and optional natural-language phrasing
- the active production graph tables are the source of truth
- legacy/transitional tables are not the primary engine

Important active DB context you must respect:
Primary active tables:
- public.routes
- public.places
- public.route_place_links
- public.route_transfers
- public.area_clusters
- public.area_cluster_members
- public.manual_overrides
- public.query_logs
- public.route_query_feedback

Do NOT build the core engine around:
- jeepney_routes
- route_variants
- route_stops
- route_variant_stop_order
- route_place_bindings
unless used only as optional future/debug support.

Critical rules:
1. Never let the LLM invent or validate jeepney routes.
2. Deterministic routing must come from DB graph logic.
3. Use LLM only for:
   - parsing the user query into structured fields
   - optionally formatting final human-readable output
4. Prefer extracting and reusing logic from existing files rather than duplicating.
5. Keep changes incremental, testable, and production-oriented.

==================================================
PHASE 0 — INSPECT THE REPO FIRST
==================================================

Before changing anything:
1. Inspect the repo tree.
2. Inspect these files first if they exist:
   - backend/ruta_backend/repository.py
   - backend/ruta_backend/importer.py
   - current API route files
   - current config/settings files
   - current DB client setup
   - current request/response schemas
   - any route simulation/debug page logic
3. Identify:
   - current backend entrypoint
   - current DB access pattern
   - existing models/schemas
   - existing logging behavior
   - existing feedback submission behavior
   - any useful normalization helpers

Then produce a short implementation plan IN COMMENTS or README notes before major edits.

==================================================
PHASE 1 — CREATE TARGET BACKEND STRUCTURE
==================================================

Create or refactor toward this structure, adapting paths if the repo already has equivalent modules:

backend/ruta_backend/
  __init__.py
  main.py
  api/
    __init__.py
    chat.py
    resolve.py
    route.py
    feedback.py
    health.py
  core/
    __init__.py
    config.py
    db.py
    logging.py
  models/
    __init__.py
    domain.py
    schemas.py
  repositories/
    __init__.py
    route_repository.py
    log_repository.py
  services/
    __init__.py
    query_parser.py
    resolver.py
    route_engine.py
    ranker.py
    response_builder.py
    formatter.py
    query_logger.py
  utils/
    __init__.py
    text_normalization.py
    scoring.py
tests/
README.md

If the current repo already has a good package structure, refactor into equivalent modules instead of duplicating directories.

==================================================
PHASE 2 — REFACTOR DATABASE ACCESS
==================================================

Create repository classes around the ACTIVE schema.

Implement in repositories/route_repository.py:
- get_place_candidates_by_text(text: str)
- get_cluster_candidates_by_text(text: str)
- get_manual_override(text: str, override_type: str | None = None)
- get_route_links_for_place_ids(place_ids: list[str])
- get_direct_routes_between_places(origin_place_ids: list[str], destination_place_ids: list[str])
- get_transfer_routes_between_places(origin_place_ids: list[str], destination_place_ids: list[str], max_transfers: int = 1)
- get_cluster_members(cluster_ids: list[str])
- get_routes_by_ids(route_ids: list[str])

Implement in repositories/log_repository.py:
- insert_query_log(...)
- insert_route_query_feedback(...)

Requirements:
- Reuse existing DB client / Supabase access patterns where possible.
- Preserve compatibility with current environment variables.
- Add type hints.
- Add docstrings.

==================================================
PHASE 3 — IMPLEMENT TEXT NORMALIZATION
==================================================

Create utils/text_normalization.py with:
- normalize_text(text: str) -> str
- tokenize_text(text: str) -> list[str]
- maybe_strip_punctuation(text: str) -> str

Behavior:
- lowercase
- trim whitespace
- normalize repeated spaces
- remove punctuation where useful
- keep implementation deterministic and simple

This normalization will be shared by:
- query parser post-processing
- manual override lookup
- place matching
- cluster matching

==================================================
PHASE 4 — IMPLEMENT QUERY PARSER (LLM ONLY)
==================================================

Create services/query_parser.py

Goal:
Convert a raw user query into structured fields:
- intent
- origin_text
- destination_text
- route_code
- language

Requirements:
- Add an Ollama provider abstraction
- Default model: qwen2.5:7b
- Must support a strict JSON-only parsing prompt
- Must explicitly instruct the model:
  - do not invent routes
  - do not answer the commute question
  - only extract structured fields

Return a validated Pydantic model like:
{
  "intent": "route_query",
  "origin_text": "ACT",
  "destination_text": "Cebu Doc",
  "route_code": null,
  "language": "ceb"
}

If parsing fails:
- fall back to heuristic extraction where possible
- return a low-confidence parse result
- never crash the API

==================================================
PHASE 5 — IMPLEMENT RESOLVER
==================================================

Create services/resolver.py

Goal:
Resolve raw user text into ranked place/cluster candidates using:
- manual_overrides
- places
- area_clusters
- area_cluster_members

Implement:
- resolve_text(text: str) -> ResolutionResult
- resolve_origin_destination(origin_text: str, destination_text: str) -> tuple[ResolutionResult, ResolutionResult]

Resolver flow:
1. Normalize text
2. Check manual_overrides first
3. Search place candidates
4. Search cluster candidates
5. Expand cluster members if needed
6. Rank candidates
7. Return:
   - top_match
   - candidates
   - confidence
   - match_type
   - reason

Use confidence tiers:
- high: exact/canonical/strong override
- medium: fuzzy/alias-like/place similarity
- low: cluster/area inference

The resolver must be transparent.
Do not hide uncertainty.

==================================================
PHASE 6 — IMPLEMENT ROUTE ENGINE
==================================================

Create services/route_engine.py

This is the core deterministic engine.

Implement:
- find_direct_routes(origin_resolution, destination_resolution)
- find_transfer_routes(origin_resolution, destination_resolution, max_transfers=1)
- compute_route_options(origin_resolution, destination_resolution)

Direct route logic:
- get all origin-linked routes from route_place_links
- get all destination-linked routes from route_place_links
- intersect route_ids
- score each result using:
  - relation priority: direct_access > nearby_access > area_access
  - lower walk_minutes better
  - lower distance_m better
  - higher confidence better

Transfer route logic:
- find routes reachable from origin
- follow route_transfers
- check whether connected routes reach the destination
- support max 1 transfer first
- optionally structure code so max 2 is possible later

Do NOT hallucinate a route if graph evidence is weak.

==================================================
PHASE 7 — IMPLEMENT RANKER
==================================================

Create services/ranker.py

Implement scoring helpers for:
- place candidate ranking
- route option ranking

Route ranking should prioritize:
1. fewer transfers
2. better access relation
3. lower walking time
4. lower distance
5. higher confidence

Add clear constants instead of magic numbers.

==================================================
PHASE 8 — IMPLEMENT RESPONSE BUILDER
==================================================

Create services/response_builder.py

Convert internal route results into stable API DTOs.

Return structured payloads like:
{
  "status": "success",
  "mode": "direct" | "transfer" | "fallback" | "no_match",
  "origin": {...},
  "destination": {...},
  "options": [
    {
      "rank": 1,
      "route_codes": ["17B"],
      "transfers": 0,
      "legs": [...],
      "confidence": 0.88,
      "why": "Direct route with strong destination access"
    }
  ]
}

If no route is found:
- return a no_match response
- explain whether failure came from weak resolution or no graph path
- do not invent answers

==================================================
PHASE 9 — IMPLEMENT FORMATTER (OPTIONAL LLM PHRASING)
==================================================

Create services/formatter.py

This service may use the LLM to phrase final responses in Cebuano/English/mixed form.

Rules:
- it may rephrase but not alter route facts
- input is structured result only
- if formatter fails, fall back to deterministic template strings

==================================================
PHASE 10 — IMPLEMENT QUERY LOGGER
==================================================

Create services/query_logger.py

On /api/chat, write to query_logs:
- raw_query
- query_kind
- parsed_origin
- parsed_destination
- parsed_route_code
- matched_place_ids
- matched_cluster_ids
- chosen_routes
- confidence
- response_type
- response_payload

On /api/feedback, write to route_query_feedback:
- session_id
- page_context
- raw_query
- feedback_verdict
- feedback_notes
- response_mode
- response_title
- response_confidence
- response_payload
- user_agent

Preserve existing behavior if already implemented, but move it into modular services/repositories.

==================================================
PHASE 11 — BUILD API ENDPOINTS
==================================================

Implement or refactor these endpoints:

1. POST /api/chat
Request:
{
  "message": "unsay sakyan gikan ACT padung Cebu Doc"
}

Flow:
- parse query with query_parser
- resolve origin/destination
- compute routes
- build structured response
- optionally format human answer
- log query
- return response

2. POST /api/resolve
Request:
{
  "text": "SM"
}
Response:
- ranked place/cluster candidates
- match reasons
- confidence

3. POST /api/route
Request:
{
  "origin_text": "ACT",
  "destination_text": "Cebu Doc"
}
or by IDs if convenient.
Response:
- deterministic structured route result
- no LLM phrasing required

4. POST /api/feedback
Writes route_query_feedback

5. GET /api/health
Returns:
- api status
- db status
- optional ollama connectivity status

==================================================
PHASE 12 — DEFINE PYDANTIC SCHEMAS
==================================================

In models/schemas.py define:
- ChatRequest
- ChatResponse
- ResolveRequest
- ResolveResponse
- RouteRequest
- RouteResponse
- FeedbackRequest
- HealthResponse
- ParseResult
- ResolutionCandidate
- ResolutionResult
- RouteLeg
- RouteOption
- RouteComputationResult

Keep schemas explicit and typed.

==================================================
PHASE 13 — REUSE EXISTING CODE CAREFULLY
==================================================

Inspect repository.py and importer.py for logic worth extracting:
- route loading
- query logging
- dataset assumptions
- graph loading helpers

Do NOT blindly delete useful code.
Refactor useful logic into the new repository/service structure.

Also inspect existing frontend/debug endpoints so the rebuilt backend keeps compatibility where sensible.

==================================================
PHASE 14 — TESTS
==================================================

Create tests for:
- query parser JSON validation
- resolver exact place match
- resolver cluster fallback
- direct route computation
- transfer route computation
- no-match behavior
- query logging
- feedback insert path

Use lightweight mocks/stubs where external services are involved.

==================================================
PHASE 15 — README UPDATE
==================================================

Update README with:
- architecture overview
- request flow
- active DB tables used
- why deterministic routing is separate from LLM
- how to run backend
- required env vars
- how to test
- example requests

==================================================
IMPLEMENTATION CONSTRAINTS
==================================================

- Do not add LangChain unless there is a very strong reason.
- Keep the LLM integration thin and explicit.
- Do not use agent loops for routing.
- Deterministic route validity must remain in the route engine.
- Keep code readable and debuggable.
- Prefer real implementations over placeholders.
- Mark unavoidable follow-ups with TODO comments only where necessary.

==================================================
EXPECTED END STATE
==================================================

At the end, the repo should have:
- a modular backend
- active-schema repositories
- deterministic route engine
- LLM-backed parsing and optional phrasing
- logging and feedback wired
- tests
- docs

Now inspect the repo and start implementing incrementally.
At each major step, preserve working behavior where possible.