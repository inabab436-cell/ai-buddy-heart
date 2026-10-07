/**
 * Client-safe shared types and constants for the staff (team) feature.
 *
 * Types and plain data only — imported by both client components and server
 * code, so it must never import server-only modules or read secrets.
 */

/** Permission groups a staff member can be granted. */
export type StaffPermission =
  | "conversations"
  | "orders"
  | "brand_data"
  | "settings";

export const STAFF_PERMISSIONS: StaffPermission[] = [
  "conversations",
  "orders",
  "brand_data",
  "settings",
];

export const PERMISSION_LABELS: Record<
  StaffPermission,
  { title: string; description: string }
> = {
  conversations: {
    title: "المحادثات",
    description: "المحادثات والردود، تشغيل/إيقاف المساعد، والمعلومات الناقصة",
  },
  orders: {
    title: "الأوردرات",
    description: "الأوردرات وتأكيد الدفع وتغيير الحالة والإضافة اليدوية",
  },
  brand_data: {
    title: "بيانات البراند",
    description: "المنتجات، السياسات، الشحن، جهات الاتصال، الملفات، والعروض",
  },
  settings: {
    title: "الإعدادات والنشر",
    description: "طرق الدفع، إشعارات البريد، الموقع والنشر",
  },
};

export type StaffStatus = "invited" | "active" | "disabled";

export const STATUS_LABELS: Record<StaffStatus, string> = {
  invited: "بانتظار التسجيل",
  active: "نشط",
  disabled: "موقوف",
};

/** Build the invite link the owner shares with the staff member. */
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/team/join?t=${encodeURIComponent(token)}`;
}

export interface StaffMember {
  id: string;
  /** Null until the staff member opens the invite link and registers. */
  email: string | null;
  /** Secret in the invite link. */
  invite_token: string;
  name: string;
  permissions: StaffPermission[];
  full_access: boolean;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  last_login_at: string | null;
}

/** Public info shown on the invite page before the staff member registers. */
export interface StaffInviteInfo {
  name: string;
  full_access: boolean;
  permissions: StaffPermission[];
  status: StaffStatus;
  email: string | null;
}

export interface StaffListResult {
  members: StaffMember[];
  total: number;
  active: number;
}

/** Who is currently using the dashboard. */
export interface CurrentActor {
  email: string;
  /** True for the brand owner (or open-access mode). */
  isOwner: boolean;
  /** Staff display name, empty for the owner. */
  name: string;
  full_access: boolean;
  /** Effective permissions — owners and full-access staff get all of them. */
  permissions: StaffPermission[];
}

export function hasPermission(
  actor: Pick<CurrentActor, "isOwner" | "full_access" | "permissions"> | null | undefined,
  permission: StaffPermission,
): boolean {
  if (!actor) return false;
  if (actor.isOwner || actor.full_access) return true;
  return actor.permissions.includes(permission);
}

export function isValidPermission(value: unknown): value is StaffPermission {
  return STAFF_PERMISSIONS.includes(value as StaffPermission);
}

/** Normalise an arbitrary list into known permission keys (deduped). */
export function normalizePermissions(value: unknown): StaffPermission[] {
  if (!Array.isArray(value)) return [];
  const out: StaffPermission[] = [];
  for (const item of value) {
    if (isValidPermission(item) && !out.includes(item)) out.push(item);
  }
  return out;
}
