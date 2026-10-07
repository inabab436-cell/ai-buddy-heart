import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CupaiLogo } from "@/components/cupai-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods.functions";
import { paymentPolicySummary, type PaymentKind } from "@/lib/payment-policy";

export const Route = createFileRoute("/settings/payment-methods")({
  head: () => ({
    meta: [
      { title: "طرق الدفع · cupai" },
      { name: "description", content: "اختر طرق الدفع التي تقبلها والمبلغ المطلوب وبيانات الدفع لكل طريقة." },
      { property: "og:title", content: "طرق الدفع · cupai" },
      { property: "og:description", content: "اختر طرق الدفع التي تقبلها والمبلغ المطلوب وبيانات الدفع لكل طريقة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentMethodsPage,
});

type AmountMode = "full" | "percent" | "amount";

const SUGGESTED: Array<{ name: string; kind: PaymentKind; placeholder: string }> = [
  { name: "الدفع عند الاستلام", kind: "on_delivery", placeholder: "" },
  { name: "فودافون كاش", kind: "online", placeholder: "رقم فودافون كاش: 010xxxxxxxx" },
  { name: "أورنج كاش", kind: "online", placeholder: "رقم أورنج كاش: 012xxxxxxxx" },
  { name: "اتصالات كاش", kind: "online", placeholder: "رقم اتصالات كاش: 011xxxxxxxx" },
  { name: "InstaPay", kind: "online", placeholder: "عنوان InstaPay أو رابط الدفع" },
  { name: "تحويل بنكي", kind: "online", placeholder: "اسم البنك ورقم الحساب / IBAN" },
];

const AMOUNT_OPTIONS: Array<{ value: AmountMode; title: string }> = [
  { value: "full", title: "المبلغ كاملًا" },
  { value: "percent", title: "نسبة من إجمالي الأوردر" },
  { value: "amount", title: "مبلغ ثابت" },
];

interface FormState {
  name: string;
  paymentKind: PaymentKind;
  amountMode: AmountMode;
  amountValue: string;
  details: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  paymentKind: "online",
  amountMode: "full",
  amountValue: "",
  details: "",
};

function toAmountMode(m: PaymentMethod): AmountMode {
  if (m.allow_partial_payment && m.partial_payment_value > 0) {
    return m.partial_payment_type === "amount" ? "amount" : "percent";
  }
  return "full";
}

function PaymentMethodsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payment-methods"], queryFn: () => listPaymentMethods() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["payment-methods"] });

  const update = useMutation({
    mutationFn: (v: { id: string; enabled?: boolean }) => updatePaymentMethod({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "تعذر حفظ التغيير."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePaymentMethod({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف طريقة الدفع.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "تعذر الحذف."),
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const suggestion = SUGGESTED.find((s) => s.name === form.name.trim());
  const pickSuggestion = (s: (typeof SUGGESTED)[number]) =>
    setForm((f) => ({ ...f, name: s.name, paymentKind: s.kind }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      paymentKind: m.payment_kind ?? "online",
      amountMode: toAmountMode(m),
      amountValue: m.partial_payment_value ? String(m.partial_payment_value) : "",
      details: m.detail_value ?? "",
    });
    setOpen(true);
  };

  const online = form.paymentKind === "online";
  const needsValue = online && form.amountMode !== "full";
  const valueNum = Number(form.amountValue);
  const valueInvalid =
    needsValue && (!(valueNum > 0) || (form.amountMode === "percent" && valueNum > 100));
  const canSave = form.name.trim().length >= 2 && !valueInvalid;

  const save = useMutation({
    mutationFn: async () => {
      const details = online ? form.details.trim() : "";
      const partial = online && form.amountMode !== "full";
      const payload = {
        name: form.name.trim(),
        // Kept for the existing order flow: online methods wait for the merchant.
        behavior: (online ? "manual" : "auto") as "manual" | "auto",
        detail_type: (details ? "text" : "none") as "text" | "none",
        detail_value: details,
        instructions: "",
        payment_template: "",
        payment_kind: form.paymentKind,
        allow_full_payment: !partial,
        allow_partial_payment: partial,
        partial_payment_type: (form.amountMode === "amount" ? "amount" : "percent") as
          | "amount"
          | "percent",
        partial_payment_value: partial ? valueNum || 0 : 0,
      };
      if (editingId) return updatePaymentMethod({ data: { id: editingId, ...payload } });
      return createPaymentMethod({ data: payload });
    },
    onSuccess: () => {
      toast.success(editingId ? "تم حفظ التعديلات." : "تمت إضافة طريقة الدفع.");
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "تعذر الحفظ."),
  });

  const methods = q.data ?? [];

  return (
    <div dir="rtl" className="hub min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <CupaiLogo markClassName="h-6 w-6" textClassName="text-sm font-semibold tracking-tight" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="ml-1 h-4 w-4" />
              لوحة التحكم
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <section className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-brand p-2.5 text-primary-foreground shadow-glow">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">طرق الدفع</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أنت تحدد طرق الدفع وبياناتها، وأنت تدير عملية الدفع — cupai لا يستلم ولا يحتجز أموالك.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-background/80 shadow-card backdrop-blur">
          {q.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل…
            </div>
          ) : methods.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">لا توجد طرق دفع بعد.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {methods.map((m) => (
                <li key={m.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{m.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {m.payment_kind === "on_delivery" ? "عند الاستلام" : "إلكتروني"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={m.enabled}
                        disabled={update.isPending}
                        onCheckedChange={(v) => update.mutate({ id: m.id, enabled: !!v })}
                      />
                      <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => openEdit(m)} aria-label={`تعديل ${m.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(m.id)}
                        aria-label={`حذف ${m.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {paymentPolicySummary(m)}
                  </p>
                  {m.payment_kind !== "on_delivery" && m.detail_value ? (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                      بيانات الدفع: {m.detail_value}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="ml-1 h-4 w-4" />
          إضافة طريقة جديدة
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle>{editingId ? "تعديل طريقة الدفع" : "إضافة طريقة دفع جديدة"}</DialogTitle>
            <DialogDescription>اختر اسم الطريقة ونوعها والبيانات التي تظهر للعميل.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pm-name">اسم طريقة الدفع</Label>
              <Input
                id="pm-name"
                value={form.name}
                onChange={(e) => {
                  const v = e.target.value;
                  const s = SUGGESTED.find((x) => x.name === v.trim());
                  setForm((f) => ({ ...f, name: v, ...(s ? { paymentKind: s.kind } : {}) }));
                }}
                placeholder="اختر اسمًا مقترحًا أو اكتب اسمًا مخصصًا"
              />
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED.map((s) => {
                  const active = form.name.trim() === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>نوع الدفع</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "on_delivery", title: "الدفع عند الاستلام" },
                  { value: "online", title: "الدفع الإلكتروني" },
                ] as Array<{ value: PaymentKind; title: string }>).map((c) => {
                  const active = form.paymentKind === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set("paymentKind", c.value)}
                      aria-pressed={active}
                      className={`rounded-xl border p-3 text-right text-sm font-semibold transition ${
                        active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      {c.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {online && (
              <>
                <div className="space-y-2">
                  <Label>المبلغ المطلوب</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {AMOUNT_OPTIONS.map((o) => {
                      const active = form.amountMode === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => set("amountMode", o.value)}
                          aria-pressed={active}
                          className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition ${
                            active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/60 hover:bg-muted/40"
                          }`}
                        >
                          {o.title}
                        </button>
                      );
                    })}
                  </div>
                  {needsValue && (
                    <div className="space-y-1">
                      <Label htmlFor="pm-amount" className="text-xs">
                        {form.amountMode === "percent" ? "النسبة (%)" : "المبلغ"}
                      </Label>
                      <Input
                        id="pm-amount"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={form.amountMode === "percent" ? 100 : undefined}
                        value={form.amountValue}
                        onChange={(e) => set("amountValue", e.target.value)}
                        placeholder={form.amountMode === "percent" ? "مثال: 50" : "مثال: 200"}
                      />
                      {valueInvalid && (
                        <p className="text-xs text-destructive">
                          {form.amountMode === "percent" ? "أدخل نسبة بين 1 و 100." : "أدخل مبلغًا صحيحًا."}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pm-details">بيانات الدفع</Label>
                  <Textarea
                    id="pm-details"
                    rows={3}
                    maxLength={500}
                    value={form.details}
                    onChange={(e) => set("details", e.target.value)}
                    placeholder={suggestion?.placeholder || "مثال: رقم فودافون كاش: 01204664848 أو رابط الدفع"}
                  />
                  <p className="text-xs text-muted-foreground">تظهر للعميل بعد اختياره هذه الطريقة لإكمال الدفع.</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
              {save.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
              {editingId ? "حفظ" : "إضافة"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
