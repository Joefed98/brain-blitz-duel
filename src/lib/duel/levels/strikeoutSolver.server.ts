import { strikeoutAnswerWords } from "../strikeout.server";
import { SO2_VOWELS, replayStrikeout2, so2RulesFor, type So2Action } from "../strikeout";
import type { StrikeoutPuzzleData } from "../types";

/**
 * A solver that plays Strikeout the way a person does (the Word overhaul's levels, 15 Nov 2026): it never sees the
 * answers. For the word in play it keeps the answer words of that length still possible (the tiles showing, no letter it
 * has seen miss), guesses the letter found in the most of them (a vowel only while vowel guesses are left), and solves
 * the moment one word is left. Used by the level deal (an Expert set it can't clear within the strikes is drawn again)
 * and by scripts/strikeout-levels-check.ts.
 */
export interface StrikeoutSolve {
  solved: boolean;
  strikes: number;
  /** Per word: the candidates left when the solver committed (1 when it read the word for certain). */
  candidatesAtSolve: number[];
  actions: So2Action[];
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function solveStrikeoutLikeAPerson(puzzle: StrikeoutPuzzleData): StrikeoutSolve {
  const words = (puzzle.words ?? []).map((w) => w.toUpperCase());
  const givens = puzzle.givens ?? [];
  const rules = so2RulesFor(puzzle);
  const actions: So2Action[] = [];
  const candidatesAtSolve: number[] = [];
  const replay = () => replayStrikeout2(words, givens, actions, () => true, rules);
  for (let guard = 0; guard < 400; guard++) {
    const state = replay();
    if (state.done || state.over) break;
    const w = state.word;
    const target = words[w]!;
    const shown = [...target].map((ch, i) => (state.revealed[w]![i] ? ch : ""));
    const seen = new Set([...state.guessed, ...shown.filter(Boolean)]);
    const candidates = strikeoutAnswerWords(target.length).filter((c) => {
      for (let i = 0; i < c.length; i++) {
        if (shown[i]) {
          if (c[i] !== shown[i]) return false;
        } else if (seen.has(c[i]!)) return false;
      }
      return true;
    });
    if (candidates.length === 1) {
      candidatesAtSolve.push(1);
      actions.push({ kind: "solve", word: w, guess: candidates[0]! });
      continue;
    }
    const vowelsLeft = rules.maxVowels - state.vowelsUsed;
    const open = [...ALPHA].filter((l) => !seen.has(l) && (vowelsLeft > 0 || !SO2_VOWELS.includes(l)));
    if (!open.length || !candidates.length) {
      candidatesAtSolve.push(candidates.length);
      break;
    }
    let best = open[0]!;
    let bestN = -1;
    for (const l of open) {
      const n = candidates.filter((c) => c.includes(l)).length;
      if (n > bestN) {
        bestN = n;
        best = l;
      }
    }
    actions.push({ kind: "guess", word: w, letter: best });
  }
  const end = replay();
  return { solved: end.done, strikes: end.strikes, candidatesAtSolve, actions };
}
