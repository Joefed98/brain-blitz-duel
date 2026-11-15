/**
 * Grappler's run summary for the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only). The stored
 * run is replayed once through the server's own replay (replaySwingRun, the same states and score) while this records
 * what the picture draws: each of the course's stretches (cleared, under par, the one in play at the end, never
 * reached), where the hero fell in the river or was caught, which gates were lit and the best clean-swing streak.
 * Nothing here grades or scores: the numbers are the replay's own state and swingSlideParts of it.
 */
import { SWING_KIND_SWING, swingAssaultCounts, swingAssaultPar, swingSlideParts, type SwingState } from "@/lib/arcade/swing";
import { replaySwingRun, type SwingResult } from "./swing";

export interface SwingStretchTrace {
  /** A swinging stretch (hook to hook) or a ledge run's section (platform to platform). */
  swinging: boolean;
  state: "under" | "cleared" | "current" | "ahead";
  /** Misses on this stretch (river or rock), and pterodactyl catches. */
  falls: number;
  caught: number;
  /** Gates on this stretch: lit or not. */
  gates: boolean[];
}

export interface SwingRunTrace {
  result: SwingResult;
  stretches: SwingStretchTrace[];
  cleared: number;
  total: number;
  /** The share of the course behind the hero, in whole percent (the Course part's measure). */
  percent: number;
  underPar: number;
  gates: number;
  gateTotal: number;
  falls: number;
  caught: number;
  bestStreak: number;
  finished: boolean;
}

/** The summary of a stored jungle run (swingRev 17+), or null for an older stamp. */
export function traceSwingRun(seed: number, answer: string, rev?: number): SwingRunTrace | null {
  let prev: SwingState | null = null;
  let falls: number[] = [];
  let caught: number[] = [];
  let bestStreak = 0;
  const observe = (s: SwingState) => {
    if (!s.slide) return;
    if (falls.length === 0) {
      falls = new Array(s.sections?.length ?? 0).fill(0);
      caught = new Array(s.sections?.length ?? 0).fill(0);
    }
    bestStreak = Math.max(bestStreak, s.streak ?? 0);
    if (prev && (s.restarts ?? 0) > (prev.restarts ?? 0)) {
      const k = Math.min(prev.sec ?? 0, falls.length - 1);
      if ((s.caught ?? 0) > (prev.caught ?? 0)) caught[k]! += 1;
      else falls[k]! += 1;
    }
    prev = s;
  };
  const result = replaySwingRun(seed, answer, rev, observe);
  const end = result.state;
  if (!end.slide || !end.sections) return null;
  const c = swingAssaultCounts(end);
  const parts = swingSlideParts(end);
  const total = end.sections.length;
  if (falls.length !== total) {
    falls = new Array(total).fill(0);
    caught = new Array(total).fill(0);
  }
  const lit = end.bankGates ?? 0;
  const gatesOf = (k: number): boolean[] => {
    const sec = end.sections![k]!;
    const x0 = sec.x0 ?? 0;
    const x1 = sec.x1 ?? 0;
    const out: boolean[] = [];
    (end.gates ?? []).forEach((g, i) => {
      if (g.x >= x0 && g.x < x1) out.push((lit & (1 << i)) !== 0);
    });
    return out;
  };
  const stretches = end.sections.map((sec, k): SwingStretchTrace => {
    const p = swingAssaultPar(end, k);
    const state = p.time >= 0 ? (p.beat > 0 ? "under" : "cleared") : k === c.sections ? "current" : "ahead";
    return { swinging: sec.kind === SWING_KIND_SWING, state, falls: falls[k]!, caught: caught[k]!, gates: gatesOf(k) };
  });
  return {
    result,
    stretches,
    cleared: c.sections,
    total,
    percent: Math.trunc(parts.permille / 10),
    underPar: c.parsBeaten,
    gates: c.gates,
    gateTotal: c.gateTotal,
    falls: c.restarts - c.caught,
    caught: c.caught,
    bestStreak,
    finished: c.sections >= total,
  };
}
