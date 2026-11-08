/**
 * How a game's module definition becomes the definition the app uses: the catalogue's theme, desktop mode,
 * retired flag and reveal length, the shared feedback wrapper round its Stage, and its intro copy. One
 * function for the full registry (server, checks) and the phone's per-game loader (`gameLoader.ts`), so a
 * game loaded on its own is exactly the game the registry holds.
 */
import type { PuzzleDefinition } from "@/puzzles/types";
import { removedGameDefinition } from "@/puzzles/removedGame";
import { feedbackStage } from "@/components/duel/FeedbackStage";

import { ARCADE_PHASE_SLACK_MS, puzzleInfo, type GameInfo } from "./catalogue";
import { PUZZLE_INSTRUCTIONS } from "./instructions";
import type { PuzzleType } from "./types";

/** A game's definition as the app plays it (no server-only summaries). */
export type LoadedPuzzleDefinition = Omit<PuzzleDefinition, "roundSummary" | "correctAnswer"> &
  Required<Pick<PuzzleDefinition, "instructions" | "retired">> &
  Pick<GameInfo, "theme" | "desktop" | "revealMs">;

export function registerDefinition(
  type: PuzzleType,
  definition: Omit<PuzzleDefinition, "instructions">,
): LoadedPuzzleDefinition & Pick<PuzzleDefinition, "roundSummary" | "correctAnswer"> {
  const info = puzzleInfo(type);
  return nameFromCatalogue(info, {
    ...definition,
    theme: info.theme,
    desktop: info.desktop,
    Stage: feedbackStage(definition.Stage, info.theme, Boolean(definition.arcadeRun || definition.category === "arcade"), {
      type,
      arcade: definition.category === "arcade",
      runMs: definition.category === "arcade" ? definition.timeLimitMs - ARCADE_PHASE_SLACK_MS : null,
    }),
    instructions: PUZZLE_INSTRUCTIONS[type],
    retired: info.retired,
    revealMs: definition.revealMs ?? info.revealMs,
  });
}

/**
 * One source for a game's name: the definition reads (and writes) it through its catalogue line, so the full
 * registry, a game loaded on its own and the catalogue's `puzzleName` always agree, even when a screen harness
 * renames a game for a layout case (safe-area-harness's longest name).
 */
function nameFromCatalogue<T extends { name: string }>(info: GameInfo, definition: T): T {
  Object.defineProperty(definition, "name", {
    get: () => info.name,
    set: (value: string) => {
      info.name = value;
    },
    enumerable: true,
    configurable: true,
  });
  return definition;
}

const REMOVED_DEFINITIONS = new Map<string, LoadedPuzzleDefinition & Required<Pick<PuzzleDefinition, "roundSummary" | "correctAnswer">>>();

/** The read-only stand-in for a deleted game's id (removedGames.ts): its name and a notice, never a board. */
export function removedDefinition(
  type: string,
): LoadedPuzzleDefinition & Required<Pick<PuzzleDefinition, "roundSummary" | "correctAnswer">> {
  let definition = REMOVED_DEFINITIONS.get(type);
  if (!definition) {
    const base = removedGameDefinition(type);
    const info = puzzleInfo(type as PuzzleType);
    definition = {
      ...base,
      theme: info.theme,
      desktop: info.desktop,
      instructions: base.instructions!,
      retired: true,
      revealMs: info.revealMs,
      roundSummary: base.roundSummary!,
      correctAnswer: base.correctAnswer!,
    };
    REMOVED_DEFINITIONS.set(type, definition);
  }
  return definition;
}
