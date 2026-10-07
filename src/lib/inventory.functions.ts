/**
 * Manual product creation — bypasses AI analysis and the staging/approval
 * flow entirely. Writes the merchant-entered product directly into the
 * published product tables (products, product_variants, product_colors,
 * product_sizes). The AI import flow via analysis_batches / staging_products
 * is unchanged.
 */
import { createServerFn } from "@tanstack/react-start";

export interface ManualVariantInput {
  color?: string | null;
  size?: string | null;
  quantity?: number | null;
  price?: number | null;
}

export interface ManualProductInput {
  name: string;
  description?: string | null;
  /** Material / fabric (الخامة). */
  material?: string | null;
  price?: number | null;
  currency?: string | null;
  colors?: string[];
  sizes?: string[];
  variants?: ManualVariantInput[];
}

export interface AddStockInput {
  productId: string;
  color?: string | null;
  size?: string | null;
  amount: number;
}

/** Add stock to one exact variant without opening the full product editor. */
export const addVariantStock = createServerFn({ method: "POST" })
  .inputValidator((value: AddStockInput) => {
    const amount = Math.floor(Number(value.amount));
    if (!value.productId) throw new Error("المنتج مطلوب.");
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      throw new Error("أدخل كمية صحيحة أكبر من صفر.");
    }
    return {
      productId: String(value.productId),
      color: value.color ? String(value.color).trim() : null,
      size: value.size ? String(value.size).trim() : null,
      amount,
    };
  })
  .handler(async ({ data }): Promise<{ quantity: number }> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requirePermission("brand_data");
    const admin = getSupabaseAdmin();

    const { data: product } = await admin
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!product) throw new Error("المنتج غير موجود.");

    let query = admin
      .from("product_variants")
      .select("id, stock")
      .eq("product_id", data.productId);
    query = data.color == null ? query.is("color", null) : query.eq("color", data.color);
    query = data.size == null ? query.is("size", null) : query.eq("size", data.size);
    const { data: current, error: readError } = await query.maybeSingle();
    if (readError) throw new Error(readError.message);

    const quantity = Math.max(0, Number((current as any)?.stock ?? 0)) + data.amount;
    if (current) {
      const { error } = await admin
        .from("product_variants")
        .update({ stock: quantity })
        .eq("id", (current as any).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("product_variants").insert({
        product_id: data.productId,
        color: data.color,
        size: data.size,
        stock: quantity,
        position: 0,
      });
      if (error) throw new Error(error.message);
    }
    return { quantity };
  });


export const createManualProduct = createServerFn({ method: "POST" })
  .inputValidator((v: ManualProductInput) => v)
  .handler(async ({ data }): Promise<{ productId: string; colors: { id: string; label: string }[] }> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requirePermission("brand_data");
    const admin = getSupabaseAdmin();

    const name = String(data.name ?? "").trim();
    if (!name) throw new Error("اسم المنتج مطلوب.");
    if (name.length > 300) throw new Error("اسم المنتج طويل جداً.");
    const description = data.description ? String(data.description).slice(0, 4000) : null;
    const price =
      data.price != null && Number.isFinite(Number(data.price)) ? Number(data.price) : null;
    const currency = data.currency ? String(data.currency).slice(0, 8) : "EGP";

    const colors = (data.colors ?? [])
      .map((c) => String(c ?? "").trim())
      .filter(Boolean);
    const sizes = (data.sizes ?? [])
      .map((s) => String(s ?? "").trim())
      .filter(Boolean);

    const variants = (data.variants ?? [])
      .map((v, i) => ({
        color: v.color ? String(v.color).trim() : null,
        size: v.size ? String(v.size).trim() : null,
        // Mandatory quantity: never persist a null stock (see
        // src/lib/variant-quantity.ts for the reasoning).
        stock:
          v.quantity != null && Number.isFinite(Number(v.quantity)) ? Number(v.quantity) : 0,

        price: v.price != null && Number.isFinite(Number(v.price)) ? Number(v.price) : null,
        position: i,
      }))
      .filter((v) => v.color || v.size || v.stock != null || v.price != null);

    // 1. Insert directly into the published products table.
    const material = data.material ? String(data.material).trim().slice(0, 200) || null : null;
    const baseRow = {
      user_id: userId,
      batch_id: null,
      name,
      description,
      category: null,
      price,
      currency,
      variants,
      images: [],
      is_published: true,
    };
    // `material` may not be migrated yet on older databases — retry without it.
    let ins = await admin
      .from("products")
      .insert({ ...baseRow, material } as any)
      .select("id")
      .single();
    if (ins.error && /material/i.test(ins.error.message)) {
      ins = await admin.from("products").insert(baseRow).select("id").single();
    }
    if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "product create failed");
    const productId = (ins.data as { id: string }).id;


    // 2. Structured variant rows.
    if (variants.length > 0) {
      const { error: vErr } = await admin.from("product_variants").insert(
        variants.map((v) => ({
          product_id: productId,
          color: v.color,
          size: v.size,
          price: v.price,
          stock: v.stock,
          position: v.position,
        })),
      );
      if (vErr) throw new Error(vErr.message);
    }

    // 3. Colors.
    const createdColors: { id: string; label: string }[] = [];
    if (colors.length > 0) {
      const { data: colorRows, error: cErr } = await admin
        .from("product_colors")
        .insert(
          colors.map((label, i) => ({
            product_id: productId,
            user_id: userId,
            label,
            hex: null,
            position: i,
          })),
        )
        .select("id, label");
      if (cErr) throw new Error(cErr.message);
      for (const r of colorRows ?? []) {
        createdColors.push({ id: String((r as any).id), label: String((r as any).label) });
      }
    }

    // 4. Sizes.
    if (sizes.length > 0) {
      const { error: sErr } = await admin.from("product_sizes").insert(
        sizes.map((label, i) => ({
          product_id: productId,
          user_id: userId,
          label,
          position: i,
        })),
      );
      if (sErr) throw new Error(sErr.message);
    }


    // Same missing-information flow as the manual-entry box: a product added
    // from this interface can answer an open topic (price / size / color /
    // availability) and notify the customers who were waiting.
    const { resolveMissingInfoForUser } = await import("@/lib/missing-info-resolve.server");
    await resolveMissingInfoForUser(userId, {
      title: `منتج: ${name}`,
      content: [
        `منتج: ${name}`,
        price != null ? `السعر: ${price} ${currency ?? ""}`.trim() : "",
        colors.length ? `الألوان: ${colors.join("، ")}` : "",
        sizes.length ? `المقاسات: ${sizes.join("، ")}` : "",
        variants.length
          ? variants
              .map(
                (v) =>
                  `- لون: ${v.color ?? "-"} | مقاس: ${v.size ?? "-"} | كمية: ${v.stock ?? 0} | سعر: ${v.price ?? price ?? "-"}`,
              )
              .join("\n")
          : "",
        description ? `الوصف: ${description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      entryId: productId,
      fields: ["price", "size", "color", "availability", "other"],
    });

    return { productId, colors: createdColors };
  });

