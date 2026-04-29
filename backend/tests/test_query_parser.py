from __future__ import annotations

from ruta_backend.services.query_parser import QueryParser


def test_parse_place_to_place_query() -> None:
    parser = QueryParser()

    result = parser.parse("ACT to Cebu Doc")

    assert result.intent == "route_query"
    assert result.origin_text == "ACT"
    assert result.destination_text == "Cebu Doc"
    assert result.confidence == "medium"


def test_parse_route_check_query() -> None:
    parser = QueryParser()

    result = parser.parse("Does 17B pass Cebu Doc?")

    assert result.intent == "route_check"
    assert result.route_code == "17B"
    assert result.destination_text == "Cebu Doc"


def test_parse_route_lookup_query() -> None:
    parser = QueryParser()

    result = parser.parse("17B route details")

    assert result.intent == "route_lookup"
    assert result.route_code == "17B"
    assert result.confidence == "high"
