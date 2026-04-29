import "server-only";

import { getBackendBaseUrl } from "@/lib/config/server";
import type {
  BackendRouteQueryResponse,
  RutaFeedbackPayload,
} from "@/lib/ruta/contracts";

async function parseJsonResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function postBackend<TResponse>(
  path: string,
  body: unknown,
  fallbackMessage: string
): Promise<TResponse> {
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.error === "string" && data.error) ||
      fallbackMessage;
    throw new Error(message);
  }

  return data as TResponse;
}

export function fetchDedicatedRouteQuery(
  query: string,
  forceRefresh = false
) {
  return postBackend<BackendRouteQueryResponse>(
    "/api/route-query",
    { query, force_refresh: forceRefresh },
    "Route query backend failed."
  );
}

export function submitDedicatedRouteFeedback(
  payload: RutaFeedbackPayload,
  userAgent: string | null
) {
  return postBackend<{ ok: boolean }>(
    "/api/route-feedback",
    {
      session_id: payload.sessionId ?? null,
      page_context: payload.pageContext?.trim() || "simulation",
      raw_query: payload.query.trim(),
      feedback_verdict: payload.verdict,
      feedback_notes: payload.notes?.trim() || null,
      response: payload.response ?? {},
      user_agent: userAgent,
    },
    "Feedback backend failed."
  );
}

