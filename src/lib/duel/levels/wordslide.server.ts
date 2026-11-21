import type { GenerateContext } from "../generate.server";
import type { PuzzleData, WordSlidePuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { WORDSLIDE_LEVEL_SETTINGS, type WordSlideLevelSettings } from "@/lib/levels/word/wordslide";
import { fiveLetterWords, markedRowsSolved, slideWords } from "../wordSlide.server";
import { wordSlideDistance } from "../wordSlideDistance.server";
import { applyShift, WORD_SLIDE_REV_SIZED, WS_SIZE, type SlideShift } from "../wordSlide";
import { SLIDER_LEVEL_BANK } from "../sliderLevelBank.server";
import { rngBelow, seededRng, wordGameSeed } from "../wordSeed.server";

/**
 * Slider dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/wordslide.ts):
 * today's recipe (five different common words, a scramble that never undoes its last slide and leaves no row a word)
 * with the level's scramble length, from its own stream of the room seed (salted by level), kept only when the proven
 * fewest slides back (the par) is in the level's range. The par is stored as proven, so the deal's later layer finds
 * the same. Never called at Normal.
 */
export function dealSliderLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  const s = WORDSLIDE_LEVEL_SETTINGS[level];
  const seed = wordGameSeed(`wordslide:${level}`, context.bankSeed);
  // D1 (21 Nov 2026): Hard and Expert deal from their proved banks (scripts/slider-level-bank.ts), drawn by the room's seed.
  const bank = s.bank ? SLIDER_LEVEL_BANK[level as "hard" | "expert"] : undefined;
  if (bank?.length) return sliderBankPuzzle(s, bank[rngBelow(seededRng(seed), bank.length)]!);
  return buildWordSlideLevel(s, seed);
}

/** A level bank entry as the dealt puzzle (wordSlideRev 7: the grid's size stored; the proven par; the level's clock). */
export function sliderBankPuzzle(s: WordSlideLevelSettings, e: { grid: string; words: readonly string[]; par: number }): WordSlidePuzzleData {
  return sizedSlider(s, { type: "wordslide", grid: [...e.grid], par: e.par, words: [...e.words] });
}

/** The stamp a sized level board carries (wordSlideRev 7 and its size; Normal's 5 × 5 deals keep their stamp). */
function sizedSlider(s: WordSlideLevelSettings, made: WordSlidePuzzleData): WordSlidePuzzleData {
  return { ...made, ...(s.timeLimitMs ? { timeLimitMs: s.timeLimitMs } : {}), size: s.size, wordSlideRev: WORD_SLIDE_REV_SIZED };
}

/** Null when a level board meets its settings, else the rule broken (the check reads the same). */
export function wordSlideLevelRuleBreak(p: WordSlidePuzzleData, s: WordSlideLevelSettings): string | null {
  const size = s.size;
  const words = p.words ?? [];
  if (words.length !== size || new Set(words).size !== size) return `not ${size} different words`;
  if (!words.every((w) => slideWords(size).includes(w.toLowerCase()))) return `a word outside the everyday ${size}-letter words`;
  if ([...p.grid].sort().join("") !== [...words.join("")].sort().join("")) return "grid is not a scramble of the words";
  if (markedRowsSolved(p.grid, size) > 0) return "a row starts as a word";
  const d = wordSlideDistance(p.grid, [...words.join("")], s.par[1]);
  if (d === null || d !== p.par) return `stored par ${p.par}, the search says ${d}`;
  if (d < s.par[0] || d > s.par[1]) return `par ${d} outside ${s.par[0]}-${s.par[1]}`;
  if (p.timeLimitMs !== s.timeLimitMs) return "clock";
  if (p.size !== size || p.wordSlideRev !== WORD_SLIDE_REV_SIZED) return "size or stamp";
  return null;
}

/**
 * One level board from a seed (D1, 21 Nov 2026; the bank script and Easy's deal): `size` different everyday words of
 * `size` letters, a scramble of the level's length that never undoes its last slide and leaves no row a word, kept only
 * when the proven fewest slides back (the par) is in the level's range.
 */
export function buildWordSlideLevel(s: WordSlideLevelSettings, seed: number): WordSlidePuzzleData {
  const rng = seededRng(seed);
  const size = s.size;
  const pool = size === WS_SIZE ? fiveLetterWords() : slideWords(size);
  for (let attempt = 0; attempt < 400; attempt++) {
    const chosen = Array.from({ length: size }, () => pool[rngBelow(rng, pool.length)]!.toUpperCase());
    if (new Set(chosen).size < size) continue;
    const goal = [...chosen.join("")];
    const count = s.shifts[0] + rngBelow(rng, s.shifts[1] - s.shifts[0] + 1);
    let grid = goal;
    let previous: SlideShift | null = null;
    for (let n = 0; n < count; n++) {
      let shift: SlideShift;
      do {
        shift = { axis: rngBelow(rng, 2) ? "r" : "c", index: rngBelow(rng, size), dir: rngBelow(rng, 2) ? 1 : -1 };
      } while (previous && previous.axis === shift.axis && previous.index === shift.index && previous.dir === -shift.dir);
      grid = applyShift(grid, shift, undefined, size);
      previous = shift;
    }
    if (markedRowsSolved(grid, size) > 0) continue;
    const par = wordSlideDistance(grid, goal, s.par[1]);
    if (par === null || par < s.par[0]) continue;
    return sizedSlider(s, { type: "wordslide", grid, par, words: chosen });
  }
  throw new Error("Slider: no level board found");
}
