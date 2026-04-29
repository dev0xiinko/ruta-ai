import "server-only";

import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type {
  RoutePlaceBindingRow,
  RouteStopRow,
  RouteVariantMapRefRow,
  RouteVariantRow,
  RouteVariantStopOrderRow,
} from "@/lib/ruta-engine/types";

export async function loadDebugRoutePageData(input: {
  codeFilter: string;
  selectedVariantKey: string;
}) {
  const [variantCount, mapRefCount, stopCount, stopOrderCount, bindingCount, variants] =
    await Promise.all([
      loadCount("route_variants"),
      loadCount("route_variant_map_refs"),
      loadCount("route_stops"),
      loadCount("route_variant_stop_order"),
      loadCount("route_place_bindings"),
      loadVariantRows(input.codeFilter),
    ]);

  const selectedVariant =
    variants.find((variant) => variant.variant_key === input.selectedVariantKey) ??
    variants[0] ??
    null;

  const details = await loadSelectedVariantDetails(selectedVariant?.id ?? null);

  return {
    counts: {
      variantCount,
      mapRefCount,
      stopCount,
      stopOrderCount,
      bindingCount,
    },
    variants,
    selectedVariant,
    ...details,
  };
}

async function loadCount(table: string) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadVariantRows(codeFilter: string) {
  let query = supabaseAdmin
    .from("route_variants")
    .select("*")
    .order("route_code", { ascending: true })
    .order("confidence_score", { ascending: false })
    .limit(40);

  if (codeFilter) {
    query = query.ilike("route_code", `%${codeFilter}%`);
  }

  const { data, error } = await query.returns<RouteVariantRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadSelectedVariantDetails(variantId: string | null) {
  if (!variantId) {
    return {
      mapRefs: [] as RouteVariantMapRefRow[],
      stopOrder: [] as Array<RouteVariantStopOrderRow & { route_stops: RouteStopRow | null }>,
      bindings: [] as RoutePlaceBindingRow[],
    };
  }

  const [
    { data: mapRefs, error: mapError },
    { data: stopOrder, error: stopError },
    { data: bindings, error: bindingError },
  ] = await Promise.all([
    supabaseAdmin
      .from("route_variant_map_refs")
      .select("*")
      .eq("variant_id", variantId)
      .returns<RouteVariantMapRefRow[]>(),
    supabaseAdmin
      .from("route_variant_stop_order")
      .select("*, route_stops(*)")
      .eq("variant_id", variantId)
      .order("stop_order", { ascending: true })
      .returns<Array<RouteVariantStopOrderRow & { route_stops: RouteStopRow | null }>>(),
    supabaseAdmin
      .from("route_place_bindings")
      .select("*")
      .eq("variant_id", variantId)
      .order("order_hint", { ascending: true, nullsFirst: false })
      .order("match_confidence", { ascending: false })
      .returns<RoutePlaceBindingRow[]>(),
  ]);

  if (mapError) throw new Error(mapError.message);
  if (stopError) throw new Error(stopError.message);
  if (bindingError) throw new Error(bindingError.message);

  return {
    mapRefs: mapRefs ?? [],
    stopOrder: stopOrder ?? [],
    bindings: bindings ?? [],
  };
}

