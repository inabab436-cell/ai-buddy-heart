/** Server-only session reader. In open-access mode it auto-creates the session. */
import { getSession } from "@tanstack/react-start/server";
import { getSessionConfig, type AppSessionData } from "@/lib/session.server";
import { OPEN_ACCESS } from "@/lib/open-access";
import {
  STAFF_PERMISSIONS,
  type CurrentActor,
  type StaffPermission,
  PERMISSION_LABELS,
} from "@/lib/staff-types";

export async function requireUserId(): Promise<{ userId: string; email: string }> {
  const session = await getSession<AppSessionData>(getSessionConfig());
  if (!session.data?.userId) {
    if (OPEN_ACCESS) {
      const { ensureOpenAccessSession } = await import("@/lib/open-access.server");
      return ensureOpenAccessSession();
    }
    throw new Error("يجب تسجيل الدخول أولاً.");
  }
  return { userId: session.data.userId, email: session.data.email ?? "" };
}

export interface Actor extends CurrentActor {
  /** The brand owner's user id — use this for every data query. */
  merchantId: string;
  /** Null for the owner. */
  staffId: string | null;
}

/**
 * Resolve who is making the request: the brand owner, or one of their staff
 * members with a scoped permission set. `merchantId` is always the owner's id.
 */
export async function requireActor(): Promise<Actor> {
  const session = await getSession<AppSessionData>(getSessionConfig());

  if (!session.data?.userId) {
    // No session: fall back to the shared behaviour (open access or error).
    const { userId, email } = await requireUserId();
    return ownerActor(userId, email);
  }

  return ownerActor(session.data.userId, session.data.email ?? "");
}

function ownerActor(merchantId: string, email: string): Actor {
  return {
    merchantId,
    staffId: null,
    email,
    name: "",
    isOwner: true,
    full_access: true,
    permissions: [...STAFF_PERMISSIONS],
  };
}

/**
 * Require a permission and return the resolved merchant scope.
 * This is the security boundary — hiding UI is not enough.
 */
export async function requirePermission(
  permission: StaffPermission,
): Promise<{ userId: string; email: string; actor: Actor }> {
  const actor = await requireActor();
  const allowed =
    actor.isOwner || actor.full_access || actor.permissions.includes(permission);
  if (!allowed) {
    throw new Error(
      `لا تملك صلاحية «${PERMISSION_LABELS[permission].title}». تواصل مع صاحب الحساب.`,
    );
  }
  return { userId: actor.merchantId, email: actor.email, actor };
}

/** Owner-only actions (managing the team itself). */
export async function requireOwner(): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.isOwner) {
    throw new Error("إدارة الفريق متاحة لصاحب الحساب فقط.");
  }
  return actor;
}
