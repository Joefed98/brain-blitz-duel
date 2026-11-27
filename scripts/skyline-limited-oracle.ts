/**
 * High Rise's oracle held to Joe's human limits (D5, 23 Nov 2026; docs/arcade-standard/skyline.md "Levels (D5, 23 Nov
 * 2026)"): the proof that 200 is reachable by the best humans on every seed skylineRev 12 deals.
 *
 * scripts/skyline-oracle.ts plans to the exact tick with no limit on how soon a drop follows the block's arrival. This one
 * plays the same way (it looks ahead on the real sim and drops on the earliest perfect tick, a gold block waiting for its
 * perfect drop and the block before a gold one dropped where the gold one's perfect drop comes soonest) but every drop is
 * held to the limits (HUMAN_LIMITS, scripts/arcade-skill-bands/human.ts): no drop lands sooner than REACT_TICKS (0.25 s,
 * the reaction) after the block it drops came into play, and none sooner than MOVE_TICKS (0.15 s, a finger's move) after
 * the tap before. A new block always comes in at the moment of the drop before it, so every drop is at least 15 ticks
 * after the last. The wind it plans through is the flag's (it starts waving a second, 60 ticks, before each gust), so
 * nothing it reacts to is seen later than the limits allow. Script-only.
 */
import type { ArcadeGame } from "../src/lib/arcade/engine";
import { skylineKindAt, SKYLINE_KIND_GOLD, type SkylineState } from "../src/lib/arcade/skyline";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";

const TICK_MS = 1000 / 60;
/** The reaction: a drop lands at least this many ticks after its block came into play (0.25 s). */
export const REACT_TICKS = Math.ceil(HUMAN_LIMITS.reactMs / TICK_MS);
/** A finger's move: taps at least this many ticks apart (0.15 s). */
export const MOVE_TICKS = Math.ceil(HUMAN_LIMITS.moveMs / TICK_MS);
/** How far ahead (ticks) the oracle looks for a perfect drop of the block in play. */
export const LIMITED_LOOK = 360;
/** The longest wait (ticks) for a perfect drop of an ordinary block before a trim is taken instead. */
export const LIMITED_PATIENCE = 120;

export interface LimitedRun {
  taps: number[];
  state: SkylineState;
}

interface Drop {
  tick: number;
  perfect: boolean;
  w: number;
  after: SkylineState;
}

/** The earliest tick a drop may land on from `s`, the block in play having come in on `arrived` (its last tap). */
const earliest = (arrived: number) => arrived + Math.max(REACT_TICKS, MOVE_TICKS);

/** Every allowed drop of the block in play over the next `look` ticks (none before `from`). */
function drops(game: ArcadeGame<SkylineState>, s: SkylineState, from: number, look: number): Drop[] {
  const out: Drop[] = [];
  let probe = s;
  for (let k = 0; k < look && !game.isOver(probe); k++) {
    if (probe.tick + 1 >= from) {
      const dropped = game.step(probe, true);
      if (dropped.placed > probe.placed) out.push({ tick: probe.tick + 1, perfect: dropped.perfects > probe.perfects, w: dropped.blocks[dropped.blocks.length - 1]!.w, after: dropped });
    }
    probe = game.step(probe, false);
  }
  return out;
}

function firstPerfect(game: ArcadeGame<SkylineState>, s: SkylineState, arrived: number): number {
  return drops(game, s, earliest(arrived), LIMITED_LOOK).find((d) => d.perfect)?.tick ?? Infinity;
}

function choose(game: ArcadeGame<SkylineState>, s: SkylineState, arrived: number): Drop | null {
  const all = drops(game, s, earliest(arrived), LIMITED_LOOK);
  if (!all.length) return null;
  const gold = skylineKindAt(s, s.placed) === SKYLINE_KIND_GOLD;
  const nextGold = skylineKindAt(s, s.placed + 1) === SKYLINE_KIND_GOLD;
  const perfects = all.filter((d) => d.perfect);
  if (gold && perfects.length) return perfects[0]!;
  if (nextGold) {
    const trims = [...all].filter((d) => !d.perfect).sort((a, b) => b.w - a.w).slice(0, 12);
    let best: Drop | null = null;
    let bestAt = Infinity;
    for (const d of [...perfects.slice(0, 6), ...trims]) {
      const at = firstPerfect(game, d.after, d.tick) + (d.perfect ? 0 : 1);
      if (at < bestAt) {
        bestAt = at;
        best = d;
      }
    }
    if (best && bestAt < Infinity) return best;
  }
  const first = perfects[0];
  if (first && first.tick - s.tick <= LIMITED_PATIENCE) return first;
  const horizon = first ? first.tick : Infinity;
  let trim: Drop | null = null;
  for (const d of all) if (!d.perfect && d.tick < horizon && (!trim || d.w > trim.w)) trim = d;
  return trim ?? first ?? all[0]!;
}

/** The oracle's run on a game from a seed, every drop held to the limits. */
export function skylineLimitedOracle(game: ArcadeGame<SkylineState>, seed: number): LimitedRun {
  let s = game.init(seed);
  const taps: number[] = [];
  let arrived = 0;
  while (!game.isOver(s)) {
    const d = choose(game, s, arrived);
    if (!d) {
      while (!game.isOver(s)) s = game.step(s, false);
      break;
    }
    taps.push(d.tick);
    arrived = d.tick;
    s = d.after;
  }
  return { taps, state: s };
}

/** True when a tap list keeps the limits: the first tap and every gap at least REACT_TICKS (and MOVE_TICKS). */
export function skylineTapsWithinLimits(taps: readonly number[]): boolean {
  let last = 0;
  for (const t of taps) {
    if (t - last < Math.max(REACT_TICKS, MOVE_TICKS)) return false;
    last = t;
  }
  return true;
}
