import { useRef } from "react";

import {
  sortCheckpoint,
  sortRushGame,
  SORT_BG,
  SORT_CHECKPOINT_INTERVAL,
  SORT_COLOURS,
  SORT_DOWN,
  SORT_INPUT_SWIPE,
  SORT_LEFT,
  SORT_RIGHT,
  SORT_SWIPE_PX,
  SORT_UP,
  SORT_WORLD_H,
  SORT_WORLD_W,
} from "@/lib/arcade/sortRush";
import { encodeSortRushRun, replaySortRushRun } from "@/lib/duel/sortRush";
import { SORTRUSH_TIME_MS, type SortRushPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a shape in the channel above two coloured gates. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: SORT_BG, borderRadius: 10 }}>
        <rect x={70} y={0} width={28} height={96} fill="rgba(245,184,46,0.08)" />
        <circle cx={84} cy={50} r={10} fill={SORT_COLOURS[1]} />
        <path d="M14 124 V104 A16 16 0 0 1 46 104 V124" fill="none" stroke={SORT_COLOURS[0]} strokeWidth={4} />
        <path d="M122 124 V104 A16 16 0 0 1 154 104 V124" fill="none" stroke={SORT_COLOURS[1]} strokeWidth={4} />
        <path d="M100 50 H128" stroke={SORT_COLOURS[1]} strokeWidth={2} strokeDasharray="4 4" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swipe it toward the gate of its colour.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SortRushPuzzleData | null = puzzle.type === "sortrush" ? puzzle : null;
  const start = useRef<{ x: number; y: number; done: boolean } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="sortrush"
      label="Sort Rush"
      background={SORT_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={SORT_WORLD_W}
      worldH={SORT_WORLD_H}
      game={sortRushGame}
      checkpoint={sortCheckpoint}
      interval={SORT_CHECKPOINT_INTERVAL}
      encodeRun={encodeSortRushRun}
      discrete
      inputKind={SORT_INPUT_SWIPE}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          start.current = { x, y, done: false };
          return null;
        }
        const from = start.current;
        if (!from || from.done) return null;
        const dx = x - from.x;
        const dy = y - from.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SORT_SWIPE_PX) return null;
        from.done = true;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? SORT_LEFT : SORT_RIGHT) : dy < 0 ? SORT_UP : SORT_DOWN;
        return { a: dir, b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function sortRushLine(r: { sorted: number; total: number; wrong: number; survived: boolean; survivedSeconds: number }): string {
  const head = `${r.sorted} / ${r.total} sorted · ${r.wrong} wrong`;
  return r.survived ? `${head} · survived` : `${head} · missed at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "sortrush") return null;
  const result = replaySortRushRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {sortRushLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same shapes for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const sortRushPuzzle: PuzzleDefinition = {
  key: "sortrush",
  name: "Sort Rush",
  category: "arcade",
  timeLimitMs: SORTRUSH_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "sortrush", seed: 1 }) satisfies SortRushPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
