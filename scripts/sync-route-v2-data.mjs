import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildMapRefLookup,
  createPlaceDirectory,
  extractOrderedPlaces,
  normalizeSyncText,
  resolvePlaceFromDirectory,
  uniquePlaceMatches,
} from "./lib/route-v2-sync-utils.mjs";

const datasetPath = resolve("scrapper/validation/cebu_jeepney_routes_validated.json");
const mapRefsPath = resolve("scrapper/data/route-map-refs.json");
const envPath = resolve(".env.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rest] = match;
    if (process.env[key]) continue;
    let value = rest.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local or export env vars first."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function slugify(value) {
  return normalizeSyncText(value).replace(/\s+/g, "_");
}

function uniqueStrings(values) {
  const output = [];
  const seen = new Set();

  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeSyncText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(value);
  }

  return output;
}

function splitRawFragments(route) {
  return [
    ...(route.roads ?? []).map((value) => ({ rawText: value, sourceSection: "roads" })),
    ...(route.schools ?? []).map((value) => ({ rawText: value, sourceSection: "schools" })),
    ...(route.malls_groceries ?? []).map((value) => ({ rawText: value, sourceSection: "malls_groceries" })),
    ...(route.churches ?? []).map((value) => ({ rawText: value, sourceSection: "churches" })),
    ...(route.government ?? []).map((value) => ({ rawText: value, sourceSection: "government" })),
    ...(route.hotels ?? []).map((value) => ({ rawText: value, sourceSection: "hotels" })),
    ...(route.health ?? []).map((value) => ({ rawText: value, sourceSection: "health" })),
    ...(route.terminals ?? []).map((value) => ({ rawText: value, sourceSection: "terminals" })),
    ...(route.info ?? []).map((value) => ({ rawText: value, sourceSection: "info" })),
    ...Object.entries(route.raw_sections ?? {}).map(([section, value]) => ({
      rawText: value,
      sourceSection: section,
    })),
  ].filter((item) => item.rawText && String(item.rawText).trim());
}

function buildVariantDirection(route) {
  const signboard = normalizeSyncText(route.route_name ?? "");
  if (signboard.includes("vice versa")) return "loop";
  return "outbound";
}

function buildVariantKey(route) {
  return `${slugify(route.code)}_${slugify(route.origin ?? "unknown")}_${slugify(route.destination ?? "unknown")}_${buildVariantDirection(route)}`;
}

function buildDisplayName(route) {
  return route.route_name ?? ([route.origin, route.destination].filter(Boolean).join(" - ") || route.code);
}

async function loadPlaceDirectory() {
  const [{ data: places, error: placesError }, { data: aliases, error: aliasesError }] =
    await Promise.all([
      supabase
        .from("route_places")
        .select("id, canonical_name, normalized_name, city, barangay, type, parent_place_id, importance_rank, related_place_ids, latitude, longitude"),
      supabase
        .from("route_place_aliases")
        .select("id, place_id, alias, normalized_alias, alias_kind, confidence_score"),
    ]);

  if (placesError) throw new Error(placesError.message);
  if (aliasesError) throw new Error(aliasesError.message);

  return createPlaceDirectory(places ?? [], aliases ?? []);
}

async function upsertRouteStop(place, fallbackType = "landmark") {
  const payload = {
    canonical_name: place.canonical_name,
    display_name: place.canonical_name,
    place_id: place.id,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    stop_type: place.type ?? fallbackType,
    city: place.city ?? null,
    barangay: place.barangay ?? null,
    source: "route_v2_sync",
  };

  const { data, error } = await supabase
    .from("route_stops")
    .upsert(payload, { onConflict: "canonical_name" })
    .select("id, canonical_name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function syncVariant(route, datasetName, mapRefLookup, placeDirectory) {
  const variantKey = buildVariantKey(route);
  const direction = buildVariantDirection(route);
  const originMatches = resolvePlaceFromDirectory(route.origin, placeDirectory);
  const destinationMatches = resolvePlaceFromDirectory(route.destination, placeDirectory);
  const originPlace = originMatches[0] ?? null;
  const destinationPlace = destinationMatches[0] ?? null;

  const variantPayload = {
    dataset_name: datasetName,
    route_code: route.code,
    variant_key: variantKey,
    display_name: buildDisplayName(route),
    direction,
    signboard:
      route.route_name ??
      ([route.origin, route.destination].filter(Boolean).join(" - ") || route.code),
    origin_place_id: originPlace?.id ?? null,
    destination_place_id: destinationPlace?.id ?? null,
    qa_status: route.qa_status ?? "usable_with_caution",
    confidence_score: Number(((route.completeness_score ?? 0) / 100).toFixed(3)),
    source_urls: route.source_urls ?? [],
    warnings: route.warnings ?? [],
    raw_summary: {
      route_name: route.route_name,
      origin: route.origin,
      destination: route.destination,
      completeness_score: route.completeness_score ?? 0,
    },
  };

  const { data: variant, error: variantError } = await supabase
    .from("route_variants")
    .upsert(variantPayload, { onConflict: "dataset_name,variant_key" })
    .select("id, variant_key")
    .single();

  if (variantError) throw new Error(variantError.message);

  const pageMapRef = mapRefLookup.get(String(route.code).toUpperCase());
  if (pageMapRef) {
    const { error: mapRefError } = await supabase
      .from("route_variant_map_refs")
      .upsert(
        {
          variant_id: variant.id,
          page_url: pageMapRef.page_url,
          google_map_url: pageMapRef.google_map_url ?? null,
          embed_url: pageMapRef.embed_url ?? null,
          map_id: pageMapRef.map_id ?? null,
          center_ll: pageMapRef.center_ll ?? null,
          span: pageMapRef.span ?? null,
          iwloc: pageMapRef.iwloc ?? null,
          map_title: pageMapRef.title ?? null,
          source: "cebujeepneys.weebly.com",
        },
        { onConflict: "variant_id,page_url" }
      );

    if (mapRefError) throw new Error(mapRefError.message);
  }

  const fragments = splitRawFragments(route);
  const bindings = [];

  for (const fragment of fragments) {
    const matches =
      fragment.sourceSection === "info" || fragment.sourceSection === "roads"
        ? extractOrderedPlaces(fragment.rawText, placeDirectory)
        : resolvePlaceFromDirectory(fragment.rawText, placeDirectory);
    const primary = matches[0] ?? null;
    bindings.push({
      dataset_name: datasetName,
      route_code: route.code,
      variant_id: variant.id,
      raw_text: fragment.rawText,
      normalized_text: normalizeSyncText(fragment.rawText),
      primary_place_id: primary?.id ?? null,
      matched_place_ids: matches.map((item) => item.id),
      match_method: primary ? "exact_or_alias" : "unresolved",
      match_confidence:
        primary ? (normalizeSyncText(fragment.rawText) === primary.normalized_name ? 1 : 0.8) : 0,
      order_hint: null,
      source_section: fragment.sourceSection,
      needs_review: matches.length === 0,
    });
  }

  const routeStopPlaces = [];
  if (originPlace) routeStopPlaces.push(originPlace);

  for (const infoText of route.info ?? []) {
    routeStopPlaces.push(...extractOrderedPlaces(infoText, placeDirectory));
  }

  for (const sectionValue of Object.values(route.raw_sections ?? {})) {
    routeStopPlaces.push(...extractOrderedPlaces(sectionValue, placeDirectory));
  }

  if (destinationPlace) routeStopPlaces.push(destinationPlace);

  const orderedPlaces = uniquePlaceMatches(routeStopPlaces);

  for (let index = 0; index < orderedPlaces.length; index += 1) {
    const place = orderedPlaces[index];
    const matchingBinding = bindings.find((binding) =>
      binding.matched_place_ids.includes(place.id)
    );
    if (matchingBinding && matchingBinding.order_hint == null) {
      matchingBinding.order_hint = index + 1;
    }
  }

  const { error: deleteBindingsError } = await supabase
    .from("route_place_bindings")
    .delete()
    .eq("variant_id", variant.id);

  if (deleteBindingsError) throw new Error(deleteBindingsError.message);

  if (bindings.length > 0) {
    const { error: bindingsError } = await supabase
      .from("route_place_bindings")
      .insert(bindings);

    if (bindingsError) throw new Error(bindingsError.message);
  }

  const { error: deleteStopOrderError } = await supabase
    .from("route_variant_stop_order")
    .delete()
    .eq("variant_id", variant.id);

  if (deleteStopOrderError) throw new Error(deleteStopOrderError.message);

  const stopRows = [];
  for (let index = 0; index < orderedPlaces.length; index += 1) {
    const place = orderedPlaces[index];
    const stop = await upsertRouteStop(place);
    stopRows.push({
      variant_id: variant.id,
      stop_id: stop.id,
      stop_order: index + 1,
      is_pickup: true,
      is_dropoff: true,
      raw_text: place.canonical_name,
      source_section: "binding_order",
    });
  }

  if (stopRows.length > 0) {
    const { error: stopOrderError } = await supabase
      .from("route_variant_stop_order")
      .insert(stopRows);

    if (stopOrderError) throw new Error(stopOrderError.message);
  }

  return {
    variantKey,
    stopCount: stopRows.length,
    bindingCount: bindings.length,
    hasMapRef: Boolean(pageMapRef),
  };
}

async function main() {
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
  const mapRefs = existsSync(mapRefsPath)
    ? JSON.parse(readFileSync(mapRefsPath, "utf8"))
    : { routes: [] };
  const mapRefLookup = buildMapRefLookup(mapRefs);
  const placeDirectory = await loadPlaceDirectory();

  console.log(`Syncing v2 route data for dataset ${dataset.dataset_name}`);

  for (const route of dataset.routes) {
    const result = await syncVariant(route, dataset.dataset_name, mapRefLookup, placeDirectory);
    console.log(
      `Synced ${route.code} -> ${result.variantKey} (${result.stopCount} stops, ${result.bindingCount} bindings, map=${result.hasMapRef})`
    );
  }

  console.log("Route v2 sync complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
