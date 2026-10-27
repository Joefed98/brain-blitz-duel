/**
 * Each game's round maximum (25 Oct 2026, the 200-point foundation; docs/scoring-200.md).
 *
 * The one place that says how many points a round of a game can score. Every game scores up
 * to 150 today; each game's expansion PR raises its own line here to SCORE_CEILING (200) with
 * its new skill features, version stamp and scoring. Everything that shows or reacts to "the
 * round's top" reads it from here: the perfect moment and `shared.perfect` (usePerfectBurst),
 * the signature beat's no-finish threshold, the arcade reveal chart's axis, the intro and "?"
 * help score text, the podium's Perfectionist, the results' top-score styling and the
 * score-band fractions (scoreBandOf). No game's scoring reads it: a sim or grader keeps its own
 * caps, so changing a line here never changes how a stored round scores.
 *
 * Shared, pure and the same on every phone and the server. round-max-check proves every game
 * is 150 today and that one game's maximum moves its chart, texts, perfect moment and bands
 * together.
 */
import type { PuzzleType } from "./types";

/** The system's ceiling: no game's round maximum may exceed it. */
export const SCORE_CEILING = 200;

/** Today's maximum for every game (the score bands' "perfect 150"). */
export const DEFAULT_ROUND_MAX = 150;

/** Each game's round maximum. An expansion PR changes its own game's line (and its scoring). */
export const ROUND_MAX: Readonly<Record<PuzzleType, number>> = {
  // Word
  wordsmith: 200,
  wordhunt: 200,
  wordslide: 200,
  tilegrid: 200,
  letterwheel: 200,
  strikeout: 200,
  codeword: 200,
  swapword: 200,
  wordsearch: 200,
  wordfall: 150,
  // Number
  target: 200,
  equation: 200,
  numline: 200,
  numhunt: 200,
  numpyramid: 200,
  countup: 200,
  balance: 200,
  measure: 200,
  checkout: 200,
  // Speed
  reaction: 200,
  stopwatch: 200,
  whack: 200,
  clayshoot: 200,
  chain: 200,
  stroop: 200,
  // Attention
  spotdiff: 200,
  symscan: 200,
  pairmatch: 200,
  tendrop: 200,
  trail: 200,
  // Pattern
  flood: 200,
  tiles: 200,
  rings: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  pipes: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  lightsout: 200,
  nonogram: 200,
  flow: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  tubes: 200,
  blockparty: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  sudoku: 200,
  // Logic
  bomb: 200,
  safe: 200,
  unblock: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  maze: 200,
  iceslide: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  push: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  laser: 200, // depth batch 4 (docs/depth/d4-pattern.md)
  tower: 200,
  gravity: 200,
  lightup: 200,
  shikaku: 200,
  tents: 200,
  // Arcade
  balltrack: 200, // expansion E6, btRev 7
  beat: 200, // expansion E2, beatRev 9; beatRev 10 (phone notes, easier) keeps it
  bintoss: 200,
  breaker: 200, // expansion E3, brkRev 9
  pinball: 200,
  bubble: 200, // expansion E6, bubbleRev 8 (bubbleRev 9: burst credit)
  bullseye: 200, // expansion E9, bullRev 8
  burst: 200, // expansion E9, burstRev 8
  cross: 200, // Jaywalk crossRev 9 (x200, 26 Oct 2026)
  flip: 200, // expansion X200, flipRev 8
  hover: 200, // expansion X200, hoverRev 9
  inkbridge: 200,
  junction: 150,
  matchup: 200, // expansion E6, matchupRev 9
  orbit: 200,
  rally: 200, // expansion E9, rallyRev 10
  skyline: 200,
  slice: 200,
  snake: 200, // expansion E2, snakeRev 9
  snip: 200, // expansion X200, snipRev 11
  swing: 200, // expansion x200, swingRev 13
  tilt: 200,
  wavefront: 200,
  // Retired to practice
  bastion: 150,
  dig: 150,
  dual: 150,
  hotfloor: 150,
  ricochet: 150,
  rooftop: 150,
  steady: 150,
  swerve: 150,
};

/* ------------------------------------------------------------------ overrides (checks only) */

let overrides: Map<string, number> | null = null;
let generation = 0;

/**
 * Runs `fn` with one game's maximum set to `max` (round-max-check: proves everything follows a
 * game's maximum before any expansion ships). Never called by the app.
 */
export function withRoundMax<T>(type: PuzzleType, max: number, fn: () => T): T {
  const before = overrides;
  overrides = new Map(before ?? []);
  overrides.set(type, max);
  generation++;
  try {
    return fn();
  } finally {
    overrides = before;
    generation++;
  }
}

/** Bumped whenever a check's override starts or ends, so cached texts rebuild (liveRecord). */
export function roundMaxGeneration(): number {
  return generation;
}

/* ------------------------------------------------------------------ reads */

/**
 * The most a round of this game can score. Unknown ids (a removed game's stored round, a
 * malformed row) get DEFAULT_ROUND_MAX; never above SCORE_CEILING.
 */
export function roundMaxFor(type: string | null | undefined): number {
  const max = (type ? (overrides?.get(type) ?? (ROUND_MAX as Record<string, number>)[type]) : undefined) ?? DEFAULT_ROUND_MAX;
  return Math.min(SCORE_CEILING, Math.max(1, Math.round(max)));
}

/** The highest round maximum of any game (the onboarding's "top score"), and whether every game shares it. */
export function topRoundMax(): { top: number; shared: boolean } {
  const maxes = (Object.keys(ROUND_MAX) as PuzzleType[]).map((type) => roundMaxFor(type));
  const top = Math.max(...maxes);
  return { top, shared: maxes.every((m) => m === top) };
}

/** A stored score that is this game's maximum (the perfect moment, Perfectionist). */
export function isPerfectScore(type: string | null | undefined, score: number | null | undefined): boolean {
  return typeof score === "number" && Number.isFinite(score) && score >= roundMaxFor(type);
}

/** A score as a share of the game's maximum, 0 to 1. */
export function roundShare(type: string | null | undefined, score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score / roundMaxFor(type)));
}

/**
 * Scales a threshold stated on today's 150 scale to this game's maximum (rounded): 120 of 150 is
 * 160 of 200. At 150 it returns the threshold unchanged.
 */
export function scaledToMax(type: string | null | undefined, onScale150: number): number {
  const max = roundMaxFor(type);
  return max === DEFAULT_ROUND_MAX ? onScale150 : Math.round((onScale150 * max) / DEFAULT_ROUND_MAX);
}

/* ------------------------------------------------------------------ score bands */

export type ScoreBand = "perfect" | "near-perfect" | "great" | "good" | "decent" | "average" | "low";

/**
 * Joe's score bands (docs/scoring-targets.md, 19 Oct 2026), stated on the 150 scale: perfect 150
 * only, near perfect 130–149, great 110–129, good 90–109, decent 80–89, average 60–79. Each lower
 * edge is scaled to the game's maximum (scaledToMax), so a 200 game's perfect is 200 only.
 */
export const SCORE_BAND_EDGES_150: readonly (readonly [ScoreBand, number])[] = [
  ["perfect", 150],
  ["near-perfect", 130],
  ["great", 110],
  ["good", 90],
  ["decent", 80],
  ["average", 60],
  ["low", 0],
];

/** The lowest score in a band for this game. */
export function scoreBandFloor(type: string | null | undefined, band: ScoreBand): number {
  if (band === "perfect") return roundMaxFor(type);
  const edge = SCORE_BAND_EDGES_150.find(([b]) => b === band)![1];
  return scaledToMax(type, edge);
}

/** The band a stored score sits in for this game. */
export function scoreBandOf(type: string | null | undefined, score: number): ScoreBand {
  for (const [band] of SCORE_BAND_EDGES_150) if (score >= scoreBandFloor(type, band)) return band;
  return "low";
}

/** A score is valid for a game when it is a whole number from 0 to the game's maximum. */
export function isValidRoundScore(type: string | null | undefined, score: unknown): score is number {
  return typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= roundMaxFor(type);
}

/* ------------------------------------------------------------------ texts */

/** The token texts write where they mean "this game's maximum". */
export const MAX_TOKEN = "{max}";

/** Fills MAX_TOKEN with the game's maximum. */
export function fillMax(text: string, type: string | null | undefined): string {
  return text.includes(MAX_TOKEN) ? text.split(MAX_TOKEN).join(String(roundMaxFor(type))) : text;
}

/**
 * A record built by `build` (texts that state a game's maximum), rebuilt only when a check's
 * override changes the maximums (roundMaxGeneration), so the app builds it once.
 */
export function liveRecord<T extends object>(build: () => T): T {
  let built: T | null = null;
  let at = -1;
  const current = (): T => {
    if (built === null || at !== generation) {
      built = build();
      at = generation;
    }
    return built;
  };
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(current(), key),
    has: (_, key) => Reflect.has(current(), key),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}
