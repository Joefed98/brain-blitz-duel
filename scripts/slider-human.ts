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
import { fiveLetterWords } from "../src/lib/duel/wordSlide.server";
import { applyShift, markedRowWord, shiftToken, WS_SIZE, type SlideShift } from "../src/lib/duel/wordSlide";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { Step } from "./puzzle-fairness/kit";
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

const SHIFTS: SlideShift[] = (["r", "c"] as const).flatMap((axis) =>
  Array.from({ length: WS_SIZE }, (_, index) => [1, -1].map((dir) => ({ axis, index, dir: dir as 1 | -1 }))).flat(),
);
const isUndo = (a: SlideShift | null, b: SlideShift) => !!a && a.axis === b.axis && a.index === b.index && a.dir === -b.dir;

/**
 * How close a row reads to an everyday word, as a person sees it: the most letters in place against any one (a row
 * one or two slides round from a word counts nearly as much, since the slide is plain to see), plus how many of a
 * word's letters the row holds at all (an anagram is easy to spot); 12 for a real word.
 */
const rowCache = new Map<string, number>();
const WORDS = () => fiveLetterWords();
function rowCloseness(row: string): number {
  const hit = rowCache.get(row);
  if (hit !== undefined) return hit;
  let best = 0;
  if (isWord(row)) best = 12;
  else {
    const lower = row.toLowerCase();
    const rot = [0, 1, 2, 3, 4].map((k) => lower.slice(k) + lower.slice(0, k));
    for (const w of WORDS()) {
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
      for (let k = 0; k < 5; k++) {
        let m = 0;
        for (let i = 0; i < WS_SIZE; i++) if (w[i] === rot[k]![i]) m++;
        const cost = k === 0 ? 0 : k === 1 || k === 4 ? 0.6 : 1.2;
        place = Math.max(place, m - cost);
      }
      best = Math.max(best, place + held * 0.8);
    }
  }
  if (rowCache.size > 400_000) rowCache.clear();
  rowCache.set(row, best);
  return best;
}

function closeness(grid: string[]): number {
  let total = 0;
  for (let r = 0; r < WS_SIZE; r++) total += rowCloseness(markedRowWord(grid, r));
  return total;
}
const allWords = (grid: string[]) => [0, 1, 2, 3, 4].every((r) => isWord(markedRowWord(grid, r)));

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
export function playSliderHuman(p: WordSlidePuzzleData, skill: SliderHumanSkill, seed: number): SliderHumanRun {
  const limit = puzzleTimeLimitMs(p);
  const rand = rng32(seed);
  let grid = [...p.grid];
  let clock = 0;
  const tokens: string[] = [];
  const steps: Step[] = [];
  const seen = new Map<string, number>([[grid.join(""), 1]]);
  let last: SlideShift | null = null;
  while (clock < limit && !allWords(grid)) {
    clock += skill.thinkMs;
    if (clock >= limit) break;
    // The best plan of up to `lookahead` slides: the closest board, boards seen before marked down (a person avoids
    // going round in circles), shorter plans first on a tie.
    const here = closeness(grid);
    let bestScore = -Infinity;
    let bestPlan: SlideShift[] = [];
    const search = (g: string[], plan: SlideShift[], prev: SlideShift | null) => {
      if (plan.length) {
        const key = g.join("");
        const score = (allWords(g) ? 1000 : closeness(g)) - 3 * (seen.get(key) ?? 0) - plan.length * 0.01 + rand() * 0.001;
        if (score > bestScore) {
          bestScore = score;
          bestPlan = [...plan];
        }
        if (allWords(g)) return;
      }
      if (plan.length >= skill.lookahead) return;
      for (const s of SHIFTS) {
        if (isUndo(prev, s)) continue;
        plan.push(s);
        search(applyShift(g, s), plan, s);
        plan.pop();
      }
    };
    search(grid, [], last);
    // No plan brings the board closer: an exploring slide (a person tries something), else the plan.
    const plan = bestScore > here - 0.001 ? bestPlan : [SHIFTS[Math.floor(rand() * SHIFTS.length)]!];
    for (const s of plan) {
      if (clock + skill.slideMs > limit) break;
      clock += skill.slideMs;
      grid = applyShift(grid, s);
      last = s;
      tokens.push(shiftToken(s));
      const key = grid.join("");
      seen.set(key, (seen.get(key) ?? 0) + 1);
      steps.push({ answer: tokens.join(","), atMs: clock });
      if (allWords(grid)) break;
    }
  }
  return { steps, finished: allWords(grid), slides: tokens.length };
}

/** The run graded by the server's own code, as a phone sends it. */
export function sliderHumanScore(p: WordSlidePuzzleData, skill: SliderHumanSkill, seed: number): { score: number; finished: boolean; slides: number } {
  const run = playSliderHuman(p, skill, seed);
  if (!run.steps.length) return { score: gradeSteps(p, [{ answer: "", atMs: 0 }], false).score, finished: false, slides: 0 };
  const graded = gradeSteps(p, asPhoneSends(p, run.steps), false);
  return { score: graded.score, finished: graded.isCorrect, slides: run.slides };
}
