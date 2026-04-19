import assert from "node:assert/strict";
import test from "node:test";
import { matchRouteCodeQuery, matchTripQuery } from "@/lib/ruta-engine/route-matcher";
import {
  buildStructuredRouteVariants,
  projectRouteVariant,
} from "@/lib/ruta-engine/route-model";
import { buildResolver, mapRefRows, routeRows, stopOrderRows, stopRows, variantRows } from "./fixtures";

function buildProjectedRoutes() {
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

  return {
    resolver,
    routes: variants.map((variant) => projectRouteVariant(variant)),
  };
}

test("prefers deterministic exact code lookup", () => {
  const { routes } = buildProjectedRoutes();
  const candidates = matchRouteCodeQuery(routes, {
    type: "route_code",
    raw: "17B",
    code: "17B",
    searchText: "17B",
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].route.code, "17B");
  assert.ok(candidates[0].score >= 0.8);
});

test("validates forward stop order for place to place trips", () => {
  const { routes, resolver } = buildProjectedRoutes();

  const forward = matchTripQuery(routes, resolver, {
    type: "place_to_place",
    raw: "IT Park to Colon",
    originText: "IT Park",
    destinationText: "Colon",
  });

  assert.equal(forward.directCandidates[0]?.route.code, "17B");
  assert.equal(forward.directCandidates[0]?.directionValid, true);

  const reverse = matchTripQuery(routes, resolver, {
    type: "place_to_place",
    raw: "Colon to IT Park",
    originText: "Colon",
    destinationText: "IT Park",
  });

  assert.equal(reverse.directCandidates.length, 0);
  assert.ok(reverse.fallbackCandidates.length >= 1);
  assert.equal(reverse.fallbackCandidates[0]?.directionValid, false);
});
