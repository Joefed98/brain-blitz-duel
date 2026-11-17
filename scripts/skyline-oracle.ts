/**
 * High Rise's oracle (the difficulty levels, 15 Nov 2026; docs/arcade-standard/skyline.md "Levels"): a perfect player
 * on the sim itself, for the checks' "200 is reachable at every level" and "Skyscraper is possible on Expert" proofs.
 *
 * For each block it looks ahead on the real sim (no tap, tick by tick, up to ORACLE_LOOK ticks) and lists every tick a
 * drop there lands: perfect, or trimmed with the width it leaves. It drops on the earliest perfect tick unless that is
 * more than ORACLE_PATIENCE ticks off, when it takes the widest trim on the way instead (a new phase for the next
 * block). A gold block (scored only when perfect) waits the whole look for its perfect tick, and the block before a
 * gold one is dropped on whichever of its candidate ticks lets the gold block's perfect drop come soonest. Script-only.
 */
import type { ArcadeGame } from "../src/lib/arcade/engine";
import { skylineKindAt, SKYLINE_KIND_GOLD, type SkylineState } from "../src/lib/arcade/skyline";

/** How far ahead (ticks) the oracle looks for a perfect drop of the block in play. */
export const ORACLE_LOOK = 360;
/** The longest wait (ticks) for a perfect drop of an ordinary block before a trim is taken instead. */
export const ORACLE_PATIENCE = 120;

export interface OracleRun {
  taps: number[];
  state: SkylineState;
}

interface Drop {
  tick: number;
  perfect: boolean;
  w: number;
  after: SkylineState;
}

/** Every drop of the block in play over the next `look` ticks (the state after each, and whether it was perfect). */
function drops(game: ArcadeGame<SkylineState>, s: SkylineState, look: number): Drop[] {
  const out: Drop[] = [];
  let probe = s;
  for (let k = 0; k < look && !game.isOver(probe); k++) {
    const dropped = game.step(probe, true);
    if (dropped.placed > probe.placed) out.push({ tick: probe.tick + 1, perfect: dropped.perfects > probe.perfects, w: dropped.blocks[dropped.blocks.length - 1]!.w, after: dropped });
    probe = game.step(probe, false);
  }
  return out;
}

/** The tick the next block's first perfect drop lands on from `s` (Infinity when none within the look). */
function firstPerfect(game: ArcadeGame<SkylineState>, s: SkylineState): number {
  return drops(game, s, ORACLE_LOOK).find((d) => d.perfect)?.tick ?? Infinity;
}

function choose(game: ArcadeGame<SkylineState>, s: SkylineState): Drop | null {
  const all = drops(game, s, ORACLE_LOOK);
  if (!all.length) return null;
  const gold = skylineKindAt(s, s.placed) === SKYLINE_KIND_GOLD;
  const nextGold = skylineKindAt(s, s.placed + 1) === SKYLINE_KIND_GOLD;
  const perfects = all.filter((d) => d.perfect);
  if (gold && perfects.length) return perfects[0]!;
  if (nextGold) {
    // The block before a gold one: the candidate whose follow-on gold perfect comes soonest.
    const trims = [...all].filter((d) => !d.perfect).sort((a, b) => b.w - a.w).slice(0, 12);
    let best: Drop | null = null;
    let bestAt = Infinity;
    for (const d of [...perfects.slice(0, 6), ...trims]) {
      const at = firstPerfect(game, d.after) + (d.perfect ? 0 : 1);
      if (at < bestAt) {
        bestAt = at;
        best = d;
      }
    }
    if (best && bestAt < Infinity) return best;
  }
  const first = perfects[0];
  if (first && first.tick - s.tick <= ORACLE_PATIENCE) return first;
  const horizon = first ? first.tick : Infinity;
  let trim: Drop | null = null;
  for (const d of all) if (!d.perfect && d.tick < horizon && (!trim || d.w > trim.w)) trim = d;
  return trim ?? first ?? all[0]!;
}

export function skylineOracle(game: ArcadeGame<SkylineState>, seed: number): OracleRun {
  let s = game.init(seed);
  const taps: number[] = [];
  while (!game.isOver(s)) {
    const d = choose(game, s);
    if (!d) {
      while (!game.isOver(s)) s = game.step(s, false);
      break;
    }
    taps.push(d.tick);
    s = d.after;
  }
  return { taps, state: s };
}
