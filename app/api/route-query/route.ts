import { NextResponse } from "next/server";
import { adaptBackendRouteQueryResponse } from "@/lib/ruta/adapt-backend-response";
import { fetchDedicatedRouteQuery } from "@/lib/server/backend-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query || "").trim();
    const forceRefresh = Boolean(body.forceRefresh || body.force_refresh);

    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    const backendResponse = await fetchDedicatedRouteQuery(query, forceRefresh);
    return NextResponse.json(adaptBackendRouteQueryResponse(backendResponse));
  } catch (error) {
    console.error("Route query proxy error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to contact the route query backend.",
      },
      { status: 502 }
    );
  }
}
