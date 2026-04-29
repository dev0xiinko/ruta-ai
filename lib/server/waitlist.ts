import "server-only";

import crypto from "crypto";
import { resolveAppBaseUrl } from "@/lib/config/server";
import { sendWaitlistConfirmationEmail } from "@/lib/mailer";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

export type WaitlistConfirmStatus = "success" | "already" | "invalid" | "error";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function assertValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email address.");
  }
}

export async function createWaitlistSignup(input: {
  email: string;
  source?: string;
  requestUrl: string;
}) {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Email is required.");
  }
  assertValidEmail(email);

  const source = input.source?.trim() || "website";
  const confirmToken = crypto.randomBytes(32).toString("hex");
  const appUrl = resolveAppBaseUrl(input.requestUrl);
  const confirmUrl = `${appUrl}/api/waitlist/confirm?token=${confirmToken}`;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("waitlist")
    .select("id, email, status")
    .ilike("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.status === "confirmed") {
    return {
      success: true,
      message: "This email is already confirmed.",
    };
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
      throw new Error(updateError.message);
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
      throw new Error(insertError.message);
    }
  }

  await sendWaitlistConfirmationEmail(email, confirmUrl);

  return {
    success: true,
    message: "Confirmation email sent.",
  };
}

export async function confirmWaitlistSignup(token: string): Promise<WaitlistConfirmStatus> {
  if (!token) {
    return "invalid";
  }

  const { data: record, error: fetchError } = await supabaseAdmin
    .from("waitlist")
    .select("id, status")
    .eq("confirm_token", token)
    .maybeSingle();

  if (fetchError) {
    return "error";
  }

  if (!record) {
    return "invalid";
  }

  if (record.status === "confirmed") {
    return "already";
  }

  const { error: updateError } = await supabaseAdmin
    .from("waitlist")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirm_token: null,
    })
    .eq("id", record.id);

  return updateError ? "error" : "success";
}

