/**
 * Strikeout rules, shared by the phone (drawing the board from the server's
 * replies, the reveal) and the server (live checks and grading).
 *
 * The answer is the action list: a letter guess ("E") or a solve attempt
 * ("2CRANE": row 2, the word CRANE). The server replays it against the stored
 * words; a solve that is not a dictionary word is rejected with no effect, so
 * the grader stores the canonical list (rejected solves and anything after the
 * round ended removed) and the reveal can replay that list without a dictionary.
 */

import { finishParts, partialParts, scoreRev1, PUZZLE_SPEED_POINTS } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";

export const STRIKEOUT_REV = 1;
export const SO_ROWS = 5;
export const SO_LEN = 5;
export const SO_MAX_STRIKES = 5;
/** Plenty for 26 letters and many solve attempts; longer lists are cut. */
export const SO_MAX_ACTIONS = 120;

export type SoAction = { kind: "guess"; letter: string } | { kind: "solve"; row: number; word: string };

export type SoOutcome = "hit" | "miss" | "right" | "wrong" | "notword" | "ignored";

export function encodeSoAction(action: SoAction): string {
  return action.kind === "guess" ? action.letter : `${action.row}${action.word}`;
}

export function encodeStrikeout(actions: readonly SoAction[]): string {
  return actions.map(encodeSoAction).join(",");
}

export function decodeStrikeout(answer: string): SoAction[] {
  const out: SoAction[] = [];
  for (const raw of String(answer ?? "").split(",").slice(0, SO_MAX_ACTIONS)) {
    const token = raw.trim().toUpperCase();
    if (/^[A-Z]$/.test(token)) out.push({ kind: "guess", letter: token });
    else if (/^[0-4][A-Z]{5}$/.test(token)) out.push({ kind: "solve", row: Number(token[0]), word: token.slice(1) });
  }
  return out;
}

export interface SoState {
  /** revealed[row][i]: tile i of the row is showing. */
  revealed: boolean[][];
  /** Letters guessed, in order. */
  guessed: string[];
  hits: string[];
  misses: string[];
  strikes: number;
  /** Every row fully revealed (guessing or Solve). */
  done: boolean;
  /** Five strikes. */
  over: boolean;
  /** Actions that changed the board, in order (the stored answer). */
  effective: SoAction[];
  /** One outcome per submitted action. */
  outcomes: SoOutcome[];
}

export function soRowSolved(state: SoState, row: number): boolean {
  return state.revealed[row]?.every(Boolean) ?? false;
}

/**
 * Replays the action list. `isWord` decides whether a solve attempt counts at
 * all (the server passes the dictionary; the reveal replays the canonical list,
 * where every remaining solve already passed it).
 */
export function replayStrikeout(
  words: readonly string[],
  actions: readonly SoAction[],
  isWord: (word: string) => boolean,
): SoState {
  const target = words.map((w) => w.toUpperCase());
  const state: SoState = {
    revealed: target.map((w) => Array.from({ length: w.length }, () => false)),
    guessed: [],
    hits: [],
    misses: [],
    strikes: 0,
    done: false,
    over: false,
    effective: [],
    outcomes: [],
  };
  for (const action of actions) {
    if (state.done || state.over) {
      state.outcomes.push("ignored");
      continue;
    }
    if (action.kind === "guess") {
      const letter = action.letter;
      if (state.guessed.includes(letter)) {
        state.outcomes.push("ignored");
        continue;
      }
      state.guessed.push(letter);
      let hit = false;
      target.forEach((w, r) => {
        for (let i = 0; i < w.length; i++) if (w[i] === letter) { state.revealed[r]![i] = true; hit = true; }
      });
      if (hit) state.hits.push(letter);
      else {
        state.misses.push(letter);
        state.strikes++;
      }
      state.effective.push(action);
      state.outcomes.push(hit ? "hit" : "miss");
    } else {
      const row = action.row;
      if (row < 0 || row >= target.length || soRowSolved(state, row)) {
        state.outcomes.push("ignored");
        continue;
      }
      if (!isWord(action.word)) {
        state.outcomes.push("notword");
        continue;
      }
      if (action.word === target[row]) {
        state.revealed[row] = state.revealed[row]!.map(() => true);
        state.outcomes.push("right");
      } else {
        state.strikes++;
        state.outcomes.push("wrong");
      }
      state.effective.push(action);
    }
    state.done = state.revealed.every((row) => row.every(Boolean));
    state.over = !state.done && state.strikes >= SO_MAX_STRIKES;
  }
  return state;
}

export interface SoTally {
  solvedRows: number;
  /** Revealed tiles in rows that are not solved. */
  partialTiles: number;
  strikes: number;
  done: boolean;
}

export function soTally(state: SoState): SoTally {
  let solvedRows = 0;
  let partialTiles = 0;
  for (const row of state.revealed) {
    if (row.every(Boolean)) solvedRows++;
    else partialTiles += row.filter(Boolean).length;
  }
  return { solvedRows, partialTiles, strikes: state.strikes, done: state.done };
}

/** Rev 1: 3 per strike left on a solve; 27.5 per solved word when unfinished. */
export const SO_REV1_STRIKE_POINTS = 3;
export const SO_REV1_WORD_POINTS = 27.5;

/**
 * All five solved: 120 + 4 per unused strike + up to 10 for speed (par curve).
 * Otherwise 20 per solved row + 2 per revealed tile in unsolved rows, cap 110.
 */
export function scoreStrikeout(tally: SoTally, msRemaining: number, timeLimitMs: number): number {
  if (scoreRev1()) {
    // Rev 1: 120 + 3 per strike left (15 with none used) + PAR(15); unfinished 27.5 per word solved (four = 110).
    // Letters showing in unsolved words earn nothing, so guessing letters at random scores about 0.
    if (tally.done) {
      const left = Math.max(0, SO_MAX_STRIKES - tally.strikes);
      return finishParts(timeLimitMs > 0 ? speedBonusCurve(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs) : 0, SO_REV1_STRIKE_POINTS * left, "strikes");
    }
    return partialParts(SO_REV1_WORD_POINTS * tally.solvedRows);
  }
  if (tally.done) {
    const unused = Math.max(0, SO_MAX_STRIKES - tally.strikes);
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 120 + 4 * unused + (timeLimitMs > 0 ? speedBonusCurve(10, ms, timeLimitMs) : 0));
  }
  return Math.min(110, 20 * tally.solvedRows + 2 * tally.partialTiles);
}

/** What the phone may see after an action: only tiles already earned. */
export interface SoView {
  rows: string[];
  hits: string;
  misses: string;
  strikes: number;
  done: boolean;
  over: boolean;
  /** Outcome of the last submitted action. */
  last: SoOutcome | null;
  /** How many actions the reply covers (the phone ignores stale replies). */
  count: number;
}

export function soView(words: readonly string[], state: SoState, count: number): SoView {
  return {
    rows: words.map((w, r) => [...w.toUpperCase()].map((ch, i) => (state.revealed[r]![i] ? ch : "_")).join("")),
    hits: state.hits.join(""),
    misses: state.misses.join(""),
    strikes: state.strikes,
    done: state.done,
    over: state.over,
    last: state.outcomes.at(-1) ?? null,
    count,
  };
}
