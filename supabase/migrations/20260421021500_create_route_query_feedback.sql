create table if not exists public.route_query_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  session_id text,
  page_context text not null default 'simulation',
  raw_query text not null,
  feedback_verdict text not null check (feedback_verdict in ('good', 'bad')),
  feedback_notes text,
  response_mode text,
  response_title text,
  response_confidence text,
  response_payload jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists route_query_feedback_created_at_idx
  on public.route_query_feedback (created_at desc);

create index if not exists route_query_feedback_verdict_idx
  on public.route_query_feedback (feedback_verdict);

create index if not exists route_query_feedback_page_context_idx
  on public.route_query_feedback (page_context);
