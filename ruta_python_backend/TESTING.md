# RUTA Python Backend Testing Guide

This note shows how to test the backend in simple steps.

## 1. Start the backend

From the project root:

```bash
uvicorn ruta_python_backend.main:app --reload
```

If `uvicorn` is not in your PATH, use:

```bash
python -m uvicorn ruta_python_backend.main:app --reload
```

Default local URL:

```txt
http://127.0.0.1:8000
```

FastAPI docs:

```txt
http://127.0.0.1:8000/docs
```

## 2. Quick health check

Open this in the browser or test it in PowerShell:

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/health"
```

Expected result:

- `status` should be `ok`
- `place_count` should be greater than `0`
- `route_count` should be greater than `0`

## 3. Automated tests

Run all backend tests:

```bash
python -m unittest discover ruta_python_backend/tests -v
```

If you want to refresh the backend dataset from the larger repo seeds first:

```bash
python ruta_python_backend/scripts/build_dataset_from_repo.py
```

Current automated coverage:

- place normalization confirmation flow
- OD truth table priority
- walk-only routing
- multi-hop routing
- feedback patch creation
- dataset bootstrap coverage

Run one test only:

```bash
python -m unittest ruta_python_backend.tests.test_backend.RouteBackendTests.test_compute_multi_hop_route -v
```

## 4. Manual API tests

### A. Resolve places

This should return `needs_confirmation`.

```powershell
$body = @{
  query = "gaisano near colon to ACT"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/route/resolve" `
  -ContentType "application/json" `
  -Body $body
```

Expected result:

- `status` = `needs_confirmation`
- origin should resolve to `pl_gaisano_main_colon`
- destination should resolve to `pl_act`

### B. Compute a direct route

This tests the OD truth table path.

```powershell
$body = @{
  origin_place_id = "pl_it_park"
  destination_place_id = "pl_colon"
  confirmed = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/route/compute" `
  -ContentType "application/json" `
  -Body $body
```

Expected result:

- `status` = `success`
- `route_plan.type` = `direct`
- step routes should include `17B` and `17C`

### C. Compute a walk-only route

```powershell
$body = @{
  origin_place_id = "pl_gaisano_main_colon"
  destination_place_id = "pl_act"
  confirmed = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/route/compute" `
  -ContentType "application/json" `
  -Body $body
```

Expected result:

- `status` = `success`
- `route_plan.type` = `walk_only`

### D. Compute a multi-hop route

```powershell
$body = @{
  origin_place_id = "pl_as_fortuna_dunkin"
  destination_place_id = "pl_guadalupe_church"
  confirmed = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/route/compute" `
  -ContentType "application/json" `
  -Body $body
```

Expected result:

- `status` = `success`
- `route_plan.type` = `multi_hop`
- ride sequence should include `22I`, `13C`, and `06H`

### E. Submit feedback

```powershell
$body = @{
  query = "Zapatera to Fuente"
  system_answer = "01K"
  user_verdict = "incorrect"
  notes = "No direct jeepney route."
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/route/feedback" `
  -ContentType "application/json" `
  -Body $body
```

Expected result:

- `status` = `feedback_saved`
- `candidate_patch_created` = `true`

## 5. What to check if something fails

- Confirm the server is running on `127.0.0.1:8000`
- Confirm the dataset folder exists at `ruta_python_backend/ruta_dataset_v4`
- Confirm JSON files are valid
- Re-run the failing unit test by itself
- Check `/docs` and try the same request there

## 6. Main files related to testing

- `ruta_python_backend/tests/test_backend.py`
- `ruta_python_backend/main.py`
- `ruta_python_backend/core/service.py`
- `ruta_python_backend/ruta_dataset_v4/`
