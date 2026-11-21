/**
 * The Word deduction games' person-style lines timed at the human limits (D1, 21 Nov 2026): each game's own person-like
 * solver (it never sees the answer) plays the dealt board, every decision taking 0.25 s to react and every tap, key or
 * drag 0.15 s (HUMAN_LIMITS, scripts/arcade-skill-bands/human.ts), and the server grades the line at the time it ends.
 * That is the proof a level's 200 is reachable by the best humans: the line must reach 200 inside the clock. Script-only.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeStrikeout2, type So2Action } from "../src/lib/duel/strikeout";
import { solveStrikeoutLikeAPerson } from "../src/lib/duel/levels/strikeoutSolver.server";
import type { CodewordPuzzleData, PuzzleData, StrikeoutPuzzleData, WordSearchPuzzleData } from "../src/lib/duel/types";
import { encodeCodeword, type CwAction } from "../src/lib/duel/codeword";
import { solveCodewordLikeAHuman } from "../src/lib/duel/levels/codewordHuman.server";
import { wsEncode } from "../src/lib/duel/wordSearch";
import { sentAnswer } from "./standard-lib";
import { entryMs, LIMITS } from "./word-human";

export interface TimedLine {
  /** The server's score for the line, graded at the time its last action lands. */
  score: number;
  finished: boolean;
  /** Clock ms the last action lands. */
  ms: number;
  actions: number;
  /** Anything the game reports about the line (strikes, candidates, rounds). */
  facts: Record<string, number>;
}

/** Grades a line of drafts (each the whole answer after an action, at its clock time) as the phone sends it. */
export function gradeLine(puzzle: PuzzleData, drafts: readonly { answer: string; atMs: number }[], facts: Record<string, number>): TimedLine {
  const limit = puzzleTimeLimitMs(puzzle);
  const inTime = drafts.filter((d) => d.atMs <= limit);
  const last = inTime[inTime.length - 1];
  if (!last) {
    const g = gradeAnswer(puzzle, "", 0);
    return { score: g.score, finished: g.isCorrect, ms: limit, actions: 0, facts };
  }
  const answer = sentAnswer(puzzle, inTime);
  let g = gradeAnswer(puzzle, answer, Math.max(0, limit - last.atMs));
  if (!g.isCorrect) g = gradeAnswer(puzzle, answer, 0);
  return { score: g.score, finished: g.isCorrect, ms: last.atMs, actions: inTime.length, facts };
}

/* --------------------------------------------------------------------------------------------- Strikeout */

/** Taps for one Strikeout action: a letter is one key; a solve taps the word, types its letters, then Solve. */
export function strikeoutTaps(action: So2Action): number {
  return action.kind === "guess" ? 1 : action.guess.length + 2;
}

/** The person-like guesser's line (strikeoutSolver.server.ts) at the human limits. */
export function strikeoutLine(puzzle: StrikeoutPuzzleData, limits = LIMITS): TimedLine {
  const solve = solveStrikeoutLikeAPerson(puzzle);
  const drafts: { answer: string; atMs: number }[] = [];
  let at = 0;
  for (let i = 0; i < solve.actions.length; i++) {
    at += entryMs(strikeoutTaps(solve.actions[i]!), limits);
    drafts.push({ answer: encodeStrikeout2(solve.actions.slice(0, i + 1)), atMs: at });
  }
  return gradeLine(puzzle, drafts, { strikes: solve.strikes, solved: solve.solved ? 1 : 0 });
}

/* --------------------------------------------------------------------------------------------- Lookout */

/**
 * Lookout's reading witness (the spec's proof for a word search, where nothing is deduced): a player who sees each word
 * drags it at the limits, 0.25 s to react and 0.15 s each to touch its first letter and lift on its last (0.55 s a drag),
 * the bonus word first, then every listed word; the round ends with Done (one more tap). Graded at the moment the last
 * listed word lands (the speed point the grader reads from the timeline).
 */
export function lookoutLine(puzzle: WordSearchPuzzleData, limits = LIMITS): TimedLine {
  const drags = [...(puzzle.bonus ? [puzzle.bonus.cells] : []), ...(puzzle.placements ?? []).map((p) => p.cells)];
  const drafts: { answer: string; atMs: number }[] = [];
  let at = 0;
  for (let i = 0; i < drags.length; i++) {
    at += entryMs(2, limits);
    drafts.push({ answer: wsEncode(drags.slice(0, i + 1)), atMs: at });
  }
  return gradeLine(puzzle, drafts, { drags: drags.length });
}

/* --------------------------------------------------------------------------------------------- Cryptogrid */

/**
 * Cryptogrid's person-like line (codewordHuman.server.ts: it reads only the board and the letters it has decoded, and
 * fixes a letter only when it is forced, never guessing): each number it decodes is entered in the order it decoded it,
 * 0.25 s to react and 0.15 s each to tap the number's square and the letter's key. A board it can't finish leaves the
 * rest blank (graded at the buzzer).
 */
export function codewordLine(puzzle: CodewordPuzzleData, limits = LIMITS): TimedLine {
  const solve = solveCodewordLikeAHuman(puzzle.cells, puzzle.numbers, puzzle.givens);
  const actions: CwAction[] = [];
  const drafts: { answer: string; atMs: number }[] = [];
  let at = 0;
  for (const n of solve.order) {
    at += entryMs(2, limits);
    actions.push({ n, letter: solve.letters[n - 1]! });
    drafts.push({ answer: encodeCodeword(actions), atMs: at });
  }
  return gradeLine(puzzle, drafts, { solved: solve.solved ? 1 : 0, left: solve.left, rounds: solve.steps });
}

/** The game's person-like line at the human limits, where the game has one (null otherwise). */
export function personLine(puzzle: PuzzleData): TimedLine | null {
  if (puzzle.type === "strikeout") return strikeoutLine(puzzle);
  if (puzzle.type === "wordsearch") return lookoutLine(puzzle);
  if (puzzle.type === "codeword") return codewordLine(puzzle);
  return null;
}
