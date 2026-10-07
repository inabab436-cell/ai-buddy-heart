/**
 * Merchant push-notification registration + preferences.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PushSettings {
  new_order: boolean;
  missing_information: boolean;
  human_needed: boolean;
}

export interface PushSettingsView extends PushSettings {
  /** How many browsers/devices are registered for this account. */
  device_count: number;
}

const DEFAULTS: PushSettings = {
  new_order: true,
  missing_information: true,
  human_needed: true,
};

export const getPushSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PushSettingsView> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requirePermission("settings");
    const admin = getSupabaseAdmin();
    const [{ data }, { count }] = await Promise.all([
      admin
        .from("push_notification_settings")
        .select("new_order, missing_information, human_needed")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("push_tokens")
        .select("token", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
    return {
      new_order: data?.new_order ?? DEFAULTS.new_order,
      missing_information: data?.missing_information ?? DEFAULTS.missing_information,
      human_needed: data?.human_needed ?? DEFAULTS.human_needed,
      device_count: count ?? 0,
    };
  },
);

const settingsSchema = z.object({
  new_order: z.boolean(),
  missing_information: z.boolean(),
  human_needed: z.boolean(),
});

export const updatePushSettings = createServerFn({ method: "POST" })
  .inputValidator((v: PushSettings) => settingsSchema.parse(v))
  .handler(async ({ data }): Promise<PushSettings> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requirePermission("settings");
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("push_notification_settings").upsert(
      { user_id: userId, ...data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return data;
  });

export const registerPushToken = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z.object({ token: z.string().min(20), user_agent: z.string().max(400).optional() }).parse(v),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requirePermission("settings");
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("push_tokens").upsert(
      {
        token: data.token,
        user_id: userId,
        user_agent: data.user_agent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unregisterPushTokens = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requirePermission("settings");
    const admin = getSupabaseAdmin();
    await admin.from("push_tokens").delete().eq("user_id", userId);
    return { ok: true };
  },
);
