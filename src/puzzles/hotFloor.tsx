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

/** Fixed intro still: a few tiles, a gap, a teal tile and a pickup above the runner. */
function IntroExample() {
  const tiles = [
    [0, 0, "g"], [1, 0, "g"], [2, 0, "g"],
    [0, 1, "g"], [2, 1, "t"],
    [0, 2, "g"], [1, 2, "p"], [2, 2, "g"],
  ] as const;
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 132 132" width={132} height={132} aria-hidden="true" style={{ background: HOT_BG, borderRadius: 10 }}>
        {tiles.map(([c, r, kind]) => (
          <g key={`${c}-${r}`}>
            <rect x={6 + c * 40} y={6 + r * 40} width={36} height={36} rx={6} fill="#15151F" stroke={kind === "t" ? HOT_TEAL : HOT_GOLD} strokeOpacity={kind === "t" ? 1 : 0.6} strokeWidth={kind === "t" ? 2.5 : 1} />
            {kind === "p" && <circle cx={24 + c * 40} cy={24 + r * 40} r={5} fill={HOT_GOLD} />}
          </g>
        ))}
        <rect x={18} y={92} width={12} height={20} rx={6} fill={HOT_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swipe to hop — keep moving up.</p>
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

export function hotFloorLine(r: { pickups: number; total: number; survived: boolean; survivedSeconds: number }): string {
  const head = `${r.pickups} / ${r.total}`;
  return r.survived ? `${head} · survived` : `${head} · fell at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "hotfloor") return null;
  const result = replayHotFloorRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {hotFloorLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same floor for everyone</p>
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
