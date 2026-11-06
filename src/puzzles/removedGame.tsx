import type { PuzzleCategory, PuzzleData, PuzzleType } from "@/lib/duel/types";
import { REMOVED_GAMES, removedRoundScore, type RemovedPuzzleType } from "@/lib/duel/removedGames";
import { ROUND_MS } from "@/lib/duel/types";
import { APP_NAME } from "@/lib/brand";

import type { PuzzleDefinition } from "./types";

function Notice({ name }: { name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="font-display text-lg font-bold text-foreground">{name}</p>
      <p className="text-sm text-muted-foreground">{`This game is no longer in ${APP_NAME}.`}</p>
    </div>
  );
}

/**
 * The stand-in `puzzleDef` returns for a deleted game's id (removedGames.ts), so
 * a stored room that still holds one of its rounds renders without its code:
 * the name, a notice instead of a board, and the stored score on the reveal.
 * Nothing here plays, grades or replays a round.
 */
export function removedGameDefinition(type: RemovedPuzzleType | string): PuzzleDefinition {
  const known = (
    REMOVED_GAMES as Record<
      string,
      { name: string; accent: PuzzleCategory; timeLimitMs: number } | undefined
    >
  )[type];
  const name = known?.name ?? type;
  const Shown = () => <Notice name={name} />;
  return {
    key: type as PuzzleType,
    name,
    category: known?.accent ?? "pattern",
    // The game's own clock, so a stamped room's tie-break reads the same limit as before.
    timeLimitMs: known?.timeLimitMs ?? ROUND_MS,
    generate: (): PuzzleData => {
      throw new Error(`${name} has been deleted; no new rounds are made.`);
    },
    check: () => false,
    roundSummary: (result) => ({ summary: `${removedRoundScore(result)}${removedRoundScore(result) === 1 ? " point" : " points"}`, detail: [] }),
    correctAnswer: () => null,
    showTimer: false,
    retired: true,
    instructions: {
      goal: `${name} is no longer in ${APP_NAME}.`,
      how: [
        { action: "Nothing to play.", detail: "This round was dealt before the game was deleted." },
        { action: "Scores stand:", detail: "every stored score counts as it was." },
      ],
      score: "The stored score stands.",
    },
    IntroExample: Shown,
    Stage: Shown,
    Reveal: () => null,
  };
}
