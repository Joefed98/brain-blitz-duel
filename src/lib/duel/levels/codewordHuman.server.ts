import { commonWords } from "../dictionary.server";
import { CW_SIZE, codewordRuns } from "../codeword";

/**
 * A Cryptogrid solver that reasons the way a person does (the Word overhaul's Expert level, 15 Nov 2026): it never
 * guesses. It looks only at the board (the numbers in each word and the letters it has decoded so far) and the words a
 * player knows: the everyday list (commonWords, far wider than the answer list the boards' words come from, so a
 * pattern a person could read two ways counts as open), and it fixes a number's letter only when that letter is
 * forced:
 *
 *  1. A word whose pattern (decoded letters in place, the same number the same letter, different numbers different
 *     letters, no letter that already belongs to another number) fits exactly one everyday word: every number in it is
 *     decoded.
 *  2. A number whose letter is the same in every everyday word still fitting one of its words: that letter.
 *
 * It repeats until the board is decoded or nothing more is forced. A board this solver decodes from its starting
 * letters alone can be solved by reasoning, with no trial and error.
 */
export interface HumanSolve {
  solved: boolean;
  /** Numbers still unknown when it stopped. */
  left: number;
  /** Rounds of deduction it took. */
  steps: number;
  /** The letter it decoded on each number (index n − 1), "" where it found none. */
  letters: string[];
  /** The numbers it decoded, in the order it decoded them (D1, 21 Nov 2026: the timed line enters them in this order). */
  order: number[];
}

export function solveCodewordLikeAHuman(cells: readonly number[], numbers: number, givens: readonly { n: number; letter: string }[]): HumanSolve {
  const letterOf = new Map<number, string>(givens.map((g) => [g.n, g.letter]));
  // D1 (21 Nov 2026): any square grid (a level board's 5, 8 or 9 a side); today's 49 cells are 7 × 7.
  const runs = codewordRuns(cells, Math.round(Math.sqrt(cells.length)) || CW_SIZE).map((r) => r.cells.map((c) => cells[c]!));
  const order: number[] = [];
  let steps = 0;
  for (;;) {
    const letters = () => Array.from({ length: numbers }, (_, i) => letterOf.get(i + 1) ?? "");
    if (letterOf.size >= numbers) return { solved: true, left: 0, steps, letters: letters(), order };
    steps++;
    const used = new Set(letterOf.values());
    let progressed = false;
    for (const run of runs) {
      if (run.every((n) => letterOf.has(n))) continue;
      const fits = knownWords(run.length).filter((w) => fitsPattern(w, run, letterOf, used));
      if (fits.length === 0) continue;
      if (fits.length === 1) {
        const w = fits[0]!;
        run.forEach((n, i) => {
          if (!letterOf.has(n)) {
            letterOf.set(n, w[i]!);
            used.add(w[i]!);
            order.push(n);
            progressed = true;
          }
        });
        continue;
      }
      // Rule 2: a number that takes the same letter in every fitting word.
      run.forEach((n, i) => {
        if (letterOf.has(n)) return;
        const letters = new Set(fits.map((w) => w[i]!));
        if (letters.size === 1) {
          const letter = [...letters][0]!;
          if (!used.has(letter)) {
            letterOf.set(n, letter);
            used.add(letter);
            order.push(n);
            progressed = true;
          }
        }
      });
    }
    if (!progressed) return { solved: false, left: numbers - letterOf.size, steps, letters: letters(), order };
  }
}

function fitsPattern(word: string, run: readonly number[], letterOf: ReadonlyMap<number, string>, used: ReadonlySet<string>): boolean {
  const mine = new Map<number, string>();
  const taken = new Set<string>();
  for (let i = 0; i < run.length; i++) {
    const n = run[i]!;
    const ch = word[i]!;
    const known = letterOf.get(n);
    if (known !== undefined) {
      if (known !== ch) return false;
      continue;
    }
    if (used.has(ch)) return false;
    const seen = mine.get(n);
    if (seen !== undefined) {
      if (seen !== ch) return false;
      continue;
    }
    if (taken.has(ch)) return false;
    mine.set(n, ch);
    taken.add(ch);
  }
  return true;
}

const known = new Map<number, string[]>();
/** The everyday words of one length, upper case. */
function knownWords(length: number): string[] {
  let list = known.get(length);
  if (!list) {
    list = [...new Set(commonWords().filter((w) => w.length === length && /^[a-z]+$/.test(w)).map((w) => w.toUpperCase()))];
    known.set(length, list);
  }
  return list;
}
