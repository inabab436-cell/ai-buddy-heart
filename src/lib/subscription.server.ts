/**
 * Server-only subscription enforcement. A store is restricted once its paid
 * period (app_metadata.subscription_ends_at) has passed, until the admin renews it.
 */
export async function isStoreRestricted(admin: any, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const meta = data?.user?.app_metadata ?? {};
    const endsAt = typeof meta.subscription_ends_at === "string" ? Date.parse(meta.subscription_ends_at) : NaN;
    if (meta.subscribed !== true) return false;
    return Number.isFinite(endsAt) && endsAt <= Date.now();
  } catch {
    return false;
  }
}
