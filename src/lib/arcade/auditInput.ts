/**
 * The audit's played input (dev builds only; scripts/audit/audit-capture.ts, text pass of 4 Nov 2026): the screenshot
 * audit computes a skill-band bot's input log for the round in Node and hands it to the page as
 * `window.__DUELZ_AUDIT_INPUT__`, and the arcade stages apply it tick by tick exactly as a player's taps would be
 * recorded (so the run, its log and the server's replay are an ordinary run). Production builds replace
 * `import.meta.env.DEV` with false and drop the rest: the hook never exists on a phone.
 */
import type { ArcadeInputEvent } from "./engine";

interface AuditInput {
  events?: ArcadeInputEvent[];
  taps?: number[];
}

function auditInput(): AuditInput | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  return ((window as unknown as { __DUELZ_AUDIT_INPUT__?: AuditInput }).__DUELZ_AUDIT_INPUT__ ?? null) as AuditInput | null;
}

let eventsCache: { from: ArcadeInputEvent[]; byTick: Map<number, ArcadeInputEvent> } | null = null;

/** The audit log's event for sim tick `t`, or null (always null outside the dev audit). */
export function auditEventAt(t: number): ArcadeInputEvent | null {
  if (!import.meta.env.DEV) return null;
  const log = auditInput()?.events;
  if (!log) return null;
  if (eventsCache?.from !== log) eventsCache = { from: log, byTick: new Map(log.map((e) => [e.t, e])) };
  return eventsCache.byTick.get(t) ?? null;
}

let tapsCache: { from: number[]; set: Set<number> } | null = null;

/** Whether the audit log taps on sim tick `t` (always false outside the dev audit). */
export function auditTapAt(t: number): boolean {
  if (!import.meta.env.DEV) return false;
  const log = auditInput()?.taps;
  if (!log) return false;
  if (tapsCache?.from !== log) tapsCache = { from: log, set: new Set(log) };
  return tapsCache.set.has(t);
}
