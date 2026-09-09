export type PuzzleType = "anagram" | "arithmetic" | "sequence";

export interface AnagramPuzzleData {
  type: "anagram";
  word: string;
  scrambled: string;
}

export interface ArithmeticPuzzleData {
  type: "arithmetic";
  expression: string;
  answer: number;
}

export interface SequencePuzzleData {
  type: "sequence";
  tiles: number[];
}

export type PuzzleData = AnagramPuzzleData | ArithmeticPuzzleData | SequencePuzzleData;

/** Every timed screen of a round, driven by a shared timestamp. */
export type DuelPhase = "intro" | "puzzle" | "reveal" | "result";

export interface DuelRow {
  id: string;
  room_code: string;
  status: "waiting" | "countdown" | "in_progress" | "finished";
  round_order: PuzzleType[];
  puzzles: PuzzleData[];
  current_round: number;
  phase: DuelPhase;
  phase_started_at: string | null;
  round_started_at: string | null;
  next_duel_id: string | null;
  created_at: string;
}

export interface DuelPlayerRow {
  id: string;
  duel_id: string;
  player_slot: number;
  display_name: string;
  session_token: string;
  ready_round: number;
  last_seen_at: string;
}

export interface RoundResultRow {
  id: string;
  duel_id: string;
  player_slot: number;
  round_number: number;
  answer: string | null;
  is_correct: boolean;
  ms_remaining: number;
  score: number;
  submitted_at: string;
}

export const ROUND_MS = 30_000;
export const TOTAL_ROUNDS = 3;
export const COUNTDOWN_MS = 3_000;
/** Round intro: 7s of progress bar, then a 3-2-1 countdown. */
export const INTRO_MS = 10_000;
export const INTRO_COUNTDOWN_MS = 3_000;
/** Answer reveal after each round. */
export const REVEAL_MS = 5_000;
export const NEXT_ROUND_AUTO_MS = 8_000;
export const DISCONNECT_MS = 15_000;

/** Sequence Recall plays back before its 30s clock starts. */
export const SEQUENCE_LEAD_IN_MS = 700;
export const SEQUENCE_FLASH_MS = 600;
export const SEQUENCE_GAP_MS = 250;
export const SEQUENCE_LENGTH = 5;
export const SEQUENCE_PLAYBACK_MS =
  SEQUENCE_LEAD_IN_MS +
  SEQUENCE_LENGTH * SEQUENCE_FLASH_MS +
  (SEQUENCE_LENGTH - 1) * SEQUENCE_GAP_MS;

export const PUZZLE_LABELS: Record<PuzzleType, string> = {
  anagram: "Anagram",
  arithmetic: "Quick Arithmetic",
  sequence: "Sequence Recall",
};

/** Milliseconds of preparation before the 30s clock begins for a puzzle. */
export function puzzlePrepMs(puzzle: PuzzleData | undefined): number {
  return puzzle?.type === "sequence" ? SEQUENCE_PLAYBACK_MS : 0;
}
