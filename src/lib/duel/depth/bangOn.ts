/**
 * Bang On depth (25 Oct 2026, `tapRev: 5`; docs/depth/d3-speed-attention.md): FEATURES. Shared by the phone
 * (the line, the streak chip, the reveal) and the server grader (bangOn.server.ts).
 *
 *   score = tapRev 4's curve (STOPWATCH_REV4_CURVE, at most 150) + dead centre + zone streak, at most 200
 *
 *   - dead centre: a stop within BANGON_CENTRE_MS of the zone's centre line (the line and the marker touching)
 *     +2 each (all ten: +20);
 *   - zone streak: a stop inside the gold zone extends the streak, anything else (outside it, missed) ends it;
 *     the 2nd watch in a row in the zone +1, the 3rd +2, the 4th +3, every later one +4 (all ten in a row: +30),
 *     so a couple of lucky zone stops earn little and a long run a lot.
 * The two only add, so 200 needs tapRev 4's 150 (≤ 5 ms average), all ten in the zone and every one dead centre.
 */
import { depthClamp } from "../depth200";
import { scoreStopWatch } from "../scoring";
import { markerState, targetCentre } from "../stopWatch";
import { STOPWATCH_MISS_MS, type StopWatchSpec } from "../types";
import { TAP_REV_DEPTH, TAP_REV_TOPUP, type WatchResult } from "../tapLog";

export const BANGON_DEPTH_REV = TAP_REV_DEPTH;
/**
 * The puzzle top-up (26 Oct 2026, tapRev 6; docs/depth/topup-oct-2026.md): the same line, zone and marks; a dead-centre
 * stop +3 (was 2) and the streak from its 2nd watch +2, 3rd +3, then +4 (was +1, +2, +3, +4), the two together at most
 * BANGON_TOPUP_FEATURE_MAX; and partial credit: never below BANGON_PARTIAL_POINTS per watch stopped within
 * BANGON_PARTIAL_MS (a player who stops some watches close never scores 0).
 */
export const BANGON_TOPUP_REV = TAP_REV_TOPUP;
export const BANGON_TOPUP_CENTRE_POINTS = 3;
export const BANGON_TOPUP_FEATURE_MAX = 50;
export const BANGON_PARTIAL_POINTS = 2;
export const BANGON_PARTIAL_MS = 100;
/** A stop this close to the centre line (ms of marker travel) is dead centre. */
export const BANGON_CENTRE_MS = 12;
export const BANGON_CENTRE_POINTS = 2;
/** What the n-th watch in a row in the zone adds: n − 1, at most BANGON_STREAK_TOP (the 1st adds nothing). */
export const BANGON_STREAK_TOP = 4;
/** The shortest run of zone stops that counts as a streak. */
export const BANGON_STREAK_MIN = 2;

/** Streak points for the n-th watch in a row stopped in the zone (n from 1). */
export function streakPointsAt(n: number, tapRev = BANGON_DEPTH_REV): number {
  if (tapRev >= BANGON_TOPUP_REV) return n >= BANGON_STREAK_MIN ? Math.min(BANGON_STREAK_TOP, n) : 0;
  return Math.max(0, Math.min(BANGON_STREAK_TOP, n - 1));
}

/** Points per dead-centre stop on a stamp. */
export function bangOnCentrePoints(tapRev = BANGON_DEPTH_REV): number {
  return tapRev >= BANGON_TOPUP_REV ? BANGON_TOPUP_CENTRE_POINTS : BANGON_CENTRE_POINTS;
}

export function usesBangOnDepth(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; tapRev?: number } | null;
  return p?.type === "stopwatch" && (p.tapRev === BANGON_DEPTH_REV || p.tapRev === BANGON_TOPUP_REV);
}

export interface WatchMark {
  /** Stopped inside the gold zone. */
  zone: boolean;
  /** Stopped on the centre line. */
  centre: boolean;
}

/** Where a settled watch was stopped: in the zone (marker within the zone's half-width of its centre) and on the line. */
export function watchMark(spec: StopWatchSpec, result: WatchResult): WatchMark {
  if (result.distance === null) return { zone: false, centre: false };
  const elapsed = result.at - result.start;
  const { pos } = markerState(spec, elapsed);
  const zone = Math.abs(pos - targetCentre(spec, elapsed)) <= spec.half + 1e-9;
  return { zone, centre: zone && result.distance <= BANGON_CENTRE_MS };
}

/** Each settled watch's mark, and its place in the run of zone stops it ends (0 outside the zone, 1 for a run's first). */
export function bangOnMarks(watches: readonly StopWatchSpec[], results: readonly WatchResult[]): { marks: WatchMark[]; streakAt: number[] } {
  const marks = results.map((r, i) => watchMark(watches[i]!, r));
  let run = 0;
  const streakAt = marks.map((m) => (run = m.zone ? run + 1 : 0));
  return { marks, streakAt };
}

/** The live streak after the watches settled so far (in-zone stops in a row up to the last). */
export function liveZoneStreak(marks: readonly WatchMark[]): number {
  let n = 0;
  for (let i = marks.length - 1; i >= 0 && marks[i]!.zone; i--) n += 1;
  return n;
}

export interface BangOnDepthScore {
  score: number;
  /** tapRev 4's curve for the average error. */
  curve: number;
  centre: number;
  centreHits: number;
  streak: number;
  /** Watches that were the 2nd or later in a row in the zone. */
  streakWatches: number;
  /** The longest run of zone stops. */
  bestStreak: number;
  /** tapRev 6: the partial-credit floor (2 per watch stopped within 100 ms). */
  floor?: number;
}

export function scoreBangOnDepth(watches: readonly StopWatchSpec[], results: readonly WatchResult[], attempts = watches.length, tapRev = BANGON_DEPTH_REV): BangOnDepthScore {
  const count = Math.max(1, attempts);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const d = results[i]?.distance;
    total += d === undefined || d === null ? STOPWATCH_MISS_MS : Math.max(0, Math.min(STOPWATCH_MISS_MS, d));
  }
  const curve = scoreStopWatch(Math.round(total / count), 4);
  const { marks, streakAt } = bangOnMarks(watches, results.slice(0, count));
  const centreHits = marks.filter((m) => m.centre).length;
  const streakWatches = streakAt.filter((n) => n >= BANGON_STREAK_MIN).length;
  const centre = bangOnCentrePoints(tapRev) * centreHits;
  const streak = streakAt.reduce((sum, n) => sum + streakPointsAt(n, tapRev), 0);
  const bestStreak = Math.max(0, ...streakAt);
  if (tapRev < BANGON_TOPUP_REV) return { score: depthClamp(curve + centre + streak), curve, centre, centreHits, streak, streakWatches, bestStreak };
  const close = results.slice(0, count).filter((r) => r.distance !== null && r.distance !== undefined && r.distance <= BANGON_PARTIAL_MS).length;
  const floor = BANGON_PARTIAL_POINTS * close;
  const features = Math.min(BANGON_TOPUP_FEATURE_MAX, centre + streak);
  return { score: depthClamp(Math.max(floor, curve + features)), curve, centre, centreHits, streak, streakWatches, bestStreak, floor };
}
