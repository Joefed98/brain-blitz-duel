import { gameDisplayName } from "@/lib/duel/gameNames";
import { useRef } from "react";

import {
  SWING_INPUT_REEL,
  SWING_REEL_DOWN,
  SWING_REEL_UP,
  swingCheckpoint,
  SWING_BG,
  SWING_CHECKPOINT_INTERVAL,
  SWING_GOLD,
  SWING_INPUT_HOLD,
  SWING_RED,
  SWING_WORLD_H,
  SWING_WORLD_W,
} from "@/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "@/lib/duel/swing";
import { SWING_TIME_MS, type SwingPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { swingArtGame } from "@/lib/arcade/swing.renderer";
import { swingSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the figure mid-swing on a rope, the next anchor ahead. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: SWING_BG, borderRadius: 10 }}>
        <polyline points="0,14 20,20 40,10 60,18 80,12 100,22 120,14 140,20 168,12" fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <polyline points="0,116 24,110 48,118 72,112 96,118 120,110 144,116 168,112" fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <polygon points="0,118 8,108 16,118 24,108 32,118 40,108 48,118 56,108 64,118 72,108 80,118 88,108 96,118 104,108 112,118 120,108 128,118 136,108 144,118 152,108 160,118 168,108 168,118" fill={SWING_RED} />
        <circle cx={50} cy={34} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <circle cx={128} cy={38} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <line x1={50} y1={34} x2={78} y2={80} stroke={SWING_GOLD} strokeWidth={2} />
        <rect x={72} y={76} width={12} height={20} rx={6} fill={SWING_GOLD} />
        <path d="M 84 82 Q 104 70 118 50" fill="none" stroke={SWING_GOLD} strokeOpacity={0.4} strokeDasharray="3 4" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swing back for momentum, then let go to fly forward.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SwingPuzzleData | null = puzzle.type === "swing" ? puzzle : null;
  const start = useRef<{ y: number } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="swing"
      label={gameDisplayName("swing")}
      background="transparent"
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={SWING_WORLD_W}
      worldH={SWING_WORLD_H}
      game={swingArtGame}
      sounds={swingSounds}
      checkpoint={swingCheckpoint}
      interval={SWING_CHECKPOINT_INTERVAL}
      encodeRun={encodeSwingRun}
      discrete
      inputKind={SWING_INPUT_HOLD}
      pointer={(kind, _x, y) => {
        if (kind === "down") {
          start.current = { y };
          return { a: 1, b: 0, c: 0 };
        }
        if (kind === "up") {
          start.current = null;
          return { a: 0, b: 0, c: 0 };
        }
        // While holding, a vertical swipe of 24 px reels the rope in (up) or out (down).
        const from = start.current;
        if (!from || Math.abs(y - from.y) < 24) return null;
        const dir = y < from.y ? SWING_REEL_UP : SWING_REEL_DOWN;
        from.y = y;
        return { k: SWING_INPUT_REEL, a: dir, b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function swingLine(r: { metres: number; survived: boolean; survivedSeconds: number }): string {
  return r.survived ? `${r.metres} m · survived` : `${r.metres} m · fell at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "swing") return null;
  const result = replaySwingRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {swingLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same cavern for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const swingPuzzle: PuzzleDefinition = {
  key: "swing",
  name: gameDisplayName("swing"),
  category: "arcade",
  timeLimitMs: SWING_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "swing", seed: 1 }) satisfies SwingPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
