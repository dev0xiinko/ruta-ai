from __future__ import annotations

RELATION_PRIORITY = {
    "direct_access": 3,
    "nearby_access": 2,
    "area_access": 1,
}

CONFIDENCE_PRIORITY = {
    "high": 3,
    "medium": 2,
    "low": 1,
}

__all__ = ["CONFIDENCE_PRIORITY", "RELATION_PRIORITY"]
