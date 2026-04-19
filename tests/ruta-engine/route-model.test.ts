import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStructuredRouteVariants,
  buildStructuredRoutes,
  projectRouteVariant,
} from "@/lib/ruta-engine/route-model";
import { aliasRows, buildResolver, mapRefRows, routeRows, stopOrderRows, stopRows, variantRows } from "./fixtures";

test("loads ordered stops from v2 variant stop tables and projects back to legacy shape", () => {
  const resolver = buildResolver();

  const variants = buildStructuredRouteVariants({
    routes: routeRows,
    variants: variantRows,
    mapRefs: mapRefRows,
    stopRows,
    stopOrders: stopOrderRows,
    placeBindings: [],
    resolver,
  });

  assert.equal(variants.length, 1);
  assert.deepEqual(
    variants[0].stops.map((stop) => stop.name),
    ["Apas", "Cebu IT Park", "Ayala Center Cebu", "USC Main", "Colon", "Carbon Market"]
  );
  assert.equal(variants[0].mapRef?.hasMap, true);
  assert.equal(variants[0].mapRef?.mapId, "abc123");

  const legacyRoute = projectRouteVariant(variants[0]);
  assert.equal(legacyRoute.sourceModel, "v2");
  assert.equal(legacyRoute.variantKey, "17b_apas_carbon_outbound");
});

test("falls back to inferred v1 stop order when v2 stop data is missing", () => {
  const resolver = buildResolver();

  const variants = buildStructuredRouteVariants({
    routes: routeRows,
    variants: variantRows,
    mapRefs: [],
    stopRows: [],
    stopOrders: [],
    placeBindings: [],
    resolver,
  });

  assert.equal(variants.length, 1);
  assert.equal(variants[0].stops[0]?.name, "Apas");
  assert.equal(variants[0].stops.at(-1)?.name, "Carbon Market");
  assert.ok(variants[0].stops.some((stop) => stop.name === "Cebu IT Park"));

  const legacyRoutes = buildStructuredRoutes(routeRows, resolver);
  assert.equal(legacyRoutes[0].sourceModel, "v1");
  assert.equal(legacyRoutes[0].code, variantRows[0].route_code);
  assert.equal(aliasRows.length > 0, true);
});
