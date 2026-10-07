/**
 * Public server functions for the storefront customer session.
 *
 * There is no customer sign-in anywhere in the product (owner decision):
 * visitors receive a silent guest session scoped to the merchant, which
 * powers chat and order placement. These endpoints only read or create
 * that guest session.
 */
import { createServerFn } from "@tanstack/react-start";

import type { CustomerSessionInfo } from "@/lib/customer-auth-types";

export const getCustomerSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<CustomerSessionInfo> => {
    const { getCurrentCustomerSession } = await import("@/lib/customer-auth.server");
    const s = await getCurrentCustomerSession();
    if (!s) {
      return {
        loggedIn: false,
        email: null,
        customerId: null,
        merchantId: null,
        sessionId: null,
        expiresAt: null,
      };
    }
    return {
      loggedIn: true,
      email: s.email,
      customerId: s.customerId,
      merchantId: s.merchantId,
      sessionId: s.sessionId,
      expiresAt: s.expiresAt,
    };
  },
);

/**
 * Open-access: create a guest customer session without sign-in.
 * Safe no-op when a session already exists.
 */
export const ensureGuestCustomerSession = createServerFn({ method: "POST" })
  .inputValidator((data: { merchant_id: string; visitor_id?: string | null }) => ({
    merchant_id: String(data?.merchant_id ?? "").trim(),
    visitor_id: data?.visitor_id ? String(data.visitor_id) : null,
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { OPEN_ACCESS } = await import("@/lib/open-access");
    if (!OPEN_ACCESS || !data.merchant_id) return { ok: false };
    const { getCurrentCustomerSession, loginCustomerWithVerifiedEmail } = await import(
      "@/lib/customer-auth.server"
    );
    const existing = await getCurrentCustomerSession();
    if (existing) return { ok: true };
    const guestKey = data.visitor_id ?? crypto.randomUUID();
    const res = await loginCustomerWithVerifiedEmail(
      data.merchant_id,
      `guest-${guestKey}@guest.local`,
      data.visitor_id,
    );
    return { ok: res.ok };
  });
