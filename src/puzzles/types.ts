import type { ScoreParts } from "@/lib/duel/puzzleScoreRev";
import type { ComponentType } from "react";

import type {
  PlayerRoundDetail,
  PuzzleCategory,
  PuzzleData,
  PuzzleType,
  RoundResultRow,
} from "@/lib/duel/types";
import type { PuzzleInstructions } from "@/lib/duel/instructions";
import type { MovesView } from "@/lib/duel/moves";

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

/** Wordsmith, Word Hunt, and Word Ladder: asks the server whether one word counts. */
export type CheckWord = (
  word: string,
  found: string[],
  /** Word Hunt only: the traced path, re-walked on the server. */
  path?: number[],
) => Promise<{ valid: boolean; points: number; word: string; reason?: string }>;

/** Groups only: validates one four-tile selection against the private partition. */
export type CheckGroup = (
  indices: number[],
) => Promise<{ valid: boolean; groupIndex?: number; theme?: string }>;

/** Strikeout, Cryptogrid and Swapword: the server replays every move so far (null = no answer, e.g. round over). */
export type CheckMoves = (moves: string) => Promise<MovesView | null>;

export interface PuzzleStageProps {
  puzzle: PuzzleData;
  /**
   * Identifies this round's inputs — room id plus round number, or one practice
   * run. In-progress answers are stored under it, outside the component tree,
   * so a room update mid-round cannot reset them.
   */
  stateKey?: string;
  /** Server-synced timestamp the puzzle phase started on both phones. */
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string, meta?: SubmitMeta) => void;
  /** Keeps an incomplete answer available for server grading if the timer expires. */
  onDraftAnswer?: (answer: string) => void;
  /** Wordsmith, Word Hunt, and Word Ladder: live server-side word checking. */
  checkWord?: CheckWord;
  /** Groups only: checks a candidate group without exposing the other answer. */
  checkGroup?: CheckGroup;
  /** Strikeout, Cryptogrid and Swapword: live server checks of the move list. */
  checkMoves?: CheckMoves;
}

export interface PuzzleRevealProps {
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  myReactionAvgMs: number | null;
  myMsRemaining?: number | undefined;
  /** The round length from the registry — the same limit the server grades against. */
  timeLimitMs: number;
  /** Server-checked row indices for the Word Slide reveal. */
  validRows?: number[] | undefined;
  /** The stored score breakdown (puzzleScoreRev 1 rounds; null on older rounds). */
  scoreParts?: ScoreParts | null | undefined;
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
  roundSummary?: (
    result: RoundResultRow,
    puzzle: PuzzleData,
  ) => Omit<PlayerRoundDetail, "playerSlot">;
  /** Correct-answer text for the compact result heading, where meaningful. */
  correctAnswer?: (puzzle: PuzzleData) => string | null;
  /** Milliseconds of preparation before the clock starts. */
  prepMs?: (puzzle: PuzzleData) => number;
  /** Total length of the puzzle phase. Defaults to prep + the type's time limit. */
  durationMs?: (puzzle: PuzzleData) => number;
  /** Heading shown above the answer reveal. Defaults to "The answer was". */
  revealHeading?: string;
  /** True for a non-arcade-category type that runs on the arcade engine. */
  arcadeRun?: boolean;
  /** False for types that are not on a countdown clock. */
  showTimer?: boolean;
  /** True for a type kept for practice only — never drawn in rooms. */
  retired?: boolean;
  /** Shared GOAL / HOW / SCORE copy used by the intro and in-round help. */
  instructions?: PuzzleInstructions;
  /** Fixed intro example — identical every single time. */
  IntroExample: ComponentType;
  /** Optional puzzle-specific intro line (e.g. "4 pegs"), same for every player. */
  introLine?: (puzzle: PuzzleData) => string | null;
  Stage: ComponentType<PuzzleStageProps>;
  Reveal: ComponentType<PuzzleRevealProps>;
}
