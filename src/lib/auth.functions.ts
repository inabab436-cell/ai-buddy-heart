import { clearSession, getSession } from "@tanstack/react-start/server";
/**
 * Auth server functions for cupai.
 *
 * Sign-in is Google-only (see `@/lib/google-auth.functions`); this module keeps
 * the session/onboarding endpoints.
 *
 * Server-only modules are loaded with dynamic import() inside handlers so this
 * client-reachable module never bundles server-only code or secrets.
 */

import { createServerFn } from "@tanstack/react-start";

import type { SessionInfo, SetupStatus } from "@/lib/auth-types";

export const getSetupStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SetupStatus> => {
    const { getSessionConfig } = await import("@/lib/session.server");
    const session = await getSession<{ userId: string; email: string }>(
      getSessionConfig(),
    );
    if (!session.data?.userId) return { setupCompleted: false };
    const { getSetupCompleted } = await import("@/lib/profile.server");
    return { setupCompleted: await getSetupCompleted(session.data.userId) };
  },
);

export const completeSetup = createServerFn({ method: "POST" }).handler(
  async (): Promise<SetupStatus> => {
    const { getSessionConfig } = await import("@/lib/session.server");
    const session = await getSession<{ userId: string; email: string }>(
      getSessionConfig(),
    );
    if (!session.data?.userId) {
      throw new Error("You must be logged in.");
    }
    const { markSetupCompleted } = await import("@/lib/profile.server");
    await markSetupCompleted(session.data.userId);
    return { setupCompleted: true };
  },
);

export const getSessionInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionInfo> => {
    const { getSessionConfig } = await import("@/lib/session.server");
    const session = await getSession<{ userId: string; email: string }>(
      getSessionConfig(),
    );
    if (session.data?.email) return { email: session.data.email };

    // Open-access mode: create the session automatically (no sign-in step).
    const { OPEN_ACCESS } = await import("@/lib/open-access");
    if (OPEN_ACCESS) {
      const { ensureOpenAccessSession } = await import("@/lib/open-access.server");
      const s = await ensureOpenAccessSession();
      return { email: s.email };
    }
    return { email: null };
  },
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { getSessionConfig } = await import("@/lib/session.server");
  await clearSession(getSessionConfig());
  return { ok: true };
});

export const deleteAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { getSessionConfig } = await import("@/lib/session.server");
  const session = await getSession<{ userId: string; email: string }>(getSessionConfig());
  const userId = session.data?.userId;
  if (!userId) throw new Error("You must be logged in.");
  const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  await clearSession(getSessionConfig());
  return { ok: true };
});
