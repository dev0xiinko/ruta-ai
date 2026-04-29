from __future__ import annotations

from ruta_backend.engine import RutaQueryEngine
from ruta_backend.models import (
    AreaClusterMemberRecord,
    AreaClusterRecord,
    ManualOverrideRecord,
    PlaceRecord,
    RoutePlaceLinkRecord,
    RouteRecord,
    RouteTransferRecord,
    RoutingSnapshot,
)
from ruta_backend.utils import normalize_text


def build_snapshot() -> RoutingSnapshot:
    routes = {
        "17B": RouteRecord(
            route_id="17B",
            code="17B",
            label="17B",
            route_name="Apas to Carbon",
            origin="Apas",
            destination="Carbon",
            source_urls=[],
            area_clusters=["it_park", "fuente", "galleria_pier"],
            search_text="17B Apas IT Park Carbon",
            raw_payload={
                "malls_groceries": ["Cebu IT Park", "Carbon Market"],
                "schools": ["University of San Carlos Main Campus"],
                "roads": ["Salinas Drive", "Gorordo Ave"],
            },
        ),
        "10H": RouteRecord(
            route_id="10H",
            code="10H",
            label="10H",
            route_name="Bulacao to SM",
            origin="Bulacao",
            destination="SM City Cebu",
            source_urls=[],
            area_clusters=["sm_city"],
            search_text="10H Bulacao SM",
            raw_payload={"malls_groceries": ["SM City Cebu"], "roads": ["N. Bacalso Ave"]},
        ),
        "MI-02B": RouteRecord(
            route_id="MI-02B",
            code="MI-02B",
            label="MI-02B",
            route_name="Mandaue to Mactan",
            origin="Mandaue",
            destination="Mactan",
            source_urls=[],
            area_clusters=["mactan"],
            search_text="MI-02B Mactan Airport",
            raw_payload={"malls_groceries": ["Marina Mall"], "roads": ["UN Ave"]},
        ),
    }

    places = {
        "pl_it_park": PlaceRecord(
            place_id="pl_it_park",
            name="Cebu IT Park",
            canonical_name="Cebu IT Park",
            normalized_name=normalize_text("Cebu IT Park"),
            type="district",
            aliases=["IT Park"],
            normalized_aliases=[normalize_text("IT Park")],
            address=None,
            address_aliases=[],
            street=None,
            barangay="Apas",
            city="Cebu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=["it_park"],
            raw_payload={},
        ),
        "pl_carbon": PlaceRecord(
            place_id="pl_carbon",
            name="Carbon Market",
            canonical_name="Carbon Market",
            normalized_name=normalize_text("Carbon Market"),
            type="market",
            aliases=["Carbon"],
            normalized_aliases=[normalize_text("Carbon")],
            address=None,
            address_aliases=[],
            street=None,
            barangay=None,
            city="Cebu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=[],
            raw_payload={},
        ),
        "pl_cebu_doc": PlaceRecord(
            place_id="pl_cebu_doc",
            name="Cebu Doctors University Hospital",
            canonical_name="Cebu Doctors University Hospital",
            normalized_name=normalize_text("Cebu Doctors University Hospital"),
            type="hospital",
            aliases=["Cebu Doc"],
            normalized_aliases=[normalize_text("Cebu Doc")],
            address=None,
            address_aliases=[],
            street=None,
            barangay=None,
            city="Cebu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=["fuente"],
            raw_payload={},
        ),
        "pl_galleria": PlaceRecord(
            place_id="pl_galleria",
            name="Robinsons Galleria Cebu",
            canonical_name="Robinsons Galleria Cebu",
            normalized_name=normalize_text("Robinsons Galleria Cebu"),
            type="mall",
            aliases=["Galleria", "Robinsons Galleria"],
            normalized_aliases=[normalize_text("Galleria"), normalize_text("Robinsons Galleria")],
            address=None,
            address_aliases=[],
            street=None,
            barangay=None,
            city="Cebu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=["galleria_pier"],
            raw_payload={},
        ),
        "pl_bulacao": PlaceRecord(
            place_id="pl_bulacao",
            name="Bulacao",
            canonical_name="Bulacao",
            normalized_name=normalize_text("Bulacao"),
            type="area",
            aliases=[],
            normalized_aliases=[],
            address=None,
            address_aliases=[],
            street=None,
            barangay=None,
            city="Cebu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=[],
            raw_payload={},
        ),
        "pl_mactan_airport": PlaceRecord(
            place_id="pl_mactan_airport",
            name="Mactan Airport",
            canonical_name="Mactan Airport",
            normalized_name=normalize_text("Mactan Airport"),
            type="airport",
            aliases=["Airport", "Mactan-Cebu Airport"],
            normalized_aliases=[normalize_text("Airport"), normalize_text("Mactan-Cebu Airport")],
            address=None,
            address_aliases=[],
            street=None,
            barangay=None,
            city="Lapu-Lapu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=["mactan"],
            raw_payload={},
        ),
        "pl_emall": PlaceRecord(
            place_id="pl_emall",
            name="Elizabeth Mall",
            canonical_name="Elizabeth Mall",
            normalized_name=normalize_text("Elizabeth Mall"),
            type="mall",
            aliases=["E Mall", "Emall"],
            normalized_aliases=[normalize_text("E Mall"), normalize_text("Emall")],
            address=None,
            address_aliases=[],
            street=None,
            barangay=None,
            city="Cebu City",
            province="Cebu",
            lat=None,
            lng=None,
            area_clusters=["fuente"],
            raw_payload={},
        ),
    }

    route_place_links = [
        RoutePlaceLinkRecord(
            link_id="l1",
            route_id="17B",
            place_id="pl_it_park",
            relation="direct_access",
            source_field="stops",
            dropoff_stop="IT Park terminal",
            walk_minutes=None,
            distance_m=None,
            confidence="high",
            raw_payload={},
        ),
        RoutePlaceLinkRecord(
            link_id="l2",
            route_id="17B",
            place_id="pl_carbon",
            relation="direct_access",
            source_field="stops",
            dropoff_stop="Carbon Market",
            walk_minutes=None,
            distance_m=None,
            confidence="high",
            raw_payload={},
        ),
        RoutePlaceLinkRecord(
            link_id="l3",
            route_id="17B",
            place_id="pl_galleria",
            relation="nearby_access",
            source_field="malls_groceries",
            dropoff_stop="Robinsons Galleria Cebu",
            walk_minutes=6,
            distance_m=420,
            confidence="medium",
            raw_payload={},
        ),
        RoutePlaceLinkRecord(
            link_id="l4",
            route_id="17B",
            place_id="pl_cebu_doc",
            relation="area_access",
            source_field="health",
            dropoff_stop=None,
            walk_minutes=8,
            distance_m=550,
            confidence="medium",
            raw_payload={},
        ),
        RoutePlaceLinkRecord(
            link_id="l5",
            route_id="10H",
            place_id="pl_bulacao",
            relation="direct_access",
            source_field="stops",
            dropoff_stop="Bulacao terminal",
            walk_minutes=None,
            distance_m=None,
            confidence="high",
            raw_payload={},
        ),
        RoutePlaceLinkRecord(
            link_id="l6",
            route_id="MI-02B",
            place_id="pl_mactan_airport",
            relation="nearby_access",
            source_field="roads",
            dropoff_stop="Airport road",
            walk_minutes=4,
            distance_m=250,
            confidence="high",
            raw_payload={},
        ),
        RoutePlaceLinkRecord(
            link_id="l7",
            route_id="10H",
            place_id="pl_emall",
            relation="nearby_access",
            source_field="malls_groceries",
            dropoff_stop="Elizabeth Mall",
            walk_minutes=3,
            distance_m=180,
            confidence="high",
            raw_payload={},
        ),
    ]

    route_transfers = [
        RouteTransferRecord(
            transfer_id="t1",
            route_id="10H",
            connects_to_route_id="MI-02B",
            shared_places=["SM City Cebu"],
            shared_areas=["sm_city"],
            transfer_reason="shared_area",
            confidence="high",
            raw_payload={},
        )
    ]

    area_clusters = {
        "it_park": AreaClusterRecord(
            cluster_id="it_park",
            name="IT Park",
            aliases=["IT Park"],
            normalized_aliases=[normalize_text("IT Park")],
            keywords=["Lahug"],
            raw_payload={},
        ),
        "fuente": AreaClusterRecord(
            cluster_id="fuente",
            name="Fuente",
            aliases=["Fuente Osmena"],
            normalized_aliases=[normalize_text("Fuente Osmena")],
            keywords=[],
            raw_payload={},
        ),
        "galleria_pier": AreaClusterRecord(
            cluster_id="galleria_pier",
            name="Galleria Pier",
            aliases=["Galleria", "Pier"],
            normalized_aliases=[normalize_text("Galleria"), normalize_text("Pier")],
            keywords=[],
            raw_payload={},
        ),
        "sm_city": AreaClusterRecord(
            cluster_id="sm_city",
            name="SM City",
            aliases=["SM"],
            normalized_aliases=[normalize_text("SM")],
            keywords=[],
            raw_payload={},
        ),
        "mactan": AreaClusterRecord(
            cluster_id="mactan",
            name="Mactan",
            aliases=["Lapu-Lapu"],
            normalized_aliases=[normalize_text("Lapu-Lapu")],
            keywords=["Airport"],
            raw_payload={},
        ),
    }

    area_cluster_members = [
        AreaClusterMemberRecord(
            membership_id="m1",
            cluster_id="it_park",
            place_id="pl_it_park",
            place_name="Cebu IT Park",
            place_type="district",
            raw_payload={},
        ),
        AreaClusterMemberRecord(
            membership_id="m2",
            cluster_id="fuente",
            place_id="pl_cebu_doc",
            place_name="Cebu Doctors University Hospital",
            place_type="hospital",
            raw_payload={},
        ),
        AreaClusterMemberRecord(
            membership_id="m3",
            cluster_id="galleria_pier",
            place_id="pl_galleria",
            place_name="Robinsons Galleria Cebu",
            place_type="mall",
            raw_payload={},
        ),
        AreaClusterMemberRecord(
            membership_id="m4",
            cluster_id="mactan",
            place_id="pl_mactan_airport",
            place_name="Mactan Airport",
            place_type="airport",
            raw_payload={},
        ),
    ]

    manual_overrides = [
        ManualOverrideRecord(
            override_id="o1",
            override_type="place_alias",
            match_key="cebu doc",
            normalized_match_key=normalize_text("cebu doc"),
            target_place_id="pl_cebu_doc",
            target_cluster_id=None,
            target_route_id=None,
            priority=200,
            is_active=True,
            payload={},
            notes=None,
        )
    ]

    return RoutingSnapshot(
        routes=routes,
        places=places,
        route_place_links=route_place_links,
        route_transfers=route_transfers,
        area_clusters=area_clusters,
        area_cluster_members=area_cluster_members,
        manual_overrides=manual_overrides,
    )


def test_alias_resolution() -> None:
    engine = RutaQueryEngine(build_snapshot())
    resolved = engine.resolve_text("it park")

    assert resolved is not None
    assert resolved.display_name == "IT Park"


def test_area_cluster_resolution() -> None:
    engine = RutaQueryEngine(build_snapshot())
    resolved = engine.resolve_text("galleria")

    assert resolved is not None
    assert resolved.entity_type == "place" or resolved.entity_type == "cluster"
    assert "pl_galleria" in resolved.place_ids


def test_cluster_resolution_preserves_user_facing_label_case() -> None:
    engine = RutaQueryEngine(build_snapshot())
    candidates = engine.resolve_candidates("IT Park")

    assert candidates
    assert candidates[0].display_name == "IT Park"


def test_fuzzy_partial_resolution_handles_rob_galleria() -> None:
    engine = RutaQueryEngine(build_snapshot())
    candidates = engine.resolve_candidates("rob galleria")

    assert candidates
    assert any("pl_galleria" in candidate.place_ids for candidate in candidates)


def test_broad_area_resolution_handles_lapulapu_and_emall() -> None:
    engine = RutaQueryEngine(build_snapshot())

    lapulapu_candidates = engine.resolve_candidates("lapulapu")
    emall_candidates = engine.resolve_candidates("emall")

    assert lapulapu_candidates
    assert any("mactan" in candidate.cluster_ids or "pl_mactan_airport" in candidate.place_ids for candidate in lapulapu_candidates)
    assert emall_candidates
    assert any("pl_emall" in candidate.place_ids for candidate in emall_candidates)


def test_resolved_place_prefers_user_facing_label_when_multiple_places_match() -> None:
    snapshot = build_snapshot()
    snapshot.places["pl_it_park_side_alias"] = PlaceRecord(
        place_id="pl_it_park_side_alias",
        name="Lahug Barangay Hall",
        canonical_name="Lahug Barangay Hall",
        normalized_name=normalize_text("Lahug Barangay Hall"),
        type="government",
        aliases=["IT Park"],
        normalized_aliases=[normalize_text("IT Park")],
        address=None,
        address_aliases=[],
        street=None,
        barangay="Lahug",
        city="Cebu City",
        province="Cebu",
        lat=None,
        lng=None,
        area_clusters=["it_park"],
        raw_payload={},
    )

    engine = RutaQueryEngine(snapshot)
    resolved = engine.resolve_text("IT Park")

    assert resolved is not None
    assert resolved.display_name == "IT Park"


def test_resolved_place_preserves_user_alias_label_for_exact_single_match() -> None:
    engine = RutaQueryEngine(build_snapshot())
    resolved = engine.resolve_text("Robinsons Galleria")

    assert resolved is not None
    assert resolved.display_name == "Robinsons Galleria"


def test_direct_route_answer() -> None:
    engine = RutaQueryEngine(build_snapshot())
    response = engine.answer_query("IT Park to Carbon")

    assert response.response_type == "direct_access"
    assert response.routes[0]["route_code"] == "17B"


def test_nearby_route_answer() -> None:
    engine = RutaQueryEngine(build_snapshot())
    response = engine.answer_query("IT Park to Robinsons Galleria")

    assert response.response_type == "nearby_access"
    assert response.routes[0]["route_code"] == "17B"


def test_transfer_route_answer() -> None:
    engine = RutaQueryEngine(build_snapshot())
    response = engine.answer_query("Bulacao to Mactan Airport")

    assert response.response_type == "transfer_required"
    assert response.routes[0]["first_route"] == "10H"
    assert response.routes[0]["second_route"] == "MI-02B"


def test_fallback_planner_returns_guidance_instead_of_no_match() -> None:
    engine = RutaQueryEngine(build_snapshot())
    response = engine.answer_query("IT Park to Mactan Airport")

    assert response.response_type == "transfer_required"
    assert response.routes[0]["first_route"] == "17B"
    assert response.routes[0]["second_route"] == "MI-02B"
    assert response.routes[0]["fallback"] is True


def test_route_check_uses_area_logic() -> None:
    engine = RutaQueryEngine(build_snapshot())
    response = engine.answer_query("Does 17B pass Cebu Doc?")

    assert response.response_type == "area_access"
    assert response.route_code == "17B"


def test_route_check_supports_nearby_access() -> None:
    engine = RutaQueryEngine(build_snapshot())
    response = engine.answer_query("Does 17B pass Galleria?")

    assert response.response_type == "nearby_access"
    assert response.route_code == "17B"


def test_weak_direct_source_fields_are_downgraded() -> None:
    engine = RutaQueryEngine(build_snapshot())
    snapshot = build_snapshot()
    snapshot.route_place_links.append(
        RoutePlaceLinkRecord(
            link_id="l8",
            route_id="17B",
            place_id="pl_cebu_doc",
            relation="direct_access",
            source_field="schools",
            dropoff_stop=None,
            walk_minutes=0,
            distance_m=0.0,
            confidence="high",
            raw_payload={},
        )
    )
    engine = RutaQueryEngine(snapshot)

    response = engine.answer_query("Does 17B pass Cebu Doc?")

    assert response.response_type in {"nearby_access", "area_access"}
    assert response.route_code == "17B"


def test_manual_override_precedence() -> None:
    engine = RutaQueryEngine(build_snapshot())
    resolved = engine.resolve_text("cebu doc")

    assert resolved is not None
    assert resolved.place_ids == ["pl_cebu_doc"]
    assert resolved.display_name == "Cebu Doc"


def test_route_lookup_allows_common_route_phrasing() -> None:
    engine = RutaQueryEngine(build_snapshot())

    for query in ("17B routes", "17b route", "route 17B", "17B code"):
        response = engine.answer_query(query)
        assert response.response_type == "route_lookup"
        assert response.route_code == "17B"
