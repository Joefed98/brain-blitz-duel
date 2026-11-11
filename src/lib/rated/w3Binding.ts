/**
 * The rated screens' binding (wave 3, session W3c): W3a's and W3b's server functions behind `RatedBackend`
 * (backend.ts), the one place their shapes are read. Phone only; every call goes through their server functions,
 * which read and write the database through src/lib/data/ (W3a's ratings.server.ts, W3b's rated.server.ts).
 *
 * - Status: W3b's ratedStatusFn (open: testers only, or everyone once RATED_PLAY_FOR_EVERYONE is on; options) and W3a's
 *   getMyRatingsFn (placement, Joulz Rating, tier, pools, categories).
 * - Search: ratedQueueJoinFn, then ratedQueuePollFn about once a second (the band and wait for the range, "found" for
 *   the match), ratedQueueLeaveFn on Cancel.
 * - A match: ratedMatchFn (players, live or recorded with W3b's own age label), each card from A2's getPublicCard and
 *   C2's getCardBadges, each standing from W3a's getRatingsForFn. A seat whose account was forgotten
 *   (accounts.forget_user: "Deleted player", a fresh id with no card) shows as "Deleted player", with no card, rank or
 *   badges.
 * - The result: ratedSettleFn (W3b's settlement, carrying W3a's answer: this player's rating change, why nothing moved,
 *   placement, the reveal's tier, Joules), W3a's getMyRatingsFn and getTierLadderFn for the reveal.
 * - The header: ratedOpponentScoreFn (hidden by the server in the final 20 %), ratedProgressFn.
 */
import type { CardLook } from "@/design/identity";
import { DEFAULT_LOOK } from "@/design/identity";
import type { PlayerRatings, PoolView, RatedPlayerChange, TierLadderRung } from "@/lib/data/ratings";
import { RATED_CATEGORIES } from "@/lib/data/ratings";
import type { Loadout } from "@/lib/identity/backend";

import type {
  BestOf,
  CategoryRating,
  FrozenLine,
  MatchSize,
  OpponentScoreView,
  RatedBackend,
  RatedGame,
  RatedMatch,
  RatedPlayer,
  RatedResult,
  RatedStatus,
  RematchAnswer,
  SideRating,
} from "./backend";
import { formatOf } from "./backend";
import { RECORDED_AFTER_MS, REMATCH_WINDOW_MS, type RatedFormat } from "./matchmaking";
import { clearPlacementRecord, notePlacementResult, placementResults } from "./placementRecord";
import { betterThan, type RankView } from "./tierDisplay";

/** The name accounts.forget_user leaves on a removed account's seats and runs. */
export const DELETED_PLAYER = "Deleted player";

const busy = (x: unknown): x is { busy: true } => !!x && typeof x === "object" && (x as { busy?: unknown }).busy === true;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

const BEST_OF: Partial<Record<RatedFormat, BestOf>> = { bo3: 3, bo5: 5, bo7: 7 };
const SIZE: Record<RatedFormat, MatchSize> = { bo3: 2, bo5: 2, bo7: 2, ffa4: 4, ffa8: 8 };

/** A card look from a saved loadout (the defaults where empty; the avatar's own colour on Captain Joulz). */
export function lookOf(loadout: Loadout | null | undefined, colour: number | null): CardLook {
  return {
    cardArt: loadout?.slots["card-art"] ?? DEFAULT_LOOK.cardArt,
    frame: loadout?.slots["frame"] ?? DEFAULT_LOOK.frame,
    nameColour: loadout?.slots["name-colour"] ?? null,
    avatar: loadout?.avatar ?? (colour !== null ? { id: "captain-joulz", colour, gem: null } : null),
  };
}

/** A pool or category's rating as the screens show it. */
export function sideOf(p: PoolView | null | undefined): SideRating {
  return p && p.status === "rated" ? { rating: p.rating, matches: p.matches } : { rating: null, matches: 0 };
}

/** W3a's ratings as the player's standing. */
export function standingOf(r: PlayerRatings, userId: string): RatedStatus["standing"] {
  if (!r.placement.done || r.joulz === null || !r.tier)
    return {
      state: "placement",
      results: placementResults(userId, r.placement.played),
      puzzles: { rating: null, matches: 0 },
      arcade: { rating: null, matches: 0 },
    };
  const categories: CategoryRating[] = [];
  for (const c of RATED_CATEGORIES) {
    const v = r.categories?.[c];
    if (v && v.status === "rated") categories.push({ pick: c, rating: v.rating, matches: v.matches });
  }
  return {
    state: "placed",
    rank: { ...r.tier, rating: r.joulz },
    puzzles: sideOf(r.pools?.puzzles),
    arcade: sideOf(r.pools?.arcade),
    categories,
  };
}

/** W3a's reason a match moved nothing, as the result's line (null: it moved, or the reason isn't this player's to see). */
export function frozenLineOf(change: Pick<RatedPlayerChange, "frozen" | "flagged" | "moved"> | null | undefined): FrozenLine | null {
  if (!change || change.moved) return null;
  if (change.frozen === "flagged_run" || change.flagged) return "under_review";
  if (change.frozen === "same_opponent_today") return "same_opponent_today";
  return null;
}

/** The game closest to the player's practice best, 1 to NEAR_MISS_MAX below it (C1a's bests, Classic). */
export const NEAR_MISS_MAX = 15;
export function nearMissOf(games: readonly RatedGame[], bestOf: (type: string) => number | null): { type: string; offBest: number } | null {
  let pick: { type: string; offBest: number } | null = null;
  for (const g of games) {
    const best = bestOf(g.type);
    if (best === null) continue;
    const off = best - g.myScore;
    if (off >= 1 && off <= NEAR_MISS_MAX && (!pick || off < pick.offBest)) pick = { type: g.type, offBest: off };
  }
  return pick;
}

export async function bindW3(): Promise<RatedBackend> {
  const rated = await import("./rated.functions");
  const ratings = await import("./ratings.functions");
  const { currentUserId } = await import("@/lib/duel/session");
  const { accountNow, refreshAccount } = await import("@/lib/account/accountApi");
  const { identityBackend } = await import("@/lib/identity/backend");
  const { titleName } = await import("@/lib/badges/catalogue");

  const myId = async () => (await currentUserId()) ?? "";

  /** One player's card: look (A2), badges and title (C2), standing (W3a); a forgotten account as "Deleted player". */
  async function cardFor(
    userId: string | null,
    name: string,
    guest: boolean,
    rank: RankView | null | "ask",
  ): Promise<RatedPlayer> {
    const deleted = !guest && (name === DELETED_PLAYER || !userId);
    if (deleted)
      return { userId, username: DELETED_PLAYER, playerNumber: null, look: DEFAULT_LOOK, title: null, badges: [], rank: null, guest: false, deleted: true };
    const id = await identityBackend();
    const [card, badgeRows, standing] = await Promise.all([
      !guest && userId && id ? id.getPublicCard(userId).catch(() => null) : Promise.resolve(null),
      !guest && userId
        ? import("@/lib/badges/badges.functions").then((m) => m.getCardBadges({ data: { playerIds: [userId] } })).catch(() => null)
        : Promise.resolve(null),
      rank === "ask" && userId
        ? ratings.getRatingsForFn({ data: { playerId: userId } }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const badges = Array.isArray(badgeRows) ? (badgeRows.find((b) => b.playerId === userId) ?? null) : null;
    const theirs = standing && !busy(standing) && standing.placement.done && standing.tier && standing.joulz !== null ? { ...standing.tier, rating: standing.joulz } : null;
    const loadout = card?.loadout ?? null;
    return {
      userId,
      username: card?.username ?? name,
      playerNumber: card?.playerNumber ?? null,
      look: lookOf(loadout as Loadout | null, loadout?.avatar?.colour ?? null),
      title: guest ? null : badges ? titleName(badges.title) : null,
      badges: badges?.badges.slice(0, 3) ?? [],
      rank: rank === "ask" ? theirs : rank,
      guest,
      deleted: false,
    };
  }

  async function myRatings(): Promise<PlayerRatings | null> {
    const r = await ratings.getMyRatingsFn();
    return busy(r) ? null : r;
  }

  type View = NonNullable<Awaited<ReturnType<typeof rated.ratedMatchFn>>>;

  async function toMatch(view: View): Promise<RatedMatch> {
    const me = await myId();
    const mine = view.players.find((p) => p.userId === me) ?? view.players[0];
    const other = view.players.find((p) => p.userId !== mine?.userId) ?? null;
    const mineR = await myRatings();
    const myRank = mineR && mineR.placement.done && mineR.tier && mineR.joulz !== null ? { ...mineR.tier, rating: mineR.joulz } : null;
    const [meCard, themCard] = await Promise.all([
      cardFor(me, mine?.displayName ?? "", mine?.guest ?? false, myRank),
      view.kind === "recorded" && view.recorded
        ? cardFor(view.recorded.ownerId, view.recorded.ownerName, view.recorded.ownerGuest, "ask")
        : cardFor(other?.userId ?? null, other?.displayName ?? DELETED_PLAYER, other?.guest ?? false, "ask"),
    ]);
    return {
      id: view.matchId,
      pick: view.choice,
      bestOf: BEST_OF[view.format] ?? 3,
      roomCode: view.roomCode,
      me: meCard,
      them: themCard,
      source: view.kind === "recorded" && view.recorded ? { kind: "recorded", label: view.recorded.label } : { kind: "live" },
      headToHead: null,
      placement: mine?.placement && mineR ? Math.min(5, mineR.placement.played + 1) : null,
    };
  }

  async function ladder(): Promise<TierLadderRung[] | null> {
    const r = await ratings.getTierLadderFn();
    return busy(r) ? null : r;
  }

  return {
    async status() {
      const s = await rated.ratedStatusFn();
      if (!s.open) return null;
      const me = await myId();
      const r = await myRatings();
      if (!r) return null;
      const account = accountNow().kind === "unknown" ? await refreshAccount() : accountNow();
      const guest = !s.account;
      const standing = standingOf(r, me);
      if (standing.state === "placed") clearPlacementRecord(me);
      const name = account.kind === "account" ? account.username : "Guest";
      const card = await cardFor(me, name, guest, standing.state === "placed" ? standing.rank : null);
      const bestOf = s.options.formats.map((f) => BEST_OF[f]).filter((n): n is BestOf => n !== undefined);
      const sizes = [...new Set(s.options.formats.map((f) => SIZE[f]))];
      return {
        open: true,
        guest,
        me: card,
        options: { picks: s.options.choices, bestOf, sizes },
        season: null,
        standing,
        activeMatchId: s.activeMatchId,
      } satisfies RatedStatus;
    },

    async search(pick, bestOf, progress, signal) {
      const joined = await rated.ratedQueueJoinFn({ data: { format: formatOf(bestOf), choice: pick } });
      if (!joined.ok) {
        if (joined.reason === "in_match") {
          const s = await rated.ratedStatusFn();
          const v = s.activeMatchId ? await rated.ratedMatchFn({ data: { matchId: s.activeMatchId } }) : null;
          if (v) return toMatch(v);
        }
        return { ok: false, message: joined.message };
      }
      while (!signal.aborted) {
        const poll = await rated.ratedQueuePollFn().catch(() => null);
        if (signal.aborted) break;
        if (poll && !busy(poll)) {
          if (poll.state === "found") return toMatch(poll.match);
          if (poll.state === "searching") progress({ elapsedMs: poll.waitedMs, range: poll.band, recordedAfterMs: RECORDED_AFTER_MS });
          if (poll.state === "idle") return { ok: false, message: "The search stopped. Try again." };
        }
        await sleep(1000, signal);
      }
      await rated.ratedQueueLeaveFn().catch(() => null);
      return null;
    },

    async match(matchId) {
      const v = await rated.ratedMatchFn({ data: { matchId } });
      return v ? toMatch(v) : null;
    },

    async result(matchId) {
      const settled = await rated.ratedSettleFn({ data: { matchId } });
      if (settled.state !== "settled") return null;
      const s = settled.result;
      const view = await rated.ratedMatchFn({ data: { matchId } });
      if (!view) return null;
      const me = await myId();
      const match = await toMatch(view);
      const mine = s.players.find((p) => p.userId === me) ?? s.players[0]!;
      const other = s.players.find((p) => p.userId !== mine.userId) ?? null;
      const mySide = mine.slot === 1 ? "a" : "b";
      const theirScores = other?.scores ?? s.recorded?.scores ?? [];
      const games: RatedGame[] = s.games.map((g, i) => ({ type: g.type, myScore: mine.scores[i] ?? 0, theirScore: theirScores[i] ?? 0 }));
      const myGames = s.games.filter((g) => g.winner === mySide).length;
      const theirGames = s.games.filter((g) => g.winner !== mySide && g.winner !== "draw").length;
      const outcome = s.winner === mySide ? "won" : s.winner === "draw" ? "drawn" : "lost";
      const change = s.ratings && s.ratings.ok ? (s.ratings.players.find((p) => p.playerId === me) ?? null) : null;

      const placing = change ? !change.placement.done || change.placement.justFinished : match.placement !== null;
      if (placing) notePlacementResult(me, matchId, outcome);
      const placementSoFar = placing && change ? placementResults(me, change.placement.played) : null;

      const moveOf = (key: "puzzles" | "arcade") => {
        const c = change?.changes.find((x) => x.key === key);
        return c ? { rating: c.after, change: c.delta } : null;
      };
      const rating =
        change && change.moved && !placing && change.tier.after && change.joulz.after !== null
          ? {
              after: { ...change.tier.after, rating: change.joulz.after },
              change: change.joulz.before !== null ? Math.round(change.joulz.after) - Math.round(change.joulz.before) : 0,
              puzzles: moveOf("puzzles"),
              arcade: moveOf("arcade"),
            }
          : null;

      let reveal: RatedResult["reveal"] = null;
      if (change?.placement.justFinished && change.tier.after && change.joulz.after !== null) {
        const [now, rungs] = await Promise.all([myRatings(), ladder().catch(() => null)]);
        const known = placementSoFar?.filter((x) => x !== null) ?? [];
        const all = known.length === 5;
        reveal = {
          rank: { ...change.tier.after, rating: change.joulz.after },
          betterThan: rungs ? betterThan(change.tier.after.tier, rungs) : null,
          puzzles: sideOf(now?.pools?.puzzles),
          arcade: sideOf(now?.pools?.arcade),
          won: all ? known.filter((x) => x === "won").length : null,
          lost: all ? known.filter((x) => x === "lost").length : null,
        };
      }

      const { practiceProgressNow } = await import("@/lib/practice/useProgress");
      const progress = practiceProgressNow();
      const nearMiss = nearMissOf(games, (type) => progress?.games[type]?.classic?.best ?? null);
      const finishedMs = Date.parse(s.finishedAt);
      return {
        match,
        games,
        myGames,
        theirGames,
        outcome,
        rating,
        frozen: frozenLineOf(change),
        placementResults: placing ? placementSoFar : null,
        reveal,
        joules: change && change.joules > 0 ? { amount: change.joules, passLevel: null } : null,
        // C1a's stars are earned by Practice runs only: a rated game earns none, so there is never one to show here.
        star: null,
        nearMiss,
        // Friends (B1) aren't on main yet: nobody is a friend, so Challenge doesn't show.
        friend: false,
        rematchUntil: s.kind === "live" && Number.isFinite(finishedMs) ? new Date(finishedMs + REMATCH_WINDOW_MS).toISOString() : null,
        moved: change?.changes.map((c) => c.key) ?? [],
      } satisfies RatedResult;
    },

    async rematch(matchId): Promise<RematchAnswer> {
      const r = await rated.ratedRematchFn({ data: { matchId } });
      if (r.state === "agreed") return { state: "agreed", match: await toMatch(r.match) };
      return r;
    },

    async challenge(matchId) {
      const v = await rated.ratedMatchFn({ data: { matchId } });
      if (!v?.roomId) return { ok: false, message: "That match can’t be sent as a challenge." };
      const { challengeFromRoom } = await import("@/lib/duel/challengeApi");
      const made = await challengeFromRoom(v.roomId);
      return made.ok ? { ok: true, code: made.code } : { ok: false, message: made.message };
    },

    ladder,

    async opponentScore(matchId): Promise<OpponentScoreView | null> {
      const r = await rated.ratedOpponentScoreFn({ data: { matchId } });
      if (!r || busy(r)) return null;
      return { round: r.round, score: r.score, hidden: r.hidden, finished: r.finished };
    },

    async progress(matchId, round, score) {
      await rated.ratedProgressFn({ data: { matchId, round, score } }).catch(() => null);
    },
  };
}
