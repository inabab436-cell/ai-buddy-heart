import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, ChevronLeft, Copy, CreditCard, Crown, ExternalLink, Globe2, LogOut, Mail, Phone,
  Share2, ShieldCheck, Tag, Trash2, Truck, UserRound,
} from "lucide-react";

import { getActivationStatus } from "@/lib/activation.functions";

import { PageShell, PageHero, SurfaceCard, SectionHeader } from "@/components/layout/page-shell";
import { getSessionInfo, logout, deleteAccount } from "@/lib/auth.functions";
import { getSiteState } from "@/lib/website.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "حسابي · cupai" },
    { name: "description", content: "بيانات حساب التاجر والاشتراك وإعدادات المتجر." },
    { property: "og:title", content: "حسابي · cupai" },
    { property: "og:description", content: "بيانات حساب التاجر والاشتراك وإعدادات المتجر." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountPage,
});

function Row({ icon, label, value, mono, action }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <span dir={mono ? "ltr" : undefined} className={`mt-1 block truncate text-sm font-semibold ${mono ? "hub-latin text-left" : ""}`}>{value}</span>
      </span>
      {action}
    </div>
  );
}

function LinkRow({ to, icon, label, hint }: {
  to: "/settings/payment-methods" | "/shipping" | "/offers" | "/contacts";
  icon: React.ReactNode; label: string; hint: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function AccountPage() {
  const fetchSession = useServerFn(getSessionInfo);
  const doLogout = useServerFn(logout);
  const doDelete = useServerFn(deleteAccount);
  const session = useQuery({ queryKey: ["session-info"], queryFn: () => fetchSession() });
  const { data: site } = useQuery({ queryKey: ["site-state"], queryFn: () => getSiteState() });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchActivation = useServerFn(getActivationStatus);
  const activation = useQuery({ queryKey: ["activation-status"], queryFn: () => fetchActivation() });

  const email = session.data?.email ?? null;
  const subscribed = activation.data?.subscribed === true;
  const startedAt = activation.data?.startedAt ?? null;
  const endsAt = activation.data?.endsAt ?? null;
  const expired = subscribed && !!endsAt && new Date(endsAt).getTime() <= Date.now();
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("ar-EG", { dateStyle: "medium" }) : "—";
  const storePath = site?.brand_slug ? `/c/${site.brand_slug}` : null;
  const storeUrl = storePath && typeof window !== "undefined" ? `${window.location.origin}${storePath}` : null;

  const copyLink = () => {
    if (!storeUrl) return;
    void navigator.clipboard?.writeText(storeUrl);
    toast.success("تم نسخ رابط المتجر");
  };
  const shareLink = async () => {
    if (!storeUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: site?.brand_name ?? "متجري", url: storeUrl }); } catch { /* cancelled */ }
    } else copyLink();
  };
  const onLogout = () => { void doLogout().catch(() => {}); window.location.replace("/"); };
  const onDelete = async () => {
    setBusy(true);
    try { await doDelete(); window.location.replace("/"); }
    catch { setBusy(false); setConfirmOpen(false); toast.error("تعذّر حذف الحساب"); }
  };

  return (
    <PageShell>
      <PageHero eyebrow="الحساب" icon={<UserRound className="h-3.5 w-3.5" />} title="حسابي" description="بياناتك، اشتراكك، وإعدادات متجرك في مكان واحد." />

      <div className="hub-dashboard space-y-5">
        <SurfaceCard>
          <div className="flex items-center gap-4 p-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted text-primary">
              {site?.logo_url ? (
                <img src={site.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold">{(site?.brand_name ?? email ?? "?").charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-extrabold">{site?.brand_name || "متجرك"}</span>
              <span dir="ltr" className="hub-latin mt-1 block truncate text-left text-xs text-muted-foreground">{email ?? "—"}</span>
            </span>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${subscribed ? "bg-dashboard-green-soft text-dashboard-green" : "bg-dashboard-amber-soft text-dashboard-amber"}`}>
              <Crown className="h-3 w-3" /> {subscribed ? "مشترك" : "غير مشترك"}
            </span>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader icon={<ShieldCheck className="h-3.5 w-3.5" />} title="بيانات الحساب" />
          <div className="divide-y divide-border">
            <Row icon={<Mail className="h-4 w-4" />} label="البريد الإلكتروني" value={email ?? "—"} mono />
            <Row icon={<Crown className="h-4 w-4" />} label="الباقة" value="ابدأ فورًا — 299ج شهريًا"
              action={subscribed ? undefined : (
                <Link to="/subscribe" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">
                  <CreditCard className="h-3.5 w-3.5" /> دفع
                </Link>
              )} />
            {subscribed && (
              <>
                <Row icon={<ShieldCheck className="h-4 w-4" />} label="تاريخ بدء الاشتراك" value={fmtDate(startedAt)} />
                <Row icon={<ShieldCheck className="h-4 w-4" />} label="تاريخ انتهاء الاشتراك" value={fmtDate(endsAt)} />
              </>
            )}
          </div>
          {subscribed && (
            <div className={`flex items-start gap-2.5 border-t border-border px-4 py-3 ${expired ? "bg-dashboard-amber-soft" : ""}`}>
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${expired ? "text-dashboard-amber" : "text-muted-foreground"}`} />
              <p className={`text-xs leading-relaxed ${expired ? "font-bold text-dashboard-amber" : "text-muted-foreground"}`}>
                {expired
                  ? "انتهت مدة اشتراكك. سيتم تقييد متجرك لحين تجديد الاشتراك."
                  : "سيتم تقييد متجرك عند انتهاء مدة الاشتراك لحين التجديد."}
              </p>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader icon={<Globe2 className="h-3.5 w-3.5" />} title="متجرك" />
          <div className="divide-y divide-border">
            <Row icon={<Globe2 className="h-4 w-4" />} label="حالة المتجر"
              value={site?.site_status === "published" ? "منشور — ظاهر للعملاء" : site?.site_created ? "غير منشور" : "لم يُنشأ بعد"} />
            <Row icon={<ExternalLink className="h-4 w-4" />} label="رابط المتجر" value={storeUrl ?? "—"} mono
              action={storeUrl ? (
                <span className="flex gap-1.5">
                  <button type="button" onClick={copyLink} aria-label="نسخ" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={shareLink} aria-label="مشاركة" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><Share2 className="h-4 w-4" /></button>
                  <a href={storePath!} target="_blank" rel="noopener noreferrer" aria-label="فتح المتجر" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>
                </span>
              ) : undefined} />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader icon={<CreditCard className="h-3.5 w-3.5" />} title="إعدادات المتجر" />
          <div className="divide-y divide-border">
            <LinkRow to="/settings/payment-methods" icon={<CreditCard className="h-4 w-4" />} label="طرق الدفع" hint="الطرق التي يدفع بها عملاؤك" />
            <LinkRow to="/shipping" icon={<Truck className="h-4 w-4" />} label="الشحن" hint="المناطق والأسعار ومدد التوصيل" />
            <LinkRow to="/offers" icon={<Tag className="h-4 w-4" />} label="العروض" hint="الخصومات والعروض المؤقتة" />
            <LinkRow to="/contacts" icon={<Phone className="h-4 w-4" />} label="بيانات التواصل" hint="ما يظهر لعملائك للتواصل معك" />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="space-y-2 p-4">
            <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted">
              <LogOut className="h-4 w-4" /> تسجيل الخروج
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60">
              <Trash2 className="h-4 w-4" /> حذف الحساب
            </button>
          </div>
        </SurfaceCard>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب نهائيًا؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف حسابك وكل بيانات متجرك، ولا يمكن التراجع عن ذلك.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void onDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "جارٍ الحذف..." : "حذف الحساب"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
