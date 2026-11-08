/**
 * A game's Stage, Reveal and intro example, drawn from its own chunk (speed fix 1, Nov 2026; gameLoader.ts).
 * Rooms, practice, the Daily and challenges preload the game before these mount, so they normally draw on
 * the first frame; if the chunk is still on its way, the Stage keeps its space empty and the Reveal and
 * example draw nothing until it lands, then the game's own component mounts once. The Stage also asks for the
 * game's own sounds (lib/sound.ts loadGameSounds).
 */
import { useEffect } from "react";

import type { PuzzleRevealProps, PuzzleStageProps } from "@/puzzles/types";
import { loadGameSounds } from "@/lib/sound";
import { useGameDef } from "@/lib/duel/gameLoader";
import type { RemovedPuzzleType } from "@/lib/duel/removedGames";
import type { PuzzleType } from "@/lib/duel/types";

export function GameStage(props: PuzzleStageProps) {
  const definition = useGameDef(props.puzzle.type);
  // The game's own sounds (speed fix 5; normally decoded during its intro, here too after a reload mid-round).
  useEffect(() => loadGameSounds(props.puzzle.type), [props.puzzle.type]);
  if (!definition) return <div data-game-loading className="flex min-h-0 flex-1" />;
  const Stage = definition.Stage;
  return <Stage {...props} />;
}

export function GameReveal(props: PuzzleRevealProps) {
  const definition = useGameDef(props.puzzle.type);
  if (!definition) return null;
  const Reveal = definition.Reveal;
  return <Reveal {...props} />;
}

export function GameIntroExample({ type }: { type: PuzzleType | RemovedPuzzleType }) {
  const definition = useGameDef(type);
  if (!definition) return null;
  const Example = definition.IntroExample;
  return <Example />;
}
