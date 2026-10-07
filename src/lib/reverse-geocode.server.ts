/**
 * REVERSE GEOCODING (server-only)
 * ===============================
 *
 * When the customer shares their live location the agent used to receive raw
 * coordinates only, so it could not do the one thing the customer expects:
 * read the address back and ask "هو ده عنوانك؟".
 *
 * This helper turns a coordinate pair into a readable Arabic address using
 * OpenStreetMap's public Nominatim service. It never throws and never blocks
 * the chat: any failure simply returns null and the flow continues with the
 * coordinates alone.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

export interface ReverseGeocoded {
  /** Readable, customer-facing address line, or null when unavailable. */
  address: string | null;
}

function pick(obj: Record<string, unknown>, keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() && !out.includes(v.trim())) out.push(v.trim());
  }
  return out;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocoded> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { address: null };
  const url = `${ENDPOINT}?format=jsonv2&accept-language=ar&zoom=18&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { "User-Agent": "cupai-chat/1.0", Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { address: null };
    const data = (await res.json()) as Record<string, unknown>;
    const addr = (data.address ?? {}) as Record<string, unknown>;
    const parts = pick(addr, [
      "road",
      "neighbourhood",
      "suburb",
      "city_district",
      "village",
      "town",
      "city",
      "county",
      "state",
    ]);
    const line = parts.join("، ").trim();
    if (line) return { address: line };
    const display = typeof data.display_name === "string" ? data.display_name.trim() : "";
    return { address: display || null };
  } catch {
    return { address: null };
  }
}
