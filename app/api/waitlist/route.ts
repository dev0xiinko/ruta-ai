import { NextResponse } from "next/server";
import { createWaitlistSignup } from "@/lib/server/waitlist";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = await createWaitlistSignup({
      email: String(body.email || ""),
      source: String(body.source || "website"),
      requestUrl: req.url,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Waitlist signup error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
