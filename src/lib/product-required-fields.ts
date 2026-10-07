/**
 * Mandatory basic product fields.
 *
 * The merchant may not save a product without its material, its price and at
 * least one colour row carrying a quantity: a product missing any of these
 * reaches the customer as an incomplete answer ("مش عارف الخامة/السعر") or as
 * a contradictory availability state.
 */

export function requireMaterial(raw: string): string {
  const value = String(raw ?? "").trim();
  if (value === "") throw new Error("اكتب خامة المنتج — الخانة إجبارية.");
  return value;
}

export function requirePrice(raw: string): number {
  const text = String(raw ?? "").trim();
  if (text === "") throw new Error("اكتب سعر المنتج — الخانة إجبارية.");
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("سعر المنتج يجب أن يكون رقماً أكبر من صفر.");
  }
  return n;
}

/** At least one colour row, so a quantity always exists for the product. */
export function requireVariantRows(count: number): void {
  if (count <= 0) {
    throw new Error("أضف لوناً واحداً على الأقل مع الكمية — الكمية إجبارية.");
  }
}

/** True when the basic fields are filled, used to enable the save button. */
export function basicFieldsFilled(input: {
  name: string;
  material: string;
  price: string;
  rows: number;
}): boolean {
  const price = Number(String(input.price).trim());
  return Boolean(
    input.name.trim() &&
      input.material.trim() &&
      String(input.price).trim() !== "" &&
      Number.isFinite(price) &&
      price > 0 &&
      input.rows > 0,
  );
}

/** Size is mandatory on every colour row. */
export function requireSize(raw: string, colorLabel: string): string {
  const value = String(raw ?? "").trim();
  if (value === "") throw new Error(`اكتب المقاس للون «${colorLabel || "بدون اسم"}».`);
  return value;
}

/**
 * Keys of mandatory fields that are still empty, used to paint them red when
 * the merchant presses save. Row keys: `label-i`, `size-i`, `qty-i`.
 */
export function missingRequiredFields(input: {
  name: string;
  material: string;
  price: string;
  rows: { label: string; size: string; quantity: string }[];
}): Set<string> {
  const out = new Set<string>();
  if (!input.name.trim()) out.add("name");
  if (!input.material.trim()) out.add("material");
  const p = Number(String(input.price).trim());
  if (String(input.price).trim() === "" || !Number.isFinite(p) || p <= 0) out.add("price");
  if (input.rows.length === 0) out.add("rows");
  input.rows.forEach((r, i) => {
    if (!r.label.trim()) out.add(`label-${i}`);
    if (!r.size.trim()) out.add(`size-${i}`);
    const q = String(r.quantity).trim();
    if (q === "" || !Number.isFinite(Number(q)) || Number(q) < 0) out.add(`qty-${i}`);
  });
  return out;
}
