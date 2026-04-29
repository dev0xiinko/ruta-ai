from __future__ import annotations

import argparse

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .importer import build_manual_override_rows
from .settings import Settings


def sync_cleanup(settings: Settings) -> None:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required for cleanup sync.")

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                """
                update public.route_place_links
                set relation = case
                    when relation = 'direct_access' and source_field in ('origin', 'destination', 'stops', 'terminals') then 'direct_access'
                    when relation = 'direct_access' and source_field = 'roads' then 'nearby_access'
                    when relation = 'direct_access' and source_field in ('schools', 'malls_groceries', 'health', 'government', 'churches', 'hotels')
                        and ((coalesce(walk_minutes, 0) > 0) or (coalesce(distance_m, 0) > 0)) then 'nearby_access'
                    when relation = 'direct_access' and source_field in ('schools', 'malls_groceries', 'health', 'government', 'churches', 'hotels') then 'area_access'
                    when relation = 'nearby_access' and source_field in ('schools', 'malls_groceries', 'health', 'government', 'churches', 'hotels', 'roads')
                        and coalesce(walk_minutes, 0) = 0 and coalesce(distance_m, 0) = 0 then 'area_access'
                    else relation
                end,
                walk_minutes = case
                    when relation = 'direct_access' and source_field in ('schools', 'malls_groceries', 'health', 'government', 'churches', 'hotels') and coalesce(walk_minutes, 0) = 0 then 5
                    when relation = 'direct_access' and source_field = 'roads' and coalesce(walk_minutes, 0) = 0 then 3
                    when relation = 'nearby_access' and coalesce(walk_minutes, 0) = 0 then 3
                    else walk_minutes
                end,
                distance_m = case
                    when relation = 'direct_access' and source_field in ('schools', 'malls_groceries', 'health', 'government', 'churches', 'hotels') and coalesce(distance_m, 0) = 0 then 350
                    when relation = 'direct_access' and source_field = 'roads' and coalesce(distance_m, 0) = 0 then 220
                    when relation = 'nearby_access' and coalesce(distance_m, 0) = 0 then 220
                    else distance_m
                end,
                confidence = case
                    when relation = 'direct_access' and source_field in ('schools', 'malls_groceries', 'health', 'government', 'churches', 'hotels') then 'low'
                    when relation = 'direct_access' and source_field = 'roads' then 'medium'
                    when relation = 'nearby_access' and confidence = 'high' then 'medium'
                    else confidence
                end
                """
            )

            cur.execute(
                """
                update public.route_transfers
                set confidence = case
                    when transfer_reason = 'shared_area' and coalesce(jsonb_array_length(shared_places), 0) = 0 then 'low'
                    when transfer_reason = 'shared_place' and coalesce(jsonb_array_length(shared_places), 0) <= 1 and confidence = 'high' then 'medium'
                    else confidence
                end
                """
            )

            places_rows = cur.execute(
                """
                select place_id, name, canonical_name, aliases, address_aliases
                from public.places
                """
            ).fetchall()

            override_rows = build_manual_override_rows(list(places_rows))
            override_keys = [row["normalized_match_key"] for row in override_rows]

            if override_keys:
                cur.execute(
                    "delete from public.manual_overrides where normalized_match_key = any(%s)",
                    (override_keys,),
                )

            for override in override_rows:
                cur.execute(
                    """
                    insert into public.manual_overrides (
                      override_type, match_key, normalized_match_key, target_place_id,
                      target_cluster_id, target_route_id, priority, is_active, payload, notes
                    ) values (
                      %(override_type)s, %(match_key)s, %(normalized_match_key)s, %(target_place_id)s,
                      %(target_cluster_id)s, %(target_route_id)s, %(priority)s, %(is_active)s, %(payload)s, %(notes)s
                    )
                    """,
                    {
                        **override,
                        "payload": Jsonb(override["payload"]),
                    },
                )


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply live DB cleanup sync for route links, transfers, and Cebu overrides.")
    parser.parse_args()
    sync_cleanup(Settings.from_env())
    print("Applied cleanup sync to Supabase.")


if __name__ == "__main__":
    main()
