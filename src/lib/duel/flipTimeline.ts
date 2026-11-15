/**
 * Roofbound's run picture (the Action overhaul stage 2, 15 Nov 2026; display only): the stored run replayed tick for tick
 * with the real sim, the way the server replays it (the same validated inputs and end tick), noting when each moment
 * happened. Nothing here is stored, graded or scored: the reveal draws it, the stored score stays the server's.
 */
import { checkInputEvents, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  flipFlowUnits,
  flipGameFor,
  flipGraceUnits,
  flipSweetsTaken,
  FLIP_RUN_TICKS,
  FLIP_V11_SAVE_COST,
  FLIP_V13_CRASH_COST,
  type FlipState,
} from "@/lib/arcade/flip";
import { decodeFlipRun } from "./flip";

export interface FlipTimeline {
  /** The run's length (ticks) and the tick the replay stopped. */
  runTicks: number;
  endTick: number;
  survived: boolean;
  /** Ticks of each crash (a save or a flipRev 13 respawn), each sweet-spot landing and each double flip's take-off. */
  crashes: number[];
  perfects: number[];
  doubles: number[];
  /** The run's best flow streak: its first clean landing's tick, its last and its length. */
  best: { from: number; to: number; count: number };
  /** Clean time (whole seconds, the score's clean half seconds ÷ 2) and the seconds each crash cost. */
  cleanSeconds: number;
  crashCostSeconds: number;
}

/** The stored run's moments, or null for a run on an earlier revision (no flow streak) or one that does not decode. */
export function flipRunTimeline(seed: number, raw: string, rev?: number | null): FlipTimeline | null {
  const game = flipGameFor(rev);
  let run: ReturnType<typeof decodeFlipRun>;
  try {
    run = decodeFlipRun(raw);
  } catch {
    return null;
  }
  let s = game.init(seed) as FlipState;
  if (!s.flow) return null;
  const runTicks = game.runTicks;
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
  const lastTick = endTick > 0 && endTick < runTicks ? endTick : runTicks;
  const check = checkInputEvents(run.events, runTicks, game.inputRanges ?? []);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const crashes: number[] = [];
  const perfects: number[] = [];
  const doubles: number[] = [];
  const best = { from: 0, to: 0, count: 0 };
  let streakFrom = 0;
  for (let tick = 1; tick <= lastTick; tick++) {
    const prev = s;
    s = game.step(s, events.get(tick) ?? null) as FlipState;
    if ((s.saves ?? 0) > (prev.saves ?? 0)) crashes.push(tick);
    if (flipSweetsTaken(s) > flipSweetsTaken(prev)) perfects.push(tick);
    if ((s.combos ?? 0) > (prev.combos ?? 0)) doubles.push(tick);
    const streak = s.streak ?? 0;
    if (streak === 1 && (prev.streak ?? 0) !== 1) streakFrom = tick;
    if (streak > best.count) {
      best.count = streak;
      best.from = streakFrom;
      best.to = tick;
    }
    if (game.isOver(s)) break;
  }
  const grace = Boolean(s.grace);
  return {
    runTicks: FLIP_RUN_TICKS,
    endTick: s.tick,
    survived: s.ended !== 2,
    crashes,
    perfects,
    doubles,
    best,
    cleanSeconds: Math.floor((grace ? flipGraceUnits(s) : flipFlowUnits(s)) / 2),
    crashCostSeconds: (grace ? FLIP_V13_CRASH_COST : FLIP_V11_SAVE_COST) / 2,
  };
}
