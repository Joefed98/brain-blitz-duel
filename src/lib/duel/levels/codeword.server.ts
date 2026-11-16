import type { GenerateContext } from "../generate.server";
import type { CodewordPuzzleData, PuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { CodewordLevelSettings } from "@/lib/levels/word/codeword";
import { CODEWORD_BANK } from "../codewordBank.server";
import { codewordFromEntry, codewordNextGuesses, generateCodeword } from "../codeword.server";
import { fmix32, saltOf, wordGameSeed } from "../wordSeed.server";
import { CODEWORD_EXPERT_INDICES } from "./codewordExpert.data";

/**
 * Cryptogrid at a level beyond Normal (the Word overhaul, stage 3, 15 Nov 2026; settings in
 * src/lib/levels/word/codeword.ts). Every level deals the room seed's board from the same 1,000-board bank, with today's
 * stamps, and changes only how many numbers start decoded and the clock:
 *
 *  - Easy: Normal's six plus two more, each the hidden number that leaves the most words one number from done (the
 *    sixth given's rule, codewordSixthGiven), so eight. More letters given never adds a solution: still exactly one.
 *  - Hard: the bank entry's four plus its fifth (rev 2's five, each board proven to have exactly one solution by
 *    scripts/codeword-check.ts).
 *  - Expert: the bank entry's own four (proven unique the same way), dealt only from the boards the human-like solver
 *    decodes from those four letters (codewordExpert.data.ts), so every Expert board can be solved by reasoning.
 *
 * The board, the grader and the live check read the stored givens, so nothing else changes.
 */
export function dealCryptogridLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<CodewordLevelSettings>("codeword", level);
  if (!settings) return null;
  const seed = wordGameSeed("codeword", context.bankSeed);
  const normal = generateCodeword(seed);
  const entry = level === "expert"
    ? CODEWORD_BANK[CODEWORD_EXPERT_INDICES[fmix32((seed >>> 0) ^ saltOf("codeword-expert")) % CODEWORD_EXPERT_INDICES.length]!]!
    : CODEWORD_BANK.find((e) => codewordFromEntry(e, 1).solution === normal.solution && codewordFromEntry(e, 1).cells.join() === normal.cells.join())!;
  const base = codewordFromEntry(entry, normal.codewordRev);
  const givens = givensFor(entry, settings.givens);
  return { ...base, givens, timeLimitMs: settings.clockMs } satisfies CodewordPuzzleData;
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
