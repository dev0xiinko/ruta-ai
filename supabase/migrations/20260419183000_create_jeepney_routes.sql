create table if not exists public.jeepney_datasets (
  dataset_name text primary key,
  generated_from jsonb not null default '[]'::jsonb,
  route_count integer not null default 0,
  qa_summary jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

create table if not exists public.jeepney_routes (
  dataset_name text not null references public.jeepney_datasets(dataset_name) on delete cascade,
  code text not null,
  label text,
  route_name text,
  origin text,
  destination text,
  qa_status text not null,
  completeness_score integer not null default 0,
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
  warnings jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now(),
  primary key (dataset_name, code),
  constraint jeepney_routes_completeness_score_check
    check (completeness_score >= 0 and completeness_score <= 100)
);

create index if not exists jeepney_routes_code_idx
  on public.jeepney_routes (code);

create index if not exists jeepney_routes_qa_status_idx
  on public.jeepney_routes (qa_status);

create index if not exists jeepney_routes_origin_destination_idx
  on public.jeepney_routes (origin, destination);

create or replace view public.jeepney_routes_ai_ready as
select
  dataset_name,
  code,
  label,
  route_name,
  origin,
  destination,
  qa_status,
  completeness_score,
  source_urls,
  roads,
  schools,
  malls_groceries,
  churches,
  government,
  hotels,
  health,
  terminals,
  info,
  raw_sections,
  warnings,
  imported_at
from public.jeepney_routes
where qa_status in ('high_confidence', 'usable_with_caution');
