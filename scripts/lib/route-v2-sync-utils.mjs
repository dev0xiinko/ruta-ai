export function normalizeSyncText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniquePlaceMatches(matches) {
  const output = [];
  const seen = new Set();
  for (const place of matches) {
    if (!place?.id || seen.has(place.id)) continue;
    seen.add(place.id);
    output.push(place);
  }
  return output;
}

export function buildMapRefLookup(mapPayload) {
  const map = new Map();
  for (const row of mapPayload?.routes ?? []) {
    map.set(String(row.code).toUpperCase(), row);
  }
  return map;
}

export function createPlaceDirectory(places = [], aliases = []) {
  const placesById = new Map();
  const placesByNormalized = new Map();

  for (const place of places ?? []) {
    const normalizedName = place.normalized_name || normalizeSyncText(place.canonical_name);
    const record = {
      ...place,
      normalized_name: normalizedName,
    };
    placesById.set(place.id, record);
    if (!placesByNormalized.has(normalizedName)) {
      placesByNormalized.set(normalizedName, []);
    }
    placesByNormalized.get(normalizedName).push(record);
  }

  for (const alias of aliases ?? []) {
    const normalizedAlias = alias.normalized_alias || normalizeSyncText(alias.alias);
    const place = placesById.get(alias.place_id);
    if (!place) continue;
    if (!placesByNormalized.has(normalizedAlias)) {
      placesByNormalized.set(normalizedAlias, []);
    }
    placesByNormalized.get(normalizedAlias).push(place);
  }

  const scanEntries = [...placesByNormalized.entries()]
    .filter(([alias]) => alias.length >= 3)
    .sort((left, right) => right[0].length - left[0].length);

  return {
    placesById,
    placesByNormalized,
    scanEntries,
  };
}

export function resolvePlaceFromDirectory(text, directory) {
  const normalized = normalizeSyncText(text);
  if (!normalized) return [];

  const exact = directory.placesByNormalized.get(normalized);
  if (exact?.length) {
    return exact;
  }

  const matches = [];
  for (const [alias, places] of directory.scanEntries) {
    if (normalized.includes(alias)) {
      matches.push(...places);
      break;
    }
  }

  return uniquePlaceMatches(matches);
}

export function extractOrderedPlaces(text, directory) {
  const normalizedText = normalizeSyncText(text);
  const matches = [];

  for (const [alias, places] of directory.scanEntries) {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    let match;
    while ((match = pattern.exec(normalizedText))) {
      for (const place of places) {
        matches.push({
          start: match.index,
          end: match.index + alias.length,
          place,
        });
      }
    }
  }

  matches.sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));

  const chosen = [];
  for (const item of matches) {
    const overlaps = chosen.some(
      (existing) => item.start < existing.end && item.end > existing.start
    );
    if (!overlaps) chosen.push(item);
  }

  const output = [];
  const seen = new Set();
  for (const item of chosen) {
    if (seen.has(item.place.id)) continue;
    seen.add(item.place.id);
    output.push(item.place);
  }

  return output;
}
