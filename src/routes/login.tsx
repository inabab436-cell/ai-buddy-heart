import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AuthCard, SpamNotice } from "@/components/auth/auth-card";
import { GoogleSignInButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeSignup,
  loginWithPassword,
  requestResetCode,
  requestSignupCode,
  resetPasswordWithCode,
} from "@/lib/merchant-email-auth.functions";
import { ADMIN_EMAIL, adminLogin } from "@/lib/admin.functions";
import { ONBOARDING_DONE_KEY } from "@/lib/onboarding";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول · Cupai" },
      { name: "description", content: "سجّل الدخول أو أنشئ حسابك في Cupai بالبريد الإلكتروني." },
      { property: "og:title", content: "تسجيل الدخول · Cupai" },
      { property: "og:description", content: "سجّل الدخول أو أنشئ حسابك في Cupai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Mode = "login" | "signup" | "reset";

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginWithPassword);
  const sendSignup = useServerFn(requestSignupCode);
  const finishSignup = useServerFn(completeSignup);
  const sendReset = useServerFn(requestResetCode);
  const finishReset = useServerFn(resetPasswordWithCode);

  const [mode, setMode] = useState<Mode>("login");
  const [codeSent, setCodeSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const loginAdmin = useServerFn(adminLogin);
  const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL;

  function switchMode(m: Mode) {
    setMode(m);
    setCodeSent(false);
    setCode("");
    setError(null);
    setInfo(null);
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ.");
    } finally {
      setBusy(false);
    }
  }

  function go(res: { ok: boolean; message: string; nextRoute?: string }) {
    if (!res.ok) return setError(res.message);
    const to = mode === "signup" || res.nextRoute === "/welcome" ? "/welcome" : "/dashboard";
    if (to === "/welcome") {
      try { window.localStorage.removeItem(ONBOARDING_DONE_KEY); } catch { /* Storage may be unavailable. */ }
    }
    void navigate({ to, replace: true });
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "login" && isAdmin) {
        const r = await loginAdmin({ data: { email, password } });
        if (!r.ok) return setError(r.message);
        window.location.replace("/admin");
      } else if (mode === "login") {
        go(await login({ data: { email, password } }));
      } else if (!codeSent) {
        const r = mode === "signup"
          ? await sendSignup({ data: { email } })
          : await sendReset({ data: { email } });
        if (!r.ok) return setError(r.message);
        setInfo(r.message);
        setCodeSent(true);
      } else {
        go(
          mode === "signup"
            ? await finishSignup({ data: { name, email, code, password } })
            : await finishReset({ data: { email, code, password } }),
        );
      }
    });
  };

  const resend = () =>
    run(async () => {
      const r = mode === "signup"
        ? await sendSignup({ data: { email } })
        : await sendReset({ data: { email } });
      if (r.ok) setInfo(r.message);
      else setError(r.message);
    });

  const titles: Record<Mode, string> = {
    login: "تسجيل الدخول",
    signup: "إنشاء حساب جديد",
    reset: "استعادة كلمة المرور",
  };
  const submitLabel =
    mode === "login"
      ? "دخول"
      : !codeSent
        ? "إرسال رمز التحقق"
        : mode === "signup"
          ? "إنشاء الحساب"
          : "حفظ كلمة المرور الجديدة";

  return (
    <AuthCard
      title={titles[mode]}
      subtitle={codeSent ? `أدخل الرمز المرسل إلى ${email}` : "مرحبًا بك في Cupai"}
    >
      <form onSubmit={onSubmit} className="space-y-4" dir="rtl">
        {mode === "signup" ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">الاسم</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              className="h-12"
              disabled={codeSent}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            className="h-12"
            disabled={codeSent}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {codeSent ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="code">رمز التحقق</Label>
              <Input
                id="code"
                inputMode="numeric"
                dir="ltr"
                maxLength={6}
                required
                className="h-12 text-center text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <SpamNotice />
          </>
        ) : null}

        {(mode !== "reset" || codeSent) ? (
          <div className="space-y-1.5">
            <Label htmlFor="password">
              {mode === "login"
                ? "كلمة المرور"
                : mode === "signup"
                  ? "كلمة المرور (8 أحرف على الأقل)"
                  : "كلمة المرور الجديدة (8 أحرف على الأقل)"}
            </Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              className="h-12"
              disabled={mode === "signup" && codeSent}
              minLength={mode === "login" ? 1 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        ) : null}

        {info && !error ? <p className="text-sm text-muted-foreground">{info}</p> : null}
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "جارٍ التنفيذ…" : submitLabel}
        </Button>

        {codeSent ? (
          <button type="button" onClick={resend} disabled={busy} className="w-full text-sm text-primary hover:underline">
            إعادة إرسال الرمز
          </button>
        ) : null}

        <div className="flex flex-col items-center gap-1 text-sm sm:flex-row sm:justify-between sm:gap-2">
          {mode !== "login" ? (
            <button type="button" className="py-1.5 text-primary hover:underline" onClick={() => switchMode("login")}>
              لديك حساب؟ سجّل الدخول
            </button>
          ) : (
            <>
              <button type="button" className="py-1.5 text-primary hover:underline" onClick={() => switchMode("signup")}>
                إنشاء حساب جديد
              </button>
              <button type="button" className="py-1.5 text-muted-foreground hover:underline" onClick={() => switchMode("reset")}>
                نسيت كلمة المرور؟
              </button>
            </>
          )}
        </div>
      </form>

      {mode === "login" ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton intent={{ kind: "merchant" }} onError={setError} />
        </div>
      ) : null}
    </AuthCard>
  );
}
