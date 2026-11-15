/**
 * The Number overhaul's shared pieces (15 Nov 2026, phase 2 step 4; docs/number-overhaul.md): presentation only.
 *
 * - `numberArt(game, name)`: a Blender-rendered piece or surface (public/number/<game>/<name>.webp, made by
 *   docs/design/number-overhaul/source/<game>.py). Numbers are never baked into the art: the games draw them over
 *   it in Archivo.
 * - `NumberStage` and `useNumberStageMoment`: the six stage games' one "stage complete" moment. The finished stage
 *   holds a beat, lifts and slides away to the left while a rising two-note chime plays (`<type>.stageClear`) and
 *   the frame's stage pip fills; the next stage slides in from the right. Skip (`<type>.skip`, a flat swish) and fail
 *   (`<type>.fail`, a dull thunk) have their own, clearly different sounds and no slide-away lift.
 *
 * Every animation here is display only: the round's clock, answers and grading never wait for it.
 */
import { useEffect, useRef, type ReactNode } from "react";

import { soundCue } from "@/components/puzzles/numberPolish";
import type { PuzzleType } from "@/lib/duel/types";
import "@/polish-layout/number-overhaul.css";

/** The six games whose round is a run of stages. */
export const NUMBER_STAGE_GAMES = ["balance", "equation", "numpyramid", "measure", "checkout", "numline"] as const satisfies readonly PuzzleType[];
export type NumberStageGame = (typeof NUMBER_STAGE_GAMES)[number];

/** The eight Number games' art folders. */
export const NUMBER_ART_GAMES = ["balance", "target", "equation", "numpyramid", "measure", "checkout", "numline", "kakuro"] as const;
export type NumberArtGame = (typeof NUMBER_ART_GAMES)[number];

/** A rendered piece's URL. */
export function numberArt(game: NumberArtGame, name: string): string {
  return `/number/${game}/${name}.webp`;
}

/** The shared stage moments' sound slots (src/lib/fx/manifest.ts), one set per game so each game's sounds load with it. */
export const stageClearCue = (type: NumberStageGame) => `${type}.stageClear`;
export const stageSkipCue = (type: NumberStageGame) => `${type}.skip`;
export const stageFailCue = (type: NumberStageGame) => `${type}.fail`;

/**
 * True: a stage game that draws NumberStage plays the stage moment's own sound, so StageProgress's generic
 * stage-complete moment stays quiet for it (its `quiet`), whether the stage was completed or skipped.
 */
export const NUMBER_STAGE_MOMENT_SOUND = true;

/** How the finished stage leaves: cleared (lift and slide away), skipped or failed (a plain slide). */
export type StageExit = "clear" | "skip" | "fail" | null;

/** Plays the stage moment's sound once each time `exit` turns on. */
export function useNumberStageMoment(type: NumberStageGame, exit: StageExit): void {
  const last = useRef<StageExit>(null);
  useEffect(() => {
    if (exit === last.current) return;
    last.current = exit;
    if (exit === "clear") soundCue(stageClearCue(type));
    else if (exit === "skip") soundCue(stageSkipCue(type));
    else if (exit === "fail") soundCue(stageFailCue(type));
  }, [type, exit]);
}

/**
 * One stage's box: keyed by the stage index by the caller, so each new stage slides in from the right; while `exit`
 * is set the finished stage leaves (`clear` lifts first). Plays the moment's sound.
 */
export function NumberStage({ type, index, exit, className, quiet = false, children }: {
  type: NumberStageGame;
  index: number;
  exit: StageExit;
  className?: string;
  /** The game plays this exit's sound itself (e.g. Brimful's out of moves keeps its `wrong`): the slide only. */
  quiet?: boolean;
  children: ReactNode;
}) {
  useNumberStageMoment(type, quiet ? null : exit);
  return (
    <div
      key={index}
      data-number-stage={index}
      data-stage-exit={exit ?? undefined}
      data-stage-enter={index > 0 ? "" : undefined}
      className={`nov-stage${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
