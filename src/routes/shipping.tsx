import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, Truck, X, Pencil, MapPin, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageShell, PageHero, SurfaceCard } from "@/components/layout/page-shell";
import {
  deleteShippingRate, listShippingRates, upsertShippingRate, type ShippingRateDTO,
} from "@/lib/content.functions";
import { setPublished } from "@/lib/publish.functions";

export const Route = createFileRoute("/shipping")({
  head: () => ({ meta: [
    { title: "جدول الشحن · cupai" },
    { name: "description", content: "إدارة مناطق التوصيل وتكاليف الشحن ومدد التسليم." },
    { property: "og:title", content: "جدول الشحن · cupai" },
    { property: "og:description", content: "إدارة مناطق التوصيل وتكاليف الشحن ومدد التسليم." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ShippingPage,
});

type EditingRow = {
  id?: string;
  country: string; region: string; price: string;
  currency: string; eta: string; notes: string;
};

const EMPTY: EditingRow = { country: "", region: "", price: "", currency: "EGP", eta: "", notes: "" };

function ShippingPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shipping"], queryFn: () => listShippingRates() });
  const [editing, setEditing] = useState<EditingRow | null>(null);

  const saveMut = useMutation({
    mutationFn: (v: EditingRow) => upsertShippingRate({ data: {
      id: v.id,
      country: v.country.trim() || null,
      region: v.region.trim() || null,
      price: v.price.trim() === "" ? null : Number(v.price),
      currency: v.currency.trim() || null,
      eta: v.eta.trim() || null,
      notes: v.notes.trim() || null,
    } as any }),
    onSuccess: () => { toast.success("تم الحفظ."); setEditing(null); qc.invalidateQueries({ queryKey: ["shipping"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteShippingRate({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping"] }),
  });
  const pubMut = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) =>
      setPublished({ data: { table: "shipping_rates", id: v.id, is_published: v.is_published } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل النشر."),
  });

  const rows = (q.data ?? []) as (ShippingRateDTO & { is_published?: boolean })[];

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.country?.trim() || "—";
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }
  const groups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"));

  return (
    <PageShell>
      <PageHero
        eyebrow="إدارة المتجر"
        icon={<Truck className="h-3.5 w-3.5" />}
        title="جدول"
        highlight="الشحن"
        description="جدول واحد منظم لكل أسعار الشحن، مجمّعة حسب الدولة والمنطقة."
        actions={
          <Button className="bg-gradient-brand text-primary-foreground shadow-glow" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="ml-1 h-4 w-4" /> إضافة صف جديد
          </Button>
        }
      />

      <SurfaceCard>
        {q.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">جاري التحميل...</p>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
              <Truck className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">لا توجد أسعار شحن بعد. أضف أول صف من الأعلى.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {groups.map(([country, items]) => (
              <div key={country} className="p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{country}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{items.length} منطقة</span>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => (
                    <li key={r.id} className="flex flex-col rounded-xl border border-border/60 bg-background p-4 transition hover:border-primary/40">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{r.region || "كل المناطق"}</p>
                        <p className="shrink-0 whitespace-nowrap text-base font-bold text-gradient-brand">
                          {r.price != null ? `${r.price} ${r.currency ?? ""}` : "—"}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                          <Clock className="h-3 w-3" /> {r.eta || "مدة غير محددة"}
                        </span>
                      </div>
                      {r.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.notes}</p>}
                      <div className="mt-4 flex gap-2 border-t border-border/60 pt-3">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({
                          id: r.id,
                          country: r.country ?? "", region: r.region ?? "",
                          price: r.price != null ? String(r.price) : "",
                          currency: r.currency ?? "EGP",
                          eta: r.eta ?? "", notes: r.notes ?? "",
                        })}>
                          <Pencil className="ml-1 h-3.5 w-3.5" /> تعديل
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="حذف" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("حذف؟")) delMut.mutate(r.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div dir="rtl" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/60 bg-background p-6 shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-glow">
                  <Truck className="h-4 w-4" />
                </span>
                {editing.id ? "تعديل صف الشحن" : "إضافة صف شحن"}
              </h3>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">الدولة</Label>
                <Input className="mt-1" value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} /></div>
              <div><Label className="text-xs">المنطقة</Label>
                <Input className="mt-1" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })} /></div>
              <div><Label className="text-xs">السعر</Label>
                <Input className="mt-1" type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              <div><Label className="text-xs">العملة</Label>
                <Input className="mt-1" value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">المدة المتوقعة</Label>
                <Input className="mt-1" value={editing.eta} onChange={(e) => setEditing({ ...editing, eta: e.target.value })} placeholder="3-5 أيام" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">ملاحظات</Label>
                <Textarea className="mt-1" rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button>
              <Button className="bg-gradient-brand text-primary-foreground shadow-glow" onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending}>
                <Save className="ml-1 h-4 w-4" /> حفظ
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
