import type { ComponentType } from "react";

import type {
  PlayerRoundDetail,
  PuzzleCategory,
  PuzzleData,
  PuzzleType,
  RoundResultRow,
} from "@/lib/duel/types";

/**
 * Per-type detail sent with a submission. Correctness and score are worked out
 * on the server from the stored puzzle, never sent by the client.
 */
export interface SubmitMeta {
  /** Reaction Time / Go / No-Go: average reaction time, in ms. */
  reactionAvgMs?: number | undefined;
  /** Colour Clash / Go / No-Go: how many items were handled correctly. */
  correctCount?: number;
  /** Number Hunt: how many wrong taps the player made. */
  errors?: number;
  /** Target Number: the combining steps taken, replayed and checked server-side. */
  steps?: { a: number; b: number; operator: string }[];
}

/** Wordsmith and Word Hunt: asks the server whether one word counts. */
export type CheckWord = (
  word: string,
  found: string[],
  /** Word Hunt only: the traced path, re-walked on the server. */
  path?: number[],
) => Promise<{ valid: boolean; points: number; word: string; reason?: string }>;

export interface PuzzleStageProps {
  puzzle: PuzzleData;
  /** Server-synced timestamp the puzzle phase started on both phones. */
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string, meta?: SubmitMeta) => void;
  /** Wordsmith and Word Hunt only: live server-side word checking. */
  checkWord?: CheckWord;
}

export interface PuzzleRevealProps {
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  myReactionAvgMs: number | null;
}

/**
 * A self-contained puzzle type. Everything the app knows about a puzzle type
 * comes through this interface — adding a new type means adding one file and
 * registering it in `src/lib/duel/registry.ts`.
 */
export interface PuzzleDefinition {
  key: PuzzleType;
  name: string;
  category: PuzzleCategory;
  /** How long the player has on the clock. 30s for almost every type. */
  timeLimitMs: number;
  /** How long the answer reveal remains visible. Defaults to five seconds. */
  revealMs?: number;
  /** Generated once, when the duel is created, and stored in the database. */
  generate: () => PuzzleData;
  check: (answer: string, puzzle: PuzzleData) => boolean;
  /** Built on the server after the round ends; never called during play. */
  roundSummary?: (result: RoundResultRow, puzzle: PuzzleData) => Omit<PlayerRoundDetail, "playerSlot">;
  /** Correct-answer text for the compact result heading, where meaningful. */
  correctAnswer?: (puzzle: PuzzleData) => string | null;
  /** Milliseconds of preparation before the clock starts. */
  prepMs?: (puzzle: PuzzleData) => number;
  /** Total length of the puzzle phase. Defaults to prep + the type's time limit. */
  durationMs?: (puzzle: PuzzleData) => number;
  /** Heading shown above the answer reveal. Defaults to "The answer was". */
  revealHeading?: string;
  /** False for types that are not on a countdown clock. */
  showTimer?: boolean;
  /** Fixed intro example — identical every single time. */
  IntroExample: ComponentType;
  Stage: ComponentType<PuzzleStageProps>;
  Reveal: ComponentType<PuzzleRevealProps>;
}
