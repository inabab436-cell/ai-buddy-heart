/**
 * Server-only subscription enforcement.
 * - Not subscribed yet: the store is private — only its owner (merchant
 *   session) can open it.
 * - Subscribed but period ended: restricted for everyone until renewal.
 */
export type StoreAccess = "open" | "unsubscribed" | "expired";

export async function getStoreAccess(admin: any, userId: string | null | undefined): Promise<StoreAccess> {
  if (!userId) return "open";
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const meta = data?.user?.app_metadata ?? {};
    if (meta.subscribed !== true) return "unsubscribed";
    const endsAt = typeof meta.subscription_ends_at === "string" ? Date.parse(meta.subscription_ends_at) : NaN;
    return Number.isFinite(endsAt) && endsAt <= Date.now() ? "expired" : "open";
  } catch {
    return "open";
  }
}

/** True when the current request carries the store owner's merchant session. */
async function isOwnerRequest(userId: string): Promise<boolean> {
  try {
    const { getSession } = await import("@tanstack/react-start/server");
    const { getSessionConfig } = await import("@/lib/session.server");
    const s = await getSession<{ userId: string }>(getSessionConfig());
    return s.data?.userId === userId;
  } catch {
    return false;
  }
}

/** Whether the current visitor may use the store (view, order, chat). */
export async function isStoreRestricted(admin: any, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const access = await getStoreAccess(admin, userId);
  if (access === "open") return false;
  if (access === "unsubscribed") return !(await isOwnerRequest(userId));
  return true;
}
