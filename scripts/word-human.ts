/**
 * The Word games' person-style players under the human limits (D1, the difficulty build, 21 Nov 2026;
 * docs/polish-plan-final/difficulty-spec.md "Word"). Script-only: floats and Math are fine; nothing here is imported by
 * the app. Every run is graded by the server's own code (scripts/standard-lib.ts gradeSteps on the dealt puzzle).
 *
 * Two tools, both held to HUMAN_LIMITS (scripts/arcade-skill-bands/human.ts: 0.25 s to react, 0.15 s to move):
 *
 *  - The typed witness (`witnessMs`): the time a player who already knows what to enter needs to enter it, 0.25 s to
 *    decide each entry and 0.15 s for every tap, key or traced letter. A level deal that must hold a 200 keeps a board
 *    only when a list of its words reaching 200 is entered inside the clock at that pace (the proof of reachability).
 *  - The length-aware person (`PEOPLE`): knows a share of the board's words by length (long words are the whole skill of
 *    an anagram or a letter grid, which the repo's kits cannot feel: they take the same time for every word), takes a
 *    find time that grows by `growth` for every letter past four and slows as the easy words run out, then enters each
 *    word at the human limits. Rare dictionary words are known at `knowRare`. Calibrated so the average person scores
 *    about what the spec's measurements gave on today's Normal (Nucleus about 70, Forage about 64); the elite is the
 *    best human the levels are proved against (knows 99 / 95 / 85 / 70 % of everyday 4 / 5 / 6 / 7+ letter words).
 *
 *   bun scripts/word-human.ts <wordsmith|wordhunt|letterwheel> [--level=normal|easy|hard|expert|all] [--seeds=24] [--runs=3]
 */
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { limitEntryMs } from "../src/lib/duel/levels/humanLimits";
import { hashText, makeRng, type Rng, type Step } from "./puzzle-fairness/kit";

export const LIMITS = HUMAN_LIMITS;

/** Time to enter one known word or move: react once, then each tap, key or traced letter (limitEntryMs at the limits). */
export function entryMs(taps: number, limits: { reactMs: number; moveMs: number } = LIMITS): number {
  return limits === LIMITS ? limitEntryMs(taps) : limits.reactMs + Math.max(0, taps) * limits.moveMs;
}

/** The typed witness: the time to enter every entry in turn at the human limits (taps per entry). */
export function witnessMs(taps: readonly number[], limits = LIMITS): number {
  return taps.reduce((sum, t) => sum + entryMs(t, limits), 0);
}

export type PersonLevel = "average" | "good" | "near" | "elite";
export const PERSON_LEVELS: readonly PersonLevel[] = ["average", "good", "near", "elite"];

export interface WordPerson {
  level: PersonLevel;
  /** Chance the person knows an everyday word of 3, 4, 5, 6 and 7+ letters (fixed per word and person). */
  know: readonly [number, number, number, number, number];
  /** Chance the person knows a dictionary word that isn't an everyday word. */
  knowRare: number;
  /** Seconds to find a known four-letter word on a fresh board (thinking only; entry time is added at the limits). */
  findS: number;
  /** Find time × this for every letter past four (÷ for three letters). */
  growth: number;
  /** Find time × (1 + depletion × share of the person's list already found): the easy words run out. */
  depletion: number;
  /** Chance per word of a wasted try (a non-word, a plural, a word without the centre) costing `slipS` seconds. */
  slip: number;
  slipS: number;
}

/**
 * The four people. Knowledge from the spec's length-aware player (scratch la.ts of 20 Nov: 90 / 70 / 45 / 25 % of
 * everyday 4 / 5 / 6 / 7+ letter words for the average, 99 / 95 / 85 / 70 % for the elite), 1.6× the find time per extra
 * letter as it measured. Find times calibrated on today's Normal Nucleus (24 deals × 3 runs, 21 Nov 2026): the average
 * person scores about 70 (the spec's figure), the elite's best about 184 (the spec's "Normal's elite best is 184"); good
 * and near-perfect sit between on the kits' own pace ratios (kit.ts SKILLS).
 */
export const PEOPLE: Readonly<Record<PersonLevel, WordPerson>> = {
  average: { level: "average", know: [0.97, 0.9, 0.7, 0.45, 0.25], knowRare: 0.04, findS: 5.8, growth: 1.6, depletion: 1, slip: 0.2, slipS: 3 },
  good: { level: "good", know: [0.99, 0.95, 0.82, 0.62, 0.42], knowRare: 0.1, findS: 3.4, growth: 1.6, depletion: 1, slip: 0.1, slipS: 2.5 },
  near: { level: "near", know: [1, 0.98, 0.92, 0.78, 0.6], knowRare: 0.2, findS: 1.2, growth: 1.6, depletion: 1, slip: 0.03, slipS: 2 },
  elite: { level: "elite", know: [1, 0.99, 0.95, 0.85, 0.7], knowRare: 0.3, findS: 0.8, growth: 1.6, depletion: 1, slip: 0.015, slipS: 1.5 },
};

/** True when `person` knows `word` (fixed per person and word, the same on every board). */
export function knows(person: WordPerson, word: string, everyday: boolean): boolean {
  const p = everyday ? person.know[Math.min(4, Math.max(0, word.length - 3))]! : person.knowRare;
  return makeRng(hashText(`know:${person.level}:${word.toUpperCase()}`)).next() < p;
}

/** Find seconds for a word of `length` letters at a fresh board (before depletion and spread). */
export function findSeconds(person: WordPerson, length: number): number {
  return person.findS * person.growth ** (length - 4);
}

export interface Candidate {
  word: string;
  /** Taps to enter it (letters plus Enter for a keyed word; letters for a trace). */
  taps: number;
  everyday: boolean;
  /** Look for it first (a player hunting the every-tile word or the gold tile's words). */
  priority?: number;
}

export interface Found {
  word: string;
  atMs: number;
  /** Wasted tries before it. */
  slips: number;
}

/**
 * The words the person finds in order, with the clock time each is entered: only words they know, cheapest find first
 * (with spread), each find slowed as the list runs out, then entered at the human limits. Stops past `limitMs`.
 */
export function personFinds(person: WordPerson, candidates: readonly Candidate[], limitMs: number, rng: Rng, findScale = 1): Found[] {
  const env = Number(process.env[`WH_SCALE_${person.level.toUpperCase()}`] ?? "1");
  const scale = findScale * (Number.isFinite(env) && env > 0 ? env : 1);
  const known = candidates.filter((c) => knows(person, c.word, c.everyday));
  const planned = known
    .map((c) => ({ c, key: findSeconds(person, c.word.length) * Math.exp(rng.normal(0, 0.45)) - (c.priority ?? 0) }))
    .sort((a, b) => a.key - b.key);
  const out: Found[] = [];
  let at = 0;
  for (const [i, { c }] of planned.entries()) {
    let slips = 0;
    while (rng.chance(person.slip)) {
      slips++;
      at += person.slipS * 1000 * Math.exp(rng.normal(0, 0.3));
    }
    const find = scale * findSeconds(person, c.word.length) * (1 + (person.depletion * i) / Math.max(1, planned.length));
    at += find * 1000 * Math.exp(rng.normal(0, 0.35)) + entryMs(c.taps);
    if (at > limitMs) break;
    out.push({ word: c.word, atMs: Math.round(at), slips });
  }
  return out;
}

/** Seeded stream for one person's run. */
export function personRng(game: string, level: string, n: number, person: PersonLevel, run: number): Rng {
  return makeRng(hashText(`word-human:${game}:${level}:${n}:${person}:${run}`));
}

export type { Step };

/**
 * The kits' elite (D1, 21 Nov 2026): the puzzle-fairness kits stop at near-perfect (kit.ts SKILLS); the elite is a little
 * quicker and steadier, as human.ts's elite is to its near-perfect, and every action it takes is held to the human limits
 * by `limitSteps`.
 */
export const KIT_ELITE = { level: "near" as const, pace: 0.4, err: 0.008, reactionMs: 250, reactionSd: 25 };

/**
 * A kit's steps held to the human limits: each step lands no sooner than the one before plus the time to enter what it
 * added (`tapsAdded(prev, next)` taps after 0.25 s to react). Times only ever move later.
 */
export function limitSteps(steps: readonly Step[], tapsAdded: (prev: string, next: string) => number, limits = LIMITS): Step[] {
  const out: Step[] = [];
  let prev = "";
  let at = 0;
  for (const s of steps) {
    const taps = tapsAdded(prev, s.answer);
    at = Math.max(s.atMs, at + (taps > 0 ? entryMs(taps, limits) : 0));
    out.push({ answer: s.answer, atMs: at });
    prev = s.answer;
  }
  return out;
}
