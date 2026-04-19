import { PlaceResolver } from "@/lib/ruta-engine/place-resolver";
import {
  classifyConfidence,
  scoreDestinationCheckCandidate,
  scoreRouteCodeCandidate,
  scoreTripCandidate,
} from "@/lib/ruta-engine/scoring";
import type {
  ParsedQuery,
  PlaceEntity,
  RouteCandidate,
  StructuredRoute,
} from "@/lib/ruta-engine/types";

function findStopIndex(route: StructuredRoute, resolver: PlaceResolver, place: PlaceEntity) {
  const matchKeys = resolver.buildMatchKeys(place);
  const match = route.stops.find((stop) => matchKeys.has(stop.key));
  return match ? match.order : null;
}

function buildCandidate(
  route: StructuredRoute,
  score: number,
  confidenceBand: "high" | "medium" | "low",
  breakdown: RouteCandidate["breakdown"],
  originIndex: number | null,
  destinationIndex: number | null,
  targetIndex: number | null
): RouteCandidate {
  return {
    route,
    score,
    confidenceBand,
    breakdown,
    originIndex,
    destinationIndex,
    targetIndex,
    directionValid:
      originIndex !== null && destinationIndex !== null ? originIndex < destinationIndex : false,
  };
}

function compareCandidates(left: RouteCandidate, right: RouteCandidate) {
  if (right.score !== left.score) return right.score - left.score;
  if (right.route.confidence !== left.route.confidence) {
    return right.route.confidence - left.route.confidence;
  }
  return right.route.stops.length - left.route.stops.length;
}

function topCandidates(candidates: RouteCandidate[]) {
  return [...candidates].sort(compareCandidates).slice(0, 5);
}

export function matchRouteCodeQuery(
  routes: StructuredRoute[],
  query: Extract<ParsedQuery, { type: "route_code" }>
) {
  const exactRoutes = routes.filter((route) => route.code.toUpperCase() === query.code.toUpperCase());
  const pool = exactRoutes.length > 0 ? exactRoutes : routes;

  const candidates = pool
    .map((route) => {
      const scored = scoreRouteCodeCandidate(route, query.code, query.searchText);
      return buildCandidate(
        route,
        scored.score,
        scored.confidenceBand,
        scored.breakdown,
        null,
        null,
        null
      );
    })
    .filter((candidate) => candidate.breakdown.exactCodeMatch > 0 || candidate.breakdown.signboardMatch > 0);

  return topCandidates(candidates);
}

export function matchTripQuery(
  routes: StructuredRoute[],
  resolver: PlaceResolver,
  query: Extract<ParsedQuery, { type: "place_to_place" }>
) {
  const origin = resolver.resolvePlace(query.originText);
  const destination = resolver.resolvePlace(query.destinationText);

  if (!origin || !destination) {
    return {
      origin,
      destination,
      directCandidates: [] as RouteCandidate[],
      fallbackCandidates: [] as RouteCandidate[],
    };
  }

  const evaluated = routes.map((route) => {
    const originIndex = findStopIndex(route, resolver, origin);
    const destinationIndex = findStopIndex(route, resolver, destination);
    const scored = scoreTripCandidate(route, origin, destination, originIndex, destinationIndex);
    return buildCandidate(
      route,
      scored.score,
      scored.confidenceBand,
      scored.breakdown,
      originIndex,
      destinationIndex,
      null
    );
  });

  const directCandidates = topCandidates(
    evaluated.filter(
      (candidate) =>
        candidate.originIndex !== null &&
        candidate.destinationIndex !== null &&
        candidate.directionValid
    )
  );

  const fallbackCandidates = topCandidates(
    evaluated.filter(
      (candidate) =>
        candidate.originIndex !== null ||
        candidate.destinationIndex !== null
    )
  );

  return {
    origin,
    destination,
    directCandidates,
    fallbackCandidates,
  };
}

export function matchDestinationCheckQuery(
  routes: StructuredRoute[],
  resolver: PlaceResolver,
  query: Extract<ParsedQuery, { type: "destination_check" }>
) {
  const target = resolver.resolvePlace(query.targetText);
  const routeCode = query.routeCode;

  if (!routeCode || !target) {
    return {
      target,
      candidates: [] as RouteCandidate[],
    };
  }

  const exactRoutes = routes.filter((route) => route.code.toUpperCase() === routeCode.toUpperCase());
  const candidates = exactRoutes
    .map((route) => {
      const targetIndex = findStopIndex(route, resolver, target);
      const scored = scoreDestinationCheckCandidate(route, routeCode, targetIndex);
      return buildCandidate(
        route,
        scored.score,
        scored.confidenceBand,
        scored.breakdown,
        null,
        null,
        targetIndex
      );
    })
    .filter((candidate) => candidate.breakdown.exactCodeMatch > 0)
    .sort(compareCandidates);

  return {
    target,
    candidates: candidates.slice(0, 5),
  };
}

export function matchPlaceSearchQuery(
  routes: StructuredRoute[],
  resolver: PlaceResolver,
  query: Extract<ParsedQuery, { type: "place_search" }>
) {
  const place = resolver.resolvePlace(query.placeText);

  if (!place) {
    return {
      place,
      candidates: [] as RouteCandidate[],
    };
  }

  const candidates = routes
    .map((route) => {
      const matchKeys = resolver.buildMatchKeys(place);
      const targetIndex = findStopIndex(route, resolver, place);
      const targetMatch =
        targetIndex !== null || route.landmarkKeys.some((key) => matchKeys.has(key));
      const score = targetMatch
        ? Math.min(0.92, route.confidence * 0.75 + (targetIndex !== null ? 0.25 : 0.12))
        : 0;

      return buildCandidate(
        route,
        score,
        classifyConfidence(score),
        {
          exactCodeMatch: 0,
          signboardMatch: 0,
          originMatch: 0,
          destinationMatch: 0,
          directionMatch: 0,
          landmarkMatch: targetMatch ? 1 : 0,
          routeConfidence: route.confidence,
          targetMatch: targetMatch ? 1 : 0,
          total: score,
        },
        null,
        null,
        targetIndex
      );
    })
    .filter((candidate) => candidate.score >= 0.45);

  return {
    place,
    candidates: topCandidates(candidates),
  };
}
