import { NextResponse } from "next/server";
import { answerRouteQuestion } from "@/lib/ruta-bot";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query || "").trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    const response = await answerRouteQuestion(query);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Route bot error:", error);
    return NextResponse.json(
      { error: "Failed to answer route question." },
      { status: 500 }
    );
  }
}
