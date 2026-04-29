import { NextResponse } from "next/server";
import { resolveAppBaseUrl } from "@/lib/config/server";
import { confirmWaitlistSignup } from "@/lib/server/waitlist";

export async function GET(req: Request) {
  const baseUrl = resolveAppBaseUrl(req.url);

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=invalid`);
    }

    const status = await confirmWaitlistSignup(token);
    return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=${status}`);
  } catch (error) {
    console.error("Waitlist confirm error:", error);
    return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=error`);
  }
}
