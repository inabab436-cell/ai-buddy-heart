import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, ChevronDown, MoreVertical, Plus, Trash2, Loader2, ImageOff, ImagePlus, X, Pencil, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { PageShell } from "@/components/layout/page-shell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  listWebsiteProducts, setProductPublished, uploadProductImage,
  upsertWebsiteProduct, deleteWebsiteProduct, deleteProductImage,
  listProductSales,
  type WebsiteProductDTO,
  type ProductSalesDTO,
} from "@/lib/website-products.functions";
import { addVariantStock, createManualProduct, type ManualVariantInput } from "@/lib/inventory.functions";
import { requireQuantity } from "@/lib/variant-quantity";
import {
  missingRequiredFields,
  requireMaterial,
  requirePrice,
  requireSize,
  requireVariantRows,
} from "@/lib/product-required-fields";




export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "المخزون · cupai" },
      { name: "description", content: "منتجاتك، الألوان، المقاسات، والكميات." },
      { property: "og:title", content: "المخزون · cupai" },
      { property: "og:description", content: "منتجاتك، الألوان، المقاسات، والكميات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

/**
 * Total stock for the whole product = sum of every colour/size quantity.
 * `known` is false when no variant carries a number, so the UI shows
 * "غير محدّد" instead of wrongly claiming the product is sold out.
 */
function totalQty(p: WebsiteProductDTO) {
  let qty = 0;
  let known = false;
  for (const v of p.variants) {
    if (v.quantity != null && Number.isFinite(Number(v.quantity))) {
      qty += Number(v.quantity);
      known = true;
    }
  }
  return { qty, known };
}

function ProductsPage() {
  const qc = useQueryClient();
  
  const q = useQuery({
    queryKey: ["website-products"],
    queryFn: () => listWebsiteProducts(),
  });
  // Sold pieces per product, read from confirmed orders.
  const salesQ = useQuery({
    queryKey: ["product-sales"],
    queryFn: () => listProductSales(),
    refetchInterval: 60_000,
  });
  const salesById = new Map<string, ProductSalesDTO>(
    (salesQ.data ?? []).map((s) => [s.productId, s]),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Selected colour per product (colour id); undefined = show all colours.
  const [colorSel, setColorSel] = useState<Record<string, string | null>>({});
  const [addOpen, setAddOpen] = useState(false);
  // Keep only the id: the dialog always reads the latest saved product row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickStock, setQuickStock] = useState<{ product: WebsiteProductDTO; variantIndex: number } | null>(null);
  const pubMut = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) =>
      setProductPublished({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-products"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل النشر."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteWebsiteProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المنتج.");
      qc.invalidateQueries({ queryKey: ["website-products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحذف."),
  });


  const rows = q.data ?? [];
  const totalStock = rows.reduce((n, p) => n + totalQty(p).qty, 0);
  const totalSold = Array.from(salesById.values()).reduce((n, s) => n + s.sold, 0);

  // Low-stock alert: every colour/size with 3 pieces or fewer left.
  const lowItems = rows.flatMap((p) =>
    p.variants
      .filter((v) => v.quantity != null && Number(v.quantity) <= 3)
      .map((v) => ({
        key: `${p.id}-${v.color}-${v.size}`,
        label: [p.name, v.color, v.size].filter(Boolean).join(" - "),
        qty: Number(v.quantity),
      })),
  );
  const alertedRef = useRef(false);
  useEffect(() => {
    if (alertedRef.current || !q.data || lowItems.length === 0) return;
    alertedRef.current = true;
    toast.warning(`تنبيه: ${lowItems.length} من منتجاتك قاربت على النفاد`, {
      description: lowItems.slice(0, 3).map((i) => `${i.label}: ${i.qty === 0 ? "نفدت" : `متبقي ${i.qty}`}`).join("\n"),
      duration: 8000,
    });
  }, [q.data, lowItems.length]);

  return (
    <PageShell>
      <div className="inventory-navy -mx-4 -mt-6 min-h-[70vh] space-y-4 bg-background px-4 pb-4 pt-5">
        <header className="min-w-0">
          <h1 className="inv-title text-2xl font-bold">كل منتجاتك</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            تابع كمياتك وأسعارك، واضغط على أي منتج لرؤية ألوانه ومقاساته.
          </p>
        </header>

        {lowItems.length > 0 && (
          <div role="alert" className="rounded-2xl border border-border bg-inv-warn-soft p-3">
            <div className="text-sm font-bold text-inv-warn">
              ⚠️ تنبيه: {lowItems.length} {lowItems.length === 1 ? "منتج قارب" : "منتجات قاربت"} على النفاد
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[12px]">
              {lowItems.slice(0, 6).map((i) => (
                <li key={i.key} className="flex justify-between gap-2">
                  <span className="truncate">{i.label}</span>
                  <span className="inv-num shrink-0 font-semibold text-inv-warn">
                    {i.qty === 0 ? "نفدت" : `متبقي ${i.qty}`}
                  </span>
                </li>
              ))}
            </ul>
            {lowItems.length > 6 && (
              <div className="mt-1 text-[11px] text-muted-foreground">و{lowItems.length - 6} أخرى…</div>
            )}
          </div>
        )}

        <Button
          onClick={() => setAddOpen(true)}
          className="h-12 w-full gap-2 rounded-xl text-base font-bold shadow-card active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          إضافة منتج جديد
        </Button>

        <AddProductDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onCreated={() => {
            setAddOpen(false);
            toast.success("تم إضافة المنتج إلى المخزون.");
            qc.invalidateQueries({ queryKey: ["website-products"] });
          }}
        />
        <EditProductDialog
          product={rows.find((p) => p.id === editingId) ?? null}
          onOpenChange={(v) => { if (!v) setEditingId(null); }}
          onSaved={() => {
            setEditingId(null);
            toast.success("تم حفظ التعديلات.");
            qc.invalidateQueries({ queryKey: ["website-products"] });
          }}
        />
        <QuickStockDialog
          target={quickStock}
          onOpenChange={(open) => { if (!open) setQuickStock(null); }}
          onSaved={() => {
            setQuickStock(null);
            qc.invalidateQueries({ queryKey: ["website-products"] });
          }}
        />

        {q.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">لا توجد منتجات بعد. أضف منتجك الأول من الزر بالأعلى.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="عدد المنتجات" value={String(rows.length)} />
              <StatTile label="إجمالي الكميات" value={String(totalStock)} />
              <StatTile label="إجمالي المُباع" value={String(totalSold)} accent />
            </div>

            <div className="space-y-3">
              {rows.map((p) => {
                const isOpen = expanded[p.id] === true;
                const sales = salesById.get(p.id);
                // Colour filter: when a swatch is picked, every number/image
                // below reflects that colour only.
                const selColorId = colorSel[p.id] ?? null;
                const selColor = p.colors.find((c) => c.id === selColorId) ?? null;
                const selKey = selColor ? String(selColor.label).trim().toLocaleLowerCase("ar") : null;
                const firstImg = selColor
                  ? (p.images.find((im) => im.color_id === selColor.id) ?? p.images[0])
                  : p.images[0];
                const colorVariants = selKey
                  ? p.variants.filter((v) => String(v.color ?? "").trim().toLocaleLowerCase("ar") === selKey)
                  : p.variants;
                let remainingQty = 0;
                let qtyKnown = false;
                for (const v of colorVariants) {
                  if (v.quantity != null && Number.isFinite(Number(v.quantity))) {
                    remainingQty += Number(v.quantity);
                    qtyKnown = true;
                  }
                }
                const low = qtyKnown && remainingQty <= 3;
                return (
                  <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex gap-3 p-3">
                      {firstImg ? (
                        <img src={firstImg.url} alt={p.name} loading="lazy"
                          className="h-20 w-20 shrink-0 rounded-lg bg-muted object-cover" />
                      ) : (
                        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <ImageOff className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</h3>
                            {p.price != null && (
                              <p className="inv-num mt-0.5 text-sm font-bold text-primary">
                                {p.price} {p.currency ?? ""}
                              </p>
                            )}
                          </div>
                          <DropdownMenu dir="rtl">
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label="خيارات المنتج"
                                className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                                <MoreVertical className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                              <DropdownMenuItem onClick={() => setQuickStock({ product: p, variantIndex: 0 })}>
                                <PackagePlus className="ml-2 h-4 w-4" />تزويد المخزون
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingId(p.id)}>
                                <Pencil className="ml-2 h-4 w-4" />تعديل
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={delMut.isPending}
                                onClick={() => {
                                  if (window.confirm(`حذف المنتج "${p.name}" نهائياً؟`)) delMut.mutate(p.id);
                                }}
                              >
                                <Trash2 className="ml-2 h-4 w-4" />حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`inv-num rounded-md px-2 py-0.5 text-[11px] font-semibold ${low ? "bg-inv-warn-soft text-inv-warn" : "bg-muted text-muted-foreground"}`}>
                            {qtyKnown ? (remainingQty === 0 ? "نفدت الكمية" : `المتبقي: ${remainingQty}`) : "الكمية غير محدّدة"}
                          </span>
                          {p.variants.length > 0 && (
                            <button type="button"
                              onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !isOpen }))}
                              className="flex items-center gap-1 text-xs font-medium"
                              aria-expanded={isOpen}>
                              التفاصيل
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {p.colors.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
                        {p.colors.map((c) => {
                          const active = selColorId === c.id;
                          const colorImg = p.images.find((im) => im.color_id === c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              title={c.label}
                              aria-label={c.label}
                              aria-pressed={active}
                              onClick={() =>
                                setColorSel((prev) => ({ ...prev, [p.id]: active ? null : c.id }))
                              }
                              className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-md border transition-transform active:scale-95 ${active ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : "border-border"}`}
                              style={{ background: c.hex ?? "transparent" }}
                            >
                              {colorImg ? (
                                <img src={colorImg.url} alt="" loading="lazy"
                                  className="absolute inset-0 h-full w-full object-cover" />
                              ) : (
                                !c.hex && (
                                  <span className="block truncate px-0.5 text-[8px] leading-6 text-muted-foreground">{c.label}</span>
                                )
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {isOpen && <VariantGrid product={p} sales={sales} colorLabel={selColor?.label ?? null} />}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

/** Compact stat tile — three sit side by side on a phone. */
function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="mb-1 text-[10px] text-muted-foreground">{label}</p>
      <p className={`inv-num text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

/** Normalised key so an order line ("أحمر"/"M") lines up with a variant row. */
function vKey(color: unknown, size: unknown) {
  const n = (v: unknown) => String(v ?? "").trim().toLocaleLowerCase("ar");
  return `${n(color)}|${n(size)}`;
}

/** Expanded variants: one chip per colour + size with remaining stock. */
function VariantGrid({ product, sales, colorLabel }: { product: WebsiteProductDTO; sales: ProductSalesDTO | undefined; colorLabel?: string | null }) {
  const hexByLabel = new Map(
    product.colors.map((c) => [String(c.label ?? "").trim().toLocaleLowerCase("ar"), c.hex]),
  );
  const soldByVariant = new Map((sales?.variants ?? []).map((v) => [vKey(v.color, v.size), v.sold]));
  const filterKey = colorLabel ? String(colorLabel).trim().toLocaleLowerCase("ar") : null;
  const variants = filterKey
    ? product.variants.filter((v) => String(v.color ?? "").trim().toLocaleLowerCase("ar") === filterKey)
    : product.variants;
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/60 px-3 py-2.5">
      {variants.map((v, i) => {
        const qty = v.quantity != null && Number.isFinite(Number(v.quantity)) ? Number(v.quantity) : null;
        const hex = hexByLabel.get(String(v.color ?? "").trim().toLocaleLowerCase("ar"));
        const sold = soldByVariant.get(vKey(v.color, v.size)) ?? 0;
        const low = qty != null && qty <= 3;
        return (
          <div key={i} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              {hex && <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border" style={{ background: hex }} />}
              <span className="truncate">{[v.color, v.size].filter(Boolean).join(" / ") || "أساسي"}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <span className={`inv-num font-bold ${low ? "text-inv-warn" : ""}`}>{qty ?? "—"}</span>
              {sold > 0 && <span className="text-[9px] text-muted-foreground">مُباع {sold}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QuickStockDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: { product: WebsiteProductDTO; variantIndex: number } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [amount, setAmount] = useState("1");
  const product = target?.product;
  const variants = product?.variants ?? [];
  const chosen = variants[variantIndex];
  useEffect(() => {
    if (target) {
      setVariantIndex(target.variantIndex);
      setAmount("1");
    }
  }, [target]);
  const add = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("المنتج غير موجود.");
      return addVariantStock({
        data: {
          productId: product.id,
          color: chosen?.color ?? null,
          size: chosen?.size ?? null,
          amount: Number(amount),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`تم تحديث المخزون إلى ${result.quantity}.`);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر تحديث المخزون."),
  });

  const open = target != null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="hub max-w-sm">
        <DialogHeader>
          <DialogTitle>تزويد مخزون {product?.name ?? "المنتج"}</DialogTitle>
          <DialogDescription>اختر المتغير والكمية التي تريد إضافتها.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {variants.length > 1 && (
            <label className="block space-y-1.5 text-sm font-semibold">
              <span>اللون أو المقاس</span>
              <select value={variantIndex} onChange={(e) => setVariantIndex(Number(e.target.value))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {variants.map((variant, index) => (
                  <option key={`${variant.color ?? ""}-${variant.size ?? ""}-${index}`} value={index}>
                    {[variant.color, variant.size].filter(Boolean).join(" · ") || "المنتج الأساسي"} — المتاح {variant.quantity ?? 0}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>الكمية المضافة</span>
            <Input inputMode="numeric" type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 20].map((value) => (
              <Button key={value} type="button" variant="outline" size="sm" onClick={() => setAmount(String(value))}>+{value}</Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || Number(amount) < 1}>
            {add.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            إضافة للمخزون
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Manual Add Product dialog — creates a staging_products row inside a fresh
// analysis_batch and redirects the merchant to the batch review page so the
// existing approval flow handles the actual publish.
// ---------------------------------------------------------------------------

/** ONE row = one colour + one size + one quantity. Multi-size rows are not allowed. */
type AddColor = {
  /** Stable image-group key. Rows of the SAME colour share the same gkey, so
   *  every size of that colour is linked to the same colour images. */
  gkey: string;
  label: string;
  size: string;
  quantity: string;
};

let addGroupSeq = 0;
const nextAddGroupKey = () => `a${++addGroupSeq}`;

/** Normalised key used to decide that two images share the same colour. */
function colorKey(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Unique named colours (one per group) for the image colour chips. */
function colorOptions(rows: { gkey: string; label: string }[]) {
  return Array.from(
    new Map(rows.filter((c) => c.label.trim()).map((c) => [colorKey(c.label), { gkey: c.gkey, label: c.label.trim() }] as const)).values(),
  );
}

/** Tap-to-link colour buttons shown under each image. */
function ColorChips({
  options, value, onPick,
}: {
  options: { gkey: string; label: string }[];
  value: string;
  onPick: (gkey: string) => void;
}) {
  if (options.length === 0) {
    return <p className="mt-1 text-center text-[10px] text-muted-foreground">أضف الألوان بالأسفل لربطها</p>;
  }
  return (
    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
      {options.map((o) => {
        const active = o.gkey === value;
        return (
          <button
            key={o.gkey}
            type="button"
            onClick={() => onPick(active ? "" : o.gkey)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Big, first-thing upload area for product images. */
function UploadZone({ onFiles }: { onFiles: (list: FileList | null) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition hover:border-primary hover:bg-primary/5 ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
        <ImagePlus className="h-6 w-6 text-primary" />
      </span>
      <span className="text-sm font-semibold">ارفع صور المنتج</span>
      <span className="text-xs text-muted-foreground">اختر عدة صور أو اسحبها هنا، ثم اضغط لون كل صورة</span>
      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
    </label>
  );
}


function AddProductDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (productId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");

  const [price, setPrice] = useState("");
  
  const [colors, setColors] = useState<AddColor[]>(() => [{ gkey: nextAddGroupKey(), label: "", size: "", quantity: "" }]);
  // Images picked before the product exists, keyed by colour group key ("g" = intake).
  const [pendingImages, setPendingImages] = useState<Record<string, File[]>>({});
  const [showErrors, setShowErrors] = useState(false);

  // Always-fresh view of `colors` for use after awaits.
  const colorsRef = useRef<AddColor[]>(colors);
  colorsRef.current = colors;

  function addColorRow() {
    setColors((rows) => [...rows, { gkey: nextAddGroupKey(), label: "", size: "", quantity: "" }]);
  }
  function addSizeRow(group: AddColor) {
    setColors((rows) => {
      const last = rows.map((row) => row.gkey).lastIndexOf(group.gkey);
      const next = [...rows];
      next.splice(last + 1, 0, { ...group, size: "", quantity: "" });
      return next;
    });
  }

  function removeFile(key: string, index: number) {
    setPendingImages((prev) => ({
      ...prev, [key]: (prev[key] ?? []).filter((_, i) => i !== index),
    }));
  }
  function patchColor(i: number, patch: Partial<AddColor>) {
    setColors((rows) => {
      const target = rows[i];
      if (!target) return rows;
      // Renaming a colour renames every row that shares its image group, so the
      // colour ⇄ image link stays intact across all of its sizes.
      return rows.map((r, j) => {
        if (j === i) return { ...r, ...patch };
        if (patch.label !== undefined && r.gkey === target.gkey) {
          return { ...r, label: patch.label };
        }
        return r;
      });
    });
  }

  function removeGroup(gkey: string) {
    setColors((rows) => rows.filter((r) => r.gkey !== gkey));
    setPendingImages((prev) => {
      const out: Record<string, File[]> = { ...prev, g: [...(prev.g ?? []), ...(prev[gkey] ?? [])] };
      delete out[gkey];
      return out;
    });
  }

  /** Remove a row; if it was the last row of its group, its images go back to intake. */
  function removeColor(i: number) {
    const gone = colorsRef.current[i];
    const rest = colorsRef.current.filter((_, j) => j !== i);
    setColors(rest);
    if (!gone) return;
    if (rest.some((r) => r.gkey === gone.gkey)) return;
    setPendingImages((prev) => {
      const out: Record<string, File[]> = { ...prev, g: [...(prev["g"] ?? []), ...(prev[gone.gkey] ?? [])] };
      delete out[gone.gkey];
      return out;
    });
  }

  /** Move one pending image between the general area and a named colour. */
  function moveFile(fromKey: string, index: number, toKey: string) {
    const file = (pendingImages[fromKey] ?? [])[index];
    if (!file) return;
    const target = toKey;
    if (target === fromKey) return;
    setPendingImages((prev) => ({
      ...prev,
      [fromKey]: (prev[fromKey] ?? []).filter((_, i) => i !== index),
      [target]: [...(prev[target] ?? []), file],
    }));
  }


  function reset() {
    setName(""); setDescription(""); setMaterial(""); setPrice("");
    setColors([{ gkey: nextAddGroupKey(), label: "", size: "", quantity: "" }]); setPendingImages({});
  }


  /** Add selected product images to the unassigned image area. */
  function addIntakeFiles(list: FileList | null) {
    const picked = Array.from(list ?? []).filter((f) => /^image\//i.test(f.type));
    if (picked.length === 0) return;
    setPendingImages((prev) => ({ ...prev, g: [...(prev["g"] ?? []), ...picked] }));
  }



  const createMut = useMutation({
    mutationFn: async () => {
      // Material, price and quantity are mandatory basic fields.
      const materialValue = requireMaterial(material);
      const priceValue = requirePrice(price);
      requireVariantRows(colors.filter((c) => c.label.trim()).length);

      const sizes = Array.from(
        new Set(colors.map((c) => c.size.trim()).filter(Boolean)),
      );
      const colorList = Array.from(
        new Set(colors.map((c) => c.label.trim()).filter(Boolean)),
      );
      const vs: ManualVariantInput[] = [];
      colors.forEach((c) => {
        const label = c.label.trim();
        if (!label) return;
        // Quantity is MANDATORY: a null stock row is later read as
        // "unavailable" and then flips once the merchant fills it in, which is
        // exactly the availability contradiction this guard prevents.
        const qty = requireQuantity(c.quantity, label);
        const size = requireSize(c.size, label);
        vs.push({ color: label, size, quantity: qty });
      });

      const res = await createManualProduct({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          material: materialValue,
          price: priceValue,

          colors: colorList,
          sizes,
          variants: vs,
        },
      });


      // Upload the picked images through the existing product-image upload
      // mechanism, attaching each one to its colour.
      const colorIdByLabel = new Map(
        (res.colors ?? []).map((c) => [c.label.toLowerCase(), c.id] as const),
      );
      for (const [key, files] of Object.entries(pendingImages)) {
        const label =
          key === "g" ? "" : (colors.find((c) => c.gkey === key)?.label ?? "").trim();

        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("productId", res.productId);
          const cid = label ? colorIdByLabel.get(label.toLowerCase()) : null;
          if (cid) fd.append("colorId", cid);
          await uploadProductImage({ data: fd });
        }
      }
      return res;
    },
    onSuccess: (r) => {
      reset();
      onCreated(r.productId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إنشاء المنتج."),
  });

  const bad = showErrors ? missingRequiredFields({ name, material, price, rows: colors }) : new Set<string>();
  const err = (k: string) => (bad.has(k) ? "border-destructive ring-1 ring-destructive" : "");

  function trySave() {
    const missing = missingRequiredFields({ name, material, price, rows: colors });
    if (missing.size > 0) {
      setShowErrors(true);
      toast.error("أكمل الخانات المحددة باللون الأحمر.");
      return;
    }
    createMut.mutate();
  }

  const allFiles = Object.entries(pendingImages).flatMap(([key, files]) => files.map((f, k) => ({ key, f, k })));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { reset(); setShowErrors(false); } }}>
      <DialogContent dir="rtl" className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة منتج جديد</DialogTitle>
          <DialogDescription>
            ارفع صور المنتج، اربط كل صورة بلونها بضغطة، ثم أكمل البيانات.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Images first */}
          <section className="space-y-3 border-b border-border pb-5">
            <h4 className="text-sm font-semibold">١. صور المنتج</h4>
            <UploadZone onFiles={addIntakeFiles} />
            {allFiles.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {allFiles.map(({ key, f, k }) => (
                  <div key={`${key}-${f.name}-${k}`} className="w-28 rounded-lg border border-border/60 p-1.5">
                    <div className="relative">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-24 w-full rounded-md object-cover" />
                      <button type="button" onClick={() => removeFile(key, k)} aria-label="حذف الصورة"
                        className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <ColorChips
                      options={colorOptions(colors)}
                      value={colors.some((c) => c.gkey === key && c.label.trim()) ? key : ""}
                      onPick={(to) => moveFile(key, k, to || "g")}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Basic info */}
          <section className="space-y-3 border-b border-border pb-5">
            <h4 className="text-sm font-semibold">٢. بيانات المنتج</h4>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">اسم المنتج</label>
              <Input className={err("name")} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تيشيرت قطن" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الوصف</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">الخامة</label>
                <Input className={err("material")} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="مثال: قطن ١٠٠٪" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">السعر (ج.م)</label>
                <Input className={err("price")} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Colours */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className={`text-sm font-semibold ${bad.has("rows") ? "text-destructive" : ""}`}>٣. الألوان والمقاسات والكميات</h4>
              <Button size="sm" variant="outline" type="button" onClick={() => addColorRow()}>
                <Plus className="ml-1 h-3.5 w-3.5" /> إضافة لون
              </Button>
            </div>
            {Array.from(new Map(colors.map((c) => [c.gkey, c] as const)).values()).map((group) => {
              const gi = colors.findIndex((c) => c.gkey === group.gkey);
              return (
              <div key={group.gkey} className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1 text-xs font-medium">اللون
                    <Input className={err(`label-${gi}`)} value={group.label} placeholder="مثال: أحمر" onChange={(e) => patchColor(gi, { label: e.target.value })} />
                  </label>
                  <Button size="icon" variant="ghost" type="button" aria-label="حذف اللون" onClick={() => removeGroup(group.gkey)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {colors.map((c, i) => c.gkey === group.gkey && (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground">المقاس
                      <Input className={err(`size-${i}`)} value={c.size} placeholder="مثال: L" onChange={(e) => patchColor(i, { size: e.target.value })} />
                    </label>
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground">الكمية
                      <Input className={err(`qty-${i}`)} type="number" min={0} value={c.quantity} placeholder="0" onChange={(e) => patchColor(i, { quantity: e.target.value })} />
                    </label>
                    <Button size="icon" variant="ghost" type="button" aria-label="حذف المقاس" disabled={colors.filter((r) => r.gkey === group.gkey).length === 1} onClick={() => removeColor(i)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" type="button" onClick={() => addSizeRow(group)}><Plus className="ml-1 h-3.5 w-3.5" /> إضافة مقاس</Button>
              </div>
              );
            })}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={trySave} disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Edit Product dialog — edits the core fields, the colour/size lists, and the
// images attached to each colour. Uses the existing product server functions
// only (upsert / upload image / delete image); the automatic description
// generation keeps running exactly as before (it is triggered by the same
// image-upload path and by the existing freshness sweep).
// ---------------------------------------------------------------------------

type EditColor = {
  id?: string;
  /** Stable local key: pending (unsaved) images are grouped by this, so a
   *  rename never loses the images attached to the group. */
  gkey: string;
  label: string;
  hex: string | null;
  /** Exactly ONE size per row. */
  size: string;
  quantity: string;
};

let editGroupSeq = 0;
const nextGroupKey = () => `g${++editGroupSeq}`;

function EditProductDialog({
  product, onOpenChange, onSaved,
}: {
  product: WebsiteProductDTO | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");

  const [price, setPrice] = useState("");
  const [colors, setColors] = useState<EditColor[]>([]);
  
  // New images picked in this session, keyed by colour group key ("" = general).
  const [pending, setPending] = useState<Record<string, File[]>>({});
  /** Saved images manually moved to a colour in this editing session. */
  const [savedAssign, setSavedAssign] = useState<Record<string, string>>({});
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);


  const colorsRef = useRef<EditColor[]>(colors);
  colorsRef.current = colors;
  const pendingRef = useRef<Record<string, File[]>>(pending);
  pendingRef.current = pending;

  // Load the product into the form when it changes (no effect needed: the
  // dialog is keyed by the product id we last hydrated from).
  if (product && loadedId !== product.id) {
    setLoadedId(product.id);
    setName(product.name);
    setDescription(product.description ?? "");
    setMaterial(product.material ?? "");

    setPrice(product.price != null ? String(product.price) : "");
    // One row per (colour, size) pair — a colour with three sizes becomes three
    // independent rows, each with its own quantity.
    setColors(
      product.colors.flatMap((c) => {
        const vs = product.variants.filter(
          (v) => (v.color ?? "").toLowerCase() === c.label.toLowerCase(),
        );
        const base = { id: c.id, label: c.label, hex: c.hex, gkey: nextGroupKey() };
        if (vs.length === 0) {
          return [{ ...base, size: "", quantity: "" }];
        }
        return vs.map((v) => ({
          ...base,
          gkey: base.gkey,
          size: v.size ?? "",
          quantity: v.quantity != null ? String(v.quantity) : "",
        }));
      }),
    );
    setPending({});
    setSavedAssign({});

  }

  const delImg = useMutation({
    mutationFn: (imageId: string) => deleteProductImage({ data: { imageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-products"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حذف الصورة."),
  });



  const save = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const cleanColors = colors.filter((c) => c.label.trim());
      // Material, price and quantity stay mandatory when editing too.
      const materialValue = requireMaterial(material);
      const priceValue = requirePrice(price);
      requireVariantRows(cleanColors.length);

      const allSizes = Array.from(
        new Set(cleanColors.map((c) => c.size.trim()).filter(Boolean)),
      );
      const variants: { color: string | null; size: string | null; quantity: number | null }[] = [];
      for (const c of cleanColors) {
        const label = c.label.trim();
        const qty = requireQuantity(c.quantity, label);
        const size = requireSize(c.size, label);
        variants.push({ color: label, size, quantity: qty });
      }
      const labelByKeyAll = new Map(colors.map((c) => [c.gkey, c.label.trim()] as const));
      const res = await upsertWebsiteProduct({
        data: {
          id: product.id,
          name: name.trim(),
          description: description.trim() || null,
          material: materialValue,

          price: priceValue,

          currency: product.currency,
          sizes: allSizes.map((label) => ({ label })),
          colors: cleanColors.map((c) => ({ label: c.label.trim(), hex: c.hex })),
          variants,
          // Persist any saved-image colour assignments made in this editor.
          imageColorAssignments: Object.entries(savedAssign)
            .map(([imageId, gkey]) => ({ imageId, colorLabel: labelByKeyAll.get(gkey) ?? "" }))
            .filter((a) => a.colorLabel),
        },
      });
      const idByLabel = new Map((res.colors ?? []).map((c) => [c.label.toLowerCase(), c.id] as const));
      const labelByKey = labelByKeyAll;
      for (const [gkey, files] of Object.entries(pending)) {
        const label = gkey === "" ? "" : (labelByKey.get(gkey) ?? "");
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("productId", product.id);
          const cid = label ? idByLabel.get(label.toLowerCase()) : null;
          if (cid) fd.append("colorId", cid);
          await uploadProductImage({ data: fd });
        }
      }
    },
    onSuccess: () => { setLoadedId(null); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حفظ التعديلات."),
  });

  if (!product) return null;

  function addColorRow() {
    setColors((rows) => [...rows, { gkey: nextGroupKey(), label: "", hex: null, size: "", quantity: "" }]);
  }
  function addSizeRow(group: EditColor) {
    setColors((rows) => {
      const last = rows.map((row) => row.gkey).lastIndexOf(group.gkey);
      const next = [...rows];
      next.splice(last + 1, 0, { ...group, size: "", quantity: "" });
      return next;
    });
  }

  /** Delete a colour group; its unsaved images fall back to the general area. */
  function removeColorGroup(i: number) {
    const gkey = colorsRef.current[i]?.gkey;
    setColors((rows) => rows.filter((_, j) => j !== i));
    if (!gkey) return;
    if (colorsRef.current.some((row, j) => j !== i && row.gkey === gkey)) return;
    setSavedAssign((prev) => {
      const out = { ...prev };
      for (const [imgId, k] of Object.entries(out)) if (k === gkey) delete out[imgId];
      return out;
    });
    setPending((prev) => {
      const out: Record<string, File[]> = { ...prev, "": [...(prev[""] ?? []), ...(prev[gkey] ?? [])] };
      delete out[gkey];
      return out;

    });

  }

  function removeGroup(gkey: string) {
    setColors((rows) => rows.filter((row) => row.gkey !== gkey));
    setSavedAssign((prev) => {
      const next = { ...prev };
      for (const [id, key] of Object.entries(next)) if (key === gkey) delete next[id];
      return next;
    });
    setPending((prev) => {
      const next: Record<string, File[]> = { ...prev, "": [...(prev[""] ?? []), ...(prev[gkey] ?? [])] };
      delete next[gkey];
      return next;
    });
  }

  /** Move one unsaved image between the general area and a named colour. */
  function moveFile(fromKey: string, index: number, toKey: string) {
    const file = (pendingRef.current[fromKey] ?? [])[index];
    if (!file) return;
    const target = toKey;
    if (target === fromKey) return;
    setPending((prev) => ({
      ...prev,
      [fromKey]: (prev[fromKey] ?? []).filter((_, i) => i !== index),
      [target]: [...(prev[target] ?? []), file],
    }));
  }

  /** Add selected product images to the unassigned image area. */
  function addIntakeFiles(list: FileList | null) {
    const picked = Array.from(list ?? []).filter((f) => /^image\//i.test(f.type));
    if (picked.length === 0) return;
    setPending((prev) => ({ ...prev, "": [...(prev[""] ?? []), ...picked] }));
  }



  /** Group picker rendered under each unsaved thumbnail. */
  function GroupPicker({ fromKey, index }: { fromKey: string; index: number }) {
    return (
      <ColorChips
        options={colorOptions(colors)}
        value={colors.some((c) => c.gkey === fromKey && c.label.trim()) ? fromKey : ""}
        onPick={(k) => moveFile(fromKey, index, k)}
      />
    );
  }

  function SavedImageColorPicker({ imageId, value = "" }: { imageId: string; value?: string }) {
    return (
      <ColorChips
        options={colorOptions(colors)}
        value={savedAssign[imageId] ?? value}
        onPick={(k) => setSavedAssign((prev) => ({ ...prev, [imageId]: k }))}
      />
    );
  }

  const bad = showErrors ? missingRequiredFields({ name, material, price, rows: colors }) : new Set<string>();
  const err = (k: string) => (bad.has(k) ? "border-destructive ring-1 ring-destructive" : "");

  function trySave() {
    const missing = missingRequiredFields({ name, material, price, rows: colors });
    if (missing.size > 0) {
      setShowErrors(true);
      toast.error("أكمل الخانات المحددة باللون الأحمر.");
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) { setLoadedId(null); setShowErrors(false); } onOpenChange(v); }}>
      <DialogContent dir="rtl" className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل المنتج</DialogTitle>
          <DialogDescription>
            ارفع الصور واربط كل صورة بلونها بضغطة، ثم عدّل البيانات والمقاسات.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 border-b border-border pb-4">
            <span className="text-sm font-semibold">١. صور المنتج</span>
            <UploadZone onFiles={addIntakeFiles} />
            <div className="flex flex-wrap gap-3">
              {product.images.map((img) => {
                const linkedColor = colors.find((c) => c.id === img.color_id);
                return (
                <div key={img.id} className="w-28 rounded-lg border border-border/60 p-1.5">
                  <div className="relative">
                    <img src={img.url} alt="" className="h-24 w-full rounded-md object-cover" />
                    <button type="button" aria-label="حذف الصورة"
                      onClick={() => delImg.mutate(img.id)}
                      className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <SavedImageColorPicker imageId={img.id} value={linkedColor?.gkey ?? ""} />
                </div>
                );
              })}
              {Object.entries(pending).flatMap(([fromKey, files]) => files.map((f, k) => (
                  <div key={`pg-${fromKey}-${k}`} className="w-28 rounded-lg border border-dashed border-primary/50 p-1.5">
                    <div className="relative">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-24 w-full rounded-md object-cover" />
                      <button type="button" aria-label="إزالة"
                        onClick={() => setPending((prev) => ({ ...prev, [fromKey]: (prev[fromKey] ?? []).filter((_, j) => j !== k) }))}
                        className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <GroupPicker fromKey={fromKey} index={k} />
                  </div>
              )))}
            </div>
          </div>

          <div className="space-y-3 border-b border-border pb-4">
            <h4 className="text-sm font-semibold">٢. بيانات المنتج</h4>
            <div className="space-y-1.5"><label className="text-xs font-medium">اسم المنتج</label><Input className={err("name")} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium">الوصف</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><label className="text-xs font-medium">الخامة</label><Input className={err("material")} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="مثال: قطن ١٠٠٪" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">السعر</label><Input className={err("price")} type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className={`text-sm font-semibold ${bad.has("rows") ? "text-destructive" : ""}`}>٣. الألوان والمقاسات والكميات</h4><Button size="sm" variant="outline" type="button" onClick={addColorRow}><Plus className="ml-1 h-3.5 w-3.5" /> إضافة لون</Button></div>
            {Array.from(new Map(colors.map((c) => [c.gkey, c] as const)).values()).map((group) => {
              const gi = colors.findIndex((c) => c.gkey === group.gkey);
              return (
              <div key={group.gkey} className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-end gap-2"><label className="min-w-0 flex-1 space-y-1 text-xs font-medium">اللون<Input className={err(`label-${gi}`)} value={group.label} placeholder="مثال: أحمر" onChange={(e) => setColors((rows) => rows.map((r) => r.gkey === group.gkey ? { ...r, label: e.target.value } : r))} /></label><Button size="icon" variant="ghost" type="button" aria-label="حذف اللون" onClick={() => removeGroup(group.gkey)}><Trash2 className="h-4 w-4" /></Button></div>
                {colors.map((c, i) => c.gkey === group.gkey && <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                  <label className="min-w-0 space-y-1 text-xs text-muted-foreground">المقاس<Input className={err(`size-${i}`)} value={c.size} placeholder="مثال: L" onChange={(e) => setColors((rows) => rows.map((r, j) => j === i ? { ...r, size: e.target.value } : r))} /></label>
                  <label className="min-w-0 space-y-1 text-xs text-muted-foreground">الكمية<Input className={err(`qty-${i}`)} type="number" min={0} placeholder="0" value={c.quantity} onChange={(e) => setColors((rows) => rows.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} /></label>
                  <Button size="icon" variant="ghost" type="button" aria-label="حذف المقاس" disabled={colors.filter((r) => r.gkey === group.gkey).length === 1} onClick={() => removeColorGroup(i)}><X className="h-4 w-4" /></Button>
                </div>)}
                <Button size="sm" variant="ghost" type="button" onClick={() => addSizeRow(group)}><Plus className="ml-1 h-3.5 w-3.5" /> إضافة مقاس</Button>
              </div>
              );
            })}
          </div>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={trySave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

