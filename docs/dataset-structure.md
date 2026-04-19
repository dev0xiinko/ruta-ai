# RUTA Dataset Structure

This document describes the current dataset structure used by RUTA as of the rule-based routing refactor.

It covers:

- the persisted Supabase tables
- the route seed shape stored in Postgres
- the place alias data used for canonical landmark resolution
- the normalized runtime route model the app builds before matching queries

This is the current production-oriented structure. It is not the future full GTFS-like mapping model.

## Overview

The current system has two layers:

1. Storage layer in Supabase/Postgres
2. Runtime normalization layer in the app

The storage layer keeps the scraped and validated Cebu jeepney route dataset mostly as categorized text arrays.

The runtime layer converts those rows into a deterministic routing model with:

- canonical place resolution
- normalized signboards
- ordered stops
- route confidence
- candidate scoring

## Storage Layer

### `public.jeepney_datasets`

High-level metadata about an imported route dataset.

Defined in [20260419183000_create_jeepney_routes.sql](/home/iinko/ruta-ai/supabase/migrations/20260419183000_create_jeepney_routes.sql).

| Column | Type | Notes |
| --- | --- | --- |
| `dataset_name` | `text` | Primary key. Example: `cebu_jeepney_routes` |
| `generated_from` | `jsonb` | Source URLs used to generate the dataset |
| `route_count` | `integer` | Number of routes in the dataset |
| `qa_summary` | `jsonb` | QA bucket counts like `high_confidence`, `usable_with_caution`, `partial` |
| `imported_at` | `timestamptz` | Import timestamp |

Example row:

```json
{
  "dataset_name": "cebu_jeepney_routes",
  "generated_from": [
    "https://cebujeepneys.weebly.com/jeepney-routes.html",
    "https://ph.commutetour.com/travel/transport/jeep/cebu-city-jeep-route-code/"
  ],
  "route_count": 66,
  "qa_summary": {
    "high_confidence": 61,
    "usable_with_caution": 2,
    "partial": 3
  }
}
```

### `public.jeepney_routes`

This is the main route dataset table.

Each row currently represents one route code entry inside a dataset.

Important: this is still a semi-structured source table, not a true stop-by-stop transit model.

| Column | Type | Notes |
| --- | --- | --- |
| `dataset_name` | `text` | Foreign key to `jeepney_datasets.dataset_name` |
| `code` | `text` | Route code like `17B`, `13B`, `MI-03A` |
| `label` | `text` | Usually same as code |
| `route_name` | `text` | Human-readable route name |
| `origin` | `text` | Best known starting point |
| `destination` | `text` | Best known destination |
| `qa_status` | `text` | QA bucket like `high_confidence`, `usable_with_caution`, `partial` |
| `completeness_score` | `integer` | 0-100 completeness estimate |
| `source_urls` | `jsonb` | URLs used for that row |
| `roads` | `jsonb` | Array of roads or corridor clues |
| `schools` | `jsonb` | Array of school landmarks |
| `malls_groceries` | `jsonb` | Array of mall and grocery landmarks |
| `churches` | `jsonb` | Array of church landmarks |
| `government` | `jsonb` | Array of government landmarks |
| `hotels` | `jsonb` | Array of hotel landmarks |
| `health` | `jsonb` | Array of health-related landmarks |
| `terminals` | `jsonb` | Array of terminal or hub landmarks |
| `info` | `jsonb` | Free-form route text snippets |
| `raw_sections` | `jsonb` | Category-to-text mapping from the original parsed source |
| `warnings` | `jsonb` | Known issues for the row |
| `imported_at` | `timestamptz` | Import timestamp |

Example simplified row:

```json
{
  "dataset_name": "cebu_jeepney_routes",
  "code": "17B",
  "label": "17B",
  "route_name": "Apas to Carbon",
  "origin": "Apas",
  "destination": "Carbon",
  "qa_status": "high_confidence",
  "completeness_score": 89,
  "roads": ["Gorordo Ave", "Legaspi St", "Magallanes St"],
  "schools": [
    "Camp Lapu Lapu Elementary School",
    "University of San Carlos Main Campus",
    "University of San Jose Recoletos"
  ],
  "malls_groceries": [
    "Carbon Public Market",
    "Colonnade Supermarket",
    "Robinsons Place"
  ],
  "terminals": [],
  "info": [
    "Apas - IT Park - Salinas Drive - Gorordo Ave. - Fuente - Colon - Carbon"
  ],
  "warnings": []
}
```

### `public.jeepney_routes_ai_ready`

This is a filtered view used by the app.

It includes only rows where:

- `qa_status = 'high_confidence'`
- or `qa_status = 'usable_with_caution'`

It excludes `partial` rows from the default routing engine.

## Place Mapping Layer

### `public.route_places`

Known canonical places used for place resolution and schematic map support.

Defined in [20260419210000_create_route_places.sql](/home/iinko/ruta-ai/supabase/migrations/20260419210000_create_route_places.sql).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `canonical_name` | `text` | Unique place name |
| `city` | `text` | Usually `Cebu` |
| `latitude` | `double precision` | Approximate coordinate |
| `longitude` | `double precision` | Approximate coordinate |
| `source` | `text` | Seed source label |
| `created_at` | `timestamptz` | Insert timestamp |

Examples:

- `IT Park`
- `Ayala`
- `Carbon`
- `University of San Carlos Main Campus`
- `University of San Carlos Talamban Campus`

### `public.route_place_aliases`

Alias table for resolving casual user input to a canonical place.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `place_id` | `uuid` | FK to `route_places.id` |
| `alias` | `text` | Search alias like `usc main`, `it park`, `act`, `cit-u` |
| `created_at` | `timestamptz` | Insert timestamp |

Examples:

- `it park` -> `IT Park`
- `ayala center` -> `Ayala`
- `usc tc` -> `University of San Carlos Talamban Campus`
- `usc main` -> `University of San Carlos Main Campus`
- `cit-u` -> `Cebu Institute of Technology University CITU`

## Seed Files

### `supabase/seed.sql`

This file stores the route dataset insert statements.

It currently contains:

- one `jeepney_datasets` upsert
- many `jeepney_routes` upserts

Generated from:

- scraper validation output
- manually validated category extraction

### `supabase/seed.mapping.sql`

This file stores:

- canonical places
- aliases for known landmarks and schools

It is used for:

- place resolution
- schematic map support
- commuter-oriented landmark normalization

## Runtime Normalization Layer

The rule-based engine does not match directly on raw DB rows anymore.

Instead, it builds a structured runtime model from `jeepney_routes_ai_ready`.

Defined in [types.ts](/home/iinko/ruta-ai/lib/ruta-engine/types.ts) and assembled in [route-model.ts](/home/iinko/ruta-ai/lib/ruta-engine/route-model.ts).

### `RouteRecord`

This mirrors a row from `jeepney_routes_ai_ready`.

It is the raw runtime representation of a Supabase row.

```ts
type RouteRecord = {
  dataset_name: string;
  code: string;
  label: string | null;
  route_name: string | null;
  origin: string | null;
  destination: string | null;
  qa_status: string;
  completeness_score: number;
  source_urls: string[];
  roads: string[];
  schools: string[];
  malls_groceries: string[];
  churches: string[];
  government: string[];
  hotels: string[];
  health: string[];
  terminals: string[];
  info: string[];
  raw_sections: Record<string, string>;
  warnings: string[];
  imported_at: string;
};
```

### `PlaceEntity`

Canonical resolved place used by the deterministic matcher.

```ts
type PlaceEntity = {
  canonicalName: string;
  displayName: string;
  normalizedCanonical: string;
  aliases: string[];
  sourceKinds: string[];
};
```

This lets the app treat:

- `usc tc`
- `usc talamban`
- `University of San Carlos Talamban Campus`

as the same place during matching.

### `StructuredStop`

Ordered stop used for route direction validation.

```ts
type StructuredStop = {
  name: string;
  canonicalName: string;
  key: string;
  order: number;
};
```

This is built from:

- `origin`
- `destination`
- extracted place mentions inside `info`
- extracted place mentions inside `raw_sections`

### `StructuredRoute`

This is the core deterministic route model used by the engine.

```ts
type StructuredRoute = {
  routeId: string;
  code: string;
  signboard: string;
  start: string | null;
  end: string | null;
  landmarks: string[];
  roads: string[];
  stops: StructuredStop[];
  confidence: number;
  aliases: string[];
  landmarkKeys: string[];
  raw: RouteRecord;
};
```

Notes:

- `routeId` is derived from code + origin + destination
- `signboard` is built from `route_name` first, then fallback start/end
- `landmarks` are deduplicated commuter-facing place names
- `stops` are used for order-aware trip validation
- `confidence` is computed deterministically from QA status, completeness, warnings, and stop quality

Example target shape:

```json
{
  "routeId": "17b_apas_carbon",
  "code": "17B",
  "signboard": "Apas to Carbon",
  "start": "Apas",
  "end": "Carbon Market",
  "landmarks": [
    "Apas",
    "Colonnade Supermarket",
    "Escario Central Mall",
    "Jy Square Mall",
    "Robinsons Place"
  ],
  "roads": [
    "Gorordo Ave",
    "Legaspi St",
    "Magallanes St"
  ],
  "stops": [
    { "name": "Apas", "canonicalName": "Apas", "key": "apas", "order": 1 },
    { "name": "Cebu IT Park", "canonicalName": "IT Park", "key": "it park", "order": 2 },
    { "name": "Fuente", "canonicalName": "Fuente Osmena", "key": "fuente osmena", "order": 3 },
    { "name": "Colon", "canonicalName": "Colon", "key": "colon", "order": 4 },
    { "name": "Carbon Market", "canonicalName": "Carbon", "key": "carbon", "order": 5 }
  ],
  "confidence": 0.89
}
```

## Query and Matching Model

The current app supports deterministic query types:

- route code lookup
- place-to-place trip query
- destination check
- place-based route shortlist

Defined in [query-parser.ts](/home/iinko/ruta-ai/lib/ruta-engine/query-parser.ts):

```ts
type ParsedQuery =
  | { type: "route_code"; raw: string; code: string; searchText: string }
  | { type: "place_to_place"; raw: string; originText: string; destinationText: string }
  | { type: "destination_check"; raw: string; routeCode: string | null; targetText: string }
  | { type: "place_search"; raw: string; placeText: string }
  | { type: "unknown"; raw: string };
```

The matcher then scores structured route candidates using:

- exact code match
- signboard match
- origin match
- destination match
- direction match
- landmark match
- route confidence

Important:

- a route is not considered a valid direct trip just because it contains both places
- origin must come before destination in ordered `stops`

## Current Limitations

The current dataset is still not a full transit model.

Known limitations:

1. Some route rows still have noisy `origin`, `destination`, `roads`, or `info` values.
2. Ordered stops are inferred from text, not sourced from a validated stop table yet.
3. The map layer is still schematic and should not be treated as exact routing geometry.
4. Some place-based results may still depend on imperfect source text quality even though matching is now deterministic.

## Recommended Next Step

If the goal is even more reliable routing, the next schema improvement should be a true stop-based route model with:

- route variants
- stop table
- route stop order table
- transfer support
- shape geometry

For now, the current structure is:

- good enough for deterministic code lookup
- good enough for conservative landmark-based trip matching
- not yet a full transit network model
