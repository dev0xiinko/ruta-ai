from __future__ import annotations

import pytest
from pydantic import ValidationError

from ruta_backend.models import ChatData, ChatResponse, FeedbackResponse, ParseResult, RouteComputationResult, RouteResponse


def test_chat_response_has_explicit_typed_shape() -> None:
    response = ChatResponse(
        data=ChatData(
            parse=ParseResult(intent="route_query", origin_text="IT Park", destination_text="Carbon", language="mixed", confidence="medium"),
            route=RouteResponse(
                result=RouteComputationResult(
                    status="success",
                    mode="direct",
                    message="Ride 17B.",
                )
            ),
        )
    )

    payload = response.model_dump(mode="json")

    assert payload["data"]["parse"]["origin_text"] == "IT Park"
    assert payload["data"]["route"]["result"]["mode"] == "direct"


def test_feedback_response_is_typed_success_payload() -> None:
    assert FeedbackResponse().model_dump(mode="json") == {"ok": True}


def test_schema_models_forbid_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        ParseResult(intent="route_query", language="mixed", confidence="low", unexpected=True)
