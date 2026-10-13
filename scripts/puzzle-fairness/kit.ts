/**
 * Player kits for the puzzle fairness audit (scripts/puzzle-fairness.ts) and the
 * puzzle-score legacy fixture (scripts/puzzle-score-legacy-record.ts).
 *
 * A kit knows one game's answer encoding and builds real answers the server
 * grader reads: doing nothing, spam (blanket or random input until the buzzer)
 * and a simulated solver that plays toward the solution with mistakes and
 * human-like time per action. Kits never score anything themselves: every
 * answer goes through gradeAnswer. Script-only: floats and Math are fine.
 */
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";

/** mulberry32: a stable stream per (game, seed, level). */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  below(n: number): number;
  /** Integer in [lo, hi]. */
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability p. */
  chance(p: number): boolean;
  /** Normal(mean, sd). */
  normal(mean: number, sd: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const below = (n: number) => (n <= 1 ? 0 : Math.floor(next() * n));
  return {
    next,
    below,
    int: (lo, hi) => lo + below(hi - lo + 1),
    pick: (items) => items[below(items.length)]!,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = below(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    chance: (p) => next() < p,
    normal: (mean, sd) => {
      const u = Math.max(1e-12, next());
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const LEVELS = ["average", "good", "great", "near"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  average: "Average",
  good: "Good",
  great: "Great",
  near: "Near-perfect",
};

/**
 * One simulated player. `pace` multiplies a kit's per-action seconds (a good
 * player = 1); `err` is the chance per decision of a mistake (a wasted move, a
 * wrong guess, a mis-tap); `reactionMs` is for the reaction games.
 */
export interface Skill {
  level: Level;
  pace: number;
  err: number;
  reactionMs: number;
  reactionSd: number;
}

/**
 * Per-level figures shared by every game. Paces are think time per action
 * relative to a good player; error rates follow the arcade humans
 * (scripts/arcade-skill-bands/human.ts: mistakes 10 / 5 / 2.5 / 0.8 %), raised
 * for puzzles where a "mistake" is a wrong move or guess rather than a slip.
 */
export const SKILLS: Record<Level, Skill> = {
  average: { level: "average", pace: 1.7, err: 0.2, reactionMs: 300, reactionSd: 55 },
  good: { level: "good", pace: 1.0, err: 0.1, reactionMs: 230, reactionSd: 40 },
  great: { level: "great", pace: 0.72, err: 0.05, reactionMs: 190, reactionSd: 30 },
  near: { level: "near", pace: 0.5, err: 0.015, reactionMs: 160, reactionSd: 20 },
};

/** One step of a play: the whole answer after this action and when it happened. */
export interface Step {
  /** The full answer string the phone would submit after this action. */
  answer: string;
  /** Ms since the round clock started when this action was made. */
  atMs: number;
}

export interface Play {
  /** Answers after each action, in time order (atMs never decreasing). */
  steps: Step[];
  /**
   * Set when the answer itself carries tap times (tap logs, chain taps): the
   * runner then grades the last step at or before the buzzer and never cuts
   * an answer by time itself.
   */
  timed?: boolean;
}

export interface SpamPlay {
  label: string;
  /** The answer submitted at the buzzer (0 ms left) after spamming the whole round. */
  answer: string;
}

export interface PuzzleKit {
  type: PuzzleType;
  /**
   * The answer the phone submits at the buzzer when the player did nothing
   * (what the Stage's onDraftAnswer holds before any action; often "").
   */
  nothing(p: PuzzleData): string;
  /**
   * Spam strategies (each a separate run): tapping or placing everywhere,
   * random digits or letters, random swaps or moves until the buzzer. Use the
   * rng for every random choice. 2–4 strategies.
   */
  spam(p: PuzzleData, rng: Rng, limitMs: number): SpamPlay[];
  /**
   * A simulated solver at this skill: plays toward the solution (from the
   * stored solution / the game's own solver), making mistakes at skill.err and
   * spending human-like time per action (base seconds × skill.pace, with
   * spread). Return every intermediate answer with its time; the runner grades
   * the last answer reached before the buzzer (msRemaining 0 if unsolved,
   * limit − atMs of the solving step if solved). A play may run past the
   * limit; the runner cuts it.
   */
  play(p: PuzzleData, rng: Rng, skill: Skill, limitMs: number): Play;
}

/** Seconds → ms with a log-normal-ish spread so no two actions take the same time. */
export function thinkMs(rng: Rng, baseSeconds: number, skill: Skill, spread = 0.35): number {
  const factor = Math.exp(rng.normal(0, spread));
  return Math.max(250, Math.round(baseSeconds * skill.pace * factor * 1000));
}
