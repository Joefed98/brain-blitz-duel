/**
 * Leaderboards: the server's rules for the calls the screens make (wave 4, session W4a; docs/leaderboards.md). Reads
 * only: every board is the stored snapshot (refreshed every few minutes by pg_cron's public.leaderboard_refresh), read
 * through src/lib/data/leaderboards.server.ts for the signed-in caller, who may only ever name a board, never another
 * player. Privacy is applied in the SQL for that caller. Friends boards and the setting need an account; guests can
 * read the global and Daily boards (with no row of their own).
 */
import {
  readBoardVisibility,
  readDailyBoard,
  readRatingBoard,
  writeBoardVisibility,
} from "@/lib/data/leaderboards.server";
import { cardBadgesFor } from "@/lib/badges/badges.server";
import { readPublicCards } from "@/lib/data/economy.server";
import { recordEvents } from "@/lib/data/events.server";
import { readDateOfBirth } from "@/lib/data/profiles.server";
import type { Db } from "@/lib/data/db.server";
import { ukDayKey } from "@/lib/duel/daily";
import { withinRateLimit, type RateLimit } from "@/lib/duel/rateLimit.server";

import {
  DAILY_ROOM_KIND,
  RATING_BOARD_TOP,
  RATING_PAGE,
  isDailyKind,
  isDailyScope,
  isDayKey,
  isPeriod,
  isRatingBoard,
  isScope,
  type BoardCard,
  type BoardRow,
  type BoardVisibility,
  type DailyBoardPage,
  type RatingBoardPage,
} from "./boards";

/** Board reads (a page each, scrolling included): 300 per 10 minutes per user. */
export const LEADERBOARD_READ_LIMIT: RateLimit = { bucket: "leaderboard-read", max: 300, windowSeconds: 600 };
/** "Show me on leaderboards" changes: 30 per 10 minutes per user. */
export const LEADERBOARD_SETTING_LIMIT: RateLimit = { bucket: "leaderboard-setting", max: 30, windowSeconds: 600 };

export type LeaderboardRefusalReason = "account" | "bad_board" | "busy" | "error";

export const LEADERBOARD_MESSAGES: Record<LeaderboardRefusalReason, string> = {
  account: "Friends boards need an account.",
  bad_board: "That board doesn’t exist.",
  busy: "Too many tries. Wait a few minutes and try again.",
  error: "We couldn’t load the board. Try again in a moment.",
};

export type LeaderboardRefusal = { ok: false; reason: LeaderboardRefusalReason; message: string };
export type Answer<T> = ({ ok: true } & T) | LeaderboardRefusal;

export function refusal(reason: LeaderboardRefusalReason): LeaderboardRefusal {
  return { ok: false, reason, message: LEADERBOARD_MESSAGES[reason] };
}

/** A board row as the SQL answers it: a visible row also carries its player's id, for the server alone. */
type StoredRow = BoardRow & { pid?: string | null };

/**
 * Every visible row's card (Joe's rule, 11 Nov 2026), read through A1's public cards in one call per page (at most
 * 100 ids a call, so a Daily top 100 with ties and the pinned row takes two), then every row's id removed: the phone
 * never gets another player's id. A failed read leaves the rows without cards (colour and initial).
 */
async function attachCards(client: Db, rows: readonly StoredRow[]): Promise<BoardRow[]> {
  const ids = [...new Set(rows.map((r) => r.pid).filter((id): id is string => typeof id === "string"))];
  const cards = new Map<string, BoardCard>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await readPublicCards(client, ids.slice(i, i + 100));
    if (error) {
      console.warn(`[leaderboards] cards: ${error.message}`);
      break;
    }
    // C2's badges and title on the same cards (one read a chunk; a failure leaves the cards without badges).
    const worn = new Map((await cardBadgesFor(client, ids.slice(i, i + 100)).catch(() => [])).map((b) => [b.playerId, b]));
    for (const c of data)
      cards.set(c.user_id, {
        avatarId: c.avatar_id,
        colour: c.colour,
        gem: c.gem,
        cardArt: c.card_art,
        frame: c.frame,
        nameColour: c.name_colour,
        badges: worn.get(c.user_id)?.badges ?? [],
        title: worn.get(c.user_id)?.title ?? null,
      });
  }
  return rows.map(({ pid, ...row }) => {
    const card = pid ? cards.get(pid) : undefined;
    if (row.hidden) {
      const { tier: _tier, ...plain } = row;
      return plain;
    }
    return card ? { ...row, card } : row;
  });
}

/** The page's rows and pinned row, with cards and without ids, in one read of the cards. */
async function withCards<P extends { rows?: BoardRow[] | undefined; me?: BoardRow | null | undefined }>(client: Db, page: P): Promise<P> {
  const rows = (page.rows ?? []) as StoredRow[];
  const me = (page.me ?? null) as StoredRow | null;
  const done = await attachCards(client, me ? [...rows, me] : rows);
  return { ...page, ...(page.rows ? { rows: done.slice(0, rows.length) } : {}), ...(me ? { me: done[rows.length]! } : {}) };
}

async function isAccount(client: Db, userId: string): Promise<boolean> {
  const { data } = await readDateOfBirth(client, userId);
  return data !== null;
}

/** A rating board page: { board, scope, period, offset }. Records leaderboard_viewed on the first page only. */
export async function ratingBoard(client: Db, userId: string, input: unknown): Promise<Answer<{ page: RatingBoardPage }>> {
  const i = (input ?? {}) as Record<string, unknown>;
  const board = i["board"];
  const scope = i["scope"];
  const period = i["period"];
  const offset = typeof i["offset"] === "number" && Number.isInteger(i["offset"]) ? (i["offset"] as number) : 0;
  const limit = typeof i["limit"] === "number" && Number.isInteger(i["limit"]) ? (i["limit"] as number) : RATING_PAGE;
  if (!isRatingBoard(board) || !isScope(scope) || !isPeriod(period) || offset < 0 || offset >= RATING_BOARD_TOP || limit < 1)
    return refusal("bad_board");
  if (scope === "friends" && !(await isAccount(client, userId))) return refusal("account");
  if (!(await withinRateLimit(client, userId, LEADERBOARD_READ_LIMIT))) return refusal("busy");
  const { data, error } = await readRatingBoard(client, {
    viewer: userId,
    board,
    period,
    scope,
    offset,
    limit: Math.min(limit, RATING_PAGE),
  });
  if (error || !data) return refusal("error");
  if (data.reason === "bad_board") return refusal("bad_board");
  if (offset === 0) recordEvents({ event: "leaderboard_viewed", playerId: userId, props: { board, scope, period } });
  return { ok: true, page: await withCards(client, data) };
}

/** A Daily board: { kind, day (YYYY-MM-DD, today's UK day when left out), scope }. Records daily_board_viewed. */
export async function dailyBoard(
  client: Db,
  userId: string,
  input: unknown,
  nowMs: number = Date.now(),
): Promise<Answer<{ page: DailyBoardPage }>> {
  const i = (input ?? {}) as Record<string, unknown>;
  const kind = i["kind"];
  const scope = i["scope"] ?? "top100";
  const day = i["day"] ?? ukDayKey(nowMs);
  if (!isDailyKind(kind) || !isDailyScope(scope) || !isDayKey(day)) return refusal("bad_board");
  if (scope === "friends" && !(await isAccount(client, userId))) return refusal("account");
  if (!(await withinRateLimit(client, userId, LEADERBOARD_READ_LIMIT))) return refusal("busy");
  const { data, error } = await readDailyBoard(client, { viewer: userId, kind: DAILY_ROOM_KIND[kind], day, scope });
  if (error || !data) return refusal("error");
  if (data.reason === "bad_board") return refusal("bad_board");
  recordEvents({ event: "daily_board_viewed", playerId: userId, props: { kind, day } });
  return { ok: true, page: await withCards(client, data) };
}

/** "Show me on leaderboards": the caller's state (accounts only). */
export async function visibility(client: Db, userId: string): Promise<Answer<{ visibility: BoardVisibility }>> {
  if (!(await withinRateLimit(client, userId, LEADERBOARD_READ_LIMIT))) return refusal("busy");
  const { data, error } = await readBoardVisibility(client, userId);
  if (error) return refusal("error");
  if (!data) return refusal("account");
  return { ok: true, visibility: data };
}

/** Sets "Show me on leaderboards": { show: true | false | null } (null: the default for the player's age). */
export async function setVisibility(client: Db, userId: string, input: unknown): Promise<Answer<{ visibility: BoardVisibility }>> {
  const show = (input as { show?: unknown } | null)?.show;
  if (show !== true && show !== false && show !== null) return refusal("bad_board");
  if (!(await withinRateLimit(client, userId, LEADERBOARD_SETTING_LIMIT))) return refusal("busy");
  const { data: done, error } = await writeBoardVisibility(client, userId, show);
  if (error) return refusal("error");
  if (!done) return refusal("account");
  return visibility(client, userId);
}
