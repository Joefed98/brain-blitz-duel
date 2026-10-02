/**
 * Letter Wheel rules, shared by the phone (drawing slots) and the server
 * (live checks and grading). The answer is only the list of words spelled;
 * the server matches each against the stored crossword.
 */

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
 * Eight-word boards score 15 per word plus up to 30 completion speed points.
 * Nine-word boards score 12 per word plus up to 42. Both cap at 150.
 */
export function scoreLetterWheel(
  slots: number,
  totalSlots: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  const pointsPerWord = totalSlots === 8 ? 15 : 12;
  const maxSpeedBonus = totalSlots === 8 ? 30 : 42;
  const base = pointsPerWord * Math.max(0, slots);
  if (totalSlots > 0 && slots >= totalSlots) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, base + Math.round((maxSpeedBonus * ms) / timeLimitMs));
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
