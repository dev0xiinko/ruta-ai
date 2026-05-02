# RUTA Backend Processing Guide

Version: `ruta-processing-v1`  
Dataset target: `ruta_dataset_v4`

This document defines how the RUTA backend should process a commuter query using the JSON dataset as the source of truth.

---

## 1. Core Principle

RUTA must not let the LLM decide jeepney routes.

Use this rule:

```txt
LLM = understand and explain
JSON dataset = source of truth
Route engine = decide
Validator = block bad answers
User/local validation = improves dataset
```

The LLM may suggest possible routes only as an **unverified candidate**, never as final truth unless the dataset validates it or a human confirms it.

---

## 2. Dataset Files

Expected folder structure:

```txt
/ruta_dataset_v4
  places.json
  routes.json
  route_place_links.json
  route_transfers.json
  walk_links.json
  route_directions.json
  od_truth_table.json
  route_tests.json
  route_scoring.json
  resolver_rules.json
  route_engine_rules.json
  area_clusters.json
  corridors.json
  validated_routes.json
  candidate_routes_needing_validation.json
  validation_report.json
  patch_notes.md
```

### Required roles

| File | Purpose |
|---|---|
| `places.json` | Canonical places, landmarks, aliases, area info |
| `routes.json` | Jeepney route definitions |
| `route_place_links.json` | Which route serves which place |
| `route_transfers.json` | Valid route-to-route transfer edges |
| `walk_links.json` | Valid walking connections between places |
| `route_directions.json` | Direction/headsign/ordered stop logic |
| `od_truth_table.json` | Exact validated origin-destination cases |
| `route_tests.json` | Regression tests |
| `route_scoring.json` | Ranking rules |
| `resolver_rules.json` | Place normalization and ambiguity rules |
| `route_engine_rules.json` | Hard backend rules |
| `candidate_routes_needing_validation.json` | LLM/user-suggested routes not yet verified |

---

## 3. High-Level Request Flow

```txt
User prompt
↓
LLM extracts origin/destination text
↓
Place resolver finds candidate place IDs
↓
Ask user to confirm normalized points
↓
After confirmation, lock origin_place_id and destination_place_id
↓
Check OD truth table
↓
Check walk-only route
↓
Check direct route
↓
Check walk → ride
↓
Check ride → walk
↓
Check 2-hop / 3-hop transfers
↓
Validate route plan
↓
Score candidates
↓
LLM formats final response
↓
Return commuter-friendly answer
```

---

## 4. Step-by-Step Backend Process

---

# Step 1 — Receive User Prompt

Example:

```txt
"gaisano near colon to ACT"
```

Backend receives:

```json
{
  "query": "gaisano near colon to ACT",
  "language_hint": "auto"
}
```

---

# Step 2 — LLM Extracts Intent

The LLM should only extract origin and destination.

Expected LLM output:

```json
{
  "origin_text": "gaisano near colon",
  "destination_text": "ACT",
  "query_language": "en",
  "needs_route_answer": true
}
```

The LLM must not output route codes in this step.

### Prompt rule for LLM extraction

```txt
Extract only origin and destination.
Do not suggest jeepney codes.
Do not answer the commute yet.
Return JSON only.
```

---

# Step 3 — Place Resolver

Use `places.json`, aliases, search text, area clusters, and resolver rules.

Resolver output:

```json
{
  "origin_candidates": [
    {
      "place_id": "pl_gaisano_main_colon",
      "name": "Gaisano Main Colon",
      "confidence": 0.91,
      "match_reason": "alias + near colon"
    },
    {
      "place_id": "pl_gaisano_south",
      "name": "Gaisano Capital South",
      "confidence": 0.42,
      "match_reason": "brand match only"
    }
  ],
  "destination_candidates": [
    {
      "place_id": "pl_act",
      "name": "Asian College of Technology",
      "confidence": 0.98,
      "match_reason": "alias ACT"
    }
  ]
}
```

---

# Step 4 — Always Ask User to Confirm Normalization

Even when confidence is high, ask the user to confirm.

Example response:

```txt
I normalized your points as:

Point A: Gaisano Main Colon
Point B: Asian College of Technology (ACT)

Is this correct?
```

Do not compute route until confirmation.

### Confirmation response options

User may answer:

```txt
yes
```

Then lock the top candidates.

User may correct:

```txt
no, I mean Gaisano South
```

Then rerun resolver with corrected origin.

---

# Step 5 — Lock Place IDs

After confirmation:

```json
{
  "origin_place_id": "pl_gaisano_main_colon",
  "destination_place_id": "pl_act",
  "confirmed_by_user": true
}
```

This is the only point where routing should begin.

---

# Step 6 — Check Exact OD Truth Table First

Use `od_truth_table.json`.

If exact pair exists:

```json
{
  "origin_place_id": "pl_it_park",
  "destination_place_id": "pl_colon",
  "route_type": "direct",
  "routes": ["17B", "17C"],
  "confidence": "high",
  "validated": true
}
```

Return this route plan directly to validation/scoring.

### Why this matters

OD truth table should override fuzzy graph search because it contains user-validated real commuter routes.

---

# Step 7 — Walk-Only Check

Use `walk_links.json` or distance if coordinates exist.

Walk-only route applies when:

```txt
origin and destination are in same micro-area
OR direct walk link exists
OR distance <= walk_threshold_m
```

Recommended threshold:

```txt
walk_threshold_m = 800 to 1200 meters
```

Example:

```json
{
  "type": "walk_only",
  "steps": [
    {
      "mode": "walk",
      "from": "Gaisano Main Colon",
      "to": "ACT",
      "walk_minutes": 5
    }
  ],
  "confidence": "high"
}
```

---

# Step 8 — Direct Route Search

Use `route_place_links.json`.

A direct route is valid only when:

```txt
same route_code has direct_access to origin
AND same route_code has direct_access to destination
AND route_code exists in routes.json
AND confidence is not low
AND direction is valid or direction is unknown but safely confirmable
```

Important rule:

```txt
nearby_access is not direct route.
area_access is not direct route.
```

Example:

```json
{
  "type": "direct",
  "routes": ["10H", "10F", "10M"],
  "steps": [
    {
      "mode": "ride",
      "routes": ["10H", "10F", "10M"],
      "from_place_id": "pl_gaisano_south",
      "to_place_id": "pl_act"
    }
  ],
  "confidence": "high"
}
```

---

# Step 9 — Direction Validation

Use `route_directions.json`.

A route direction is valid when:

```txt
origin appears before destination in the selected direction stop sequence
```

Pseudo-rule:

```ts
function isDirectionValid(direction, originPlaceId, destinationPlaceId) {
  const originIndex = direction.stop_place_ids.indexOf(originPlaceId);
  const destIndex = direction.stop_place_ids.indexOf(destinationPlaceId);

  if (originIndex === -1 || destIndex === -1) return "unknown";
  return originIndex < destIndex;
}
```

If direction is unknown:

```txt
Do not reject immediately.
But downgrade score and include signboard confirmation.
```

User-facing note:

```txt
Confirm the jeep signboard/headsign before riding.
```

---

# Step 10 — Walk → Ride Search

If no direct route:

1. Find walk links from origin to nearby pickup nodes.
2. For each pickup node, search direct route from pickup node to destination.
3. Validate and score.

Example:

```json
{
  "type": "walk_ride",
  "steps": [
    {
      "mode": "walk",
      "from_place_id": "pl_swu",
      "to_place_id": "pl_cim",
      "walk_minutes": 5
    },
    {
      "mode": "ride",
      "route": "04I",
      "from_place_id": "pl_cim",
      "to_place_id": "pl_mango_ave"
    }
  ]
}
```

---

# Step 11 — Ride → Walk Search

If destination is not directly served, check if route can reach a nearby drop-off node and then walk.

Example:

```json
{
  "type": "ride_walk",
  "steps": [
    {
      "mode": "ride",
      "route": "21A",
      "from_place_id": "pl_andy_hotel",
      "to_place_id": "pl_benedicto_st"
    },
    {
      "mode": "walk",
      "from_place_id": "pl_benedicto_st",
      "to_place_id": "pl_galleria",
      "walk_minutes": 5
    }
  ]
}
```

---

# Step 12 — Multi-Hop Transfer Search

Use `route_transfers.json`.

Search levels:

```txt
0 transfers = direct
1 transfer = 2 rides
2 transfers = 3 rides
```

Recommended maximum:

```txt
max_rides = 3
max_walk_segments = 3
```

Example route:

```json
{
  "type": "multi_hop",
  "steps": [
    {
      "mode": "walk",
      "from": "AS Fortuna Dunkin",
      "to": "A.S. Fortuna roadside"
    },
    {
      "mode": "ride",
      "route": "22I",
      "dropoff": "Banilad Town Center"
    },
    {
      "mode": "ride",
      "route": "13C",
      "dropoff": "Pag-IBIG Fund Cebu Office"
    },
    {
      "mode": "walk",
      "to": "jeep line"
    },
    {
      "mode": "ride",
      "route": "06H",
      "dropoff": "Guadalupe Church"
    }
  ],
  "confidence": "high"
}
```

---

# Step 13 — Candidate Validation

Every candidate route must pass validation before scoring.

Hard validation rules:

```txt
1. Every route_code exists in routes.json.
2. Every place_id exists in places.json.
3. Every ride step is supported by direct_access route_place_links.
4. Every transfer is supported by route_transfers.json or explicit OD truth table.
5. nearby_access cannot be used as direct ride proof.
6. area_access cannot be used as direct ride proof.
7. walk steps must exist in walk_links.json or pass distance threshold.
8. If direction conflicts, reject.
9. If direction unknown, downgrade and ask signboard confirmation.
```

If no candidate passes:

```json
{
  "status": "no_verified_route",
  "message": "No verified route found in the current dataset.",
  "candidate_patch_allowed": true
}
```

---

# Step 14 — Candidate Scoring

Use `route_scoring.json`.

Recommended scoring:

```txt
Base:
+100 direct route
+70 walk + ride
+60 one transfer
+40 two transfers

Penalties:
-15 per extra ride
-5 per walk segment
-1 per walk minute
-20 if direction unknown
-30 if confidence medium
-999 if confidence low
```

Example:

```json
{
  "candidate_id": "cand_001",
  "type": "direct",
  "score": 137,
  "confidence": "high"
}
```

Choose highest valid candidate.

---

# Step 15 — LLM Final Response Formatter

Only after routing is complete should the LLM generate the final user-facing answer.

Input to LLM:

```json
{
  "origin": "Gaisano South",
  "destination": "ACT",
  "route_plan": {
    "type": "direct",
    "routes": ["10H", "10F", "10M"],
    "steps": [
      {
        "mode": "ride",
        "routes": ["10H", "10F", "10M"],
        "instruction": "Ride from Gaisano South and drop near ACT."
      }
    ]
  },
  "confidence": "high",
  "language": "ceb-en"
}
```

Expected output:

```txt
Sakay og 10H, 10F, or 10M gikan Gaisano South. Diretso na naog duol sa ACT.
```

### Formatter rules

```txt
Do not add route codes not in route_plan.
Do not invent landmarks.
Do not add transfers not in steps.
If confidence is medium, mention uncertainty.
If no route found, say no verified route found.
```

---

## 5. Conflict Handling: LLM Correct, Dataset Wrong

Sometimes the LLM may know a route but dataset lacks it.

Backend process:

```txt
Dataset says no verified route
LLM suggests possible route
↓
Do NOT answer as truth
↓
Return candidate patch or ask user/local validator
```

Candidate patch format:

```json
{
  "status": "candidate_patch",
  "origin_text": "Simbahan sa Tisa",
  "destination_text": "ACT",
  "suggested_routes": ["10H", "10F", "10M"],
  "source": "llm_suggestion",
  "needs_validation": true
}
```

User-facing response:

```txt
I do not have a verified route in the dataset yet. A possible route may be 10H/10F/10M, but it needs validation.
```

After user validates:

```json
{
  "status": "validated_patch",
  "validated_by": "local_commuter",
  "confidence": "high"
}
```

Then update dataset.

---

## 6. Place Normalization Confirmation Flow

Always confirm normalized places before routing.

Example:

User:

```txt
gaisano near colon to ACT
```

Assistant/backend:

```txt
I normalized your points as:

Point A: Gaisano Main Colon
Point B: Asian College of Technology (ACT)

Is this correct?
```

If user says yes:

```txt
Proceed to routing.
```

If user corrects:

```txt
Rerun place resolver.
```

---

## 7. Handling Establishments With Same Names

For duplicate names like:

```txt
Jollibee
Gaisano
SM
Robinsons
```

Always return candidates:

```json
{
  "needs_confirmation": true,
  "origin_candidates": [
    {
      "place_id": "pl_jollibee_vrama",
      "name": "Jollibee V. Rama"
    },
    {
      "place_id": "pl_jollibee_fuente",
      "name": "Jollibee Fuente"
    }
  ]
}
```

Never assume unless user gave enough context.

---

## 8. API Endpoint Design

Recommended endpoint:

```txt
POST /api/route/resolve
```

Purpose: extract and confirm places.

Request:

```json
{
  "query": "gaisano near colon to ACT"
}
```

Response:

```json
{
  "status": "needs_confirmation",
  "normalized": {
    "origin": {
      "place_id": "pl_gaisano_main_colon",
      "name": "Gaisano Main Colon"
    },
    "destination": {
      "place_id": "pl_act",
      "name": "Asian College of Technology"
    }
  },
  "message": "I normalized your points as Gaisano Main Colon to ACT. Is this correct?"
}
```

---

```txt
POST /api/route/compute
```

Purpose: compute route after confirmation.

Request:

```json
{
  "origin_place_id": "pl_gaisano_main_colon",
  "destination_place_id": "pl_act",
  "confirmed": true
}
```

Response:

```json
{
  "status": "success",
  "route_plan": {
    "type": "walk_only",
    "steps": [
      {
        "mode": "walk",
        "from": "Gaisano Main Colon",
        "to": "ACT",
        "walk_minutes": 5
      }
    ],
    "confidence": "high"
  },
  "message": "From Gaisano Main Colon, just walk to ACT."
}
```

---

```txt
POST /api/route/feedback
```

Purpose: submit user validation/correction.

Request:

```json
{
  "query": "Zapatera to Fuente",
  "system_answer": "01K",
  "user_verdict": "incorrect",
  "correct_route": null,
  "notes": "No direct jeepney route."
}
```

Response:

```json
{
  "status": "feedback_saved",
  "candidate_patch_created": true
}
```

---

## 9. Backend Pseudocode

```ts
async function handleRouteQuery(query: string) {
  const extracted = await llmExtractPlaces(query);

  const candidates = resolvePlaceCandidates(
    extracted.origin_text,
    extracted.destination_text
  );

  return {
    status: "needs_confirmation",
    candidates,
    message: buildConfirmationMessage(candidates)
  };
}

async function computeRoute(originPlaceId: string, destinationPlaceId: string) {
  const odTruth = findODTruth(originPlaceId, destinationPlaceId);
  if (odTruth) return validateScoreFormat(odTruth);

  const walkOnly = findWalkOnly(originPlaceId, destinationPlaceId);
  if (walkOnly) return validateScoreFormat(walkOnly);

  const direct = findDirectRoutes(originPlaceId, destinationPlaceId);
  if (direct.length > 0) return validateScoreFormat(best(direct));

  const walkRide = findWalkRide(originPlaceId, destinationPlaceId);
  if (walkRide.length > 0) return validateScoreFormat(best(walkRide));

  const rideWalk = findRideWalk(originPlaceId, destinationPlaceId);
  if (rideWalk.length > 0) return validateScoreFormat(best(rideWalk));

  const multiHop = findMultiHop(originPlaceId, destinationPlaceId, {
    maxRides: 3
  });
  if (multiHop.length > 0) return validateScoreFormat(best(multiHop));

  return {
    status: "no_verified_route",
    message: "No verified route found in the current dataset."
  };
}
```

---

## 10. Regression Testing

Run `route_tests.json` after every dataset patch.

Each test should check:

```txt
- normalized origin/destination
- route type
- expected route codes
- expected transfer points
- should_not_include wrong codes
```

Example:

```json
{
  "query": "IT Park to Colon",
  "origin_place_id": "pl_it_park",
  "destination_place_id": "pl_colon",
  "expected_type": "direct",
  "expected_routes": ["17B", "17C"],
  "should_not_include": ["04D"]
}
```

Test result format:

```json
{
  "passed": true,
  "test_id": "it_park_to_colon"
}
```

---

## 11. Production Rules

### Always

```txt
- Confirm normalized points first.
- Use JSON as the source of truth.
- Prefer OD truth table.
- Validate every route.
- Score candidates.
- Let LLM format only after validation.
```

### Never

```txt
- Never let LLM invent route codes.
- Never use nearby_access as direct route.
- Never compress multi-hop into fake direct route.
- Never hide uncertainty.
- Never patch dataset from LLM alone.
```

---

## 12. Recommended Route Plan Schema

Every computed answer should become this structure before formatting:

```json
{
  "route_plan_id": "rp_001",
  "origin_place_id": "pl_origin",
  "destination_place_id": "pl_destination",
  "type": "direct | walk_only | walk_ride | ride_walk | multi_hop | no_verified_route",
  "confidence": "high | medium | low",
  "steps": [
    {
      "step_no": 1,
      "mode": "walk",
      "from_place_id": "pl_a",
      "to_place_id": "pl_b",
      "walk_minutes": 5,
      "distance_m": 350
    },
    {
      "step_no": 2,
      "mode": "ride",
      "route_code": "06H",
      "from_place_id": "pl_b",
      "to_place_id": "pl_c",
      "dropoff_place_id": "pl_c",
      "direction_id": "to_guadalupe",
      "headsign": "To Guadalupe"
    }
  ],
  "validation": {
    "passed": true,
    "rules_checked": [
      "route_exists",
      "places_exist",
      "direct_access_exists",
      "transfer_exists",
      "direction_valid"
    ]
  },
  "score": 137
}
```

---

## 13. Final Output Examples

### Direct route

```txt
Sakay og 17B or 17C gikan IT Park. Diretso na naog sa Colon.
```

### Walk-only

```txt
Duol ra kaayo. From Gaisano Main Colon, pwede ra ka maglakaw padung ACT.
```

### Multi-hop

```txt
Lakaw padung Calamba Cemetery, sakay og 06G, naog sa PRC. Transfer og 06H, naog sa Pope John Paul II Ave, then lakaw padung Bonifacio District.
```

### No verified route

```txt
Wala pa koy verified route ani sa current dataset. Please confirm the nearest landmark or pickup point.
```

---

## 14. Implementation Priority

Build in this order:

1. Dataset loader
2. Alias/place resolver
3. Confirmation flow
4. OD truth table lookup
5. Direct route search
6. Walk-only / walk-link logic
7. Multi-hop transfer search
8. Validator
9. Scorer
10. LLM formatter
11. Feedback and patch workflow
12. Regression tests

---

## 15. Summary

RUTA backend should behave like this:

```txt
Understand user text
→ Confirm exact places
→ Compute route from dataset
→ Validate route strictly
→ Score best route
→ Let LLM explain
→ Accept corrections as candidate patches
```

The dataset is the source of truth.  
The LLM is only the interpreter and speaker.
