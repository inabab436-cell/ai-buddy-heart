/**
 * PRODUCT CARD OFFER DISPLAY — browser-safe, presentation only.
 *
 * Mirrors the rules of the server offer engine so the product card can show,
 * BEFORE the customer opens the cart:
 *   - that a live offer exists on this product,
 *   - the price after the discount once the chosen quantity qualifies,
 *   - the exact quantity that unlocks the offer, with the real saving.
 *
 * Rules kept identical to `offer-engine.server.ts`:
 *   - `min_order_total` for a product-scoped offer is compared against THIS
 *     product's own subtotal only.
 *   - percent → subtotal * value / 100, amount → capped by the subtotal.
 *
 * Nothing here is authoritative: the order total always comes from the server
 * quote and is recomputed again when the order is created.
 */

export interface ProductOffer {
  offer_id: string;
  title: string;
  scope: "all" | "product";
  discount_type: "percent" | "amount";
  discount_value: number;
  min_order_total: number | null;
  ends_at: string | null;
  /** Remaining beneficiaries/uses; null when unlimited. */
  remaining: number | null;
  usage_limit_type: "once_per_customer" | "per_order";
  display_fields: string[];
}

export interface OfferPlan {
  offer: ProductOffer;
  /** True when the currently selected quantity already earns the discount. */
  qualifies: boolean;
  /** Discount on the current quantity (0 when it does not qualify). */
  discountNow: number;
  /** Line total for the current quantity, after any discount. */
  totalNow: number;
  /** Effective unit price for the current quantity. */
  unitPriceNow: number;
  /** Smallest quantity of this product that unlocks the offer. */
  unitsNeeded: number;
  subtotalAtUnits: number;
  discountAtUnits: number;
  totalAtUnits: number;
  /** False when stock can never reach the needed quantity → never suggest it. */
  reachable: boolean;
  /** Short label for the badge, e.g. "خصم 10%". */
  badge: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function discountOn(offer: ProductOffer, subtotal: number): number {
  const v = Number(offer.discount_value);
  if (!Number.isFinite(v) || v <= 0 || subtotal <= 0) return 0;
  const raw = offer.discount_type === "percent" ? (subtotal * v) / 100 : v;
  return round2(Math.min(Math.max(raw, 0), subtotal));
}

export function badgeLabel(offer: ProductOffer, currency: string | null): string {
  return offer.discount_type === "percent"
    ? `خصم ${offer.discount_value}%`
    : `خصم ${offer.discount_value} ${currency ?? ""}`.trim();
}

/** Smallest quantity of this product whose subtotal reaches the minimum. */
export function unitsForMinimum(unitPrice: number, min: number | null): number {
  if (!min || min <= 0) return 1;
  if (!(unitPrice > 0)) return 1;
  return Math.max(1, Math.ceil(min / unitPrice));
}

export function planOffer(
  offer: ProductOffer,
  opts: { unitPrice: number; quantity: number; stock?: number | null; currency?: string | null },
): OfferPlan | null {
  const unitPrice = Number(opts.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  if (!(Number(offer.discount_value) > 0)) return null;

  const qty = Math.max(1, Math.floor(Number(opts.quantity) || 1));
  const min = offer.min_order_total == null ? null : Number(offer.min_order_total);
  const subtotalNow = round2(unitPrice * qty);
  const qualifies = min == null || min <= 0 || subtotalNow >= min;
  const discountNow = qualifies ? discountOn(offer, subtotalNow) : 0;

  const unitsNeeded = unitsForMinimum(unitPrice, min);
  const subtotalAtUnits = round2(unitPrice * unitsNeeded);
  const discountAtUnits = discountOn(offer, subtotalAtUnits);
  const stock = opts.stock == null ? null : Number(opts.stock);
  const reachable = stock == null ? true : stock >= unitsNeeded;

  return {
    offer,
    qualifies,
    discountNow,
    totalNow: round2(subtotalNow - discountNow),
    unitPriceNow: round2((subtotalNow - discountNow) / qty),
    unitsNeeded,
    subtotalAtUnits,
    discountAtUnits,
    totalAtUnits: round2(subtotalAtUnits - discountAtUnits),
    reachable,
    badge: badgeLabel(offer, opts.currency ?? null),
  };
}

/**
 * Picks the single offer to advertise on the card: the one already earning the
 * biggest discount, otherwise the reachable one with the biggest saving.
 */
export function bestOfferPlan(
  offers: ProductOffer[],
  opts: { unitPrice: number; quantity: number; stock?: number | null; currency?: string | null },
): OfferPlan | null {
  const plans = (offers ?? [])
    .map((o) => planOffer(o, opts))
    .filter((p): p is OfferPlan => p != null);
  if (!plans.length) return null;
  const applying = plans.filter((p) => p.qualifies).sort((a, b) => b.discountNow - a.discountNow);
  if (applying.length) return applying[0];
  const near = plans.filter((p) => p.reachable).sort((a, b) => b.discountAtUnits - a.discountAtUnits);
  return near[0] ?? null;
}
