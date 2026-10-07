import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Phone, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderTimeline } from "@/components/customer/order-timeline";
import { trackOrder, type TrackedOrder } from "@/lib/order-tracking.functions";
import { listCustomerOrdersDetailed, type CustomerOrderDetail } from "@/lib/customer-orders.functions";

export const Route = createFileRoute("/c/$slug/track")({
  head: ({ params }) => ({
    meta: [
      { title: `تتبع طلبك — ${params.slug}` },
      { name: "description", content: "تابع حالة طلبك باستخدام رقم الأوردر." },
      { property: "og:title", content: `تتبع طلبك — ${params.slug}` },
      { property: "og:description", content: "تابع حالة طلبك باستخدام رقم الأوردر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(trackOrder);
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const listFn = useServerFn(listCustomerOrdersDetailed);
  const mine = useQuery({
    queryKey: ["track-my-orders", slug],
    queryFn: async () => { try { return await listFn(); } catch { return [] as CustomerOrderDetail[]; } },
    staleTime: 30_000,
  });
  const myOrders = mine.data ?? [];

  async function run(withPhone: boolean) {
    if (!orderNumber.trim()) return;
    setLoading(true);
    try {
      setRes(await fn({ data: { slug, orderNumber, phone: withPhone ? phone : null } }));
    } catch {
      setRes({ found: false, full: false, order: null, itemCount: 0 });
    } finally {
      setLoading(false);
    }
  }

  const o = res?.order;
  return (
    <div dir="rtl" className="store min-h-screen">
      {/* Header — same pattern as the storefront */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link to="/c/$slug" params={{ slug }} className="store-label inline-flex items-center gap-2 hover:underline underline-offset-8">
            <ArrowRight className="h-4 w-4" /> العودة للمتجر
          </Link>
          <span className="store-label text-muted-foreground">خدمة العملاء على مدار الساعة</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="store-label text-muted-foreground">متابعة الطلبات</p>
            <h1 className="store-display mt-3 text-6xl sm:text-7xl">تتبع طلبك</h1>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "إغلاق البحث" : "البحث عن طلب"}
            className="grid h-12 w-12 shrink-0 place-items-center border border-foreground transition hover:bg-primary hover:text-primary-foreground"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>

        {searchOpen && (
          <form
            onSubmit={(e) => { e.preventDefault(); void run(false); }}
            className="mt-8 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              autoFocus
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="رقم الأوردر"
              className="h-12 flex-1"
            />
            <Button type="submit" disabled={loading} className="store-label h-12 px-8">
              <Search className="h-4 w-4" /> بحث
            </Button>
          </form>
        )}

        {!res && !mine.isLoading && myOrders.length === 0 && (
          <div className="mt-12 border-y border-border py-12 text-center">
            <p className="store-display text-3xl">لا يوجد طلبات مسجلة</p>
            <p className="mt-2 text-sm text-muted-foreground">اضغط على العدسة للبحث برقم الأوردر.</p>
          </div>
        )}

        {!res && myOrders.length > 0 && (
          <div className="mt-10 space-y-10">
            {myOrders.map((m) => <MyOrder key={m.id} o={m} />)}
          </div>
        )}

        {res && !res.found && (
          <div className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-3">
            <p className="store-label text-destructive">لم نجد طلبًا بهذا الرقم</p>
            <p className="mt-1 text-sm text-muted-foreground">تأكد من الرقم وحاول مرة أخرى.</p>
          </div>
        )}

        {o && (
          <section className="mt-10 border-t border-foreground pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="store-display text-3xl">طلب #{o.order_number}</h2>
              <span className="store-label text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ar-EG")}</span>
            </div>
            <p className="store-label mt-2 text-muted-foreground">عدد القطع: {res!.itemCount}</p>

            <div className="mt-6">
              <OrderTimeline order={o} />
            </div>

            {res!.full ? (
              <div className="mt-8 space-y-4 border-t border-border pt-6 text-sm">
                {res!.customerName && (
                  <p><span className="store-label text-muted-foreground">الاسم: </span>{res!.customerName}</p>
                )}
                {res!.customerAddress && (
                  <p><span className="store-label text-muted-foreground">العنوان: </span>{res!.customerAddress}</p>
                )}
                <ul className="divide-y divide-border border-y border-border">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-3">
                      <span>
                        {it.product_name}
                        {([it.color, it.size].filter(Boolean).length > 0) && (
                          <span className="text-muted-foreground"> — {[it.color, it.size].filter(Boolean).join(" / ")}</span>
                        )}
                        <span className="text-muted-foreground"> × {it.quantity}</span>
                      </span>
                      {it.price != null && <span className="whitespace-nowrap">{it.price} {it.currency ?? ""}</span>}
                    </li>
                  ))}
                </ul>
                {o.total_price != null && (
                  <p className="flex justify-between">
                    <span className="store-label">الإجمالي</span>
                    <span className="font-semibold">{o.total_price} {o.currency ?? ""}</span>
                  </p>
                )}
                {o.payment_method && (
                  <p><span className="store-label text-muted-foreground">طريقة الدفع: </span>{o.payment_method}</p>
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); void run(true); }}
                className="mt-8 space-y-3 border-t border-border pt-6"
              >
                <p className="store-label">لرؤية كل التفاصيل، اكتب رقم الهاتف الذي سجّلت به الطلب</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="رقم الهاتف"
                    className="h-12 flex-1"
                  />
                  <Button type="submit" variant="secondary" disabled={loading} className="store-label h-12 px-8">
                    <Phone className="h-4 w-4" /> عرض
                  </Button>
                </div>
                {res!.phoneMismatch && (
                  <p className="store-label text-destructive">رقم الهاتف غير مطابق لهذا الطلب</p>
                )}
              </form>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function MyOrder({ o }: { o: CustomerOrderDetail }) {
  const count = o.items.reduce((n, it) => n + it.quantity, 0);
  return (
    <section className="border-t border-foreground pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="store-display text-3xl">طلب #{o.order_number ?? "—"}</h2>
        <span className="store-label text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ar-EG")}</span>
      </div>
      <p className="store-label mt-2 text-muted-foreground">عدد القطع: {count}</p>
      <div className="mt-6"><OrderTimeline order={o} /></div>
      <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
        {o.items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-3">
            <span>
              {it.product_name}
              {[it.color, it.size].filter(Boolean).length > 0 && (
                <span className="text-muted-foreground"> — {[it.color, it.size].filter(Boolean).join(" / ")}</span>
              )}
              <span className="text-muted-foreground"> × {it.quantity}</span>
            </span>
            {it.price != null && <span className="whitespace-nowrap">{it.price} {it.currency ?? ""}</span>}
          </li>
        ))}
      </ul>
      {o.total_price != null && (
        <p className="mt-4 flex justify-between text-sm">
          <span className="store-label">الإجمالي</span>
          <span className="font-semibold">{o.total_price} {o.currency ?? ""}</span>
        </p>
      )}
      {o.payment_method && (
        <p className="mt-2 text-sm"><span className="store-label text-muted-foreground">طريقة الدفع: </span>{o.payment_method}</p>
      )}
    </section>
  );
}
