import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  listOrderCatalog, createMerchantOrder, updateOrderDetails, editOrderItems, type OrderRow,
} from "@/lib/orders.functions";

const fieldCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type Line = { product_id: string; variant: string; quantity: number };

export function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["order-catalog"], queryFn: () => listOrderCatalog(), enabled: open });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [shipping, setShipping] = useState("");
  const [deduct, setDeduct] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ product_id: "", variant: "", quantity: 1 }]);

  useEffect(() => {
    if (!open) {
      setName(""); setPhone(""); setAddress(""); setNotes(""); setShipping(""); setDeduct(true);
      setLines([{ product_id: "", variant: "", quantity: 1 }]);
    }
  }, [open]);

  const products = cat.data ?? [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const subtotal = lines.reduce((n, l) => n + Number(byId.get(l.product_id)?.price ?? 0) * l.quantity, 0);
  const total = subtotal + (Number(shipping) || 0);

  const mut = useMutation({
    mutationFn: () =>
      createMerchantOrder({
        data: {
          customer_name: name, customer_phone: phone, customer_address: address, notes,
          shipping_cost: Number(shipping) || 0, deduct_stock: deduct,
          items: lines.filter((l) => l.product_id).map((l) => {
            const [color, size] = l.variant ? (JSON.parse(l.variant) as [string | null, string | null]) : [null, null];
            return { product_id: l.product_id, color, size, quantity: l.quantity };
          }),
        },
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error("الكمية غير متوفرة في المخزون: " + r.shortages
          .map((s) => [s.product_name, s.color, s.size].filter(Boolean).join(" - ")).join("، "));
        return;
      }
      toast.success(`تم إنشاء الطلب ${r.order_number}`);
      qc.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الطلب."),
  });

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء طلب جديد</DialogTitle>
          <DialogDescription>
            سجّل طلبات عملائك التي تصلك عبر الهاتف أو واتساب أو من المحل بنفسك، لتظهر مع باقي طلباتك وتتابع شحنها وتصدّرها لشركة الشحن.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="اسم العميل" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="رقم الهاتف" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Textarea rows={2} placeholder="عنوان الشحن" value={address} onChange={(e) => setAddress(e.target.value)} />

          <div className="space-y-2">
            <div className="text-xs font-semibold">المنتجات</div>
            {lines.map((l, i) => {
              const p = byId.get(l.product_id);
              return (
                <div key={i} className="space-y-2 rounded-xl border border-border p-2">
                  <select className={fieldCls} value={l.product_id}
                    onChange={(e) => setLine(i, { product_id: e.target.value, variant: "" })}>
                    <option value="">{cat.isLoading ? "جاري التحميل..." : "اختر منتجاً"}</option>
                    {products.map((pp) => (
                      <option key={pp.id} value={pp.id}>{pp.name}{pp.price != null ? ` — ${pp.price} ${pp.currency ?? ""}` : ""}</option>
                    ))}
                  </select>
                  {p && p.variants.length > 0 && (
                    <select className={fieldCls} value={l.variant} onChange={(e) => setLine(i, { variant: e.target.value })}>
                      <option value="">اختر اللون والمقاس</option>
                      {p.variants.map((v, k) => (
                        <option key={k} value={JSON.stringify([v.color, v.size])}>
                          {[v.color, v.size].filter(Boolean).join(" / ") || "بدون"} — متاح: {v.stock ?? "غير محدد"}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} className="w-24" value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                    <span className="text-xs text-muted-foreground">الكمية</span>
                    {lines.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="ms-auto"
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button type="button" size="sm" variant="outline" className="rounded-full"
              onClick={() => setLines((ls) => [...ls, { product_id: "", variant: "", quantity: 1 }])}>
              <Plus className="ml-1 h-4 w-4" />إضافة منتج
            </Button>
          </div>

          <Input type="number" min={0} placeholder="مصاريف الشحن" value={shipping} onChange={(e) => setShipping(e.target.value)} />
          <Textarea rows={2} placeholder="ملاحظات الشحن (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <label className="flex items-center justify-between gap-2 text-sm">
            خصم الكميات من المخزون الآن
            <Switch checked={deduct} onCheckedChange={setDeduct} />
          </label>
          <div className="rounded-xl bg-muted p-3 text-sm font-semibold">
            الإجمالي: {Math.round(total * 100) / 100}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={mut.isPending || !name.trim() || !phone.trim() || !lines.some((l) => l.product_id)}
            onClick={() => {
              const missingVariant = lines.some((l) => l.product_id && (byId.get(l.product_id)?.variants.length ?? 0) > 0 && !l.variant);
              if (missingVariant) return toast.error("اختر اللون والمقاس لكل منتج.");
              mut.mutate();
            }}>
            {mut.isPending ? "جاري الإنشاء..." : "إنشاء الطلب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const norm = (v: string | null | undefined) => String(v ?? "").trim().toLocaleLowerCase("ar");

export function EditOrderDialog({ order, onClose }: { order: OrderRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["order-catalog"], queryFn: () => listOrderCatalog(), enabled: !!order });
  const products = cat.data ?? [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const [f, setF] = useState({ name: "", phone: "", address: "", notes: "", shipping: "", total: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [linesDirty, setLinesDirty] = useState(false);
  const stockWasDeducted = Array.isArray((order as any)?.stock_deducted) && (order as any).stock_deducted.length > 0;
  const discount = Number(order?.discount_amount ?? 0) || 0;

  useEffect(() => {
    if (order) setF({
      name: order.customer_name ?? "", phone: order.customer_phone ?? "",
      address: order.customer_address ?? "", notes: order.notes ?? "",
      shipping: String(order.shipping_cost ?? 0),
      total: String(order.total_price ?? order.subtotal_price ?? 0),
    });
    setLinesDirty(false);
  }, [order]);

  // Map the order's current lines onto catalogue products/variants.
  useEffect(() => {
    if (!order || !cat.data) return;
    setLines(order.items.map((it: any) => {
      const p = cat.data.find((pp) => pp.id === (it.product_id ?? it.productId))
        ?? cat.data.find((pp) => norm(pp.name) === norm(it.product_name ?? it.name));
      const v = p?.variants.find((vv) => norm(vv.color) === norm(it.color) && norm(vv.size) === norm(it.size));
      return {
        product_id: p?.id ?? "",
        variant: v ? JSON.stringify([v.color, v.size]) : "",
        quantity: Math.max(1, Number(it.quantity) || 1),
      };
    }));
  }, [order, cat.data]);

  const subtotal = lines.reduce((n, l) => n + Number(byId.get(l.product_id)?.price ?? 0) * l.quantity, 0);
  useEffect(() => {
    if (!linesDirty) return;
    const t = Math.max(0, Math.round((subtotal - discount + (Number(f.shipping) || 0)) * 100) / 100);
    setF((x) => ({ ...x, total: String(t) }));
  }, [linesDirty, subtotal, f.shipping, discount]);

  const setLine = (i: number, patch: Partial<Line>) => {
    setLinesDirty(true);
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const mut = useMutation({
    mutationFn: async () => {
      let stockUpdated = false;
      if (linesDirty) {
        const r = await editOrderItems({
          data: {
            id: order!.id,
            items: lines.filter((l) => l.product_id).map((l) => {
              const [color, size] = l.variant ? (JSON.parse(l.variant) as [string | null, string | null]) : [null, null];
              return { product_id: l.product_id, color, size, quantity: l.quantity };
            }),
          },
        });
        if (!r.ok) {
          throw new Error("الكمية غير متوفرة في المخزون: " + r.shortages
            .map((s) => [s.product_name, s.color, s.size].filter(Boolean).join(" - ")).join("، "));
        }
        stockUpdated = r.stock_updated;
      }
      await updateOrderDetails({
        data: {
          id: order!.id, customer_name: f.name, customer_phone: f.phone, customer_address: f.address,
          notes: f.notes, shipping_cost: Number(f.shipping) || 0, total_price: Number(f.total) || 0,
        },
      });
      return stockUpdated;
    },
    onSuccess: (stockUpdated) => {
      toast.success(linesDirty && stockUpdated ? "تم حفظ الطلب وتحديث المخزون." : "تم حفظ تعديلات الطلب.");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-catalog"] });
      qc.invalidateQueries({ queryKey: ["website-products"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ."),
  });

  const unmatched = lines.some((l) => !l.product_id);
  const missingVariant = lines.some((l) => l.product_id && (byId.get(l.product_id)?.variants.length ?? 0) > 0 && !l.variant);

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الطلب #{order?.order_number ?? ""}</DialogTitle>
          <DialogDescription>عدّل بيانات العميل والمنتجات والمبالغ.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs">اسم العميل<Input className="mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="block text-xs">رقم الهاتف<Input className="mt-1" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className="block text-xs">عنوان الشحن<Textarea className="mt-1" rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>

          <div className="space-y-2">
            <div className="text-xs font-semibold">المنتجات</div>
            <p className="text-[11px] text-muted-foreground">
              {stockWasDeducted
                ? "المخزون والسعر يتحدّثان تلقائياً حسب تعديلك."
                : "هذا الطلب لم يُخصم من المخزون، فلن يتغيّر المخزون. السعر يتحدّث تلقائياً."}
            </p>
            {cat.isLoading && <div className="text-xs text-muted-foreground">جاري التحميل...</div>}
            {lines.map((l, i) => {
              const p = byId.get(l.product_id);
              return (
                <div key={i} className="space-y-2 rounded-xl border border-border p-2">
                  <select className={fieldCls} value={l.product_id}
                    onChange={(e) => setLine(i, { product_id: e.target.value, variant: "" })}>
                    <option value="">اختر منتجاً</option>
                    {products.map((pp) => (
                      <option key={pp.id} value={pp.id}>{pp.name}{pp.price != null ? ` — ${pp.price} ${pp.currency ?? ""}` : ""}</option>
                    ))}
                  </select>
                  {p && p.variants.length > 0 && (
                    <select className={fieldCls} value={l.variant} onChange={(e) => setLine(i, { variant: e.target.value })}>
                      <option value="">اختر اللون والمقاس</option>
                      {p.variants.map((v, k) => (
                        <option key={k} value={JSON.stringify([v.color, v.size])}>
                          {[v.color, v.size].filter(Boolean).join(" / ") || "بدون"} — متاح: {v.stock ?? "غير محدد"}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} className="w-24" value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                    <span className="text-xs text-muted-foreground">الكمية</span>
                    {lines.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="ms-auto"
                        onClick={() => { setLinesDirty(true); setLines((ls) => ls.filter((_, j) => j !== i)); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button type="button" size="sm" variant="outline" className="rounded-full"
              onClick={() => { setLinesDirty(true); setLines((ls) => [...ls, { product_id: "", variant: "", quantity: 1 }]); }}>
              <Plus className="ml-1 h-4 w-4" />إضافة منتج
            </Button>
          </div>

          <label className="block text-xs">الملاحظات<Textarea className="mt-1" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">مصاريف الشحن<Input className="mt-1" type="number" min={0} value={f.shipping} onChange={(e) => setF({ ...f, shipping: e.target.value })} /></label>
            <label className="block text-xs">المبلغ المطلوب تحصيله<Input className="mt-1" type="number" min={0} value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></label>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={mut.isPending || !f.name.trim()} onClick={() => {
            if (linesDirty && (unmatched || missingVariant)) return toast.error("اختر المنتج واللون والمقاس لكل سطر.");
            mut.mutate();
          }}>
            {mut.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
