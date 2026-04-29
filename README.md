# RUTA Backend

RUTA now ships with a modular Python backend that computes commute answers from the active route graph in PostgreSQL/Supabase. The route engine is deterministic and database-driven. The LLM is limited to two narrow jobs: parsing a user query into structured fields and optionally phrasing the final answer more naturally.

## Architecture Overview

The backend lives under `backend/ruta_backend/` and is split by responsibility:

```text
backend/ruta_backend/
  main.py
  api/
  core/
  models/
  repositories/
  services/
  utils/
```

Main pieces:

- `api/`: FastAPI endpoints for chat, resolve, route, feedback, and health
- `core/`: environment loading, DB client, and shared backend plumbing
- `models/`: domain objects and explicit Pydantic request/response schemas
- `repositories/`: active-schema data access and logging writes
- `services/`: query parser, resolver, route engine, ranker, response builder, formatter, query logger, and chat orchestration
- `utils/`: shared text normalization and scoring helpers

The current FastAPI app is exposed from both:

- `ruta_backend.api:app`
- `ruta_backend.main:app`

## Request Flow

`POST /api/chat` uses this pipeline:

1. Parse the raw message into a typed `ParseResult`
2. Resolve origin and destination against places, clusters, and manual overrides
3. Compute direct or one-transfer routes from the DB graph
4. Build a structured response DTO
5. Optionally phrase the result for the user
6. Log the request and response payload

Supporting endpoints expose parts of that flow directly:

- `POST /api/resolve`: inspect ranked place or cluster matches
- `POST /api/route`: compute a deterministic route from origin and destination text
- `POST /api/feedback`: write route-query feedback
- `GET /api/health`: check API, DB, and Ollama reachability

Compatibility aliases remain available during the transition:

- `GET /healthz`
- `POST /api/route-query`
- `POST /api/route-feedback`

## Why Routing Is Deterministic

The backend does not let the LLM invent jeepney routes or validate graph connectivity. That logic stays in the deterministic route engine and comes only from the active production tables.

The LLM is used only for:

- query parsing into structured fields
- optional final phrasing of an already computed answer

This keeps route validity debuggable, testable, and grounded in the database instead of model guesses.

## Active Tables

The core engine is built around these active tables:

- `public.routes`
- `public.places`
- `public.route_place_links`
- `public.route_transfers`
- `public.area_clusters`
- `public.area_cluster_members`
- `public.manual_overrides`
- `public.query_logs`
- `public.route_query_feedback`

The scraper JSON files in `scrapper/` are treated as import artifacts, not the runtime source of truth.

## Environment

Required:

- `DATABASE_URL` or `SUPABASE_DB_URL`

Optional:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RUTA_SNAPSHOT_TTL_SECONDS`
- `RUTA_BACKEND_URL`

Notes:

- `Settings.from_env()` loads `.env.local` automatically if present.
- `RUTA_BACKEND_URL` is used by the Next.js proxy routes and defaults to `http://127.0.0.1:8000`.
- Ollama is optional. If it is running at `http://127.0.0.1:11434`, the parser and formatter can use it. If not, the backend falls back to deterministic heuristics/templates.

## Migrations And Seeding

Apply the backend migrations:

- `supabase/migrations/20260421010000_create_ruta_response_engine.sql`
- `supabase/migrations/20260421021500_create_route_query_feedback.sql`

Example:

```bash
supabase db push
```

To seed the active tables from the scraper artifacts:

```bash
pip install -r backend/requirements.txt
npm run backend:seed
```

The importer reads the current JSON artifacts in `scrapper/`, including routes, places, route-place links, transfers, and area clusters.

## Run The Backend

Start the API with the existing project script:

```bash
npm run backend:api
```

That currently runs:

```bash
uvicorn ruta_backend.api:app --reload --app-dir backend
```

You can also start the modular entrypoint directly:

```bash
uvicorn ruta_backend.main:app --reload --app-dir backend
```

## Example Requests

Route planning from the structured endpoint:

```bash
curl -X POST http://127.0.0.1:8000/api/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin_text": "IT Park",
    "destination_text": "Carbon",
    "language": "en"
  }'
```

Chat-style request through the full modular pipeline:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Unsay sakyan gikan IT Park padung Carbon?"}'
```

Resolution debugging:

```bash
curl -X POST http://127.0.0.1:8000/api/resolve \
  -H "Content-Type: application/json" \
  -d '{"text":"SM"}'
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

If you want the Next.js app to proxy to the Python backend, keep `RUTA_BACKEND_URL` pointed at the running service and call the app-side API routes instead.

## Testing

Run the backend test suite with:

```bash
npm run backend:test
```

Equivalent direct command:

```bash
PYTHONPATH=backend pytest backend/tests -q
```

Current coverage includes:

- query parser validation and heuristic fallback
- resolver exact-match and cluster fallback behavior
- deterministic direct and transfer route computation
- no-match response construction
- formatter fallback behavior
- query logging and feedback writes
- endpoint coverage for `/api/chat`, `/api/resolve`, `/api/route`, and `/api/feedback`

At the current overhaul checkpoint, the backend suite passes with `53` tests.

## Feedback Regression Workflow

The simulation page writes feedback rows to `public.route_query_feedback`. You can export weak answers into a durable triage file with:

```bash
npm run backend:feedback:seed
```

That workflow reads recent `bad` simulation feedback and writes or merges it into:

- `backend/tests/fixtures/feedback-regressions.seed.json`

Useful guide:

- [docs/feedback-loop.md](/home/iinko/ruta-ai/docs/feedback-loop.md)

## Useful Sample Queries

- `IT Park to Carbon`
- `IT Park to Robinsons Galleria`
- `Bulacao to Mactan Airport`
- `Does 17B pass Cebu Doc?`
- `17B`
