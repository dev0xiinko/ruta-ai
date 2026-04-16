import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/client";
import { sendWaitlistConfirmationEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const source = String(body.source || "website").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const confirmToken = crypto.randomBytes(32).toString("hex");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const confirmUrl = `${appUrl}/api/waitlist/confirm?token=${confirmToken}`;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("waitlist")
      .select("id, email, status")
      .ilike("email", email)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing?.status === "confirmed") {
      return NextResponse.json({
        success: true,
        message: "This email is already confirmed.",
      });
    }

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("waitlist")
        .update({
          confirm_token: confirmToken,
          source,
          status: "pending",
        })
        .eq("id", existing.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("waitlist")
        .insert([
          {
            email,
            source,
            status: "pending",
            confirm_token: confirmToken,
          },
        ]);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    await sendWaitlistConfirmationEmail(email, confirmUrl);

    return NextResponse.json({
      success: true,
      message: "Confirmation email sent.",
    });
  } catch (error) {
    console.error("Waitlist signup error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}