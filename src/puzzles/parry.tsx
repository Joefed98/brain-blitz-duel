import { useRef } from "react";

import {
  parryCheckpoint,
  parryGame,
  PARRY_BG,
  PARRY_CHECKPOINT_INTERVAL,
  PARRY_DOWN,
  PARRY_GOLD,
  PARRY_INPUT_SWIPE,
  PARRY_LEFT,
  PARRY_RED,
  PARRY_RIGHT,
  PARRY_SWIPE_PX,
  PARRY_TEAL,
  PARRY_UP,
  PARRY_WORLD_H,
  PARRY_WORLD_W,
} from "@/lib/arcade/parry";
import { encodeParryRun, replayParryRun } from "@/lib/duel/parry";
import { PARRY_TIME_MS, type ParryPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the shield with an arrow closing in from the left. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: PARRY_BG, borderRadius: 10 }}>
        <circle cx={84} cy={65} r={20} fill="none" stroke={PARRY_GOLD} strokeWidth={4} />
        <circle cx={84} cy={65} r={30} fill="none" stroke={PARRY_GOLD} strokeOpacity={0.25} strokeWidth={2} />
        <line x1={20} y1={65} x2={46} y2={65} stroke={PARRY_TEAL} strokeWidth={3} />
        <polygon points="54,65 46,60 46,70" fill={PARRY_RED} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swipe left, just before it lands.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: ParryPuzzleData | null = puzzle.type === "parry" ? puzzle : null;
  const start = useRef<{ x: number; y: number; done: boolean } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="parry"
      label="Parry"
      background={PARRY_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={PARRY_WORLD_W}
      worldH={PARRY_WORLD_H}
      game={parryGame}
      checkpoint={parryCheckpoint}
      interval={PARRY_CHECKPOINT_INTERVAL}
      encodeRun={encodeParryRun}
      discrete
      inputKind={PARRY_INPUT_SWIPE}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          start.current = { x, y, done: false };
          return null;
        }
        const from = start.current;
        if (!from || from.done) return null;
        const dx = x - from.x;
        const dy = y - from.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < PARRY_SWIPE_PX) return null;
        from.done = true;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? PARRY_LEFT : PARRY_RIGHT) : dy < 0 ? PARRY_UP : PARRY_DOWN;
        return { a: dir, b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function parryLine(r: { deflected: number; total: number; hits: number; survived: boolean; survivedSeconds: number }): string {
  const head = `${r.deflected} / ${r.total} deflected · ${r.hits} ${r.hits === 1 ? "hit" : "hits"}`;
  return r.survived ? `${head} · survived` : `${head} · fell at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "parry") return null;
  const result = replayParryRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {parryLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same arrows for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const parryPuzzle: PuzzleDefinition = {
  key: "parry",
  name: "Parry",
  category: "arcade",
  timeLimitMs: PARRY_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "parry", seed: 1 }) satisfies ParryPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
