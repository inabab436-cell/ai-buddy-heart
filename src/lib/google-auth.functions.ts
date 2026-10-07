import { updateSession } from "@tanstack/react-start/server";
/**
 * Google sign-in completion endpoint (merchants only).
 *
 * The browser performs the Google OAuth handshake with Supabase Auth and sends
 * the resulting access token here. The token is validated server-side, then the
 * app's own merchant session is established:
 *  - merchants  → encrypted `cupai_session` cookie + profile bootstrap
 */
import { createServerFn } from "@tanstack/react-start";

import type { LoginResult } from "@/lib/auth-types";

function ensureToken(value: unknown): string {
  const s = String(value ?? "").trim();
  if (s.length < 20) throw new Error("رمز الدخول غير صالح.");
  return s;
}

function ensureUuid(value: unknown, label: string): string {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f-]{16,}$/i.test(s)) throw new Error(`${label} غير صالح.`);
  return s;
}

/** Validate a Supabase access token and return the verified Google identity. */
async function verifyGoogleToken(
  accessToken: string,
): Promise<{ id: string; email: string }> {
  const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  const user = data?.user;
  if (error || !user?.email) {
    throw new Error("تعذّر التحقق من حساب Google.");
  }
  return { id: user.id, email: user.email.trim().toLowerCase() };
}

export const googleSignInMerchant = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => ({
    accessToken: ensureToken(data?.accessToken),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const user = await verifyGoogleToken(data.accessToken);

    const { getSessionConfig } = await import("@/lib/session.server");

    await updateSession(getSessionConfig(), { userId: user.id, email: user.email });

    const { ensureProfile, getSetupCompleted } = await import("@/lib/profile.server");
    await ensureProfile(user.id);
    const setupCompleted = await getSetupCompleted(user.id);

    return {
      ok: true,
      message: "تم تسجيل الدخول.",
      email: user.email,
      setupCompleted,
      nextRoute: setupCompleted ? "/dashboard" : "/welcome",
    };
});
