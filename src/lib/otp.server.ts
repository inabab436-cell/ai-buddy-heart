/**
 * Server-only OTP engine for cupai.
 *
 * Enforces all send/verify rate-limiting rules against the `email_otp_codes`
 * and `email_otp_blocks` tables. MUST NOT be imported from client/browser code.
 * Reads secrets from environment variables at call time; nothing is hardcoded.
 */

import { createHmac, randomInt } from "crypto";

import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailJsCode } from "@/lib/emailjs.server";
import {
  ATTEMPT_LIMITS,
  SEND_LIMITS,
  type OtpPurpose,
  type OtpSendResult,
  type OtpVerifyResult,
} from "@/lib/auth-types";

const CODE_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const WINDOW_MS = 30 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;


function pepper(): string {
  const secret = process.env.CUPAI_APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: CUPAI_APP_SESSION_SECRET");
  }
  return secret;
}

function hashCode(code: string): string {
  return createHmac("sha256", pepper()).update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

async function getActiveBlock(
  admin: Admin,
  email: string,
  purpose: OtpPurpose,
): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("email_otp_blocks")
    .select("blocked_until")
    .eq("email", email)
    .eq("purpose", purpose)
    .gt("blocked_until", nowIso)
    .order("blocked_until", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.blocked_until as string | undefined) ?? null;
}

// Email subject/body live in the EmailJS dashboard templates (see emailjs.server.ts).


/** Send an OTP code, enforcing cooldown, per-window send caps, and blocks. */
export async function sendOtp(
  rawEmail: string,
  purpose: OtpPurpose,
): Promise<OtpSendResult> {
  const admin = getSupabaseAdmin();
  const email = normalizeEmail(rawEmail);
  const limit = SEND_LIMITS[purpose];

  // 1. Existing active block?
  const block = await getActiveBlock(admin, email, purpose);
  if (block) {
    return {
      ok: false,
      status: "blocked",
      message:
        "Too many requests. Please wait before requesting another code.",
      blockedUntil: block,
      retryAfterSeconds: secondsUntil(block),
    };
  }

  const windowStartIso = new Date(Date.now() - WINDOW_MS).toISOString();

  // 2. 60-second cooldown since the most recent send.
  const { data: recent } = await admin
    .from("email_otp_codes")
    .select("created_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.created_at) {
    const elapsed = Date.now() - new Date(recent.created_at as string).getTime();
    if (elapsed < SEND_COOLDOWN_MS) {
      const retry = Math.ceil((SEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        ok: false,
        status: "cooldown",
        message: `Please wait ${retry} second${retry === 1 ? "" : "s"} before requesting a new code.`,
        retryAfterSeconds: retry,
      };
    }
  }

  // 3. Max sends within the rolling 30-minute window.
  const { count } = await admin
    .from("email_otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("purpose", purpose)
    .gte("created_at", windowStartIso);
  const sendsSoFar = count ?? 0;
  if (sendsSoFar >= limit) {
    const blockedUntil = new Date(Date.now() + BLOCK_MS).toISOString();
    await admin.from("email_otp_blocks").insert({
      email,
      purpose,
      reason: "too_many_sends",
      blocked_until: blockedUntil,
    });
    return {
      ok: false,
      status: "blocked",
      message:
        "You have requested too many codes. Your requests are blocked for 30 minutes.",
      blockedUntil,
      retryAfterSeconds: secondsUntil(blockedUntil),
    };
  }

  // 4. Create the code.
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error: insertError } = await admin.from("email_otp_codes").insert({
    email,
    purpose,
    code_hash: hashCode(code),
    expires_at: expiresAt,
    attempts: 0,
  });
  if (insertError) {
    return {
      ok: false,
      status: "error",
      message: "Could not create a verification code. Please try again.",
    };
  }

  // 5. Send the email.
  try {
    await sendEmailJsCode({ to: email, code, purpose });
  } catch {
    return {
      ok: false,
      status: "error",
      message: "Could not send the email. Please try again in a moment.",
    };
  }

  const remainingSends = Math.max(0, limit - sendsSoFar - 1);
  return {
    ok: true,
    status: "sent",
    message: "A verification code has been sent to your email.",
    retryAfterSeconds: 60,
    remainingSends,
  };
}

/** Verify an OTP code, enforcing expiry, wrong-attempt caps, and blocks. */
export async function verifyOtp(
  rawEmail: string,
  purpose: OtpPurpose,
  code: string,
): Promise<OtpVerifyResult> {
  const admin = getSupabaseAdmin();
  const email = normalizeEmail(rawEmail);
  const limit = ATTEMPT_LIMITS[purpose];

  const block = await getActiveBlock(admin, email, purpose);
  if (block) {
    return {
      ok: false,
      status: "blocked",
      message: "You have exceeded the maximum number of attempts.",
      blockedUntil: block,
      attemptsRemaining: 0,
    };
  }

  const { data: row } = await admin
    .from("email_otp_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      status: "expired",
      message:
        "No active code found. It may have expired — please request a new one.",
    };
  }

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return {
      ok: false,
      status: "expired",
      message: "This code has expired. Please request a new one.",
    };
  }

  if (hashCode(code) !== (row.code_hash as string)) {
    const attempts = (row.attempts as number) + 1;
    if (attempts >= limit) {
      const blockedUntil = new Date(Date.now() + BLOCK_MS).toISOString();
      await admin
        .from("email_otp_codes")
        .update({ attempts, consumed_at: new Date().toISOString() })
        .eq("id", row.id);
      await admin.from("email_otp_blocks").insert({
        email,
        purpose,
        reason: "too_many_attempts",
        blocked_until: blockedUntil,
      });
      return {
        ok: false,
        status: "blocked",
        message: "You have exceeded the maximum number of attempts.",
        blockedUntil,
        attemptsRemaining: 0,
      };
    }
    await admin.from("email_otp_codes").update({ attempts }).eq("id", row.id);
    const remaining = limit - attempts;
    return {
      ok: false,
      status: "invalid",
      message: `Incorrect code. You have ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
      attemptsRemaining: remaining,
    };
  }

  await admin
    .from("email_otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true, status: "verified", message: "Code verified." };
}

/** Find an auth user by email (paginated lookup via the admin API). */
export async function findUserIdByEmail(
  rawEmail: string,
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const email = normalizeEmail(rawEmail);
  let page = 1;
  const perPage = 200;
  // Bounded loop to avoid runaway iteration.
  for (let i = 0; i < 25; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const match = data.users.find(
      (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email,
    );
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}
