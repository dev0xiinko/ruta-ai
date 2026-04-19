alter table if exists public.route_places
  add column if not exists type text,
  add column if not exists barangay text,
  add column if not exists parent_place_id uuid references public.route_places(id) on delete set null,
  add column if not exists importance_rank integer not null default 0,
  add column if not exists related_place_ids jsonb not null default '[]'::jsonb,
  add column if not exists normalized_name text;

update public.route_places
set normalized_name = lower(regexp_replace(canonical_name, '[^a-zA-Z0-9\s-]+', ' ', 'g'))
where normalized_name is null;

create index if not exists route_places_normalized_name_idx
  on public.route_places (normalized_name);

create index if not exists route_places_parent_place_id_idx
  on public.route_places (parent_place_id);

alter table if exists public.route_place_aliases
  add column if not exists normalized_alias text,
  add column if not exists alias_kind text,
  add column if not exists confidence_score double precision not null default 1;

update public.route_place_aliases
set normalized_alias = lower(regexp_replace(alias, '[^a-zA-Z0-9\s-]+', ' ', 'g'))
where normalized_alias is null;

create index if not exists route_place_aliases_normalized_alias_idx
  on public.route_place_aliases (normalized_alias);

create index if not exists route_place_aliases_alias_kind_idx
  on public.route_place_aliases (alias_kind);

create table if not exists public.route_variants (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null references public.jeepney_datasets(dataset_name) on delete cascade,
  route_code text not null,
  variant_key text not null,
  display_name text not null,
  direction text,
  signboard text,
  origin_place_id uuid references public.route_places(id) on delete set null,
  destination_place_id uuid references public.route_places(id) on delete set null,
  qa_status text not null default 'usable_with_caution',
  confidence_score double precision not null default 0,
  source_urls jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (dataset_name, variant_key)
);

create index if not exists route_variants_route_code_idx
  on public.route_variants (route_code);

create index if not exists route_variants_origin_destination_idx
  on public.route_variants (origin_place_id, destination_place_id);

create table if not exists public.route_variant_map_refs (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.route_variants(id) on delete cascade,
  page_url text not null,
  google_map_url text,
  embed_url text,
  map_id text,
  center_ll text,
  span text,
  iwloc text,
  map_title text,
  source text not null default 'cebujeepneys.weebly.com',
  created_at timestamptz not null default now(),
  unique (variant_id, page_url)
);

create index if not exists route_variant_map_refs_map_id_idx
  on public.route_variant_map_refs (map_id);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  display_name text not null,
  place_id uuid references public.route_places(id) on delete set null,
  latitude double precision,
  longitude double precision,
  stop_type text,
  city text,
  barangay text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists route_stops_place_id_idx
  on public.route_stops (place_id);

create index if not exists route_stops_stop_type_idx
  on public.route_stops (stop_type);

create table if not exists public.route_variant_stop_order (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.route_variants(id) on delete cascade,
  stop_id uuid not null references public.route_stops(id) on delete cascade,
  stop_order integer not null,
  is_pickup boolean not null default true,
  is_dropoff boolean not null default true,
  raw_text text,
  source_section text,
  created_at timestamptz not null default now(),
  unique (variant_id, stop_order),
  unique (variant_id, stop_id, stop_order)
);

create index if not exists route_variant_stop_order_variant_id_idx
  on public.route_variant_stop_order (variant_id);

create index if not exists route_variant_stop_order_stop_id_idx
  on public.route_variant_stop_order (stop_id);

create table if not exists public.route_place_bindings (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null references public.jeepney_datasets(dataset_name) on delete cascade,
  route_code text not null,
  variant_id uuid references public.route_variants(id) on delete set null,
  raw_text text not null,
  normalized_text text not null,
  primary_place_id uuid references public.route_places(id) on delete set null,
  matched_place_ids jsonb not null default '[]'::jsonb,
  match_method text not null default 'exact_or_alias',
  match_confidence double precision not null default 0,
  order_hint integer,
  source_section text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists route_place_bindings_dataset_route_idx
  on public.route_place_bindings (dataset_name, route_code);

create index if not exists route_place_bindings_variant_id_idx
  on public.route_place_bindings (variant_id);

create index if not exists route_place_bindings_primary_place_id_idx
  on public.route_place_bindings (primary_place_id);

create index if not exists route_place_bindings_normalized_text_idx
  on public.route_place_bindings (normalized_text);

create table if not exists public.route_transfers (
  id uuid primary key default gen_random_uuid(),
  from_stop_id uuid not null references public.route_stops(id) on delete cascade,
  to_stop_id uuid not null references public.route_stops(id) on delete cascade,
  walk_distance_meters integer,
  transfer_type text not null default 'walk',
  confidence_score double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists route_transfers_from_stop_id_idx
  on public.route_transfers (from_stop_id);

create index if not exists route_transfers_to_stop_id_idx
  on public.route_transfers (to_stop_id);

create or replace view public.route_variants_ai_ready as
select
  id,
  dataset_name,
  route_code,
  variant_key,
  display_name,
  direction,
  signboard,
  origin_place_id,
  destination_place_id,
  qa_status,
  confidence_score,
  source_urls,
  warnings,
  raw_summary,
  imported_at
from public.route_variants
where qa_status in ('high_confidence', 'usable_with_caution');
