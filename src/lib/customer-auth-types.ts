/**
 * Client-safe shared types for the CUSTOMER (storefront) guest session.
 *
 * There is no customer sign-in anywhere in the product (owner decision);
 * visitors get a silent guest session. These types are intentionally SEPARATE
 * from `auth-types.ts` (which powers the merchant login). Nothing in this
 * file may import server-only modules or read secrets.
 */

export interface CustomerOtpVerifyResult {
  ok: boolean;
  status: "verified" | "invalid" | "expired" | "blocked" | "error";
  message: string;
  attemptsRemaining?: number;
  blockedUntil?: string;
  /** On success: the resolved customer id (session set via cookie). */
  customerId?: string;
  email?: string;
}

export interface CustomerSessionInfo {
  loggedIn: boolean;
  email: string | null;
  customerId: string | null;
  merchantId: string | null;
  sessionId: string | null;
  expiresAt: string | null;
}

/**
 * Customer sessions are effectively permanent: as long as the customer's
 * account exists, the session stays valid and is renewed on every visit.
 */
export const CUSTOMER_SESSION_DAYS = 3650;
