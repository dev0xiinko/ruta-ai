import { cleanPlaceLabel, normalizeText } from "@/lib/ruta-engine/place-resolver";
import type { ParsedQuery } from "@/lib/ruta-engine/types";

const ROUTE_CODE_PATTERN = /\b(mi-\d{2}[a-z]?|\d{1,2}[a-z]?)\b/i;

function extractRouteCode(query: string) {
  const match = normalizeText(query).match(ROUTE_CODE_PATTERN);
  return match ? match[1].toUpperCase() : null;
}

function extractTripPlaces(query: string) {
  const raw = query.trim();
  const patterns = [
    /from\s+(.+?)\s+to\s+(.+)/i,
    /^(.+?)\s+to\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return {
        originText: cleanPlaceLabel(match[1].trim()),
        destinationText: cleanPlaceLabel(match[2].trim()),
      };
    }
  }

  return null;
}

function extractRouteCheckTarget(query: string) {
  const raw = query.trim();
  const patterns = [
    /(?:does|do)\s+(?:mi-\d{2}[a-z]?|\d{1,2}[a-z]?)\s+(?:pass|passes|go|goes|run|runs)(?:\s+through|\s+by|\s+to|\s+near)?\s+(.+)$/i,
    /(?:muagi|agi|moagi)\s+(?:ba\s+)?(?:ni\s+)?(?:sa|ug)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return cleanPlaceLabel(match[1].trim());
    }
  }

  return null;
}

function cleanRouteCodeSearchText(query: string, code: string) {
  return cleanPlaceLabel(
    query
      .replace(new RegExp(code, "ig"), "")
      .replace(/^(what\s+is|unsa\s+ang|route|code)\s+/i, "")
      .trim()
  );
}

function cleanPlaceSearchQuery(query: string) {
  return cleanPlaceLabel(
    query
      .replace(/^routes?\s+for\s+/i, "")
      .replace(/^what\s+routes?\s+(go|pass|run)\s+(through|to|from)\s+/i, "")
      .replace(/^routes?\s+(near|around)\s+/i, "")
  );
}

export function parseRouteQuery(query: string): ParsedQuery {
  const raw = query.trim();
  const normalized = normalizeText(raw);
  const routeCode = extractRouteCode(raw);
  const tripPlaces = extractTripPlaces(raw);
  const routeCheckTarget = extractRouteCheckTarget(raw);

  if (routeCheckTarget) {
    return {
      type: "destination_check",
      raw,
      routeCode,
      targetText: routeCheckTarget,
    };
  }

  if (tripPlaces) {
    return {
      type: "place_to_place",
      raw,
      originText: tripPlaces.originText,
      destinationText: tripPlaces.destinationText,
    };
  }

  if (
    routeCode &&
    (normalized === normalizeText(routeCode) ||
      /^what\s+is\b/i.test(raw) ||
      /^unsa\s+ang\b/i.test(raw) ||
      /^route\b/i.test(raw) ||
      /^code\b/i.test(raw))
  ) {
    return {
      type: "route_code",
      raw,
      code: routeCode,
      searchText: cleanRouteCodeSearchText(raw, routeCode),
    };
  }

  if (routeCode && normalized === normalizeText(routeCode)) {
    return {
      type: "route_code",
      raw,
      code: routeCode,
      searchText: "",
    };
  }

  if (/^routes?\s+for\b/i.test(raw) || /^what\s+routes?\b/i.test(raw)) {
    return {
      type: "place_search",
      raw,
      placeText: cleanPlaceSearchQuery(raw),
    };
  }

  if (routeCode) {
    return {
      type: "route_code",
      raw,
      code: routeCode,
      searchText: cleanRouteCodeSearchText(raw, routeCode),
    };
  }

  const cleanedPlace = cleanPlaceSearchQuery(raw);
  if (cleanedPlace && cleanedPlace !== raw) {
    return {
      type: "place_search",
      raw,
      placeText: cleanedPlace,
    };
  }

  return {
    type: "unknown",
    raw,
  };
}
