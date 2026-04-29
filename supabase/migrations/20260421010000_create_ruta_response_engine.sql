create table if not exists public.routes (
  route_id text primary key,
  code text not null unique,
  label text,
  route_name text,
  origin text,
  destination text,
  source_urls jsonb not null default '[]'::jsonb,
  roads jsonb not null default '[]'::jsonb,
  schools jsonb not null default '[]'::jsonb,
  malls_groceries jsonb not null default '[]'::jsonb,
  churches jsonb not null default '[]'::jsonb,
  government jsonb not null default '[]'::jsonb,
  hotels jsonb not null default '[]'::jsonb,
  health jsonb not null default '[]'::jsonb,
  terminals jsonb not null default '[]'::jsonb,
  info jsonb not null default '[]'::jsonb,
  raw_sections jsonb not null default '{}'::jsonb,
  aliases jsonb not null default '{}'::jsonb,
  road_segments jsonb not null default '[]'::jsonb,
  stops jsonb not null default '[]'::jsonb,
  search_text text not null default '',
  embedding_text text not null default '',
  area_clusters jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routes_code_idx on public.routes (code);
create index if not exists routes_route_name_idx on public.routes (lower(route_name));
create index if not exists routes_origin_destination_idx on public.routes (lower(origin), lower(destination));
create index if not exists routes_area_clusters_gin_idx on public.routes using gin (area_clusters jsonb_path_ops);

create table if not exists public.places (
  place_id text primary key,
  name text not null,
  canonical_name text not null,
  normalized_name text not null,
  type text not null,
  aliases jsonb not null default '[]'::jsonb,
  normalized_aliases jsonb not null default '[]'::jsonb,
  address text,
  address_aliases jsonb not null default '[]'::jsonb,
  street text,
  barangay text,
  city text not null default 'Cebu City',
  province text not null default 'Cebu',
  lat double precision,
  lng double precision,
  source_route_codes jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  area_clusters jsonb not null default '[]'::jsonb,
  search_text text not null default '',
  embedding_text text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_normalized_name_idx on public.places (normalized_name);
create index if not exists places_name_idx on public.places (lower(name));
create index if not exists places_type_idx on public.places (type);
create index if not exists places_normalized_aliases_gin_idx on public.places using gin (normalized_aliases jsonb_path_ops);
create index if not exists places_area_clusters_gin_idx on public.places using gin (area_clusters jsonb_path_ops);

create table if not exists public.route_place_links (
  link_id text primary key,
  route_id text not null references public.routes(route_id) on delete cascade,
  place_id text not null references public.places(place_id) on delete cascade,
  relation text not null,
  source_field text not null,
  dropoff_stop text,
  walk_minutes integer,
  distance_m double precision,
  confidence text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (route_id, place_id, relation, source_field)
);

create index if not exists route_place_links_route_id_idx on public.route_place_links (route_id);
create index if not exists route_place_links_place_id_idx on public.route_place_links (place_id);
create index if not exists route_place_links_relation_idx on public.route_place_links (relation);
create index if not exists route_place_links_route_place_relation_idx
  on public.route_place_links (route_id, place_id, relation);

create table if not exists public.route_transfers (
  transfer_id text primary key,
  route_id text not null references public.routes(route_id) on delete cascade,
  connects_to_route_id text not null references public.routes(route_id) on delete cascade,
  shared_places jsonb not null default '[]'::jsonb,
  shared_areas jsonb not null default '[]'::jsonb,
  transfer_reason text not null,
  confidence text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (route_id, connects_to_route_id, transfer_reason)
);

create index if not exists route_transfers_route_id_idx on public.route_transfers (route_id);
create index if not exists route_transfers_connects_to_idx on public.route_transfers (connects_to_route_id);

create table if not exists public.area_clusters (
  cluster_id text primary key,
  name text not null,
  aliases jsonb not null default '[]'::jsonb,
  normalized_aliases jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists area_clusters_name_idx on public.area_clusters (lower(name));
create index if not exists area_clusters_aliases_gin_idx on public.area_clusters using gin (normalized_aliases jsonb_path_ops);

create table if not exists public.area_cluster_members (
  membership_id text primary key,
  cluster_id text not null references public.area_clusters(cluster_id) on delete cascade,
  place_id text not null references public.places(place_id) on delete cascade,
  place_name text not null,
  place_type text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (cluster_id, place_id)
);

create index if not exists area_cluster_members_cluster_id_idx on public.area_cluster_members (cluster_id);
create index if not exists area_cluster_members_place_id_idx on public.area_cluster_members (place_id);

create table if not exists public.manual_overrides (
  override_id uuid primary key default gen_random_uuid(),
  override_type text not null,
  match_key text not null,
  normalized_match_key text not null,
  target_place_id text references public.places(place_id) on delete cascade,
  target_cluster_id text references public.area_clusters(cluster_id) on delete cascade,
  target_route_id text references public.routes(route_id) on delete cascade,
  priority integer not null default 100,
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_overrides_lookup_idx
  on public.manual_overrides (override_type, normalized_match_key, priority desc)
  where is_active = true;

create table if not exists public.query_logs (
  query_log_id uuid primary key default gen_random_uuid(),
  raw_query text not null,
  query_kind text not null,
  parsed_origin text,
  parsed_destination text,
  parsed_route_code text,
  matched_place_ids jsonb not null default '[]'::jsonb,
  matched_cluster_ids jsonb not null default '[]'::jsonb,
  chosen_routes jsonb not null default '[]'::jsonb,
  confidence double precision not null default 0,
  response_type text not null,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists query_logs_created_at_idx on public.query_logs (created_at desc);
create index if not exists query_logs_response_type_idx on public.query_logs (response_type);
