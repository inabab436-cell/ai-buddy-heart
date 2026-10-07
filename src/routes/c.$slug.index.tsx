import { LinkifyText, contactHref } from "@/components/linkify-text";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShoppingBag, ShoppingCart, X, Send, Info, Truck, PhoneCall, ScrollText, MessageSquare, UserCircle2, Flame, Tag, ShieldCheck, Phone, ChevronLeft } from "lucide-react";
import { bestOfferPlan, type OfferPlan } from "@/lib/product-offer-badge";
import {
  validateAddress,
  validateCustomerName,
  validateEgyptianPhone,
} from "@/lib/order-input-validation";


/** Below this many pieces the card switches to a scarcity line. */
const LOW_STOCK_THRESHOLD = 5;

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CartProvider, useCart } from "@/lib/cart";
import { useCustomerSession } from "@/components/customer/customer-login";
import { getStorefront, createStorefrontOrder, checkStorefrontStock, quoteStorefrontCart, type StorefrontData, type StorefrontAppliedOffer } from "@/lib/storefront.functions";
import { saveCustomerDraft, clearCustomerDraft } from "@/lib/customer-orders.functions";
import { THEMES } from "@/components/website/identity-section";
import { t, storeDir, useStoreLang, StoreLangToggle } from "@/lib/store-i18n";

export const Route = createFileRoute("/c/$slug/")({
  head: ({ params }) => {
    const name = prettifySlug(params.slug);
    return {
      meta: [
        { title: `${name} — Online store` },
        { name: "description", content: `Browse products from ${name} and place your order online.` },
        { property: "og:title", content: `${name} — Online store` },
        { property: "og:description", content: `Browse products from ${name} and place your order online.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: BrandPageShell,
});

function prettifySlug(slug: string) {
  return slug.split("-").filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ") || "Brand";
}

function BrandPageShell() {
  const { slug } = Route.useParams();
  return (
    <CartProvider slug={slug}>
      <BrandPage slug={slug} />
    </CartProvider>
  );
}

function BrandPage({ slug }: { slug: string }) {
  const lang = useStoreLang();
  return <BrandPageInner key={lang} slug={slug} />;
}

/**
 * Debounced persistence of the local cart into the customer's server-side
 * draft (order_drafts). Only runs for a signed-in customer.
 */
function useDraftSync(cart: ReturnType<typeof useCart>, loggedIn: boolean) {
  const saveDraft = useServerFn(saveCustomerDraft);
  const clearDraft = useServerFn(clearCustomerDraft);
  const lines = cart.lines;

  useEffect(() => {
    if (!loggedIn) return;
    const t = setTimeout(() => {
      if (lines.length === 0) {
        void clearDraft().catch(() => {});
        return;
      }
      void saveDraft({
        data: {
          items: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            price: l.price,
            currency: l.currency,
            quantity: l.quantity,
            image: l.image ?? null,
            color: l.color ?? null,
            size: l.size ?? null,
          })),
        },
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [loggedIn, lines, saveDraft, clearDraft]);
}

function BrandPageInner({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["storefront", slug],
    queryFn: () => getStorefront({ data: { slug } }),
  });
  const [openDetail, setOpenDetail] = useState<{ kind: "policy" | "contact" | "shipping"; id: string } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const cart = useCart();
  const session = useCustomerSession({ merchantId: q.data?.merchantId ?? null });

  // Keep an "incomplete order" draft in sync for the signed-in customer so it
  // shows up in their account page with a "resume" button.
  useDraftSync(cart, Boolean(session.data?.loggedIn));

  const brandName = q.data?.brandName || prettifySlug(slug);

  if (q.isLoading) {
    return (
      <div dir={storeDir()} className="store grid min-h-screen place-items-center">
        <span className="store-display animate-pulse text-5xl">{brandName}</span>
      </div>
    );
  }
  const store: StorefrontData | undefined = q.data;
  if (store?.restricted) {
    return (
      <div dir={storeDir()} className="store grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="store-display text-3xl">{store.brandName ?? slug}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("المتجر غير متاح مؤقتاً. يرجى المحاولة لاحقاً.")}</p>
        </div>
      </div>
    );
  }
  if (!store || !store.found) {
    return (
      <div dir={storeDir()} className="store grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="store-display text-[120px]">404</p>
          <h1 className="store-label mt-2">{t("المتجر غير موجود")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("لا يوجد متجر على الرابط")} /c/{slug}</p>
        </div>
      </div>
    );
  }

  const theme = THEMES[(store.themeKey ?? "").toLowerCase()] ?? THEMES.espresso;
  const categories = Array.from(new Set(store.products.map((p) => p.category).filter((c): c is string => !!c)));
  const shown = category ? store.products.filter((p) => p.category === category) : store.products;
  const heroImg = store.products.find((p) => p.images[0])?.images[0] ?? null;
  const onSale = store.products.some((p) => (p.offers ?? []).length > 0);

  return (
    <div dir={storeDir()} className="store min-h-screen">
      {/* Announcement bar */}
      <div className="overflow-hidden bg-primary py-2 text-primary-foreground">
        <div className="store-marquee flex w-max gap-12 whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="store-label">
              {onSale ? t("عروض لفترة محدودة · ") : ""}{t("شحن لكل المحافظات · الدفع بالطريقة التي تناسبك")}
            </span>
          ))}
        </div>
      </div>

      <Link
        to="/chat/$slug" params={{ slug }} search={{ mode: "continue" }}
        aria-label={t("تواصل معنا")}
        className="store-chat-fab"
      >
        <span className="store-chat-fab-ring" aria-hidden />
        <MessageSquare className="relative h-6 w-6" strokeWidth={1.75} />
      </Link>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-8">
          <nav className="hidden items-center gap-6 sm:flex">
            <button onClick={() => setCategory(null)} className="store-label hover:underline underline-offset-8">{t("الكل")}</button>
            {categories.slice(0, 3).map((c) => (
              <button key={c} onClick={() => setCategory(c)} className="store-label hover:underline underline-offset-8">{c}</button>
            ))}
          </nav>
          <div className="sm:hidden" />
          <Link to="/c/$slug" params={{ slug }} className="flex items-center justify-center gap-2">
            {store.logoUrl && <img src={store.logoUrl} alt="" className="h-8 w-8 object-cover" />}
            <span className="store-display truncate text-3xl sm:text-4xl">{brandName}</span>
          </Link>
          <div className="flex items-center justify-end gap-1">
            <StoreLangToggle />
            <Link
              to="/c/$slug/track" params={{ slug }}
              className="store-label inline-flex h-10 items-center border-b border-foreground/30 pb-0.5 transition hover:border-foreground"
            >
              {t("تتبع طلبي")}
            </Link>
            <button
              onClick={() => { void q.refetch(); setCartOpen(true); }}
              aria-label={t("السلة")}
              className="relative grid h-10 w-10 place-items-center hover:bg-muted"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {cart.count > 0 && (
                <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-secondary">
        <div className="mx-auto grid min-h-[70vh] w-full max-w-7xl items-end px-4 pb-12 pt-24 sm:px-8">
          {heroImg && (
            <img src={heroImg} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          )}
          {heroImg && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />}
          <div className={heroImg ? "text-primary-foreground" : ""}>
            <p className="store-label">{t("المجموعة الجديدة")}</p>
            <h2 className="store-display mt-3 max-w-4xl text-7xl sm:text-9xl">{brandName}</h2>
            {store.brandDescription && (
              <p className="mt-4 max-w-xl text-base opacity-90">{store.brandDescription}</p>
            )}
            <a
              href="#shop"
              className={`store-label mt-8 inline-flex h-12 items-center px-10 transition ${heroImg ? "bg-background text-foreground hover:bg-background/85" : "bg-primary text-primary-foreground hover:bg-primary/85"}`}
            >
              {t("تسوّق الآن")}
            </a>
          </div>
        </div>
      </section>

      <main id="shop" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-14 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <h2 className="store-display text-5xl sm:text-6xl">{category ?? t("كل المنتجات")}</h2>
          <span className="store-label text-muted-foreground">{shown.length} {t("قطعة")}</span>
        </div>
        {categories.length > 0 && (
          <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "all"}
                onClick={() => setCategory(c)}
                className={`store-label shrink-0 border px-4 py-2 transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
              >
                {c ?? t("الكل")}
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 ? (
          <div className="border border-dashed border-border py-24 text-center">
            <p className="store-display text-4xl">{t("قريباً")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("لا توجد منتجات منشورة بعد.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>

      {/* Service strip */}
      <section className="border-y border-border">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          {[
            { Icon: Truck, t: t("شحن سريع"), d: t("لكل المحافظات") },
            { Icon: ShieldCheck, t: t("دفع آمن"), d: t("بالطريقة التي تناسبك") },
            { Icon: MessageSquare, t: t("خدمة العملاء"), d: t("نرد عليك في أسرع وقت") },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="flex items-center gap-4 px-6 py-6">
              <Icon className="h-6 w-6 shrink-0" strokeWidth={1.25} />
              <div>
                <div className="store-label">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {openDetail && (
        <DetailModal store={store} selection={openDetail} onClose={() => setOpenDetail(null)} />
      )}
      {cartOpen && (
        <CartDrawer slug={slug} onClose={() => setCartOpen(false)} theme={theme} merchantId={store.merchantId ?? null} brandName={brandName} store={store} />
      )}

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 md:grid-cols-3 sm:px-8">
          <div>
            <p className="store-display text-5xl">{brandName}</p>
            {store.brandDescription && <p className="mt-3 max-w-xs text-sm opacity-70">{store.brandDescription}</p>}
          </div>
          <FooterList kind="shipping" title={t("الشحن")} items={store.shipping.map((s) => ({ id: s.id, label: [s.country, s.region].filter(Boolean).join(" / ") || t("الشحن") }))} onOpen={(id) => setOpenDetail({ kind: "shipping", id })} />
          <FooterList kind="contact" title={t("تواصل معنا")} items={store.contacts.map((c) => ({ id: c.id, label: c.label || c.value }))} onOpen={(id) => setOpenDetail({ kind: "contact", id })} />
        </div>
        <div className="border-t border-primary-foreground/15 py-5 text-center">
          <span className="store-label opacity-60">© {new Date().getFullYear()} {brandName}</span>
        </div>
      </footer>
    </div>
  );
}

function FooterList({ kind, title, items, onOpen }: { kind: "shipping" | "contact"; title: string; items: { id: string; label: string }[]; onOpen: (id: string) => void }) {
  if (items.length === 0) return <div />;
  const Icon = kind === "shipping" ? Truck : Phone;
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/10">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <p className="store-label">{title}</p>
      </div>
      <ul className="mt-4 overflow-hidden rounded-xl border border-primary-foreground/15 divide-y divide-primary-foreground/10">
        {items.map((it) => (
          <li key={it.id}>
            <button
              onClick={() => onOpen(it.id)}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-primary-foreground/10 focus-visible:bg-primary-foreground/10 focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              <ChevronLeft className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function groupBy<T, K extends string>(items: T[], k: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const it of items) {
    const key = k(it);
    (out[key] ||= []).push(it);
  }
  return out;
}

interface VariantLike { color: string | null; size: string | null; stock?: number | null; price?: number | null }

function variantKey(color: string | null, size: string | null) {
  return `${color ?? ""}|${size ?? ""}`;
}

/**
 * The offer, shown UNDER the product itself (not only in the cart): the saving
 * the customer gets now, or the exact quantity that unlocks it — one tap away.
 * Numbers are previews; the order is priced again on the server.
 */
function ProductOfferBox({
  plan, currency, quantity, onPickQty,
}: {
  plan: OfferPlan;
  currency: string;
  quantity: number;
  onPickQty: (n: number) => void;
}) {
  const o = plan.offer;
  const show = (k: string) => (o.display_fields ?? []).includes(k);
  const nearMiss = !plan.qualifies && plan.reachable && plan.discountAtUnits > 0;
  return (
    <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-destructive">
        <Tag className="h-3.5 w-3.5" />
        <span>{show("title") && o.title ? o.title : plan.badge}</span>
      </div>
      {plan.qualifies && plan.discountNow > 0 && (
        <div className="text-foreground">
          {t("وفّرت")} {plan.discountNow} {currency} {t("على")} {quantity} {quantity === 1 ? t("قطعة") : t("قطع")} — {t("الإجمالي")} {plan.totalNow} {currency}
        </div>
      )}
      {nearMiss && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {t("اشترِ")} {plan.unitsNeeded} {plan.unitsNeeded === 1 ? t("قطعة") : t("قطع")} ({plan.subtotalAtUnits} {currency}) {t("وتوفّر")} {plan.discountAtUnits} {currency} — {t("الإجمالي")} {plan.totalAtUnits} {currency}
          </span>
          <button
            type="button"
            onClick={() => onPickQty(plan.unitsNeeded)}
            className="rounded-full bg-destructive px-2 py-0.5 font-semibold text-destructive-foreground"
          >
            {t("اجعلها")} {plan.unitsNeeded}
          </button>
        </div>
      )}
      {show("countdown") && o.ends_at && (
        <div className="flex justify-between gap-2 text-muted-foreground">
          <span>{t("ينتهي خلال")}</span><OfferCountdown endsAt={o.ends_at} />
        </div>
      )}
      {show("remaining") && o.remaining != null && (
        <div className="flex justify-between gap-2 text-muted-foreground">
          <span>{t("المتبقي من العرض")}</span><span>{o.remaining}</span>
        </div>
      )}
      {show("usage_type") && (
        <div className="flex justify-between gap-2 text-muted-foreground">
          <span>{t("نوع الاستخدام")}</span>
          <span>{o.usage_limit_type === "once_per_customer" ? t("مرة واحدة لكل عميل") : t("على كل أوردر")}</span>
        </div>
      )}
      {show("min_order_total") && o.min_order_total != null && (
        <div className="flex justify-between gap-2 text-muted-foreground">
          <span>{t("الحد الأدنى للطلب")}</span><span>{o.min_order_total} {currency}</span>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: StorefrontData["products"][number] }) {
  const cart = useCart();
  const variants: VariantLike[] = Array.isArray(product.variants) ? product.variants : [];
  // Stock is only meaningful when the merchant tracks it for this product.
  const anyStockInfo = variants.some((v) => v && typeof v.stock === "number");
  const inStock = variants.filter((v) => !anyStockInfo || (typeof v?.stock === "number" && (v.stock ?? 0) > 0));
  const availableColors = Array.from(new Set(inStock.map((v) => v?.color).filter((c): c is string => !!c)));
  const [color, setColor] = useState<string | null>(availableColors[0] ?? null);
  const sizesForColor = Array.from(new Set(
    inStock
      .filter((v) => (color ? v.color === color : true))
      .map((v) => v?.size)
      .filter((s): s is string => !!s),
  ));
  const [size, setSize] = useState<string | null>(sizesForColor[0] ?? null);
  const sizeIsValid = size && sizesForColor.includes(size);
  const effectiveSize = sizeIsValid ? size : (sizesForColor[0] ?? null);

  // Real availability for the exact selected variant (color + size).
  const stockByVariant = new Map<string, number>();
  for (const v of variants) {
    if (!v) continue;
    if (typeof v.stock !== "number") continue;
    const k = variantKey(v.color ?? null, v.size ?? null);
    stockByVariant.set(k, (stockByVariant.get(k) ?? 0) + Math.max(v.stock, 0));
  }
  const selectedStock = anyStockInfo
    ? (stockByVariant.get(variantKey(color, effectiveSize)) ?? 0)
    : null;
  const selectedVariant = variants.find(
    (v) => (v?.color ?? null) === color && (v?.size ?? null) === effectiveSize,
  );
  const unitPrice =
    typeof selectedVariant?.price === "number" ? selectedVariant.price : product.price;

  const [qty, setQty] = useState(1);
  const maxQty = selectedStock == null ? 99 : Math.max(selectedStock, 0);
  const clampedQty = Math.min(Math.max(qty, 1), Math.max(maxQty, 1));

  const colorImgs = (color && product.colorImages?.[color]) || [];
  const gallery = Array.from(new Set([...colorImgs, ...product.images]));
  const img = gallery[0];
  const [open, setOpen] = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const shownImg = activeImg && gallery.includes(activeImg) ? activeImg : img;
  const pickColor = (c: string) => { setColor(c); setQty(1); setActiveImg(product.colorImages?.[c]?.[0] ?? null); };
  const outOfStock = anyStockInfo && (inStock.length === 0 || (selectedStock ?? 0) <= 0);
  const alreadyInCart = cart.lines.some(
    (l) =>
      l.productId === product.id &&
      (l.color ?? null) === (color ?? null) &&
      (l.size ?? null) === (effectiveSize ?? null),
  );

  // Offer shown ON the card (display only — the real price comes from the server).
  const plan = bestOfferPlan(product.offers ?? [], {
    unitPrice: Number(unitPrice ?? 0),
    quantity: clampedQty,
    stock: selectedStock,
    currency: product.currency,
  });
  const cur = product.currency ?? "";
  const showLow = selectedStock != null && selectedStock > 0 && selectedStock <= LOW_STOCK_THRESHOLD;
  const addToCart = () => {
    if (alreadyInCart) { toast.info(t("تمت الإضافة بالفعل")); return; }
    cart.add({
      productId: product.id, name: product.name,
      price: unitPrice, currency: product.currency, image: img ?? null,
      color, size: effectiveSize, quantity: clampedQty,
    });
    showAddedToast(product.name, img ?? null);
  };
  const img2 = gallery[1];
  const sale = Boolean(plan?.qualifies && plan.discountNow > 0);
  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[3/4] w-full cursor-pointer overflow-hidden bg-secondary" onClick={() => setOpen(true)}>
        {img ? (
          <>
            <img src={img} alt={product.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            {img2 && (
              <img src={img2} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 group-hover:opacity-100" />
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col items-start gap-1">
          {plan && (
            <span className="store-label bg-destructive px-2 py-1 text-destructive-foreground">{plan.badge}</span>
          )}
          {showLow && (
            <span className="store-label bg-background px-2 py-1 text-foreground">{t("آخر")} {selectedStock} {t("قطع")}</span>
          )}
        </div>
        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <span className="store-label bg-background px-3 py-1.5">{t("نفدت الكمية")}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-3">
        {product.category && <span className="store-label truncate text-[10px] text-muted-foreground">{product.category}</span>}
        <button type="button" onClick={() => setOpen(true)} className="line-clamp-2 min-h-[2.5rem] text-right text-sm font-medium leading-5 hover:underline underline-offset-4">{product.name}</button>
        {unitPrice != null && (
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className={`font-semibold ${sale ? "text-destructive" : ""}`}>
              {sale ? plan!.unitPriceNow : unitPrice} {cur}
            </span>
            {sale && <span className="text-xs text-muted-foreground line-through">{unitPrice} {cur}</span>}
          </div>
        )}

        {availableColors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableColors.map((c) => (
              <ColorSwatch key={c} label={c} image={product.colorImages?.[c]?.[0] ?? null} active={color === c} onClick={() => pickColor(c)} small />
            ))}
          </div>
        )}
        {sizesForColor.length > 0 && (
          <div className="grid grid-cols-4 gap-1">
            {sizesForColor.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSize(s); setQty(1); }}
                className={`h-8 min-w-0 truncate border px-1 text-[11px] font-semibold transition ${effectiveSize === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {plan && (
          <ProductOfferBox plan={plan} currency={cur} quantity={clampedQty} onPickQty={(n) => setQty(n)} />
        )}
        {selectedStock != null && showLow && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
            <Flame className="h-3 w-3" /> {t("متبقي")} {selectedStock} {selectedStock === 1 ? t("قطعة") : t("قطع")} {t("فقط")}
          </div>
        )}

        {!outOfStock && (
          <div className="mt-auto pt-1">
            <button
              type="button"
              disabled={alreadyInCart}
              onClick={addToCart}
              className="store-label h-10 w-full bg-primary text-primary-foreground transition hover:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground"
            >
              {alreadyInCart ? t("في السلة ✓") : t("شراء الآن")}
            </button>
          </div>
        )}
      </div>
      {open && (
        <div className="store fixed inset-0 z-50 flex bg-foreground/40 backdrop-blur-sm" dir={storeDir()} onClick={() => setOpen(false)}>
          <div className="mr-auto flex h-full w-full max-w-lg flex-col overflow-y-auto bg-background shadow-2xl animate-in slide-in-from-left duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="store-label">{t("تفاصيل المنتج")}</span>
              <button onClick={() => setOpen(false)} aria-label={t("إغلاق")} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="relative mx-auto aspect-square max-h-[55vh] w-full bg-secondary">
              {shownImg ? <img src={shownImg} alt={product.name} className="absolute inset-0 h-full w-full object-contain" /> : (
                <div className="grid h-full place-items-center"><ShoppingBag className="h-10 w-10 text-muted-foreground" strokeWidth={1} /></div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-5 pt-3">
                {gallery.map((g) => (
                  <button key={g} type="button" onClick={() => setActiveImg(g)} className={`h-16 w-16 shrink-0 overflow-hidden border-2 transition ${shownImg === g ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    <img src={g} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-5 px-5 pb-8 pt-5">
              <div className="flex flex-col gap-2 border-b border-border pb-5">
                {product.category && <span className="store-label text-[11px] text-muted-foreground">{product.category}</span>}
                <h2 className="text-xl font-semibold leading-snug sm:text-2xl">{product.name}</h2>
                {unitPrice != null && (
                  <div className="flex items-baseline gap-2">
                    <span className={`text-lg font-semibold ${sale ? "text-destructive" : ""}`}>{sale ? plan!.unitPriceNow : unitPrice} {cur}</span>
                    {sale && <span className="text-sm text-muted-foreground line-through">{unitPrice} {cur}</span>}
                  </div>
                )}
              </div>
              {product.description && <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground"><LinkifyText text={product.description} /></p>}
              {availableColors.length > 0 && (
                <div>
                  <p className="store-label mb-2">{t("اللون:")} <span className="text-muted-foreground">{color}</span></p>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((c) => (
                      <ColorSwatch key={c} label={c} image={product.colorImages?.[c]?.[0] ?? null} active={color === c} onClick={() => pickColor(c)} />
                    ))}
                  </div>
                </div>
              )}
              {sizesForColor.length > 0 && (
                <div>
                  <p className="store-label mb-2">{t("المقاس")}</p>
                  <div className="flex flex-wrap gap-2">
                    {sizesForColor.map((s) => (
                      <button key={s} type="button" onClick={() => { setSize(s); setQty(1); }}
                        className={`grid h-10 min-w-10 place-items-center border px-2 text-xs font-semibold transition ${effectiveSize === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {plan && <ProductOfferBox plan={plan} currency={cur} quantity={clampedQty} onPickQty={(n) => setQty(n)} />}
              {outOfStock ? (
                <span className="store-label bg-muted px-3 py-3 text-center">{t("نفدت الكمية")}</span>
              ) : (
                <div className="flex items-stretch gap-2">
                  <div className="flex h-12 items-center border border-border">
                    <button type="button" aria-label={t("زيادة")} className="h-full w-10 hover:bg-muted" onClick={() => setQty(Math.min(clampedQty + 1, maxQty))}>+</button>
                    <span className="w-8 text-center">{clampedQty}</span>
                    <button type="button" aria-label={t("نقص")} className="h-full w-10 hover:bg-muted" onClick={() => setQty(Math.max(clampedQty - 1, 1))}>−</button>
                  </div>
                  <button type="button" disabled={alreadyInCart} onClick={addToCart}
                    className="store-label h-12 flex-1 bg-primary text-primary-foreground transition hover:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground">
                    {alreadyInCart ? t("في السلة ✓") : t("شراء الآن")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ColorSwatch({ label, image, active, onClick, small }: { label: string; image: string | null; active: boolean; onClick: () => void; small?: boolean }) {
  if (!image) {
    return (
      <button type="button" onClick={onClick}
        className={`border px-2 py-0.5 transition ${small ? "text-[11px]" : "h-10 px-3 text-xs"} ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
        {label}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`overflow-hidden border-2 transition ${small ? "h-9 w-7" : "h-16 w-12"} ${active ? "border-primary" : "border-border opacity-80 hover:opacity-100"}`}>
      <img src={image} alt={label} className="h-full w-full object-cover" />
    </button>
  );
}

function showAddedToast(name: string, image: string | null) {
  toast.custom(() => (
    <div dir={storeDir()} className="store flex w-[340px] items-center gap-3 border border-border bg-background p-3 text-foreground shadow-2xl">
      {image ? <img src={image} alt="" className="h-14 w-11 shrink-0 object-cover" /> : <ShoppingBag className="h-6 w-6 shrink-0" strokeWidth={1.5} />}
      <div className="min-w-0 flex-1">
        <p className="store-label">{t("تمت الإضافة للسلة ✓")}</p>
        <p className="truncate text-xs text-muted-foreground">{name}</p>
      </div>
    </div>
  ), { duration: 2500 });
}


function DetailModal({
  store, selection, onClose,
}: {
  store: StorefrontData;
  selection: { kind: "policy" | "contact" | "shipping"; id: string };
  onClose: () => void;
}) {
  const item = useMemo(() => {
    if (selection.kind === "policy") return store.policies.find((p) => p.id === selection.id);
    if (selection.kind === "contact") return store.contacts.find((c) => c.id === selection.id);
    return store.shipping.find((s) => s.id === selection.id);
  }, [store, selection]);
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-background p-6 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {selection.kind === "policy" && (item as any).title}
            {selection.kind === "contact" && ((item as any).label || (item as any).kind)}
            {selection.kind === "shipping" && [(item as any).country, (item as any).region].filter(Boolean).join(" / ")}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {selection.kind === "policy" && (
          <p className="whitespace-pre-wrap text-sm"><LinkifyText text={(item as any).content} /></p>
        )}
        {selection.kind === "contact" && (() => {
          const href = contactHref((item as any).kind, (item as any).value);
          return (
            <p className="text-sm">
              <span className="text-muted-foreground">{(item as any).kind}:</span>{" "}
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="break-all font-medium text-primary underline underline-offset-2">{(item as any).value}</a>
              ) : (
                <span className="font-medium">{(item as any).value}</span>
              )}
            </p>
          );
        })()}
        {selection.kind === "shipping" && (
          <div className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Price: </span>{(item as any).price ?? "—"} {(item as any).currency ?? ""}</div>
            <div><span className="text-muted-foreground">ETA: </span>{(item as any).eta ?? "—"}</div>
            {(item as any).notes && <div className="text-muted-foreground">{(item as any).notes}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

type CheckoutStep = "cart" | "shipping" | "payment" | "summary" | "done";

/**
 * Same persistent visitor id the chat page uses (httpOnly cookie backed, with a
 * localStorage fallback), so a manual-payment order lands in the conversation
 * the customer already has with the agent.
 */
const VISITOR_KEY = (slug: string) => `cupai_visitor_${slug}`;

async function resolveVisitorId(slug: string): Promise<string | null> {
  let local: string | null = null;
  try { local = window.localStorage.getItem(VISITOR_KEY(slug)); } catch { /* ignore */ }
  try {
    const url = local ? `/api/visitor?fallback=${encodeURIComponent(local)}` : "/api/visitor";
    const res = await fetch(url, { method: "GET", credentials: "same-origin" });
    if (res.ok) {
      const j = (await res.json()) as { visitor_id?: string };
      if (j.visitor_id) {
        try { window.localStorage.setItem(VISITOR_KEY(slug), j.visitor_id); } catch { /* ignore */ }
        return j.visitor_id;
      }
    }
  } catch { /* offline is fine */ }
  return local;
}



/** Live countdown to the end of an offer. */
function OfferCountdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Date.parse(endsAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return <span>{t("انتهى العرض")}</span>;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono">
      {d > 0 ? `${d} ${t("يوم")} · ` : ""}{pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}

/**
 * The offer facts the MERCHANT chose to show next to the discount. The price
 * before/after the discount and the discount value are always shown by the
 * totals block; this only adds the optional extras.
 */
function AppliedOffers({ offers, currency }: { offers: StorefrontAppliedOffer[]; currency: string | null }) {
  if (!offers.length) return null;
  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
      {offers.map((o) => {
        const show = (k: string) => (o.display_fields ?? []).includes(k);
        return (
          <div key={o.offer_id} className="space-y-1">
            <div className="flex justify-between gap-2 font-medium">
              <span>{show("title") ? o.title || t("عرض") : t("خصم مطبّق")}</span>
              <span>-{o.discount_amount.toFixed(2)} {currency ?? ""}</span>
            </div>
            {show("countdown") && o.ends_at && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>{t("ينتهي خلال")}</span><OfferCountdown endsAt={o.ends_at} />
              </div>
            )}
            {show("remaining") && o.remaining != null && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>{t("المتبقي من العرض")}</span><span>{o.remaining}</span>
              </div>
            )}
            {show("usage_type") && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>{t("نوع الاستخدام")}</span>
                <span>{o.usage_limit_type === "once_per_customer" ? t("مرة واحدة لكل عميل") : t("على كل أوردر")}</span>
              </div>
            )}
            {show("min_order_total") && o.min_order_total != null && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>{t("الحد الأدنى للطلب")}</span><span>{o.min_order_total} {currency ?? ""}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CartDrawer({
  slug, onClose, theme: _theme, merchantId, brandName, store,
}: {
  slug: string;
  onClose: () => void;
  theme?: any;
  merchantId?: string | null;
  brandName?: string;
  store: StorefrontData;
}) {
  const cart = useCart();
  const [step, setStep] = useState<CheckoutStep>("cart");
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(""); const [notes, setNotes] = useState("");
  // No zone is pre-selected: the shipping price must be added to the total
  // ONLY after the customer picks their own zone — never by list order.
  const [shippingId, setShippingId] = useState<string | null>(null);

  const [paymentName, setPaymentName] = useState<string | null>(store.paymentMethods[0]?.name ?? null);
  const [shortages, setShortages] = useState<Array<Record<string, any>>>([]);
  const [receipt, setReceipt] = useState<{
    orderNumber: string; total: number; currency: string | null; message: string;
    requiresPayment: boolean; paymentMethod: string | null;
    paymentDetails: string | null; amountDue: number | null;
    lines: Array<{ name: string; color: string | null; size: string | null; quantity: number; price: number | null; currency: string | null }>;
    shippingLabel: string | null; shippingPrice: number; subtotal: number;
    discount: number; offers: StorefrontAppliedOffer[];
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const shippingRow = store.shipping.find((s) => s.id === shippingId) ?? null;
  const shippingPrice = Number(shippingRow?.price ?? 0) || 0;
  const quoteFn = useServerFn(quoteStorefrontCart);
  // The discount is NEVER computed in the browser: this is the same server
  // engine the agent uses, and it is re-run authoritatively when the order is
  // created.
  const quoteQuery = useQuery({
    queryKey: [
      "storefront-quote",
      slug,
      shippingId,
      cart.lines.map((l) => `${l.productId}:${l.color ?? ""}:${l.size ?? ""}:${l.quantity}`).join("|"),
    ],
    enabled: cart.lines.length > 0,
    queryFn: () =>
      quoteFn({
        data: {
          slug,
          shipping_rate_id: shippingId,
          items: cart.lines.map((l) => ({
            productId: l.productId, name: l.name, price: l.price,
            currency: l.currency, quantity: l.quantity,
            color: l.color ?? null, size: l.size ?? null,
          })),
        },
      }),
  });
  const quote = quoteQuery.data ?? null;
  const currency = quote?.currency ?? cart.currency ?? shippingRow?.currency ?? null;
  const subtotal = quote?.subtotal ?? cart.total;
  const discount = quote?.discount ?? 0;
  const appliedOffers = quote?.offers ?? [];
  const total = quote?.total ?? subtotal + shippingPrice;

  const mut = useMutation({
    mutationFn: async () => {
      const visitorId = await resolveVisitorId(slug);
      return createStorefrontOrder({
        data: {
          slug,
          items: cart.lines.map((l) => ({
            productId: l.productId, name: l.name, price: l.price,
            currency: l.currency, quantity: l.quantity,
            color: l.color ?? null, size: l.size ?? null,
          })),
          customer_name: name, customer_phone: phone,
          customer_address: address, notes,
          shipping_rate_id: shippingId,
          payment_method: paymentName,
          visitor_id: visitorId,
        },
      });
    },
    onSuccess: (res) => {
      if (res.ok === false) {
        if (res.error === "login_required") {
          toast.error(t("تعذّر إنشاء الأوردر. الرجاء المحاولة مرة أخرى."));
          return;
        }
        // Server rejected on the LATEST stock — nothing was saved.
        setShortages(res.shortages ?? []);
        toast.error(t("الكمية المطلوبة غير متاحة حالياً."));
        return;
      }

      setShortages([]);
      setReceipt({
        orderNumber: res.orderNumber,
        total: res.total,
        currency: res.currency,
        message: res.confirmationMessage,
        requiresPayment: res.requiresPayment,
        paymentMethod: res.paymentMethod,
        paymentDetails: res.paymentDetails ?? null,
        amountDue: res.amountDue ?? null,
        lines: cart.lines.map((l) => ({
          name: l.name, color: l.color ?? null, size: l.size ?? null,
          quantity: l.quantity, price: l.price, currency: l.currency,
        })),
        shippingLabel: shippingRow
          ? [shippingRow.country, shippingRow.region].filter(Boolean).join(" / ") || t("الشحن")
          : null,
        shippingPrice,
        subtotal: res.subtotal,
        discount: res.discount,
        offers: res.offers,
      });
      setShowDetails(false);
      cart.clear();
      setStep("done");
    },
    onError: () => {
      toast.error(t("تعذّر إنشاء الأوردر. الرجاء المحاولة مرة أخرى."));
    },
  });

  /**
   * Availability pre-check, run the moment the customer leaves the cart step.
   * Telling them here that the quantity is not available avoids the old
   * behaviour of filling in every detail only to be rejected at the end.
   */
  const stockCheck = useMutation({
    mutationFn: async () =>
      checkStorefrontStock({
        data: {
          slug,
          items: cart.lines.map((l) => ({
            productId: l.productId, name: l.name, price: l.price,
            currency: l.currency, quantity: l.quantity,
            color: l.color ?? null, size: l.size ?? null,
          })),
        },
      }),
    onSuccess: (res) => {
      if (res.ok === false) {
        setShortages(res.shortages ?? []);
        toast.error(t("الكمية المطلوبة أكبر من المتاح في المخزون."));
        return;
      }
      setShortages([]);
      setStep("shipping");
    },
    onError: () => setStep("shipping"),
  });

  // The same rules the agent must respect: real two-part name, real Egyptian
  // mobile, complete address.
  const nameCheck = validateCustomerName(name);
  const phoneCheck = validateEgyptianPhone(phone);
  const addressCheck = validateAddress(address);
  const nameError = !name.trim() || nameCheck.ok ? null : t("اكتب الاسم ثنائي على الأقل (الاسم واسم الأب) بدون أرقام أو رموز.");
  const phoneError = !phone.trim() || phoneCheck.ok ? null
    : phoneCheck.reason === "too_short" ? t("الرقم ناقص: رقم الموبايل المصري 11 رقم.")
    : phoneCheck.reason === "too_long" ? t("الرقم طويل: رقم الموبايل المصري 11 رقم.")
    : t("رقم غير صحيح: لازم يبدأ بـ 010 أو 011 أو 012 أو 015 ويكون 11 رقم.");
  const addressError = !address.trim() || addressCheck.ok ? null
    : addressCheck.missing.includes("governorate")
      ? t("العنوان ناقص: اكتب المحافظة والمنطقة والشارع.")
      : t("العنوان ناقص: اكتب المنطقة والشارع أو علامة مميزة.");

  const canSubmit = Boolean(
    nameCheck.ok && phoneCheck.ok && addressCheck.ok &&
    (store.shipping.length === 0 || shippingId) &&
    (store.paymentMethods.length === 0 || paymentName),
  );




  return (
    <div className="store fixed inset-0 z-50 flex" onClick={onClose} dir={storeDir()}>
      <div className="flex-1 bg-foreground/50 backdrop-blur-[2px]" />
      <div className="flex h-full w-full max-w-md flex-col bg-background shadow-2xl animate-in slide-in-from-left duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="store-display text-xl">
              {step === "cart" && t("سلة الشراء")}
              {step === "shipping" && t("منطقة الشحن")}
              {step === "payment" && t("طريقة الدفع")}
              {step === "summary" && t("ملخص الأوردر")}
              {step === "done" && (receipt?.requiresPayment ? t("بانتظار إتمام الدفع") : t("تم تأكيد الأوردر"))}
            </h3>
            <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          {step !== "done" && (
            <div className="mt-3 flex items-center">
              {(["cart", "shipping", "payment", "summary"] as const).map((s, i) => (
                <div key={s} className={`flex items-center ${i < 3 ? "flex-1" : ""}`}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-1.5 w-1.5 rounded-full ${i <= ["cart", "shipping", "payment", "summary"].indexOf(step) ? "bg-primary" : "bg-border"}`} />
                    <span className={`text-[10px] ${i <= ["cart", "shipping", "payment", "summary"].indexOf(step) ? "text-foreground" : "text-muted-foreground"}`}>
                      {s === "cart" ? t("السلة") : s === "shipping" ? t("الشحن") : s === "payment" ? t("الدفع") : t("الملخص")}
                    </span>
                  </div>
                  {i < 3 && <div className="mb-3 h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === "done" && receipt && (
            <div className="space-y-3 text-sm">
              <div className="bg-primary p-4 text-primary-foreground">
                <div className="store-display text-xl">
                  {receipt.requiresPayment ? t("تم تسجيل الأوردر — فاضل إتمام الدفع") : t("تم إنشاء الأوردر بنجاح ✅")}
                </div>
                <div className="mt-1 text-sm">{t("رقم الأوردر:")} <span className="font-mono">{receipt.orderNumber}</span></div>
                <div className="mt-1 text-sm">{t("الإجمالي")}: {receipt.total} {receipt.currency ?? ""}</div>
              </div>

              {receipt.requiresPayment ? (
                <>
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    {t("لن يُعتبر الأوردر مدفوعاً قبل تأكيد الدفع")}
                    {receipt.paymentMethod ? ` ${t("عبر")} ${receipt.paymentMethod}` : ""}.
                  </p>
                  {(receipt.amountDue != null || receipt.paymentDetails) && (
                    <div className="space-y-2 rounded-lg border p-3">
                      {receipt.amountDue != null && (
                        <div className="flex justify-between font-semibold">
                          <span>{t("المبلغ المطلوب الآن")}</span>
                          <span>{receipt.amountDue.toFixed(2)} {receipt.currency ?? ""}</span>
                        </div>
                      )}
                      {receipt.paymentDetails && (
                        <div>
                          <div className="text-xs text-muted-foreground">{t("بيانات الدفع")}</div>
                          <p className="mt-1 whitespace-pre-wrap break-words font-medium" dir="auto">
                            <LinkifyText text={receipt.paymentDetails} />
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <a
                    href={`/chat/${slug}`}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground"
                  >
                    <MessageSquare className="h-4 w-4" /> {t("التوجه لإتمام الدفع")}
                  </a>
                  <Button variant="outline" className="w-full" onClick={() => setShowDetails((v) => !v)}>
                    {showDetails ? t("إخفاء تفاصيل الأوردر") : t("الرجوع لرؤية تفاصيل الأوردر")}
                  </Button>
                </>
              ) : (
                receipt.message && (
                  <p className="whitespace-pre-wrap rounded-lg border p-3 text-muted-foreground"><LinkifyText text={receipt.message} /></p>
                )
              )}

              {(showDetails || !receipt.requiresPayment) && (
                <div className="space-y-2 rounded-lg border p-3">
                  <ul className="space-y-1">
                    {receipt.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-medium">{l.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[l.color, l.size].filter(Boolean).join(" · ")} × {l.quantity}
                          </span>
                        </span>
                        <span>{((l.price ?? 0) * l.quantity).toFixed(2)} {l.currency ?? ""}</span>
                      </li>
                    ))}
                  </ul>
                  {receipt.discount > 0 && (
                    <>
                      <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">{t("السعر قبل الخصم")}</span><span>{receipt.subtotal.toFixed(2)} {receipt.currency ?? ""}</span></div>
                      <div className="flex justify-between text-primary">
                        <span>{t("قيمة الخصم")}</span><span>-{receipt.discount.toFixed(2)} {receipt.currency ?? ""}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("السعر بعد الخصم")}</span>
                        <span>{(receipt.subtotal - receipt.discount).toFixed(2)} {receipt.currency ?? ""}</span>
                      </div>
                      <AppliedOffers offers={receipt.offers} currency={receipt.currency} />
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("الشحن")} {receipt.shippingLabel ? `(${receipt.shippingLabel})` : ""}</span>
                    <span>{receipt.shippingPrice.toFixed(2)} {receipt.currency ?? ""}</span>
                  </div>
                  {receipt.paymentMethod && (
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("طريقة الدفع")}</span><span>{receipt.paymentMethod}</span></div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>{t("الإجمالي النهائي")}</span><span>{receipt.total.toFixed(2)} {receipt.currency ?? ""}</span>
                  </div>
                </div>
              )}
            </div>
          )}


          {step === "cart" && (
            cart.lines.length === 0 ? (
              <div className="py-16 text-center"><ShoppingBag className="mx-auto h-10 w-10" strokeWidth={1} /><p className="store-display mt-4 text-xl">{t("سلتك فارغة")}</p><p className="mt-1 text-sm text-muted-foreground">{t("لم تُضِف أي منتجات بعد.")}</p></div>
            ) : (
              <ul className="space-y-3">
                {cart.lines.map((l) => (
                  <li key={`${l.productId}-${l.color ?? ""}-${l.size ?? ""}`} className="flex items-center gap-3 border p-3">
                    {l.image ? <img src={l.image} alt="" className="h-20 w-16 shrink-0 bg-secondary object-cover" /> : <div className="h-20 w-16 shrink-0 bg-secondary" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.name}</div>
                      {(l.color || l.size) && (
                        <div className="text-xs text-muted-foreground">
                          {[l.color, l.size].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{l.price ?? "—"} {l.currency ?? ""}</div>
                    </div>
                    <Input
                      type="number" min={1} value={l.quantity}
                      onChange={(e) => cart.setQty({ productId: l.productId, color: l.color, size: l.size }, Number(e.target.value) || 1)}
                      className="w-16"
                    />
                    <button onClick={() => cart.remove({ productId: l.productId, color: l.color, size: l.size })} className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {step === "shipping" && (
            <div className="space-y-3 text-sm">
              {store.shipping.length === 0 ? (
                <p className="text-muted-foreground">{t("لا توجد مناطق شحن محددة — سيتم التواصل معك لتحديد الشحن.")}</p>
              ) : (
                <ul className="space-y-2">
                  {store.shipping.map((s) => (
                    <li key={s.id}>
                      <label className={`flex cursor-pointer items-start gap-3 border p-3 transition ${shippingId === s.id ? "border-primary bg-secondary" : "border-border hover:border-foreground/40"}`}>
                        <input type="radio" name="shipping" checked={shippingId === s.id} onChange={() => setShippingId(s.id)} className="mt-1" />
                        <span className="flex-1">
                          <span className="font-medium">{[s.country, s.region].filter(Boolean).join(" / ") || t("الشحن")}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.price != null ? `${s.price} ${s.currency ?? ""}` : t("سعر الشحن غير محدد")}
                            {s.eta ? ` · ${s.eta}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "payment" && (
            <div className="space-y-3 text-sm">
              {store.paymentMethods.length === 0 ? (
                <p className="text-muted-foreground">{t("لا توجد طرق دفع مفعّلة — سيتم التواصل معك للاتفاق على الدفع.")}</p>
              ) : (
                <ul className="space-y-2">
                  {store.paymentMethods.map((m) => (
                    <li key={m.id}>
                      <label className={`flex cursor-pointer items-center gap-3 border p-3 transition ${paymentName === m.name ? "border-primary bg-secondary" : "border-border hover:border-foreground/40"}`}>
                        <input type="radio" name="payment" checked={paymentName === m.name} onChange={() => setPaymentName(m.name)} />
                        <span className="font-medium">{m.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "summary" && (
            <div className="space-y-4 text-sm">
              <ul className="space-y-2">
                {cart.lines.map((l) => (
                  <li key={`${l.productId}-${l.color ?? ""}-${l.size ?? ""}`} className="flex justify-between gap-2 border-b pb-1">
                    <span className="min-w-0">
                      <span className="font-medium">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[l.color, l.size].filter(Boolean).join(" · ")} × {l.quantity}
                      </span>
                    </span>
                    <span>{((l.price ?? 0) * l.quantity).toFixed(2)} {l.currency ?? ""}</span>
                  </li>
                ))}
              </ul>
                <div className="space-y-1 border p-3">
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("السعر قبل الخصم")}</span><span>{subtotal.toFixed(2)} {currency ?? ""}</span></div>
                      <div className="flex justify-between">
                        <span>{t("قيمة الخصم")}</span><span>-{discount.toFixed(2)} {currency ?? ""}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("السعر بعد الخصم")}</span>
                        <span>{(subtotal - discount).toFixed(2)} {currency ?? ""}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("الشحن")} {shippingRow ? `(${[shippingRow.country, shippingRow.region].filter(Boolean).join(" / ")})` : ""}</span>
                    <span>{shippingPrice.toFixed(2)} {currency ?? ""}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>{t("الإجمالي النهائي")}</span><span>{total.toFixed(2)} {currency ?? ""}</span>
                  </div>
                  {paymentName && (
                    <div className="flex justify-between pt-1"><span className="text-muted-foreground">{t("طريقة الدفع")}</span><span>{paymentName}</span></div>
                  )}
                </div>

              <AppliedOffers offers={appliedOffers} currency={currency} />

              {merchantId ? (
                <>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">{t("الاسم *")}</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("الاسم ثنائي أو ثلاثي")} />
                      {nameError && <p className="mt-1 text-[11px] text-destructive">{nameError}</p>}
                    </div>
                    <div>
                      <Label className="text-xs">{t("رقم الهاتف *")}</Label>
                      <Input value={phone} inputMode="tel" dir="ltr" onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                      {phoneError && <p className="mt-1 text-[11px] text-destructive">{phoneError}</p>}
                    </div>
                    <div>
                      <Label className="text-xs">{t("العنوان *")}</Label>
                      <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("المحافظة - المنطقة - الشارع")} />
                      {addressError && <p className="mt-1 text-[11px] text-destructive">{addressError}</p>}
                    </div>

                    <div><Label className="text-xs">{t("ملاحظات")}</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  </div>
                  {shortages.length > 0 && (
                    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                      <div className="font-medium">{t("الكميات التالية غير متاحة حالياً، ولم يتم حفظ الأوردر:")}</div>
                      <ul className="mt-1 space-y-0.5">
                        {shortages.map((s, i) => (
                          <li key={i}>
                            {[s.product_name, s.color, s.size].filter(Boolean).join(" · ")} — {t("المطلوب")} {s.requested} / {t("المتاح")} {s.available}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button className="mt-3 w-full" disabled={mut.isPending || !canSubmit} onClick={() => mut.mutate()}>
                    <Send className="ml-1 h-4 w-4" /> {mut.isPending ? t("جارٍ إنشاء الأوردر…") : t("تأكيد الأوردر")}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>

        {step !== "done" && cart.lines.length > 0 && (
          <div className="space-y-2 border-t p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">{t("الإجمالي")}</span>
              <span className="font-semibold">{total.toFixed(2)} {currency ?? ""}</span>
            </div>
            <div className="flex gap-2">
              {step !== "cart" && (
                <Button variant="outline" className="flex-1" onClick={() =>
                  setStep(step === "shipping" ? "cart" : step === "payment" ? "shipping" : "payment")
                }>
                  {t("رجوع")}
                </Button>
              )}
              {step !== "summary" && (
                <Button className="flex-1" onClick={() => {
                  if (step === "cart") { stockCheck.mutate(); return; }
                  setStep(step === "shipping" ? "payment" : "summary");
                }} disabled={
                  (step === "cart" && stockCheck.isPending) ||
                  (step === "shipping" && store.shipping.length > 0 && !shippingId) ||
                  (step === "payment" && store.paymentMethods.length > 0 && !paymentName)
                }>
                  {step === "cart" ? (stockCheck.isPending ? t("جارٍ التحقق من المخزون…") : t("إنشاء الأوردر")) : t("التالي")}
                </Button>

              )}
            </div>
          </div>
        )}
        {step === "done" && (
          <div className="border-t p-4">
            <Button className="w-full" onClick={onClose}>{t("إغلاق")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

