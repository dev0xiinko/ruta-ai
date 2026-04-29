import type { RouteMapOverview as MapOverview } from "@/lib/ruta/contracts";
import { dedupeDisplayNames } from "@/lib/ruta-engine/place-resolver";
import type {
  ParsedQuery,
  PlaceEntity,
  RouteBotResponse,
  RouteCandidate,
  StructuredRoute,
} from "@/lib/ruta-engine/types";

function toMatch(route: StructuredRoute) {
  return {
    code: route.code,
    route_name: route.raw.route_name,
    origin: route.raw.origin,
    destination: route.raw.destination,
    qa_status: route.raw.qa_status,
    completeness_score: route.raw.completeness_score,
  };
}

function confidenceLabel(score: number) {
  if (score >= 0.85) return "High confidence";
  if (score >= 0.6) return "Likely match";
  return "Low confidence";
}

function reasoningLevel(score: number) {
  if (score >= 0.85) return "high" as const;
  if (score >= 0.6) return "medium" as const;
  return "low" as const;
}

function reasoningLabel(score: number) {
  if (score >= 0.85) return "Strong route match";
  if (score >= 0.6) return "Usable route match";
  return "Needs confirmation";
}

function buildLookFor(route: StructuredRoute) {
  if (route.start && route.end) {
    return `Ride a jeep marked ${route.code} and check if the signboard says ${route.start} - ${route.end}.`;
  }

  return `Ride a jeep marked ${route.code} and confirm the signboard before boarding.`;
}

function buildRoadClues(route: StructuredRoute) {
  return route.roads.slice(0, 3);
}

function buildKeyLandmarks(route: StructuredRoute, extra: string[] = []) {
  return dedupeDisplayNames([
    route.start,
    ...extra,
    ...route.landmarks,
    route.end,
  ]).slice(0, 6);
}

function buildTripSteps(route: StructuredRoute, origin: PlaceEntity, destination: PlaceEntity) {
  const originIndex =
    route.stops.find((stop) => stop.key === origin.normalizedCanonical)?.order ?? 1;
  const destinationIndex =
    route.stops.find((stop) => stop.key === destination.normalizedCanonical)?.order ??
    route.stops.length;

  const betweenStops = route.stops.filter(
    (stop) => stop.order >= originIndex && stop.order <= destinationIndex
  );

  const earlyLandmarks = dedupeDisplayNames(
    betweenStops.slice(0, 3).map((stop) => stop.name)
  ).slice(0, 4);
  const lateLandmarks = dedupeDisplayNames(
    betweenStops.slice(Math.max(0, betweenStops.length - 3)).map((stop) => stop.name)
  ).slice(0, 4);

  return [
    {
      title: "Step 1",
      instruction: `Ride ${route.code} from the ${origin.displayName} side.`,
      landmarks: dedupeDisplayNames([origin.displayName, ...earlyLandmarks]).slice(0, 4),
    },
    {
      title: "Step 2",
      instruction: `Stay on until the ${destination.displayName} area, then get off nearby.`,
      landmarks: dedupeDisplayNames([...lateLandmarks, destination.displayName]).slice(0, 4),
    },
  ];
}

function defaultMap() {
  return {
    feasible: false,
    kind: "none" as const,
    note: "Map preview is not available for this response yet.",
    points: [],
  };
}

function buildBaseResponse(
  query: string,
  mode: RouteBotResponse["mode"],
  map?: MapOverview
) {
  return {
    query,
    mode,
    reasoningLevel: "low" as const,
    reasoningLabel: "",
    instructionLevel: "guided" as const,
    instructionLabel: "",
    confidenceNote: "",
    commuterSteps: [] as string[],
    sections: [] as RouteBotResponse["sections"],
    suggestions: [] as string[],
    map: map ?? defaultMap(),
    primaryMatch: null,
    matches: [] as RouteBotResponse["matches"],
  };
}

export function buildRouteCodeResponse(
  query: Extract<ParsedQuery, { type: "route_code" }>,
  candidates: RouteCandidate[],
  map?: MapOverview
): RouteBotResponse {
  const top = candidates[0];
  const route = top.route;
  const score = top.score;

  return {
    ...buildBaseResponse(query.raw, "route_code", map),
    greeting: "Hi! Here is a quick guide for that jeep code.",
    title: `Route ${route.code}`,
    summary: `${route.code} usually runs as ${route.signboard}.`,
    lead: route.start && route.end
      ? `${route.code} usually runs from ${route.start} to ${route.end}.`
      : `${route.code} is the jeep code to check.`,
    answer: route.start && route.end
      ? `${route.code} usually runs from ${route.start} to ${route.end}.`
      : `${route.code} is available in the current route list.`,
    confidence: confidenceLabel(score),
    lookFor: buildLookFor(route),
    keyLandmarks: buildKeyLandmarks(route),
    roadClues: buildRoadClues(route),
    tip: "If the signboard wording looks different, ask the driver before boarding.",
    tripSteps: [],
    reasoningLevel: reasoningLevel(score),
    reasoningLabel: reasoningLabel(score),
    instructionLevel: "guided",
    instructionLabel: "Boarding guide",
    confidenceNote:
      score >= 0.85
        ? "This jeep code is a strong exact match."
        : "This jeep code matches the route list, but confirm the signboard before boarding.",
    commuterSteps: [
      `Look for a jeep marked ${route.code}.`,
      buildLookFor(route),
      route.end
        ? `If you are unsure where to get off, tell the driver you are heading to ${route.end}.`
        : "If you are unsure where to get off, ask the driver before boarding.",
    ],
    sections: [
      {
        title: "Route details",
        items: [
          `Signboard: ${route.signboard}`,
          route.start && route.end
            ? `Recorded endpoints: ${route.start} to ${route.end}`
            : "Recorded endpoints are limited for this route.",
        ],
      },
    ],
    suggestions: [
      "Ask a trip like “How do I get from IT Park to Colon?”",
      "Ask another jeep code like “What is 12L?”",
    ],
    primaryMatch: toMatch(route),
    matches: candidates.map((candidate) => toMatch(candidate.route)),
  };
}

export function buildTripResponse(
  query: Extract<ParsedQuery, { type: "place_to_place" }>,
  origin: PlaceEntity,
  destination: PlaceEntity,
  directCandidates: RouteCandidate[],
  fallbackCandidates: RouteCandidate[],
  map?: MapOverview
): RouteBotResponse {
  const top = directCandidates[0] ?? fallbackCandidates[0];
  const route = top?.route ?? null;
  const score = top?.score ?? 0;
  const direct = directCandidates.length > 0 && score >= 0.6;

  if (!route) {
    return buildNotFoundResponse(
      query.raw,
      "I could not confirm one direct jeep for that trip yet.",
      map
    );
  }

  const topCodes = (direct ? directCandidates : fallbackCandidates)
    .slice(0, 3)
    .map((candidate) => candidate.route.code)
    .join(", ");

  return {
    ...buildBaseResponse(query.raw, "trip_search", map),
    greeting: direct
      ? "Hi! Here is the clearest ride to check first for your trip."
      : "Hi! I found the closest routes to inspect for your trip.",
    title: `Routes from ${origin.displayName} to ${destination.displayName}`,
    summary: direct
      ? `Start with ${route.code}. Other likely jeep codes are ${topCodes}.`
      : `I could not confirm one direct jeep yet. The closest routes to inspect are ${topCodes}.`,
    lead: direct
      ? `Start with jeep code ${route.code}${route.signboard ? ` (${route.signboard})` : ""}.`
      : `I could not confirm a one-ride answer from ${origin.displayName} to ${destination.displayName}.`,
    answer: direct
      ? score >= 0.85
        ? `${route.code} looks like the best direct jeep from ${origin.displayName} to ${destination.displayName}.`
        : `${route.code} looks like the most likely jeep from ${origin.displayName} to ${destination.displayName}, but confirm the signboard before boarding.`
      : `I could not safely give one direct jeep for ${origin.displayName} to ${destination.displayName}. Please check the likely route codes below and confirm on the ground.`,
    confidence: confidenceLabel(score),
    lookFor: direct ? buildLookFor(route) : "",
    keyLandmarks: buildKeyLandmarks(route, [origin.displayName, destination.displayName]),
    roadClues: buildRoadClues(route),
    tip: direct
      ? "If the signboard looks different on the ground, ask the driver before boarding."
      : "Since the route match is weak, ask the driver or dispatcher before boarding.",
    tripSteps: direct ? buildTripSteps(route, origin, destination) : [],
    reasoningLevel: reasoningLevel(score),
    reasoningLabel: reasoningLabel(score),
    instructionLevel: direct ? (score >= 0.85 ? "direct" : "guided") : "shortlist",
    instructionLabel: direct ? "Trip guide" : "Shortlist only",
    confidenceNote: direct
      ? score >= 0.85
        ? "This looks like a reliable direct ride from the current route data."
        : "This looks like the best route to check first, but confirm the signboard before boarding."
      : "I found related routes, but I could not safely confirm one direct jeep in the correct direction.",
    commuterSteps: direct
      ? [
          `Go to the loading area near ${origin.displayName}.`,
          `Check for jeep code ${route.code}.`,
          `Stay on until the ${destination.displayName} area.`,
        ]
      : [
          `Start near ${origin.displayName}.`,
          "Check the likely jeep codes listed below.",
          `Ask the driver if the jeep is heading toward ${destination.displayName}.`,
        ],
    sections: [
      {
        title: "Trip checked",
        items: [
          `Origin: ${origin.displayName}`,
          `Destination: ${destination.displayName}`,
        ],
      },
      {
        title: direct ? "Best jeep to check first" : "Likely jeep codes to inspect",
        items: (direct ? directCandidates : fallbackCandidates)
          .slice(0, 3)
          .map((candidate) => `${candidate.route.code} - ${candidate.route.signboard}`),
      },
    ],
    suggestions: [
      "Ask for one of the jeep codes to inspect it more closely.",
      "Try a more specific pickup or drop-off point if you know one.",
    ],
    primaryMatch: toMatch(route),
    matches: (direct ? directCandidates : fallbackCandidates).map((candidate) =>
      toMatch(candidate.route)
    ),
  };
}

export function buildDestinationCheckResponse(
  query: Extract<ParsedQuery, { type: "destination_check" }>,
  target: PlaceEntity | null,
  candidates: RouteCandidate[],
  map?: MapOverview
): RouteBotResponse {
  if (!query.routeCode) {
    return buildNotFoundResponse(
      query.raw,
      "Tell me the jeep code too, like “Does 17B pass Ayala?”",
      map
    );
  }

  if (!target) {
    return buildNotFoundResponse(
      query.raw,
      "I could not clearly identify that destination yet.",
      map
    );
  }

  const top = candidates[0];
  if (!top) {
    return buildNotFoundResponse(
      query.raw,
      `I could not find route code ${query.routeCode} in the current route list.`,
      map
    );
  }

  const route = top.route;
  const score = top.score;
  const passesTarget = top.targetIndex !== null;

  return {
    ...buildBaseResponse(query.raw, "route_code", map),
    greeting: "Hi! I checked that jeep code for you.",
    title: `Does ${route.code} pass ${target.displayName}?`,
    summary: passesTarget
      ? `${route.code} includes ${target.displayName} in its recorded route path.`
      : `${route.code} does not clearly show ${target.displayName} in its recorded route path.`,
    lead: passesTarget
      ? score >= 0.85
        ? `Yes, ${route.code} usually passes ${target.displayName}.`
        : `${route.code} likely passes ${target.displayName}, but please confirm on the signboard.`
      : `I could not confirm that ${route.code} passes ${target.displayName}.`,
    answer: passesTarget
      ? score >= 0.85
        ? `${route.code} usually passes ${target.displayName}.`
        : `${route.code} likely passes ${target.displayName}, but confirm before boarding.`
      : `${route.code} does not clearly show ${target.displayName} in the current route data.`,
    confidence: confidenceLabel(score),
    lookFor: buildLookFor(route),
    keyLandmarks: buildKeyLandmarks(route, [target.displayName]),
    roadClues: buildRoadClues(route),
    tip: passesTarget
      ? "If the driver uses a shorter signboard, ask if they pass your stop before boarding."
      : "If you are already at the terminal, ask the driver directly before boarding.",
    tripSteps: [],
    reasoningLevel: reasoningLevel(score),
    reasoningLabel: reasoningLabel(score),
    instructionLevel: passesTarget ? "guided" : "shortlist",
    instructionLabel: passesTarget ? "Route check" : "Needs confirmation",
    confidenceNote: passesTarget
      ? score >= 0.85
        ? "The stop appears in the recorded route sequence."
        : "The stop likely appears in the route path, but the route details are not strong enough to be absolute."
      : "The target stop does not appear clearly enough in the recorded route path.",
    commuterSteps: passesTarget
      ? [
          `Look for jeep code ${route.code}.`,
          `Check the signboard for ${route.start ?? route.code} - ${route.end ?? target.displayName}.`,
          `Tell the driver you are getting off at ${target.displayName}.`,
        ]
      : [
          `Look for jeep code ${route.code}.`,
          `Ask the driver directly if they pass ${target.displayName}.`,
          "Wait for confirmation before boarding.",
        ],
    sections: [
      {
        title: "Route details",
        items: [
          `Signboard: ${route.signboard}`,
          route.start && route.end
            ? `Recorded endpoints: ${route.start} to ${route.end}`
            : "Recorded endpoints are limited for this route.",
        ],
      },
    ],
    suggestions: [
      `Ask a full trip like “${target.displayName} to Colon”.`,
      `Ask another code like “What is ${route.code}?”`,
    ],
    primaryMatch: toMatch(route),
    matches: candidates.map((candidate) => toMatch(candidate.route)),
  };
}

export function buildPlaceSearchResponse(
  query: Extract<ParsedQuery, { type: "place_search" }>,
  place: PlaceEntity,
  candidates: RouteCandidate[],
  map?: MapOverview
): RouteBotResponse {
  const top = candidates[0];
  const topCodes = candidates.slice(0, 5).map((candidate) => candidate.route.code).join(", ");

  return {
    ...buildBaseResponse(query.raw, "place_search", map),
    greeting: "Hi! Here are the jeep codes that usually pass near that place.",
    title: `Routes related to ${place.displayName}`,
    summary: `The closest jeep codes I found for ${place.displayName} are ${topCodes}.`,
    lead: top
      ? `If you are near ${place.displayName}, start by checking jeep code ${top.route.code}.`
      : `I could not find a strong route list for ${place.displayName}.`,
    answer: top
      ? `These are the closest jeep codes I found for ${place.displayName}: ${topCodes}.`
      : `I could not find a strong route list for ${place.displayName} yet.`,
    confidence: top ? confidenceLabel(top.score) : "Low confidence",
    lookFor: top ? buildLookFor(top.route) : "",
    keyLandmarks: top ? buildKeyLandmarks(top.route, [place.displayName]) : [place.displayName],
    roadClues: top ? buildRoadClues(top.route) : [],
    tip: "Use this as a shortlist, then check the signboard or ask the driver if the jeep passes your exact stop.",
    tripSteps: [],
    reasoningLevel: top ? reasoningLevel(top.score) : "low",
    reasoningLabel: top ? reasoningLabel(top.score) : "Needs confirmation",
    instructionLevel: "shortlist",
    instructionLabel: "Shortlist only",
    confidenceNote: "This is a place-based lookup, so routes may start there, end there, or pass nearby.",
    commuterSteps: [
      `If you are near ${place.displayName}, start by checking the jeep codes listed below.`,
      "Read the signboard and ask the driver if they pass your exact stop.",
      "If you want a clearer answer, ask using both your origin and destination.",
    ],
    sections: [
      {
        title: "Jeep codes to check",
        items: candidates.map((candidate) => `${candidate.route.code} - ${candidate.route.signboard}`),
      },
    ],
    suggestions: [
      "Ask a more exact trip like “from Ayala to SM”.",
      "Ask a code-specific question like “What is 04B?”",
    ],
    primaryMatch: top ? toMatch(top.route) : null,
    matches: candidates.map((candidate) => toMatch(candidate.route)),
  };
}

export function buildNotFoundResponse(
  query: string,
  message = "I could not find a clear route match for that question yet.",
  map?: MapOverview
): RouteBotResponse {
  return {
    ...buildBaseResponse(query, "not_found", map),
    greeting: "Hi! I could not pin that down yet, but I can help you ask it in a clearer way.",
    title: "No route match yet",
    summary: message,
    lead: "Try asking with a jeep code, a landmark, or a simple from-to trip.",
    answer: message,
    confidence: "Need a clearer question",
    lookFor: "",
    keyLandmarks: [],
    roadClues: [],
    tip: "Try using a jeep code, a landmark, or a simple from-to question.",
    tripSteps: [],
    reasoningLevel: "low",
    reasoningLabel: "No confident match",
    instructionLevel: "shortlist",
    instructionLabel: "Needs a clearer question",
    confidenceNote: "This bot currently answers exact route codes, place-to-place trips, route checks, and place-based lookups from the seeded route data.",
    commuterSteps: [
      "Try a direct route code like 17B or 12L.",
      "Or ask in plain form like “from IT Park to Colon”.",
      "If you only know one landmark, ask for routes related to that place.",
    ],
    sections: [
      {
        title: "Try asking like this",
        items: [
          "17B",
          "From IT Park to Colon",
          "Does 17B pass Ayala?",
        ],
      },
    ],
    suggestions: [
      "Try a route code like “17B”.",
      "Try a plain trip like “from IT Park to Colon”.",
      "Try a place search like “routes for Ayala”.",
    ],
  };
}
