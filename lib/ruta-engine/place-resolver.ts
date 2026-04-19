import type {
  PlaceEntity,
  RoutePlaceAliasRow,
  RoutePlaceRow,
  RouteRecord,
} from "@/lib/ruta-engine/types";

const DISPLAY_OVERRIDES: Record<string, string> = {
  "it park": "Cebu IT Park",
  "ayala center cebu": "Ayala Center Cebu",
  "carbon public market": "Carbon Market",
  carbon: "Carbon Market",
  "fuente osmena": "Fuente",
  fuente: "Fuente",
  "university of san carlos talamban campus": "USC Talamban",
  "university of san carlos main campus": "USC Main",
  "university of cebu main campus": "UC Main",
  "university of cebu banilad campus": "UC Banilad",
  "cebu institute of technology university citu": "CIT-U",
  "asian college of technology": "ACT",
  "southwestern university": "SWU",
  "southwestern university basak campus": "SWU Basak",
  "university of southern philippines foundation": "USPF",
  "university of the philippines cebu": "UP Cebu",
  "university of visayas main campus": "UV Main",
  "cebu technological university main campus": "CTU Main",
  "cebu normal university": "CNU",
  "university of san jose recoletos": "USJR",
  "cebu doctors university": "CDU",
  "cebu doctors university hospital": "CDU Hospital",
};

const MANUAL_PLACE_GROUPS = [
  {
    canonicalName: "IT Park",
    displayName: "Cebu IT Park",
    aliases: ["it park", "cebu it park"],
    sourceKind: "manual",
    importanceRank: 90,
    type: "district",
  },
  {
    canonicalName: "Ayala",
    displayName: "Ayala Center Cebu",
    aliases: ["ayala", "ayala center", "ayala center cebu"],
    sourceKind: "manual",
    importanceRank: 95,
    type: "mall",
  },
  {
    canonicalName: "Carbon",
    displayName: "Carbon Market",
    aliases: ["carbon", "carbon market", "carbon public market"],
    sourceKind: "manual",
    importanceRank: 95,
    type: "terminal",
  },
  {
    canonicalName: "SM City Cebu",
    displayName: "SM City Cebu",
    aliases: ["sm", "sm city", "sm city cebu", "sm hypermarket"],
    sourceKind: "manual",
    importanceRank: 95,
    type: "mall",
  },
  {
    canonicalName: "Fuente Osmena",
    displayName: "Fuente",
    aliases: ["fuente", "fuente osmena"],
    sourceKind: "manual",
    importanceRank: 85,
    type: "district",
  },
  {
    canonicalName: "Robinsons Fuente",
    displayName: "Robinsons Fuente",
    aliases: ["robinsons fuente"],
    sourceKind: "manual",
    importanceRank: 82,
    type: "mall",
  },
  {
    canonicalName: "Colon",
    displayName: "Colon",
    aliases: ["colon", "metro colon", "colonnade"],
    sourceKind: "manual",
    importanceRank: 92,
    type: "district",
  },
  {
    canonicalName: "Taboan",
    displayName: "Taboan",
    aliases: ["taboan", "tabo-an", "taboan public market"],
    sourceKind: "manual",
    importanceRank: 78,
    type: "market",
  },
  {
    canonicalName: "Parkmall",
    displayName: "Parkmall",
    aliases: ["parkmall", "parkmall puj terminal"],
    sourceKind: "manual",
    importanceRank: 90,
    type: "terminal",
  },
  {
    canonicalName: "JY Square",
    displayName: "JY Square",
    aliases: ["jy", "jy square", "jy square mall"],
    sourceKind: "manual",
    importanceRank: 84,
    type: "mall",
  },
  {
    canonicalName: "Elizabeth Mall",
    displayName: "Elizabeth Mall",
    aliases: ["e mall", "emall", "elizabeth mall"],
    sourceKind: "manual",
    importanceRank: 82,
    type: "mall",
  },
  {
    canonicalName: "North Bus Terminal",
    displayName: "North Bus Terminal",
    aliases: ["north bus terminal", "cebu north bus terminal"],
    sourceKind: "manual",
    importanceRank: 85,
    type: "terminal",
  },
];

const GENERIC_ALIAS_STOPLIST = new Set([
  "main campus",
  "downtown campus",
  "campus",
  "main",
  "downtown",
]);

function uniqueStrings(values: string[]) {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const cleaned = normalizeText(value);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push(cleaned);
  }

  return output;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueRegisteredPlaces(values: RegisteredPlace[]) {
  const output: RegisteredPlace[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.normalizedCanonical)) continue;
    seen.add(value.normalizedCanonical);
    output.push(value);
  }

  return output;
}

function uniquePlaceEntities(values: PlaceEntity[]) {
  const output: PlaceEntity[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.normalizedCanonical)) continue;
    seen.add(value.normalizedCanonical);
    output.push(value);
  }

  return output;
}

function sortPlacesByImportance(values: RegisteredPlace[]) {
  return [...values].sort((left, right) => {
    const rightRank = right.importanceRank ?? 0;
    const leftRank = left.importanceRank ?? 0;
    if (rightRank !== leftRank) return rightRank - leftRank;
    return left.displayName.localeCompare(right.displayName);
  });
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPlaceLabel(value: string) {
  return value
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/[^a-z0-9)\]]+$/i, "")
    .trim();
}

function cleanSchoolName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*\(([^)]+)\)\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRoadLike(value: string) {
  const normalized = normalizeText(value);
  return /\b(st|street|ave|avenue|road|rd|drive|dr|blvd|boulevard|highway|ext|extension)\b/.test(
    normalized
  );
}

function isRoutePhrase(value: string) {
  const normalized = normalizeText(value);
  const toCount = (normalized.match(/\bto\b/g) ?? []).length;
  return toCount >= 2 || normalized.includes("vice versa");
}

function buildSchoolAliases(school: string) {
  const aliases = new Set<string>();
  const cleaned = cleanSchoolName(school);
  const normalized = normalizeText(cleaned);

  if (normalized) {
    aliases.add(normalized);
  }

  const withoutCampus = normalized.replace(/\bcampus\b/g, "").replace(/\s+/g, " ").trim();
  if (withoutCampus) {
    aliases.add(withoutCampus);
  }

  const words = cleaned
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const significantWords = words.filter(
    (word) => !["of", "the", "and", "de", "del", "la"].includes(word.toLowerCase())
  );

  const acronym = significantWords.map((word) => word[0]).join("").toLowerCase();
  if (acronym.length >= 2) {
    aliases.add(acronym);
  }

  const explicitAcronyms = words.filter((word) => /^[A-Z]{2,}(?:-[A-Z])?$/.test(word));
  for (const token of explicitAcronyms) {
    aliases.add(normalizeText(token));
    aliases.add(normalizeText(token.replace("-", "")));
    aliases.add(normalizeText(token.replace("-", " ")));
  }

  if (normalized.includes("university of san carlos")) {
    if (normalized.includes("talamban")) {
      aliases.add("usc tc");
      aliases.add("usc talamban");
      aliases.add("usc talamban campus");
    }
    if (normalized.includes("main") || normalized.includes("downtown")) {
      aliases.add("usc main");
      aliases.add("usc main campus");
      aliases.add("usc downtown");
      aliases.add("usc downtown campus");
    }
  }

  if (normalized.includes("cebu institute of technology")) {
    aliases.add("cit");
    aliases.add("cit-u");
    aliases.add("cit u");
    aliases.add("citu");
  }

  if (normalized.includes("university of cebu")) {
    aliases.add("uc");
    if (normalized.includes("main")) aliases.add("uc main");
    if (normalized.includes("banilad")) aliases.add("uc banilad");
  }

  if (normalized.includes("southwestern university")) {
    aliases.add("swu");
    if (normalized.includes("basak")) aliases.add("swu basak");
  }

  if (normalized.includes("university of southern philippines foundation")) {
    aliases.add("uspf");
  }

  if (normalized.includes("university of the philippines")) {
    aliases.add("up");
    aliases.add("up cebu");
    aliases.add("upc");
  }

  if (
    normalized.includes("university of visayas") ||
    normalized.includes("university of the visayas")
  ) {
    aliases.add("uv");
    aliases.add("uv main");
  }

  if (normalized.includes("cebu technological university")) {
    aliases.add("ctu");
    aliases.add("ctu main");
  }

  if (normalized.includes("cebu normal university")) {
    aliases.add("cnu");
  }

  if (normalized.includes("university of san jose recoletos")) {
    aliases.add("usjr");
  }

  if (normalized.includes("cebu doctors university")) {
    aliases.add("cdu");
    if (normalized.includes("hospital")) aliases.add("cdu hospital");
  }

  if (normalized.includes("asian college of technology")) {
    aliases.add("act");
  }

  return [...aliases]
    .map((alias) => normalizeText(alias))
    .filter((alias) => alias.length >= 2 && !GENERIC_ALIAS_STOPLIST.has(alias));
}

function getDisplayName(canonicalName: string) {
  const normalized = normalizeText(canonicalName);
  return DISPLAY_OVERRIDES[normalized] ?? titleCase(canonicalName);
}

type RegisteredPlace = {
  id: string | null;
  canonicalName: string;
  normalizedCanonical: string;
  displayName: string;
  aliases: Set<string>;
  sourceKinds: Set<string>;
  type: string | null;
  city: string | null;
  barangay: string | null;
  parentPlaceId: string | null;
  relatedPlaceIds: Set<string>;
  latitude: number | null;
  longitude: number | null;
  importanceRank: number;
  childPlaceIds: Set<string>;
};

export class PlaceResolver {
  private readonly placesByCanonical = new Map<string, RegisteredPlace>();
  private readonly placesById = new Map<string, RegisteredPlace>();
  private readonly placesByAlias = new Map<string, RegisteredPlace[]>();
  private readonly scannableAliases: Array<{ alias: string; place: RegisteredPlace }> = [];

  registerPlace(input: {
    id?: string | null;
    canonicalName: string;
    displayName?: string;
    aliases?: string[];
    sourceKind: string;
    type?: string | null;
    city?: string | null;
    barangay?: string | null;
    parentPlaceId?: string | null;
    relatedPlaceIds?: string[];
    latitude?: number | null;
    longitude?: number | null;
    importanceRank?: number | null;
  }) {
    const canonicalKey = normalizeText(input.canonicalName);
    if (!canonicalKey || isRoadLike(input.canonicalName) || isRoutePhrase(input.canonicalName)) {
      return;
    }

    const incomingDisplayName = input.displayName ?? getDisplayName(input.canonicalName);
    const fallbackDisplayName = titleCase(input.canonicalName);

    const existing =
      this.placesByCanonical.get(canonicalKey) ??
      {
        id: input.id ?? null,
        canonicalName: input.canonicalName,
        normalizedCanonical: canonicalKey,
        displayName: incomingDisplayName,
        aliases: new Set<string>(),
        sourceKinds: new Set<string>(),
        type: input.type ?? null,
        city: input.city ?? null,
        barangay: input.barangay ?? null,
        parentPlaceId: input.parentPlaceId ?? null,
        relatedPlaceIds: new Set<string>(),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        importanceRank: input.importanceRank ?? 0,
        childPlaceIds: new Set<string>(),
      };

    if (!existing.id && input.id) existing.id = input.id;
    if (
      input.sourceKind === "manual" ||
      !existing.displayName ||
      existing.displayName === fallbackDisplayName
    ) {
      existing.displayName = incomingDisplayName;
    }
    existing.sourceKinds.add(input.sourceKind);
    existing.aliases.add(canonicalKey);
    if (input.type && !existing.type) existing.type = input.type;
    if (input.city && !existing.city) existing.city = input.city;
    if (input.barangay && !existing.barangay) existing.barangay = input.barangay;
    if (input.parentPlaceId && !existing.parentPlaceId) existing.parentPlaceId = input.parentPlaceId;
    if (input.latitude != null && existing.latitude == null) existing.latitude = input.latitude;
    if (input.longitude != null && existing.longitude == null) existing.longitude = input.longitude;
    if ((input.importanceRank ?? 0) > existing.importanceRank) {
      existing.importanceRank = input.importanceRank ?? 0;
    }

    for (const relatedPlaceId of input.relatedPlaceIds ?? []) {
      if (relatedPlaceId) existing.relatedPlaceIds.add(relatedPlaceId);
    }

    for (const alias of input.aliases ?? []) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias || GENERIC_ALIAS_STOPLIST.has(normalizedAlias)) continue;
      existing.aliases.add(normalizedAlias);
    }

    this.placesByCanonical.set(canonicalKey, existing);
    if (existing.id) {
      this.placesById.set(existing.id, existing);
    }
  }

  finalize() {
    this.placesByAlias.clear();

    for (const place of this.placesByCanonical.values()) {
      place.childPlaceIds.clear();
    }

    for (const place of this.placesByCanonical.values()) {
      for (const alias of place.aliases) {
        const existing = this.placesByAlias.get(alias) ?? [];
        existing.push(place);
        this.placesByAlias.set(alias, uniqueRegisteredPlaces(existing));
      }
    }

    for (const place of this.placesByCanonical.values()) {
      if (!place.parentPlaceId) continue;
      const parent = this.placesById.get(place.parentPlaceId);
      if (!parent) continue;
      if (place.id) {
        parent.childPlaceIds.add(place.id);
      }
    }

    this.scannableAliases.splice(0, this.scannableAliases.length);
    for (const [alias, places] of this.placesByAlias.entries()) {
      if (alias.length < 4) continue;
      for (const place of places) {
        this.scannableAliases.push({ alias, place });
      }
    }

    this.scannableAliases.sort((left, right) => right.alias.length - left.alias.length);
  }

  resolvePlace(input: string): PlaceEntity | null {
    const normalized = normalizeText(cleanPlaceLabel(input));
    if (!normalized) return null;

    const exact = this.resolveExact(normalized);
    if (exact) return exact;

    let bestAlias = "";
    let bestPlaces: RegisteredPlace[] = [];

    for (const [alias, places] of this.placesByAlias.entries()) {
      if (alias.length < 4) continue;
      if (!normalized.includes(alias)) continue;
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        bestPlaces = uniqueRegisteredPlaces(places);
      } else if (alias.length === bestAlias.length) {
        bestPlaces = uniqueRegisteredPlaces([...bestPlaces, ...places]);
      }
    }

    if (bestPlaces.length !== 1) {
      return null;
    }

    return this.toPlaceEntity(bestPlaces[0]);
  }

  extractPlacesFromText(text: string) {
    const normalizedText = normalizeText(text);
    if (!normalizedText) return [] as PlaceEntity[];

    const matches: Array<{
      start: number;
      end: number;
      aliasLength: number;
      place: RegisteredPlace;
    }> = [];

    for (const { alias, place } of this.scannableAliases) {
      const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, "g");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalizedText))) {
        matches.push({
          start: match.index,
          end: match.index + alias.length,
          aliasLength: alias.length,
          place,
        });
      }
    }

    matches.sort((left, right) => {
      if (left.start !== right.start) return left.start - right.start;
      return right.aliasLength - left.aliasLength;
    });

    const chosen: typeof matches = [];
    for (const match of matches) {
      const overlaps = chosen.some(
        (existing) => match.start < existing.end && match.end > existing.start
      );
      if (!overlaps) {
        chosen.push(match);
      }
    }

    const output: PlaceEntity[] = [];
    const seen = new Set<string>();
    for (const match of chosen) {
      const place = this.toPlaceEntity(match.place);
      if (seen.has(place.normalizedCanonical)) continue;
      seen.add(place.normalizedCanonical);
      output.push(place);
    }

    return output;
  }

  expandPlaceHierarchy(place: PlaceEntity) {
    const resolved = this.resolveByEntity(place);
    if (!resolved) return [place];

    const output: PlaceEntity[] = [this.toPlaceEntity(resolved)];

    let currentParentId = resolved.parentPlaceId;
    while (currentParentId) {
      const parent = this.placesById.get(currentParentId);
      if (!parent) break;
      output.push(this.toPlaceEntity(parent));
      currentParentId = parent.parentPlaceId;
    }

    for (const childPlace of sortPlacesByImportance(
      [...resolved.childPlaceIds]
        .map((childId) => this.placesById.get(childId))
        .filter((child): child is RegisteredPlace => Boolean(child))
    )) {
      output.push(this.toPlaceEntity(childPlace));
    }

    for (const relatedId of resolved.relatedPlaceIds) {
      const related = this.placesById.get(relatedId);
      if (related) output.push(this.toPlaceEntity(related));
    }

    return uniquePlaceEntities(output);
  }

  buildMatchKeys(place: PlaceEntity) {
    const keys = new Set<string>();

    for (const expanded of this.expandPlaceHierarchy(place)) {
      keys.add(expanded.normalizedCanonical);
      for (const alias of expanded.aliases) {
        const normalizedAlias = normalizeText(alias);
        if (normalizedAlias) keys.add(normalizedAlias);
      }
    }

    return keys;
  }

  private resolveExact(normalized: string) {
    const exactMatches = uniqueRegisteredPlaces(this.placesByAlias.get(normalized) ?? []);
    if (exactMatches.length !== 1) {
      return null;
    }

    return this.toPlaceEntity(exactMatches[0]);
  }

  private resolveByEntity(entity: PlaceEntity) {
    if (entity.id && this.placesById.has(entity.id)) {
      return this.placesById.get(entity.id) ?? null;
    }

    return this.placesByCanonical.get(entity.normalizedCanonical) ?? null;
  }

  private toPlaceEntity(place: RegisteredPlace): PlaceEntity {
    return {
      id: place.id,
      canonicalName: place.canonicalName,
      displayName: place.displayName,
      normalizedCanonical: place.normalizedCanonical,
      aliases: [...place.aliases],
      sourceKinds: [...place.sourceKinds],
      type: place.type,
      city: place.city,
      barangay: place.barangay,
      parentPlaceId: place.parentPlaceId,
      relatedPlaceIds: [...place.relatedPlaceIds],
      latitude: place.latitude,
      longitude: place.longitude,
      importanceRank: place.importanceRank,
      childPlaceIds: [...place.childPlaceIds],
    };
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectUniqueRoutePlaces(routes: RouteRecord[]) {
  const places = new Set<string>();

  for (const route of routes) {
    for (const value of [
      route.origin,
      route.destination,
      ...(route.malls_groceries ?? []),
      ...(route.schools ?? []),
      ...(route.terminals ?? []),
      ...(route.health ?? []),
      ...(route.government ?? []),
      ...(route.churches ?? []),
      ...(route.hotels ?? []),
    ]) {
      if (!value?.trim()) continue;
      if (isRoadLike(value)) continue;
      if (isRoutePhrase(value)) continue;
      places.add(cleanSchoolName(value.trim()));
    }
  }

  return [...places];
}

export function createPlaceResolver(
  routes: RouteRecord[],
  aliasRows: RoutePlaceAliasRow[],
  placeRows: RoutePlaceRow[] = []
) {
  const resolver = new PlaceResolver();

  for (const group of MANUAL_PLACE_GROUPS) {
    resolver.registerPlace(group);
  }

  for (const place of placeRows) {
    resolver.registerPlace({
      id: place.id,
      canonicalName: place.canonical_name,
      displayName: getDisplayName(place.canonical_name),
      aliases: [place.normalized_name ?? place.canonical_name],
      sourceKind: "db_place",
      type: place.type,
      city: place.city,
      barangay: place.barangay,
      parentPlaceId: place.parent_place_id,
      relatedPlaceIds: place.related_place_ids ?? [],
      latitude: place.latitude,
      longitude: place.longitude,
      importanceRank: place.importance_rank,
    });
  }

  for (const row of aliasRows) {
    if (!row.alias || !row.route_places?.canonical_name) continue;
    resolver.registerPlace({
      id: row.route_places.id ?? row.place_id ?? null,
      canonicalName: row.route_places.canonical_name,
      displayName: getDisplayName(row.route_places.canonical_name),
      aliases: [row.alias, row.normalized_alias ?? row.alias],
      sourceKind: "db_alias",
      type: row.route_places.type ?? null,
      city: row.route_places.city ?? null,
      barangay: row.route_places.barangay ?? null,
      parentPlaceId: row.route_places.parent_place_id ?? null,
      relatedPlaceIds: row.route_places.related_place_ids ?? [],
      latitude: row.route_places.latitude ?? null,
      longitude: row.route_places.longitude ?? null,
      importanceRank: row.route_places.importance_rank ?? row.confidence_score ?? 0,
    });
  }

  for (const place of collectUniqueRoutePlaces(routes)) {
    const normalized = normalizeText(place);
    const aliases =
      normalized.includes("university") || normalized.includes("college")
        ? buildSchoolAliases(place)
        : [normalized];

    resolver.registerPlace({
      canonicalName: place,
      displayName: getDisplayName(place),
      aliases,
      sourceKind: "route_data",
    });
  }

  resolver.finalize();
  return resolver;
}

export function dedupeDisplayNames(values: Array<string | null | undefined>) {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(value);
  }

  return output;
}

export function normalizeAliases(values: string[]) {
  return uniqueStrings(values);
}
