export type RouteMapPoint = {
  label: string;
  lat: number;
  lng: number;
  kind: "origin" | "destination" | "waypoint";
};

export type RouteMapOverview = {
  feasible: boolean;
  kind: "schematic" | "none";
  note: string;
  points: RouteMapPoint[];
};

export type RutaBotResponse = {
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
  map: RouteMapOverview;
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

export type RutaFeedbackVerdict = "good" | "bad";

export type RutaFeedbackPayload = {
  sessionId?: string;
  pageContext?: string;
  query: string;
  verdict: RutaFeedbackVerdict;
  notes?: string;
  response?: RutaBotResponse | null;
};

export type WaitlistSignupPayload = {
  email: string;
  source?: string;
};

export type BackendResolvedEntity = {
  display_name: string;
};

export type BackendRouteEntry = {
  route_code?: string;
  route_name?: string | null;
  signboard?: string;
  origin?: string | null;
  destination?: string | null;
  key_landmarks?: string[];
  road_clues?: string[];
  match_type?: string;
  origin_access?: string;
  destination_access?: string;
  origin_walk_minutes?: number | null;
  destination_walk_minutes?: number | null;
  walk_minutes?: number | null;
  distance_m?: number | null;
  dropoff_stop?: string | null;
  score?: number;
  first_route?: string;
  second_route?: string;
  transfer_hint?: string | null;
};

export type BackendRouteQueryResponse = {
  query: string;
  query_kind: "route_lookup" | "place_to_place" | "route_check" | "place_search";
  origin: BackendResolvedEntity | null;
  destination: BackendResolvedEntity | null;
  route_code: string | null;
  response_type: string;
  confidence: number;
  answer: string;
  routes: BackendRouteEntry[];
};

