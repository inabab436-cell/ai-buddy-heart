/**
 * Google OAuth landing page (merchants only).
 *
 * Exchanges the OAuth code for a session in the browser, hands the access
 * token to the merchant sign-in server function, then continues to the
 * intended destination.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  clearGoogleIntent,
  getBrowserSupabase,
  readGoogleIntent,
} from "@/lib/supabase-browser";
import { googleSignInMerchant } from "@/lib/google-auth.functions";
import { ONBOARDING_DONE_KEY } from "@/lib/onboarding";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "جارٍ تسجيل الدخول · Cupai" },
      { name: "description", content: "إكمال تسجيل الدخول باستخدام Google." },
      { property: "og:title", content: "جارٍ تسجيل الدخول · Cupai" },
      { property: "og:description", content: "إكمال تسجيل الدخول باستخدام Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallbackPage,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.5 2.5 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.7c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.6 14.6 0 0 1 9.6 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2 1.4-4.7 2.4-7.5 2.4-6.4 0-11.7-3.7-13.6-9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") ?? params.get("error");
      if (oauthError) throw new Error(oauthError);

      const supabase = await getBrowserSupabase();
      const code = params.get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw new Error(exErr.message);
      }
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("لم يتم استلام جلسة من Google.");

      readGoogleIntent();

      const res = await googleSignInMerchant({ data: { accessToken } });
      if (!res.ok) throw new Error(res.message);
      clearGoogleIntent();
      await supabase.auth.signOut();
      const to = res.nextRoute === "/welcome" ? "/welcome" : "/dashboard";
      if (to === "/welcome") {
        try { window.localStorage.removeItem(ONBOARDING_DONE_KEY); } catch { /* Storage may be unavailable. */ }
      }
      await navigate({ to, replace: true });
    })().catch((err: unknown) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : "تعذّر إكمال تسجيل الدخول.");
    });

    return () => { active = false; };
  }, [navigate]);

  return (
    <div dir="rtl" className="hub grid min-h-svh place-items-center bg-background px-6">
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <div className="auth-orbit relative grid h-24 w-24 place-items-center">
          {!error && <span className="auth-orbit-ring absolute inset-0 rounded-full" aria-hidden />}
          <span className="grid h-16 w-16 place-items-center rounded-full border border-border bg-card shadow-card">
            <GoogleMark />
          </span>
        </div>

        <h1 className="mt-7 text-lg font-bold text-foreground">
          {error ? "تعذّر تسجيل الدخول" : "جارٍ تسجيل دخولك"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {error ?? "لحظات وننقلك لحسابك."}
        </p>

        {error ? (
          <a href="/login" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">
            حاول مرة أخرى
          </a>
        ) : (
          <div className="mt-6 flex gap-1.5" aria-hidden>
            <span className="auth-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="auth-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:150ms]" />
            <span className="auth-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  );
}
