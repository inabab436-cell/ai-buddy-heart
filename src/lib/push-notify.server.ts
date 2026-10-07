/**
 * Server-only helper that sends a push notification to every browser/device
 * the merchant registered. Delivery is best-effort: failures are logged, never
 * thrown. Stale tokens are deleted so the list stays clean.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MerchantPushEvent = "new_order" | "missing_information" | "human_needed";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

interface PushInput {
  admin: SupabaseClient;
  /** Either the merchant id or the conversation id must be provided. */
  merchantId?: string | null;
  conversationId?: string | null;
  event: MerchantPushEvent;
  title: string;
  body: string;
  /** In-app path opened when the notification is clicked. */
  path?: string;
}

async function resolveUserId(
  admin: SupabaseClient,
  merchantId?: string | null,
  conversationId?: string | null,
): Promise<string | null> {
  let mId = merchantId ?? null;
  if (!mId && conversationId) {
    const { data } = await admin
      .from("conversations")
      .select("merchant_id")
      .eq("id", conversationId)
      .maybeSingle();
    mId = (data as { merchant_id?: string } | null)?.merchant_id ?? null;
  }
  if (!mId) return null;
  const { data: merchant } = await admin
    .from("merchants")
    .select("user_id")
    .eq("id", mId)
    .maybeSingle();
  return (merchant as { user_id?: string } | null)?.user_id ?? null;
}

export async function notifyMerchantByPush(input: PushInput): Promise<void> {
  try {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
    if (!lovableKey || !connectionKey) return;

    const userId = await resolveUserId(input.admin, input.merchantId, input.conversationId);
    if (!userId) return;

    const { data: settings } = await input.admin
      .from("push_notification_settings")
      .select("new_order, missing_information, human_needed")
      .eq("user_id", userId)
      .maybeSingle();
    // Default: enabled when no row exists yet.
    const enabled =
      settings == null
        ? true
        : Boolean((settings as Record<string, unknown>)[input.event] ?? true);
    if (!enabled) return;

    const { data: tokenRows } = await input.admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);
    const tokens = ((tokenRows ?? []) as Array<{ token: string }>).map((r) => r.token);
    if (tokens.length === 0) return;

    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    };

    for (const token of tokens) {
      try {
        const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: {
              token,
              notification: { title: input.title, body: input.body },
              data: { path: input.path ?? "/dashboard", event: input.event },
              webpush: {
                fcm_options: { link: input.path ?? "/dashboard" },
                notification: { icon: "/favicon.png" },
              },
            },
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`[push-notify] send failed [${res.status}]: ${text}`);
          // Stale registration: drop the token instead of retrying it.
          if (res.status === 404 || res.status === 400) {
            await input.admin.from("push_tokens").delete().eq("token", token);
          }
        }
      } catch (err) {
        console.error("[push-notify] request error", err);
      }
    }
  } catch (err) {
    console.error("[push-notify] failed", err);
  }
}

export function orderPush(orderNumber: string): { title: string; body: string } {
  return {
    title: "طلب جديد 🛒",
    body: `وصل طلب جديد برقم ${orderNumber}. افتح لوحة التحكم لمراجعته.`,
  };
}

export function missingInfoPush(
  question: string,
  product: string | null,
): { title: string; body: string } {
  const p = product ? ` (${product})` : "";
  return {
    title: "معلومة ناقصة ❓",
    body: `عميل سأل عن: ${question}${p}`,
  };
}

export function humanNeededPush(reason: string): { title: string; body: string } {
  return {
    title: "تدخل بشري مطلوب 🙋",
    body: reason || "محادثة تحتاج تدخلك الآن.",
  };
}
