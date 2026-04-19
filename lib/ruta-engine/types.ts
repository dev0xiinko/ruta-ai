export type RouteRecord = {
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

export type RoutePlaceAliasRow = {
  id?: string;
  place_id?: string;
  alias: string;
  normalized_alias?: string | null;
  alias_kind?: string | null;
  confidence_score?: number | null;
  route_places: {
    id?: string;
    canonical_name: string;
    normalized_name?: string | null;
    city?: string | null;
    barangay?: string | null;
    type?: string | null;
    parent_place_id?: string | null;
    importance_rank?: number | null;
    related_place_ids?: string[] | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

export type PlaceEntity = {
  id: string | null;
  canonicalName: string;
  displayName: string;
  normalizedCanonical: string;
  aliases: string[];
  sourceKinds: string[];
  type?: string | null;
  city?: string | null;
  barangay?: string | null;
  parentPlaceId?: string | null;
  relatedPlaceIds?: string[];
  latitude?: number | null;
  longitude?: number | null;
  importanceRank?: number;
  childPlaceIds?: string[];
};

export type StructuredStop = {
  id?: string | null;
  placeId?: string | null;
  name: string;
  canonicalName: string;
  key: string;
  order: number;
  stopType?: string | null;
  city?: string | null;
  barangay?: string | null;
  rawText?: string | null;
  sourceSection?: string | null;
};

export type StructuredRoute = {
  routeId: string;
  variantId?: string | null;
  variantKey?: string | null;
  code: string;
  signboard: string;
  direction?: string | null;
  start: string | null;
  end: string | null;
  landmarks: string[];
  roads: string[];
  stops: StructuredStop[];
  confidence: number;
  aliases: string[];
  landmarkKeys: string[];
  mapRef?: {
    hasMap: boolean;
    pageUrl?: string | null;
    googleMapUrl?: string | null;
    embedUrl?: string | null;
    mapId?: string | null;
    centerLl?: string | null;
    span?: string | null;
    iwloc?: string | null;
    mapTitle?: string | null;
  };
  sourceModel?: "v1" | "v2";
  raw: RouteRecord;
};

export type RoutePlaceRow = {
  id: string;
  canonical_name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  type: string | null;
  barangay: string | null;
  parent_place_id: string | null;
  importance_rank: number;
  related_place_ids: string[];
  normalized_name: string | null;
};

export type RouteVariantRow = {
  id: string;
  dataset_name: string;
  route_code: string;
  variant_key: string;
  display_name: string;
  direction: string | null;
  signboard: string | null;
  origin_place_id: string | null;
  destination_place_id: string | null;
  qa_status: string;
  confidence_score: number;
  source_urls: string[];
  warnings: string[];
  raw_summary: Record<string, unknown>;
  imported_at: string;
};

export type RouteVariantMapRefRow = {
  id: string;
  variant_id: string;
  page_url: string;
  google_map_url: string | null;
  embed_url: string | null;
  map_id: string | null;
  center_ll: string | null;
  span: string | null;
  iwloc: string | null;
  map_title: string | null;
  source: string;
  created_at: string;
};

export type RouteStopRow = {
  id: string;
  canonical_name: string;
  display_name: string;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  stop_type: string | null;
  city: string | null;
  barangay: string | null;
  source: string | null;
  created_at: string;
};

export type RouteVariantStopOrderRow = {
  id: string;
  variant_id: string;
  stop_id: string;
  stop_order: number;
  is_pickup: boolean;
  is_dropoff: boolean;
  raw_text: string | null;
  source_section: string | null;
  created_at: string;
};

export type RoutePlaceBinding = {
  id?: string;
  datasetName?: string;
  routeCode?: string;
  variantId?: string | null;
  rawText: string;
  normalizedText: string;
  primaryPlaceId: string | null;
  matchedPlaceIds: string[];
  matchMethod: string;
  matchConfidence: number;
  orderHint?: number | null;
  sourceSection?: string | null;
  needsReview: boolean;
};

export type RoutePlaceBindingRow = {
  id: string;
  dataset_name: string;
  route_code: string;
  variant_id: string | null;
  raw_text: string;
  normalized_text: string;
  primary_place_id: string | null;
  matched_place_ids: string[];
  match_method: string;
  match_confidence: number;
  order_hint: number | null;
  source_section: string | null;
  needs_review: boolean;
  created_at: string;
};

export type StructuredRouteVariant = {
  variantId: string;
  routeId: string;
  code: string;
  variantKey: string;
  signboard: string;
  direction: string | null;
  start: string | null;
  end: string | null;
  landmarks: string[];
  roads: string[];
  stops: StructuredStop[];
  confidence: number;
  aliases: string[];
  landmarkKeys: string[];
  mapRef?: {
    hasMap: boolean;
    pageUrl?: string | null;
    googleMapUrl?: string | null;
    embedUrl?: string | null;
    mapId?: string | null;
    centerLl?: string | null;
    span?: string | null;
    iwloc?: string | null;
    mapTitle?: string | null;
  };
  placeBindings: RoutePlaceBinding[];
  raw: RouteRecord;
};

export type ParsedQuery =
  | {
      type: "route_code";
      raw: string;
      code: string;
      searchText: string;
    }
  | {
      type: "place_to_place";
      raw: string;
      originText: string;
      destinationText: string;
    }
  | {
      type: "destination_check";
      raw: string;
      routeCode: string | null;
      targetText: string;
    }
  | {
      type: "place_search";
      raw: string;
      placeText: string;
    }
  | {
      type: "unknown";
      raw: string;
    };

export type CandidateScoreBreakdown = {
  exactCodeMatch: number;
  signboardMatch: number;
  originMatch: number;
  destinationMatch: number;
  directionMatch: number;
  landmarkMatch: number;
  routeConfidence: number;
  targetMatch: number;
  total: number;
};

export type RouteCandidate = {
  route: StructuredRoute;
  variant?: StructuredRouteVariant | null;
  score: number;
  confidenceBand: "high" | "medium" | "low";
  breakdown: CandidateScoreBreakdown;
  originIndex: number | null;
  destinationIndex: number | null;
  targetIndex: number | null;
  directionValid: boolean;
};

export type RouteBotResponse = {
  query: string;
  mode: "route_code" | "trip_search" | "place_search" | "not_found";
  greeting: string;
  title: string;
  summary: string;
  lead: string;
  answer: string;
  confidence: string;
  lookFor: string;
  keyLandmarks: string[];
  roadClues: string[];
  tip: string;
  tripSteps: Array<{
    title: string;
    instruction: string;
    landmarks: string[];
  }>;
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
  map: {
    feasible: boolean;
    kind: "schematic" | "none";
    note: string;
    points: Array<{
      label: string;
      lat: number;
      lng: number;
      kind: "origin" | "destination" | "waypoint";
    }>;
  };
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
