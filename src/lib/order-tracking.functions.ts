/**
 * Public order tracking for customers who lost their session.
 *
 * - Order number only  → limited summary (status + timeline dates).
 * - Order number + the phone used on the order → full details.
 * Always scoped to the storefront's merchant (resolved from the slug).
 */
import { createServerFn } from "@tanstack/react-start";

import type { CustomerOrderDetail, CustomerOrderItem } from "@/lib/customer-orders.functions";

export interface TrackedOrder {
  found: boolean;
  full: boolean;
  phoneMismatch?: boolean;
  order: CustomerOrderDetail | null;
  itemCount: number;
  customerName?: string | null;
  customerAddress?: string | null;
}

function digits(v: unknown): string {
  const map: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  return String(v ?? "").replace(/[٠-٩]/g, (d) => map[d] ?? d).replace(/\D/g, "");
}

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; orderNumber: string; phone?: string | null }) => ({
    slug: String(d?.slug ?? "").toLowerCase().trim().slice(0, 100),
    orderNumber: String(d?.orderNumber ?? "").trim().replace(/^#/, "").slice(0, 60),
    phone: d?.phone ? String(d.phone).slice(0, 30) : null,
  }))
  .handler(async ({ data }): Promise<TrackedOrder> => {
    const empty: TrackedOrder = { found: false, full: false, order: null, itemCount: 0 };
    if (!data.slug || !data.orderNumber) return empty;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    const { data: m } = await admin.from("merchants").select("id").eq("brand_slug", data.slug).maybeSingle();
    if (!m) return empty;
    const { data: o } = await admin
      .from("orders")
      .select("*")
      .eq("merchant_id", (m as any).id)
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!o) return empty;
    const row = o as any;
    const items: CustomerOrderItem[] = (Array.isArray(row.items) ? row.items : []).map((it: any) => ({
      product_name: it?.product_name ?? it?.name ?? null,
      color: it?.color ?? null,
      size: it?.size ?? null,
      quantity: Math.max(1, Number(it?.quantity) || 1),
      price: it?.price == null ? null : Number(it.price),
      currency: it?.currency ?? null,
    }));
    const given = digits(data.phone);
    const stored = digits(row.customer_phone);
    const full = given.length >= 8 && stored.length >= 8 && given.slice(-10) === stored.slice(-10);
    const order: CustomerOrderDetail = {
      id: row.id,
      order_number: row.order_number ?? null,
      status: String(row.status ?? "new"),
      payment_status: String(row.payment_status ?? "pending"),
      payment_kind: row.payment_kind ?? null,
      payment_method: full ? row.payment_method ?? null : null,
      total_price: full && row.total_price != null ? Number(row.total_price) : null,
      currency: full ? row.currency ?? items[0]?.currency ?? null : null,
      items: full ? items : [],
      notes: full ? row.notes ?? null : null,
      created_at: String(row.created_at),
      prepared_at: row.prepared_at ?? null,
      shipped_at: row.shipped_at ?? null,
      delivered_at: row.delivered_at ?? null,
      payment_confirmed_at: row.payment_confirmed_at ?? null,
      conversation_id: null,
    };
    return {
      found: true,
      full,
      phoneMismatch: !!given && !full,
      order,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      customerName: full ? row.customer_name ?? null : null,
      customerAddress: full ? row.customer_address ?? null : null,
    };
  });
