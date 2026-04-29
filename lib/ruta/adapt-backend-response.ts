import type {
  BackendRouteEntry,
  BackendRouteQueryResponse,
  RutaBotResponse,
} from "@/lib/ruta/contracts";

function confidenceMeta(score: number) {
  if (score >= 0.85) {
    return {
      confidence: "High confidence",
      reasoningLevel: "high" as const,
      reasoningLabel: "Strong match",
      instructionLevel: "direct" as const,
      instructionLabel: "Direct guide",
      confidenceNote: "This looks like a strong match from the live route database.",
    };
  }

  if (score >= 0.6) {
    return {
      confidence: "Medium confidence",
      reasoningLevel: "medium" as const,
      reasoningLabel: "Usable match",
      instructionLevel: "guided" as const,
      instructionLabel: "Guided answer",
      confidenceNote:
        "This looks usable, but it is still best to double-check the signboard before boarding.",
    };
  }

  return {
    confidence: "Low confidence",
    reasoningLevel: "low" as const,
    reasoningLabel: "Needs checking",
    instructionLevel: "shortlist" as const,
    instructionLabel: "Shortlist only",
    confidenceNote:
      "This is only a weak match from the current data, so treat it as a shortlist, not a final answer.",
  };
}

function humanizeMatchType(value?: string | null) {
  return (value || "route option").replace(/_/g, " ");
}

function buildPrimaryMatch(
  entry: BackendRouteEntry | undefined,
  fallbackCode: string | null,
  responseType: string,
  confidence: number
) {
  const code = entry?.route_code || entry?.first_route || fallbackCode;
  if (!code) return null;

  return {
    code,
    route_name: entry?.route_name ?? null,
    origin: entry?.origin ?? null,
    destination: entry?.destination ?? null,
    qa_status: responseType,
    completeness_score: Math.round(confidence * 100),
  };
}

function buildMatches(
  routes: BackendRouteEntry[],
  responseType: string,
  confidence: number,
  fallbackCode: string | null
) {
  if (routes.length === 0 && fallbackCode) {
    return [
      {
        code: fallbackCode,
        route_name: null,
        origin: null,
        destination: null,
        qa_status: responseType,
        completeness_score: Math.round(confidence * 100),
      },
    ];
  }

  return routes
    .map((entry) => {
      const code = entry.route_code || entry.first_route;
      if (!code) return null;
      return {
        code,
        route_name: entry.route_name ?? null,
        origin: entry.origin ?? null,
        destination: entry.destination ?? null,
        qa_status: entry.match_type || responseType,
        completeness_score: Math.round((entry.score ?? confidence) * 100),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}

function buildLookFor(
  data: BackendRouteQueryResponse,
  primaryMatch: RutaBotResponse["primaryMatch"]
) {
  const first = data.routes[0];
  if (data.query_kind === "route_lookup" && primaryMatch) {
    return `Ride a jeep marked ${primaryMatch.code} and confirm the signboard says ${
      first?.signboard || `${primaryMatch.origin || "origin"} to ${primaryMatch.destination || "destination"}`
    }.`;
  }

  if (data.query_kind === "place_to_place" && primaryMatch) {
    return `Look for ${primaryMatch.code} and confirm the signboard or route wording matches your direction before boarding.`;
  }

  if (data.query_kind === "route_check" && primaryMatch) {
    return `Check for jeep code ${primaryMatch.code}, then ask the driver if they pass ${data.destination?.display_name || "your stop"}.`;
  }

  return "";
}

function buildTripSteps(data: BackendRouteQueryResponse) {
  const first = data.routes[0];
  if (data.query_kind !== "place_to_place" || !first) return [];

  if (first.first_route && first.second_route) {
    return [
      {
        title: "Step 1",
        instruction: `Ride ${first.first_route} from ${data.origin?.display_name || "your starting point"}.`,
        landmarks: [],
      },
      {
        title: "Step 2",
        instruction: `Transfer to ${first.second_route}${
          first.transfer_hint ? ` around ${first.transfer_hint}` : ""
        } and continue to ${data.destination?.display_name || "your destination"}.`,
        landmarks: first.transfer_hint ? [first.transfer_hint] : [],
      },
    ];
  }

  const landmarks = first.key_landmarks || [];
  return [
    {
      title: "Step 1",
      instruction: `Ride ${first.route_code || "the jeep"} from ${
        data.origin?.display_name || "your starting point"
      } toward ${data.destination?.display_name || "your destination"}.`,
      landmarks,
    },
  ];
}

function buildCommuterSteps(
  data: BackendRouteQueryResponse,
  primaryMatch: RutaBotResponse["primaryMatch"]
) {
  const first = data.routes[0];
  if (!primaryMatch) {
    return [
      "Check the route suggestions below.",
      "Match the signboard with your destination before boarding.",
      "Ask the driver or conductor if you are unsure.",
    ];
  }

  if (first?.first_route && first?.second_route) {
    return [
      `Ride ${first.first_route} from ${data.origin?.display_name || "your origin"}.`,
      `Transfer to ${first.second_route}${first.transfer_hint ? ` around ${first.transfer_hint}` : ""}.`,
      `Get off when you reach ${data.destination?.display_name || "your destination"}.`,
    ];
  }

  const steps = [
    `Look for jeep code ${primaryMatch.code}.`,
    primaryMatch.destination
      ? `Check if the signboard is going to ${primaryMatch.destination}.`
      : "Check the signboard before boarding.",
  ];

  if (first?.dropoff_stop) {
    steps.push(`Best drop-off clue: ${first.dropoff_stop}.`);
  } else if (data.destination?.display_name) {
    steps.push(`Get off near ${data.destination.display_name}.`);
  }

  return steps;
}

function buildSections(
  data: BackendRouteQueryResponse,
  primaryMatch: RutaBotResponse["primaryMatch"]
) {
  const sections: RutaBotResponse["sections"] = [];

  if (data.routes.length > 1) {
    const alternatives = data.routes
      .slice(primaryMatch ? 1 : 0, 4)
      .map((entry) => {
        if (entry.first_route && entry.second_route) {
          return `${entry.first_route} then ${entry.second_route}${
            entry.transfer_hint ? ` via ${entry.transfer_hint}` : ""
          }`;
        }

        return `${entry.route_code || "Route"}${
          entry.route_name ? ` - ${entry.route_name}` : ""
        } (${humanizeMatchType(entry.match_type)})`;
      });

    if (alternatives.length > 0) {
      sections.push({
        title: "Other possible rides",
        items: alternatives,
      });
    }
  }

  if (data.response_type === "transfer_required") {
    sections.push({
      title: "Transfer note",
      items: [
        "This trip likely needs two jeeps.",
        "Confirm the transfer point on the ground before continuing.",
      ],
    });
  }

  return sections;
}

function buildSuggestions(data: BackendRouteQueryResponse) {
  if (data.response_type !== "no_match") return [];

  return [
    "Try a more specific origin and destination.",
    "Use a landmark, mall, school, or terminal name.",
    "Ask for a route code directly if you already know it.",
  ];
}

export function adaptBackendRouteQueryResponse(
  data: BackendRouteQueryResponse
): RutaBotResponse {
  const first = data.routes[0];
  const primaryMatch = buildPrimaryMatch(first, data.route_code, data.response_type, data.confidence);
  const matches = buildMatches(data.routes, data.response_type, data.confidence, data.route_code);
  const {
    confidence,
    reasoningLevel,
    reasoningLabel,
    instructionLevel,
    instructionLabel,
    confidenceNote,
  } = confidenceMeta(data.confidence);

  const routeLookupLandmarks = first?.key_landmarks || [];
  const routeLookupRoadClues = first?.road_clues || [];

  const mode: RutaBotResponse["mode"] =
    data.response_type === "no_match"
      ? "not_found"
      : data.query_kind === "route_lookup"
        ? "route_code"
        : data.query_kind === "place_to_place"
          ? "trip_search"
          : "place_search";

  const title =
    data.query_kind === "route_lookup"
      ? `${data.route_code || primaryMatch?.code || "Route"} route details`
      : data.query_kind === "place_to_place"
        ? `${data.origin?.display_name || "Origin"} to ${data.destination?.display_name || "Destination"}`
        : data.query_kind === "route_check"
          ? `${data.route_code || "Route"} check`
          : data.destination?.display_name || "Route results";

  const lead =
    data.query_kind === "route_lookup"
      ? data.answer
      : data.query_kind === "place_to_place"
        ? `Guide from ${data.origin?.display_name || "your origin"} to ${
            data.destination?.display_name || "your destination"
          }`
        : data.answer;

  const summary =
    data.response_type === "no_match"
      ? "I could not confirm a dependable ride from the current database yet."
      : data.answer;

  return {
    query: data.query,
    mode,
    greeting:
      mode === "not_found"
        ? "Here is what I could confirm so far."
        : "Here is the clearest route guide I found for you.",
    title,
    summary,
    lead,
    answer: data.answer,
    confidence,
    lookFor: buildLookFor(data, primaryMatch),
    keyLandmarks: routeLookupLandmarks,
    roadClues: routeLookupRoadClues,
    tip:
      data.response_type === "transfer_required"
        ? "Ask the driver where the best transfer point is before you get off."
        : "If the signboard looks different on the ground, ask the driver before boarding.",
    tripSteps: buildTripSteps(data),
    reasoningLevel,
    reasoningLabel,
    instructionLevel,
    instructionLabel,
    confidenceNote,
    commuterSteps: buildCommuterSteps(data, primaryMatch),
    sections: buildSections(data, primaryMatch),
    suggestions: buildSuggestions(data),
    map: {
      feasible: false,
      kind: "none",
      note: "Map view is not included in this response yet.",
      points: [],
    },
    primaryMatch,
    matches,
  };
}

