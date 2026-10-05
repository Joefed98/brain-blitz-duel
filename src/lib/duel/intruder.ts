/** Shared answer codec and five-board Intruder grading. */
import { INTRUDER_BOARDS, INTRUDER_CHANGE_COUNTS, type IntruderAnswer } from "./types";
export const INTRUDER_CLOSE_PAIRS: [string, string][] = [["RED", "ORANGE"], ["ORANGE", "BROWN"], ["BLUE", "PURPLE"]];
export function intruderColoursTooClose(a: string, b: string): boolean { return INTRUDER_CLOSE_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a)); }
export function encodeIntruderTaps(taps: number[][]): string { return taps.map((board) => board.join(",")).join("|"); }
export function decodeIntruderTaps(raw: string): number[][] { const boards = String(raw ?? "").split("|"); return Array.from({ length: INTRUDER_BOARDS }, (_, index) => (boards[index] ?? "").split(",").map(Number).filter((value) => Number.isInteger(value) && value >= 0).slice(0, INTRUDER_CHANGE_COUNTS[index] ?? 2)); }
export interface IntruderReplay { correct: number; points: number; allFirstTry: boolean; perBoard: { taps: number[]; found: number; needed: number; correct: boolean; firstTry: boolean }[] }
export function replayIntruder(answers: IntruderAnswer[], taps: number[][]): IntruderReplay {
  const perBoard = answers.slice(0, INTRUDER_BOARDS).map((answer, index) => { const board = [...new Set(taps[index] ?? [])].slice(0, answer.cells.length); const found = answer.cells.filter((cell) => board.includes(cell)).length; return { taps: board, found, needed: answer.cells.length, correct: found === answer.cells.length, firstTry: found === answer.cells.length }; });
  return { correct: perBoard.filter((board) => board.correct).length, points: perBoard.reduce((sum, board) => sum + (board.correct ? 24 : board.needed === 2 && board.found === 1 ? 12 : 0), 0), allFirstTry: perBoard.every((board) => board.correct), perBoard };
}