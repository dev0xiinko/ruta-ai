# RUTA Python Backend

This folder contains a standalone Python backend that turns the routing rules in
`ruta_backend_processing.md` into a working API.

## What is included

- `main.py`: FastAPI entrypoint
- `core/`: resolver, route engine, validator, scorer, formatter, and service layer
- `ruta_dataset_v4/`: JSON dataset scaffold that matches the processing guide
- `tests/`: core regression tests

## Endpoints

- `POST /api/route/resolve`
- `POST /api/route/compute`
- `POST /api/route/feedback`
- `GET /health`

## Run

```bash
uvicorn ruta_python_backend.main:app --reload
```

## Refresh Dataset

Rebuild the Python dataset from the larger repo route seeds:

```bash
python ruta_python_backend/scripts/build_dataset_from_repo.py
```

## Test

```bash
python -m unittest discover ruta_python_backend/tests -v
```

For a full step-by-step test guide, see `TESTING.md`.

## Notes

- The backend always asks for place confirmation before route computation.
- The JSON dataset is the source of truth.
- The query extractor is deterministic for now and can be replaced with an LLM later.
