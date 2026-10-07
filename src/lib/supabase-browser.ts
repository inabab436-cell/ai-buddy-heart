/**
 * Browser-only Supabase client used exclusively for Google sign-in.
 *
 * The app's real session stays the existing encrypted `cupai_session` /
 * `cupai_cs` cookie system; this client only performs the Google OAuth
 * handshake and hands the resulting access token to a server function.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase-public.functions";

let cached: SupabaseClient | null = null;

export async function getBrowserSupabase(): Promise<SupabaseClient> {
  if (cached) return cached;
  const { url, anonKey } = await getSupabasePublicConfig();
  cached = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      storageKey: "cupai-google-oauth",
    },
  });
  return cached;
}

export type GoogleIntent = { kind: "merchant" };

const INTENT_KEY = "cupai-google-intent";

export function saveGoogleIntent(intent: GoogleIntent) {
  sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
}

export function readGoogleIntent(): GoogleIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleIntent;
  } catch {
    return null;
  }
}

export function clearGoogleIntent() {
  sessionStorage.removeItem(INTENT_KEY);
}

/** Start the Google OAuth redirect flow. */
export async function startGoogleSignIn(intent: GoogleIntent) {
  saveGoogleIntent(intent);
  const supabase = await getBrowserSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(error.message);
}
