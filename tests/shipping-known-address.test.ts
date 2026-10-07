import { describe, expect, it } from "vitest";

import { buildShippingLookupBlock } from "@/lib/shipping-lookup.server";

const zones = [
  { country: "مصر", region: "القاهرة", price: 60, currency: "جنيه", eta: "٢-٣ أيام" },
  { country: "مصر", region: "الغربية", price: 75, currency: "جنيه", eta: "٣-٤ أيام" },
] as never[];

describe("shipping lookup uses the address already recorded", () => {
  it("resolves the zone from the recorded address when the message window lost it", () => {
    const block = buildShippingLookupBlock({
      zones,
      texts: ["تمام، وبكام الشحن؟"],
      knownAddress: "القاهرة - مدينة نصر - شارع مصطفى النحاس",
    });
    expect(block).toContain("الشحن لمنطقة العميل موجود في الجدول");
    expect(block).toContain("60");
    expect(block).not.toContain("العميل لسه ما حددش منطقته");
  });

  it("never asks for the governorate again while an address is on file", () => {
    const block = buildShippingLookupBlock({
      zones,
      texts: ["ok"],
      knownAddress: "عمارة 5، شارع الجلاء، الدور الثالث",
    });
    expect(block).toContain("العنوان/المنطقة المسجّلة للعميل بالفعل");
    expect(block).not.toContain("العميل لسه ما حددش منطقته");
  });

  it("still asks once when nothing is recorded", () => {
    const block = buildShippingLookupBlock({ zones, texts: ["عايز اطلب"] });
    expect(block).toContain("العميل لسه ما حددش منطقته");
  });
});
