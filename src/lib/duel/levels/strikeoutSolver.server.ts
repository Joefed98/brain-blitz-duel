import { strikeoutAnswerWords } from "../strikeout.server";
import { gradeAnswer } from "../gradeAnswer.server";
import { encodeStrikeout2 } from "../strikeout";
import { limitEntryMs } from "./humanLimits";
import { dealStandard } from "../standard/stamps";
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

/** Taps for one action at the human limits: a letter is one key; a solve taps the word, types it, then Solve. */
export function strikeoutActionTaps(action: So2Action): number {
  return action.kind === "guess" ? 1 : action.guess.length + 2;
}

/**
 * The person-like guesser's line entered at the human limits (humanLimits.ts) and graded by the server at the moment its
 * last action lands: the proof that a level's 200 is reachable by the best humans (D1, 21 Nov 2026). A level deal asks
 * before the deal's layers have stamped it, so it is graded as the standard layer will stamp it (a puzzle already on its
 * stamps passes through unchanged).
 */
export function strikeoutLineAtLimits(puzzle: StrikeoutPuzzleData): { score: number; ms: number; solve: StrikeoutSolve } {
  const solve = solveStrikeoutLikeAPerson(puzzle);
  const ms = solve.actions.reduce((sum, a) => sum + limitEntryMs(strikeoutActionTaps(a)), 0);
  const limit = puzzle.timeLimitMs ?? 100_000;
  const score = ms <= limit ? gradeAnswer(dealStandard(puzzle), encodeStrikeout2(solve.actions), Math.max(0, limit - ms)).score : 0;
  return { score, ms, solve };
}
