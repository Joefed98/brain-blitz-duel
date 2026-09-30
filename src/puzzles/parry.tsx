import { useRef } from "react";

import {
  parryCheckpoint,
  parryGame,
  PARRY_BG,
  PARRY_CHECKPOINT_INTERVAL,
  PARRY_GOLD,
  PARRY_INPUT_SWIPE,
  PARRY_RED,
  PARRY_SWIPE_PX,
  PARRY_TEAL,
  parrySwipePos,
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
        <circle cx={84} cy={65} r={26} fill="none" stroke={PARRY_GOLD} strokeOpacity={0.2} strokeWidth={2} />
        <line x1={84} y1={65} x2={65.6} y2={46.6} stroke={PARRY_GOLD} strokeOpacity={0.6} strokeWidth={2} />
        <circle cx={84} cy={65} r={3} fill={PARRY_GOLD} />
        <circle cx={65.6} cy={46.6} r={12} fill={PARRY_GOLD} />
        <line x1={8} y1={65} x2={36} y2={65} stroke={PARRY_TEAL} strokeWidth={3} />
        <polygon points="44,65 36,60 36,70" fill={PARRY_RED} />
        <line x1={84} y1={126} x2={84} y2={104} stroke={PARRY_TEAL} strokeWidth={3} />
        <polygon points="84,96 79,104 89,104" fill={PARRY_RED} />
        <line x1={84} y1={4} x2={84} y2={26} stroke={PARRY_TEAL} strokeWidth={3} />
        <polygon points="84,34 79,26 89,26" fill={PARRY_RED} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swiped up-left: blocks arrows from the left and the top.</p>
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
        return { a: parrySwipePos(dx, dy), b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function parryLine(r: { hits: number; survived: boolean; survivedSeconds: number; score: number }): string {
  const head = r.survived ? "Survived the minute" : `Survived ${r.survivedSeconds.toFixed(1)}s`;
  return `${head} · ${r.hits} ${r.hits === 1 ? "life" : "lives"} lost · ${r.score}`;
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
