# RUTA Feedback Loop

This document explains how RUTA uses simulation feedback to improve route answers over time.

The goal is simple:

- collect real QA prompts
- mark whether the answer was useful
- save reviewer notes
- export bad answers into durable regression seeds
- use those seeds to improve the engine, importer, overrides, and tests

## Why this exists

RUTA is a deterministic Cebu route assistant, not an LLM route planner.

That means the quality of the answer depends on:

- the imported route data
- place resolution and alias handling
- route and transfer scoring
- response formatting

When an answer is wrong, the best fix usually belongs in one of those layers. The feedback loop helps us find the right layer quickly instead of guessing.

## Main pieces

### Simulation page

The QA interface lives at:

- `/simulation`

It lets you:

- ask commuter-style prompts
- review the current answer
- mark the answer as `Good answer` or `Needs work`
- add notes about what was right or wrong

Relevant files:

- [app/simulation/page.tsx](/home/iinko/ruta-ai/app/simulation/page.tsx)
- [components/ruta/route-simulation-panel.tsx](/home/iinko/ruta-ai/components/ruta/route-simulation-panel.tsx)

### Feedback API flow

Frontend feedback is posted to:

- `POST /api/route-query-feedback`

That Next.js route proxies the request to the Python backend:

- `POST /api/route-feedback`

Relevant files:

- [app/api/route-query-feedback/route.ts](/home/iinko/ruta-ai/app/api/route-query-feedback/route.ts)
- [backend/ruta_backend/api.py](/home/iinko/ruta-ai/backend/ruta_backend/api.py)
- [backend/ruta_backend/service.py](/home/iinko/ruta-ai/backend/ruta_backend/service.py)
- [backend/ruta_backend/repository.py](/home/iinko/ruta-ai/backend/ruta_backend/repository.py)

### Feedback storage

Simulation feedback is stored in:

- `public.route_query_feedback`

Migration:

- [supabase/migrations/20260421021500_create_route_query_feedback.sql](/home/iinko/ruta-ai/supabase/migrations/20260421021500_create_route_query_feedback.sql)

Important columns:

- `session_id`
- `page_context`
- `raw_query`
- `feedback_verdict`
- `feedback_notes`
- `response_mode`
- `response_title`
- `response_confidence`
- `response_payload`
- `created_at`

The important part is `response_payload`: it stores the actual answer payload that the user saw, so later review can compare the bad answer against the expected commuter truth.

## Feedback lifecycle

### 1. Ask a real commuter prompt

Examples:

- `JY to ACT`
- `IT Park to Robinsons Galleria`
- `Does 17B pass Cebu Doc?`
- `USC TC to USC Main`

### 2. Mark the answer

Use:

- `good` when the answer is practical and commuter-correct
- `bad` when the answer is wrong, misleading, or too weak

### 3. Add reviewer notes

Keep notes specific and commuter-grounded.

Good notes:

- `17B is better here because it passes near ACT by SSS`
- `04B is outdated for this trip`
- `Needs transfer instead of no match`

Weak notes:

- `wrong`
- `not good`

### 4. Export bad feedback into regression seeds

Run:

```bash
npm run backend:feedback:seed
```

This command reads recent `bad` feedback rows from `public.route_query_feedback` and writes them into:

- [backend/tests/fixtures/feedback-regressions.seed.json](/home/iinko/ruta-ai/backend/tests/fixtures/feedback-regressions.seed.json)

Implementation file:

- [backend/ruta_backend/feedback_loop.py](/home/iinko/ruta-ai/backend/ruta_backend/feedback_loop.py)

### 5. Review and curate the seed file

Each exported item contains:

- `seed_id`
- `status`
- `source`
- `query`
- `notes`
- `current_response`
- `suggested_assertions`
- `expected`

Example shape:

```json
{
  "seed_id": "feedback:bec9e992-4a5f-4eb6-9159-6165fd5c7747",
  "status": "triage",
  "query": "JY to ACT",
  "notes": "17B from JY to ACT, you drop off in SSS which is near ACT",
  "current_response": {
    "response_type": "trip_search",
    "query_kind": "trip_search",
    "confidence": "Medium confidence",
    "route_codes": ["04L", "04M", "04B"],
    "answer": "From JY to ACT, ride 04L..."
  },
  "suggested_assertions": [],
  "expected": {}
}
```

### 6. Add human review fields

The exporter preserves these manual fields across reruns:

- `status`
- `expected`
- `owner_notes`

That means you can rerun the exporter without losing review work.

Suggested status flow:

- `triage`
- `approved`
- `fixed`
- `wont_fix`

### 7. Turn approved cases into tests

Once the commuter-correct outcome is clear, add an `expected` block and promote the case into pytest coverage.

Current seed export tests live in:

- [backend/tests/test_feedback_loop.py](/home/iinko/ruta-ai/backend/tests/test_feedback_loop.py)

The current exporter does not yet auto-run the seed file as a live regression suite, but it is already structured for that next step.

## How to classify bad feedback

Use these buckets during review:

### Alias issue

The prompt used Cebu shorthand that the resolver missed.

Examples:

- `JY`
- `Cebu Doc`
- `Rob Galleria`
- `E-Mall`

Likely fix:

- `manual_overrides`
- alias resolver logic

### Place resolution issue

The resolver picked the wrong place among several candidates.

Likely fix:

- candidate scoring in the engine

### Route link issue

A route is linked too strongly or too weakly to a place.

Likely fix:

- importer rules
- cleanup sync
- route-place link confidence handling

### Transfer issue

The engine should have suggested a transfer instead of failing or forcing a bad one-seat ride.

Likely fix:

- transfer scoring
- fallback planner

### Response wording issue

The route idea is acceptable, but the answer is confusing or too robotic.

Likely fix:

- response builder / frontend formatter

### Dataset issue

The source data itself is incomplete, stale, or wrong.

Likely fix:

- scraper
- seed artifacts
- manual correction tables

## Recommended weekly workflow

### Daily or per QA session

1. Test prompts in `/simulation`
2. Mark bad answers
3. Write clear notes

### After collecting feedback

1. Run `npm run backend:feedback:seed`
2. Review the generated JSON
3. Group repeated bad prompts
4. Decide which layer needs the fix

### After each fix

1. Re-test the same prompts
2. Update seed `status`
3. Add or expand pytest coverage

## Commands

### Export bad feedback from simulation

```bash
npm run backend:feedback:seed
```

### Export with custom options

```bash
PYTHONPATH=backend python3 -m ruta_backend.feedback_loop --verdict bad --page-context simulation --limit 100
```

### Run backend tests

```bash
npm run backend:test
```

## Current limitations

- feedback seeds are exported for review, not automatically enforced yet
- reviewer notes are still free-text, not structured failure tags
- the same bad prompt may appear multiple times until manually grouped or resolved
- good feedback is stored, but the exporter currently focuses on `bad` feedback because it is more useful for regressions

## Best practices for reviewers

- write notes like a Cebu commuter, not like a database analyst
- mention the better route code when you know it
- mention whether the fix is direct, nearby, or transfer-based
- include landmark truth when possible
- avoid vague comments

Good example:

- `17B or 17C is better from IT Park to Colon; 04B is outdated here`

Weak example:

- `Answer bad`

## Next logical improvement

The next step after this document is to add a pytest harness that reads only curated `approved` seeds from `backend/tests/fixtures/feedback-regressions.seed.json` and executes them as live regression tests against the current engine.
