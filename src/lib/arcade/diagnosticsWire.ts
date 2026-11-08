/**
 * The phone's own counters on a submitted arcade run, after a "~" (diagnostics.ts). Kept apart from the
 * game snapshots so the offline queue and the phone's submit path read it without loading every sim
 * (speed fix 1, Nov 2026).
 */
export type ArcadeCounters = Record<string, number>;

export function appendClientCounters(raw: string, counters: ArcadeCounters): string {
  const body = Object.entries(counters)
    .map(([name, value]) => `${name}=${Math.trunc(value)}`)
    .join(";");
  return `${raw}~${body}`;
}

export function splitClientCounters(raw: string): { run: string; counters: ArcadeCounters | null } {
  const text = String(raw ?? "");
  const at = text.indexOf("~");
  if (at < 0) return { run: text, counters: null };
  const counters: ArcadeCounters = {};
  for (const pair of text
    .slice(at + 1)
    .split(";")
    .slice(0, 40)) {
    const [name, value] = pair.split("=");
    const number = Number.parseInt(value ?? "", 10);
    if (name && /^[a-zA-Z]{1,24}$/.test(name) && Number.isInteger(number)) counters[name] = number;
  }
  return { run: text.slice(0, at), counters };
}

