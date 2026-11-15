/**
 * Home's Daily cards: how many have played today's Daily Puzzle and Daily Arcade (phase 2 step 3, 14 Nov 2026). Read
 * only: a head-only count of today's finished attempts (src/lib/data/async.server.ts countFinishedAttempts), shown
 * only from DAILY_COUNT_MIN players (the Daily's own cold-start rule, shownPlayerCount), else null. No session needed
 * and nothing about the caller is read; each Worker keeps an answer for a minute, so Home's visits cost one count a
 * minute, not one each.
 *
 *   dailyPlayedTodayFn({ data: { kinds?: ("puzzle" | "arcade")[] } })  { day, puzzle, arcade }
 */
import { createServerFn } from "@tanstack/react-start";

import { listOf, oneOf, optional, record } from "@/lib/validate";

export type DailyPlayedKind = "puzzle" | "arcade";
export interface DailyPlayedToday {
  day: string;
  puzzle: number | null;
  arcade: number | null;
}

const KINDS: readonly DailyPlayedKind[] = ["puzzle", "arcade"];
const KEEP_MS = 60_000;
let kept: { at: number; answer: DailyPlayedToday } | null = null;

export const dailyPlayedTodayFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    // Nothing sent asks for both; anything else must be an object.
    const body = record(input === undefined ? {} : input);
    return {
      kinds: optional(body["kinds"], (v) => listOf(v, 2, (k, field) => oneOf(k, KINDS, field), "kinds")) ?? [...KINDS],
    };
  })
  .handler(async ({ data }): Promise<DailyPlayedToday> => {
    const nowMs = Date.now();
    const { ukDayKey } = await import("@/lib/duel/daily");
    const day = ukDayKey(nowMs);
    const pick = (a: DailyPlayedToday): DailyPlayedToday => ({
      day: a.day,
      puzzle: data.kinds.includes("puzzle") ? a.puzzle : null,
      arcade: data.kinds.includes("arcade") ? a.arcade : null,
    });
    if (kept && kept.answer.day === day && nowMs - kept.at < KEEP_MS) return pick(kept.answer);
    const answer: DailyPlayedToday = { day, puzzle: null, arcade: null };
    try {
      const { adminDb } = await import("@/lib/data/db.server");
      const client = await adminDb();
      const { dailyRoom } = await import("@/lib/duel/daily.server");
      const { shownPlayerCount } = await import("@/lib/duel/daily");
      const { countFinishedAttempts } = await import("@/lib/data/async.server");
      for (const kind of KINDS) {
        const room = await dailyRoom(client, kind, day);
        if (!room) continue;
        const { data: n } = await countFinishedAttempts(client, room.id);
        answer[kind] = n === null ? null : shownPlayerCount(n);
      }
      kept = { at: nowMs, answer };
    } catch (err) {
      console.warn(`[home] daily counts: ${err instanceof Error ? err.message : String(err)}`);
    }
    return pick(answer);
  });
