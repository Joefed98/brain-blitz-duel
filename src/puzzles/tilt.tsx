import { heldHorizontal } from "@/lib/desktop";
import { FrameStill } from "@/components/puzzles/FrameStill";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { tiltArenaSceneFor, tiltArtGameFor, WALNUT_TABLE_EDGE } from "@/lib/arcade/tiltArt.renderer";
import { tiltSounds } from "@/lib/fx/gameSounds";
import { useRef } from "react";

import {
  tiltCheckpoint,
  TILT_BG,
  TILT_CHECKPOINT_INTERVAL,
  TILT_GOLD,
  TILT_RED,
  TILT_REV_BIG,
  TILT_REV_THREE,
  TILT_REV_STD,
  TILT_TEAL,
  TILT_WORLD_W,
  tiltWorldHFor,
} from "@/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "@/lib/duel/tilt";
import { TILT_TIME_MS, type TiltPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a tilted disc maze, the ball rolling toward the teal exit. */
function IntroExample() {
  // The Strategy overhaul (15 Nov 2026): a real frame of today's game (scripts/shots/strategy-stills.ts).
  return <FrameStill type="tilt" ratio={1.8643} caption="Spin the disc so each marble rolls into its own cup." />;
}

/** Desktop keys: px a tick of the virtual finger (a steady finger drag). */
const TILT_KEY_PX = 4;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: TiltPuzzleData | null = puzzle.type === "tilt" ? puzzle : null;
  const touch = useRef(0);
  // Desktop keys: ←/→ (A/D) drag a virtual finger 4 px a tick; a new hold starts a new touch, as a finger does.
  const held = useRef(heldHorizontal());
  const pad = useRef<{ x: number } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="tilt"
      label={gameDisplayName("tilt")}
      // The board's oak (tiltRev 12: its walnut), so the sub-pixel sliver at the centred world's edges is wood, not a dark line (17 Oct 2026).
      background={data?.tiltRev === TILT_REV_THREE || data?.tiltRev === TILT_REV_BIG ? WALNUT_TABLE_EDGE : "#9A7347"}
      fitWorld
      centreWorld
      scene={tiltArenaSceneFor(data?.tiltRev)}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={TILT_WORLD_W}
      // tiltRev 8: the taller world (the bigger mazes drawn whole through a fixed camera since 27 Oct 2026).
      worldH={tiltWorldHFor(data?.tiltRev)}
      renderAtCanvasSize
      game={tiltArtGameFor(data?.tiltRev, data?.level)}
      sounds={tiltSounds}
      checkpoint={tiltCheckpoint}
      interval={TILT_CHECKPOINT_INTERVAL}
      encodeRun={encodeTiltRun}
      pointer={(kind, x) => {
        // c identifies the touch, so the sim knows a new drag is not a jump.
        if (kind === "down") touch.current = (touch.current + 1) % 256;
        return { a: x, b: 0, c: touch.current };
      }}
      tickInput={() => {
        const dir = held.current.dir();
        if (dir === 0) {
          pad.current = null;
          return null;
        }
        if (!pad.current || pad.current.x + dir * TILT_KEY_PX < 0 || pad.current.x + dir * TILT_KEY_PX > TILT_WORLD_W) {
          // Lift and put the finger down again in the middle (the sim's own re-anchor, no turn).
          touch.current = (touch.current + 1) % 256;
          pad.current = { x: TILT_WORLD_W / 2 };
        } else pad.current.x += dir * TILT_KEY_PX;
        return { a: pad.current.x, b: 0, c: touch.current };
      }}
      keys={(kind, key) => held.current.key(kind, key)}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function tiltLine(r: { mazes: number; survived: boolean; survivedSeconds: number }): string {
  const head = `${r.mazes} ${r.mazes === 1 ? "maze" : "mazes"} completed`;
  return r.survived ? `${head} · survived` : `${head} · dark hole at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "tilt") return null;
  const result = replayTiltRun(puzzle.seed, myAnswer ?? "", puzzle.tiltRev, puzzle.level);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {tiltLine(result)}
      </p>
      {result.totalStars > 0 && (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.stars} / {result.totalStars} bonus stars
          {result.totalQuick > 0 ? ` · ${result.quickStars} / ${result.totalQuick} quick stars` : ""}
        </p>
      )}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same mazes for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const tiltPuzzle: PuzzleDefinition = {
  key: "tilt",
  name: gameDisplayName("tilt"),
  category: "arcade",
  timeLimitMs: TILT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "tilt", seed: 1, tiltRev: TILT_REV_STD }) satisfies TiltPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
