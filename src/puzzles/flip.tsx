import { flipAmbient } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  flipCheckpoint,
  FLIP_BG,
  FLIP_CHECKPOINT_INTERVAL,
  FLIP_INPUT_TAP,
  FLIP_REV_GRACE,
  FLIP_WORLD_W,
  flipWorldHFor,
  type FlipState,
} from "@/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "@/lib/duel/flip";
import { FLIP_TIME_MS, type FlipPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { ArtStill } from "@/components/puzzles/ArtStill";
import { flipArenaSceneFor, flipArtGameFor } from "@/lib/arcade/flipArt.renderer";
import { flipSounds } from "@/lib/fx/gameSounds";
import { flipEndHoldMs } from "@/lib/arcade/flipFx";
import { flipRunTimeline } from "@/lib/duel/flipTimeline";
import { FlipRunPicture } from "@/components/puzzles/FlipRunPicture";
import { useMemo } from "react";
import { puzzleLevel } from "@/lib/levels/levels";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps, RunPictureProps } from "./types";

/**
 * The intro still (the Action overhaul, 15 Nov 2026; was a flat drawing that looked nothing like the cave): the live
 * stamp's own art (flipRev 13, the lava cave) on a fixed course 1.5 s in, drawn by the game's renderer (ArtStill).
 */
function IntroExample() {
  return (
    <ArtStill
      game={flipArtGameFor(FLIP_REV_GRACE)}
      worldW={FLIP_WORLD_W}
      worldH={flipWorldHFor(FLIP_REV_GRACE)}
      seed={FLIP_STILL_SEED}
      ticks={90}
      input={null}
      caption="Tap to flip between floor and roof; dodge the spikes and run clean."
    />
  );
}

/** A dealt course whose first seconds show a spike row ahead of the runner. */
const FLIP_STILL_SEED = 301794028;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: FlipPuzzleData | null = puzzle.type === "flip" ? puzzle : null;
  // Levels (15 Nov 2026): the stored puzzle's level picks the level's course (Normal: none, as before).
  const game = flipArtGameFor(data?.flipRev, puzzleLevel(data));
  return (
    <ArcadeCanvasStage
      diagKey="flip"
      label={gameDisplayName("flip")}
      background={FLIP_BG}
      fitWorld
      scene={flipArenaSceneFor(data?.flipRev)}
      ambient={flipAmbient}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={FLIP_WORLD_W}
      worldH={flipWorldHFor(data?.flipRev)}
      game={game}
      sounds={flipSounds}
      endHoldMs={(state) => flipEndHoldMs(state as FlipState)}
      checkpoint={flipCheckpoint}
      interval={FLIP_CHECKPOINT_INTERVAL}
      encodeRun={encodeFlipRun}
      discrete
      inputKind={FLIP_INPUT_TAP}
      pointer={(kind) => (kind === "down" ? { a: 0, b: 0, c: 0 } : null)}
      keys={(kind, key, send, _state, event) => {
        if (key !== " " && key !== "ArrowUp" && key !== "w") return false;
        if (kind === "down" && !event.repeat) send({ a: 0, b: 0, c: 0 });
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function flipLine(r: { survived: boolean; survivedSeconds: number }): string {
  return r.survived ? "Survived the minute" : `Survived ${r.survivedSeconds.toFixed(1)}s`;
}

/**
 * The arcade reveal's run picture (stage 2 of the Action overhaul, ArcadeReveal's GameRunPicture): the stored run replayed
 * with the real sim (flipRunTimeline) and drawn as one strip of the cave with the four numbers the score is made of.
 * Earlier revisions (no flow streak) draw nothing here and keep the reveal's tiles.
 */
function RunPicture({ puzzle, myAnswer }: RunPictureProps) {
  const flip = puzzle.type === "flip" ? puzzle : null;
  const timeline = useMemo(() => (flip ? flipRunTimeline(flip.seed, myAnswer, flip.flipRev, puzzleLevel(flip)) : null), [flip, myAnswer]);
  if (!timeline) return null;
  return (
    <div data-run-picture="flip" className="flex w-full shrink-0 justify-center animate-fade-in">
      <FlipRunPicture timeline={timeline} />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const flip = puzzle.type === "flip" ? puzzle : null;
  // Stage 2 of the Action overhaul (15 Nov 2026): the flow revisions (flipRev 11–13) draw the run as a picture, replayed
  // from the stored log with the real sim; earlier revisions keep their lines.
  const timeline = useMemo(
    () => (flip && myAnswer ? flipRunTimeline(flip.seed, myAnswer, flip.flipRev, puzzleLevel(flip)) : null),
    [flip, myAnswer],
  );
  if (!flip) return null;
  if (timeline) return <FlipRunPicture timeline={timeline} />;
  const result = replayFlipRun(flip.seed, myAnswer ?? "", flip.flipRev, puzzleLevel(flip));
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {flipLine(result)}
      </p>
      {result.starsTotal > 0 ? (
        <p className="shrink-0 text-center font-mono text-base text-foreground">
          ★ {result.stars} / {result.starsTotal} stars
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same corridor for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const flipPuzzle: PuzzleDefinition = {
  key: "flip",
  name: gameDisplayName("flip"),
  category: "arcade",
  timeLimitMs: FLIP_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "flip", seed: 1 }) satisfies FlipPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
  RunPicture,
};
