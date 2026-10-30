/**
 * Mahjong Solitaire (Cards & Board, 30 Oct 2026): a human scans the free tiles for two with the same face, taps both,
 * and looks again.
 *
 * Scanning: the time to find a pair falls as the board offers more of them (FIND_MS × 3 ÷ (pairs on view + 2), plus an
 * orientation), shrinking with skill (thinkTicks). Weaker players take the first pair they see; better ones weigh what
 * a pair frees (the tiles under and beside it), blurred by their judgement, and keep a face's fourth tile in mind (with
 * four of a face free they take the pair that frees most). A slip taps a wrong free tile first (a wasted tap). With no
 * pair on the board the player notices after a reaction and a look round and presses Shuffle.
 */
import { msToTicks, type SkillLevel } from "../human";
import { driveEvents, type BotResult, type SkillBot } from "../bot";
import {
  mahjongFree,
  mahjongMoves,
  MAHJONG_INPUT_SHUFFLE,
  MAHJONG_INPUT_TAP,
  MAHJONG_SLOTS,
  MAHJONG_TILES,
  type MahjongState,
} from "../../../src/lib/arcade/mahjong";

/** One tap, from finding the tile to the touch (ms). */
const TAP_MS: Record<SkillLevel, number> = { weak: 760, average: 560, good: 440, great: 370, near: 320, elite: 295, perfect: 150 };
/** Finding a pair on a board with one pair on view, for an average player (ms). */
const FIND_MS = 5200;
/** How much a player weighs what a pair frees. */
const FORESIGHT: Record<SkillLevel, number> = { weak: 0, average: 0.2, good: 0.5, great: 0.8, near: 1, elite: 1, perfect: 1 };

/** Tiles that would be free once `pair` is gone and are not free now (what taking it opens up). */
function freed(face: readonly number[], pair: readonly [number, number]): number {
  const after = face.slice();
  after[pair[0]] = -1;
  after[pair[1]] = -1;
  let n = 0;
  for (let i = 0; i < MAHJONG_TILES; i++) if (after[i]! >= 0 && !mahjongFree(face, i) && mahjongFree(after, i)) n += 1;
  return n;
}

/** Perfect play's look-ahead: does a greedy clearing from here finish without a shuffle? */
function greedyClears(face: readonly number[], depth = 40): boolean {
  const f = face.slice();
  for (let k = 0; k < depth; k++) {
    if (f.every((v) => v < 0)) return true;
    const moves = mahjongMoves(f);
    if (!moves.length) return false;
    let best = moves[0]!;
    let bestV = -1;
    for (const m of moves) {
      const v = freed(f, m) * 4 + MAHJONG_SLOTS[m[0]]!.z + MAHJONG_SLOTS[m[1]]!.z;
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    f[best[0]] = -1;
    f[best[1]] = -1;
  }
  return f.every((v) => v < 0);
}

export const bot: SkillBot = ({ game, seed, human }): BotResult => {
  const lvl = human.level;
  const tap = () => msToTicks(TAP_MS[lvl] * (0.8 + 0.4 * human.u()));
  let queue: { k: number; a: number }[] = [];
  let nextAt = msToTicks(700) + human.reactTicks();
  const { events } = driveEvents<MahjongState>(
    game,
    (s, t) => {
      if (t < nextAt) return null;
      if (queue.length === 0) {
        const moves = mahjongMoves(s.face);
        if (moves.length === 0) {
          nextAt = t + human.reactTicks() + human.thinkTicks(900);
          queue = [{ k: MAHJONG_INPUT_SHUFFLE, a: 0 }];
          return null;
        }
        nextAt = t + human.thinkTicks(250 + (FIND_MS * 3) / (moves.length + 2));
        let pick: readonly [number, number];
        if (lvl === "perfect") {
          // The ceiling: the pair that frees most among those that keep a clean clearing in reach.
          const ranked = [...moves].sort((a, b) => freed(s.face, b) - freed(s.face, a) || MAHJONG_SLOTS[b[0]]!.z - MAHJONG_SLOTS[a[0]]!.z);
          pick = ranked.find((m) => {
            const f = s.face.slice();
            f[m[0]] = -1;
            f[m[1]] = -1;
            return greedyClears(f);
          }) ?? ranked[0]!;
        } else {
          const seen = moves.slice(0, Math.max(1, Math.round(1 + FORESIGHT[lvl] * 5 * human.u())));
          const order = seen.map((m) => ({ m, r: human.u() }));
          order.sort((a, b) => a.r - b.r);
          const values = order.map(({ m }) => FORESIGHT[lvl] * (freed(s.face, m) * 2 + (MAHJONG_SLOTS[m[0]]!.z + MAHJONG_SLOTS[m[1]]!.z) / 2));
          const i = human.pick(values);
          pick = order[Math.max(0, i)]!.m;
        }
        queue = [{ k: MAHJONG_INPUT_TAP, a: pick[0] }, { k: MAHJONG_INPUT_TAP, a: pick[1] }];
        // A slip: a wrong free tile first (the selection moves on; the right pair follows).
        if (human.slip(0.6)) {
          const free: number[] = [];
          for (let i = 0; i < MAHJONG_TILES; i++) if (mahjongFree(s.face, i) && s.face[i] !== s.face[pick[0]]) free.push(i);
          if (free.length) queue.unshift({ k: MAHJONG_INPUT_TAP, a: free[human.int(0, free.length - 1)]! });
        }
        return null;
      }
      const next = queue.shift()!;
      nextAt = t + tap();
      return { k: next.k, a: next.a, b: 0, c: 0, d: 0 };
    },
    game.init(seed),
  );
  return { events };
};
