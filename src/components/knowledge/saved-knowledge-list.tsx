import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listKnowledgeBase,
  upsertKnowledgeBaseEntry,
  deleteKnowledgeBaseEntry,
  type KnowledgeBaseDTO,
} from "@/lib/knowledge-base.functions";

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * Interface for every piece of information the brand owner saved manually.
 * These rows are exactly what the agent reads on each customer message, so
 * editing or deleting here changes the agent's answers immediately.
 */
export function SavedKnowledgeList() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["knowledge-base"],
    queryFn: () => listKnowledgeBase(),
  });

  const rows: KnowledgeBaseDTO[] = q.data ?? [];

  const save = useMutation({
    mutationFn: (v: { id: string; file_name: string; content_text: string }) =>
      upsertKnowledgeBaseEntry({ data: v }),
    onSuccess: () => {
      toast.success("تم تحديث المعلومة.");
      qc.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذر التحديث."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteKnowledgeBaseEntry({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المعلومة.");
      qc.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذر الحذف."),
  });

  return (
    <section
      dir="rtl"
      className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-card backdrop-blur-sm"
    >
      <header className="mb-1 flex flex-wrap items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          المعلومات المحفوظة
        </h2>
        <span className="ms-auto text-[11px] text-muted-foreground">
          {rows.length} معلومة
        </span>
      </header>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          جارٍ التحميل…
        </div>
      )}
      {q.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {(q.error as Error)?.message || "تعذر تحميل المعلومات المحفوظة."}
        </div>
      )}
      {!q.isLoading && !q.isError && rows.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-xs text-muted-foreground">
          لا توجد معلومات محفوظة بعد. أضف أول معلومة من الأعلى.
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <EntryRow
            key={r.id}
            row={r}
            onSave={(file_name, content_text) =>
              save.mutate({ id: r.id, file_name, content_text })
            }
            onDelete={() => remove.mutate(r.id)}
            busy={save.isPending || remove.isPending}
          />
        ))}
      </ul>
    </section>
  );
}

function EntryRow({
  row,
  onSave,
  onDelete,
  busy,
}: {
  row: KnowledgeBaseDTO;
  onSave: (title: string, content: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(row.file_name ?? "");
  const [content, setContent] = useState(row.content_text ?? "");

  return (
    <li className="rounded-xl border border-border/60 bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 max-w-xs text-xs"
            placeholder="عنوان المعلومة"
            dir="rtl"
          />
        ) : (
          <span className="text-xs font-semibold text-foreground">
            {row.file_name?.trim() || "معلومة يدوية"}
          </span>
        )}
        {row.status !== "approved" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {row.status}
          </span>
        )}
        <span className="ms-auto text-[11px] text-muted-foreground">
          {formatTime(row.created_at)}
        </span>
      </div>

      {editing ? (
        <textarea
          className="mt-2 w-full min-h-[120px] rounded-lg border border-border/60 bg-background/80 p-2 text-xs shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          dir="rtl"
        />
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {row.content_text?.trim() || "—"}
        </p>
      )}

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[11px]"
              onClick={() => {
                setTitle(row.file_name ?? "");
                setContent(row.content_text ?? "");
                setEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
              إلغاء
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 text-[11px]"
              disabled={busy || content.trim().length === 0}
              onClick={() => {
                onSave(title.trim(), content.trim());
                setEditing(false);
              }}
            >
              <Check className="h-3.5 w-3.5" />
              حفظ التعديل
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              تعديل
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => {
                if (confirm("حذف هذه المعلومة نهائياً؟")) onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
