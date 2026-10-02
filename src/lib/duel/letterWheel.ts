/**
 * Letter Wheel rules, shared by the phone (drawing slots) and the server
 * (live checks and grading). The answer is only the list of words spelled;
 * the server matches each against the stored crossword and bonus sets.
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

/** Crossword slots filled, filled cells and bonus words found, from the submitted words. */
export function lwGrade(
  words: readonly string[],
  bonus: readonly string[],
  slots: readonly LetterWheelSlot[],
  cols: number,
  submitted: readonly string[],
): { slots: number[]; cells: number; totalCells: number; bonus: number; wrong: number } {
  const bonusSet = new Set(bonus);
  const filled = new Set<number>();
  const foundBonus = new Set<string>();
  let wrong = 0;
  for (const w of submitted) {
    const i = words.indexOf(w);
    if (i >= 0) filled.add(i);
    else if (bonusSet.has(w)) foundBonus.add(w);
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
    bonus: foundBonus.size,
    wrong,
  };
}

/**
 * 11 per crossword word + 2 per bonus. Completing the crossword adds
 * round(50 × ms left ÷ limit). The total is capped at 150.
 */
export function scoreLetterWheel(
  slots: number,
  totalSlots: number,
  bonus: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  const base = 11 * Math.max(0, slots) + 2 * Math.max(0, bonus);
  if (totalSlots > 0 && slots >= totalSlots) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, base + Math.round((50 * ms) / timeLimitMs));
  }
  return Math.min(150, base);
}

/**
 * Live check of one word. A crossword word comes back with reason "slot:N" so
 * the phone knows where to write it; a bonus word with reason "bonus".
 */
export function checkLetterWheelWord(
  words: readonly string[],
  bonus: readonly string[],
  raw: string,
  already: readonly string[],
): { valid: boolean; points: number; word: string; reason?: string } {
  const word = String(raw ?? "").trim().toUpperCase();
  if (already.map((w) => w.toUpperCase()).includes(word)) return { valid: false, points: 0, word, reason: "Already found" };
  const i = words.indexOf(word);
  if (i >= 0) return { valid: true, points: 0, word, reason: `slot:${i}` };
  if (bonus.includes(word)) return { valid: true, points: 0, word, reason: "bonus" };
  return { valid: false, points: 0, word, reason: "Not a word" };
}
