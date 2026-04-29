# Project Structure

## Top-Level Intent

The repo now follows a dedicated-backend direction:

- `backend/`: source of truth for route computation, persistence, and backend APIs
- `app/`, `components/`, `hooks/`: frontend UI and Next.js entrypoints
- `lib/server/`: server-only helpers used by Next route handlers and server components
- `lib/ruta/`: frontend-facing route-query contracts, adapters, and API helpers
- `docs/`: architecture notes, migration notes, and operator docs
- `scripts/`: one-off sync and seed tooling
- `supabase/`: schema, seed, and migration artifacts

## Boundaries

### Backend

`backend/ruta_backend/` owns:

- route parsing
- route resolution
- deterministic route computation
- logging
- feedback persistence
- API wiring
- database access

Preferred backend extension points:

- `backend/ruta_backend/api/` for new endpoint wiring
- `backend/ruta_backend/services/` for orchestration and business logic
- `backend/ruta_backend/repositories/` for DB access
- `backend/ruta_backend/models/` for schemas and domain models

### Frontend

The Next.js side should focus on:

- rendering
- user interaction
- calling backend-facing APIs
- server-rendered UI pages
- temporary same-origin compatibility routes

Preferred frontend extension points:

- `components/` for reusable UI
- `app/` for routes, layouts, and server components
- `lib/ruta/api-client.ts` for frontend calls into route-related APIs

### Server-Only Next Modules

Use `lib/server/` for code that must never be treated as browser-safe:

- `lib/server/backend-client.ts`
  Thin dedicated-backend fetch client for Next route handlers
- `lib/server/supabase-admin.ts`
  Server-only Supabase service-role access
- `lib/server/waitlist.ts`
  Waitlist persistence and confirmation workflow
- `lib/server/debug-route-data.ts`
  Debug-page data loading

## Compatibility And Transitional Files

These files remain on purpose, but they are no longer the place for core logic:

- `app/api/route-query/route.ts`
  Thin compatibility proxy for same-origin frontend calls into the dedicated backend
- `app/api/route-query-feedback/route.ts`
  Thin compatibility proxy for feedback submission
- `app/api/waitlist/route.ts`
- `app/api/waitlist/confirm/route.ts`
  Still Next-managed endpoints, but their logic now lives in `lib/server/waitlist.ts`
- `lib/supabase/client.ts`
  Compatibility wrapper that re-exports the explicit server-only admin client

## Legacy Area To Treat Carefully

`lib/ruta-engine/` is now a legacy TypeScript route-engine implementation. It can still be useful for tests, reference logic, or older UI surfaces, but it is not the source of truth for live routing anymore. The dedicated Python backend is the source of truth for route answers.

## Data Flow

Current route-query flow:

1. UI component calls `lib/ruta/api-client.ts`
2. The client hits a same-origin Next route such as `/api/route-query`
3. That route acts as a thin proxy via `lib/server/backend-client.ts`
4. The dedicated Python backend computes the result
5. The Next proxy adapts the backend payload into frontend-friendly DTOs
6. The UI renders the response

Waitlist flow:

1. UI component calls `/api/waitlist`
2. The Next route calls `lib/server/waitlist.ts`
3. The waitlist service uses the server-only Supabase admin client and mailer

## Config Usage

Server-side config is centralized in:

- `lib/config/server.ts`
- `backend/ruta_backend/core/config.py`

Avoid reading server env vars ad hoc in route handlers or UI-adjacent modules. Add new server config in these centralized modules first, then import from there.
