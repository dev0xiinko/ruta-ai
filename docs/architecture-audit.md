# Architecture Audit

## Current Shape

The repository is now split across two delivery models:

- A dedicated Python backend in `backend/ruta_backend/`
- A Next.js frontend in `app/`, `components/`, and `lib/`

The backend already contains the main route-query architecture:

- `backend/ruta_backend/api/`
- `backend/ruta_backend/core/`
- `backend/ruta_backend/repositories/`
- `backend/ruta_backend/services/`
- `backend/ruta_backend/models/`
- `backend/tests/`

The frontend is still carrying several serverless-era and backend-shaped responsibilities:

- large framework route handlers in `app/api/route-query/route.ts` and `app/api/route-query-feedback/route.ts`
- direct Supabase admin access in `app/api/waitlist/route.ts`, `app/api/waitlist/confirm/route.ts`, `app/debug/page.tsx`, and `lib/ruta-map.ts`
- scattered raw `fetch()` calls from UI components
- a legacy TypeScript route engine in `lib/ruta-engine/` that overlaps conceptually with the Python backend

## Classification

### Frontend-only

- `app/` pages and layouts
- `components/`
- `hooks/`
- `styles/`
- most of `lib/utils.ts`

### Backend-only

- `backend/ruta_backend/`
- `backend/tests/`
- migration/import/feedback scripts under `backend/ruta_backend/`

### Shared or frontend contract surface

- request and response DTOs used by the frontend route/query UI
- route-bot presentation types in `lib/ruta/bot-response.ts`
- backend URL / app URL configuration values

These should stay minimal and intentional. The frontend should share DTO-style shapes, not backend internals.

### Legacy / serverless leftovers

- `app/api/route-query/route.ts`
  It is a valid compatibility proxy, but it currently contains a large response-adaptation layer and too much request-specific business shaping.
- `app/api/route-query-feedback/route.ts`
  This is a reasonable proxy, but config and backend call logic are still inline.
- `app/api/waitlist/route.ts` and `app/api/waitlist/confirm/route.ts`
  These are still real server-side business endpoints living inside the frontend app.
- `app/debug/page.tsx`
  The page is UI, but it also owns direct DB access and data loading logic.
- `lib/supabase/client.ts`
  This is actually a server-only admin client, not a general frontend client.
- `lib/ruta-engine/`
  This appears to be a previous TypeScript implementation of route logic. It is now transitional and should not be the source of truth for route computation.

## Separation Problems

1. Frontend route handlers still own too much transformation and orchestration logic.
2. Server-only config is read ad hoc from route handlers and utility files.
3. A module named `lib/supabase/client.ts` suggests a safe browser client, but it actually exposes a service-role client and must remain server-only.
4. UI components call framework API routes directly with raw `fetch()` calls instead of using a dedicated frontend API client layer.
5. Debug/admin data access lives inside page files instead of server-only modules.
6. Legacy TypeScript route-engine code still exists alongside the Python backend, which can confuse future contributors about the source of truth.

## Refactor Direction

### Keep

- the Python backend structure under `backend/ruta_backend/`
- the Next.js app for UI, compatibility proxies, and frontend-only flows
- compatibility Next route handlers where the frontend still expects same-origin calls

### Change

1. Centralize server-only and public config access.
2. Move Next route-handler business logic into reusable modules under `lib/ruta/` and `lib/server/`.
3. Convert Next route handlers into thin adapters and proxies.
4. Introduce a small frontend API client so UI components stop owning raw transport details.
5. Move Supabase admin operations behind clearly server-only modules.
6. Document which TypeScript route-engine files are legacy/transitional and keep the Python backend as the source of truth for route answers.

## Planned Low-Risk Steps

1. Add a config layer for backend URL, app URL, and server-only secrets.
2. Move route-query proxy shaping into reusable `lib/ruta/*` modules.
3. Move waitlist and debug DB access into `lib/server/*` modules.
4. Replace scattered UI `fetch()` calls with a small frontend API helper.
5. Add project-structure docs and explicitly mark transitional serverless compatibility files.
