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
  created_at timestamptz not null default now(),
  unique (place_id, alias)
);

create index if not exists route_place_aliases_alias_idx
  on public.route_place_aliases (alias);
