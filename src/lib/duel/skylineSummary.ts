/**
 * High Rise's run summary for the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only).
 *
 * The stored log replayed through the real sim exactly as `replaySkylineRun` does (the same taps, the same end), noting
 * each floor as it lands: a perfect drop, a trim, a wide block (the rescue after five trims, or a scheduled one) or a
 * gold block, and where each life was lost. Nothing here grades or scores: the reveal's score is the stored one.
 */
import { checkInputLog } from "@/lib/arcade/engine";
import {
  skylineGameFor,
  skylineKindAt,
  SKYLINE_KIND_GOLD,
  SKYLINE_KIND_WIDE,
  SKYLINE_RUN_TICKS,
  type SkylineState,
} from "@/lib/arcade/skyline";
import { decodeSkylineRun } from "./skyline";

export type SkylineFloorKind = "base" | "perfect" | "trim" | "wide" | "gold";

export interface SkylineSummaryFloor {
  /** Left edge and width, fixed point (the sim's own block). */
  x: number;
  w: number;
  kind: SkylineFloorKind;
}

export interface SkylineSummary {
  /** Bottom-up; index 0 is the base. */
  floors: SkylineSummaryFloor[];
  /** Each lost life: the floor it was lost above (the tower's height then) and the block that missed. */
  losses: { floor: number; x: number; w: number }[];
  placed: number;
  perfects: number;
  bestStreak: number;
  livesLost: number;
  rescues: number;
  golds: number;
  survived: boolean;
  /** The floors (indices into `floors`) of the longest run of perfect drops, or null without one. */
  bestRun: { from: number; to: number } | null;
}

export function skylineRunSummary(seed: number, raw: string, rev?: number | null, level?: string | null): SkylineSummary {
  const game = skylineGameFor(rev, level);
  const run = decodeSkylineRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SKYLINE_RUN_TICKS) : 0;
  const lastTick = endTick > 0 && endTick < SKYLINE_RUN_TICKS ? endTick : SKYLINE_RUN_TICKS;
  const taps = new Set(checkInputLog(run.inputs, SKYLINE_RUN_TICKS).ticks);
  let state: SkylineState = game.init(seed);
  const floors: SkylineSummaryFloor[] = [{ ...state.blocks[0]!, kind: "base" }];
  const losses: SkylineSummary["losses"] = [];
  let runFrom = -1;
  let bestRun: SkylineSummary["bestRun"] = null;
  for (let tick = 1; tick <= lastTick; tick++) {
    const before = state;
    state = game.step(state, taps.has(tick));
    if (state.blocks.length > before.blocks.length) {
      const block = state.blocks[state.blocks.length - 1]!;
      const kind = skylineKindAt(before, before.placed);
      floors.push({
        x: block.x,
        w: block.w,
        kind: kind === SKYLINE_KIND_GOLD && state.perfects > before.perfects ? "gold" : state.perfects > before.perfects ? "perfect" : kind === SKYLINE_KIND_WIDE ? "wide" : "trim",
      });
      const at = floors.length - 1;
      if (state.perfects > before.perfects) {
        if (runFrom < 0) runFrom = at;
        if (!bestRun || at - runFrom > bestRun.to - bestRun.from) bestRun = { from: runFrom, to: at };
      } else runFrom = -1;
    }
    const lostNow = (state.livesLost ?? 0) > (before.livesLost ?? 0) || (state.missed && !before.missed && state.livesLost === undefined);
    if (lostNow) {
      losses.push({ floor: state.blocks.length, x: before.x, w: before.w });
      runFrom = -1;
    }
    if (game.isOver(state)) break;
  }
  return {
    floors,
    losses,
    placed: state.placed,
    perfects: state.perfects,
    // Unstamped rounds keep no streak: the longest run counted here.
    bestStreak: state.bestStreak ?? (bestRun ? bestRun.to - bestRun.from + 1 : 0),
    livesLost: state.livesLost ?? (state.missed ? 1 : 0),
    rescues: state.rescues ?? 0,
    golds: state.golds ?? 0,
    survived: !state.missed && state.tick >= SKYLINE_RUN_TICKS,
    bestRun,
  };
}
