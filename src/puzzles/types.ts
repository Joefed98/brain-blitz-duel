import type { ComponentType } from "react";

import type { PuzzleCategory, PuzzleData, PuzzleType } from "@/lib/duel/types";

export interface SubmitMeta {
  /** Reaction Time only: average of the three attempts, in ms. */
  reactionAvgMs?: number;
  /** Colour Clash only: how many of the ten items were tapped correctly. */
  correctCount?: number;
}

export interface PuzzleStageProps {
  puzzle: PuzzleData;
  /** Server-synced timestamp the puzzle phase started on both phones. */
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string, meta?: SubmitMeta) => void;
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
  /** Generated once, when the duel is created, and stored in the database. */
  generate: () => PuzzleData;
  check: (answer: string, puzzle: PuzzleData) => boolean;
  /** Milliseconds of preparation before the 30s clock starts. */
  prepMs?: (puzzle: PuzzleData) => number;
  /** Total length of the puzzle phase. Defaults to prep + 30s. */
  durationMs?: (puzzle: PuzzleData) => number;
  /** False for types that are not on a 30-second clock. */
  showTimer?: boolean;
  /** Fixed intro example — identical every single time. */
  IntroExample: ComponentType;
  Stage: ComponentType<PuzzleStageProps>;
  Reveal: ComponentType<PuzzleRevealProps>;
}
