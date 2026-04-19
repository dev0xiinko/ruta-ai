import { buildMapOverview } from "@/lib/ruta-map";
import { parseRouteQuery } from "@/lib/ruta-engine/query-parser";
import { createPlaceResolver } from "@/lib/ruta-engine/place-resolver";
import {
  buildDestinationCheckResponse,
  buildNotFoundResponse,
  buildPlaceSearchResponse,
  buildRouteCodeResponse,
  buildTripResponse,
} from "@/lib/ruta-engine/response-builder";
import {
  buildStructuredRoutes,
  buildStructuredRouteVariants,
  projectRouteVariant,
} from "@/lib/ruta-engine/route-model";
import {
  matchDestinationCheckQuery,
  matchPlaceSearchQuery,
  matchRouteCodeQuery,
  matchTripQuery,
} from "@/lib/ruta-engine/route-matcher";
import { supabaseAdmin } from "@/lib/supabase/client";
import type {
  RouteBotResponse,
  RoutePlaceAliasRow,
  RoutePlaceBindingRow,
  RoutePlaceRow,
  RouteRecord,
  RouteStopRow,
  RouteVariantMapRefRow,
  RouteVariantRow,
  RouteVariantStopOrderRow,
  StructuredRoute,
  StructuredRouteVariant,
} from "@/lib/ruta-engine/types";

type RoutingContext = {
  routes: StructuredRoute[];
  variants: StructuredRouteVariant[];
  resolver: ReturnType<typeof createPlaceResolver>;
};

let routingContextPromise: Promise<RoutingContext> | null = null;

function isMissingRelationError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship") ||
    message.includes("schema cache")
  );
}

async function loadOptional<T>(loader: () => Promise<T>) {
  try {
    return await loader();
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [] as unknown as T;
    }
    throw error;
  }
}

async function loadRoutes() {
  const { data, error } = await supabaseAdmin
    .from("jeepney_routes_ai_ready")
    .select("*")
    .order("completeness_score", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RouteRecord[];
}

async function loadPlaceRows() {
  const { data, error } = await supabaseAdmin
    .from("route_places")
    .select(
      "id, canonical_name, city, latitude, longitude, source, type, barangay, parent_place_id, importance_rank, related_place_ids, normalized_name"
    )
    .returns<RoutePlaceRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadPlaceAliasRows() {
  const { data, error } = await supabaseAdmin
    .from("route_place_aliases")
    .select(
      "id, place_id, alias, normalized_alias, alias_kind, confidence_score, route_places(id, canonical_name, normalized_name, city, barangay, type, parent_place_id, importance_rank, related_place_ids, latitude, longitude)"
    )
    .returns<RoutePlaceAliasRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadVariantRows() {
  const { data, error } = await supabaseAdmin
    .from("route_variants_ai_ready")
    .select("*")
    .order("confidence_score", { ascending: false })
    .returns<RouteVariantRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadVariantMapRefs() {
  const { data, error } = await supabaseAdmin
    .from("route_variant_map_refs")
    .select("*")
    .returns<RouteVariantMapRefRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadRouteStops() {
  const { data, error } = await supabaseAdmin
    .from("route_stops")
    .select("*")
    .returns<RouteStopRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadVariantStopOrder() {
  const { data, error } = await supabaseAdmin
    .from("route_variant_stop_order")
    .select("*")
    .returns<RouteVariantStopOrderRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadRoutePlaceBindings() {
  const { data, error } = await supabaseAdmin
    .from("route_place_bindings")
    .select("*")
    .returns<RoutePlaceBindingRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function loadRoutingContext() {
  const [
    rawRoutes,
    placeRows,
    placeAliasRows,
    variantRows,
    variantMapRefs,
    routeStops,
    variantStopOrder,
    routePlaceBindings,
  ] = await Promise.all([
    loadRoutes(),
    loadPlaceRows(),
    loadPlaceAliasRows(),
    loadOptional(loadVariantRows),
    loadOptional(loadVariantMapRefs),
    loadOptional(loadRouteStops),
    loadOptional(loadVariantStopOrder),
    loadOptional(loadRoutePlaceBindings),
  ]);

  const resolver = createPlaceResolver(rawRoutes, placeAliasRows, placeRows);
  const variants =
    variantRows.length > 0
      ? buildStructuredRouteVariants({
          routes: rawRoutes,
          variants: variantRows,
          mapRefs: variantMapRefs,
          stopRows: routeStops,
          stopOrders: variantStopOrder,
          placeBindings: routePlaceBindings,
          resolver,
        })
      : [];

  const routes =
    variants.length > 0
      ? variants.map((variant) => projectRouteVariant(variant))
      : buildStructuredRoutes(rawRoutes, resolver);

  return {
    routes,
    variants,
    resolver,
  };
}

function getRoutingContext() {
  if (!routingContextPromise) {
    routingContextPromise = loadRoutingContext();
  }

  return routingContextPromise;
}

async function buildRouteMap(
  route:
    | {
        raw: {
          origin: string | null;
          destination: string | null;
          roads: string[];
        };
      }
    | null
    | undefined
) {
  if (!route) {
    return buildMapOverview(null, null, []);
  }

  return buildMapOverview(route.raw.origin, route.raw.destination, route.raw.roads ?? []);
}

export type { RouteBotResponse } from "@/lib/ruta-engine/types";

export async function answerRouteQuestion(query: string): Promise<RouteBotResponse> {
  const cleanQuery = query.trim();
  const parsed = parseRouteQuery(cleanQuery);
  const { routes, resolver } = await getRoutingContext();

  if (parsed.type === "route_code") {
    const candidates = matchRouteCodeQuery(routes, parsed);
    if (candidates.length === 0) {
      const emptyMap = await buildMapOverview(null, null, []);
      return buildNotFoundResponse(
        cleanQuery,
        `I could not find route code ${parsed.code} in the current route list.`,
        emptyMap
      );
    }

    const map = await buildRouteMap(candidates[0].route);
    return buildRouteCodeResponse(parsed, candidates, map);
  }

  if (parsed.type === "place_to_place") {
    const tripMatch = matchTripQuery(routes, resolver, parsed);

    if (!tripMatch.origin || !tripMatch.destination) {
      const emptyMap = await buildMapOverview(null, null, []);
      return buildNotFoundResponse(
        cleanQuery,
        "I could not clearly identify your origin or destination yet.",
        emptyMap
      );
    }

    if (tripMatch.directCandidates.length === 0 && tripMatch.fallbackCandidates.length === 0) {
      const emptyMap = await buildMapOverview(null, null, []);
      return buildNotFoundResponse(
        cleanQuery,
        `I could not confirm one direct jeep from ${tripMatch.origin.displayName} to ${tripMatch.destination.displayName} yet.`,
        emptyMap
      );
    }

    const primaryCandidate = tripMatch.directCandidates[0] ?? tripMatch.fallbackCandidates[0] ?? null;
    const map = await buildRouteMap(primaryCandidate?.route);

    return buildTripResponse(
      parsed,
      tripMatch.origin,
      tripMatch.destination,
      tripMatch.directCandidates,
      tripMatch.fallbackCandidates,
      map
    );
  }

  if (parsed.type === "destination_check") {
    const result = matchDestinationCheckQuery(routes, resolver, parsed);
    const primaryCandidate = result.candidates[0] ?? null;
    const map = await buildRouteMap(primaryCandidate?.route);
    return buildDestinationCheckResponse(parsed, result.target, result.candidates, map);
  }

  if (parsed.type === "place_search") {
    const result = matchPlaceSearchQuery(routes, resolver, parsed);
    if (!result.place || result.candidates.length === 0) {
      const emptyMap = await buildMapOverview(null, null, []);
      return buildNotFoundResponse(
        cleanQuery,
        "I could not find a strong route shortlist for that place yet.",
        emptyMap
      );
    }

    const map = await buildRouteMap(result.candidates[0].route);
    return buildPlaceSearchResponse(parsed, result.place, result.candidates, map);
  }

  const emptyMap = await buildMapOverview(null, null, []);
  return buildNotFoundResponse(cleanQuery, undefined, emptyMap);
}
