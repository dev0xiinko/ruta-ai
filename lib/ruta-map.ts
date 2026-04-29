import "server-only";

import type { RouteMapOverview, RouteMapPoint } from "@/lib/ruta/contracts";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

type PlaceCoordinate = {
  label: string;
  lat: number;
  lng: number;
};

export const PLACE_COORDINATES: Record<string, PlaceCoordinate> = {
  apas: { label: "Apas", lat: 10.3364, lng: 123.9181 },
  "it park": { label: "IT Park", lat: 10.3296, lng: 123.9067 },
  colon: { label: "Colon", lat: 10.2955, lng: 123.9023 },
  "metro colon": { label: "Metro Colon", lat: 10.2962, lng: 123.9016 },
  colonnade: { label: "Colonnade", lat: 10.2957, lng: 123.9009 },
  carbon: { label: "Carbon", lat: 10.2921, lng: 123.8986 },
  "carbon public market": { label: "Carbon", lat: 10.2918, lng: 123.8985 },
  ayala: { label: "Ayala", lat: 10.3173, lng: 123.9058 },
  "ayala center": { label: "Ayala", lat: 10.3173, lng: 123.9058 },
  sm: { label: "SM City Cebu", lat: 10.3111, lng: 123.9180 },
  "sm city": { label: "SM City Cebu", lat: 10.3111, lng: 123.9180 },
  "sm city cebu": { label: "SM City Cebu", lat: 10.3111, lng: 123.9180 },
  parkmall: { label: "Parkmall", lat: 10.3307, lng: 123.9372 },
  lahug: { label: "Lahug", lat: 10.3338, lng: 123.9032 },
  "jy square": { label: "JY Square", lat: 10.3331, lng: 123.8990 },
  fuente: { label: "Fuente Osmena", lat: 10.3066, lng: 123.8945 },
  "fuente osmena": { label: "Fuente Osmena", lat: 10.3066, lng: 123.8945 },
  "robinsons fuente": { label: "Robinsons Fuente", lat: 10.3084, lng: 123.8935 },
  taboan: { label: "Taboan", lat: 10.2924, lng: 123.8918 },
  "taboan public market": { label: "Taboan", lat: 10.2924, lng: 123.8918 },
  mandaue: { label: "Mandaue", lat: 10.3236, lng: 123.9228 },
  ouano: { label: "Ouano", lat: 10.3239, lng: 123.9316 },
  "centro mandaue": { label: "Centro Mandaue", lat: 10.3234, lng: 123.9330 },
  opon: { label: "Opon", lat: 10.3103, lng: 123.9494 },
  "lapu lapu": { label: "Lapu-Lapu", lat: 10.3103, lng: 123.9494 },
  "lapu-lapu": { label: "Lapu-Lapu", lat: 10.3103, lng: 123.9494 },
  "gorordo ave": { label: "Gorordo Ave", lat: 10.3193, lng: 123.8999 },
  "salinas drive": { label: "Salinas Drive", lat: 10.3282, lng: 123.9044 },
  "juan luna ave": { label: "Juan Luna Ave", lat: 10.3098, lng: 123.9128 },
  "magallanes st": { label: "Magallanes St", lat: 10.2940, lng: 123.9001 },
  "progreso st": { label: "Progreso St", lat: 10.2918, lng: 123.8963 },
};

function normalizePlace(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type RoutePlaceAliasRow = {
  alias: string;
  route_places: {
    canonical_name: string;
    latitude: number;
    longitude: number;
  } | null;
};

export type MapPoint = RouteMapPoint;
export type MapOverview = RouteMapOverview;

function resolvePlaceCoordinateFromFallback(value: string | null | undefined) {
  if (!value) return null;

  const normalized = normalizePlace(value);

  if (PLACE_COORDINATES[normalized]) {
    return PLACE_COORDINATES[normalized];
  }

  for (const [key, coordinate] of Object.entries(PLACE_COORDINATES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coordinate;
    }
  }

  return null;
}

async function resolvePlaceCoordinateFromDatabase(value: string | null | undefined) {
  if (!value) return null;

  const normalized = normalizePlace(value);

  const { data, error } = await supabaseAdmin
    .from("route_place_aliases")
    .select("alias, route_places(canonical_name, latitude, longitude)")
    .eq("alias", normalized)
    .limit(1)
    .returns<RoutePlaceAliasRow[]>();

  if (error) {
    return null;
  }

  const row = data?.[0];
  if (row?.route_places) {
    return {
      label: row.route_places.canonical_name,
      lat: row.route_places.latitude,
      lng: row.route_places.longitude,
    };
  }

  return null;
}

export async function resolvePlaceCoordinate(value: string | null | undefined) {
  const databaseMatch = await resolvePlaceCoordinateFromDatabase(value);
  if (databaseMatch) {
    return databaseMatch;
  }

  return resolvePlaceCoordinateFromFallback(value);
}

export async function buildMapOverview(
  origin: string | null | undefined,
  destination: string | null | undefined,
  roads: string[] | null | undefined
): Promise<MapOverview> {
  const originPoint = await resolvePlaceCoordinate(origin);
  const destinationPoint = await resolvePlaceCoordinate(destination);
  const waypointCandidates = (
    await Promise.all((roads ?? []).map((road) => resolvePlaceCoordinate(road)))
  ).filter((point): point is PlaceCoordinate => Boolean(point));

  const dedupedWaypoints: PlaceCoordinate[] = [];
  const seen = new Set<string>();

  for (const point of waypointCandidates) {
    if (seen.has(point.label)) continue;
    seen.add(point.label);
    dedupedWaypoints.push(point);
    if (dedupedWaypoints.length >= 3) break;
  }

  const points: MapPoint[] = [];

  if (originPoint) {
    points.push({ ...originPoint, kind: "origin" });
  }

  for (const waypoint of dedupedWaypoints) {
    points.push({ ...waypoint, kind: "waypoint" });
  }

  if (destinationPoint) {
    points.push({ ...destinationPoint, kind: "destination" });
  }

  if (points.length >= 2) {
    return {
      feasible: false,
      kind: "none",
      note: "Map preview is currently hidden because the place-to-route geometry is still too approximate for commuter use. For now, rely on the rider instructions and route clues instead.",
      points,
    };
  }

  return {
    feasible: false,
    kind: "none",
    note: "Map preview is not available yet because the current place mapping is still incomplete.",
    points: [],
  };
}
