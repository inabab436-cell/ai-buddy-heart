import { describe, it, expect } from "vitest";
import { planOffer, bestOfferPlan, unitsForMinimum, type ProductOffer } from "@/lib/product-offer-badge";

const offer = (over: Partial<ProductOffer> = {}): ProductOffer => ({
  offer_id: "o1",
  title: "عرض الهودي",
  scope: "product",
  discount_type: "percent",
  discount_value: 10,
  min_order_total: 3000,
  ends_at: null,
  remaining: null,
  usage_limit_type: "per_order",
  display_fields: [],
  ...over,
});

describe("product card offer plan", () => {
  it("one piece below the minimum does not qualify, and points to 2 pieces", () => {
    const p = planOffer(offer(), { unitPrice: 2000, quantity: 1, stock: 10 })!;
    expect(p.qualifies).toBe(false);
    expect(p.discountNow).toBe(0);
    expect(p.unitsNeeded).toBe(2);
    expect(p.subtotalAtUnits).toBe(4000);
    expect(p.discountAtUnits).toBe(400);
    expect(p.totalAtUnits).toBe(3600);
    expect(p.reachable).toBe(true);
  });

  it("qualifies once the quantity reaches the minimum", () => {
    const p = planOffer(offer(), { unitPrice: 2000, quantity: 2, stock: 10 })!;
    expect(p.qualifies).toBe(true);
    expect(p.discountNow).toBe(400);
    expect(p.totalNow).toBe(3600);
    expect(p.unitPriceNow).toBe(1800);
  });

  it("never suggests a quantity the stock cannot cover", () => {
    const p = planOffer(offer(), { unitPrice: 2000, quantity: 1, stock: 1 })!;
    expect(p.reachable).toBe(false);
    expect(bestOfferPlan([offer()], { unitPrice: 2000, quantity: 1, stock: 1 })).toBeNull();
  });

  it("fixed-amount discounts are capped by the line subtotal", () => {
    const p = planOffer(offer({ discount_type: "amount", discount_value: 5000, min_order_total: null }), {
      unitPrice: 2000, quantity: 1, stock: 5,
    })!;
    expect(p.discountNow).toBe(2000);
    expect(p.totalNow).toBe(0);
  });

  it("store-wide offers show on the product too", () => {
    const p = planOffer(offer({ scope: "all", min_order_total: null }), { unitPrice: 500, quantity: 1 })!;
    expect(p.qualifies).toBe(true);
    expect(p.discountNow).toBe(50);
    expect(p.badge).toBe("خصم 10%");
  });

  it("picks the offer with the biggest real saving", () => {
    const best = bestOfferPlan(
      [offer({ offer_id: "a", discount_value: 10, min_order_total: null }), offer({ offer_id: "b", discount_value: 25, min_order_total: null })],
      { unitPrice: 1000, quantity: 1 },
    )!;
    expect(best.offer.offer_id).toBe("b");
    expect(best.discountNow).toBe(250);
  });

  it("ignores offers with no value and zero-priced products", () => {
    expect(planOffer(offer({ discount_value: 0 }), { unitPrice: 100, quantity: 1 })).toBeNull();
    expect(planOffer(offer(), { unitPrice: 0, quantity: 1 })).toBeNull();
  });

  it("quantity needed for the minimum rounds up", () => {
    expect(unitsForMinimum(2000, 3000)).toBe(2);
    expect(unitsForMinimum(2000, null)).toBe(1);
  });
});
