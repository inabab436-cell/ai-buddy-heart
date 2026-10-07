import { updateSession } from "@tanstack/react-start/server";
/**
 * Merchant email + password authentication.
 *  - Sign-up: email code (OTP) verifies ownership, then the account is created with a password.
 *  - Sign-in: email + password.
 *  - Forgot password: email code, then a new password.
 * All server-only modules are loaded inside handlers.
 */
import { createServerFn } from "@tanstack/react-start";

import type { LoginResult, OtpSendResult, OtpVerifyResult } from "@/lib/auth-types";

function cleanEmail(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 254) {
    throw new Error("البريد الإلكتروني غير صالح.");
  }
  return s;
}
function cleanName(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  if (s.length < 2 || s.length > 80) throw new Error("الاسم يجب أن يكون بين 2 و80 حرفًا.");
  return s;
}
function cleanCode(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!/^\d{6}$/.test(s)) throw new Error("الرمز يجب أن يكون 6 أرقام.");
  return s;
}
function cleanPassword(v: unknown): string {
  const s = String(v ?? "");
  if (s.length < 8 || s.length > 72) {
    throw new Error("كلمة المرور يجب أن تكون بين 8 و72 حرفًا.");
  }
  return s;
}

async function startMerchantSession(userId: string, email: string): Promise<LoginResult> {
  const { getSessionConfig } = await import("@/lib/session.server");
  await updateSession(getSessionConfig(), { userId, email });
  const { ensureProfile, getSetupCompleted } = await import("@/lib/profile.server");
  await ensureProfile(userId);
  const setupCompleted = await getSetupCompleted(userId);
  return {
    ok: true,
    message: "تم تسجيل الدخول.",
    email,
    setupCompleted,
    nextRoute: setupCompleted ? "/dashboard" : "/welcome",
  };
}

const AR_SEND: Record<OtpSendResult["status"], string> = {
  sent: "أرسلنا رمز التحقق إلى بريدك.",
  cooldown: "انتظر قليلًا قبل طلب رمز جديد.",
  blocked: "طلبات كثيرة. حاول لاحقًا.",
  error: "تعذّر إرسال الرسالة. حاول مرة أخرى.",
};
const AR_VERIFY: Record<OtpVerifyResult["status"], string> = {
  verified: "تم التحقق.",
  invalid: "الرمز غير صحيح.",
  expired: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
  blocked: "تجاوزت عدد المحاولات. حاول لاحقًا.",
  error: "حدث خطأ. حاول مرة أخرى.",
};

export const requestSignupCode = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => ({ email: cleanEmail(d?.email) }))
  .handler(async ({ data }): Promise<OtpSendResult> => {
    const { findUserIdByEmail, sendOtp } = await import("@/lib/otp.server");
    if (await findUserIdByEmail(data.email)) {
      return { ok: false, status: "error", message: "هذا البريد مسجّل بالفعل. سجّل الدخول." };
    }
    const r = await sendOtp(data.email, "signup");
    return { ...r, message: AR_SEND[r.status] };
  });

export const completeSignup = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; email: string; code: string; password: string }) => ({
    name: cleanName(d?.name),
    email: cleanEmail(d?.email),
    code: cleanCode(d?.code),
    password: cleanPassword(d?.password),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const { verifyOtp, findUserIdByEmail } = await import("@/lib/otp.server");
    const v = await verifyOtp(data.email, "signup", data.code);
    if (!v.ok) {
      const extra = v.attemptsRemaining ? ` (متبقٍ ${v.attemptsRemaining})` : "";
      return { ok: false, message: AR_VERIFY[v.status] + extra };
    }
    if (await findUserIdByEmail(data.email)) {
      return { ok: false, message: "هذا البريد مسجّل بالفعل. سجّل الدخول." };
    }
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await getSupabaseAdmin().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    });
    if (error || !created.user) return { ok: false, message: "تعذّر إنشاء الحساب." };
    return startMerchantSession(created.user.id, data.email);
  });

export const loginWithPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => ({
    email: cleanEmail(d?.email),
    password: String(d?.password ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.CUPAI_APP_SB_URL;
    const anon = process.env.CUPAI_APP_SB_ANON;
    if (!url || !anon) throw new Error("إعدادات الخادم غير مكتملة.");
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: res, error } = await client.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error || !res.user) {
      return { ok: false, message: "البريد أو كلمة المرور غير صحيحة." };
    }
    await client.auth.signOut().catch(() => undefined);
    return startMerchantSession(res.user.id, data.email);
  });

export const requestResetCode = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => ({ email: cleanEmail(d?.email) }))
  .handler(async ({ data }): Promise<OtpSendResult> => {
    const { findUserIdByEmail, sendOtp } = await import("@/lib/otp.server");
    // Same answer whether or not the account exists (no account enumeration).
    if (!(await findUserIdByEmail(data.email))) {
      return { ok: true, status: "sent", message: AR_SEND.sent, retryAfterSeconds: 60 };
    }
    const r = await sendOtp(data.email, "password_reset");
    return { ...r, message: AR_SEND[r.status] };
  });

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; code: string; password: string }) => ({
    email: cleanEmail(d?.email),
    code: cleanCode(d?.code),
    password: cleanPassword(d?.password),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const { verifyOtp, findUserIdByEmail } = await import("@/lib/otp.server");
    const v = await verifyOtp(data.email, "password_reset", data.code);
    if (!v.ok) {
      const extra = v.attemptsRemaining ? ` (متبقٍ ${v.attemptsRemaining})` : "";
      return { ok: false, message: AR_VERIFY[v.status] + extra };
    }
    const userId = await findUserIdByEmail(data.email);
    if (!userId) return { ok: false, message: AR_VERIFY.expired };
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
      password: data.password,
      email_confirm: true,
    });
    if (error) return { ok: false, message: "تعذّر تحديث كلمة المرور." };
    return startMerchantSession(userId, data.email);
  });
