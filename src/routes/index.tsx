import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, BadgePercent, Check, Crown, CreditCard, LayoutGrid, Link2, Package, ShoppingBag, Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CupaiLogo, CupaiMark } from "@/components/cupai-logo";
import { getSessionInfo } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cupai — إدارة متجرك" },
      { name: "description", content: "Cupai: أدر منتجاتك وطلباتك وعملاءك من لوحة تحكم واحدة." },
      { property: "og:title", content: "Cupai — إدارة متجرك" },
      { property: "og:description", content: "أدر منتجاتك وطلباتك وعملاءك من لوحة تحكم واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Link2, title: "متجر برابط خاص", text: "صفحة أنيقة لمتجرك تشاركها مع عملائك في أي مكان.", tone: "bg-dashboard-blue-soft text-dashboard-blue" },
  { icon: Package, title: "عرض منتجاتك", text: "الصور والأسعار والمقاسات والكميات في مكان واحد.", tone: "bg-dashboard-green-soft text-dashboard-green" },
  { icon: ShoppingBag, title: "استلام الطلبات", text: "تصلك الطلبات فورًا مع كل بيانات العميل.", tone: "bg-dashboard-rose-soft text-dashboard-rose" },
  { icon: CreditCard, title: "الدفع بنفسك", text: "أنت من يستلم أمواله مباشرة — المنصة تعرض تفاصيل الدفع لعملائك ولا تستلم عنك ولا أي رسوم.", tone: "bg-dashboard-green-soft text-dashboard-green" },
  { icon: LayoutGrid, title: "إدارة الطلبات", text: "تابع حالة كل طلب من التجهيز حتى التسليم.", tone: "bg-dashboard-amber-soft text-dashboard-amber" },
  { icon: Truck, title: "الشحن", text: "حدّد المناطق وتكلفة التوصيل لكل منطقة.", tone: "bg-dashboard-blue-soft text-dashboard-blue" },
  { icon: BadgePercent, title: "العروض والخصومات", text: "أنشئ عروضًا تزيد مبيعاتك بسهولة.", tone: "bg-dashboard-rose-soft text-dashboard-rose" },
];

const STEPS = ["أنشئ حسابك", "أضف منتجاتك", "شارك رابط متجرك واستقبل الطلبات"];

function Index() {
  const fetchSession = useServerFn(getSessionInfo);
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    fetchSession()
      .then((res) => (res.email ? window.location.replace("/dashboard") : setShowLanding(true)))
      .catch(() => setShowLanding(true));
  }, [fetchSession]);

  if (!showLanding) return <div className="hub min-h-screen bg-background" />;

  const toLogin = () => window.location.assign("/login");

  return (
    <div dir="rtl" className="hub hub-dashboard min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <CupaiLogo />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toLogin}>تسجيل الدخول</Button>
            <Button size="sm" onClick={toLogin}>أنشئ متجرك</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary shadow-card">
            <ShoppingBag className="h-3.5 w-3.5" /> متجرك الإلكتروني في دقائق
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            اعرض منتجاتك، استقبل طلباتك،<br className="hidden sm:block" /> وأدرها من مكان واحد
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Cupai تمنحك متجرًا جاهزًا برابط خاص ولوحة تحكم بسيطة لمتابعة الطلبات والشحن والدفع.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full px-10 sm:w-auto" onClick={toLogin}>
              أنشئ متجرك الآن <ArrowLeft className="mr-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full px-10 sm:w-auto" onClick={toLogin}>
              لدي حساب
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold text-primary">المزايا</p>
            <h2 className="mt-1 text-2xl font-bold">كل ما يحتاجه متجرك</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30">
                <span className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-sm font-bold">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-10">
            <h2 className="text-center text-2xl font-bold">ابدأ في ثلاث خطوات</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <span className="text-sm font-semibold">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold text-primary">الأسعار</p>
            <h2 className="mt-1 text-2xl font-bold">باقة واحدة، كل شيء</h2>
          </div>
          <div className="mx-auto max-w-sm rounded-2xl border-2 border-primary bg-card p-7 text-center shadow-card">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Crown className="h-3.5 w-3.5" /> ابدأ فورًا
            </span>
            <div className="mt-5 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-extrabold">299</span>
              <span className="text-lg font-bold text-muted-foreground">ج</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">فقط</p>
            <ul className="mt-6 space-y-2 text-right text-sm">
              {FEATURES.map(({ title }) => (
                <li key={title} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" /> {title}
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-7 w-full" onClick={toLogin}>ابدأ متجرك الآن بـ 299</Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rounded-2xl bg-gradient-brand p-8 text-center sm:p-12">
            <h2 className="text-2xl font-extrabold text-primary-foreground sm:text-3xl">جاهز تبدأ البيع؟</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">أنشئ متجرك الآن وابدأ استقبال الطلبات اليوم.</p>
            <Button size="lg" variant="secondary" className="mt-6 px-10" onClick={toLogin}>أنشئ متجرك</Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1">
          <span>© Cupai</span>
          <a href="mailto:support.cupai@gmail.com" className="underline underline-offset-2 hover:text-foreground transition-colors">support.cupai@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}
