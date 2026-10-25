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
  wordsmith: 150,
  wordhunt: 150,
  wordslide: 150,
  tilegrid: 150,
  letterwheel: 150,
  strikeout: 150,
  codeword: 150,
  swapword: 150,
  wordsearch: 150,
  wordfall: 150,
  // Number
  target: 200,
  equation: 200,
  numline: 200,
  numhunt: 150,
  numpyramid: 200,
  countup: 150,
  balance: 200,
  measure: 200,
  checkout: 200,
  // Speed
  reaction: 150,
  stopwatch: 150,
  whack: 150,
  clayshoot: 150,
  chain: 150,
  stroop: 150,
  // Attention
  spotdiff: 150,
  symscan: 150,
  pairmatch: 150,
  tendrop: 200,
  trail: 200,
  // Pattern
  flood: 150,
  tiles: 150,
  rings: 150,
  pipes: 150,
  lightsout: 150,
  nonogram: 150,
  flow: 150,
  tubes: 150,
  blockparty: 150,
  sudoku: 150,
  // Logic
  bomb: 150,
  safe: 150,
  unblock: 150,
  maze: 150,
  iceslide: 150,
  push: 150,
  laser: 150,
  tower: 150,
  gravity: 150,
  lightup: 150,
  shikaku: 150,
  tents: 150,
  // Arcade
  balltrack: 150,
  beat: 150,
  bintoss: 150,
  breaker: 200,
  pinball: 150,
  bubble: 150,
  bullseye: 150,
  burst: 150,
  cross: 150,
  flip: 150,
  hover: 150,
  inkbridge: 150,
  junction: 150,
  matchup: 150,
  orbit: 150,
  rally: 200,
  skyline: 150,
  slice: 150,
  snake: 150,
  snip: 150,
  swing: 150,
  tilt: 150,
  wavefront: 150,
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
