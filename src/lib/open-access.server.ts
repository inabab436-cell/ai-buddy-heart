/**
 * Server-only helper for the TEMPORARY open-access mode (see
 * `@/lib/open-access`). Creates the merchant session for the single allowed
 * account without any sign-in step.
 */
import { updateSession } from "@tanstack/react-start/server";

import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { getSessionConfig } from "@/lib/session.server";
import { ensureProfile } from "@/lib/profile.server";
import { ALLOWED_EMAIL } from "@/lib/open-access";

async function findOrCreateAllowedUser(): Promise<string> {
  const admin = getSupabaseAdmin();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === ALLOWED_EMAIL,
    );
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: ALLOWED_EMAIL,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("تعذّر تجهيز الحساب.");
  return data.user.id;
}

/** Ensure a merchant session exists; returns the session identity. */
export async function ensureOpenAccessSession(): Promise<{
  userId: string;
  email: string;
}> {
  const userId = await findOrCreateAllowedUser();
  await updateSession(getSessionConfig(), { userId, email: ALLOWED_EMAIL });
  await ensureProfile(userId);
  return { userId, email: ALLOWED_EMAIL };
}
