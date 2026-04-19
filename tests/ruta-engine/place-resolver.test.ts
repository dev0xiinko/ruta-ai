import assert from "node:assert/strict";
import test from "node:test";
import { buildResolver } from "./fixtures";

test("resolves commuter aliases and expands place hierarchy", () => {
  const resolver = buildResolver();

  const itPark = resolver.resolvePlace("it park");
  assert.ok(itPark);
  assert.equal(itPark.displayName, "Cebu IT Park");

  const jySquare = resolver.resolvePlace("Jy");
  assert.ok(jySquare);
  assert.equal(jySquare.displayName, "JY Square");

  const hierarchyKeys = resolver.buildMatchKeys(itPark);
  assert.ok(hierarchyKeys.has("it park"));
  assert.ok(hierarchyKeys.has("lahug"));
  assert.ok(hierarchyKeys.has("cebu city"));

  assert.equal(resolver.resolvePlace("usc main")?.displayName, "USC Main");
  assert.equal(resolver.resolvePlace("E. Mall")?.displayName, "Elizabeth Mall");
  assert.equal(resolver.resolvePlace("North Bus Terminal")?.displayName, "North Bus Terminal");
});
