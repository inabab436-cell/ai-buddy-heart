import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/lib/orders.functions";
import { listConversations } from "@/lib/conversations.functions";

/** Counts shown as badges on the Orders / Conversations menu items. */
export function useHubBadges(enabled = true) {
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
    refetchInterval: 30000,
    enabled,
  });
  const convos = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: 30000,
    enabled,
  });
  const newOrders = (orders.data ?? []).filter((o) => o.status === "new").length;
  const pendingChats = (convos.data ?? []).filter(
    (c) => c.awaiting_payment || c.needs_intervention,
  ).length;
  return { orders, newOrders, pendingChats };
}

export function badgeText(n: number) {
  return n > 99 ? "99+" : String(n);
}
