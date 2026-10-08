import { tiltArtGame } from "@/lib/arcade/tiltArt.renderer";
import { tiltSounds } from "@/lib/fx/gameSounds";
import { useRef } from "react";

import {
  tiltCheckpoint,
  tiltGame,
  TILT_BG,
  TILT_CHECKPOINT_INTERVAL,
  TILT_GOLD,
  TILT_RED,
  TILT_TEAL,
  TILT_WORLD_H,
  TILT_WORLD_W,
} from "@/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "@/lib/duel/tilt";
import { TILT_TIME_MS, type TiltPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a tilted disc maze, the ball rolling toward the teal exit. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 150 150" width={150} height={150} aria-hidden="true" style={{ background: TILT_BG, borderRadius: 10 }}>
        <g transform="rotate(20 75 75)">
          <circle cx={75} cy={75} r={62} fill="#11111B" stroke={TILT_GOLD} strokeOpacity={0.5} strokeWidth={2} />
          <path d="M35 45 H95 M55 65 V105 M75 85 H115 M95 45 V65 M35 105 H75" stroke={TILT_GOLD} strokeWidth={3} strokeLinecap="round" />
          <line x1={115} y1={95} x2={115} y2={115} stroke={TILT_TEAL} strokeWidth={5} />
          <polygon points="45,80 49.3,87.5 40.7,87.5" fill={TILT_RED} />
          <circle cx={95} cy={100} r={6} fill={TILT_GOLD} />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">Spin the maze so the ball rolls into the blue cup.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: TiltPuzzleData | null = puzzle.type === "tilt" ? puzzle : null;
  const touch = useRef(0);
  return (
    <ArcadeCanvasStage
      diagKey="tilt"
      label="Tilt"
      background={TILT_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={TILT_WORLD_W}
      worldH={TILT_WORLD_H}
      renderAtCanvasSize
      game={tiltArtGame}
      sounds={tiltSounds}
      checkpoint={tiltCheckpoint}
      interval={TILT_CHECKPOINT_INTERVAL}
      encodeRun={encodeTiltRun}
      pointer={(kind, x) => {
        // c identifies the touch, so the sim knows a new drag is not a jump.
        if (kind === "down") touch.current = (touch.current + 1) % 256;
        return { a: x, b: 0, c: touch.current };
      }}
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
  const result = replayTiltRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {tiltLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same mazes for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const tiltPuzzle: PuzzleDefinition = {
  key: "tilt",
  name: "Tilt",
  category: "arcade",
  timeLimitMs: TILT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "tilt", seed: 1 }) satisfies TiltPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
