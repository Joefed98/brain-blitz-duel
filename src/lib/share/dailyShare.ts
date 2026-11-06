/**
 * What a daily's Share sends (22 Oct 2026; shareResult): "I scored 612 on today's Daily Puzzle – can
 * you beat it? <link>", the link being that daily's own page (?ref=daily). Built only from the
 * player's own total, never a round, answer or anyone else's score.
 */
import { DAILY_TITLE, type DailyKind } from "@/lib/duel/daily";

/** The query a daily link carries. */
export const DAILY_REF = "daily";

export function dailyShareLine(kind: DailyKind, total: number): string {
  return `I scored ${total} on today’s ${DAILY_TITLE[kind]} – can you beat it?`;
}

export function dailyShareLink(origin: string, kind: DailyKind): string {
  return `${origin.replace(/\/+$/, "")}/daily?kind=${kind}&ref=${DAILY_REF}`;
}
