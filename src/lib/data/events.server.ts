/**
 * Analytics events (9 Nov 2026; docs/analytics.md): the ONE module that writes `analytics.events`
 * (supabase/migrations/20261109140000_analytics_events.sql), through the service-role RPC
 * `record_analytics_events`. Server only.
 *
 * Recording is fire-and-forget: `recordEvents` returns at once, never throws and never changes the response of the
 * request it rides on. The write runs in the background (on Cloudflare it is handed to the request's `waitUntil`, so
 * the Worker finishes it after the response), is abandoned after EVENT_WRITE_TIMEOUT_MS, and any failure is caught
 * and logged as `[analytics] …`. Nothing in play, scoring or timing ever reads these rows.
 *
 * What is stored: the event, when, the auth user id, the game, mode, score, completed, duration, room id, the build
 * id, a coarse platform (ios / android / desktop, from the user agent, which is never stored) and the input type.
 * Never an email, an IP address, a user agent or a name.
 *
 * The existing beta tables (betaRecord.server.ts) are written exactly as before; these events go alongside them.
 */

import { getRequest } from "@tanstack/react-start/server";

import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsMode } from "@/lib/analytics/events";
import { APP_BUILD_ID } from "@/lib/appVersion";
import { normaliseInputType } from "@/lib/inputType";

import { asJson, type Db } from "./db.server";
import type { Result } from "./rooms.server";

/** The longest a background write may take before it is abandoned. */
export const EVENT_WRITE_TIMEOUT_MS = 3_000;

export type Platform = "ios" | "android" | "desktop";

/** One event as the server code records it. */
export interface AnalyticsEvent {
  event: AnalyticsEventName;
  /** The auth user id, or a lookup of it (practice: the caller's token, read in the background). */
  playerId?: string | null | (() => Promise<string | null>);
  game?: string | null;
  mode?: AnalyticsMode | null;
  score?: number | null;
  completed?: boolean | null;
  durationMs?: number | null;
  roomId?: string | null;
  inputType?: unknown;
  props?: Record<string, string | number | boolean | null> | null;
  /** When it happened; the server's time now when left out (phone events pass their own, already held in range). */
  occurredAt?: string;
}

/** One row as the RPC takes it (the table's columns; received_at and id are the database's). */
export interface AnalyticsRow {
  occurred_at: string;
  event: AnalyticsEventName;
  player_id: string | null;
  game: string | null;
  mode: AnalyticsMode | null;
  score: number | null;
  completed: boolean | null;
  duration_ms: number | null;
  room_id: string | null;
  app_version: string | null;
  platform: Platform | null;
  input_type: string | null;
  props: Record<string, string | number | boolean | null> | null;
}

/** The one write: a batch of rows through the service-role RPC. */
export async function insertAnalyticsEvents(
  client: Db,
  rows: readonly AnalyticsRow[],
): Promise<Result<number | null>> {
  const { data, error } = await client.rpc("record_analytics_events", { p_events: asJson(rows) });
  return { data: data ?? null, error };
}

/** A coarse platform from a user agent (the agent itself is never kept). */
export function platformOf(userAgent: string | null | undefined): Platform | null {
  if (!userAgent) return null;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: unknown): string | null =>
  typeof value === "string" && UUID_RE.test(value) ? value : null;
const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;

/** The row for one event; `platform` comes from the request it rides on. */
export function analyticsRow(
  event: AnalyticsEvent,
  playerId: string | null,
  platform: Platform | null,
  nowIso: string,
): AnalyticsRow {
  const duration = intOrNull(event.durationMs);
  return {
    occurred_at: event.occurredAt ?? nowIso,
    event: event.event,
    player_id: uuidOrNull(playerId),
    game: typeof event.game === "string" && event.game ? event.game.slice(0, 40) : null,
    mode: event.mode ?? null,
    score: intOrNull(event.score),
    completed: typeof event.completed === "boolean" ? event.completed : null,
    duration_ms: duration === null ? null : Math.max(0, duration),
    room_id: uuidOrNull(event.roomId),
    app_version: APP_BUILD_ID.slice(0, 64),
    platform,
    input_type: normaliseInputType(event.inputType),
    props: event.props && Object.keys(event.props).length ? event.props : null,
  };
}

/** Writes still in flight (checks wait on them with flushAnalytics). */
const pending = new Set<Promise<void>>();

/** The request's platform and Cloudflare's waitUntil, when there is a request. */
function requestContext(): { platform: Platform | null; waitUntil: ((p: Promise<unknown>) => void) | null } {
  try {
    const request = getRequest() as (Request & { waitUntil?: (p: Promise<unknown>) => void }) | undefined;
    const waitUntil = typeof request?.waitUntil === "function" ? request.waitUntil.bind(request) : null;
    return { platform: platformOf(request?.headers?.get("user-agent")), waitUntil };
  } catch {
    return { platform: null, waitUntil: null };
  }
}

function warn(message: string): void {
  console.warn(`[analytics] ${message}`);
}

/**
 * Records events in the background. Returns at once and never throws: a missing table, a slow or failing database,
 * a bad row are all logged and dropped. Skipped where there is no database (local dev servers in checks).
 */
export function recordEvents(events: AnalyticsEvent | readonly AnalyticsEvent[]): void {
  try {
    const given = (Array.isArray(events) ? events : [events]) as readonly unknown[];
    // Only known events: one bad entry would make the database refuse the whole batch.
    const list = given.filter(
      (e): e is AnalyticsEvent =>
        !!e && typeof e === "object" && (ANALYTICS_EVENTS as readonly string[]).includes((e as AnalyticsEvent).event),
    );
    if (list.length < given.length) warn(`dropped ${given.length - list.length} malformed event(s)`);
    if (!list.length || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) return;
    const { platform, waitUntil } = requestContext();
    const nowIso = new Date().toISOString();
    const task = writeInBackground(list, platform, nowIso);
    pending.add(task);
    void task.finally(() => pending.delete(task));
    if (waitUntil) {
      try {
        waitUntil(task);
      } catch {
        /* no waitUntil after all: the write still runs */
      }
    }
  } catch (err) {
    warn(`not recorded: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function writeInBackground(
  list: readonly AnalyticsEvent[],
  platform: Platform | null,
  nowIso: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let label = "events";
  try {
    label = list.map((e) => e.event).join(",");
    const write = (async () => {
      const rows: AnalyticsRow[] = [];
      for (const event of list) {
        let playerId: string | null = null;
        if (typeof event.playerId === "function") {
          try {
            playerId = await event.playerId();
          } catch {
            playerId = null;
          }
        } else playerId = event.playerId ?? null;
        rows.push(analyticsRow(event, playerId, platform, nowIso));
      }
      const { adminDb } = await import("./db.server");
      return insertAnalyticsEvents(await adminDb(), rows);
    })();
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), EVENT_WRITE_TIMEOUT_MS);
    });
    const result = await Promise.race([write, timeout]);
    if (result === "timeout") {
      warn(`${label}: gave up after ${EVENT_WRITE_TIMEOUT_MS} ms`);
      // The write may still settle later; its failure must never surface as an unhandled rejection.
      write.catch(() => {});
      return;
    }
    if (result.error) warn(`${label}: ${result.error.message ?? String(result.error)}`);
  } catch (err) {
    warn(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Checks only: waits until every background write so far has settled. */
export async function flushAnalytics(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}

/** An async room's mode from its kind (`daily_puzzle`, `daily_arcade`, `challenge`). */
export function asyncMode(kind: string): AnalyticsMode {
  return kind === "challenge" ? "challenge" : "daily";
}

/**
 * How long a round was played: an arcade run's own length when it stored one (extra.endedSeconds), else the clock
 * less what was left. The same rule as practice_plays' duration_ms (betaRecord.server.ts practicePlayRow).
 */
export function playedMs(
  timeLimitMs: number,
  msLeft: number,
  extra?: Record<string, unknown> | null,
): number {
  const ended = extra?.["endedSeconds"];
  if (typeof ended === "number" && Number.isFinite(ended)) return Math.max(0, Math.round(ended * 1000));
  const limit = Math.max(0, Math.round(timeLimitMs));
  const left = Number.isFinite(msLeft) ? Math.max(0, Math.min(limit, Math.round(msLeft))) : 0;
  return limit - left;
}
