import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function GET(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=invalid`);
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from("waitlist")
      .select("id, status")
      .eq("confirm_token", token)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=error`);
    }

    if (!record) {
      return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=invalid`);
    }

    if (record.status === "confirmed") {
      return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=already`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("waitlist")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirm_token: null,
      })
      .eq("id", record.id);

    if (updateError) {
      return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=error`);
    }

    return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=success`);
  } catch (error) {
    console.error("Waitlist confirm error:", error);
    return NextResponse.redirect(`${baseUrl}/waitlist/confirmed?status=error`);
  }
}