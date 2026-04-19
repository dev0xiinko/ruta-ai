import {
  PlaceResolver,
  cleanPlaceLabel,
  dedupeDisplayNames,
  normalizeText,
} from "@/lib/ruta-engine/place-resolver";
import type {
  PlaceEntity,
  RoutePlaceBinding,
  RoutePlaceBindingRow,
  RouteRecord,
  RouteStopRow,
  RouteVariantMapRefRow,
  RouteVariantRow,
  RouteVariantStopOrderRow,
  StructuredRoute,
  StructuredRouteVariant,
  StructuredStop,
} from "@/lib/ruta-engine/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string | null | undefined) {
  return normalizeText(value ?? "").replace(/\s+/g, "_");
}

function uniqueEntities(values: PlaceEntity[]) {
  const output: PlaceEntity[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.normalizedCanonical)) continue;
    seen.add(value.normalizedCanonical);
    output.push(value);
  }

  return output;
}

function uniqueStops(values: StructuredStop[]) {
  const output: StructuredStop[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const key = value.placeId ?? value.key;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }

  return output;
}

function reindexStops(values: StructuredStop[]) {
  return values.map((stop, index) => ({
    ...stop,
    order: index + 1,
  }));
}

function createStop(name: string, order: number, resolver: PlaceResolver): StructuredStop {
  const resolved = resolver.resolvePlace(name);

  return {
    name: resolved?.displayName ?? name,
    canonicalName: resolved?.canonicalName ?? name,
    key: resolved?.normalizedCanonical ?? normalizeText(name),
    order,
    placeId: resolved?.id ?? null,
    city: resolved?.city ?? null,
    barangay: resolved?.barangay ?? null,
    stopType: resolved?.type ?? null,
  };
}

function resolveDisplayName(value: string | null | undefined, resolver: PlaceResolver) {
  if (!value) return null;
  const resolved = resolver.resolvePlace(value);
  return resolved?.displayName ?? cleanPlaceLabel(value);
}

function resolvePlaceEntity(value: string | null | undefined, resolver: PlaceResolver) {
  if (!value) return null;
  return resolver.resolvePlace(value);
}

function buildLandmarks(route: RouteRecord, resolver: PlaceResolver) {
  const resolved = uniqueEntities(
    [
      route.origin,
      ...(route.malls_groceries ?? []),
      ...(route.schools ?? []),
      ...(route.terminals ?? []),
      ...(route.health ?? []),
      route.destination,
    ]
      .map((value) => (value ? resolver.resolvePlace(value) : null))
      .filter((value): value is PlaceEntity => Boolean(value))
  );

  return {
    names: dedupeDisplayNames(resolved.map((item) => item.displayName)),
    keys: resolved.map((item) => item.normalizedCanonical),
  };
}

function pickBestStopSequence(route: RouteRecord, resolver: PlaceResolver) {
  const sourceTexts = [
    ...(route.info ?? []),
    ...Object.values(route.raw_sections ?? {}),
    route.route_name ?? "",
  ].filter(Boolean);

  const start = resolveDisplayName(route.origin, resolver);
  const end = resolveDisplayName(route.destination, resolver);

  let bestSequence: string[] = [];
  let bestScore = -1;

  for (const text of sourceTexts) {
    const mentions = resolver.extractPlacesFromText(text);
    const sequence = dedupeDisplayNames(mentions.map((item) => item.displayName));
    if (sequence.length === 0) continue;

    const includesStart = start ? sequence.includes(start) : false;
    const includesEnd = end ? sequence.includes(end) : false;
    const score = sequence.length * 10 + (includesStart ? 2 : 0) + (includesEnd ? 2 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestSequence = sequence;
    }
  }

  const output = [...bestSequence];

  if (start && !output.includes(start)) {
    output.unshift(start);
  }

  if (end && !output.includes(end)) {
    output.push(end);
  }

  if (output.length === 0 && start && end && start !== end) {
    return [start, end];
  }

  if (output.length === 0 && start) {
    return [start];
  }

  if (output.length === 0 && end) {
    return [end];
  }

  return output;
}

function buildStops(route: RouteRecord, resolver: PlaceResolver) {
  return pickBestStopSequence(route, resolver).map((stop, index) =>
    createStop(stop, index + 1, resolver)
  );
}

function buildRouteConfidence(route: RouteRecord, stops: StructuredStop[]) {
  const qaBase =
    route.qa_status === "high_confidence"
      ? 0.72
      : route.qa_status === "usable_with_caution"
        ? 0.55
        : 0.35;

  const completenessBoost = (route.completeness_score / 100) * 0.22;
  const warningPenalty = Math.min((route.warnings?.length ?? 0) * 0.02, 0.1);
  const endpointPenalty = (route.origin ? 0 : 0.05) + (route.destination ? 0 : 0.05);
  const stopPenalty = stops.length >= 3 ? 0 : 0.06;

  return clamp(
    qaBase + completenessBoost - warningPenalty - endpointPenalty - stopPenalty,
    0.1,
    0.98
  );
}

function buildEmptyRouteRecord(variant: RouteVariantRow): RouteRecord {
  const summary = variant.raw_summary ?? {};
  const origin =
    typeof summary.origin === "string" && summary.origin.trim().length > 0 ? summary.origin : null;
  const destination =
    typeof summary.destination === "string" && summary.destination.trim().length > 0
      ? summary.destination
      : null;
  const routeName =
    typeof summary.route_name === "string" && summary.route_name.trim().length > 0
      ? summary.route_name
      : variant.signboard ?? variant.display_name;

  return {
    dataset_name: variant.dataset_name,
    code: variant.route_code,
    label: null,
    route_name: routeName,
    origin,
    destination,
    qa_status: variant.qa_status,
    completeness_score: Math.round((variant.confidence_score ?? 0) * 100),
    source_urls: variant.source_urls ?? [],
    roads: [],
    schools: [],
    malls_groceries: [],
    churches: [],
    government: [],
    hotels: [],
    health: [],
    terminals: [],
    info: [],
    raw_sections: {},
    warnings: variant.warnings ?? [],
    imported_at: variant.imported_at,
  };
}

function buildRawRouteLookup(routes: RouteRecord[]) {
  const lookup = new Map<string, RouteRecord[]>();

  for (const route of routes) {
    const key = route.code.toUpperCase();
    const existing = lookup.get(key) ?? [];
    existing.push(route);
    lookup.set(key, existing);
  }

  return lookup;
}

function matchRawRouteForVariant(variant: RouteVariantRow, routesByCode: Map<string, RouteRecord[]>) {
  const candidates = routesByCode.get(variant.route_code.toUpperCase()) ?? [];
  if (candidates.length === 0) {
    return buildEmptyRouteRecord(variant);
  }

  const summary = variant.raw_summary ?? {};
  const summaryRouteName = normalizeText(String(summary.route_name ?? ""));
  const summaryOrigin = normalizeText(String(summary.origin ?? ""));
  const summaryDestination = normalizeText(String(summary.destination ?? ""));

  const exact = candidates.find((route) => {
    const routeName = normalizeText(route.route_name ?? "");
    const origin = normalizeText(route.origin ?? "");
    const destination = normalizeText(route.destination ?? "");

    return (
      (summaryRouteName && routeName === summaryRouteName) ||
      ((summaryOrigin || summaryDestination) &&
        origin === summaryOrigin &&
        destination === summaryDestination)
    );
  });

  if (exact) return exact;

  return [...candidates].sort((left, right) => right.completeness_score - left.completeness_score)[0];
}

function buildMapRef(mapRef: RouteVariantMapRefRow | undefined) {
  if (!mapRef) {
    return {
      hasMap: false,
    };
  }

  return {
    hasMap: true,
    pageUrl: mapRef.page_url,
    googleMapUrl: mapRef.google_map_url,
    embedUrl: mapRef.embed_url,
    mapId: mapRef.map_id,
    centerLl: mapRef.center_ll,
    span: mapRef.span,
    iwloc: mapRef.iwloc,
    mapTitle: mapRef.map_title,
  };
}

function stopFromRow(stopRow: RouteStopRow, order: number, resolver: PlaceResolver): StructuredStop {
  const resolved =
    resolver.resolvePlace(stopRow.display_name) ?? resolver.resolvePlace(stopRow.canonical_name);

  return {
    id: stopRow.id,
    placeId: stopRow.place_id,
    name: resolved?.displayName ?? stopRow.display_name,
    canonicalName: resolved?.canonicalName ?? stopRow.canonical_name,
    key: resolved?.normalizedCanonical ?? normalizeText(stopRow.canonical_name),
    order,
    stopType: stopRow.stop_type,
    city: stopRow.city,
    barangay: stopRow.barangay,
  };
}

function stopFromBinding(binding: RoutePlaceBindingRow, order: number, resolver: PlaceResolver): StructuredStop {
  const resolved = resolver.resolvePlace(binding.raw_text);
  const name = resolved?.displayName ?? cleanPlaceLabel(binding.raw_text);

  return {
    placeId: binding.primary_place_id,
    name,
    canonicalName: resolved?.canonicalName ?? name,
    key: resolved?.normalizedCanonical ?? binding.normalized_text,
    order,
    stopType: resolved?.type ?? null,
    city: resolved?.city ?? null,
    barangay: resolved?.barangay ?? null,
    rawText: binding.raw_text,
    sourceSection: binding.source_section,
  };
}

function ensureEndpointStops(
  stops: StructuredStop[],
  route: RouteRecord,
  resolver: PlaceResolver
) {
  const output = [...stops];
  const existingKeys = new Set(output.map((stop) => stop.key));
  const start = resolvePlaceEntity(route.origin, resolver);
  const end = resolvePlaceEntity(route.destination, resolver);

  if (start && !existingKeys.has(start.normalizedCanonical)) {
    output.unshift({
      id: null,
      placeId: start.id,
      name: start.displayName,
      canonicalName: start.canonicalName,
      key: start.normalizedCanonical,
      order: 0,
      stopType: start.type ?? null,
      city: start.city ?? null,
      barangay: start.barangay ?? null,
      sourceSection: "endpoint_origin",
    });
    existingKeys.add(start.normalizedCanonical);
  }

  if (end && !existingKeys.has(end.normalizedCanonical)) {
    output.push({
      id: null,
      placeId: end.id,
      name: end.displayName,
      canonicalName: end.canonicalName,
      key: end.normalizedCanonical,
      order: output.length + 1,
      stopType: end.type ?? null,
      city: end.city ?? null,
      barangay: end.barangay ?? null,
      sourceSection: "endpoint_destination",
    });
  }

  return reindexStops(uniqueStops(output));
}

function buildStopsFromVariant(
  variant: RouteVariantRow,
  route: RouteRecord,
  resolver: PlaceResolver,
  stopRowsById: Map<string, RouteStopRow>,
  stopOrdersByVariant: Map<string, RouteVariantStopOrderRow[]>,
  bindingsByVariant: Map<string, RoutePlaceBindingRow[]>
) {
  const orderedStopRows = stopOrdersByVariant.get(variant.id) ?? [];
  if (orderedStopRows.length > 0) {
    const stops = orderedStopRows
      .sort((left, right) => left.stop_order - right.stop_order)
      .map((stopOrder) => {
        const stopRow = stopRowsById.get(stopOrder.stop_id);
        if (!stopRow) return null;
        const stop = stopFromRow(stopRow, stopOrder.stop_order, resolver);
        return {
          ...stop,
          rawText: stopOrder.raw_text ?? null,
          sourceSection: stopOrder.source_section ?? null,
        };
      })
      .filter((stop) => stop !== null);

    return ensureEndpointStops(stops, route, resolver);
  }

  const orderedBindings = (bindingsByVariant.get(variant.id) ?? [])
    .filter((binding) => binding.order_hint != null)
    .sort((left, right) => (left.order_hint ?? 0) - (right.order_hint ?? 0));

  if (orderedBindings.length > 0) {
    const stops = orderedBindings.map((binding, index) => stopFromBinding(binding, index + 1, resolver));
    return ensureEndpointStops(stops, route, resolver);
  }

  return ensureEndpointStops(buildStops(route, resolver), route, resolver);
}

function toRuntimeBinding(binding: RoutePlaceBindingRow): RoutePlaceBinding {
  return {
    id: binding.id,
    datasetName: binding.dataset_name,
    routeCode: binding.route_code,
    variantId: binding.variant_id,
    rawText: binding.raw_text,
    normalizedText: binding.normalized_text,
    primaryPlaceId: binding.primary_place_id,
    matchedPlaceIds: binding.matched_place_ids ?? [],
    matchMethod: binding.match_method,
    matchConfidence: binding.match_confidence,
    orderHint: binding.order_hint,
    sourceSection: binding.source_section,
    needsReview: binding.needs_review,
  };
}

function buildVariantLandmarks(
  route: RouteRecord,
  stops: StructuredStop[],
  resolver: PlaceResolver
) {
  const base = buildLandmarks(route, resolver);
  const stopNames = [
    ...stops.slice(0, 3).map((stop) => stop.name),
    ...stops.slice(Math.max(0, stops.length - 3)).map((stop) => stop.name),
  ];
  const stopKeys = stops.map((stop) => stop.key);

  return {
    names: dedupeDisplayNames([route.origin, ...base.names, ...stopNames, route.destination]).slice(0, 8),
    keys: [...new Set([...base.keys, ...stopKeys])],
  };
}

function buildVariantAliases(route: RouteRecord, variant: RouteVariantRow, start: string | null, end: string | null) {
  return dedupeDisplayNames(
    [
      variant.display_name,
      variant.signboard,
      route.label,
      route.route_name,
      start && end ? `${start} - ${end}` : null,
    ].filter((value): value is string => Boolean(value))
  );
}

export function buildStructuredRoutes(routes: RouteRecord[], resolver: PlaceResolver) {
  return routes.map((route): StructuredRoute => {
    const signboard =
      (
        route.route_name ??
        [resolveDisplayName(route.origin, resolver), resolveDisplayName(route.destination, resolver)]
          .filter(Boolean)
          .join(" - ")
      ) ||
      route.code;

    const stops = buildStops(route, resolver);
    const landmarkData = buildLandmarks(route, resolver);

    return {
      routeId: `${slugify(route.code)}_${slugify(route.origin)}_${slugify(route.destination)}`,
      code: route.code,
      signboard,
      start: resolveDisplayName(route.origin, resolver),
      end: resolveDisplayName(route.destination, resolver),
      landmarks: landmarkData.names,
      roads: dedupeDisplayNames(route.roads ?? []),
      stops,
      confidence: buildRouteConfidence(route, stops),
      aliases: dedupeDisplayNames(
        [
          route.label,
          route.route_name,
          route.origin && route.destination
            ? `${cleanPlaceLabel(route.origin)} - ${cleanPlaceLabel(route.destination)}`
            : null,
        ].filter((value): value is string => Boolean(value))
      ),
      landmarkKeys: landmarkData.keys,
      sourceModel: "v1",
      raw: route,
    };
  });
}

export function buildStructuredRouteVariants(params: {
  routes: RouteRecord[];
  variants: RouteVariantRow[];
  mapRefs: RouteVariantMapRefRow[];
  stopRows: RouteStopRow[];
  stopOrders: RouteVariantStopOrderRow[];
  placeBindings: RoutePlaceBindingRow[];
  resolver: PlaceResolver;
}) {
  const { routes, variants, mapRefs, stopRows, stopOrders, placeBindings, resolver } = params;
  const routesByCode = buildRawRouteLookup(routes);
  const stopRowsById = new Map(stopRows.map((row) => [row.id, row]));
  const stopOrdersByVariant = new Map<string, RouteVariantStopOrderRow[]>();
  const bindingsByVariant = new Map<string, RoutePlaceBindingRow[]>();
  const mapRefsByVariant = new Map<string, RouteVariantMapRefRow>();

  for (const row of stopOrders) {
    const existing = stopOrdersByVariant.get(row.variant_id) ?? [];
    existing.push(row);
    stopOrdersByVariant.set(row.variant_id, existing);
  }

  for (const row of placeBindings) {
    if (!row.variant_id) continue;
    const existing = bindingsByVariant.get(row.variant_id) ?? [];
    existing.push(row);
    bindingsByVariant.set(row.variant_id, existing);
  }

  for (const row of mapRefs) {
    if (!mapRefsByVariant.has(row.variant_id)) {
      mapRefsByVariant.set(row.variant_id, row);
    }
  }

  return variants.map((variant): StructuredRouteVariant => {
    const rawRoute = matchRawRouteForVariant(variant, routesByCode);
    const stops = buildStopsFromVariant(
      variant,
      rawRoute,
      resolver,
      stopRowsById,
      stopOrdersByVariant,
      bindingsByVariant
    );
    const start = resolveDisplayName(rawRoute.origin, resolver) ?? stops[0]?.name ?? null;
    const end =
      resolveDisplayName(rawRoute.destination, resolver) ??
      stops[Math.max(0, stops.length - 1)]?.name ??
      null;
    const landmarkData = buildVariantLandmarks(rawRoute, stops, resolver);
    const signboard =
      variant.signboard ??
      rawRoute.route_name ??
      [start, end].filter(Boolean).join(" - ") ??
      variant.route_code;

    return {
      variantId: variant.id,
      routeId: `${slugify(variant.route_code)}_${variant.variant_key}`,
      code: variant.route_code,
      variantKey: variant.variant_key,
      signboard,
      direction: variant.direction,
      start,
      end,
      landmarks: landmarkData.names,
      roads: dedupeDisplayNames(rawRoute.roads ?? []),
      stops,
      confidence: clamp(
        variant.confidence_score > 0 ? variant.confidence_score : buildRouteConfidence(rawRoute, stops),
        0.1,
        0.99
      ),
      aliases: buildVariantAliases(rawRoute, variant, start, end),
      landmarkKeys: landmarkData.keys,
      mapRef: buildMapRef(mapRefsByVariant.get(variant.id)),
      placeBindings: (bindingsByVariant.get(variant.id) ?? []).map(toRuntimeBinding),
      raw: rawRoute,
    };
  });
}

export function projectRouteVariant(variant: StructuredRouteVariant): StructuredRoute {
  return {
    routeId: variant.routeId,
    variantId: variant.variantId,
    variantKey: variant.variantKey,
    code: variant.code,
    signboard: variant.signboard,
    direction: variant.direction,
    start: variant.start,
    end: variant.end,
    landmarks: variant.landmarks,
    roads: variant.roads,
    stops: variant.stops,
    confidence: variant.confidence,
    aliases: variant.aliases,
    landmarkKeys: variant.landmarkKeys,
    mapRef: variant.mapRef,
    sourceModel: "v2",
    raw: variant.raw,
  };
}
