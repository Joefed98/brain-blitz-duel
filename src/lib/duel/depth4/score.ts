/**
 * Depth batch 4: the 200-point finish (docs/depth/d4-pattern.md). Built on today's rev-3 grade
 * (puzzleScoreRev3.ts), so every unfinished round and every finish slower than the game's fast share scores
 * exactly what it scores today:
 *
 *   finished = rev-3 finish (120 + up to 30 for speed, cut by mistakes)
 *            + stretch: up to `stretch` × s × efficiency², s = 0 at the fast share (today's 150 pace) rising
 *              evenly to 1 at the elite share of the clock left (clearly faster than today's 150);
 *            + feature: up to `feature` × the feature's share (par, gems, the gold crate, an elegant beam)
 *              × (0.3 + 0.7 × the speed share, min(1, left ÷ fast share)).
 *
 * STRETCH games (Tessellate, Chroma Lines) put all 50 on the stretch; FEATURE games (Gridlock, Skid, Heave)
 * all 50 on the feature, so the extra is only reachable through it; Pipeline, Lightbender and Turntable split
 * it 25 / 25. Server-only arithmetic on the rev-3 grade's own figures; pure, no clock, no randomness.
 */
import { rev3Game } from "../puzzleScoreRev3";
import type { ScoreParts } from "../puzzleScoreRev";
import type { D4Type } from "./stamps";

export interface D4Game {
  /** Most the stretch adds (finishing faster than today's 150 pace). */
  stretch: number;
  /** Most the feature adds. */
  feature: number;
  /** Share of the clock left at which the stretch is full (elite pace). */
  elite: number;
  /**
   * The part of the feature paid at today's 150 pace (with the floor below it); the rest of `feature` is paid
   * only on the elite stretch (0 at the fast share, all of it at the elite share). Absent: all of it at 150 pace.
   */
  featureBase?: number;
  /** The feature's name on the reveal's breakdown ("120 + 50 par + 30 speed"). */
  measure: string;
  /** Top-up (stamp 2): the share of the clock left where the stretch starts and the feature's pace is full (else rev 3's fastShare). */
  fast?: number;
  /** Top-up: each step over par costs this share of the par feature (else grade.server.ts's D4_PAR_STEP). */
  parStep?: number;
}

export const D4_GAMES: Record<D4Type, D4Game> = {
  // FEATURE games: a fixed part of the feature at today's pace, the rest of the 50 only at elite pace.
  unblock: { stretch: 0, feature: 50, featureBase: 25, elite: 0.78, measure: "par" },
  iceslide: { stretch: 0, feature: 50, featureBase: 30, elite: 0.69, measure: "gems" },
  push: { stretch: 0, feature: 50, featureBase: 15, elite: 0.7, measure: "gold crate" },
  blockparty: { stretch: 50, feature: 0, elite: 0.72, measure: "" },
  flow: { stretch: 50, feature: 0, elite: 0.75, measure: "" },
  pipes: { stretch: 25, feature: 25, elite: 0.66, measure: "par" },
  laser: { stretch: 25, feature: 25, elite: 0.75, measure: "elegant beam" },
  rings: { stretch: 25, feature: 25, elite: 0.86, measure: "par" },
};

/**
 * The puzzle top-up (stamp 2, 26 Oct 2026, docs/depth/topup-oct-2026.md): the same parts, the stretch and the
 * feature's pace measured from a slightly earlier share of the clock, so the near-perfect player lands about
 * 150–165 (Tessellate) or 165–175 (the feature games) and only elite pace reaches 190–200.
 */
export const D4_GAMES_TOPUP: Partial<Record<D4Type, D4Game>> = {
  blockparty: { stretch: 50, feature: 0, elite: 0.72, measure: "", fast: 0.555 },
  pipes: { stretch: 25, feature: 25, elite: 0.66, measure: "par", fast: 0.43 },
  laser: { stretch: 25, feature: 25, elite: 0.75, measure: "elegant beam", fast: 0.55 },
  rings: { stretch: 25, feature: 25, elite: 0.86, measure: "par", fast: 0.72 },
  push: { stretch: 0, feature: 50, featureBase: 20, elite: 0.7, measure: "gold crate" },
};

/** The depth batch's maximum (roundMax.ts says the same for these games). */
export const D4_MAX = 200;
/** Share of the feature kept by a finish at the buzzer; the rest follows the speed share. */
export const D4_FEATURE_FLOOR = 0.3;

/** Overrides the elite shares while tuning (scripts/depth4-tune.ts). Never called by app code. */
let eliteOverride: Partial<Record<D4Type, number>> | null = null;
export function withD4Elite<T>(over: Partial<Record<D4Type, number>> | null, fn: () => T): T {
  const before = eliteOverride;
  eliteOverride = over;
  try {
    return fn();
  } finally {
    eliteOverride = before;
  }
}

export function d4Game(type: D4Type, rev = 1): D4Game {
  const g = (rev >= 2 ? D4_GAMES_TOPUP[type] : undefined) ?? D4_GAMES[type];
  const elite = eliteOverride?.[type];
  return elite === undefined ? g : { ...g, elite };
}

/** The elite stretch's share (0 at the fast share of the clock left, 1 at the elite share). */
export function d4EliteShare(type: D4Type, left: number, rev = 1): number {
  const g = d4Game(type, rev);
  const fast = d4Fast(type, rev);
  return clamp((clamp(left, 0, 1) - fast) / Math.max(0.01, g.elite - fast), 0, 1);
}

/** Where the stretch starts and the feature's pace is full: rev 3's fastShare (today's 150 pace), or the top-up's own. */
export function d4Fast(type: D4Type, rev = 1): number {
  return d4Game(type, rev).fast ?? rev3Game(type).fastShare;
}

/** Stretch points for a finish leaving `left` (0–1) of the clock with `efficiency` (0–1). */
export function d4StretchPoints(type: D4Type, left: number, efficiency: number, rev = 1): number {
  const g = d4Game(type, rev);
  if (g.stretch <= 0) return 0;
  const s = d4EliteShare(type, left, rev);
  const e = clamp(efficiency, 0, 1);
  return Math.round(g.stretch * s * e * e);
}

/**
 * Feature points for a finish: the feature's share of its base part, kept in full only at today's 150 pace or
 * faster, plus (where the game sets a base) the share of the rest, paid on the elite stretch.
 */
export function d4FeaturePoints(type: D4Type, left: number, share: number, rev = 1): number {
  const g = d4Game(type, rev);
  if (g.feature <= 0) return 0;
  const fast = d4Fast(type, rev);
  const pace = clamp(clamp(left, 0, 1) / fast, 0, 1);
  const base = g.featureBase ?? g.feature;
  const atPace = base * (D4_FEATURE_FLOOR + (1 - D4_FEATURE_FLOOR) * pace);
  const atElite = (g.feature - base) * d4EliteShare(type, left, rev);
  return Math.round(clamp(share, 0, 1) * (atPace + atElite));
}

export interface D4Finish {
  score: number;
  parts: ScoreParts;
  stretch: number;
  feature: number;
}

/**
 * The depth finish on top of a rev-3 finish: `rev3Score` (120–150) with its `speed` part, the time share
 * left and efficiency it was scored on, and the feature's share (0 when the game has none).
 */
export function d4Finish(type: D4Type, rev3Score: number, rev3Speed: number, left: number, efficiency: number, featureShare: number, rev = 1): D4Finish {
  const g = d4Game(type, rev);
  const stretch = d4StretchPoints(type, left, efficiency, rev);
  const feature = d4FeaturePoints(type, left, featureShare, rev);
  const score = Math.min(D4_MAX, rev3Score + stretch + feature);
  const base = rev3Score - rev3Speed;
  // The parts add up to the score (the cap can only trim the speed part).
  const speed = score - base - feature;
  const parts: ScoreParts = g.feature > 0
    ? { kind: "finish", base, efficiency: feature, measure: g.measure, speed }
    : { kind: "finish", base, speed };
  return { score, parts, stretch, feature };
}

/**
 * A feature counted against a par: 1 at or under it, then `perStep` less for each step over (0 from there).
 * Used for par moves (Gridlock), par turns (Pipeline, Turntable) and par mirrors (Lightbender).
 */
export function parShare(used: number, par: number, perStep: number): number {
  if (!(par > 0) || !Number.isFinite(used)) return 0;
  const over = Math.max(0, used - par);
  return clamp(1 - over * perStep, 0, 1);
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
