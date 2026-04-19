import { supabaseAdmin } from "@/lib/supabase/client";
import { buildMapOverview, type MapOverview } from "@/lib/ruta-map";

type RouteRecord = {
  dataset_name: string;
  code: string;
  label: string | null;
  route_name: string | null;
  origin: string | null;
  destination: string | null;
  qa_status: string;
  completeness_score: number;
  source_urls: string[];
  roads: string[];
  schools: string[];
  malls_groceries: string[];
  churches: string[];
  government: string[];
  hotels: string[];
  health: string[];
  terminals: string[];
  info: string[];
  raw_sections: Record<string, string>;
  warnings: string[];
  imported_at: string;
};

export type RouteBotResponse = {
  query: string;
  mode: "route_code" | "trip_search" | "place_search" | "not_found";
  greeting: string;
  title: string;
  summary: string;
  lead: string;
  answer: string;
  reasoningLevel: "high" | "medium" | "low";
  reasoningLabel: string;
  instructionLevel: "direct" | "guided" | "shortlist";
  instructionLabel: string;
  confidenceNote: string;
  commuterSteps: string[];
  sections: Array<{
    title: string;
    items: string[];
  }>;
  suggestions: string[];
  map: MapOverview;
  primaryMatch: {
    code: string;
    route_name: string | null;
    origin: string | null;
    destination: string | null;
    qa_status: string;
    completeness_score: number;
  } | null;
  matches: Array<{
    code: string;
    route_name: string | null;
    origin: string | null;
    destination: string | null;
    qa_status: string;
    completeness_score: number;
  }>;
};

const PLACE_ALIASES: Record<string, string[]> = {
  "it park": ["apas", "it park"],
  colon: ["colon", "metro colon", "colonnade"],
  carbon: ["carbon", "carbon public market"],
  ayala: ["ayala", "ayala center"],
  sm: ["sm", "sm city", "sm city cebu"],
  parkmall: ["parkmall"],
  lahug: ["lahug", "jy square"],
  fuente: ["fuente", "fuente osmena", "robinsons fuente"],
  taboan: ["taboan", "tabo-an", "taboan public market"],
  mandaue: ["mandaue", "ouano", "centro mandaue"],
  opon: ["opon", "lapu lapu", "lapu-lapu"],
  "usc tc": [
    "usc tc",
    "usc talamban",
    "usc talamban campus",
    "university of san carlos talamban",
    "university of san carlos talamban campus",
    "usc tc campus",
    "talamban",
  ],
  "usc main": [
    "usc main",
    "usc main campus",
    "usc downtown",
    "usc downtown campus",
    "university of san carlos main",
    "university of san carlos main campus",
    "downtown campus",
    "main campus",
  ],
  "uc main": [
    "uc main",
    "uc main campus",
    "university of cebu main",
    "university of cebu main campus",
  ],
  "uc banilad": [
    "uc banilad",
    "uc banilad campus",
    "university of cebu banilad",
    "university of cebu banilad campus",
  ],
  usjr: [
    "usjr",
    "university of san jose recoletos",
  ],
  cnu: [
    "cnu",
    "cebu normal university",
  ],
  ctu: [
    "ctu",
    "cebu technological university",
  ],
  cdu: [
    "cdu",
    "cdu hospital",
    "cebu doctors university",
    "cebu doctors university hospital",
  ],
  "cit-u": [
    "cit-u",
    "cit u",
    "citu",
    "cit",
    "cit university",
    "cebu institute of technology",
    "cebu institute of technology university",
    "cebu institute of technological university",
  ],
  act: [
    "act",
    "asian college of technology",
  ],
  ucm: [
    "ucm",
    "uc main",
    "uc main campus",
    "uc",
    "university of cebu",
    "university of cebu main",
    "university of cebu main campus",
  ],
  swu: [
    "swu",
    "south western university",
    "swu basak",
    "southwestern university",
    "southwestern university basak campus",
  ],
  uspf: [
    "uspf",
    "universit of southern philippines foundation",
    "university of southern philippines foundation",
  ],
  up: [
    "up",
    "upc",
    "up cebu",
    "up lahug",
    "university of the philippines",
    "university of the philippines cebu",
  ],
  uv: [
    "uv",
    "uv main",
    "university of visayas",
    "university of the visayas",
    "university of visayas main",
    "university of the visayas main",
    "university of visayas main campus",
    "university of the visayas main campus",
  ],
  "ctu main": [
    "ctu",
    "ctu main",
    "ctu main campus",
    "cebu technological university",
    "cebu technological university main",
    "cebu technological university main campus",
  ],
  cnu: [
    "cnu",
    "cebu normal university",
  ],
};

const PLACE_DISPLAY_LABELS: Record<string, string> = {
  "usc tc": "University of San Carlos Talamban Campus",
  "usc talamban": "University of San Carlos Talamban Campus",
  "usc talamban campus": "University of San Carlos Talamban Campus",
  "university of san carlos talamban": "University of San Carlos Talamban Campus",
  "university of san carlos talamban campus": "University of San Carlos Talamban Campus",
  "usc tc campus": "University of San Carlos Talamban Campus",
  "usc main": "University of San Carlos Main Campus",
  "usc main campus": "University of San Carlos Main Campus",
  "usc downtown": "University of San Carlos Main Campus",
  "usc downtown campus": "University of San Carlos Main Campus",
  "university of san carlos main": "University of San Carlos Main Campus",
  "university of san carlos main campus": "University of San Carlos Main Campus",
  "downtown campus": "University of San Carlos Main Campus",
  "uc main": "University of Cebu Main Campus",
  "uc main campus": "University of Cebu Main Campus",
  "university of cebu main": "University of Cebu Main Campus",
  "university of cebu main campus": "University of Cebu Main Campus",
  "uc banilad": "University of Cebu Banilad Campus",
  "uc banilad campus": "University of Cebu Banilad Campus",
  "university of cebu banilad": "University of Cebu Banilad Campus",
  "university of cebu banilad campus": "University of Cebu Banilad Campus",
  usjr: "University of San Jose Recoletos",
  cnu: "Cebu Normal University",
  ctu: "Cebu Technological University Main Campus",
  cdu: "Cebu Doctors University",
  "cdu hospital": "Cebu Doctors University Hospital",
  "cit-u": "Cebu Institute of Technology University CITU",
  "cit u": "Cebu Institute of Technology University CITU",
  citu: "Cebu Institute of Technology University CITU",
  cit: "Cebu Institute of Technology University CITU",
  "cit university": "Cebu Institute of Technology University CITU",
  "cebu institute of technology": "Cebu Institute of Technology University CITU",
  "cebu institute of technology university": "Cebu Institute of Technology University CITU",
  "cebu institute of technological university": "Cebu Institute of Technology University CITU",
  act: "Asian College of Technology",
  "asian college of technology": "Asian College of Technology",
  ucm: "University of Cebu Main Campus",
  uc: "University of Cebu Main Campus",
  "university of cebu": "University of Cebu Main Campus",
  swu: "Southwestern University",
  "south western university": "Southwestern University",
  "swu basak": "Southwestern University Basak Campus",
  uspf: "University of Southern Philippines Foundation",
  "universit of southern philippines foundation": "University of Southern Philippines Foundation",
  "university of southern philippines foundation": "University of Southern Philippines Foundation",
  up: "University of the Philippines",
  upc: "University of the Philippines Cebu",
  "up cebu": "University of the Philippines Cebu",
  "up lahug": "University of the Philippines Cebu",
  "university of the philippines cebu": "University of the Philippines Cebu",
  uv: "University of Visayas Main Campus",
  "uv main": "University of Visayas Main Campus",
  "university of visayas": "University of Visayas Main Campus",
  "university of the visayas": "University of Visayas Main Campus",
  "university of visayas main": "University of Visayas Main Campus",
  "university of the visayas main": "University of Visayas Main Campus",
  "university of visayas main campus": "University of Visayas Main Campus",
  "university of the visayas main campus": "University of Visayas Main Campus",
  "ctu main": "Cebu Technological University Main Campus",
  "ctu main campus": "Cebu Technological University Main Campus",
  "cebu technological university main": "Cebu Technological University Main Campus",
  "cebu technological university main campus": "Cebu Technological University Main Campus",
};

type SchoolAliasInfo = {
  canonical: string;
  aliases: string[];
};

type SchoolAliasDirectory = {
  byAlias: Map<string, SchoolAliasInfo>;
  byCanonical: Map<string, SchoolAliasInfo>;
};

type RoutePlaceAliasRow = {
  alias: string;
  route_places: {
    canonical_name: string;
  } | null;
};

type PlaceAliasDirectory = {
  byAlias: Map<string, string>;
  aliasesByCanonical: Map<string, string[]>;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPlaceLabel(value: string) {
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

function getRouteCorpus(route: RouteRecord) {
  return normalizeText(
    [
      route.code,
      route.label,
      route.route_name,
      route.origin,
      route.destination,
      ...(route.roads ?? []),
      ...(route.schools ?? []),
      ...(route.malls_groceries ?? []),
      ...(route.churches ?? []),
      ...(route.government ?? []),
      ...(route.hotels ?? []),
      ...(route.health ?? []),
      ...(route.terminals ?? []),
      ...(route.info ?? []),
      ...Object.keys(route.raw_sections ?? {}),
      ...Object.values(route.raw_sections ?? {}),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function extractRouteCode(query: string) {
  const match = normalizeText(query).match(/\b(mi-\d{2}[a-z]?|\d{1,2}[a-z]?)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractTripPlaces(query: string) {
  const raw = query.trim();
  const patterns = [
    /from\s+(.+?)\s+to\s+(.+)/i,
    /^(.+?)\s+to\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return {
        origin: cleanPlaceLabel(match[1].trim()),
        destination: cleanPlaceLabel(match[2].trim()),
      };
    }
  }

  return null;
}

function extractUniqueSchools(routes: RouteRecord[]) {
  const schools = new Set<string>();

  for (const route of routes) {
    for (const school of route.schools ?? []) {
      if (school?.trim()) {
        schools.add(cleanSchoolName(school.trim()));
      }
    }
  }

  return [...schools];
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

  const qualifiers = [
    "main",
    "downtown",
    "north",
    "south",
    "talamban",
    "banilad",
    "basak",
    "lahug",
    "mandaue",
    "lapu lapu",
    "mactan",
    "pardo",
    "talisay",
    "metc",
  ].filter((qualifier) => normalized.includes(qualifier));

  for (const qualifier of qualifiers) {
    if (acronym.length >= 2) {
      aliases.add(`${acronym} ${qualifier}`.trim());
      aliases.add(`${acronym} ${qualifier} campus`.trim());
    }
  }

  if (normalized.includes("university of san carlos")) {
    if (normalized.includes("talamban")) {
      aliases.add("usc tc");
      aliases.add("usc tc campus");
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
    aliases.add("cit u");
    aliases.add("cit-u");
    aliases.add("citu");
  }

  if (normalized.includes("university of cebu")) {
    aliases.add("uc");
    if (normalized.includes("banilad")) aliases.add("uc banilad");
    if (normalized.includes("main")) aliases.add("uc main");
    if (normalized.includes("lapu lapu") || normalized.includes("mandaue")) aliases.add("uclm");
    if (normalized.includes("metc")) aliases.add("uc metc");
  }

  if (normalized.includes("university of san jose recoletos")) {
    aliases.add("usjr");
  }

  if (normalized.includes("cebu normal university")) {
    aliases.add("cnu");
  }

  if (normalized.includes("cebu technological university")) {
    aliases.add("ctu");
  }

  if (normalized.includes("cebu doctors university")) {
    aliases.add("cdu");
    if (normalized.includes("hospital")) aliases.add("cdu hospital");
  }

  if (normalized.includes("southwestern university")) {
    aliases.add("swu");
    if (normalized.includes("basak")) aliases.add("swu basak");
  }

  if (normalized.includes("university of the philippines")) {
    aliases.add("up");
    if (normalized.includes("lahug")) aliases.add("up lahug");
    aliases.add("up cebu");
  }

  return [...aliases]
    .map((alias) => normalizeText(alias))
    .filter((alias) => alias.length >= 2);
}

function buildSchoolAliasDirectory(routes: RouteRecord[]): SchoolAliasDirectory {
  const byAlias = new Map<string, SchoolAliasInfo>();
  const byCanonical = new Map<string, SchoolAliasInfo>();

  for (const school of extractUniqueSchools(routes)) {
    const aliases = buildSchoolAliases(school);
    const info = { canonical: school, aliases };
    byCanonical.set(normalizeText(school), info);

    for (const alias of aliases) {
      const existing = byAlias.get(alias);
      if (!existing || existing.canonical.length < school.length) {
        byAlias.set(alias, info);
      }
    }
  }

  return { byAlias, byCanonical };
}

function findSchoolAliasInfo(place: string, schoolAliases?: SchoolAliasDirectory) {
  if (!schoolAliases) return null;

  const normalized = normalizeText(place);
  const exact = schoolAliases.byAlias.get(normalized) ?? schoolAliases.byCanonical.get(normalized);
  if (exact) return exact;

  let best: SchoolAliasInfo | null = null;
  let bestLength = 0;

  for (const [alias, info] of schoolAliases.byAlias.entries()) {
    if (alias.length < 4) continue;

    if (normalized.includes(alias) || alias.includes(normalized)) {
      if (alias.length > bestLength) {
        best = info;
        bestLength = alias.length;
      }
    }
  }

  return best;
}

function findDatabasePlaceCanonical(
  place: string,
  placeAliases?: PlaceAliasDirectory
) {
  if (!placeAliases) return null;

  const normalized = normalizeText(place);
  const exact = placeAliases.byAlias.get(normalized);
  if (exact) return exact;

  let bestCanonical: string | null = null;
  let bestLength = 0;

  for (const [alias, canonical] of placeAliases.byAlias.entries()) {
    if (alias.length < 4) continue;

    if (normalized.includes(alias) || alias.includes(normalized)) {
      if (alias.length > bestLength) {
        bestCanonical = canonical;
        bestLength = alias.length;
      }
    }
  }

  return bestCanonical;
}

function expandPlaceAliases(
  place: string,
  schoolAliases?: SchoolAliasDirectory,
  placeAliases?: PlaceAliasDirectory
) {
  const normalized = normalizeText(place);
  const aliases = new Set([normalized]);

  for (const [key, values] of Object.entries(PLACE_ALIASES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      for (const value of values) {
        aliases.add(normalizeText(value));
      }
    }
  }

  const schoolInfo = findSchoolAliasInfo(place, schoolAliases);
  if (schoolInfo) {
    aliases.add(normalizeText(schoolInfo.canonical));
    for (const alias of schoolInfo.aliases) {
      aliases.add(alias);
    }
  }

  const canonicalPlace = findDatabasePlaceCanonical(place, placeAliases);
  if (canonicalPlace) {
    aliases.add(normalizeText(canonicalPlace));
    const mappedAliases =
      placeAliases?.aliasesByCanonical.get(normalizeText(canonicalPlace)) ?? [];
    for (const alias of mappedAliases) {
      aliases.add(alias);
    }
  }

  return [...aliases].filter(Boolean);
}

function scoreAliases(text: string, aliases: string[]) {
  return aliases.reduce((score, alias) => {
    if (!alias) return score;
    return text.includes(alias) ? score + 1 : score;
  }, 0);
}

function resolvePlaceDisplayLabel(
  place: string,
  schoolAliases?: SchoolAliasDirectory,
  placeAliases?: PlaceAliasDirectory
) {
  const normalized = normalizeText(place);

  const canonicalPlace = findDatabasePlaceCanonical(place, placeAliases);
  if (canonicalPlace) {
    return canonicalPlace;
  }

  if (PLACE_DISPLAY_LABELS[normalized]) {
    return PLACE_DISPLAY_LABELS[normalized];
  }

  for (const [key, aliases] of Object.entries(PLACE_ALIASES)) {
    if (normalized === key || aliases.some((alias) => normalizeText(alias) === normalized)) {
      return PLACE_DISPLAY_LABELS[key] ?? place;
    }
  }

  const schoolInfo = findSchoolAliasInfo(place, schoolAliases);
  if (schoolInfo) {
    return schoolInfo.canonical;
  }

  return place;
}

function cleanPlaceSearchQuery(query: string) {
  return cleanPlaceLabel(
    query
      .replace(/^routes?\s+for\s+/i, "")
      .replace(/^what\s+routes?\s+(go|pass|run)\s+(through|to|from)\s+/i, "")
  );
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

async function loadPlaceAliasDirectory(): Promise<PlaceAliasDirectory> {
  const { data, error } = await supabaseAdmin
    .from("route_place_aliases")
    .select("alias, route_places(canonical_name)")
    .returns<RoutePlaceAliasRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const byAlias = new Map<string, string>();
  const aliasesByCanonical = new Map<string, string[]>();

  for (const row of data ?? []) {
    if (!row.alias || !row.route_places?.canonical_name) continue;

    const normalizedAlias = normalizeText(row.alias);
    const canonicalName = row.route_places.canonical_name;
    byAlias.set(normalizedAlias, canonicalName);

    const normalizedCanonical = normalizeText(canonicalName);
    const existing = aliasesByCanonical.get(normalizedCanonical) ?? [];
    existing.push(normalizedAlias);
    aliasesByCanonical.set(normalizedCanonical, existing);
  }

  return { byAlias, aliasesByCanonical };
}

function toMatch(route: RouteRecord) {
  return {
    code: route.code,
    route_name: route.route_name,
    origin: route.origin,
    destination: route.destination,
    qa_status: route.qa_status,
    completeness_score: route.completeness_score,
  };
}

function formatRouteLabel(route: RouteRecord) {
  if (route.route_name) {
    return `${route.code} - ${route.route_name}`;
  }

  if (route.origin || route.destination) {
    return `${route.code} - ${route.origin || "Unknown origin"} to ${route.destination || "Unknown destination"}`;
  }

  return route.code;
}

function buildGreeting(mode: RouteBotResponse["mode"]) {
  if (mode === "route_code") {
    return "Hi! Here are the route details for that jeep code.";
  }

  if (mode === "trip_search") {
    return "Hi! I checked the route data and here is the easiest way to start your trip.";
  }

  if (mode === "place_search") {
    return "Hi! Here are the route codes most closely related to that place.";
  }

  return "Hi! I could not find a confident route answer yet, but I can help you narrow it down.";
}

function formatCorridor(route: RouteRecord) {
  if (!route.roads?.length) {
    return null;
  }

  return route.roads.slice(0, 5).join(", ");
}

function formatQaLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildConfidence(route: RouteRecord) {
  if (route.qa_status === "high_confidence" && route.completeness_score >= 85) {
    return {
      reasoningLevel: "high" as const,
      reasoningLabel: "Strong dataset match",
      confidenceNote: `This route is tagged ${formatQaLabel(route.qa_status)} and has ${route.completeness_score}% completeness in the current dataset.`,
    };
  }

  if (route.qa_status === "high_confidence" || route.completeness_score >= 70) {
    return {
      reasoningLevel: "medium" as const,
      reasoningLabel: "Usable route match",
      confidenceNote: `This route is a usable match from the dataset, but some details may still be incomplete or generalized.`,
    };
  }

  return {
    reasoningLevel: "low" as const,
    reasoningLabel: "Limited route certainty",
    confidenceNote: `This result is based on limited route details, so riders should confirm with local signage or conductors.`,
  };
}

function buildCodeSteps(route: RouteRecord) {
  const steps = [`Look for a jeepney marked ${route.code}.`];

  if (route.origin && route.destination) {
    steps.push(`Check that the signboard says ${route.origin} to ${route.destination} or a close variant.`);
  }

  if (route.roads?.length) {
    steps.push(`Use these corridor clues to confirm the ride: ${route.roads.slice(0, 3).join(", ")}.`);
  }

  steps.push("If the signboard wording looks different, ask the driver or dispatcher before boarding.");
  return steps;
}

function buildTripSteps(
  route: RouteRecord,
  origin: string,
  destination: string,
  schoolAliases?: SchoolAliasDirectory,
  placeAliases?: PlaceAliasDirectory
) {
  const resolvedOrigin = resolvePlaceDisplayLabel(origin, schoolAliases, placeAliases);
  const resolvedDestination = resolvePlaceDisplayLabel(destination, schoolAliases, placeAliases);
  const steps = [`Go to the nearest loading area around ${resolvedOrigin}.`];
  steps.push(`Start by looking for jeep code ${route.code}.`);

  if (route.route_name) {
    steps.push(`A helpful signboard clue is: ${route.route_name}.`);
  } else if (route.origin && route.destination) {
    steps.push(`Match the signboard against ${route.origin} to ${route.destination}.`);
  }

  if (route.roads?.length) {
    steps.push(`While riding, watch for corridor clues like ${route.roads.slice(0, 3).join(", ")}.`);
  }

  steps.push(`Get off near ${resolvedDestination}, then confirm with the driver if you are unsure of the exact unloading point.`);
  return steps;
}

function buildPlaceSteps(routes: RouteRecord[], place: string) {
  const top = routes[0];
  return [
    `Use ${place} as your search point, then start with jeep code ${top.code}.`,
    "Treat this as a shortlist because the route may start there, end there, or simply pass nearby.",
    "Open one of the suggested codes next if you want a more specific riding guide.",
  ];
}

function buildCodeResponse(
  query: string,
  route: RouteRecord,
  map: MapOverview
): RouteBotResponse {
  const corridor = formatCorridor(route);
  const confidence = buildConfidence(route);

  return {
    query,
    mode: "route_code",
    greeting: buildGreeting("route_code"),
    title: `Route ${route.code}`,
    summary: route.route_name
      ? `${route.code} is recorded as ${route.route_name}.`
      : `${route.code} is in the dataset, but the route name is sparse.`,
    lead: route.origin && route.destination
      ? `The main jeep code to look for is ${route.code}. It usually runs from ${route.origin} to ${route.destination}.`
      : `The jeep code to look for is ${route.code}.`,
    answer: route.origin && route.destination
      ? `${route.code} goes from ${route.origin} to ${route.destination}.`
      : `${route.code} is available in the route dataset.`,
    reasoningLevel: confidence.reasoningLevel,
    reasoningLabel: confidence.reasoningLabel,
    instructionLevel: "guided",
    instructionLabel: "Boarding guide",
    confidenceNote: confidence.confidenceNote,
    commuterSteps: buildCodeSteps(route),
    sections: [
      {
        title: "Quick Read",
        items: [
          route.route_name
            ? `Listed route name: ${route.route_name}`
            : "No formal route name is stored for this code.",
          route.origin && route.destination
            ? `Recorded endpoints: ${route.origin} to ${route.destination}`
            : "Recorded endpoints are incomplete for this route.",
        ],
      },
      {
        title: "How Sure This Is",
        items: [
          confidence.confidenceNote,
          corridor
            ? `Main corridor: ${corridor}${route.roads.length > 5 ? ", ..." : ""}`
            : "Detailed corridor segments are limited for this code.",
          `Quality status: ${formatQaLabel(route.qa_status)} (${route.completeness_score}% completeness)`,
        ],
      },
    ],
    suggestions: [
      "Ask a trip question like “How do I get from IT Park to Colon?”",
      "Ask for another code like “What is 12L?”",
    ],
    map,
    primaryMatch: toMatch(route),
    matches: [toMatch(route)],
  };
}

function buildTripResponse(
  query: string,
  routes: RouteRecord[],
  origin: string,
  destination: string,
  map: MapOverview,
  schoolAliases?: SchoolAliasDirectory,
  placeAliases?: PlaceAliasDirectory
): RouteBotResponse {
  const top = routes[0];
  const codes = routes.slice(0, 3).map((route) => route.code).join(", ");
  const topCorridor = formatCorridor(top);
  const alternates = routes.slice(1, 4).map((route) => formatRouteLabel(route));
  const confidence = buildConfidence(top);
  const resolvedOrigin = resolvePlaceDisplayLabel(origin, schoolAliases, placeAliases);
  const resolvedDestination = resolvePlaceDisplayLabel(destination, schoolAliases, placeAliases);
  const exactEndpointMatch =
    normalizeText(top.origin ?? "") === normalizeText(origin) &&
    normalizeText(top.destination ?? "") === normalizeText(destination);
  const instructionLevel = exactEndpointMatch ? "direct" : "guided";
  const instructionLabel = exactEndpointMatch ? "Likely direct ride" : "Best starting route";

  return {
    query,
    mode: "trip_search",
    greeting: buildGreeting("trip_search"),
    title: `Routes from ${resolvedOrigin} to ${resolvedDestination}`,
    summary: `I found ${routes.length} matching route${routes.length > 1 ? "s" : ""}. Start with ${codes}.`,
    lead: `Start with jeep code ${top.code}${top.route_name ? ` (${top.route_name})` : ""}.`,
    answer: `For ${resolvedOrigin} to ${resolvedDestination}, start by checking ${top.code}. ${routes.length > 1 ? `Other likely matches are ${codes}.` : "It is the clearest route match in the current dataset."}`,
    reasoningLevel: confidence.reasoningLevel,
    reasoningLabel: confidence.reasoningLabel,
    instructionLevel,
    instructionLabel,
    confidenceNote: exactEndpointMatch
      ? `${confidence.confidenceNote} The stored endpoints line up directly with your trip.`
      : `${confidence.confidenceNote} This is the best route match I found, but the stored endpoint wording does not exactly mirror your question.`,
    commuterSteps: buildTripSteps(top, origin, destination, schoolAliases, placeAliases),
    sections: [
      {
        title: "I Interpreted Your Trip As",
        items: [
          `Origin: ${resolvedOrigin}`,
          `Destination: ${resolvedDestination}`,
        ],
      },
      {
        title: "Best Route To Check First",
        items: [
          `Start with ${formatRouteLabel(top)}.`,
          top.origin && top.destination
            ? `Recorded endpoints: ${top.origin} to ${top.destination}`
            : "The dataset links this route to your trip, but endpoint data is limited.",
          topCorridor
            ? `Common corridor clues: ${topCorridor}${top.roads.length > 5 ? ", ..." : ""}`
            : "No clear corridor list is stored for the top match.",
        ],
      },
      {
        title: "Other Codes Worth Checking",
        items: alternates.length > 0 ? alternates : ["No strong alternate routes were found in the current dataset."],
      },
      {
        title: "How Sure This Is",
        items: [
          exactEndpointMatch
            ? "This looks like a direct route match from the current dataset."
            : "This is the best rule-based match right now, but it should still be treated as a riding guide, not final dispatch truth.",
          confidence.confidenceNote,
        ],
      },
    ],
    suggestions: [
      "Ask for one of the route codes to inspect it more closely.",
      "If you want a narrower answer, ask with a more specific origin or destination.",
    ],
    map,
    primaryMatch: toMatch(top),
    matches: routes.slice(0, 5).map(toMatch),
  };
}

function buildPlaceResponse(
  query: string,
  routes: RouteRecord[],
  place: string,
  map: MapOverview,
  schoolAliases?: SchoolAliasDirectory,
  placeAliases?: PlaceAliasDirectory
): RouteBotResponse {
  const codes = routes.slice(0, 5).map((route) => route.code).join(", ");
  const confidence = buildConfidence(routes[0]);
  const resolvedPlace = resolvePlaceDisplayLabel(place, schoolAliases, placeAliases);

  return {
    query,
    mode: "place_search",
    greeting: buildGreeting("place_search"),
    title: `Routes related to ${resolvedPlace}`,
    summary: `I found these route codes related to ${resolvedPlace}: ${codes}.`,
    lead: `If you are near ${resolvedPlace}, start by checking jeep code ${routes[0].code}.`,
    answer: `These are the strongest route matches I found for ${resolvedPlace}: ${codes}.`,
    reasoningLevel: "medium",
    reasoningLabel: "Place-based shortlist",
    instructionLevel: "shortlist",
    instructionLabel: "Shortlist only",
    confidenceNote: `${confidence.confidenceNote} This search is broader because it is based on a place mention, not a full origin-to-destination trip.`,
    commuterSteps: buildPlaceSteps(routes, resolvedPlace),
    sections: [
      {
        title: "How To Use This",
        items: [
          "This is a place-based lookup, so routes may start there, end there, or pass nearby.",
          "Use this as a shortlist, then ask for a specific code or a full trip question.",
        ],
      },
      {
        title: "Best Route Codes",
        items: routes.slice(0, 5).map((route) => formatRouteLabel(route)),
      },
    ],
    suggestions: [
      "Ask a more exact trip like “from Ayala to SM”.",
      "Ask a code-specific question like “What is 04B?”",
    ],
    map,
    primaryMatch: toMatch(routes[0]),
    matches: routes.slice(0, 5).map(toMatch),
  };
}

function buildNotFoundResponse(query: string, map: MapOverview): RouteBotResponse {
  return {
    query,
    mode: "not_found",
    greeting: buildGreeting("not_found"),
    title: "No route match yet",
    summary: "I could not find a confident rule-based match for that question from the seeded route data.",
    lead: "Try asking with a jeep code, a landmark, or a simple from-to trip.",
    answer: "I could not confidently answer that with the current rule-based lookup.",
    reasoningLevel: "low",
    reasoningLabel: "No confident match",
    instructionLevel: "shortlist",
    instructionLabel: "Needs a clearer question",
    confidenceNote: "The current lookup only handles route codes, simple trip matching, and basic place search from the seeded dataset.",
    commuterSteps: [
      "Try a direct route code like 17B or 12L.",
      "Or ask in plain form like “from IT Park to Colon”.",
      "If you only know one landmark, ask for routes related to that place.",
    ],
    sections: [
      {
        title: "Why",
        items: [
          "This bot currently uses direct code lookup and simple place matching only.",
          "It does not do mapping, transfer planning, or AI interpretation yet.",
        ],
      },
    ],
    suggestions: [
      "Try a route code like “17B”.",
      "Try a plain trip like “from IT Park to Colon”.",
      "Try a place search like “routes for Ayala”.",
    ],
    map,
    primaryMatch: null,
    matches: [],
  };
}

export async function answerRouteQuestion(query: string): Promise<RouteBotResponse> {
  const cleanQuery = query.trim();
  const [routes, placeAliasDirectory] = await Promise.all([
    loadRoutes(),
    loadPlaceAliasDirectory(),
  ]);
  const schoolAliases = buildSchoolAliasDirectory(routes);

  const routeCode = extractRouteCode(cleanQuery);
  if (routeCode) {
    const exact = routes.find((route) => route.code.toUpperCase() === routeCode);
    if (exact) {
      const map = await buildMapOverview(exact.origin, exact.destination, exact.roads);
      return buildCodeResponse(cleanQuery, exact, map);
    }
  }

  const trip = extractTripPlaces(cleanQuery);
  if (trip) {
    const originAliases = expandPlaceAliases(trip.origin, schoolAliases, placeAliasDirectory);
    const destinationAliases = expandPlaceAliases(
      trip.destination,
      schoolAliases,
      placeAliasDirectory
    );

    const matches = routes
      .map((route) => {
        const corpus = getRouteCorpus(route);
        const normalizedOrigin = normalizeText(route.origin ?? "");
        const normalizedDestination = normalizeText(route.destination ?? "");
        const normalizedName = normalizeText(route.route_name ?? "");
        const originScore = scoreAliases(corpus, originAliases);
        const destinationScore = scoreAliases(corpus, destinationAliases);
        const originFieldScore = scoreAliases(normalizedOrigin, originAliases);
        const destinationFieldScore = scoreAliases(normalizedDestination, destinationAliases);
        const routeNameOriginScore = scoreAliases(normalizedName, originAliases);
        const routeNameDestinationScore = scoreAliases(normalizedName, destinationAliases);

        return {
          route,
          score:
            originFieldScore * 14 +
            destinationFieldScore * 14 +
            routeNameOriginScore * 6 +
            routeNameDestinationScore * 6 +
            originScore * 2 +
            destinationScore * 2 +
            route.completeness_score / 100 +
            (route.qa_status === "high_confidence" ? 1 : 0),
          originScore,
          destinationScore,
          originFieldScore,
          destinationFieldScore,
        };
      })
      .filter(
        (item) =>
          (item.originFieldScore > 0 || item.originScore > 0) &&
          (item.destinationFieldScore > 0 || item.destinationScore > 0)
      )
      .sort((a, b) => b.score - a.score)
      .map((item) => item.route);

    if (matches.length > 0) {
      const top = matches[0];
      const map = await buildMapOverview(top.origin, top.destination, top.roads);
      return buildTripResponse(
        cleanQuery,
        matches,
        trip.origin,
        trip.destination,
        map,
        schoolAliases,
        placeAliasDirectory
      );
    }
  }

  const cleanedPlaceQuery = cleanPlaceSearchQuery(cleanQuery);
  const placeAliases = expandPlaceAliases(
    cleanedPlaceQuery,
    schoolAliases,
    placeAliasDirectory
  );
  const placeMatches = routes
    .map((route) => {
      const corpus = getRouteCorpus(route);
      const score = scoreAliases(corpus, placeAliases);

      return {
        route,
        score: score + route.completeness_score / 100,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.route);

  if (placeMatches.length > 0) {
    const top = placeMatches[0];
    const map = await buildMapOverview(top.origin, top.destination, top.roads ?? []);
    return buildPlaceResponse(
      cleanQuery,
      placeMatches,
      cleanedPlaceQuery || cleanQuery,
      map,
      schoolAliases,
      placeAliasDirectory
    );
  }

  const emptyMap = await buildMapOverview(null, null, []);
  return buildNotFoundResponse(cleanQuery, emptyMap);
}
