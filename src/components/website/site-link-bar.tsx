import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Copy, ExternalLink, ImageIcon, Settings, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getSiteState, publishSite, unpublishSite, deleteSite,
  updateWebsiteIdentity, uploadWebsiteLogo,
} from "@/lib/website.functions";

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      res(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function useSite() {
  return useQuery({ queryKey: ["site-state"], queryFn: () => getSiteState() });
}

/** Header identity: store logo, name and its public link (replaces the generic label). */
export function SiteIdentity() {
  const { data: s } = useSite();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {s?.logo_url ? <img src={s.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" /> : null}
      <div className="min-w-0">
        <div className="truncate text-sm font-bold leading-tight">{s?.brand_name || "متجرك"}</div>
        <div className="text-xs text-muted-foreground">لوحة التحكم</div>
      </div>
    </div>
  );
}

/** Clear card showing the store's public link with open + copy actions. */
export function SiteLinkCard() {
  const { data: s, isLoading } = useSite();
  if (isLoading) return null;
  if (!s?.site_created || !s.brand_slug) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="mb-1 text-sm font-bold">لم يتم إنشاء موقعك بعد</div>
        <p className="mb-3 text-xs text-muted-foreground">
          أنشئ موقعك بخطوات بسيطة، ثم فعّله بالدفع ليظهر لعملائك.
        </p>
        <Button asChild size="lg" className="h-11 w-full text-base">
          <a href="/welcome">إنشاء الموقع</a>
        </Button>
      </section>
    );
  }
  const path = `/c/${s.brand_slug}`;
  const host = typeof window !== "undefined" ? window.location.host : "";
  const published = s.site_status === "published";
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${published ? "bg-dashboard-green" : "bg-destructive"}`} />
        {published ? "رابط متجرك — ظاهر للعملاء" : "رابط متجرك — غير منشور"}
      </div>
      <div className="flex items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{host}{path}</code>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5"
          onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${path}`); toast.success("تم نسخ الرابط"); }}>
          <Copy className="h-3.5 w-3.5" /> نسخ
        </Button>
        <Button asChild size="sm" className="shrink-0 gap-1.5">
          <a href={path} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> فتح</a>
        </Button>
      </div>
    </section>
  );
}

/** Gear button in the header that opens the site settings panel. */
export function SiteSettingsButton() {
  const qc = useQueryClient();
  const { data: state } = useSite();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(state?.brand_name ?? "");
    setDescription(state?.description ?? "");
    setLogoUrl(state?.logo_url ?? "");
  }, [state?.brand_name, state?.description, state?.logo_url, open]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["site-state"] });
  const onErr = (e: unknown) => toast.error(e instanceof Error ? e.message : "حدث خطأ");

  const saveMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateWebsiteIdentity({ data: patch as never }),
    onSuccess: () => { refresh(); toast.success("تم الحفظ"); },
    onError: onErr,
  });
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      const { url } = await uploadWebsiteLogo({ data: { file_name: file.name, mime_type: file.type, base64 } });
      return url;
    },
    onSuccess: (url) => { setLogoUrl(url); saveMut.mutate({ logo_url: url }); },
    onError: onErr,
  });
  const toggleMut = useMutation({
    mutationFn: (on: boolean) => (on ? publishSite({}) : unpublishSite({})),
    onSuccess: (_d, on) => { refresh(); toast.success(on ? "الموقع ظاهر للعملاء" : "تم تقييد الموقع"); },
    onError: onErr,
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteSite({}),
    onSuccess: () => { refresh(); setOpen(false); toast.success("تم حذف الموقع"); },
    onError: onErr,
  });

  if (!state?.site_created) return null;
  const published = state.site_status === "published";
  const dirty = name.trim() !== (state.brand_name ?? "") || description !== (state.description ?? "");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="إعدادات الموقع"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground">
        <Settings className="h-[18px] w-[18px]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" dir="rtl"
          className="mx-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl px-5 pb-8 pt-3">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
          <SheetHeader className="mb-6 text-center sm:text-center">
            <SheetTitle>إعدادات الموقع</SheetTitle>
          </SheetHeader>

          {/* Logo */}
          <div className="mb-6 flex flex-col items-center gap-2">
            <button type="button" onClick={() => logoRef.current?.click()} disabled={uploadMut.isPending}
              className="relative h-24 w-24 rounded-full border-2 border-dashed border-border bg-muted/40">
              <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">
                {logoUrl ? <img src={logoUrl} alt="اللوجو" className="h-full w-full object-cover" />
                  : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
              </span>
              <span className="absolute -bottom-1 -left-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                <Camera className="h-4 w-4" />
              </span>
            </button>
            <span className="text-xs text-muted-foreground">
              {uploadMut.isPending ? "جارٍ رفع اللوجو…" : "اضغط لتغيير اللوجو"}
            </span>
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMut.mutate(f); e.target.value = ""; }} />
          </div>

          {/* Name + description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">اسم الموقع</Label>
              <Input id="site-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: متجر القهوة" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-desc">الوصف</Label>
              <Textarea id="site-desc" rows={3} className="text-base" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="جملة قصيرة تعرّف بمتجرك" />
            </div>
            <Button size="lg" className="h-12 w-full text-base" disabled={!dirty || saveMut.isPending || name.trim().length < 2}
              onClick={() => saveMut.mutate({ brand_name: name.trim(), description })}>
              {saveMut.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </Button>
          </div>

          {/* Visibility */}
          <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 p-4">
            <span>
              <span className="block text-sm font-semibold">ظهور الموقع للعملاء</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {published ? "موقعك ظاهر الآن" : "موقعك مقيّد ولا يراه أحد"}
              </span>
            </span>
            <Switch checked={published} disabled={toggleMut.isPending} onCheckedChange={(on) => toggleMut.mutate(on)} />
          </label>

          {/* Delete */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" disabled={deleteMut.isPending}
                className="mx-auto mt-6 flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline">
                <Trash2 className="h-4 w-4" />حذف الموقع
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-right">حذف الموقع؟</AlertDialogTitle>
                <AlertDialogDescription className="text-right">سيتوقف ظهور موقعك للعملاء.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMut.mutate()}>حذف</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetContent>
      </Sheet>
    </>
  );
}
