import { normalizeText } from "@/lib/ruta-engine/place-resolver";
import type { CandidateScoreBreakdown, PlaceEntity, StructuredRoute } from "@/lib/ruta-engine/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toBand(score: number) {
  if (score >= 0.85) return "high" as const;
  if (score >= 0.6) return "medium" as const;
  return "low" as const;
}

function normalizeScore(value: number) {
  return clamp(Number(value.toFixed(3)), 0, 1);
}

function exactSignboardMatch(route: StructuredRoute, searchText: string) {
  const normalizedSearch = normalizeText(searchText);
  if (!normalizedSearch) return 0;

  const normalizedSignboard = normalizeText(route.signboard);
  if (normalizedSearch === normalizedSignboard) return 1;
  if (normalizedSignboard.includes(normalizedSearch) || normalizedSearch.includes(normalizedSignboard)) {
    return 0.75;
  }

  const aliasMatch = route.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return (
      normalizedAlias === normalizedSearch ||
      normalizedAlias.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedAlias)
    );
  });

  return aliasMatch ? 0.65 : 0;
}

export function scoreRouteCodeCandidate(
  route: StructuredRoute,
  routeCode: string,
  searchText: string
) {
  const exactCodeMatch = route.code.toUpperCase() === routeCode.toUpperCase() ? 1 : 0;
  const signboardMatch = exactSignboardMatch(route, searchText);
  const routeConfidence = normalizeScore(route.confidence);
  const total = normalizeScore(
    exactCodeMatch * 0.7 +
      signboardMatch * 0.15 +
      routeConfidence * 0.15
  );

  const breakdown: CandidateScoreBreakdown = {
    exactCodeMatch,
    signboardMatch,
    originMatch: 0,
    destinationMatch: 0,
    directionMatch: 0,
    landmarkMatch: 0,
    routeConfidence,
    targetMatch: 0,
    total,
  };

  return {
    score: total,
    breakdown,
    confidenceBand: toBand(total),
  };
}

export function scoreTripCandidate(
  route: StructuredRoute,
  origin: PlaceEntity,
  destination: PlaceEntity,
  originIndex: number | null,
  destinationIndex: number | null
) {
  const originMatch = originIndex !== null ? 1 : 0;
  const destinationMatch = destinationIndex !== null ? 1 : 0;
  const directionMatch =
    originIndex !== null && destinationIndex !== null && originIndex < destinationIndex ? 1 : 0;
  const landmarkMatch =
    originIndex !== null && destinationIndex !== null
      ? route.stops.length >= 3
        ? 1
        : 0.7
      : 0;
  const routeConfidence = normalizeScore(route.confidence);

  const total = normalizeScore(
    originMatch * 0.22 +
      destinationMatch * 0.22 +
      directionMatch * 0.24 +
      landmarkMatch * 0.12 +
      routeConfidence * 0.2
  );

  const breakdown: CandidateScoreBreakdown = {
    exactCodeMatch: 0,
    signboardMatch: 0,
    originMatch,
    destinationMatch,
    directionMatch,
    landmarkMatch,
    routeConfidence,
    targetMatch: 0,
    total,
  };

  return {
    score: total,
    breakdown,
    confidenceBand: toBand(total),
  };
}

export function scoreDestinationCheckCandidate(
  route: StructuredRoute,
  routeCode: string,
  targetIndex: number | null
) {
  const exactCodeMatch = route.code.toUpperCase() === routeCode.toUpperCase() ? 1 : 0;
  const targetMatch = targetIndex !== null ? 1 : 0;
  const landmarkMatch = targetIndex !== null && route.stops.length >= 3 ? 1 : targetMatch * 0.7;
  const routeConfidence = normalizeScore(route.confidence);
  const total = normalizeScore(
    exactCodeMatch * 0.5 +
      targetMatch * 0.25 +
      landmarkMatch * 0.1 +
      routeConfidence * 0.15
  );

  const breakdown: CandidateScoreBreakdown = {
    exactCodeMatch,
    signboardMatch: 0,
    originMatch: 0,
    destinationMatch: 0,
    directionMatch: 0,
    landmarkMatch,
    routeConfidence,
    targetMatch,
    total,
  };

  return {
    score: total,
    breakdown,
    confidenceBand: toBand(total),
  };
}

export function classifyConfidence(score: number) {
  if (score >= 0.85) return "high" as const;
  if (score >= 0.6) return "medium" as const;
  return "low" as const;
}
