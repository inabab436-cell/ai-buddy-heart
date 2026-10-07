import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Facebook, Ghost, Globe, Instagram, Link2, Mail, MapPin, Pencil, Phone, PhoneCall, Plus, Send, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/dashboard/page-shell";
import {
  deleteContactInfo, listContactInfo, upsertContactInfo, type ContactInfoDTO,
} from "@/lib/content.functions";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [
    { title: "معلومات التواصل · cupai" },
    { name: "description", content: "إدارة بيانات الاتصال وروابط التواصل الخاصة بمتجرك." },
    { property: "og:title", content: "معلومات التواصل · cupai" },
    { property: "og:description", content: "إدارة بيانات الاتصال وروابط التواصل الخاصة بمتجرك." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ContactsPage,
});

/* ---------- Brand glyphs not available in lucide ---------- */
const svg = (d: string) => (props: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={props.className}><path d={d} /></svg>
);
const WhatsAppIcon = svg("M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z");
const TikTokIcon = svg("M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z");
const XIcon = svg("M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z");

type Kind = {
  id: string;
  name: string;
  Icon: (p: { className?: string }) => ReactNode;
  field: string;
  example: string;
  type?: string;
  inputMode?: "tel" | "email" | "url" | "text";
  ltr?: boolean;
};

const KINDS: Kind[] = [
  { id: "whatsapp", name: "واتساب", Icon: WhatsAppIcon, field: "رقم الواتساب", example: "مثال: 0501234567", type: "tel", inputMode: "tel", ltr: true },
  { id: "phone", name: "هاتف", Icon: Phone, field: "رقم الهاتف", example: "مثال: 0501234567", type: "tel", inputMode: "tel", ltr: true },
  { id: "email", name: "بريد", Icon: Mail, field: "البريد الإلكتروني", example: "مثال: shop@mail.com", type: "email", inputMode: "email", ltr: true },
  { id: "address", name: "العنوان", Icon: MapPin, field: "عنوان المحل", example: "مثال: الرياض، حي النخيل، شارع الملك فهد" },
  { id: "instagram", name: "إنستغرام", Icon: Instagram, field: "رابط أو اسم حسابك", example: "مثال: @myshop", inputMode: "url", ltr: true },
  { id: "facebook", name: "فيسبوك", Icon: Facebook, field: "رابط صفحتك", example: "مثال: facebook.com/myshop", inputMode: "url", ltr: true },
  { id: "tiktok", name: "تيك توك", Icon: TikTokIcon, field: "رابط أو اسم حسابك", example: "مثال: @myshop", inputMode: "url", ltr: true },
  { id: "snapchat", name: "سناب", Icon: Ghost, field: "اسم حسابك", example: "مثال: myshop", inputMode: "url", ltr: true },
  { id: "twitter", name: "إكس", Icon: XIcon, field: "رابط أو اسم حسابك", example: "مثال: @myshop", inputMode: "url", ltr: true },
  { id: "telegram", name: "تيليغرام", Icon: Send, field: "رابط أو اسم حسابك", example: "مثال: @myshop", inputMode: "url", ltr: true },
  { id: "website", name: "موقع", Icon: Globe, field: "رابط الموقع", example: "مثال: myshop.com", type: "url", inputMode: "url", ltr: true },
  { id: "other", name: "أخرى", Icon: Link2, field: "بيانات التواصل", example: "اكتب الرقم أو الرابط" },
];
const kindOf = (id: string) => KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1];

function KindBadge({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  const k = kindOf(id);
  const color = `var(--brand-${k.id})`;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${size === "sm" ? "h-10 w-10" : "h-11 w-11"}`}
      style={{ color, backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      <k.Icon className="h-5 w-5" />
    </span>
  );
}

function ContactsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contacts"], queryFn: () => listContactInfo() });
  const [kind, setKind] = useState("whatsapp");
  const [value, setValue] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const saveMut = useMutation({
    mutationFn: (p: Partial<ContactInfoDTO>) =>
      upsertContactInfo({ data: { id: p.id, kind: p.kind ?? "other", label: p.label ?? null, value: (p.value ?? "").trim() } }),
    onSuccess: (_r, vars) => {
      toast.success("تم الحفظ");
      if (!vars.id) setValue("");
      else setEditId(null);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteContactInfo({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
  });

  const current = kindOf(kind);
  const items = q.data ?? [];

  return (
    <PageShell
      title="معلومات التواصل"
      description="كيف يتواصل معك العملاء؟ اختر الطريقة واكتب بياناتها."
      icon={<PhoneCall className="h-5 w-5" />}
    >
      <div className="min-w-0 space-y-6">
        {/* Add */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">١. اختر طريقة التواصل</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {KINDS.map((k) => {
              const active = k.id === kind;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  aria-pressed={active}
                  className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition-colors ${
                    active ? "border-primary bg-accent" : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {active && (
                    <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  <KindBadge id={k.id} size="sm" />
                  <span className="w-full truncate text-center text-[11px] font-medium text-foreground">{k.name}</span>
                </button>
              );
            })}
          </div>

          <form
            className="mt-5"
            onSubmit={(e) => { e.preventDefault(); if (value.trim()) saveMut.mutate({ kind, value }); }}
          >
            <label htmlFor="contact-value" className="mb-2 block text-sm font-semibold text-foreground">
              ٢. اكتب {current.field}
            </label>
            <Input
              id="contact-value"
              type={current.type ?? "text"}
              inputMode={current.inputMode}
              dir={current.ltr ? "ltr" : "rtl"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={current.ltr ? current.example.replace("مثال: ", "") : current.example}
              className="h-12 rounded-xl text-base"
            />
            <Button type="submit" disabled={saveMut.isPending || !value.trim()} className="mt-4 h-12 w-full rounded-xl text-base">
              <Plus className="h-5 w-5" />
              إضافة {current.name}
            </Button>
          </form>
        </section>

        {/* List */}
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            بيانات التواصل المضافة {items.length > 0 && <span className="text-muted-foreground">({items.length})</span>}
          </h2>

          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              لم تضف أي وسيلة تواصل بعد.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {items.map((c) => {
                const k = kindOf(c.kind);
                const isEditing = editId === c.id;
                return (
                  <li key={c.id} className="min-w-0 rounded-2xl border border-border bg-card p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <KindBadge id={c.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{k.name}{c.label ? ` · ${c.label}` : ""}</p>
                        {isEditing ? (
                          <Input
                            autoFocus
                            dir={k.ltr ? "ltr" : "rtl"}
                            inputMode={k.inputMode}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="mt-1 h-10 rounded-lg"
                          />
                        ) : (
                          <p dir={k.ltr ? "ltr" : "auto"} className="truncate text-right text-[15px] font-semibold text-foreground">
                            {c.value}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {isEditing ? (
                          <>
                            <Button size="icon" aria-label="حفظ" className="h-10 w-10 rounded-xl"
                              disabled={!editValue.trim() || saveMut.isPending}
                              onClick={() => saveMut.mutate({ id: c.id, kind: c.kind, label: c.label, value: editValue })}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="إلغاء" className="h-10 w-10 rounded-xl" onClick={() => setEditId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" aria-label="تعديل" className="h-10 w-10 rounded-xl text-muted-foreground"
                              onClick={() => { setEditId(c.id); setEditValue(c.value); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="حذف" className="h-10 w-10 rounded-xl text-destructive hover:text-destructive"
                              onClick={() => { if (confirm(`حذف ${k.name}؟`)) delMut.mutate(c.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
