import type { GenerateContext } from "../generate.server";
import type { PuzzleData, WordHuntPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { WordHuntLevelSettings } from "@/lib/levels/word/wordhunt";
import { WORDHUNT_PAR_SHARE } from "../types";
import { scoreWordHuntDepth, wordHuntFullAtOf, wordHuntValue } from "../wordHunt";
import { generateWordHuntDepthBand, solveBoard } from "../wordHunt.server";
import { WORDHUNT_REV_STAR } from "../wordStar";
import { limitEntryMs } from "./humanLimits";

/**
 * The typed witness (D1, 21 Nov 2026; the proof a level's 200 is reachable by the best humans): a player who sees every
 * listed word traces them best points a second first (through the golden tile where the listed path runs), at the human
 * limits (humanLimits.ts: 0.25 s a word and 0.15 s a traced letter), and the board passes when the refit's score
 * (wordHuntRev 5) reaches 200 inside `limitMs`. Returns the time it took, or null.
 */
export function forageWitnessMs(puzzle: WordHuntPuzzleData, minLength: number, limitMs: number): number | null {
  const words = (puzzle.words ?? []).filter((w) => w.word.length >= minLength);
  const valueOf = (w: { word: string; path: number[] }) => wordHuntValue(w.word, w.path, puzzle.golden, minLength);
  const order = [...words].sort((a, b) => valueOf(b).value / limitEntryMs(b.path.length) - valueOf(a).value / limitEntryMs(a.path.length));
  let base = 0;
  let extra = 0;
  let at = 0;
  for (const w of order) {
    const ms = limitEntryMs(w.path.length);
    if (at + ms > limitMs) continue;
    at += ms;
    const v = valueOf(w);
    base += v.base;
    extra += v.extra;
    if (scoreWordHuntDepth(base, extra, 100, WORDHUNT_REV_STAR, wordHuntFullAtOf(puzzle)).score >= 200) return at;
  }
  return null;
}

/** A board rebuilt at a level's shortest word: its listed words (paths through the golden tile where they can) and par. */
export function forageAtMinLength(made: WordHuntPuzzleData, minLength: number): WordHuntPuzzleData {
  const words = solveBoard(made.grid, typeof made.golden === "number" ? made.golden : null, minLength);
  const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
  return { ...made, words, totalPoints, par: Math.max(1, Math.round(totalPoints * WORDHUNT_PAR_SHARE)), minLength };
}

/** Packed boards drawn at most this many times for one holding the level's long words and witness. */
export const FORAGE_LEVEL_TRIES = 24;
/** More boards drawn, only when none of the first tries has its proof, before the deal gives up. */
export const FORAGE_WITNESS_TRIES = 2000;

/**
 * Forage dealt at a level beyond Normal (D1, 21 Nov 2026; settings in src/lib/levels/word/wordhunt.ts): a packed 6×6
 * board built as Normal's is, inside the level's band of everyday words, holding at least `longWords` everyday words of
 * the level's shortest length (Easy 3, Hard 5, Expert 7), listed from that length, with the level's free misses, on the
 * level's clock. Where the level asks (`witness`), only a board the typed witness takes to 200 inside the clock is kept.
 * Never called at Normal, so Normal is exactly today's deal.
 */
export function dealForageLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<WordHuntLevelSettings>("wordhunt", level);
  if (!settings) return null;
  let best: WordHuntPuzzleData | null = null;
  let bestGap = Infinity;
  for (let attempt = 0; attempt < FORAGE_LEVEL_TRIES; attempt++) {
    const made = { ...forageAtMinLength(generateWordHuntDepthBand(settings.words.min, settings.words.max, settings.seeds), settings.minLength), ...(settings.fullAt ? { baseFullAt: settings.fullAt[0], extraFullAt: settings.fullAt[1] } : {}) };
    const long = (made.words ?? []).length;
    const witness = settings.witness ? forageWitnessMs(made, settings.minLength, settings.timeLimitMs) : 0;
    const gap = Math.max(0, settings.longWords - long) + (witness === null ? 1000 : 0);
    if (gap < bestGap) {
      best = made;
      bestGap = gap;
    }
    if (gap === 0) break;
  }
  // Every dealt board where the level asks has its proof (Joe's decision 21): past the tries, keep drawing until the
  // typed witness takes one to 200 (never seen needed on 500 room seeds a level, 21 Nov 2026).
  for (let extra = 0; settings.witness && bestGap >= 1000; extra++) {
    if (extra >= FORAGE_WITNESS_TRIES) throw new Error(`Forage ${level}: no board the witness takes to 200`);
    const made = { ...forageAtMinLength(generateWordHuntDepthBand(settings.words.min, settings.words.max, settings.seeds), settings.minLength), ...(settings.fullAt ? { baseFullAt: settings.fullAt[0], extraFullAt: settings.fullAt[1] } : {}) };
    if (forageWitnessMs(made, settings.minLength, settings.timeLimitMs) === null) continue;
    best = made;
    bestGap = Math.max(0, settings.longWords - (made.words ?? []).length);
  }
  return {
    ...best!,
    timeLimitMs: settings.timeLimitMs,
    ...(settings.freeMisses ? { freeMisses: settings.freeMisses[0], freeMissesPerWord: settings.freeMisses[1] } : {}),
  };
}
