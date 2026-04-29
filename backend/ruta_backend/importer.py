from __future__ import annotations

import argparse
import json
import uuid
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .settings import Settings
from .supabase_rest import SupabaseRestClient
from .utils import normalize_text, safe_list, stable_text_id


JSON_COLUMNS_BY_TABLE: dict[str, set[str]] = {
    "routes": {
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
        "aliases",
        "road_segments",
        "stops",
        "area_clusters",
        "raw_payload",
    },
    "places": {
        "aliases",
        "normalized_aliases",
        "address_aliases",
        "source_route_codes",
        "source_urls",
        "area_clusters",
        "raw_payload",
    },
    "area_clusters": {"aliases", "normalized_aliases", "keywords", "raw_payload"},
    "area_cluster_members": {"raw_payload"},
    "route_place_links": {"raw_payload"},
    "route_transfers": {"shared_places", "shared_areas", "raw_payload"},
    "manual_overrides": {"payload"},
}

STRONG_DIRECT_SOURCE_FIELDS = {"origin", "destination", "stops", "terminals"}
WEAK_DIRECT_SOURCE_FIELDS = {"roads", "schools", "malls_groceries", "health", "government", "churches", "hotels"}
CURATED_MANUAL_OVERRIDE_DEFINITIONS = [
    {"override_type": "place_alias", "match_key": "usc tc", "target_name": "University of San Carlos talamban", "priority": 240},
    {"override_type": "place_alias", "match_key": "usc-talamban", "target_name": "University of San Carlos talamban", "priority": 240},
    {"override_type": "place_alias", "match_key": "usc talamban", "target_name": "University of San Carlos talamban", "priority": 240},
    {"override_type": "place_alias", "match_key": "usc main", "target_name": "University of San Carlos Main Campus", "priority": 240},
    {"override_type": "place_alias", "match_key": "usc downtown", "target_name": "University of San Carlos Main Campus", "priority": 240},
    {"override_type": "place_alias", "match_key": "usc south", "target_name": "University of San Carlos Main Campus", "priority": 235},
    {"override_type": "place_alias", "match_key": "cebu doc", "target_name": "Cebu Doctors Hospital", "priority": 245},
    {"override_type": "place_alias", "match_key": "cebu doctors", "target_name": "Cebu Doctors Hospital", "priority": 235},
    {"override_type": "place_alias", "match_key": "jy", "target_name": "Jy Square Mall", "priority": 235},
    {"override_type": "place_alias", "match_key": "jy square", "target_name": "Jy Square Mall", "priority": 235},
    {"override_type": "place_alias", "match_key": "e-mall", "target_name": "Elizabeth Mall", "priority": 235},
    {"override_type": "place_alias", "match_key": "emall", "target_name": "Elizabeth Mall", "priority": 235},
    {"override_type": "place_alias", "match_key": "e mall", "target_name": "Elizabeth Mall", "priority": 235},
    {"override_type": "place_alias", "match_key": "act", "target_name": "Asian College of Technology", "priority": 240},
    {"override_type": "place_alias", "match_key": "rob galleria", "target_name": "robinsons galleria cebu", "priority": 235},
    {"override_type": "place_alias", "match_key": "robinsons galleria", "target_name": "robinsons galleria cebu", "priority": 235},
    {"override_type": "place_alias", "match_key": "galleria", "target_name": "robinsons galleria cebu", "priority": 225},
]


def load_payload(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_route_id(route: dict[str, Any]) -> str:
    return str(route["code"]).upper()


def build_link_id(link: dict[str, Any]) -> str:
    return stable_text_id(
        "rpl",
        link.get("route_code"),
        link.get("place_id"),
        link.get("relation"),
        link.get("source_field"),
    )


def build_transfer_id(transfer: dict[str, Any]) -> str:
    return stable_text_id(
        "rtf",
        transfer.get("route_code"),
        transfer.get("connects_to"),
        transfer.get("transfer_reason"),
        json.dumps(transfer.get("shared_places", []), sort_keys=True),
        json.dumps(transfer.get("shared_areas", []), sort_keys=True),
    )


def build_membership_id(cluster_id: str, place_id: str) -> str:
    return stable_text_id("acm", cluster_id, place_id)


def build_override_id(override_type: str, match_key: str, target_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"ruta:{override_type}:{normalize_text(match_key)}:{target_id}"))


def build_route_row(route: dict[str, Any]) -> dict[str, Any]:
    return {
        "route_id": build_route_id(route),
        "code": str(route["code"]).upper(),
        "label": route.get("label"),
        "route_name": route.get("route_name"),
        "origin": route.get("origin"),
        "destination": route.get("destination"),
        "source_urls": safe_list(route.get("source_urls")),
        "roads": safe_list(route.get("roads")),
        "schools": safe_list(route.get("schools")),
        "malls_groceries": safe_list(route.get("malls_groceries")),
        "churches": safe_list(route.get("churches")),
        "government": safe_list(route.get("government")),
        "hotels": safe_list(route.get("hotels")),
        "health": safe_list(route.get("health")),
        "terminals": safe_list(route.get("terminals")),
        "info": safe_list(route.get("info")),
        "raw_sections": route.get("raw_sections", {}),
        "aliases": route.get("aliases", {}),
        "road_segments": safe_list(route.get("road_segments")),
        "stops": route.get("stops", []),
        "search_text": route.get("search_text", ""),
        "embedding_text": route.get("embedding_text", ""),
        "area_clusters": safe_list(route.get("area_clusters")),
        "raw_payload": route,
    }


def build_place_row(place: dict[str, Any]) -> dict[str, Any]:
    normalized_aliases = [
        normalize_text(alias)
        for alias in [*safe_list(place.get("aliases")), *safe_list(place.get("address_aliases"))]
        if normalize_text(alias)
    ]
    return {
        "place_id": place["place_id"],
        "name": place["name"],
        "canonical_name": place["canonical_name"],
        "normalized_name": normalize_text(place.get("canonical_name") or place.get("name")),
        "type": place["type"],
        "aliases": safe_list(place.get("aliases")),
        "normalized_aliases": normalized_aliases,
        "address": place.get("address"),
        "address_aliases": safe_list(place.get("address_aliases")),
        "street": place.get("street"),
        "barangay": place.get("barangay"),
        "city": place.get("city") or "Cebu City",
        "province": place.get("province") or "Cebu",
        "lat": place.get("lat"),
        "lng": place.get("lng"),
        "source_route_codes": safe_list(place.get("source_route_codes")),
        "source_urls": safe_list(place.get("source_urls")),
        "area_clusters": safe_list(place.get("area_clusters")),
        "search_text": place.get("search_text", ""),
        "embedding_text": place.get("embedding_text", ""),
        "raw_payload": place,
    }


def build_cluster_row(cluster: dict[str, Any]) -> dict[str, Any]:
    return {
        "cluster_id": cluster["cluster_id"],
        "name": cluster["name"],
        "aliases": safe_list(cluster.get("aliases")),
        "normalized_aliases": [normalize_text(alias) for alias in safe_list(cluster.get("aliases"))],
        "keywords": safe_list(cluster.get("keywords")),
        "raw_payload": cluster,
    }


def build_cluster_member_row(cluster_id: str, member: dict[str, Any]) -> dict[str, Any]:
    return {
        "membership_id": build_membership_id(cluster_id, member["place_id"]),
        "cluster_id": cluster_id,
        "place_id": member["place_id"],
        "place_name": member.get("name", ""),
        "place_type": member.get("type"),
        "raw_payload": member,
    }


def build_link_row(link: dict[str, Any]) -> dict[str, Any]:
    relation = normalize_link_relation(
        link.get("relation", "area_access"),
        link.get("source_field"),
        link.get("walk_minutes"),
        link.get("distance_m"),
    )
    walk_minutes = normalize_walk_minutes(relation, link.get("walk_minutes"))
    distance_m = normalize_distance_m(relation, link.get("distance_m"))
    return {
        "link_id": build_link_id(link),
        "route_id": str(link["route_code"]).upper(),
        "place_id": link["place_id"],
        "relation": relation,
        "source_field": link["source_field"],
        "dropoff_stop": link.get("dropoff_stop"),
        "walk_minutes": walk_minutes,
        "distance_m": distance_m,
        "confidence": normalize_link_confidence(relation, link.get("confidence", "medium")),
        "raw_payload": link,
    }


def build_transfer_row(transfer: dict[str, Any]) -> dict[str, Any]:
    confidence = normalize_transfer_confidence(
        transfer.get("transfer_reason", "shared_place"),
        transfer.get("confidence", "medium"),
        safe_list(transfer.get("shared_places")),
    )
    return {
        "transfer_id": build_transfer_id(transfer),
        "route_id": str(transfer["route_code"]).upper(),
        "connects_to_route_id": str(transfer["connects_to"]).upper(),
        "shared_places": safe_list(transfer.get("shared_places")),
        "shared_areas": safe_list(transfer.get("shared_areas")),
        "transfer_reason": transfer["transfer_reason"],
        "confidence": confidence,
        "raw_payload": transfer,
    }


def normalize_link_relation(
    relation: str,
    source_field: str | None,
    walk_minutes: int | None,
    distance_m: float | None,
) -> str:
    if relation != "direct_access":
        if relation == "nearby_access" and (not walk_minutes and not distance_m) and source_field in WEAK_DIRECT_SOURCE_FIELDS:
            return "area_access"
        return relation

    if source_field in STRONG_DIRECT_SOURCE_FIELDS:
        return "direct_access"
    if source_field == "roads":
        return "nearby_access"
    if source_field in WEAK_DIRECT_SOURCE_FIELDS:
        if (walk_minutes is not None and walk_minutes > 0) or (distance_m is not None and distance_m > 0):
            return "nearby_access"
        return "area_access"
    return "nearby_access"


def normalize_walk_minutes(relation: str, walk_minutes: int | None) -> int | None:
    if walk_minutes is not None and walk_minutes > 0:
        return walk_minutes
    if relation == "nearby_access":
        return 3
    if relation == "area_access":
        return 5
    return walk_minutes


def normalize_distance_m(relation: str, distance_m: float | None) -> float | None:
    if distance_m is not None and distance_m > 0:
        return distance_m
    if relation == "nearby_access":
        return 220.0
    if relation == "area_access":
        return 350.0
    return distance_m


def normalize_link_confidence(relation: str, confidence: str) -> str:
    normalized_confidence = (confidence or "medium").lower()
    if relation == "direct_access":
        return "high" if normalized_confidence == "high" else "medium"
    if relation == "nearby_access":
        return "medium" if normalized_confidence == "high" else normalized_confidence
    return "low" if normalized_confidence == "high" else normalized_confidence


def normalize_transfer_confidence(transfer_reason: str, confidence: str, shared_places: list[str]) -> str:
    normalized_confidence = (confidence or "medium").lower()
    if transfer_reason == "shared_area" and not shared_places:
        return "low"
    if transfer_reason == "shared_place" and len(shared_places) <= 1 and normalized_confidence == "high":
        return "medium"
    return normalized_confidence


def find_place_id_by_name(places: list[dict[str, Any]], target_name: str) -> str | None:
    normalized_target = normalize_text(target_name)
    exact_matches = []
    for place in places:
        candidates = [
            place.get("name", ""),
            place.get("canonical_name", ""),
            *safe_list(place.get("aliases")),
            *safe_list(place.get("address_aliases")),
        ]
        if any(normalize_text(candidate) == normalized_target for candidate in candidates if candidate):
            exact_matches.append(place["place_id"])
    return exact_matches[0] if exact_matches else None


def build_manual_override_row(override: dict[str, Any], target_place_id: str | None) -> dict[str, Any]:
    target_id = target_place_id or ""
    return {
        "override_id": build_override_id(override["override_type"], override["match_key"], target_id),
        "override_type": override["override_type"],
        "match_key": override["match_key"],
        "normalized_match_key": normalize_text(override["match_key"]),
        "target_place_id": target_place_id,
        "target_cluster_id": override.get("target_cluster_id"),
        "target_route_id": override.get("target_route_id"),
        "priority": override.get("priority", 200),
        "is_active": override.get("is_active", True),
        "payload": override.get("payload", {}),
        "notes": override.get("notes"),
    }


def build_manual_override_rows(
    places_payload: list[dict[str, Any]],
    overrides_payload: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    all_overrides = [*CURATED_MANUAL_OVERRIDE_DEFINITIONS, *(overrides_payload or [])]

    for override in all_overrides:
        target_place_id = override.get("target_place_id")
        if not target_place_id and override.get("target_name"):
            target_place_id = find_place_id_by_name(places_payload, override["target_name"])
        if not target_place_id and override.get("override_type") == "place_alias":
            continue
        row = build_manual_override_row(override, target_place_id)
        if row["override_id"] in seen_ids:
            continue
        seen_ids.add(row["override_id"])
        rows.append(row)

    return rows


def wrap_json_columns(table: str, row: dict[str, Any]) -> dict[str, Any]:
    json_columns = JSON_COLUMNS_BY_TABLE.get(table, set())
    wrapped: dict[str, Any] = {}
    for key, value in row.items():
        wrapped[key] = Jsonb(value) if key in json_columns else value
    return wrapped


class RutaJsonImporter:
    def __init__(self, settings: Settings):
        self._settings = settings

    def _connect(self) -> psycopg.Connection[Any]:
        if not self._settings.database_url:
            raise psycopg.OperationalError("DATABASE_URL is not configured for direct Postgres import.")
        return psycopg.connect(self._settings.database_url)

    def import_from_directory(self, directory: Path) -> None:
        routes_payload = load_payload(directory / "routes.json")
        places_payload = load_payload(directory / "places.json")
        links_payload = load_payload(directory / "route_place_links.json")
        transfers_payload = load_payload(directory / "route_transfers.json")
        clusters_payload = load_payload(directory / "area_clusters.json")
        manual_overrides_path = directory / "manual_overrides.json"
        manual_overrides_payload = load_payload(manual_overrides_path)["overrides"] if manual_overrides_path.exists() else []

        routes = [build_route_row(route) for route in routes_payload["routes"]]
        places = [build_place_row(place) for place in places_payload["places"]]
        links = [build_link_row(link) for link in links_payload["links"]]
        transfers = [build_transfer_row(transfer) for transfer in transfers_payload["transfers"]]
        clusters = [build_cluster_row(cluster) for cluster in clusters_payload["clusters"]]
        manual_overrides = build_manual_override_rows(places_payload["places"], manual_overrides_payload)
        cluster_members = [
            build_cluster_member_row(cluster["cluster_id"], member)
            for cluster in clusters_payload["clusters"]
            for member in cluster.get("members", [])
        ]

        try:
            self._import_via_db(routes, places, clusters, cluster_members, links, transfers, manual_overrides)
        except psycopg.OperationalError:
            self._import_via_rest(routes, places, clusters, cluster_members, links, transfers, manual_overrides)

    def _import_via_rest(
        self,
        routes: list[dict[str, Any]],
        places: list[dict[str, Any]],
        clusters: list[dict[str, Any]],
        cluster_members: list[dict[str, Any]],
        links: list[dict[str, Any]],
        transfers: list[dict[str, Any]],
        manual_overrides: list[dict[str, Any]],
    ) -> None:
        client = SupabaseRestClient(self._settings)
        client.upsert_rows("routes", routes, on_conflict="route_id")
        client.upsert_rows("places", places, on_conflict="place_id")
        client.upsert_rows("area_clusters", clusters, on_conflict="cluster_id")
        client.upsert_rows("area_cluster_members", cluster_members, on_conflict="membership_id")
        client.upsert_rows("route_place_links", links, on_conflict="link_id")
        client.upsert_rows("route_transfers", transfers, on_conflict="transfer_id")
        client.upsert_rows("manual_overrides", manual_overrides, on_conflict="override_id")

    def _import_via_db(
        self,
        routes: list[dict[str, Any]],
        places: list[dict[str, Any]],
        clusters: list[dict[str, Any]],
        cluster_members: list[dict[str, Any]],
        links: list[dict[str, Any]],
        transfers: list[dict[str, Any]],
        manual_overrides: list[dict[str, Any]],
    ) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                for route in routes:
                    cur.execute(
                        """
                        insert into public.routes (
                          route_id, code, label, route_name, origin, destination, source_urls, roads,
                          schools, malls_groceries, churches, government, hotels, health, terminals,
                          info, raw_sections, aliases, road_segments, stops, search_text, embedding_text,
                          area_clusters, raw_payload
                        ) values (
                          %(route_id)s, %(code)s, %(label)s, %(route_name)s, %(origin)s, %(destination)s,
                          %(source_urls)s, %(roads)s, %(schools)s, %(malls_groceries)s, %(churches)s,
                          %(government)s, %(hotels)s, %(health)s, %(terminals)s, %(info)s, %(raw_sections)s,
                          %(aliases)s, %(road_segments)s, %(stops)s, %(search_text)s, %(embedding_text)s,
                          %(area_clusters)s, %(raw_payload)s
                        )
                        on conflict (route_id) do update set
                          code = excluded.code,
                          label = excluded.label,
                          route_name = excluded.route_name,
                          origin = excluded.origin,
                          destination = excluded.destination,
                          source_urls = excluded.source_urls,
                          roads = excluded.roads,
                          schools = excluded.schools,
                          malls_groceries = excluded.malls_groceries,
                          churches = excluded.churches,
                          government = excluded.government,
                          hotels = excluded.hotels,
                          health = excluded.health,
                          terminals = excluded.terminals,
                          info = excluded.info,
                          raw_sections = excluded.raw_sections,
                          aliases = excluded.aliases,
                          road_segments = excluded.road_segments,
                          stops = excluded.stops,
                          search_text = excluded.search_text,
                          embedding_text = excluded.embedding_text,
                          area_clusters = excluded.area_clusters,
                          raw_payload = excluded.raw_payload,
                          updated_at = now()
                        """,
                        wrap_json_columns("routes", route),
                    )

                for place in places:
                    cur.execute(
                        """
                        insert into public.places (
                          place_id, name, canonical_name, normalized_name, type, aliases, normalized_aliases,
                          address, address_aliases, street, barangay, city, province, lat, lng,
                          source_route_codes, source_urls, area_clusters, search_text, embedding_text, raw_payload
                        ) values (
                          %(place_id)s, %(name)s, %(canonical_name)s, %(normalized_name)s, %(type)s,
                          %(aliases)s, %(normalized_aliases)s, %(address)s, %(address_aliases)s, %(street)s,
                          %(barangay)s, %(city)s, %(province)s, %(lat)s, %(lng)s, %(source_route_codes)s,
                          %(source_urls)s, %(area_clusters)s, %(search_text)s, %(embedding_text)s, %(raw_payload)s
                        )
                        on conflict (place_id) do update set
                          name = excluded.name,
                          canonical_name = excluded.canonical_name,
                          normalized_name = excluded.normalized_name,
                          type = excluded.type,
                          aliases = excluded.aliases,
                          normalized_aliases = excluded.normalized_aliases,
                          address = excluded.address,
                          address_aliases = excluded.address_aliases,
                          street = excluded.street,
                          barangay = excluded.barangay,
                          city = excluded.city,
                          province = excluded.province,
                          lat = excluded.lat,
                          lng = excluded.lng,
                          source_route_codes = excluded.source_route_codes,
                          source_urls = excluded.source_urls,
                          area_clusters = excluded.area_clusters,
                          search_text = excluded.search_text,
                          embedding_text = excluded.embedding_text,
                          raw_payload = excluded.raw_payload,
                          updated_at = now()
                        """,
                        wrap_json_columns("places", place),
                    )

                for cluster in clusters:
                    cur.execute(
                        """
                        insert into public.area_clusters (
                          cluster_id, name, aliases, normalized_aliases, keywords, raw_payload
                        ) values (
                          %(cluster_id)s, %(name)s, %(aliases)s, %(normalized_aliases)s, %(keywords)s, %(raw_payload)s
                        )
                        on conflict (cluster_id) do update set
                          name = excluded.name,
                          aliases = excluded.aliases,
                          normalized_aliases = excluded.normalized_aliases,
                          keywords = excluded.keywords,
                          raw_payload = excluded.raw_payload,
                          updated_at = now()
                        """,
                        wrap_json_columns("area_clusters", cluster),
                    )

                for member in cluster_members:
                    cur.execute(
                        """
                        insert into public.area_cluster_members (
                          membership_id, cluster_id, place_id, place_name, place_type, raw_payload
                        ) values (
                          %(membership_id)s, %(cluster_id)s, %(place_id)s, %(place_name)s, %(place_type)s, %(raw_payload)s
                        )
                        on conflict (membership_id) do update set
                          cluster_id = excluded.cluster_id,
                          place_id = excluded.place_id,
                          place_name = excluded.place_name,
                          place_type = excluded.place_type,
                          raw_payload = excluded.raw_payload
                        """,
                        wrap_json_columns("area_cluster_members", member),
                    )

                for link in links:
                    cur.execute(
                        """
                        insert into public.route_place_links (
                          link_id, route_id, place_id, relation, source_field, dropoff_stop,
                          walk_minutes, distance_m, confidence, raw_payload
                        ) values (
                          %(link_id)s, %(route_id)s, %(place_id)s, %(relation)s, %(source_field)s, %(dropoff_stop)s,
                          %(walk_minutes)s, %(distance_m)s, %(confidence)s, %(raw_payload)s
                        )
                        on conflict (link_id) do update set
                          route_id = excluded.route_id,
                          place_id = excluded.place_id,
                          relation = excluded.relation,
                          source_field = excluded.source_field,
                          dropoff_stop = excluded.dropoff_stop,
                          walk_minutes = excluded.walk_minutes,
                          distance_m = excluded.distance_m,
                          confidence = excluded.confidence,
                          raw_payload = excluded.raw_payload
                        """,
                        wrap_json_columns("route_place_links", link),
                    )

                for transfer in transfers:
                    cur.execute(
                        """
                        insert into public.route_transfers (
                          transfer_id, route_id, connects_to_route_id, shared_places, shared_areas,
                          transfer_reason, confidence, raw_payload
                        ) values (
                          %(transfer_id)s, %(route_id)s, %(connects_to_route_id)s, %(shared_places)s, %(shared_areas)s,
                          %(transfer_reason)s, %(confidence)s, %(raw_payload)s
                        )
                        on conflict (transfer_id) do update set
                          route_id = excluded.route_id,
                          connects_to_route_id = excluded.connects_to_route_id,
                          shared_places = excluded.shared_places,
                          shared_areas = excluded.shared_areas,
                          transfer_reason = excluded.transfer_reason,
                          confidence = excluded.confidence,
                          raw_payload = excluded.raw_payload
                        """,
                        wrap_json_columns("route_transfers", transfer),
                    )

                for override in manual_overrides:
                    cur.execute(
                        """
                        insert into public.manual_overrides (
                          override_id, override_type, match_key, normalized_match_key, target_place_id,
                          target_cluster_id, target_route_id, priority, is_active, payload, notes
                        ) values (
                          %(override_id)s, %(override_type)s, %(match_key)s, %(normalized_match_key)s, %(target_place_id)s,
                          %(target_cluster_id)s, %(target_route_id)s, %(priority)s, %(is_active)s, %(payload)s, %(notes)s
                        )
                        on conflict (override_id) do update set
                          override_type = excluded.override_type,
                          match_key = excluded.match_key,
                          normalized_match_key = excluded.normalized_match_key,
                          target_place_id = excluded.target_place_id,
                          target_cluster_id = excluded.target_cluster_id,
                          target_route_id = excluded.target_route_id,
                          priority = excluded.priority,
                          is_active = excluded.is_active,
                          payload = excluded.payload,
                          notes = excluded.notes,
                          updated_at = now()
                        """,
                        wrap_json_columns("manual_overrides", override),
                    )

            conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import RUTA scraper JSON into Postgres or Supabase REST.")
    parser.add_argument(
        "--input-dir",
        default="scrapper",
        help="Directory containing routes.json, places.json, route_place_links.json, route_transfers.json, and area_clusters.json.",
    )
    args = parser.parse_args()

    settings = Settings.from_env()
    importer = RutaJsonImporter(settings)
    importer.import_from_directory(Path(args.input_dir))
    print(f"Imported scraper JSON from {args.input_dir}")


if __name__ == "__main__":
    main()
