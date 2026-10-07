/**
 * Server-only engine for storefront CUSTOMER guest sessions.
 *
 * There is no customer sign-in anywhere in the product (owner decision).
 * Visitors receive a silent guest session scoped to the merchant, stored in
 * `customer_sessions` and carried by the httpOnly `cupai_cs` cookie. This
 * powers chat and order placement without any login UI.
 *
 * Fully independent of the merchant auth system:
 *  - uses its own table (`customer_sessions`);
 *  - uses its own cookie name (`cupai_cs`);
 *  - never touches `auth.users` or the merchant `cupai_session` cookie.
 *
 * MUST NOT be imported from client/browser code.
 */

import { createHash, createHmac, randomBytes } from "crypto";
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";

import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CUSTOMER_SESSION_DAYS,
  type CustomerOtpVerifyResult,
} from "@/lib/customer-auth-types";

const SESSION_TTL_MS = CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000;

export const CUSTOMER_COOKIE_NAME = "cupai_cs";

function pepper(): string {
  const secret = process.env.CUPAI_APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: CUPAI_APP_SESSION_SECRET");
  }
  return secret;
}

function hashSessionToken(token: string): string {
  // HMAC keeps the token unforgeable even if the DB leaks.
  return createHmac("sha256", pepper()).update(`session:${token}`).digest("hex");
}

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function readCookieFromHeader(request: Request | undefined, name: string): string | null {
  const raw = request?.headers.get("cookie") ?? "";
  const found = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!found) return null;
  const value = decodeURIComponent(found.slice(name.length + 1));
  return value || null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

/**
 * Resolve or create the canonical customer row for (merchant, email).
 *
 * `customers_merchant_visitor_uidx` makes (merchant_id, visitor_id) unique when
 * visitor_id IS NOT NULL, so a visitor_id already owned by another row must
 * never be copied onto / inserted into a second row.
 */
async function upsertCustomerByEmail(
  admin: Admin,
  merchantId: string,
  email: string,
  visitorId?: string | null,
): Promise<string> {
  // Who (if anyone) already owns this visitor_id for this merchant?
  let visitorOwnerId: string | null = null;
  let visitorOwnerHasEmail = false;
  if (visitorId) {
    const { data: owner } = await admin
      .from("customers")
      .select("id, email")
      .eq("merchant_id", merchantId)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (owner?.id) {
      visitorOwnerId = owner.id as string;
      visitorOwnerHasEmail = Boolean(owner.email);
    }
  }

  const { data: existing } = await admin
    .from("customers")
    .select("id, email_verified")
    .eq("merchant_id", merchantId)
    .ilike("email", email)
    .maybeSingle();

  if (existing?.id) {
    const existingId = existing.id as string;
    const patch: Record<string, unknown> = {
      email,
      email_verified: true,
      last_seen: new Date().toISOString(),
    };
    // Only claim the visitor_id when it is free or already ours.
    if (visitorId && (!visitorOwnerId || visitorOwnerId === existingId)) {
      patch.visitor_id = visitorId;
    } else if (visitorId && visitorOwnerId && !visitorOwnerHasEmail) {
      // Release it from the anonymous shell row, then claim it.
      await admin
        .from("customers")
        .update({ visitor_id: null })
        .eq("id", visitorOwnerId);
      patch.visitor_id = visitorId;
    }
    await admin.from("customers").update(patch).eq("id", existingId);
    return existingId;
  }

  // Upgrade the anonymous visitor-only row for this browser, if there is one.
  if (visitorOwnerId && !visitorOwnerHasEmail) {
    await admin
      .from("customers")
      .update({
        email,
        email_verified: true,
        last_seen: new Date().toISOString(),
      })
      .eq("id", visitorOwnerId);
    return visitorOwnerId;
  }

  // The visitor_id belongs to a different (email-bearing) customer — this new
  // customer row must not reuse it, otherwise the unique index is violated.
  const safeVisitorId = visitorId && !visitorOwnerId ? visitorId : null;

  const { data: created, error } = await admin
    .from("customers")
    .insert({
      merchant_id: merchantId,
      email,
      email_verified: true,
      visitor_id: safeVisitorId,
      last_seen: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created?.id) {
    // Lost a race: another concurrent request created the row first.
    const { data: raced } = await admin
      .from("customers")
      .select("id")
      .eq("merchant_id", merchantId)
      .ilike("email", email)
      .maybeSingle();
    if (raced?.id) return raced.id as string;
    throw new Error(error?.message || "Could not create customer row.");
  }

  return created.id as string;
}

/**
 * Create a guest customer session from a synthetic email (no sign-in).
 *
 * Reuses the canonical customer row resolution, so nothing downstream
 * (orders, conversations, memory) changes.
 */
export async function loginCustomerWithVerifiedEmail(
  merchantId: string,
  rawEmail: string,
  visitorId?: string | null,
): Promise<CustomerOtpVerifyResult> {
  const admin = getSupabaseAdmin();
  const email = normalizeEmail(rawEmail);
  if (!email.includes("@")) {
    return { ok: false, status: "error", message: "البريد الإلكتروني غير صالح." };
  }

  const customerId = await upsertCustomerByEmail(admin, merchantId, email, visitorId ?? null);

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const userAgent = getRequestHeader("user-agent") ?? null;
  let ip: string | null = null;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch { ip = null; }

  const { error: sErr } = await admin.from("customer_sessions").insert({
    merchant_id: merchantId,
    customer_id: customerId,
    token_hash: hashSessionToken(token),
    status: "active",
    expires_at: expiresAt,
    user_agent: userAgent,
    ip,
  });
  if (sErr) {
    return { ok: false, status: "error", message: "تعذّر إنشاء الجلسة." };
  }

  setCookie(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return {
    ok: true,
    status: "verified",
    message: "تم إنشاء الجلسة.",
    customerId,
    email,
  };
}


/** Resolve the current customer session from the httpOnly cookie. */
export async function getCurrentCustomerSession(): Promise<
  | null
  | {
      sessionId: string;
      customerId: string;
      merchantId: string;
      email: string;
      expiresAt: string;
    }
> {
  const token = getCookie(CUSTOMER_COOKIE_NAME);
  return getCustomerSessionByToken(token ?? null);
}

export async function getCustomerSessionFromRequest(request: Request): Promise<
  | null
  | {
      sessionId: string;
      customerId: string;
      merchantId: string;
      email: string;
      expiresAt: string;
    }
> {
  return getCustomerSessionByToken(readCookieFromHeader(request, CUSTOMER_COOKIE_NAME));
}

async function getCustomerSessionByToken(token: string | null): Promise<
  | null
  | {
      sessionId: string;
      customerId: string;
      merchantId: string;
      email: string;
      expiresAt: string;
    }
> {
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data: session } = await admin
    .from("customer_sessions")
    .select("id, customer_id, merchant_id, status, expires_at")
    .eq("token_hash", hashSessionToken(token))
    .maybeSingle();
  if (!session) return null;
  if ((session.status as string) !== "active") return null;
  if (new Date(session.expires_at as string).getTime() < Date.now()) {
    await admin
      .from("customer_sessions")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", session.id as string);
    return null;
  }

  const { data: customer } = await admin
    .from("customers")
    .select("email")
    .eq("id", session.customer_id as string)
    .maybeSingle();

  // Touch last_seen_at and roll the expiry forward (best-effort) so an active
  // customer never gets logged out while their account exists.
  await admin
    .from("customer_sessions")
    .update({
      last_seen_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .eq("id", session.id as string);


  return {
    sessionId: session.id as string,
    customerId: session.customer_id as string,
    merchantId: session.merchant_id as string,
    email: (customer?.email as string | undefined) ?? "",
    expiresAt: session.expires_at as string,
  };
}

/** Revoke the current session and clear the cookie. */
export async function logoutCurrentCustomer(): Promise<void> {
  const token = getCookie(CUSTOMER_COOKIE_NAME);
  if (token) {
    const admin = getSupabaseAdmin();
    await admin
      .from("customer_sessions")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("token_hash", hashSessionToken(token))
      .eq("status", "active");
  }
  deleteCookie(CUSTOMER_COOKIE_NAME, { path: "/" });
}

/** Revoke ALL active sessions for the current customer and clear the cookie. */
export async function logoutAllCustomerSessions(): Promise<number> {
  const current = await getCurrentCustomerSession();
  if (!current) {
    deleteCookie(CUSTOMER_COOKIE_NAME, { path: "/" });
    return 0;
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customer_sessions")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("customer_id", current.customerId)
    .eq("status", "active")
    .select("id");
  deleteCookie(CUSTOMER_COOKIE_NAME, { path: "/" });
  if (error) return 0;
  return data?.length ?? 0;
}

/** Sha-256 hash used only as a stable public identifier (never a secret). */
export function publicHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
