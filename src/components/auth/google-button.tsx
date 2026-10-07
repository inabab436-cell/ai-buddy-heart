/** Shared "continue with Google" button (merchants and storefront customers). */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { startGoogleSignIn, type GoogleIntent } from "@/lib/supabase-browser";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.5 2.5 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.7c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7A14.6 14.6 0 0 1 9.6 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2 1.4-4.7 2.4-7.5 2.4-6.4 0-11.7-3.7-13.6-9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  intent,
  label = "المتابعة باستخدام Google",
  className,
  style,
  onError,
}: {
  intent: GoogleIntent;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await startGoogleSignIn(intent);
    } catch (err) {
      setBusy(false);
      onError?.(err instanceof Error ? err.message : "تعذّر بدء تسجيل الدخول.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className ?? "w-full gap-2"}
      style={style}
      disabled={busy}
      onClick={handleClick}
    >
      <GoogleMark />
      {busy ? "جارٍ التحويل إلى Google…" : label}
    </Button>
  );
}
