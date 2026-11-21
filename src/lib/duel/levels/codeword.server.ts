import type { GenerateContext } from "../generate.server";
import type { CodewordPuzzleData, PuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { CodewordLevelSettings } from "@/lib/levels/word/codeword";
import { CODEWORD_DEPTH_REV, CODEWORD_REV } from "../codeword";
import { codewordFromEntry, codewordFromLevelEntry, codewordNextGuesses } from "../codeword.server";
import { CODEWORD_LEVEL_BANK } from "../codewordLevelBank.server";
import { dealtDepthRev } from "../wordDepth";
import { fmix32, saltOf, wordGameSeed } from "../wordSeed.server";

/**
 * Cryptogrid at a level beyond Normal (redesigned by D1, 21 Nov 2026; settings in src/lib/levels/word/codeword.ts): the
 * room seed's board from the level's own bank (src/lib/duel/codewordLevelBank.server.ts, scripts/codeword-bank.ts
 * --levels): Easy a 5 × 5 lattice of six words with six letters in, Hard an 8 × 8 grid with five, Expert a 9 × 9 grid with
 * four that the person-like solver cracks by reasoning alone. Each board is proven to have exactly one decoding from its
 * stored starting letters; its size, clock and speed line are stored on the puzzle (the grader, the live check and the
 * stage read them), on today's rules stamp. Never called at Normal, so Normal is exactly today's deal.
 */
export function dealCryptogridLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<CodewordLevelSettings>("codeword", level);
  if (!settings) return null;
  const bank = CODEWORD_LEVEL_BANK[level];
  const seed = wordGameSeed("codeword", context.bankSeed);
  const entry = bank[fmix32((seed >>> 0) ^ saltOf(`codeword-level:${level}`)) % bank.length]!;
  const base = codewordFromLevelEntry(entry, dealtDepthRev(CODEWORD_DEPTH_REV, CODEWORD_REV));
  return { ...base, timeLimitMs: settings.clockMs, speedFullByS: settings.speedFullByS } satisfies CodewordPuzzleData;
}

/** The entry's givens at a count: 4 (its own), 5 (plus the fifth), 6 (plus the sixth), more by the sixth's rule. */
export function givensFor(entry: string, count: number): CodewordPuzzleData["givens"] {
  const rev = count >= 6 ? 3 : count === 5 ? 2 : 1;
  const start = codewordFromEntry(entry, rev);
  const known = new Set(start.givens.map((g) => g.n));
  const order = start.solution ?? "";
  while (known.size < count && known.size < start.numbers) known.add(nextGiven(start.cells, start.numbers, known));
  return [...known].sort((a, b) => a - b).map((n) => ({ n, letter: order[n - 1]! }));
}

/** The hidden number that leaves the most numbers guessable, then the most words one number from done, then the most used. */
function nextGiven(cells: readonly number[], numbers: number, known: ReadonlySet<number>): number {
  const uses = new Map<number, number>();
  for (const n of cells) if (n > 0) uses.set(n, (uses.get(n) ?? 0) + 1);
  let best = -1;
  let bestKey: number[] = [];
  for (let n = 1; n <= numbers; n++) {
    if (known.has(n)) continue;
    const g = codewordNextGuesses(cells, new Set([...known, n]));
    const key = [g.guessable, g.words, uses.get(n) ?? 0];
    const at = key.findIndex((v, i) => v !== bestKey[i]);
    if (best < 0 || (at >= 0 && key[at]! > bestKey[at]!)) {
      best = n;
      bestKey = key;
    }
  }
  return best;
}
