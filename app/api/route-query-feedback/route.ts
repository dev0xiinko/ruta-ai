import { NextRequest, NextResponse } from "next/server";
import type { RutaFeedbackPayload } from "@/lib/ruta/contracts";
import { submitDedicatedRouteFeedback } from "@/lib/server/backend-client";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<RutaFeedbackPayload>;
    const query = body.query?.trim();
    const verdict = body.verdict;

    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    if (verdict !== "good" && verdict !== "bad") {
      return NextResponse.json(
        { error: "Verdict must be either good or bad." },
        { status: 400 }
      );
    }

    const response = await submitDedicatedRouteFeedback(
      {
        query,
        verdict,
        notes: body.notes,
        pageContext: body.pageContext,
        response: body.response,
        sessionId: body.sessionId,
      },
      request.headers.get("user-agent")
    );

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not save feedback.",
        details:
          error instanceof Error ? error.message : "Unknown feedback proxy error.",
      },
      { status: 502 }
    );
  }
}
