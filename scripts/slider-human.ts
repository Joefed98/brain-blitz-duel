/**
 * A person-like Slider solver (the Word overhaul, stage 3, Joe's last push of 16 Nov 2026): it never reads the stored
 * words or the solver's line. Like a player it looks at the rows, sees how close each is to an everyday five-letter
 * word (letters already in place), and plans a few slides ahead that bring the rows closer, then makes them. It
 * finishes when every row reads as a real word (the server's own finish), exactly as a phone sends it.
 *
 * Human limits: every plan costs thinking time, every slide a hand's time (a drag across a square), and the plan looks
 * only `lookahead` slides ahead. The skills are a strong player (two slides ahead) and an elite one (three).
 * Script-only (measurement and the level check); the play is graded by the server's own code (standard-lib).
 */
import { isWord } from "../src/lib/duel/dictionary.server";
import { everydaySlideWords as slideWords } from "../src/lib/duel/wordSlide.server";
import { applyShift, markedRowWord, shiftToken, wordSlideSize, WS_SIZE, type SlideShift } from "../src/lib/duel/wordSlide";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { Step } from "./puzzle-fairness/kit";
import { limitEntryMs } from "../src/lib/duel/levels/humanLimits";
import { asPhoneSends, gradeSteps } from "./standard-lib";

export interface SliderHumanSkill {
  name: "strong" | "elite";
  /** Slides planned ahead per look at the board. */
  lookahead: number;
  /** Thinking before each plan (ms). */
  thinkMs: number;
  /** One slide's drag (ms). */
  slideMs: number;
}

export const SLIDER_HUMANS: Record<SliderHumanSkill["name"], SliderHumanSkill> = {
  strong: { name: "strong", lookahead: 2, thinkMs: 2400, slideMs: 450 },
  elite: { name: "elite", lookahead: 3, thinkMs: 2000, slideMs: 350 },
};

/**
 * The elite held to the human limits (D1, 21 Nov 2026; the levels' proof): the elite's own planning (three slides ahead,
 * 2 s a plan) and every slide one drag at the limits (src/lib/duel/levels/humanLimits.ts: 0.25 s to react, 0.15 s to move).
 */
export const SLIDER_AT_LIMITS: SliderHumanSkill = { ...SLIDER_HUMANS.elite, slideMs: limitEntryMs(1) };

/** Every slide on a grid of `size` (D1, 21 Nov 2026: the level grids 4 × 4 to 7 × 7; Normal's 20 at 5, in today's order). */
const shiftsOf = (size: number): SlideShift[] =>
  (["r", "c"] as const).flatMap((axis) => Array.from({ length: size }, (_, index) => [1, -1].map((dir) => ({ axis, index, dir: dir as 1 | -1 }))).flat());
const SHIFTS_BY_SIZE = new Map<number, SlideShift[]>();
const SHIFTS_OF = (size: number) => SHIFTS_BY_SIZE.get(size) ?? (SHIFTS_BY_SIZE.set(size, shiftsOf(size)), SHIFTS_BY_SIZE.get(size)!);
const isUndo = (a: SlideShift | null, b: SlideShift) => !!a && a.axis === b.axis && a.index === b.index && a.dir === -b.dir;

/**
 * How close a row reads to an everyday word, as a person sees it: the most letters in place against any one (a row
 * one or two slides round from a word counts nearly as much, since the slide is plain to see), plus how many of a
 * word's letters the row holds at all (an anagram is easy to spot); 12 for a real word.
 */
const rowCache = new Map<string, number>();
function rowCloseness(row: string): number {
  const hit = rowCache.get(row);
  if (hit !== undefined) return hit;
  // A row of n letters reads against the everyday words of n letters (D1: the level grids; Normal's five).
  const n = row.length;
  let best = 0;
  if (isWord(row)) best = 12;
  else if (n !== WS_SIZE) best = rowClosenessIndexed(row.toLowerCase(), n);
  else {
    const lower = row.toLowerCase();
    const rot = Array.from({ length: n }, (_, k) => lower.slice(k) + lower.slice(0, k));
    for (const w of slideWords(n)) {
      let held = 0;
      const pool = [...lower];
      for (const ch of w) {
        const i = pool.indexOf(ch);
        if (i >= 0) {
          pool[i] = "";
          held++;
        }
      }
      if (held < 3) continue;
      let place = 0;
      for (let k = 0; k < n; k++) {
        let m = 0;
        for (let i = 0; i < n; i++) if (w[i] === rot[k]![i]) m++;
        const cost = k === 0 ? 0 : k === 1 || k === n - 1 ? 0.6 : 1.2;
        place = Math.max(place, m - cost);
      }
      best = Math.max(best, place + held * 0.8);
    }
  }
  if (rowCache.size > 400_000) rowCache.clear();
  rowCache.set(row, best);
  return best;
}

/**
 * The level grids' rows (D1, 21 Nov 2026): the same closeness as above, worked out through letter and position indexes
 * of the n-letter words instead of a scan of every word (exactly the same value; 6 × 6 and 7 × 7 rows would take seconds
 * each by the scan). Normal's five-letter rows keep the scan above.
 */
interface RowIndex {
  words: string[];
  /** byLetter[c]: [word, how many times the word holds the letter] for every word holding it. */
  byLetter: Int32Array[];
  byLetterCount: Int8Array[];
  /** byPos[i * 26 + c]: the words with letter c at position i. */
  byPos: Int32Array[];
}
const ROW_INDEX = new Map<number, RowIndex>();
function rowIndexOf(n: number): RowIndex {
  const hit = ROW_INDEX.get(n);
  if (hit) return hit;
  const words = slideWords(n);
  const letters: number[][] = Array.from({ length: 26 }, () => []);
  const counts: number[][] = Array.from({ length: 26 }, () => []);
  const pos: number[][] = Array.from({ length: 26 * n }, () => []);
  words.forEach((w, wi) => {
    const c = new Array<number>(26).fill(0);
    for (let i = 0; i < n; i++) {
      const code = w.charCodeAt(i) - 97;
      c[code]!++;
      pos[i * 26 + code]!.push(wi);
    }
    c.forEach((k, code) => {
      if (k > 0) {
        letters[code]!.push(wi);
        counts[code]!.push(k);
      }
    });
  });
  const index: RowIndex = {
    words,
    byLetter: letters.map((l) => Int32Array.from(l)),
    byLetterCount: counts.map((l) => Int8Array.from(l)),
    byPos: pos.map((l) => Int32Array.from(l)),
  };
  ROW_INDEX.set(n, index);
  return index;
}
function rowClosenessIndexed(lower: string, n: number): number {
  const ix = rowIndexOf(n);
  const W = ix.words.length;
  const rc = new Array<number>(26).fill(0);
  for (let i = 0; i < n; i++) rc[lower.charCodeAt(i) - 97]!++;
  const held = new Int8Array(W);
  for (let code = 0; code < 26; code++) {
    const k = rc[code]!;
    if (!k) continue;
    const list = ix.byLetter[code]!;
    const cnt = ix.byLetterCount[code]!;
    for (let j = 0; j < list.length; j++) held[list[j]!] += Math.min(k, cnt[j]!);
  }
  const place = new Float64Array(W);
  const m = new Int8Array(W);
  for (let k = 0; k < n; k++) {
    m.fill(0);
    for (let i = 0; i < n; i++) {
      const code = lower.charCodeAt((i + k) % n) - 97;
      const list = ix.byPos[i * 26 + code]!;
      for (let j = 0; j < list.length; j++) m[list[j]!]++;
    }
    const cost = k === 0 ? 0 : k === 1 || k === n - 1 ? 0.6 : 1.2;
    for (let w = 0; w < W; w++) if (held[w]! >= 3) place[w] = Math.max(place[w]!, m[w]! - cost);
  }
  let best = 0;
  for (let w = 0; w < W; w++) if (held[w]! >= 3) best = Math.max(best, place[w]! + held[w]! * 0.8);
  return best;
}

/** The scan, exported for the check that proves the index gives the same value (any length). */
export function rowClosenessScan(row: string): number {
  const n = row.length;
  if (isWord(row)) return 12;
  const lower = row.toLowerCase();
  const rot = Array.from({ length: n }, (_, k) => lower.slice(k) + lower.slice(0, k));
  let best = 0;
  for (const w of slideWords(n)) {
    let held = 0;
    const pool = [...lower];
    for (const ch of w) {
      const i = pool.indexOf(ch);
      if (i >= 0) {
        pool[i] = "";
        held++;
      }
    }
    if (held < 3) continue;
    let place = 0;
    for (let k = 0; k < n; k++) {
      let mm = 0;
      for (let i = 0; i < n; i++) if (w[i] === rot[k]![i]) mm++;
      const cost = k === 0 ? 0 : k === 1 || k === n - 1 ? 0.6 : 1.2;
      place = Math.max(place, mm - cost);
    }
    best = Math.max(best, place + held * 0.8);
  }
  return best;
}
export { rowCloseness };

function closeness(grid: string[], size: number = WS_SIZE): number {
  let total = 0;
  for (let r = 0; r < size; r++) total += rowCloseness(markedRowWord(grid, r, size));
  return total;
}
const allWords = (grid: string[], size: number = WS_SIZE) => Array.from({ length: size }, (_, r) => r).every((r) => isWord(markedRowWord(grid, r, size)));

/** A small deterministic generator (ties and exploring slides), seeded per run. */
function rng32(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export interface SliderHumanRun {
  steps: Step[];
  finished: boolean;
  slides: number;
}

/** Plays one board as a person would, within the clock. */
/** `maxSlides`: stop once the run has made more slides than this (the bank's quick rejection of a line past par). */
export function playSliderHuman(p: WordSlidePuzzleData, skill: SliderHumanSkill, seed: number, maxSlides = Infinity): SliderHumanRun {
  const limit = puzzleTimeLimitMs(p);
  const size = wordSlideSize(p);
  const SHIFTS = SHIFTS_OF(size);
  const rand = rng32(seed);
  let grid = [...p.grid];
  let clock = 0;
  const tokens: string[] = [];
  const steps: Step[] = [];
  const seen = new Map<string, number>([[grid.join(""), 1]]);
  let last: SlideShift | null = null;
  while (clock < limit && !allWords(grid, size) && tokens.length <= maxSlides) {
    clock += skill.thinkMs;
    if (clock >= limit) break;
    // The best plan of up to `lookahead` slides: the closest board, boards seen before marked down (a person avoids
    // going round in circles), shorter plans first on a tie.
    const here = closeness(grid, size);
    let bestScore = -Infinity;
    let bestPlan: SlideShift[] = [];
    const search = (g: string[], plan: SlideShift[], prev: SlideShift | null) => {
      if (plan.length) {
        const key = g.join("");
        const score = (allWords(g, size) ? 1000 : closeness(g, size)) - 3 * (seen.get(key) ?? 0) - plan.length * 0.01 + rand() * 0.001;
        if (score > bestScore) {
          bestScore = score;
          bestPlan = [...plan];
        }
        if (allWords(g, size)) return;
      }
      if (plan.length >= skill.lookahead) return;
      for (const s of SHIFTS) {
        if (isUndo(prev, s)) continue;
        plan.push(s);
        search(applyShift(g, s, undefined, size), plan, s);
        plan.pop();
      }
    };
    search(grid, [], last);
    // No plan brings the board closer: an exploring slide (a person tries something), else the plan.
    const plan = bestScore > here - 0.001 ? bestPlan : [SHIFTS[Math.floor(rand() * SHIFTS.length)]!];
    for (const s of plan) {
      if (clock + skill.slideMs > limit) break;
      clock += skill.slideMs;
      grid = applyShift(grid, s, undefined, size);
      last = s;
      tokens.push(shiftToken(s));
      const key = grid.join("");
      seen.set(key, (seen.get(key) ?? 0) + 1);
      steps.push({ answer: tokens.join(","), atMs: clock });
      if (allWords(grid, size)) break;
    }
  }
  return { steps, finished: allWords(grid, size), slides: tokens.length };
}

/** The run graded by the server's own code, as a phone sends it. */
export function sliderHumanScore(p: WordSlidePuzzleData, skill: SliderHumanSkill, seed: number): { score: number; finished: boolean; slides: number } {
  const run = playSliderHuman(p, skill, seed);
  if (!run.steps.length) return { score: gradeSteps(p, [{ answer: "", atMs: 0 }], false).score, finished: false, slides: 0 };
  const graded = gradeSteps(p, asPhoneSends(p, run.steps), false);
  return { score: graded.score, finished: graded.isCorrect, slides: run.slides };
}
