import { describe, it, expect } from "vitest";
import { t, EN } from "@/lib/store-i18n";

describe("storefront language", () => {
  it("shows Arabic by default", () => {
    expect(t("تتبع طلبي")).toBe("تتبع طلبي");
  });
  it("has an English text for the track-order button", () => {
    expect(EN["تتبع طلبي"]).toBe("Track order");
  });
});
