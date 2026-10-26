/**
 * Letter Wheel rules, shared by the phone (drawing slots) and the server
 * (live checks and grading). The answer is only the list of words spelled;
 * the server matches each against the stored crossword.
 */

import { finishParts, partialParts, PUZZLE_EFFICIENCY_POINTS, PUZZLE_SPEED_POINTS, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { LetterWheelSlot } from "./types";

export const LW_MAX_WORDS = 400;

/**
 * wheelRev 1 (14 Oct 2026): bigger crosswords (11–14 words, at most 11 × 9, from
 * letterWheelBankRev1.server.ts) and an attempt log. The answer is EVERY trace the
 * player submitted, in order; the server finds the slot words in the log itself and
 * charges misses (see lwTallyLog / scoreLetterWheelLog). Absent = the original rules.
 */
export const LW_REV = 1;
/** Bank limits for wheelRev 1 (scripts/letter-wheel-bank.ts). */
export const LW_REV1_LIMITS = { maxCols: 11, maxRows: 9, minWords: 11, maxWords: 14, minLong: 7, maxShort: 5 } as const;
/** Misses (traces that are neither a slot word nor a dictionary word) that cost nothing. */
export const LW_FREE_MISSES = 5;
/** Points per miss beyond the free ones, off the unfinished credit or the finish's efficiency part. */
export const LW_MISS_COST = 3;
/**
 * Unfinished credit (wheelRev 1): 12 per slot word for the first 6, then 5 per word,
 * up to 110. The first words are the easy ones, so they carry most of the credit.
 */
export const LW_WORD_POINTS = 12;
export const LW_WORD_POINTS_AFTER = 5;
export const LW_FIRST_WORDS = 6;

export function lwWordCredit(slots: number): number {
  const n = Math.max(0, slots);
  return Math.min(110, LW_WORD_POINTS * Math.min(n, LW_FIRST_WORDS) + LW_WORD_POINTS_AFTER * Math.max(0, n - LW_FIRST_WORDS));
}
/** Traces read from one answer; later ones are ignored. */
export const LW_MAX_TRACES = 400;

export function lwUsesLog(puzzle: unknown): boolean {
  return ((puzzle as { wheelRev?: number } | null)?.wheelRev ?? 0) >= LW_REV;
}

/** wheelRev 1 answer: every submitted trace (3+ letters), in order. */
export function lwEncodeLog(traces: readonly string[]): string {
  return traces.slice(0, LW_MAX_TRACES).join(",");
}

/** The traces in a wheelRev 1 answer (letters only, 3–8 long; anything else is dropped). */
export function lwDecodeLog(answer: string): string[] {
  return String(answer ?? "")
    .split(",")
    .slice(0, LW_MAX_TRACES)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => /^[A-Z]{3,8}$/.test(w));
}

/** Can the trace be drawn on this wheel, each wheel letter used at most once? */
export function lwSpellable(letters: string, trace: string): boolean {
  const left = [...letters.toUpperCase()];
  for (const ch of trace.toUpperCase()) {
    const at = left.indexOf(ch);
    if (at < 0) return false;
    left.splice(at, 1);
  }
  return true;
}

export interface LwLogTally {
  /** Traces read from the log. */
  traces: number;
  /** Slot indices filled, from the log's own traces. */
  slots: number[];
  /** Traces that fill no slot and are not dictionary words (or cannot be drawn on this wheel). */
  misses: number;
  /** Real words not in this crossword (free). */
  neutral: number;
}

/**
 * Re-checks a wheelRev 1 attempt log: each trace must be spellable from the wheel;
 * a slot word fills its slot (a repeat is free), another dictionary word is neutral,
 * anything else is a miss.
 */
export function lwTallyLog(
  words: readonly string[],
  letters: string,
  traces: readonly string[],
  isDictionaryWord: (word: string) => boolean,
): LwLogTally {
  const filled = new Set<number>();
  let misses = 0;
  let neutral = 0;
  for (const t of traces) {
    if (!lwSpellable(letters, t)) { misses++; continue; }
    const i = words.indexOf(t);
    if (i >= 0) filled.add(i);
    else if (isDictionaryWord(t)) neutral++;
    else misses++;
  }
  return { traces: traces.length, slots: [...filled].sort((a, b) => a - b), misses, neutral };
}

/**
 * wheelRev 2 (25 Oct 2026, word depth to 200; docs/depth/d1-word.md): the bonus jar. Real words traced from the
 * wheel that are not in the crossword (wheelRev 1's free "neutral" traces) fill a jar by length; a full jar adds
 * 50 to today's score, the only way past 150. The crossword, the log, misses and today's score are unchanged.
 */
export const LW_REV_JAR = 2;
/** The jar's size in drops (smaller only on a board whose bonus words hold fewer). */
export const LW_JAR_DROPS = 30;
/** Points a full jar adds. */
export const LW_JAR_POINTS = 50;
/** Unfinished rounds stay below every finish (120) with the jar. */
export const LW_JAR_UNFINISHED_TOP = 119;

export function lwUsesJar(puzzle: unknown): boolean {
  return ((puzzle as { wheelRev?: number } | null)?.wheelRev ?? 0) >= LW_REV_JAR;
}

/** Drops one bonus word puts in the jar: 3 letters 1, 4 → 2, 5 → 3, 6+ → 4. */
export function lwJarDrops(word: string): number {
  const n = word.length;
  return n <= 3 ? 1 : n === 4 ? 2 : n === 5 ? 3 : 4;
}

/** A board whose bonus words hold few drops gets a smaller jar: at most this share of them fills it. */
export const LW_JAR_REACH = 0.6;

/** The jar's size for a board whose bonus words hold `available` drops in all. */
export function lwJarSize(available: number): number {
  return Math.max(1, Math.min(LW_JAR_DROPS, Math.ceil(Math.max(0, available) * LW_JAR_REACH)));
}

/** Drops left in the jar: each miss after the free ones spills one (so tracing at random never fills it). */
export function lwJarKept(drops: number, misses: number): number {
  return Math.max(0, drops - Math.max(0, misses - LW_FREE_MISSES));
}

/**
 * The puzzle top-up (26 Oct 2026, wheelRev 3; docs/depth/topup-oct-2026.md): the same board, jar and log; the jar
 * pays a little more for its first drops (50 × fill^LW_JAR_TOPUP_POWER), so today's near-perfect player lands about
 * 165–175 and a full jar is still 50.
 */
export const LW_REV_TOPUP = 3;
export const LW_JAR_TOPUP_POWER = 0.8;

/** Points the jar adds: 50 × drops ÷ size (wheelRev 3: 50 × (drops ÷ size)^0.8), whole points, at most 50. */
export function lwJarBonus(drops: number, size: number, rev = LW_REV_JAR): number {
  const s = Math.max(1, size);
  const fill = Math.min(Math.max(0, drops), s) / s;
  if (rev >= LW_REV_TOPUP) return Math.round(LW_JAR_POINTS * Math.pow(fill, LW_JAR_TOPUP_POWER));
  return Math.round((LW_JAR_POINTS * Math.min(Math.max(0, drops), s)) / s);
}

/**
 * The jar from a wheelRev 2 attempt log: each distinct trace that can be drawn on the wheel, is a dictionary word
 * and fills no crossword slot, in log order. A repeat adds nothing.
 */
export function lwJarTally(
  words: readonly string[],
  letters: string,
  traces: readonly string[],
  isDictionaryWord: (word: string) => boolean,
): { bonus: string[]; drops: number } {
  const bonus: string[] = [];
  for (const t of traces) {
    if (bonus.includes(t) || words.includes(t) || !lwSpellable(letters, t) || !isDictionaryWord(t)) continue;
    bonus.push(t);
  }
  return { bonus, drops: bonus.reduce((sum, w) => sum + lwJarDrops(w), 0) };
}

/** Misses charged after the free allowance. */
export function lwMissPenalty(misses: number): number {
  return LW_MISS_COST * Math.max(0, misses - LW_FREE_MISSES);
}

/**
 * wheelRev 1 score (puzzle score shape rev 1):
 *   all slots: 120 + efficiency + PAR(15), efficiency = max(0, 15 − 3 × misses over 5);
 *   unfinished: max(0, min(110, 12 × first 6 slot words + 5 × each after) − 3 × misses over 5).
 */
export function scoreLetterWheelLog(
  slots: number,
  totalSlots: number,
  misses: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  const penalty = lwMissPenalty(misses);
  if (totalSlots > 0 && slots >= totalSlots) {
    const speed = timeLimitMs > 0 ? speedBonusCurve(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs) : 0;
    return finishParts(speed, Math.max(0, PUZZLE_EFFICIENCY_POINTS - penalty), "accuracy");
  }
  return partialParts(Math.max(0, lwWordCredit(slots) - penalty));
}

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
