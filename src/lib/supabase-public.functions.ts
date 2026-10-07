/**
 * Public (publishable) Supabase config for the browser.
 *
 * The project keeps its Supabase URL/anon key in non-VITE server env vars, so
 * the browser fetches them through this endpoint. The anon key is a publishable
 * key and is safe to expose; RLS still applies.
 */
import { createServerFn } from "@tanstack/react-start";

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export const getSupabasePublicConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<SupabasePublicConfig> => {
    const url = process.env.CUPAI_APP_SB_URL;
    const anonKey = process.env.CUPAI_APP_SB_ANON;
    if (!url || !anonKey) {
      throw new Error("Supabase public configuration is missing.");
    }
    return { url, anonKey };
  },
);
