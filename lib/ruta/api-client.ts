import type {
  RutaBotResponse,
  RutaFeedbackPayload,
  WaitlistSignupPayload,
} from "@/lib/ruta/contracts";

async function postJson<TResponse>(
  path: string,
  body: unknown,
  fallbackMessage: string
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error =
      (typeof data.error === "string" && data.error) ||
      (typeof data.details === "string" && data.details) ||
      fallbackMessage;
    throw new Error(error);
  }

  return data as TResponse;
}

export function submitRouteQuery(query: string) {
  return postJson<RutaBotResponse>(
    "/api/route-query",
    { query },
    "Could not answer the route question."
  );
}

export function submitRouteFeedback(payload: RutaFeedbackPayload) {
  return postJson<{ ok: boolean }>(
    "/api/route-query-feedback",
    payload,
    "Could not save feedback."
  );
}

export function submitWaitlistSignup(payload: WaitlistSignupPayload) {
  return postJson<{ success: boolean; message: string }>(
    "/api/waitlist",
    payload,
    "Failed to join waitlist."
  );
}

