/**
 * The deal for a room saved with settings (roomSettings.ts; 31 Oct 2026). Rooms without settings keep
 * selection.ts `pickRoundOrder` exactly; the daily and challenges never come here.
 *
 * Everything runs on the room seed, so one seed (and the host's history) always deals the same room:
 *  1. Shares: the rounds are shared between the picks as evenly as possible (counts differ by at most 1);
 *     which picks take the extra rounds is seeded. A pick never takes more rounds than it has games.
 *  2. Order: a seeded shuffle of those shares, mixed through the picks (never grouped), with no pick in two
 *     rounds running wherever the shares allow it (a seeded greedy order when no shuffle of them can).
 *  3. Games: within a pick no game repeats until every one of its games has been played in this room;
 *     the host's last three rooms' games are weighted down and the last room's skipped while a pick has
 *     enough others (selection.ts' rule).
 */
import { shuffled, weightedPick, withSeededRandom } from "./random";
import {
  clampRounds,
  orderPicks,
  pickTypes,
  type RoomPick,
  type RoomSettings,
} from "./roomSettings";
import {
  EXCLUDE_MIN_ALTERNATIVES,
  RECENT_WEIGHTS,
  recencyWeight,
  seededRng,
  type RecentRounds,
} from "./selection";
import type { PuzzleType } from "./types";

/** Keeps each stage's random stream separate (and apart from the legacy deal's streams). */
const SHARE_SALT = 0x3c0f_fe11;
const ORDER_SALT = 0x6e4d_a1c3;
const GAME_SALT = 0x1b5e_77a9;
/** Shuffles tried before the greedy order. */
const SHUFFLE_TRIES = 4000;

export interface RoomDeal {
  /** Each round's pick, in play order. */
  picks: RoomPick[];
  /** Each round's game. */
  types: PuzzleType[];
}

/** Rounds per pick: as even as the picks' game counts allow, extras on seeded picks. */
export function dealShares(
  picks: readonly RoomPick[],
  rounds: number,
  seed: number,
): Map<RoomPick, number> {
  const rng = seededRng((seed ^ SHARE_SALT) >>> 0);
  const shares = new Map<RoomPick, number>(picks.map((p) => [p, 0]));
  let left = rounds;
  while (left > 0) {
    const open = picks.filter((p) => shares.get(p)! < pickTypes(p, picks).length);
    if (!open.length) break;
    const low = Math.min(...open.map((p) => shares.get(p)!));
    const lowest = open.filter((p) => shares.get(p) === low);
    if (left >= lowest.length) {
      for (const p of lowest) shares.set(p, low + 1);
      left -= lowest.length;
      continue;
    }
    const pool = [...lowest];
    for (; left > 0; left--) {
      const p = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
      shares.set(p, shares.get(p)! + 1);
    }
  }
  return shares;
}

const noRunning = (order: readonly RoomPick[]) =>
  order.every((p, i) => i === 0 || p !== order[i - 1]);

/** A seeded order of the shares with no pick twice running where that is possible. */
export function dealOrder(shares: ReadonlyMap<RoomPick, number>, seed: number): RoomPick[] {
  const rng = seededRng((seed ^ ORDER_SALT) >>> 0);
  const pool: RoomPick[] = [];
  for (const [p, n] of shares) for (let k = 0; k < n; k++) pool.push(p);
  const most = Math.max(0, ...shares.values());
  // Possible only when the largest share is at most one more than all the others together.
  const possible = most <= pool.length - most + 1;
  if (pool.length > 1 && possible)
    for (let attempt = 0; attempt < SHUFFLE_TRIES; attempt++) {
      const order = [...pool];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      if (noRunning(order)) return order;
    }
  // Greedy: the pick with the most rounds left that didn't just play (ties seeded).
  const left = new Map(shares);
  const order: RoomPick[] = [];
  while (order.length < pool.length) {
    const prev = order[order.length - 1];
    const live = [...left].filter(([, n]) => n > 0);
    const others = live.filter(([p]) => p !== prev);
    const from = others.length ? others : live;
    const top = Math.max(...from.map(([, n]) => n));
    const best = from.filter(([, n]) => n === top).map(([p]) => p);
    const p = best[Math.floor(rng() * best.length)]!;
    order.push(p);
    left.set(p, left.get(p)! - 1);
  }
  return order;
}

/** The room's rounds from its settings. */
export function dealRoomRounds(
  settings: RoomSettings,
  options: { seed: number; recent?: RecentRounds },
): RoomDeal {
  const picks = orderPicks(settings.picks).filter((p) => pickTypes(p, settings.picks).length > 0);
  if (!picks.length) return { picks: [], types: [] };
  const rounds = clampRounds(settings.rounds, picks);
  const recent = (options.recent ?? []).slice(0, RECENT_WEIGHTS.length);
  const order = dealOrder(dealShares(picks, rounds, options.seed), options.seed);
  const lastRoom = recent[0] ?? [];
  const types = withSeededRandom((options.seed ^ GAME_SALT) >>> 0, () => {
    const used = new Map<RoomPick, PuzzleType[]>();
    const out: PuzzleType[] = [];
    for (const pick of order) {
      const all = pickTypes(pick, picks);
      let taken = used.get(pick) ?? [];
      // Every game of the pick played: it starts over (not with its last game, when it has others).
      if (taken.length >= all.length) taken = all.length > 1 ? taken.slice(-1) : [];
      // No-repeat is per game (3 Nov 2026, alsoIn.ts): a game another pick already dealt in this room is never dealt
      // again while this pick has others. Picks share no game today (a game listed also in a pick joins it only when
      // its main pick wasn't chosen), so every deal is as before; this is the guard.
      const elsewhere = new Set(out.filter((t) => !taken.includes(t)));
      const own = shuffled(all).filter((t) => !taken.includes(t));
      const fresh = own.some((t) => !elsewhere.has(t)) ? own.filter((t) => !elsewhere.has(t)) : own;
      const skipLast = fresh.filter(
        (t) => !(lastRoom.includes(t) && fresh.length - 1 >= EXCLUDE_MIN_ALTERNATIVES),
      );
      const options = skipLast.length ? skipLast : fresh;
      const type = weightedPick(options, (t) => recencyWeight(t, recent));
      used.set(pick, [...taken, type]);
      out.push(type);
    }
    return out;
  });
  return { picks: order, types };
}
