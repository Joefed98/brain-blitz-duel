/**
 * The ratings engine (wave 3, session W3a; docs/rated/ratings-interface.md, docs/rated/README.md). Server only.
 *
 *   recordRatedMatch(client, result)   a finished rated match from the match engine: every rating, placement, tier,
 *                                      history row, event, Joules amount and competitive badge, once per match id
 *   getMyRatings / getRatingsFor       a player's ratings as the phone sees them (hidden in placement)
 *   placementStatus                    "Placement 1 of 5"
 *   getTierLadder                      the ladder with each tier's share of rated players
 *   runStandingsJob                    the Cron Trigger's job: ranks, shares, the caps' grace, tiers
 *
 * recordRatedMatch is not a server function: nothing the phone can call reaches it (ratings-check proves it), and the
 * database functions it writes through are the service role's only. It reaches no economy module (ratings-check, in
 * the spirit of economy-neutral-check): the badges (whose Legendaries pay coins) are awarded by rewards.server.ts's
 * finishRatedMatch, which the match engine calls.
 */

import type { Json } from "@/integrations/supabase/types";
import type {
  PlacementStatus,
  PlayerRatings,
  PoolView,
  RatedCategory,
  RatedMatchOutcome,
  RatedMatchResult,
  RatedPlayerChange,
  RatedPool,
  RatedRefusal,
  RatingKey,
  TierLadderRung,
  TierView,
} from "@/lib/data/ratings";
import { RATED_CATEGORIES, RATED_POOLS } from "@/lib/data/ratings";
import {
  applyRatedMatch,
  readRatedState,
  readRatedTierCounts,
  recomputeRatedStandings,
  setRatedTiers,
  type RatedStateRows,
  type TierWrite,
} from "@/lib/data/ratings.server";
import type { Db } from "@/lib/data/db.server";
import { recordEvents, type AnalyticsEvent } from "@/lib/data/events.server";

import type { GlickoState } from "./glicko2";
import {
  applyMatch,
  checkMatch,
  isProvisional,
  isUuid,
  joulzRating,
  JOULZ_WINDOW_MS,
  newProfileState,
  pairKey,
  placementOf,
  type MatchContext,
  type PlayerPre,
  type RatedProfileState,
} from "./match";
import { shownTierFor, tierLadder, tierRank, type TierStanding } from "./tiers";
import { ukDayKey } from "@/lib/duel/daily";

const MESSAGES: Record<RatedRefusal, string> = {
  bad_match: "That match can’t be rated.",
  bad_format: "That match format isn’t rated.",
  bad_players: "That match’s players don’t add up.",
  bad_games: "That match’s games don’t add up.",
  bad_placings: "That match’s placings don’t add up.",
  pool_mismatch: "A game is in the wrong pool.",
  busy: "Ratings are busy. Try again.",
  error: "Something went wrong recording the match.",
};

const refuse = (reason: RatedRefusal): RatedMatchOutcome => ({ ok: false, reason, message: MESSAGES[reason] });

/** The most events in one recordEvents call (record_analytics_events refuses more than 50). */
const EVENT_BATCH = 50;

/** Tries before answering "busy" when players' rows keep changing underneath. */
const APPLY_TRIES = 6;

/* ------------------------------------------------------------------ rows → state */

function profileFrom(rows: RatedStateRows, id: string): { state: RatedProfileState; version: number } {
  const r = rows.profiles.find((p) => p.player_id === id);
  if (!r) return { state: newProfileState(), version: 0 };
  return {
    version: r.version,
    state: {
      placementPlayed: r.placement_played,
      matches: r.matches,
      wins: r.wins,
      winStreak: r.win_streak,
      bestWinStreak: r.best_win_streak,
      comebacks: r.comebacks,
      cleanSweeps: r.clean_sweeps,
      podiums: r.podiums,
      giantSlayers: r.giant_slayers,
      revenges: r.revenges,
      photoFinishes: r.photo_finishes,
      joulz: r.joulz,
      shownTier: r.shown_tier,
      floorGrace: r.floor_grace ?? null,
      peakTier: r.peak_tier,
      top500Ever: r.top500_ever,
    },
  };
}

function ratingsFrom(rows: RatedStateRows, id: string): { ratings: Partial<Record<RatingKey, GlickoState>>; versions: Partial<Record<RatingKey, number>> } {
  const ratings: Partial<Record<RatingKey, GlickoState>> = {};
  const versions: Partial<Record<RatingKey, number>> = {};
  for (const r of rows.ratings) {
    if (r.player_id !== id) continue;
    ratings[r.key] = { rating: r.rating, rd: r.rd, volatility: r.volatility, matches: r.matches, lastAt: r.last_ms };
    versions[r.key] = r.version;
  }
  return { ratings, versions };
}

function standingFrom(rows: RatedStateRows, id: string): TierStanding | null {
  if (!rows.meta) return null;
  const s = rows.standings.find((x) => x.player_id === id);
  return {
    capsActive: rows.meta.caps_active,
    stormOk: s?.storm_ok ?? false,
    top500Ok: s?.top500_ok ?? false,
    rank: s?.rank ?? null,
    share: s?.share ?? null,
  };
}

function recentFrom(rows: RatedStateRows, id: string): Record<RatedPool, number> {
  const r = rows.recent.find((x) => x.player_id === id);
  return { puzzles: r?.puzzles ?? 0, arcade: r?.arcade ?? 0 };
}

const formatLabel = (m: RatedMatchResult) => (m.format.kind === "duel" ? `bo${m.format.bestOf}` : `${m.format.players}p`);

/* ------------------------------------------------------------------ recordRatedMatch */

/**
 * Records a finished rated match (see the file's comment). Idempotent per match id: the same id again answers the
 * stored changes with status "duplicate" and moves nothing.
 */
export async function recordRatedMatch(client: Db, input: unknown, nowMs: number = Date.now()): Promise<RatedMatchOutcome> {
  const checked = checkMatch(input, nowMs);
  if (!checked.ok) return refuse(checked.reason);
  const { match, finishedMs } = checked;
  const ids = match.players.map((p) => p.playerId);
  const runIds = match.players.flatMap((p) => (p.side === "recorded" ? [p.run.runId] : []));
  const day = ukDayKey(finishedMs);

  for (let attempt = 0; attempt < APPLY_TRIES; attempt++) {
    const { data: rows, error } = await readRatedState(client, {
      matchId: match.matchId,
      players: ids,
      day,
      since: new Date(finishedMs - JOULZ_WINDOW_MS).toISOString(),
      runIds,
      rematchOf: match.rematchOf ?? null,
    });
    if (error || !rows) return refuse("error");
    if (rows.outcome) return storedOutcome(match.matchId, rows.outcome);

    const pre: Record<string, PlayerPre> = {};
    const profileVersions: Record<string, number> = {};
    const ratingVersions: Record<string, Partial<Record<RatingKey, number>>> = {};
    for (const id of ids) {
      const prof = profileFrom(rows, id);
      const rat = ratingsFrom(rows, id);
      profileVersions[id] = prof.version;
      ratingVersions[id] = rat.versions;
      pre[id] = { profile: prof.state, ratings: rat.ratings, recentGames: recentFrom(rows, id), standing: standingFrom(rows, id) };
    }
    const pairCounts: Record<string, number> = {};
    for (const p of rows.pairs) pairCounts[pairKey(p.a, p.b)] = p.matches;
    const runUsesToday: Record<string, number> = Object.fromEntries(rows.runs.map((r) => [r.run_id, r.uses]));
    const rematchLosses: Record<string, string[]> = {};
    for (const r of rows.rematch)
      if (r.result === "loss") rematchLosses[r.player_id] = rows.rematch.filter((o) => o.player_id !== r.player_id && o.result === "win").map((o) => o.player_id);
    const ctx: MatchContext = { nowMs, pairCounts, runUsesToday, rematchLosses };

    const after = applyMatch(match, finishedMs, pre, ctx);
    const outcomePlayers = after.players.map((p) => p.change);
    const payload = {
      match_id: match.matchId,
      uk_day: after.ukDay,
      finished_at: new Date(finishedMs).toISOString(),
      rematch_of: match.rematchOf ?? null,
      format: match.format,
      choice: match.choice,
      result: match,
      outcome: outcomePlayers,
      profiles: after.players
        .filter((p) => p.change.side === "live" || p.moved.length > 0)
        .map((p) => ({ player_id: p.playerId, expect: profileVersions[p.playerId]!, counted: p.counted, row: p.profile })),
      ratings: after.players.flatMap((p) =>
        p.moved.map((key) => {
          const s = p.ratings[key]!;
          return {
            player_id: p.playerId,
            key,
            expect: ratingVersions[p.playerId]![key] ?? 0,
            rating: s.rating,
            rd: s.rd,
            volatility: s.volatility,
            matches: s.matches,
            last_ms: s.lastAt,
          };
        }),
      ),
      players: after.players.map((p) => {
        const mp = match.players.find((x) => x.playerId === p.playerId)!;
        return {
          player_id: p.playerId,
          side: mp.side,
          run_id: mp.side === "recorded" ? mp.run.runId : null,
          run_source: mp.side === "recorded" ? mp.run.source : null,
          result: p.change.result,
          place: p.change.place,
          counted: p.counted,
          moved: p.change.moved,
          frozen: p.change.frozen,
          joules: p.change.joules,
          puzzles_games: p.games.puzzles,
          arcade_games: p.games.arcade,
          changes: p.change.changes,
        };
      }),
      games: match.games.map((g, idx) => ({ idx, type: g.type, pool: g.pool, category: g.category, version: g.version, signature: g.signature, scores: g.scores })),
      pairs: after.pairs.map((k) => {
        const [a, b] = k.split(":") as [string, string];
        return { a, b, expect: pairCounts[k] ?? 0 };
      }),
      run_uses: after.runUses.map((u) => ({ run_id: u.runId, owner_id: u.ownerId, moved: u.moved })),
      flags: after.flags.map((f) => ({ player_id: f.playerId, game_idx: f.gameIdx, game: f.game, reason: f.reason })),
    };
    const { data: applied, error: aErr } = await applyRatedMatch(client, payload as unknown as Json);
    if (aErr || !applied) return refuse("error");
    if (applied.status === "stale") continue;
    if (applied.status === "duplicate") return storedOutcome(match.matchId, applied.outcome);

    // Recorded: events, then badges (the database holds the facts now).
    const events: AnalyticsEvent[] = [];
    const recordedOpp = match.players.some((p) => p.side === "recorded");
    for (const p of after.players) {
      if (p.change.side !== "live") continue;
      events.push({
        event: "rated_match_finished",
        playerId: p.playerId,
        props: { format: formatLabel(match), choice: match.choice, result: p.change.result, opponent: recordedOpp ? "recorded" : "live" },
      });
      if (p.change.placement.justFinished && p.change.tier.after)
        events.push({ event: "placement_finished", playerId: p.playerId, props: { tier: p.change.tier.after.tier } });
      const tb = p.change.tier.before;
      const ta = p.change.tier.after;
      if (tb && ta && tb.tier !== ta.tier) events.push({ event: "tier_changed", playerId: p.playerId, props: { from: tb.tier, to: ta.tier } });
    }
    recordEvents(events);
    return { ok: true, status: "recorded", matchId: match.matchId, players: outcomePlayers };
  }
  return refuse("busy");
}

function storedOutcome(matchId: string, outcome: Json): RatedMatchOutcome {
  const players = (Array.isArray(outcome) ? outcome : []) as unknown as RatedPlayerChange[];
  return { ok: true, status: "duplicate", matchId, players };
}

/** The competitive badges rated play earns (catalogue order). */
export const RATED_BADGES: readonly string[] = [
  "first-win",
  "placed",
  "hot-streak",
  "comeback-kid",
  "clean-sweep",
  "podium-regular",
  "unstoppable",
  "giant-slayer",
  "storm-chaser",
  "lightning-strikes",
  "top-500",
  "revenge",
  "photo-finish",
];

/* ------------------------------------------------------------------ reads */

function poolView(state: GlickoState | undefined): PoolView {
  if (!state) return { status: "not_played" };
  return { status: "rated", rating: Math.round(state.rating), rd: Math.round(state.rd), matches: state.matches, provisional: isProvisional(state) };
}

function ratingsView(rows: RatedStateRows, id: string): PlayerRatings {
  const { state } = profileFrom(rows, id);
  const placement = placementOf(state.placementPlayed);
  if (!placement.done) return { playerId: id, placement, joulz: null, tier: null, pools: null, categories: null };
  const { ratings } = ratingsFrom(rows, id);
  const joulz = joulzRating({ puzzles: ratings.puzzles, arcade: ratings.arcade }, recentFrom(rows, id));
  const pools = Object.fromEntries(RATED_POOLS.map((k) => [k, poolView(ratings[k])])) as Record<RatedPool, PoolView>;
  const categories = Object.fromEntries(RATED_CATEGORIES.map((k) => [k, poolView(ratings[k])])) as Record<RatedCategory, PoolView>;
  return {
    playerId: id,
    placement,
    joulz: joulz === null ? null : Math.round(joulz),
    tier: joulz === null ? null : shownTierFor({ tier: state.shownTier, floorGrace: state.floorGrace }, joulz, standingFrom(rows, id), false).view,
    pools,
    categories,
  };
}

async function stateFor(client: Db, ids: readonly string[], nowMs: number): Promise<RatedStateRows | null> {
  const { data, error } = await readRatedState(client, {
    matchId: null,
    players: ids,
    day: ukDayKey(nowMs),
    since: new Date(nowMs - JOULZ_WINDOW_MS).toISOString(),
    runIds: [],
    rematchOf: null,
  });
  if (error) throw new Error(`ratings: ${error.message}`);
  return data;
}

/** The signed-in player's ratings. */
export async function getMyRatings(client: Db, userId: string, nowMs: number = Date.now()): Promise<PlayerRatings> {
  const rows = await stateFor(client, [userId], nowMs);
  return ratingsView(rows!, userId);
}

/** Another player's ratings (the same hiding as one's own). Unknown ids: a player who hasn't played. */
export async function getRatingsFor(client: Db, playerId: unknown, nowMs: number = Date.now()): Promise<PlayerRatings | null> {
  if (!isUuid(playerId)) return null;
  const rows = await stateFor(client, [playerId], nowMs);
  return ratingsView(rows!, playerId);
}

/**
 * The tiers other players see for up to 100 players at once (each exactly getRatingsFor's `tier`: null while in placement
 * or before a rated match). For pages that draw many players, e.g. the tournament boards' nameplates (one read).
 */
export async function shownTiersFor(client: Db, playerIds: readonly unknown[], nowMs: number = Date.now()): Promise<Map<string, TierView | null>> {
  const ids = [...new Set(playerIds.filter(isUuid))].slice(0, 100) as string[];
  if (!ids.length) return new Map();
  const rows = await stateFor(client, ids, nowMs);
  return new Map(ids.map((id) => [id, ratingsView(rows!, id).tier]));
}

export async function placementStatus(client: Db, userId: string, nowMs: number = Date.now()): Promise<PlacementStatus> {
  const rows = await stateFor(client, [userId], nowMs);
  return placementOf(profileFrom(rows!, userId).state.placementPlayed);
}

/** The ladder, each tier with its share of placed players (null before anyone has placed). */
export async function getTierLadder(client: Db): Promise<TierLadderRung[]> {
  const { data, error } = await readRatedTierCounts(client);
  if (error) throw new Error(`ratings: ${error.message}`);
  const total = Object.values(data).reduce((s, n) => s + (n ?? 0), 0);
  if (!total) return tierLadder();
  const shares = Object.fromEntries(Object.entries(data).map(([t, n]) => [t, (n ?? 0) / total]));
  return tierLadder(shares);
}

/* ------------------------------------------------------------------ the standings job */

export interface StandingsJobResult {
  ratedPlayers: number;
  capsActive: boolean;
  /** Players whose shown tier changed. */
  changed: { playerId: string; from: TierView["tier"] | null; to: TierView["tier"] }[];
}

/**
 * Recomputes the standings (ranks, shares, the caps and their 3-day grace, the 90-day Joulz Ratings), then each
 * affected player's tier; records tier_changed. The Cron Trigger runs it through rewards.server.ts
 * (runStandingsAndBadges), which then checks the tier badges (Storm Chaser, Lightning Strikes, Top 500).
 */
export async function runStandingsJob(client: Db, nowMs: number = Date.now()): Promise<StandingsJobResult> {
  const { data, error } = await recomputeRatedStandings(client, new Date(nowMs).toISOString());
  if (error || !data) throw new Error(`ratings standings: ${error?.message ?? "no answer"}`);
  const writes: TierWrite[] = [];
  const changed: StandingsJobResult["changed"] = [];
  const peaks = await peakTiers(client, data.players.map((p) => p.player_id), nowMs);
  for (const p of data.players) {
    const standing = { capsActive: data.caps_active, stormOk: p.storm_ok, top500Ok: p.top500_ok, rank: p.rank, share: p.share };
    // The job never advances the tier floor grace (only counted matches do); a moving window can start it.
    const shown = shownTierFor({ tier: p.shown_tier, floorGrace: p.floor_grace ?? null }, p.joulz, standing, false);
    const view = shown.view;
    if (view.tier === p.shown_tier && shown.floorGrace === (p.floor_grace ?? null)) continue;
    const peak = peaks[p.player_id] ?? null;
    writes.push({
      player_id: p.player_id,
      shown_tier: view.tier,
      floor_grace: shown.floorGrace,
      peak_tier: !peak || tierRank(view.tier) > tierRank(peak) ? view.tier : peak,
      top500_ever: view.tier === "top500",
    });
    if (view.tier !== p.shown_tier) changed.push({ playerId: p.player_id, from: p.shown_tier, to: view.tier });
  }
  for (let i = 0; i < writes.length; i += 500) {
    const { error: wErr } = await setRatedTiers(client, writes.slice(i, i + 500));
    if (wErr) throw new Error(`ratings tiers: ${wErr.message}`);
  }
  // record_analytics_events takes at most 50 events a call.
  const tierEvents = changed.filter((c) => c.from).map((c) => ({ event: "tier_changed" as const, playerId: c.playerId, props: { from: c.from!, to: c.to } }));
  for (let i = 0; i < tierEvents.length; i += EVENT_BATCH) recordEvents(tierEvents.slice(i, i + EVENT_BATCH));
  return { ratedPlayers: data.rated_players, capsActive: data.caps_active, changed };
}

async function peakTiers(client: Db, ids: readonly string[], nowMs: number): Promise<Record<string, TierView["tier"] | null>> {
  const out: Record<string, TierView["tier"] | null> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const rows = await stateFor(client, ids.slice(i, i + 200), nowMs);
    for (const p of rows?.profiles ?? []) out[p.player_id] = p.peak_tier;
  }
  return out;
}
