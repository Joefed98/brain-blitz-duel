import { useRef } from "react";

import {
  hotfloorCheckpoint,
  hotFloorGame,
  HOT_BG,
  HOT_DOWN,
  HOT_GOLD,
  HOT_INPUT_SWIPE,
  HOT_LEFT,
  HOT_RIGHT,
  HOT_SWIPE_PX,
  HOT_TEAL,
  HOT_UP,
  HOT_WORLD_H,
  HOT_WORLD_W,
  HOTFLOOR_CHECKPOINT_INTERVAL,
} from "@/lib/arcade/hotFloor";
import { encodeHotFloorRun, replayHotFloorRun } from "@/lib/duel/hotFloor";
import { HOTFLOOR_TIME_MS, type HotFloorPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed worked example: the highlighted route outlasts the tempting centre path. */
function IntroExample() {
  const values = [8, 1, 7, 6, 2, 6, 5, 4, 5];
  const safe = new Set([6, 7, 4, 3, 0]);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 132 132" width={132} height={132} aria-hidden="true" style={{ background: HOT_BG, borderRadius: 10 }}>
        {values.map((value, cell) => (
          <g key={cell}>
            <rect x={6 + (cell % 3) * 40} y={6 + Math.trunc(cell / 3) * 40} width={36} height={36} rx={6} fill={cell === 0 ? HOT_GOLD : "#15151F"} stroke={safe.has(cell) ? HOT_TEAL : HOT_GOLD} strokeOpacity={safe.has(cell) ? 1 : 0.35} strokeWidth={safe.has(cell) ? 2.5 : 1} />
            <text x={24 + (cell % 3) * 40} y={29 + Math.trunc(cell / 3) * 40} fill={cell === 0 ? HOT_BG : value < 3 ? HOT_RED : HOT_GOLD} textAnchor="middle" fontFamily="monospace" fontSize="13" fontWeight="700">{cell === 0 ? "EXIT" : value}</text>
          </g>
        ))}
        <rect x={18} y={96} width={12} height={20} rx={6} fill={HOT_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Follow the route whose tiles last long enough.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HotFloorPuzzleData | null = puzzle.type === "hotfloor" ? puzzle : null;
  const start = useRef<{ x: number; y: number; done: boolean } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="hotfloor"
      label="Hot Floor"
      background={HOT_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={HOT_WORLD_W}
      worldH={HOT_WORLD_H}
      game={hotFloorGame}
      checkpoint={hotfloorCheckpoint}
      interval={HOTFLOOR_CHECKPOINT_INTERVAL}
      encodeRun={encodeHotFloorRun}
      discrete
      inputKind={HOT_INPUT_SWIPE}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          start.current = { x, y, done: false };
          return null;
        }
        const from = start.current;
        if (!from || from.done) return null;
        const dx = x - from.x;
        const dy = y - from.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < HOT_SWIPE_PX) return null;
        from.done = true;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? HOT_LEFT : HOT_RIGHT) : dy < 0 ? HOT_UP : HOT_DOWN;
        return { a: dir, b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function hotFloorLine(r: { stages: number; livesLost: number; completedSeconds: number }): string {
  return r.stages >= 10
    ? `10 stages · ${r.completedSeconds.toFixed(1)}s`
    : `${r.stages} stages · ${r.livesLost} ${r.livesLost === 1 ? "life" : "lives"} lost`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "hotfloor") return null;
  const result = replayHotFloorRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {hotFloorLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same routes for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const hotFloorPuzzle: PuzzleDefinition = {
  key: "hotfloor",
  name: "Hot Floor",
  category: "arcade",
  timeLimitMs: HOTFLOOR_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "hotfloor", seed: 1 }) satisfies HotFloorPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
