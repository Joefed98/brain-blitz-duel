/**
 * The open word finds' person-style plays (Nucleus, Forage, Roundabout) on the length-aware people of word-human.ts, held
 * to the human limits and graded by the server (D1, 21 Nov 2026). Script-only. Each returns the steps a phone sends; grade
 * with `gradeOpenRun`. The level's rules come from the dealt puzzle (its shortest word, its clock), never the registry.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { isEverydayWord, isWord, wordsFrom } from "../src/lib/duel/dictionary.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";
import { isWordHuntMiss } from "../src/lib/duel/wordHunt.server";
import { lwEncodeLog, lwSpellable } from "../src/lib/duel/letterWheel";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { WORDHUNT_MISS_MARK } from "../src/lib/duel/scoring";
import {
  WORDHUNT_MIN_LENGTH,
  WORDSMITH_CENTRE_INDEX,
  WORDSMITH_MIN_LENGTH,
  WORDSMITH_SIZES,
  wordHuntCols,
  type LetterWheelPuzzleData,
  type PuzzleData,
  type WordHuntPuzzleData,
  type WordsmithPuzzleData,
} from "../src/lib/duel/types";
import { gradeSteps, type StandardRun } from "./standard-lib";
import { entryMs, PEOPLE, personFinds, witnessMs, type Candidate, type PersonLevel, type Step } from "./word-human";
import type { Rng } from "./puzzle-fairness/kit";

/** The shortest word a dealt puzzle counts (a level's stored `minLength`; today's 4 when absent). */
export function minLengthOf(puzzle: { minLength?: number }, fallback: number): number {
  return typeof puzzle.minLength === "number" && puzzle.minLength > 0 ? puzzle.minLength : fallback;
}

/** How often each person hunts the every-tile word / the gold tile first (the kits' spot rates, kits-word.ts). */
const HUNT: Record<PersonLevel, number> = { average: 0.05, good: 0.15, near: 0.6, elite: 0.8 };

/* --------------------------------------------------------------------------------------------- Nucleus */

/** Every word a Nucleus board accepts at its shortest length (the server's own rule: centre letter, no plurals). */
export function nucleusWords(d: WordsmithPuzzleData): string[] {
  const min = minLengthOf(d as { minLength?: number }, WORDSMITH_MIN_LENGTH);
  const centre = WORDSMITH_SIZES.some((s) => s === d.letters.length) ? d.letters[WORDSMITH_CENTRE_INDEX]!.toLowerCase() : "";
  return wordsFrom(d.letters.join(""), min, true)
    .filter((w) => (!centre || w.includes(centre)) && !isPluralForm(w))
    .map((w) => w.toUpperCase());
}

export function playNucleus(d: WordsmithPuzzleData, person: PersonLevel, rng: Rng, limitMs: number): Step[] {
  const p = PEOPLE[person];
  const hunt = rng.chance(HUNT[person]);
  const candidates: Candidate[] = nucleusWords(d).map((word) => ({
    word,
    taps: word.length + 1,
    everyday: isEverydayWord(word),
    priority: hunt && word.length >= d.letters.length ? 1e6 : 0,
  }));
  const found: string[] = [];
  return personFinds(p, candidates, limitMs, rng).map((f) => {
    found.unshift(f.word);
    return { answer: found.join(","), atMs: f.atMs };
  });
}

/* --------------------------------------------------------------------------------------------- Forage */

function neighbours(cell: number, n: number): number[] {
  const r = Math.floor(cell / n), c = cell % n;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n) out.push(nr * n + nc);
    }
  return out;
}

/** A short trace that spells no word (a wasted try the phone sends as a miss). */
function nonWordPath(d: WordHuntPuzzleData, rng: Rng, min: number): number[] {
  const n = wordHuntCols(d.grid);
  for (let tries = 0; tries < 200; tries++) {
    const len = rng.int(min, min + 1);
    const path = [rng.below(d.grid.length)];
    while (path.length < len) {
      const next = neighbours(path[path.length - 1]!, n).filter((x) => !path.includes(x));
      if (!next.length) break;
      path.push(rng.pick(next));
    }
    if (path.length >= min && isWordHuntMiss(d.grid, path)) return path;
  }
  return [0, 1, 2, 3];
}

/**
 * Forage's find times relative to Nucleus's: the spec's length-aware player took the kits' pace × 0.9 on a letter grid
 * (× 0.8 on the ring), so the same people find Forage's words 0.9 / 0.8 as slowly (average about 64 on today's Normal).
 */
export const FORAGE_FIND_SCALE = 0.9 / 0.8;

export function playForage(d: WordHuntPuzzleData, person: PersonLevel, rng: Rng, limitMs: number): Step[] {
  const p = PEOPLE[person];
  const min = minLengthOf(d as { minLength?: number }, WORDHUNT_MIN_LENGTH);
  const gold = typeof d.golden === "number" ? d.golden : -1;
  const goldFirst = rng.chance(HUNT[person]);
  const byWord = new Map((d.words ?? []).filter((w) => w.word.length >= min).map((w) => [w.word.toUpperCase(), w.path]));
  const candidates: Candidate[] = [...byWord.entries()].map(([word, path]) => ({
    word,
    taps: path.length,
    everyday: isEverydayWord(word),
    priority: goldFirst && path.includes(gold) ? 2 : 0,
  }));
  const found: string[] = [];
  const misses: number[][] = [];
  const answer = () => [...found, ...misses.map((m) => `${WORDHUNT_MISS_MARK}${m.join("-")}`)].join(",");
  return personFinds(p, candidates, limitMs, rng, FORAGE_FIND_SCALE).map((f) => {
    for (let k = 0; k < f.slips; k++) misses.push(nonWordPath(d, rng, Math.max(4, min)));
    found.unshift(`${f.word}:${byWord.get(f.word)!.join("-")}`);
    return { answer: answer(), atMs: f.atMs };
  });
}

/* --------------------------------------------------------------------------------------------- Roundabout */

/** Roundabout's bonus words: every dictionary word of 3+ letters the wheel spells that fills no slot. */
export function roundaboutBonusWords(d: LetterWheelPuzzleData): string[] {
  const slots = new Set((d.words ?? []).map((w) => w.toUpperCase()));
  return wordsFrom(d.letters, 3, true)
    .map((w) => w.toUpperCase())
    .filter((w) => !slots.has(w) && lwSpellable(d.letters, w) && isWord(w));
}

/**
 * A Roundabout run: the person traces what they find in their own order (crossword words and bonus words alike); the
 * last crossword word ends the round, so they hold it back while they still find bonus words, until `holdMs` of the
 * clock (a strong player's judgement of when the speed points are worth more than the jar). Wasted tries are traced as
 * near-misses (a letter dropped), which the server counts as misses.
 */
export function playRoundabout(d: LetterWheelPuzzleData, person: PersonLevel, rng: Rng, limitMs: number, holdMs = limitMs * 0.4): Step[] {
  const p = PEOPLE[person];
  const slots = (d.words ?? []).map((w) => w.toUpperCase());
  const candidates: Candidate[] = [
    ...slots.map((word) => ({ word, taps: word.length, everyday: true })),
    ...roundaboutBonusWords(d).map((word) => ({ word, taps: word.length, everyday: isEverydayWord(word) })),
  ];
  const finds = personFinds(p, candidates, limitMs, rng);
  const slotSet = new Set(slots);
  const traces: string[] = [];
  const steps: Step[] = [];
  let filled = 0;
  let held: { word: string; atMs: number } | null = null;
  for (const f of finds) {
    for (let k = 0; k < f.slips; k++) traces.push(f.word.length > 3 ? f.word.slice(1) + f.word[0] : f.word.split("").reverse().join(""));
    const isSlot = slotSet.has(f.word);
    if (isSlot && filled === slots.length - 1 && f.atMs < holdMs) {
      held = { word: f.word, atMs: f.atMs };
      continue;
    }
    if (held && !isSlot && f.atMs >= holdMs) break;
    traces.push(f.word);
    if (isSlot) filled++;
    steps.push({ answer: lwEncodeLog(traces), atMs: f.atMs });
    if (filled === slots.length) return steps;
  }
  if (held) {
    const at = Math.max(held.atMs, Math.min(holdMs, steps[steps.length - 1]?.atMs ?? held.atMs) + 400);
    traces.push(held.word);
    steps.push({ answer: lwEncodeLog(traces), atMs: Math.min(limitMs, at) });
  }
  return steps;
}

/* --------------------------------------------------------------------------------------------- grading */

/** The server's grade of a run: open finds submit their haul at the buzzer; Roundabout ends on its last slot. */
export function gradeOpenRun(puzzle: PuzzleData, steps: readonly Step[]): StandardRun {
  const limit = puzzleTimeLimitMs(puzzle);
  if (puzzle.type === "letterwheel") return gradeSteps(puzzle, steps);
  const inTime = steps.filter((s) => s.atMs <= limit);
  const last = inTime[inTime.length - 1]?.answer ?? "";
  const g = gradeAnswer(puzzle, last, 0);
  return { score: g.score, isCorrect: g.isCorrect, seconds: limit / 1000, graded: g };
}

export function playOpen(puzzle: PuzzleData, person: PersonLevel, rng: Rng): Step[] {
  const limit = puzzleTimeLimitMs(puzzle);
  if (puzzle.type === "wordsmith") return playNucleus(puzzle, person, rng, limit);
  if (puzzle.type === "wordhunt") return playForage(puzzle, person, rng, limit);
  if (puzzle.type === "letterwheel") return playRoundabout(puzzle, person, rng, limit);
  throw new Error(`${puzzle.type}: not an open word find`);
}

/* --------------------------------------------------------------------------------------------- witnesses */

export interface Witness {
  /** The server's score for the witness's answer, entered at the human limits. */
  score: number;
  /** Clock time the witness's last entry lands. */
  ms: number;
  /** Entries in the witness. */
  entries: number;
  answer: string;
}

/**
 * The typed witness for an open word find (the proof of reachability): a player who knows every accepted word enters
 * them best value per second first, at the human limits, and stops at the first answer the server scores 200 (or at the
 * clock). `entries` are the words with their taps and the answer each would add; `grade` is the server's grade of an
 * answer at the time it lands. Returns the best the witness reached.
 */
export function openWitness(
  entries: readonly { key: string; taps: number; value: number }[],
  build: (keys: readonly string[]) => string,
  grade: (answer: string, atMs: number) => number,
  limitMs: number,
): Witness {
  const order = [...entries].sort((a, b) => b.value / entryMs(b.taps) - a.value / entryMs(a.taps));
  const keys: string[] = [];
  let at = 0;
  let best: Witness = { score: grade(build([]), 0), ms: 0, entries: 0, answer: build([]) };
  for (const e of order) {
    if (at + entryMs(e.taps) > limitMs) continue;
    at += entryMs(e.taps);
    keys.push(e.key);
    const answer = build(keys);
    const score = grade(answer, at);
    if (score > best.score) best = { score, ms: at, entries: keys.length, answer };
    if (score >= 200) break;
  }
  return best;
}

export function nucleusWitness(d: WordsmithPuzzleData): Witness {
  const limit = puzzleTimeLimitMs(d);
  const words = nucleusWords(d);
  const points = (w: string) => ({ 3: 1, 4: 1, 5: 2, 6: 4, 7: 7, 8: 11 } as Record<number, number>)[w.length] ?? 15;
  return openWitness(
    words.map((w) => ({ key: w, taps: w.length + 1, value: points(w) + (w.length >= d.letters.length ? 40 : 0) })),
    (keys) => [...keys].reverse().join(","),
    (answer) => gradeAnswer(d, answer, 0).score,
    limit,
  );
}

export function forageWitness(d: WordHuntPuzzleData): Witness {
  const limit = puzzleTimeLimitMs(d);
  const min = minLengthOf(d as { minLength?: number }, WORDHUNT_MIN_LENGTH);
  const list = (d.words ?? []).filter((w) => w.word.length >= min);
  const value = (w: { word: string; path: number[] }) => {
    const base = ({ 3: 1, 4: 1, 5: 2, 6: 4, 7: 7 } as Record<number, number>)[w.word.length] ?? 11;
    const long = w.word.length >= 7 ? 2 : w.word.length >= 6 ? 1.5 : 1;
    return base * long * (typeof d.golden === "number" && w.path.includes(d.golden) ? 2 : 1);
  };
  return openWitness(
    list.map((w) => ({ key: `${w.word.toUpperCase()}:${w.path.join("-")}`, taps: w.path.length, value: value(w) })),
    (keys) => [...keys].reverse().join(","),
    (answer) => gradeAnswer(d, answer, 0).score,
    limit,
  );
}

/**
 * Roundabout's witness: the bonus words that fill the jar first (longest first: most drops a second), then every
 * crossword word, the last one ending the round; graded at the time it lands (the speed part reads it).
 */
export function roundaboutWitness(d: LetterWheelPuzzleData): Witness {
  const limit = puzzleTimeLimitMs(d);
  const slots = (d.words ?? []).map((w) => w.toUpperCase());
  const bonus = roundaboutBonusWords(d).sort((a, b) => b.length - a.length);
  const size = Math.max(1, d.jarSize ?? 30);
  const drops = (w: string) => (w.length <= 3 ? 1 : w.length === 4 ? 2 : w.length === 5 ? 3 : 4);
  let best: Witness = { score: 0, ms: 0, entries: 0, answer: "" };
  // Try every jar fill from none to full: more bonus words cost speed, so the best mix is searched, not assumed.
  let jar: string[] = [];
  let filled = 0;
  for (let k = 0; k <= bonus.length; k++) {
    if (k > 0) {
      if (filled >= size) break;
      jar = [...jar, bonus[k - 1]!];
      filled += drops(bonus[k - 1]!);
    }
    const traces = [...jar, ...slots];
    const ms = witnessMs(traces.map((t) => t.length));
    if (ms > limit) break;
    const answer = lwEncodeLog(traces);
    const score = gradeAnswer(d, answer, Math.max(0, limit - ms)).score;
    if (score > best.score) best = { score, ms, entries: traces.length, answer };
  }
  return best;
}

export function witnessOf(puzzle: PuzzleData): Witness {
  if (puzzle.type === "wordsmith") return nucleusWitness(puzzle);
  if (puzzle.type === "wordhunt") return forageWitness(puzzle);
  if (puzzle.type === "letterwheel") return roundaboutWitness(puzzle);
  throw new Error(`${puzzle.type}: no witness`);
}
