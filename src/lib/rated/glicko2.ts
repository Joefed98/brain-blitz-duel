/**
 * Glicko-2 (Glickman, "Example of the Glicko-2 system", 2012), one rating period per match (ratings update after
 * every rated match, never batched), with weighted results (a game's weight is a fraction of a game, as in Glickman's
 * paper's partial-game extension), and three additions, each tuned to a target in glicko.config.ts:
 *
 *  - time away: φ² grows by IDLE_RD2_PER_DAY for each full day since the rating last moved (Glicko-1's c²);
 *  - the RD floor schedule by matches played (placement, then newish), so new ratings move by plan;
 *  - the 100 floor on the rating.
 *
 * Pure and deterministic (floats are fine here: this is server code, never a sim). Shared by the server and checks.
 */

import {
  GLICKO_SCALE,
  IDLE_RD2_PER_DAY,
  MAX_RD,
  MAX_VOLATILITY,
  MIN_RD,
  MIN_VOLATILITY,
  NEWISH_END_RD,
  NEWISH_START_RD,
  NEWISH_UNTIL,
  PLACEMENT_MATCHES,
  PLACEMENT_RD,
  RATING_FLOOR,
  START_RATING,
  START_RD,
  START_VOLATILITY,
  TAU,
} from "./glicko.config";

export interface GlickoState {
  rating: number;
  rd: number;
  volatility: number;
  /** Matches that moved this rating so far. */
  matches: number;
  /** When it last moved (ms), or null for a new rating. */
  lastAt: number | null;
}

/** One result in the period: against an opponent's pre-match rating, with a score 1 / 0.5 / 0 and a weight. */
export interface GlickoResult {
  opponentRating: number;
  opponentRd: number;
  score: number;
  weight: number;
}

export function newGlickoState(): GlickoState {
  return { rating: START_RATING, rd: START_RD, volatility: START_VOLATILITY, matches: 0, lastAt: null };
}

const DAY_MS = 86_400_000;

/** Full days between two times (0 when either is missing). */
export function idleDays(lastAt: number | null, nowMs: number): number {
  if (lastAt === null || nowMs <= lastAt) return 0;
  return Math.floor((nowMs - lastAt) / DAY_MS);
}

/** The RD floor for a rating that has had `matches` matches (before this one). */
export function rdFloor(matches: number): number {
  if (matches < PLACEMENT_MATCHES) return PLACEMENT_RD;
  if (matches < NEWISH_UNTIL) {
    // Even on a log scale from NEWISH_START_RD (the 6th match) to NEWISH_END_RD (the NEWISH_UNTIL-th).
    const t = (matches - PLACEMENT_MATCHES) / (NEWISH_UNTIL - 1 - PLACEMENT_MATCHES);
    return Math.exp(Math.log(NEWISH_START_RD) + Math.min(1, t) * (Math.log(NEWISH_END_RD) - Math.log(NEWISH_START_RD)));
  }
  return MIN_RD;
}

/** RD after time away (no match), capped at MAX_RD. What an opponent's rating is weighed with. */
export function rdAfterIdle(rd: number, days: number): number {
  return Math.min(MAX_RD, Math.sqrt(rd * rd + days * IDLE_RD2_PER_DAY));
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Glicko-2's expected score of `rating` against an opponent (both in rating points). */
export function expectedScore(rating: number, opponentRating: number, opponentRd: number): number {
  return expected((rating - START_RATING) / GLICKO_SCALE, (opponentRating - START_RATING) / GLICKO_SCALE, opponentRd / GLICKO_SCALE);
}

/** Glickman's step 5: the new volatility (Illinois iteration). */
function newVolatility(phi: number, sigma: number, delta: number, v: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  const eps = 1e-6;
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < 100) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > eps; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA = fA / 2;
    B = C;
    fB = fC;
  }
  return Math.min(MAX_VOLATILITY, Math.max(MIN_VOLATILITY, Math.exp(A / 2)));
}

/**
 * One rating period (one match) for one rating. Results with weight 0 are ignored; with none, the state is
 * returned unchanged. `factor` (0–1) scales the whole move (a recorded run's owner: RECORDED_OWNER_FACTOR): the rating,
 * RD and volatility each move exactly that share of the way from before to where the full update would take them.
 */
export function glickoUpdate(state: GlickoState, results: readonly GlickoResult[], nowMs: number, factor = 1): GlickoState {
  const used = results.filter((r) => r.weight > 0 && factor > 0);
  const f = Math.min(1, factor);
  if (!used.length) return state;
  const S = GLICKO_SCALE;
  const mu = (state.rating - START_RATING) / S;
  const days = idleDays(state.lastAt, nowMs);
  const phiPre = Math.sqrt((state.rd / S) ** 2 + (days * IDLE_RD2_PER_DAY) / (S * S));

  let vInv = 0;
  let sum = 0;
  for (const r of used) {
    const muJ = (r.opponentRating - START_RATING) / S;
    const phiJ = r.opponentRd / S;
    const gj = g(phiJ);
    const e = expected(mu, muJ, phiJ);
    const w = r.weight;
    vInv += w * gj * gj * e * (1 - e);
    sum += w * gj * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;
  const sigma = newVolatility(phiPre, state.volatility, delta, v);
  const floor = rdFloor(state.matches) / S;
  const phiStar = Math.min(MAX_RD / S, Math.max(floor, Math.sqrt(phiPre * phiPre + sigma * sigma)));
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;
  const full = {
    rating: Math.max(RATING_FLOOR, START_RATING + S * muNew),
    rd: Math.max(MIN_RD, Math.min(MAX_RD, S * phiNew)),
    volatility: sigma,
  };
  return {
    rating: state.rating + f * (full.rating - state.rating),
    rd: state.rd + f * (full.rd - state.rd),
    volatility: state.volatility + f * (full.volatility - state.volatility),
    matches: state.matches + 1,
    lastAt: nowMs,
  };
}
