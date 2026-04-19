import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMapRefLookup,
  createPlaceDirectory,
  extractOrderedPlaces,
  resolvePlaceFromDirectory,
} from "@/scripts/lib/route-v2-sync-utils.mjs";

const places = [
  {
    id: "colon",
    canonical_name: "Colon",
    normalized_name: "colon",
  },
  {
    id: "emall",
    canonical_name: "Elizabeth Mall",
    normalized_name: "elizabeth mall",
  },
  {
    id: "sm",
    canonical_name: "SM City Cebu",
    normalized_name: "sm city cebu",
  },
  {
    id: "parkmall",
    canonical_name: "Parkmall",
    normalized_name: "parkmall",
  },
];

const aliases = [
  { place_id: "colon", alias: "colon", normalized_alias: "colon" },
  { place_id: "colon", alias: "metro gaisano colon", normalized_alias: "metro gaisano colon" },
  { place_id: "emall", alias: "e mall", normalized_alias: "e mall" },
  { place_id: "emall", alias: "emall", normalized_alias: "emall" },
  { place_id: "sm", alias: "sm hypermarket", normalized_alias: "sm hypermarket" },
  { place_id: "parkmall", alias: "parkmall puj terminal", normalized_alias: "parkmall puj terminal" },
];

test("creates a lookup for scraped map references", () => {
  const lookup = buildMapRefLookup({
    routes: [
      {
        code: "01K",
        google_map_url: "https://maps.google.com/?msid=test-map",
        embed_url: "https://maps.google.com/maps/ms?msa=0&msid=test-map&output=embed",
        map_id: "test-map",
      },
    ],
  });

  const mapRef = lookup.get("01K");
  assert.ok(mapRef);
  assert.equal(mapRef.map_id, "test-map");
});

test("binds messy raw text fragments to canonical commuter places", () => {
  const directory = createPlaceDirectory(places, aliases);

  assert.equal(resolvePlaceFromDirectory("E. Mall", directory)[0]?.canonical_name, "Elizabeth Mall");
  assert.equal(resolvePlaceFromDirectory("Sm Hypermarket", directory)[0]?.canonical_name, "SM City Cebu");
  assert.equal(resolvePlaceFromDirectory("Parkmall PUJ Terminal", directory)[0]?.canonical_name, "Parkmall");

  const ordered = extractOrderedPlaces(
    "Colon St. Metro Gaisano (colon) - E. Mall - Sm Hypermarket - Parkmall PUJ Terminal",
    directory
  );

  assert.deepEqual(
    ordered.map((place) => place.canonical_name),
    ["Colon", "Elizabeth Mall", "SM City Cebu", "Parkmall"]
  );
});
