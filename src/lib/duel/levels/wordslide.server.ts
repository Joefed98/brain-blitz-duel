import type { GenerateContext } from "../generate.server";
import type { PuzzleData, WordSlidePuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { WORDSLIDE_LEVEL_SETTINGS, type WordSlideLevelSettings } from "@/lib/levels/word/wordslide";
import { fiveLetterWords, markedRowsSolved, stampWordSlideRev } from "../wordSlide.server";
import { wordSlideDistance } from "../wordSlideDistance.server";
import { applyShift, WS_SIZE, type SlideShift } from "../wordSlide";
import { rngBelow, seededRng, wordGameSeed } from "../wordSeed.server";

/**
 * Slider dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/wordslide.ts):
 * today's recipe (five different common words, a scramble that never undoes its last slide and leaves no row a word)
 * with the level's scramble length, from its own stream of the room seed (salted by level), kept only when the proven
 * fewest slides back (the par) is in the level's range. The par is stored as proven, so the deal's later layer finds
 * the same. Never called at Normal.
 */
export function dealSliderLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  return buildWordSlideLevel(WORDSLIDE_LEVEL_SETTINGS[level], wordGameSeed(`wordslide:${level}`, context.bankSeed));
}

/** Null when a level board meets its settings, else the rule broken (the check reads the same). */
export function wordSlideLevelRuleBreak(p: WordSlidePuzzleData, s: WordSlideLevelSettings): string | null {
  const words = p.words ?? [];
  if (words.length !== WS_SIZE || new Set(words).size !== WS_SIZE) return "not five different words";
  if (!words.every((w) => fiveLetterWords().includes(w.toLowerCase()))) return "a word outside the common five-letter words";
  if ([...p.grid].sort().join("") !== [...words.join("")].sort().join("")) return "grid is not a scramble of the words";
  if (markedRowsSolved(p.grid) > 0) return "a row starts as a word";
  const d = wordSlideDistance(p.grid, [...words.join("")], s.par[1]);
  if (d === null || d !== p.par) return `stored par ${p.par}, the search says ${d}`;
  if (d < s.par[0] || d > s.par[1]) return `par ${d} outside ${s.par[0]}-${s.par[1]}`;
  if (p.timeLimitMs !== s.timeLimitMs) return "clock";
  return null;
}

export function buildWordSlideLevel(s: WordSlideLevelSettings, seed: number): WordSlidePuzzleData {
  const rng = seededRng(seed);
  const pool = fiveLetterWords();
  for (let attempt = 0; attempt < 400; attempt++) {
    const chosen = Array.from({ length: WS_SIZE }, () => pool[rngBelow(rng, pool.length)]!.toUpperCase());
    if (new Set(chosen).size < WS_SIZE) continue;
    const goal = [...chosen.join("")];
    const count = s.shifts[0] + rngBelow(rng, s.shifts[1] - s.shifts[0] + 1);
    let grid = goal;
    let previous: SlideShift | null = null;
    for (let n = 0; n < count; n++) {
      let shift: SlideShift;
      do {
        shift = { axis: rngBelow(rng, 2) ? "r" : "c", index: rngBelow(rng, WS_SIZE), dir: rngBelow(rng, 2) ? 1 : -1 };
      } while (previous && previous.axis === shift.axis && previous.index === shift.index && previous.dir === -shift.dir);
      grid = applyShift(grid, shift);
      previous = shift;
    }
    if (markedRowsSolved(grid) > 0) continue;
    const par = wordSlideDistance(grid, goal, s.par[1]);
    if (par === null || par < s.par[0]) continue;
    const made: WordSlidePuzzleData = { type: "wordslide", grid, par, words: chosen, ...(s.timeLimitMs ? { timeLimitMs: s.timeLimitMs } : {}) };
    return stampWordSlideRev(made);
  }
  throw new Error("Slider: no level board found");
}
