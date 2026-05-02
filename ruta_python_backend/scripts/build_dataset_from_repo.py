from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = REPO_ROOT / "ruta_python_backend" / "ruta_dataset_v4"
SEED_SQL = REPO_ROOT / "supabase" / "seed.sql"
SEED_MAPPING_SQL = REPO_ROOT / "supabase" / "seed.mapping.sql"

ROUTE_COLUMNS = [
    "dataset_name",
    "code",
    "label",
    "route_name",
    "origin",
    "destination",
    "qa_status",
    "completeness_score",
    "source_urls",
    "roads",
    "schools",
    "malls_groceries",
    "churches",
    "government",
    "hotels",
    "health",
    "terminals",
    "info",
    "raw_sections",
    "warnings",
]

ROAD_LIKE_RE = re.compile(
    r"\b(st|street|ave|avenue|road|rd|drive|dr|blvd|boulevard|ext|extension|highway)\b",
    re.IGNORECASE,
)


@dataclass
class PlaceMatch:
    place_id: str
    index: int


def normalize_text(value: str) -> str:
    return " ".join(
        "".join(char.lower() if char.isalnum() or char.isspace() else " " for char in value).split()
    )


def sanitize_legacy_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if cleaned.startswith("('") and cleaned.endswith("'"):
        cleaned = cleaned[2:-1]
    return cleaned


def slugify(value: str) -> str:
    normalized = normalize_text(value)
    slug = normalized.replace(" ", "_")
    return re.sub(r"_+", "_", slug).strip("_") or "unknown"


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def extract_insert_values(sql: str, marker: str) -> str:
    lower_sql = sql.lower()
    lower_marker = marker.lower()
    start = lower_sql.index(lower_marker)
    values_index = lower_sql.index("values", start)
    conflict_index = lower_sql.find("on conflict", values_index)
    end = conflict_index if conflict_index != -1 else lower_sql.index(";", values_index)
    return sql[values_index + len("VALUES") : end].strip()


def split_sql_tuples(values_block: str) -> list[str]:
    tuples: list[str] = []
    depth = 0
    in_string = False
    current: list[str] = []
    index = 0

    while index < len(values_block):
        char = values_block[index]

        if depth == 0 and not in_string and char != "(" and not current:
            index += 1
            continue

        current.append(char)

        if char == "'":
            if in_string and index + 1 < len(values_block) and values_block[index + 1] == "'":
                current.append(values_block[index + 1])
                index += 1
            else:
                in_string = not in_string
        elif not in_string:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    tuple_text = "".join(current).strip()
                    tuples.append(tuple_text)
                    current = []
        index += 1

    return tuples


def split_sql_fields(tuple_text: str) -> list[str]:
    inner = tuple_text.strip()[1:-1]
    fields: list[str] = []
    current: list[str] = []
    in_string = False
    index = 0

    while index < len(inner):
        char = inner[index]
        if char == "'":
            current.append(char)
            if in_string and index + 1 < len(inner) and inner[index + 1] == "'":
                current.append(inner[index + 1])
                index += 1
            else:
                in_string = not in_string
        elif char == "," and not in_string:
            fields.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        index += 1

    if current:
        fields.append("".join(current).strip())
    return fields


def parse_sql_string(value: str) -> str:
    assert value.startswith("'") and value.endswith("'")
    return value[1:-1].replace("''", "'")


def parse_sql_value(raw: str) -> Any:
    value = raw.strip()
    is_jsonb = value.endswith("::jsonb")
    if is_jsonb:
        value = value[: -len("::jsonb")].strip()
    if value.lower() == "null":
        return None
    if value.startswith("'") and value.endswith("'"):
        parsed = parse_sql_string(value)
        if is_jsonb:
            return json.loads(parsed)
        return parsed
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


def parse_route_seed(seed_path: Path) -> list[dict[str, Any]]:
    sql = seed_path.read_text(encoding="utf-8")
    values_block = extract_insert_values(sql, "INSERT INTO public.jeepney_routes")
    routes: list[dict[str, Any]] = []
    for tuple_text in split_sql_tuples(values_block):
        fields = [parse_sql_value(field) for field in split_sql_fields(tuple_text)]
        if len(fields) != len(ROUTE_COLUMNS):
            raise ValueError(f"Unexpected route field count: {len(fields)}")
        routes.append(dict(zip(ROUTE_COLUMNS, fields, strict=True)))
    return routes


def parse_mapping_seed(seed_mapping_path: Path) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    sql = seed_mapping_path.read_text(encoding="utf-8")
    values_block = extract_insert_values(sql, "insert into public.route_places")
    places: list[dict[str, Any]] = []
    for tuple_text in split_sql_tuples(values_block):
        canonical_name, city, latitude, longitude, source = [
            parse_sql_value(field) for field in split_sql_fields(tuple_text)
        ]
        places.append(
            {
                "canonical_name": canonical_name,
                "city": city,
                "latitude": latitude,
                "longitude": longitude,
                "source": source,
            }
        )

    alias_pattern = re.compile(
        r"select id, '((?:''|[^'])+)'\s+from public\.route_places\s+where canonical_name = '((?:''|[^'])+)'",
        re.IGNORECASE,
    )
    aliases_by_name: dict[str, list[str]] = defaultdict(list)
    for alias_raw, canonical_raw in alias_pattern.findall(sql):
        alias = alias_raw.replace("''", "'")
        canonical_name = canonical_raw.replace("''", "'")
        aliases_by_name[canonical_name].append(alias)
    return places, aliases_by_name


def build_alias_positions(text: str, aliases_by_place: dict[str, set[str]]) -> list[PlaceMatch]:
    normalized_text = f" {normalize_text(text)} "
    matches: list[PlaceMatch] = []
    for place_id, aliases in aliases_by_place.items():
        best_index: int | None = None
        for alias in sorted(aliases, key=len, reverse=True):
            normalized_alias = normalize_text(alias)
            if len(normalized_alias) < 3:
                continue
            needle = f" {normalized_alias} "
            index = normalized_text.find(needle)
            if index != -1 and (best_index is None or index < best_index):
                best_index = index
        if best_index is not None:
            matches.append(PlaceMatch(place_id=place_id, index=best_index))
    matches.sort(key=lambda item: item.index)
    return matches


def dedupe_place_ids(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def append_alias(place: dict[str, Any], alias: str) -> None:
    normalized_alias = normalize_text(alias)
    if not normalized_alias:
        return
    aliases = {normalize_text(item): item for item in place.get("aliases", [])}
    if normalized_alias not in aliases:
        place.setdefault("aliases", []).append(alias)


def update_place(place: dict[str, Any], *, latitude: float | None = None, longitude: float | None = None) -> None:
    if latitude is not None and place.get("latitude") is None:
        place["latitude"] = latitude
    if longitude is not None and place.get("longitude") is None:
        place["longitude"] = longitude


def ensure_place(
    places_by_id: dict[str, dict[str, Any]],
    name_index: dict[str, str],
    alias_index: dict[str, str],
    name: str,
    *,
    aliases: list[str] | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    importance_rank: int = 65,
    area: str | None = None,
) -> str:
    aliases = aliases or []
    normalized_name = normalize_text(name)
    existing_id = (
        name_index.get(normalized_name)
        or alias_index.get(normalized_name)
        or next((alias_index[normalize_text(alias)] for alias in aliases if normalize_text(alias) in alias_index), None)
    )

    if existing_id:
        place = places_by_id[existing_id]
        update_place(place, latitude=latitude, longitude=longitude)
        if place.get("importance_rank", 0) < importance_rank:
            place["importance_rank"] = importance_rank
        if area and not place.get("area"):
            place["area"] = area
        append_alias(place, name)
        for alias in aliases:
            append_alias(place, alias)
        name_index[normalize_text(place["name"])] = existing_id
        for alias in place.get("aliases", []):
            alias_index[normalize_text(alias)] = existing_id
        return existing_id

    place_id = f"pl_{slugify(name)}"
    suffix = 2
    while place_id in places_by_id:
        place_id = f"pl_{slugify(name)}_{suffix}"
        suffix += 1

    new_place = {
        "place_id": place_id,
        "name": name,
        "aliases": [],
        "area": area,
        "cluster_id": None,
        "latitude": latitude,
        "longitude": longitude,
        "importance_rank": importance_rank,
    }
    append_alias(new_place, name)
    for alias in aliases:
        append_alias(new_place, alias)
    places_by_id[place_id] = new_place
    name_index[normalized_name] = place_id
    for alias in new_place["aliases"]:
        alias_index[normalize_text(alias)] = place_id
    return place_id


def looks_road_like(name: str) -> bool:
    return bool(ROAD_LIKE_RE.search(name))


def generate_dataset() -> dict[str, int]:
    current_places = read_json(DATASET_DIR / "places.json")
    for place in current_places:
        place["name"] = sanitize_legacy_text(place.get("name")) or place.get("name")
        place["aliases"] = [
            sanitize_legacy_text(alias) or alias for alias in place.get("aliases", [])
        ]
        place["area"] = sanitize_legacy_text(place.get("area"))
        if place.get("area") and "roadside" in normalize_text(place["name"]):
            place["aliases"].append(place["area"])
            if normalize_text(place["area"]) == "as fortuna":
                place["aliases"].append("A.S. Fortuna")
    current_routes = read_json(DATASET_DIR / "routes.json")
    current_route_links = read_json(DATASET_DIR / "route_place_links.json")
    current_route_transfers = read_json(DATASET_DIR / "route_transfers.json")
    current_walk_links = read_json(DATASET_DIR / "walk_links.json")
    current_route_directions = read_json(DATASET_DIR / "route_directions.json")
    current_truth = read_json(DATASET_DIR / "od_truth_table.json")
    current_area_clusters = read_json(DATASET_DIR / "area_clusters.json")
    current_validated_routes = read_json(DATASET_DIR / "validated_routes.json")

    parsed_routes = parse_route_seed(SEED_SQL)
    mapped_places, mapped_aliases = parse_mapping_seed(SEED_MAPPING_SQL)

    places_by_id: dict[str, dict[str, Any]] = {place["place_id"]: dict(place) for place in current_places}
    name_index: dict[str, str] = {normalize_text(place["name"]): place["place_id"] for place in current_places}
    alias_index: dict[str, str] = {}
    for place in places_by_id.values():
        for alias in place.get("aliases", []):
            alias_index[normalize_text(alias)] = place["place_id"]

    for mapped_place in mapped_places:
        place_id = ensure_place(
            places_by_id,
            name_index,
            alias_index,
            mapped_place["canonical_name"],
            aliases=mapped_aliases.get(mapped_place["canonical_name"], []),
            latitude=mapped_place["latitude"],
            longitude=mapped_place["longitude"],
            importance_rank=88,
            area=mapped_place.get("city"),
        )
        place = places_by_id[place_id]
        place.setdefault("source", mapped_place["source"])

    routes_output: list[dict[str, Any]] = []
    route_place_links: list[dict[str, Any]] = []
    route_directions: list[dict[str, Any]] = []
    nearby_links_seen: set[tuple[str, str, str]] = set()
    direct_links_seen: set[tuple[str, str]] = set()

    aliases_by_place: dict[str, set[str]] = defaultdict(set)
    for place in places_by_id.values():
        aliases_by_place[place["place_id"]].add(place["name"])
        for alias in place.get("aliases", []):
            aliases_by_place[place["place_id"]].add(alias)

    for route in parsed_routes:
        route_code = route["code"]
        routes_output.append(
            {
                "route_code": route_code,
                "name": route["route_name"] or route_code,
                "description": (route.get("info") or [None])[0],
                "qa_status": route["qa_status"],
                "confidence": round((route.get("completeness_score") or 0) / 100, 2),
            }
        )

        if not route.get("origin") or not route.get("destination"):
            continue

        origin_place_id = ensure_place(
            places_by_id,
            name_index,
            alias_index,
            route["origin"],
            importance_rank=72,
        )
        destination_place_id = ensure_place(
            places_by_id,
            name_index,
            alias_index,
            route["destination"],
            importance_rank=72,
        )
        aliases_by_place[origin_place_id].add(places_by_id[origin_place_id]["name"])
        aliases_by_place[destination_place_id].add(places_by_id[destination_place_id]["name"])
        for alias in places_by_id[origin_place_id].get("aliases", []):
            aliases_by_place[origin_place_id].add(alias)
        for alias in places_by_id[destination_place_id].get("aliases", []):
            aliases_by_place[destination_place_id].add(alias)

        info_place_ids: list[str] = []
        for ordered_text in route.get("info") or []:
            info_place_ids.extend(match.place_id for match in build_alias_positions(ordered_text, aliases_by_place))
        info_place_ids = dedupe_place_ids(info_place_ids)

        if origin_place_id in info_place_ids and destination_place_id in info_place_ids:
            origin_index = info_place_ids.index(origin_place_id)
            destination_index = info_place_ids.index(destination_place_id)
            if destination_index < origin_index:
                info_place_ids = list(reversed(info_place_ids))

        ordered_place_ids = dedupe_place_ids(
            [origin_place_id, *[place_id for place_id in info_place_ids if place_id not in {origin_place_id, destination_place_id}], destination_place_id]
        )

        if len(ordered_place_ids) >= 2:
            route_directions.append(
                {
                    "direction_id": f"{route_code.lower()}_outbound",
                    "route_code": route_code,
                    "headsign": f"To {places_by_id[destination_place_id]['name']}",
                    "stop_place_ids": ordered_place_ids,
                }
            )

        total_direct_stops = len(ordered_place_ids)
        for index, place_id in enumerate(ordered_place_ids):
            key = (route_code, place_id)
            if key in direct_links_seen:
                continue
            direct_links_seen.add(key)
            route_place_links.append(
                {
                    "route_code": route_code,
                    "place_id": place_id,
                    "access_type": "direct_access",
                    "pickup": index != total_direct_stops - 1,
                    "dropoff": index != 0,
                }
            )

        nearby_sections = [
            *(route.get("roads") or []),
            *(route.get("schools") or []),
            *(route.get("malls_groceries") or []),
            *(route.get("churches") or []),
            *(route.get("government") or []),
            *(route.get("hotels") or []),
            *(route.get("health") or []),
            *(route.get("terminals") or []),
        ]
        for text in nearby_sections:
            for match in build_alias_positions(text, aliases_by_place):
                key = (route_code, match.place_id, "nearby_access")
                if key in nearby_links_seen or (route_code, match.place_id) in direct_links_seen:
                    continue
                nearby_links_seen.add(key)
                route_place_links.append(
                    {
                        "route_code": route_code,
                        "place_id": match.place_id,
                        "access_type": "nearby_access",
                        "pickup": True,
                        "dropoff": True,
                    }
                )

    all_known_route_codes = {route["route_code"] for route in routes_output} | {
        route["route_code"] for route in current_routes
    }

    def upsert_direct_link(route_code: str, place_id: str, *, pickup: bool, dropoff: bool) -> None:
        for link in route_place_links:
            if (
                link["route_code"] == route_code
                and link["place_id"] == place_id
                and link.get("access_type", "direct_access") == "direct_access"
            ):
                link["pickup"] = bool(link.get("pickup", True) or pickup)
                link["dropoff"] = bool(link.get("dropoff", True) or dropoff)
                direct_links_seen.add((route_code, place_id))
                return

        direct_links_seen.add((route_code, place_id))
        route_place_links.append(
            {
                "route_code": route_code,
                "place_id": place_id,
                "access_type": "direct_access",
                "pickup": pickup,
                "dropoff": dropoff,
            }
        )

    def route_direction_covers(route_code: str, origin_place_id: str, destination_place_id: str) -> bool:
        for direction in route_directions:
            if direction["route_code"] != route_code:
                continue
            stop_place_ids = direction.get("stop_place_ids", [])
            if origin_place_id not in stop_place_ids or destination_place_id not in stop_place_ids:
                continue
            if stop_place_ids.index(origin_place_id) < stop_place_ids.index(destination_place_id):
                return True
        return False

    truth_direction_keys = {
        (direction["route_code"], tuple(direction.get("stop_place_ids", [])))
        for direction in route_directions
    }
    for truth in current_truth:
        if truth.get("route_type") != "direct":
            continue
        origin_place_id = truth.get("origin_place_id")
        destination_place_id = truth.get("destination_place_id")
        if origin_place_id not in places_by_id or destination_place_id not in places_by_id:
            continue

        route_codes = [route_code for route_code in truth.get("routes", []) if route_code in all_known_route_codes]
        for route_code in route_codes:
            upsert_direct_link(route_code, origin_place_id, pickup=True, dropoff=False)
            upsert_direct_link(route_code, destination_place_id, pickup=False, dropoff=True)

            if route_direction_covers(route_code, origin_place_id, destination_place_id):
                continue

            direction_key = (route_code, (origin_place_id, destination_place_id))
            if direction_key in truth_direction_keys:
                continue
            truth_direction_keys.add(direction_key)
            route_directions.append(
                {
                    "direction_id": f"{route_code.lower()}_truth_{origin_place_id}_{destination_place_id}",
                    "route_code": route_code,
                    "headsign": f"To {places_by_id[destination_place_id]['name']}",
                    "stop_place_ids": [origin_place_id, destination_place_id],
                }
            )

    direct_access_by_place: dict[str, list[str]] = defaultdict(list)
    for link in route_place_links:
        if link["access_type"] == "direct_access":
            direct_access_by_place[link["place_id"]].append(link["route_code"])

    route_transfers: list[dict[str, Any]] = []
    transfer_seen: set[tuple[str, str, str]] = set()
    for place_id, route_codes in direct_access_by_place.items():
        if len(route_codes) < 2:
            continue
        place = places_by_id[place_id]
        if looks_road_like(place["name"]) and place.get("latitude") is None:
            continue
        unique_codes = sorted(set(route_codes))
        for left_index, from_route in enumerate(unique_codes):
            for to_route in unique_codes[left_index + 1 :]:
                key = (from_route, to_route, place_id)
                if key in transfer_seen:
                    continue
                transfer_seen.add(key)
                route_transfers.append(
                    {
                        "from_route_code": from_route,
                        "to_route_code": to_route,
                        "transfer_place_id": place_id,
                        "bidirectional": True,
                    }
                )

    seed_generated_route_codes = {route["route_code"] for route in routes_output}
    generated_route_codes = set(seed_generated_route_codes)
    for route in current_routes:
        if route["route_code"] not in generated_route_codes:
            routes_output.append(route)
            generated_route_codes.add(route["route_code"])

    for link in current_route_links:
        if link["route_code"] in seed_generated_route_codes:
            continue
        normalized_link = {
            "route_code": link["route_code"],
            "place_id": link["place_id"],
            "access_type": link.get("access_type", "direct_access"),
            "pickup": link.get("pickup", True),
            "dropoff": link.get("dropoff", True),
        }
        key = (
            normalized_link["route_code"],
            normalized_link["place_id"],
            normalized_link["access_type"],
        )
        if normalized_link["route_code"] in {route["route_code"] for route in routes_output} and key not in nearby_links_seen and (
            link["route_code"], link["place_id"]
        ) not in direct_links_seen:
            if normalized_link["access_type"] == "direct_access":
                direct_links_seen.add((normalized_link["route_code"], normalized_link["place_id"]))
            else:
                nearby_links_seen.add(key)
            route_place_links.append(normalized_link)

    existing_direction_keys = {(item["route_code"], tuple(item["stop_place_ids"])) for item in route_directions}
    for direction in current_route_directions:
        if direction["route_code"] in seed_generated_route_codes:
            continue
        key = (direction["route_code"], tuple(direction["stop_place_ids"]))
        if key not in existing_direction_keys and direction["route_code"] in generated_route_codes:
            route_directions.append(direction)
            existing_direction_keys.add(key)

    for transfer in current_route_transfers:
        if transfer["from_route_code"] in seed_generated_route_codes or transfer["to_route_code"] in seed_generated_route_codes:
            continue
        key = (
            transfer["from_route_code"],
            transfer["to_route_code"],
            transfer["transfer_place_id"],
        )
        reverse_key = (
            transfer["to_route_code"],
            transfer["from_route_code"],
            transfer["transfer_place_id"],
        )
        if transfer["from_route_code"] in generated_route_codes and transfer["to_route_code"] in generated_route_codes:
            if key not in transfer_seen and reverse_key not in transfer_seen:
                transfer_seen.add(key)
                route_transfers.append(transfer)

    route_tests = list(read_json(DATASET_DIR / "route_tests.json"))
    existing_test_keys = {
        (test.get("origin_place_id"), test.get("destination_place_id")) for test in route_tests
    }
    generated_tests: list[dict[str, Any]] = []
    for direction in route_directions:
        origin_place_id = direction["stop_place_ids"][0]
        destination_place_id = direction["stop_place_ids"][-1]
        key = (origin_place_id, destination_place_id)
        if key in existing_test_keys:
            continue
        generated_tests.append(
            {
                "query": f"{places_by_id[origin_place_id]['name']} to {places_by_id[destination_place_id]['name']}",
                "origin_place_id": origin_place_id,
                "destination_place_id": destination_place_id,
                "expected_type": "direct",
                "expected_routes": [direction["route_code"]],
                "should_not_include": [],
            }
        )
        existing_test_keys.add(key)

    validated_routes = list(current_validated_routes)
    validated_keys = {
        (item.get("origin_place_id"), item.get("destination_place_id"), tuple(item.get("routes", [])))
        for item in validated_routes
    }
    for direction in route_directions:
        key = (
            direction["stop_place_ids"][0],
            direction["stop_place_ids"][-1],
            (direction["route_code"],),
        )
        if key in validated_keys:
            continue
        validated_routes.append(
            {
                "origin_place_id": direction["stop_place_ids"][0],
                "destination_place_id": direction["stop_place_ids"][-1],
                "routes": [direction["route_code"]],
                "validated_by": "repo_seed_bootstrap",
                "confidence": "medium",
            }
        )
        validated_keys.add(key)

    routes_output.sort(key=lambda item: item["route_code"])
    route_place_links.sort(
        key=lambda item: (
            item["route_code"],
            item["place_id"],
            item.get("access_type", "direct_access"),
        )
    )
    route_directions.sort(key=lambda item: item["route_code"])
    route_transfers.sort(key=lambda item: (item["from_route_code"], item["to_route_code"], item["transfer_place_id"]))
    places_output = sorted(places_by_id.values(), key=lambda item: item["name"])
    route_tests_output: list[dict[str, Any]] = []
    seen_route_tests: set[tuple[Any, ...]] = set()
    for test in [*route_tests, *generated_tests]:
        key = (
            test.get("origin_place_id"),
            test.get("destination_place_id"),
            tuple(test.get("expected_routes", [])),
            test.get("expected_type"),
        )
        if key in seen_route_tests:
            continue
        seen_route_tests.add(key)
        route_tests_output.append(test)

    write_json(DATASET_DIR / "places.json", places_output)
    write_json(DATASET_DIR / "routes.json", routes_output)
    write_json(DATASET_DIR / "route_place_links.json", route_place_links)
    write_json(DATASET_DIR / "route_transfers.json", route_transfers)
    write_json(DATASET_DIR / "walk_links.json", current_walk_links)
    write_json(DATASET_DIR / "route_directions.json", route_directions)
    write_json(DATASET_DIR / "od_truth_table.json", current_truth)
    write_json(DATASET_DIR / "route_tests.json", route_tests_output)
    write_json(DATASET_DIR / "area_clusters.json", current_area_clusters)
    write_json(DATASET_DIR / "validated_routes.json", validated_routes)

    return {
        "places": len(places_output),
        "routes": len(routes_output),
        "route_place_links": len(route_place_links),
        "route_transfers": len(route_transfers),
        "route_directions": len(route_directions),
        "route_tests": len(route_tests_output),
    }


def main() -> None:
    summary = generate_dataset()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
