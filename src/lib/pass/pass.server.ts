/**
 * The Season pass on the server (wave 2, train D, session D2; docs/economy/pass.md). Server only; the phone reaches it
 * through pass.functions.ts. Every database access is a typed function in src/lib/data (pass.server.ts,
 * profiles.server.ts, shop.server.ts); coins, items and consumables are paid only through A1's helpers
 * (economy.server.ts), each under the claim's own idempotency key.
 *
 * Who: the shop's testers (shop.testers, D1's one list) while PASS_FOR_EVERYONE is off, every account once it is on;
 * guests never. Test purchases are testers only, always.
 *
 * Joules are worked out from stored results only (public.pass_activity): every time the pass is read, the stored play
 * since the season's start (for this account) is credited once per source event through public.pass_credit_joules,
 * which applies the day limits and the soft cap per UK day under a lock. Nothing here is read by scoring, grading,
 * replay, matchmaking or timing (economy-neutral-check), and no game's play changes.
 */
import { PASS_FOR_EVERYONE } from "@/config/passConfig";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  creditJoulesRpc,
  grantPremiumRpc,
  noteLevelRpc,
  readActivity,
  readGamesBefore,
  readJoulesSince,
  readMemberReset,
  readPassState,
  readPassTitles,
  readPassWeek,
  readSeasons,
  recordClaimRpc,
  recordPassWeek,
  unlockTitleRpc,
  type ActivityRow,
  type GrantPremiumStatus,
  type JoulesRow,
  type PassSeasonRow,
  type PassStateRow,
} from "@/lib/data/pass.server";
import { readProfile } from "@/lib/data/profiles.server";
import { readIsTester } from "@/lib/data/shop.server";
import { arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { PUZZLE_CATALOGUE, type GameInfo } from "@/lib/duel/catalogue";
import { catalogue, creditCoins, grantConsumable, grantItem } from "@/lib/economy/economy.server";

import { shiftDay, ukDay, ukMidnight } from "./ukDays";
import { JOULES, ratedMatchJoules, tournamentJoules, WEEKLY_JOULES, type JoulesKind } from "./joules";
import {
  levelProgress,
  PASS_LEVELS,
  PASS_TITLES,
  PREMIUM_ON_PURCHASE_LEVEL,
  reached,
  rewardAt,
  rewardLabel,
  type PassReward,
  type PassTrack,
} from "./rewards";
import { PASS_MESSAGES, type PassActionResult, type PassCell, type PassClosed, type PassRefusal, type PassView, type PassWeekly } from "./types";
import {
  nextWeek,
  progressOf,
  WEEKLY_BY_ID,
  WEEKLY_TIERS,
  weeklySetFor,
  weekStartOf,
  type GameCategory,
  type PlayedGame,
  type WeeklyChallenge,
  type WeekActivity,
} from "./weekly";

/** After a season ends, its pass stays open this long for claiming rewards already reached (nothing more is earned). */
export const CLAIM_GRACE_DAYS = 14;
/** At most this many weeks back are checked for weekly challenges completed but not yet paid. */
export const WEEKLY_LOOKBACK = 26;

const DAY_MS = 86_400_000;

function refuse(reason: PassRefusal): PassActionResult {
  return { ok: false, reason, message: PASS_MESSAGES[reason] };
}

/* ------------------------------------------------------------------ who, and which season */

export interface PassAccess {
  account: boolean;
  tester: boolean;
}

export async function passAccess(client: Db, userId: string): Promise<PassAccess> {
  const profile = await readProfile(client, userId);
  if (profile.error) throw new Error(`pass: ${profile.error.message}`);
  const account = profile.data !== null && profile.data.deletion_requested_at === null;
  if (!account) return { account: false, tester: false };
  const tester = await readIsTester(client, userId);
  if (tester.error) throw new Error(`pass: ${tester.error.message}`);
  return { account, tester: tester.data };
}

export interface ActiveSeason {
  row: PassSeasonRow;
  test: boolean;
  /** This account's start in the season (ms): the season's start, moved on by a test-season reset. */
  epoch: number;
  endMs: number | null;
  /** Joules are earned and weekly challenges shown (before the end); after it, only claiming. */
  live: boolean;
}

const ms = (iso: string | null): number | null => (iso ? Date.parse(iso) : null);

function visible(row: PassSeasonRow, nowMs: number): boolean {
  const start = ms(row.starts_at);
  if (start === null || start > nowMs) return false;
  const end = ms(row.ends_at);
  return end === null || nowMs < end + CLAIM_GRACE_DAYS * DAY_MS;
}

/**
 * The season this account sees now: a tester sees the test season while it runs, else the live real season; anyone
 * else sees a real season only with PASS_FOR_EVERYONE on. `enabled` is for checks.
 */
export async function activeSeason(
  client: Db,
  userId: string,
  access: PassAccess,
  nowMs: number,
  enabled: boolean = PASS_FOR_EVERYONE,
): Promise<ActiveSeason | null> {
  if (!access.account || !(access.tester || enabled)) return null;
  const seasons = await readSeasons(client);
  if (seasons.error) throw new Error(`pass: ${seasons.error.message}`);
  const shown = seasons.data.filter((s) => visible(s, nowMs));
  const test = access.tester ? shown.find((s) => s.kind === "test") : undefined;
  const real = shown
    .filter((s) => s.kind === "season")
    .sort((a, b) => (ms(b.starts_at) ?? 0) - (ms(a.starts_at) ?? 0))[0];
  const row = test ?? real;
  if (!row) return null;
  let epoch = ms(row.starts_at)!;
  if (row.kind === "test") {
    const reset = ms(row.reset_at);
    if (reset !== null) epoch = Math.max(epoch, reset);
    const own = await readMemberReset(client, userId, row.id);
    if (own.error) throw new Error(`pass: ${own.error.message}`);
    const ownMs = ms(own.data);
    if (ownMs !== null) epoch = Math.max(epoch, ownMs);
  }
  const endMs = ms(row.ends_at);
  return { row, test: row.kind === "test", epoch, endMs, live: endMs === null || nowMs < endMs };
}

/* ------------------------------------------------------------------ stored results → source events */

export function categoryOf(game: string | null): GameCategory | null {
  if (!game) return null;
  const group = arcadeGroupOf(game);
  if (group) return group;
  const info = (PUZZLE_CATALOGUE as Record<string, GameInfo | undefined>)[game];
  const cat = info?.category;
  return cat && cat !== "arcade" ? (cat as GameCategory) : null;
}

const JOULES_OF: Partial<Record<string, { kind: JoulesKind; base: number }>> = {
  room_round: { kind: "room_round", base: JOULES.room_round },
  room_finish: { kind: "room_finish", base: JOULES.room_finish },
  daily_puzzle: { kind: "daily_puzzle", base: JOULES.daily_puzzle },
  daily_arcade: { kind: "daily_arcade", base: JOULES.daily_arcade },
  challenge: { kind: "challenge", base: JOULES.challenge },
  practice: { kind: "practice", base: JOULES.practice },
  practice_challenge: { kind: "practice_challenge", base: JOULES.practice_challenge },
};

/** The Joules rows for stored source events (rounds of a Daily or a friend challenge, and stars, pay nothing alone). */
export function joulesRowsFor(activity: readonly ActivityRow[]): JoulesRow[] {
  const rows: JoulesRow[] = [];
  for (const a of activity) {
    const pay = JOULES_OF[a.k];
    if (pay) rows.push({ key: a.key, kind: pay.kind, base: pay.base, at: a.at });
  }
  return rows;
}

const GAME_MODES: Partial<Record<string, PlayedGame["mode"]>> = {
  room_round: "room",
  daily_puzzle_round: "daily_puzzle",
  daily_arcade_round: "daily_arcade",
  challenge_round: "challenge",
  practice: "practice",
};

/** The games played in the stored activity (each room, Daily or challenge round, and each Practice run). */
export function playedGames(activity: readonly ActivityRow[]): PlayedGame[] {
  const games: PlayedGame[] = [];
  for (const a of activity) {
    const mode = GAME_MODES[a.k];
    if (!mode || !a.game) continue;
    games.push({
      mode,
      game: a.game,
      category: categoryOf(a.game),
      score: a.score ?? 0,
      day: a.day ?? ukDay(Date.parse(a.at)),
    });
  }
  return games;
}

/* ------------------------------------------------------------------ weeks */

/** A week's UK window (Monday midnight to the next), ms. */
export function weekWindow(weekStart: string): { from: number; to: number } {
  return { from: ukMidnight(weekStart), to: ukMidnight(nextWeek(weekStart)) };
}

/** The week's three as recorded (recorded from the draw the first time anyone's pass reads the week). */
export async function ensureWeek(client: Db, weekStart: string): Promise<{ easy: string; medium: string; hard: string }> {
  const found = await readPassWeek(client, weekStart);
  if (found.error) throw new Error(`pass: ${found.error.message}`);
  if (found.data) return found.data;
  const set = weeklySetFor(weekStart);
  const wrote = await recordPassWeek(client, { weekStart, easy: set.easy, medium: set.medium, hard: set.hard });
  if (wrote.error) throw new Error(`pass: ${wrote.error.message}`);
  const again = await readPassWeek(client, weekStart);
  if (again.error || !again.data) throw new Error(`pass: ${again.error?.message ?? "week not recorded"}`);
  return again.data;
}

interface WeekResult {
  weekStart: string;
  challenges: { c: WeeklyChallenge; done: number; need: number }[];
}

async function weekProgress(
  client: Db,
  userId: string,
  weekStart: string,
  activity: readonly ActivityRow[],
  fromMs: number,
  toMs: number,
): Promise<WeekResult> {
  const picks = await ensureWeek(client, weekStart);
  const inWeek = activity.filter((a) => {
    const t = Date.parse(a.at);
    return t >= fromMs && t < toMs;
  });
  const challenges = WEEKLY_TIERS.map((tier) => WEEKLY_BY_ID.get(picks[tier])).filter((c): c is WeeklyChallenge => !!c);
  let before: ReadonlySet<string> = new Set();
  if (challenges.some((c) => c.rule.k === "new_game")) {
    const played = await readGamesBefore(client, userId, new Date(weekWindow(weekStart).from).toISOString());
    if (played.error) throw new Error(`pass: ${played.error.message}`);
    before = new Set(played.data);
  }
  const week: WeekActivity = {
    games: playedGames(inWeek),
    stars: inWeek.filter((a) => a.k === "star" && a.game).map((a) => a.game!),
    practiceChallenges: inWeek.filter((a) => a.k === "practice_challenge").length,
    playedBefore: before,
  };
  return { weekStart, challenges: challenges.map((c) => ({ c, ...progressOf(c, week) })) };
}

/* ------------------------------------------------------------------ the sync */

export interface SyncOutcome {
  state: PassStateRow;
  week: WeekResult | null;
}

/**
 * Credits the stored play since this account's start in the season (once per source event), the weekly challenges
 * completed in any week of the season so far, and records pass_level_reached for each new level. Answers the state.
 */
export async function syncPass(client: Db, userId: string, season: ActiveSeason, nowMs: number): Promise<SyncOutcome> {
  const until = season.endMs === null ? nowMs : Math.min(nowMs, season.endMs);
  let current: WeekResult | null = null;
  if (until > season.epoch) {
    const activity = await readActivity(client, {
      userId,
      fromIso: new Date(season.epoch).toISOString(),
      toIso: new Date(until).toISOString(),
    });
    if (activity.error) throw new Error(`pass: ${activity.error.message}`);
    const rows = joulesRowsFor(activity.data);

    // Weekly challenges: every week of the season so far (the latest WEEKLY_LOOKBACK), inside the season.
    const lastWeek = weekStartOf(ukDay(until - 1));
    let week = weekStartOf(ukDay(season.epoch));
    const earliest = shiftDay(lastWeek, -7 * (WEEKLY_LOOKBACK - 1));
    if (week < earliest) week = earliest;
    for (; week <= lastWeek; week = nextWeek(week)) {
      const w = weekWindow(week);
      const from = Math.max(w.from, season.epoch);
      const to = Math.min(w.to, until);
      const result = await weekProgress(client, userId, week, activity.data, from, to);
      if (week === lastWeek && season.live) current = result;
      for (const { c, done, need } of result.challenges) {
        if (done < need) continue;
        const last = activity.data.filter((a) => {
          const t = Date.parse(a.at);
          return t >= from && t < to;
        });
        const at = last.length ? last[last.length - 1]!.at : new Date(from).toISOString();
        rows.push({ key: `weekly:${week}:${c.tier}:${c.id}`, kind: "weekly", base: WEEKLY_JOULES[c.tier], at });
      }
    }
    if (rows.length) {
      const credited = await creditJoulesRpc(client, { userId, seasonId: season.row.id, epoch: season.epoch, rows });
      if (credited.error) throw new Error(`pass: ${credited.error.message}`);
      for (const out of credited.data ?? []) {
        if (out.status !== "credited" || !out.key.startsWith("weekly:")) continue;
        const [, , tier, id] = out.key.split(":");
        recordEvents({ event: "weekly_challenge_completed", playerId: userId, props: { tier: tier ?? null, challenge: id ?? null } });
      }
    }
  }
  const state = await readPassState(client, userId, season.row.id, season.epoch);
  if (state.error || !state.data) throw new Error(`pass: ${state.error?.message ?? "no state"}`);
  const level = levelProgress(state.data.joules).level;
  if (level > state.data.levelReached) {
    const before = await noteLevelRpc(client, { userId, seasonId: season.row.id, epoch: season.epoch, level, seen: false });
    if (before.error) throw new Error(`pass: ${before.error.message}`);
    if (before.data !== null)
      for (let l = before.data + 1; l <= level; l++)
        recordEvents({ event: "pass_level_reached", playerId: userId, props: { season: season.row.id, level: l } });
    state.data.levelReached = Math.max(state.data.levelReached, level);
  }
  return { state: state.data, week: current };
}

/* ------------------------------------------------------------------ paying a reward */

const claimKey = (season: ActiveSeason, track: PassTrack, level: number) => `pass:${season.row.id}:${season.epoch}:${track}:${level}`;

/** Pays one reward through A1's helpers (idempotent under the claim's key) and records the claim once. */
async function payAndRecord(
  client: Db,
  userId: string,
  season: ActiveSeason,
  track: PassTrack,
  level: number,
  reward: PassReward,
): Promise<"claimed" | "duplicate"> {
  const key = claimKey(season, track, level);
  const ref = { kind: "pass", id: `${season.row.id}:${track}:${level}` };
  // The testers' season pays test rewards (removable in one call by Joe's pass.remove_test_season_rewards).
  const reason = season.test ? "test_pass_reward" : "pass_reward";
  switch (reward.kind) {
    case "item": {
      const status = await grantItem(client, { userId, itemId: reward.item, how: "pass" });
      if (status !== "granted" && status !== "owned") throw new Error(`pass: item ${reward.item}: ${status}`);
      break;
    }
    case "coins": {
      const out = await creditCoins(client, { userId, amount: reward.coins, reason, ref, key });
      if (out.status !== "credited" && out.status !== "duplicate") throw new Error(`pass: coins: ${out.status}`);
      break;
    }
    case "ticket":
    case "freeze": {
      const kind = reward.kind === "freeze" ? "streak_freeze" : reward.ticket;
      const out = await grantConsumable(client, { userId, kind, amount: 1, reason, ref, key });
      if (out.status !== "granted" && out.status !== "duplicate") throw new Error(`pass: ${kind}: ${out.status}`);
      break;
    }
    case "title": {
      const out = await unlockTitleRpc(client, { userId, title: reward.title, seasonId: season.row.id });
      if (out.error || !out.data || (out.data !== "unlocked" && out.data !== "already"))
        throw new Error(`pass: title: ${out.error?.message ?? out.data}`);
      break;
    }
  }
  const recorded = await recordClaimRpc(client, { userId, seasonId: season.row.id, epoch: season.epoch, track, level, reward });
  if (recorded.error || !recorded.data || recorded.data === "no_account") throw new Error(`pass: claim: ${recorded.error?.message ?? recorded.data}`);
  if (recorded.data === "claimed")
    recordEvents({ event: "reward_claimed", playerId: userId, props: { season: season.row.id, track, level, kind: reward.kind } });
  return recorded.data;
}

/* ------------------------------------------------------------------ the view */

async function buildView(
  client: Db,
  userId: string,
  season: ActiveSeason,
  access: PassAccess,
  synced: SyncOutcome,
  nowMs: number,
): Promise<PassView> {
  let state = synced.state;
  const premium = state.premium;
  // The Neon Captain Joulz helmet arrives on purchase (and for a premium track granted from elsewhere, here).
  if (premium && !state.claims.some((c) => c.track === "premium" && c.level === PREMIUM_ON_PURCHASE_LEVEL)) {
    const reward = rewardAt("premium", PREMIUM_ON_PURCHASE_LEVEL)!;
    await payAndRecord(client, userId, season, "premium", PREMIUM_ON_PURCHASE_LEVEL, reward);
    const again = await readPassState(client, userId, season.row.id, season.epoch);
    if (again.error || !again.data) throw new Error(`pass: ${again.error?.message ?? "no state"}`);
    state = { ...again.data, levelReached: Math.max(again.data.levelReached, state.levelReached) };
  }
  const items = new Map((await catalogue(client)).map((i) => [i.id, i]));
  const { level, into, of } = levelProgress(state.joules);
  const claimed = new Set(state.claims.map((c) => `${c.track}:${c.level}`));
  const cell = (track: PassTrack, l: number): PassCell | null => {
    const reward = rewardAt(track, l);
    if (!reward) return null;
    const item = reward.kind === "item" ? items.get(reward.item) : undefined;
    const label = rewardLabel(reward, item?.name);
    const detail =
      reward.kind === "item" && item
        ? `${item.game ? `${item.game} · ` : ""}${KIND_WORDS[item.kind] ?? item.kind}`
        : label.detail;
    const isClaimed = claimed.has(`${track}:${l}`);
    return {
      track,
      level: l,
      kind: reward.kind,
      title: label.title,
      detail,
      rarity: item?.rarity ?? null,
      itemId: item?.id ?? null,
      itemKind: item?.kind ?? null,
      state: isClaimed ? "claimed" : reached(track, l, level, !!premium) ? "claimable" : "locked",
      needsPremium: track === "premium" && !premium,
    };
  };
  const levels = Array.from({ length: PASS_LEVELS }, (_, i) => ({ level: i + 1, free: cell("free", i + 1), premium: cell("premium", i + 1) }));
  const weekly: PassView["weekly"] = synced.week
    ? {
        weekStart: synced.week.weekStart,
        challenges: synced.week.challenges.map(
          ({ c, done, need }): PassWeekly => ({
            id: c.id,
            tier: c.tier,
            text: c.text,
            joules: WEEKLY_JOULES[c.tier],
            done,
            need,
            completed: done >= need,
          }),
        ),
      }
    : null;
  const endsAt = season.row.ends_at;
  const endMs = season.endMs;
  return {
    open: true,
    season: {
      id: season.row.id,
      name: season.row.name,
      test: season.test,
      endsAt,
      daysLeft: endMs === null ? null : Math.max(0, Math.ceil((endMs - nowMs) / DAY_MS)),
      ended: !season.live,
    },
    joules: state.joules,
    level,
    into,
    of,
    premium: premium ? { source: premium.source } : null,
    tester: access.tester,
    levels,
    claimable: levels.reduce((n, l) => n + (l.free?.state === "claimable" ? 1 : 0) + (l.premium?.state === "claimable" ? 1 : 0), 0),
    weekly,
    levelNotice: state.levelReached > state.levelSeen && level > state.levelSeen ? level : null,
  };
}

const KIND_WORDS: Record<string, string> = {
  "card-art": "Card art",
  frame: "Frame",
  "name-colour": "Name colour",
  "avatar-special-edition": "Special-edition avatar",
  "avatar-finish": "Avatar finish",
  "avatar-accessory": "Avatar accessory",
  reaction: "Reaction",
  celebration: "Celebration",
  "game-skin": "Game skin",
  "world-theme": "World theme",
  "tile-style": "Tile style",
};

async function openPass(
  client: Db,
  userId: string,
  nowMs: number,
  enabled?: boolean,
): Promise<{ access: PassAccess; season: ActiveSeason } | PassClosed> {
  const access = await passAccess(client, userId);
  if (!access.account) return { open: false, reason: "guest" };
  if (!access.tester && !(enabled ?? PASS_FOR_EVERYONE)) return { open: false, reason: "not_tester" };
  const season = await activeSeason(client, userId, access, nowMs, enabled);
  if (!season) return { open: false, reason: "no_season" };
  return { access, season };
}

/** The pass for this account (syncing its Joules first). */
export async function passViewFor(client: Db, userId: string, nowMs: number, enabled?: boolean): Promise<PassView | PassClosed> {
  const opened = await openPass(client, userId, nowMs, enabled);
  if ("open" in opened) return opened;
  const synced = await syncPass(client, userId, opened.season, nowMs);
  return buildView(client, userId, opened.season, opened.access, synced, nowMs);
}

/** Claims one reward (a tap on the pass screen). Claiming twice pays once. */
export async function claimReward(
  client: Db,
  userId: string,
  input: { track?: unknown; level?: unknown },
  nowMs: number,
  enabled?: boolean,
): Promise<PassActionResult> {
  const track = input.track === "free" || input.track === "premium" ? input.track : null;
  const level = typeof input.level === "number" && Number.isInteger(input.level) ? input.level : null;
  if (!track || level === null) return refuse("no_reward");
  const reward = rewardAt(track, level);
  if (!reward) return refuse("no_reward");
  const opened = await openPass(client, userId, nowMs, enabled);
  if ("open" in opened) return refuse("not_open");
  const synced = await syncPass(client, userId, opened.season, nowMs);
  const premium = !!synced.state.premium;
  if (track === "premium" && !premium) return refuse("needs_premium");
  if (!reached(track, level, levelProgress(synced.state.joules).level, premium)) return refuse("not_reached");
  await payAndRecord(client, userId, opened.season, track, level, reward);
  return { ok: true, view: await buildView(client, userId, opened.season, opened.access, await syncPass(client, userId, opened.season, nowMs), nowMs) };
}

/**
 * A tester's test purchase of the premium track for the season they see: no payment, marked 'test' and removable with
 * Joe's pass.remove_test_purchase. Unlocks every premium reward already passed; the helmet arrives at once.
 */
export async function testPurchase(client: Db, userId: string, nowMs: number, enabled?: boolean): Promise<PassActionResult> {
  const opened = await openPass(client, userId, nowMs, enabled);
  if ("open" in opened) return refuse(opened.reason === "not_tester" ? "not_tester" : "not_open");
  if (!opened.access.tester) return refuse("not_tester");
  const season = opened.season;
  const granted = await grantPremiumRpc(client, {
    userId,
    seasonId: season.row.id,
    source: "test",
    key: `test:${season.row.id}:${season.epoch}`,
  });
  if (granted.error || !granted.data) return refuse("error");
  if (granted.data === "not_tester") return refuse("not_tester");
  if (granted.data === "already") return refuse("already");
  if (granted.data !== "granted") return refuse("error");
  recordEvents({ event: "pass_bought", playerId: userId, props: { season: season.row.id, test: true, source: "test" } });
  const synced = await syncPass(client, userId, season, nowMs);
  return { ok: true, view: await buildView(client, userId, season, opened.access, synced, nowMs) };
}

/**
 * Gives an account the premium track for a season from another source (E2's Joulz Plus, or a real purchase later),
 * idempotently: the same account and season twice is 'already'. Records pass_bought once (test false). When the
 * season is the one the account sees now, the helmet is granted at once; otherwise it arrives with the account's
 * first look at that season's pass. Server only: E2 calls it from its own server code.
 */
export async function grantPremiumTrack(
  client: Db,
  input: { userId: string; seasonId: string; source: "plus" | "purchase"; key: string },
  nowMs: number = Date.now(),
): Promise<GrantPremiumStatus> {
  const granted = await grantPremiumRpc(client, input);
  if (granted.error || !granted.data) throw new Error(`pass: ${granted.error?.message ?? "no answer"}`);
  if (granted.data !== "granted") return granted.data;
  recordEvents({ event: "pass_bought", playerId: input.userId, props: { season: input.seasonId, test: false, source: input.source } });
  try {
    const access = await passAccess(client, input.userId);
    const season = await activeSeason(client, input.userId, access, nowMs);
    if (season && season.row.id === input.seasonId)
      await payAndRecord(client, input.userId, season, "premium", PREMIUM_ON_PURCHASE_LEVEL, rewardAt("premium", PREMIUM_ON_PURCHASE_LEVEL)!);
  } catch (err) {
    // The grant stands; the helmet arrives with the next look at the pass.
    console.warn(`[pass] helmet after grant: ${err instanceof Error ? err.message : String(err)}`);
  }
  return granted.data;
}

/** The level-up notice has been shown up to `level`. */
export async function markLevelSeen(client: Db, userId: string, level: unknown, nowMs: number, enabled?: boolean): Promise<{ ok: boolean }> {
  if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > PASS_LEVELS) return { ok: false };
  const opened = await openPass(client, userId, nowMs, enabled);
  if ("open" in opened) return { ok: false };
  const out = await noteLevelRpc(client, { userId, seasonId: opened.season.row.id, epoch: opened.season.epoch, level, seen: true });
  return { ok: !out.error };
}

/** The results screen's Joules line: Joules credited for play from `sinceMs` on (syncing first). Null: no pass. */
export async function joulesSince(
  client: Db,
  userId: string,
  sinceMs: unknown,
  nowMs: number,
  enabled?: boolean,
): Promise<{ joules: number } | null> {
  if (typeof sinceMs !== "number" || !Number.isFinite(sinceMs) || sinceMs > nowMs + 60_000) return null;
  const opened = await openPass(client, userId, nowMs, enabled);
  if ("open" in opened || !opened.season.live) return null;
  await syncPass(client, userId, opened.season, nowMs);
  const out = await readJoulesSince(client, {
    userId,
    seasonId: opened.season.row.id,
    epoch: opened.season.epoch,
    sinceIso: new Date(Math.max(sinceMs, opened.season.epoch)).toISOString(),
  });
  if (out.error) throw new Error(`pass: ${out.error.message}`);
  return { joules: out.data };
}

/** The pass titles this account has unlocked (Neon Rider, Circuit Breaker), with their names. */
export async function passTitlesFor(client: Db, userId: string): Promise<{ id: string; name: string }[]> {
  const out = await readPassTitles(client, userId);
  if (out.error) throw new Error(`pass: ${out.error.message}`);
  return out.data.filter((t): t is keyof typeof PASS_TITLES => t in PASS_TITLES).map((id) => ({ id, name: PASS_TITLES[id] }));
}

/* ------------------------------------------------------------------ later hooks (named; nothing calls them yet) */

/**
 * Wave 3: credits a rated match's Joules (150 a win, 100 a loss; 1.5× for the longer formats) for the season the
 * account sees, once per match. Not called by anything yet.
 */
export async function creditRatedMatchJoules(
  client: Db,
  input: { userId: string; matchId: string; won: boolean; long: boolean; atMs: number },
): Promise<number> {
  return creditHook(client, input.userId, `rated:${input.matchId}`, "rated", ratedMatchJoules(input), input.atMs);
}

/** Wave 4: credits a tournament's Joules (an Arena duel 100; finishing a Score Attack, Swiss or Knockout 150). Not called yet. */
export async function creditTournamentJoules(
  client: Db,
  input: { userId: string; eventId: string; kind: "arena_duel" | "finished"; atMs: number },
): Promise<number> {
  return creditHook(client, input.userId, `tournament:${input.eventId}`, "tournament", tournamentJoules(input), input.atMs);
}

async function creditHook(client: Db, userId: string, key: string, kind: JoulesKind, base: number, atMs: number): Promise<number> {
  const access = await passAccess(client, userId);
  const season = await activeSeason(client, userId, access, atMs);
  if (!season || !season.live || atMs < season.epoch) return 0;
  const out = await creditJoulesRpc(client, { userId, seasonId: season.row.id, epoch: season.epoch, rows: [{ key, kind, base, at: new Date(atMs).toISOString() }] });
  if (out.error) throw new Error(`pass: ${out.error.message}`);
  return out.data?.[0]?.amount ?? 0;
}
