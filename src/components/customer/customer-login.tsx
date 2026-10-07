/**
 * Storefront customer session hook — guest sessions only.
 *
 * There is no customer sign-in anywhere in the product (owner decision):
 * visitors get a silent guest session scoped to the merchant, which powers
 * chat and order placement without any login UI.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  ensureGuestCustomerSession,
  getCustomerSession,
} from "@/lib/customer-auth.functions";
import type { CustomerSessionInfo } from "@/lib/customer-auth-types";
import { OPEN_ACCESS } from "@/lib/open-access";

export function useCustomerSession(opts?: {
  merchantId?: string | null;
  visitorId?: string | null;
  enabled?: boolean;
}) {
  const fn = useServerFn(getCustomerSession);
  const ensureGuest = useServerFn(ensureGuestCustomerSession);
  const enabled = opts?.enabled ?? true;
  const query = useQuery<CustomerSessionInfo>({
    queryKey: ["customer-session"],
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });

  const tried = useRef(false);
  const merchantId = opts?.merchantId ?? null;
  useEffect(() => {
    if (!enabled) return;
    if (!OPEN_ACCESS || tried.current) return;
    if (!merchantId || query.isLoading || query.data?.loggedIn) return;
    tried.current = true;
    ensureGuest({
      data: { merchant_id: merchantId, visitor_id: opts?.visitorId ?? null },
    })
      .then(() => query.refetch())
      .catch(() => undefined);
  }, [enabled, merchantId, opts?.visitorId, query.isLoading, query.data?.loggedIn]);

  return query;
}
