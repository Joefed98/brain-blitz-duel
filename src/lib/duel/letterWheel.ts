/**
 * Letter Wheel rules, shared by the phone (drawing slots) and the server
 * (live checks and grading). The answer is only the list of words spelled;
 * the server matches each against the stored crossword.
 */

import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { LetterWheelSlot } from "./types";

export const LW_MAX_WORDS = 400;

/** Cells (row * cols + col) a slot covers. */
export function lwSlotCells(slot: LetterWheelSlot, cols: number): number[] {
  return Array.from({ length: slot.len }, (_, i) =>
    slot.across ? slot.row * cols + slot.col + i : (slot.row + i) * cols + slot.col,
  );
}

export function lwDecode(answer: string): string[] {
  return String(answer ?? "")
    .split(",")
    .slice(0, LW_MAX_WORDS)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => /^[A-Z]{3,8}$/.test(w));
}

/** Crossword slots and cells filled from the submitted words. */
export function lwGrade(
  words: readonly string[],
  slots: readonly LetterWheelSlot[],
  cols: number,
  submitted: readonly string[],
): { slots: number[]; cells: number; totalCells: number; wrong: number } {
  const filled = new Set<number>();
  let wrong = 0;
  for (const w of submitted) {
    const i = words.indexOf(w);
    if (i >= 0) filled.add(i);
    else wrong++;
  }
  const cellsOf = (list: Iterable<number>) => {
    const set = new Set<number>();
    for (const i of list) for (const c of lwSlotCells(slots[i]!, cols)) set.add(c);
    return set.size;
  };
  return {
    slots: [...filled].sort((a, b) => a - b),
    cells: cellsOf(filled),
    totalCells: cellsOf(slots.map((_, i) => i)),
    wrong,
  };
}

/**
 * Unfinished: 15 per word on eight-word boards, 13 on nine-word boards.
 * All words found: 130 + round(20 × ms left ÷ registry limit), cap 150.
 */
export function scoreLetterWheel(
  slots: number,
  totalSlots: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (scoreRev1()) {
    // Rev 1: 120 + PAR(30); unfinished 110 × words ÷ (words on the board − 1).
    if (totalSlots > 0 && slots >= totalSlots) return finishParts(timeLimitMs > 0 ? speedBonusCurve(30, msRemaining, timeLimitMs) : 0);
    return partialParts((110 * Math.max(0, slots)) / Math.max(1, totalSlots - 1));
  }
  const pointsPerWord = totalSlots === 8 ? 15 : 13;
  const base = pointsPerWord * Math.max(0, slots);
  if (totalSlots > 0 && slots >= totalSlots) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 130 + (timeLimitMs > 0 ? speedBonusCurve(20, ms, timeLimitMs) : 0));
  }
  return Math.min(150, base);
}

/**
 * Live check of one word. A crossword word comes back with reason "slot:N" so
 * the phone knows where to write it. Other dictionary words are neutral.
 */
export function checkLetterWheelWord(
  words: readonly string[],
  raw: string,
  already: readonly string[],
  isDictionaryWord: boolean,
): { valid: boolean; points: number; word: string; reason?: string } {
  const word = String(raw ?? "").trim().toUpperCase();
  if (already.map((w) => w.toUpperCase()).includes(word)) return { valid: false, points: 0, word, reason: "Already found" };
  const i = words.indexOf(word);
  if (i >= 0) return { valid: true, points: 0, word, reason: `slot:${i}` };
  if (isDictionaryWord) return { valid: false, points: 0, word, reason: "Not in this puzzle" };
  return { valid: false, points: 0, word, reason: "Not a word" };
}
