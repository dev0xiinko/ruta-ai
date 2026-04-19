-- Proposed mapping data model for future RUTA route visualization and routing.
-- This file is a design artifact and is not applied automatically.

create table if not exists public.route_places (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  city text,
  latitude double precision not null,
  longitude double precision not null,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.route_place_aliases (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.route_places(id) on delete cascade,
  alias text not null,
  unique (place_id, alias)
);

create table if not exists public.route_variants (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null references public.jeepney_datasets(dataset_name) on delete cascade,
  route_code text not null,
  canonical_label text,
  direction text,
  qa_status text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (dataset_name, route_code, coalesce(direction, ''))
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.route_variants(id) on delete cascade,
  place_id uuid references public.route_places(id) on delete set null,
  stop_name text not null,
  stop_order integer not null,
  latitude double precision,
  longitude double precision,
  confidence numeric(4,3),
  created_at timestamptz not null default now(),
  unique (variant_id, stop_order)
);

create table if not exists public.route_shapes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.route_variants(id) on delete cascade,
  shape_name text,
  geometry_geojson jsonb not null,
  source text,
  confidence numeric(4,3),
  created_at timestamptz not null default now()
);

create table if not exists public.transfer_points (
  id uuid primary key default gen_random_uuid(),
  from_variant_id uuid not null references public.route_variants(id) on delete cascade,
  to_variant_id uuid not null references public.route_variants(id) on delete cascade,
  place_id uuid references public.route_places(id) on delete set null,
  transfer_name text not null,
  latitude double precision,
  longitude double precision,
  walk_minutes integer,
  confidence numeric(4,3),
  created_at timestamptz not null default now()
);

create table if not exists public.route_fares (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.route_variants(id) on delete cascade,
  vehicle_type text not null,
  minimum_fare numeric(10,2),
  fare_notes text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists route_stops_variant_order_idx
  on public.route_stops (variant_id, stop_order);

create index if not exists transfer_points_variant_idx
  on public.transfer_points (from_variant_id, to_variant_id);
