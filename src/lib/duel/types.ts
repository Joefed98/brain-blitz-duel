export type PuzzleType =
  | "anagram"
  | "oddword"
  | "arithmetic"
  | "numseq"
  | "sequence"
  | "reaction"
  | "missing"
  | "equation"
  | "stroop";

export type PuzzleCategory = "word" | "number" | "memory" | "speed" | "attention";

export interface AnagramPuzzleData {
  type: "anagram";
  word: string;
  scrambled: string;
}

export interface OddWordPuzzleData {
  type: "oddword";
  theme: string;
  /** Four words in the shuffled order both players see. */
  words: string[];
  odd: string;
}

export interface ArithmeticPuzzleData {
  type: "arithmetic";
  expression: string;
  answer: number;
}

export interface NumberSequencePuzzleData {
  type: "numseq";
  numbers: number[];
  answer: number;
  /** Plain-English name of the rule, shown on the answer reveal. */
  rule: string;
}

export interface SequencePuzzleData {
  type: "sequence";
  tiles: number[];
}

export interface ReactionPuzzleData {
  type: "reaction";
  /** Milliseconds before the gold flash of each attempt (generated once). */
  delays: number[];
}

export type PuzzleData =
  | AnagramPuzzleData
  | OddWordPuzzleData
  | ArithmeticPuzzleData
  | NumberSequencePuzzleData
  | SequencePuzzleData
  | ReactionPuzzleData;

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
  /** Reaction Time rounds only: average of the three attempts. */
  reaction_avg_ms: number | null;
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

/** Reaction Time: three attempts, each in a fixed-length shared slot. */
export const REACTION_ATTEMPTS = 3;
export const REACTION_MIN_DELAY_MS = 1_500;
export const REACTION_MAX_DELAY_MS = 4_000;
/** How long a player has to tap after the gold flash. */
export const REACTION_RESPONSE_MS = 2_000;
/** How long the attempt's time (or "Too early!") stays on screen. */
export const REACTION_FEEDBACK_MS = 1_000;
/** Penalty recorded for a false start or a missed attempt. */
export const REACTION_PENALTY_MS = 1_000;
