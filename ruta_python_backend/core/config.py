from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    package_dir: Path
    dataset_dir: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    package_dir = Path(__file__).resolve().parents[1]
    dataset_override = os.getenv("RUTA_DATASET_DIR")
    dataset_dir = Path(dataset_override) if dataset_override else package_dir / "ruta_dataset_v4"
    return Settings(package_dir=package_dir, dataset_dir=dataset_dir)
