import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, CheckCheck, Clock, Search, Send, CreditCard, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  listConversations,
  getConversationDetail,
  sendMerchantReply,
  confirmPaymentAndResumeAgent,
  type ConversationRow,
} from "@/lib/conversations.functions";

export const Route = createFileRoute("/conversations")({
  validateSearch: z.object({ c: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "المحادثات · cupai" },
      { name: "description", content: "تواصل مع عملائك وأكمل الدفع معهم من مكان واحد." },
      { property: "og:title", content: "المحادثات · cupai" },
      { property: "og:description", content: "صندوق محادثات التاجر مع العملاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversationsPage,
});

function displayName(c: { customer_name: string | null; visitor_number: number | null }) {
  return c.customer_name?.trim() || (c.visitor_number ? `زائر ${c.visitor_number}` : "عميل");
}

function shortTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

const AVATAR_TONES = [
  "bg-primary/15 text-primary",
  "bg-chart-2/20 text-chart-2",
  "bg-chart-3/20 text-chart-3",
  "bg-chart-4/20 text-chart-4",
  "bg-chart-5/20 text-chart-5",
];

function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold ${AVATAR_TONES[h % AVATAR_TONES.length]}`}>
      {name.trim().charAt(0) || "؟"}
    </span>
  );
}

function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === y.toDateString()) return "أمس";
  if (today.getTime() - d.getTime() < 7 * 864e5) return "هذا الأسبوع";
  return "أقدم";
}

function ConversationsPage() {
  const { c: selectedId } = Route.useSearch();
  const navigate = useNavigate({ from: "/conversations" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "payment">("all");

  const list = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: 10000,
  });

  const rows = useMemo(() => {
    const all = [...(list.data ?? [])].sort((a, b) =>
      (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at),
    );
    return all.filter((r) => {
      if (filter === "payment" && !r.awaiting_payment) return false;
      if (!query.trim()) return true;
      return displayName(r).includes(query.trim()) || (r.last_message_preview ?? "").includes(query.trim());
    });
  }, [list.data, query, filter]);

  const groups = useMemo(() => {
    const out: { label: string; items: ConversationRow[] }[] = [];
    const pinned = rows.filter((r) => r.awaiting_payment);
    if (pinned.length && filter === "all") out.push({ label: "بانتظار الدفع", items: pinned });
    for (const r of filter === "all" ? rows.filter((r) => !r.awaiting_payment) : rows) {
      const label = groupLabel(r.last_message_at ?? r.created_at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(r); else out.push({ label, items: [r] });
    }
    return out;
  }, [rows, filter]);

  const total = list.data?.length ?? 0;
  const paymentCount = (list.data ?? []).filter((r) => r.awaiting_payment).length;
  const select = (id?: string) => navigate({ search: id ? { c: id } : {} });

  return (
    <div dir="rtl" className="hub hub-chat flex h-[100dvh] overflow-hidden bg-background">
      {/* Inbox */}
      <aside className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col border-l border-border bg-card md:w-[380px]`}>
        <header className="space-y-4 border-b border-border px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">المحادثات</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{total} محادثة{paymentCount ? ` · ${paymentCount} بانتظار الدفع` : ""}</p>
            </div>
            <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ArrowRight className="h-4 w-4" /> لوحة التحكم
            </Link>
          </div>
          <label className="flex items-center gap-2 rounded-2xl border border-transparent bg-muted px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-background">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن عميل أو رسالة"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {([["all", "الكل", total], ["payment", "بانتظار الدفع", paymentCount]] as const).map(([k, label, n]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${filter === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
                <span className={`rounded-full px-1.5 text-[10px] ${filter === k ? "bg-primary text-primary-foreground" : "bg-background/70"}`}>{n}</span>
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {list.isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 px-2 py-3">
                <span className="h-12 w-12 rounded-2xl bg-muted" />
                <span className="flex-1 space-y-2"><span className="block h-3 w-1/2 rounded bg-muted" /><span className="block h-3 w-3/4 rounded bg-muted" /></span>
              </div>
            ))}
          {!list.isLoading && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <MessagesSquare className="h-9 w-9" />
              <p className="text-sm">{query ? "لا نتائج مطابقة." : "لا توجد محادثات بعد."}</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold text-muted-foreground">{g.label}</p>
              {g.items.map((r) => (
                <InboxRow key={r.id} row={r} active={r.id === selectedId} onClick={() => select(r.id)} />
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {selectedId ? (
          <Thread key={selectedId} id={selectedId} onBack={() => select(undefined)} />
        ) : (
          <div className="m-auto flex flex-col items-center gap-3 text-center text-muted-foreground">
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
              <MessagesSquare className="h-10 w-10" />
            </span>
            <p className="text-base font-bold text-foreground">اختر محادثة</p>
            <p className="text-sm">اختر عميلًا من القائمة لعرض الرسائل والرد عليه.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function InboxRow({ row, active, onClick }: { row: ConversationRow; active: boolean; onClick: () => void }) {
  const name = displayName(row);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition-colors ${active ? "row-active bg-primary/10" : "hover:bg-muted/70"}`}
    >
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold">{name}</span>
          <span className="ms-auto shrink-0 text-[11px] text-muted-foreground">{shortTime(row.last_message_at ?? row.created_at)}</span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="truncate text-[13px] text-muted-foreground">{row.last_message_preview || "لا رسائل بعد"}</span>
          {row.awaiting_payment && (
            <span className="ms-auto shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">بانتظار الدفع</span>
          )}
        </span>
      </span>
    </button>
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === y.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const detail = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversationDetail({ data: { id } }),
    refetchInterval: 5000,
  });

  // Messages shown instantly while they are being sent.
  const [pending, setPending] = useState<Array<{ tempId: string; content: string; created_at: string }>>([]);

  const send = useMutation({
    mutationFn: (p: { tempId: string; content: string }) => sendMerchantReply({ data: { id, content: p.content } }),
    onSuccess: async (_r, p) => {
      await qc.invalidateQueries({ queryKey: ["conversation", id] });
      setPending((list) => list.filter((x) => x.tempId !== p.tempId));
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any, p) => {
      setPending((list) => list.filter((x) => x.tempId !== p.tempId));
      setText((t) => t || p.content);
      toast.error(e?.message || "تعذر إرسال الرسالة");
    },
  });

  const confirm = useMutation({
    mutationFn: () => confirmPaymentAndResumeAgent({ data: { id } }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (res?.ok === false) {
        toast.error(res.error === "insufficient_stock" ? "الكمية غير متاحة الآن، لم يتم تأكيد الدفع." : "تعذر تأكيد الدفع.");
        return;
      }
      toast.success("تم تأكيد الدفع");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر تأكيد الدفع"),
  });

  const msgs = detail.data?.messages ?? [];

  const scrollToEnd = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // Only auto-scroll when the merchant is already reading the latest messages.
  useEffect(() => {
    if (nearBottomRef.current) scrollToEnd();
    else setShowJump(true);
  }, [msgs.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    if (near) setShowJump(false);
  };

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    const tempId = `tmp-${Date.now()}`;
    setText("");
    nearBottomRef.current = true;
    setPending((list) => [...list, { tempId, content: v, created_at: new Date().toISOString() }]);
    requestAnimationFrame(() => scrollToEnd(true));
    send.mutate({ tempId, content: v });
  };

  const all = [
    ...msgs.map((m) => ({ ...m, sending: false })),
    ...pending.map((p) => ({ id: p.tempId, role: "assistant", content: p.content, created_at: p.created_at, sending: true })),
  ];

  const name = detail.data ? displayName(detail.data) : "…";

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 md:px-5">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted md:hidden" aria-label="رجوع">
          <ArrowRight className="h-5 w-5" />
        </button>
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{name}</p>
          {detail.data?.awaiting_payment ? (
            <p className="text-xs font-semibold text-destructive">بانتظار استكمال الدفع</p>
          ) : (
            <p className="chat-meta text-xs">{msgs.length} رسالة</p>
          )}
        </div>
        {detail.data?.awaiting_payment && (
          <Button size="sm" onClick={() => confirm.mutate()} disabled={confirm.isPending} className="gap-1.5">
            <CreditCard className="h-4 w-4" /> تأكيد الدفع
          </Button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="chat-wall h-full overflow-y-auto px-3 py-5 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col">
            {detail.isLoading && <p className="text-center text-sm text-muted-foreground">جارٍ التحميل…</p>}
            {all.map((m, i) => {
              const mine = m.role !== "user";
              const prev = all[i - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const grouped = !newDay && prev && (prev.role !== "user") === mine;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-4 flex justify-center">
                      <span className="chat-meta rounded-full bg-card px-3 py-1 text-xs font-semibold shadow-sm">{dayLabel(m.created_at)}</span>
                    </div>
                  )}
                  {/* Physical sides: merchant on the left, customer on the right. */}
                  <div dir="ltr" className={`flex ${mine ? "justify-start" : "justify-end"} ${grouped ? "mt-1" : "mt-3"}`}>
                    <div
                      dir="rtl"
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 transition-opacity md:max-w-[70%] ${m.sending ? "opacity-70" : ""} ${
                        mine ? `bubble-out ${grouped ? "" : "rounded-tl-md"}` : `bubble-in ${grouped ? "" : "rounded-tr-md"}`
                      }`}
                    >
                      <p className="chat-text whitespace-pre-wrap break-words">{m.content}</p>
                      <span className="chat-meta mt-0.5 flex items-center justify-end gap-1 text-[11px]">
                        {shortTime(m.created_at)}
                        {mine &&
                          (m.sending ? (
                            <Clock className="h-3.5 w-3.5 animate-pulse" aria-label="جارٍ الإرسال" />
                          ) : (
                            <CheckCheck className="h-3.5 w-3.5" aria-label="تم الإرسال" />
                          ))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {showJump && (
          <button
            onClick={() => { scrollToEnd(true); setShowJump(false); }}
            className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg"
          >
            <ArrowDown className="h-4 w-4" /> رسائل جديدة
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="border-t border-border bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-border bg-background p-1.5 ps-4 focus-within:border-primary">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder="اكتب ردك للعميل…"
            className="chat-text min-h-10 flex-1 resize-none bg-transparent py-1.5 outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon" disabled={!text.trim()} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} className="h-10 w-10 shrink-0 rounded-full" aria-label="إرسال">
            <Send className="h-5 w-5 -scale-x-100" />
          </Button>
        </div>
        <p className="chat-meta mx-auto mt-1.5 hidden max-w-3xl text-[11px] md:block">Enter للإرسال · Shift + Enter لسطر جديد</p>
      </form>
    </>
  );
}
