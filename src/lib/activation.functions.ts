import { getSession } from "@tanstack/react-start/server";
/**
 * Store activation (pre-payment trial → paid plan). The merchant can only read
 * their own status and flag an activation request; turning `subscribed` on stays
 * an admin-only action in the platform console.
 */
import { createServerFn } from "@tanstack/react-start";

export interface ActivationStatus {
  subscribed: boolean;
  requestedAt: string | null;
  startedAt: string | null;
  endsAt: string | null;
}

async function currentUserId(): Promise<string> {
  const { getSessionConfig } = await import("@/lib/session.server");
  const s = await getSession<{ userId: string }>(getSessionConfig());
  if (!s.data?.userId) throw new Error("You must be logged in.");
  return s.data.userId;
}

async function admin() {
  const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  return getSupabaseAdmin();
}

export const getActivationStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivationStatus> => {
    const id = await currentUserId();
    const { data } = await (await admin()).auth.admin.getUserById(id);
    const meta = data.user?.app_metadata ?? {};
    return {
      subscribed: meta.subscribed === true,
      requestedAt: typeof meta.activation_requested_at === "string" ? meta.activation_requested_at : null,
      startedAt: typeof meta.subscription_started_at === "string" ? meta.subscription_started_at : null,
      endsAt: typeof meta.subscription_ends_at === "string" ? meta.subscription_ends_at : null,
    };
  },
);

export const requestActivation = createServerFn({ method: "POST" }).handler(
  async (): Promise<ActivationStatus> => {
    const id = await currentUserId();
    const sb = await admin();
    const { data } = await sb.auth.admin.getUserById(id);
    const meta = data.user?.app_metadata ?? {};
    const startedAt = typeof meta.subscription_started_at === "string" ? meta.subscription_started_at : null;
    const endsAt = typeof meta.subscription_ends_at === "string" ? meta.subscription_ends_at : null;
    if (meta.subscribed === true) return { subscribed: true, requestedAt: meta.activation_requested_at ?? null, startedAt, endsAt };
    const requestedAt = typeof meta.activation_requested_at === "string" ? meta.activation_requested_at : new Date().toISOString();
    const { error } = await sb.auth.admin.updateUserById(id, {
      app_metadata: { ...meta, activation_requested_at: requestedAt },
    });
    if (error) throw new Error("تعذّر إرسال طلب التفعيل، حاول مرة أخرى.");
    return { subscribed: false, requestedAt, startedAt: null, endsAt: null };
  },
);
