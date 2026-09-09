/**
 * Shared clock. All round deadlines derive from the server-stamped
 * `round_started_at`, so both phones need to agree on "now". We measure the
 * offset between this device and the backend once per session.
 */
let offsetMs = 0;
let initialised = false;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export async function initServerClock(): Promise<void> {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  try {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
    if (!url || !key) return;
    const before = Date.now();
    const res = await fetch(`${url}/rest/v1/`, { method: "HEAD", headers: { apikey: key } });
    const after = Date.now();
    const dateHeader = res.headers.get("date");
    if (!dateHeader) return;
    const serverTime = new Date(dateHeader).getTime();
    if (!Number.isFinite(serverTime)) return;
    // Header has second precision; assume mid-second and compensate latency.
    offsetMs = serverTime + 500 - (before + after) / 2;
  } catch {
    offsetMs = 0;
  }
}

export function toMs(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : null;
}
