/**
 * Intruder Detection rules: three grids in one round, each shown, hidden, then
 * shown again with exactly one cell different. Which cell changed — and how —
 * lives in the private secrets row, and the same grading runs on the server.
 */

import { INTRUDER_ATTEMPTS, INTRUDER_BOARDS, type IntruderAnswer } from "./types";

/** Colour pairs too close to tell apart in a second, never used as a change. */
export const INTRUDER_CLOSE_PAIRS: [string, string][] = [
  ["RED", "ORANGE"],
  ["ORANGE", "BROWN"],
  ["BLUE", "PURPLE"],
];

export function intruderColoursTooClose(a: string, b: string): boolean {
  return INTRUDER_CLOSE_PAIRS.some(
    ([one, two]) => (one === a && two === b) || (one === b && two === a),
  );
}

/** One entry per board: the cells that board was tapped on, in order. */
export function encodeIntruderTaps(taps: number[][]): string {
  return taps.map((board) => board.join(",")).join("|");
}

export function decodeIntruderTaps(raw: string): number[][] {
  const boards = String(raw ?? "").split("|");
  const out: number[][] = [];
  for (let index = 0; index < INTRUDER_BOARDS; index++) {
    out.push(
      (boards[index] ?? "")
        .split(",")
        .map((part) => Number.parseInt(part, 10))
        .filter((value) => Number.isInteger(value) && value >= 0)
        .slice(0, INTRUDER_ATTEMPTS),
    );
  }
  return out;
}

export interface IntruderReplay {
  correct: number;
  /** True only when every solved board was solved on the first tap. */
  allFirstTry: boolean;
  perBoard: { taps: number[]; correct: boolean; firstTry: boolean }[];
}

/** The one place a tap list is graded against the stored answers. */
export function replayIntruder(answers: IntruderAnswer[], taps: number[][]): IntruderReplay {
  const perBoard = answers.slice(0, INTRUDER_BOARDS).map((answer, index) => {
    const board = (taps[index] ?? []).slice(0, INTRUDER_ATTEMPTS);
    const correct = board.includes(answer.cell);
    return { taps: board, correct, firstTry: board[0] === answer.cell };
  });

  const solved = perBoard.filter((board) => board.correct);
  return {
    correct: solved.length,
    allFirstTry: solved.every((board) => board.firstTry),
    perBoard,
  };
}
