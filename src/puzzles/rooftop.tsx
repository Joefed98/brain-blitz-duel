import { directionOf } from "@/lib/desktop";
import { useRef } from "react";

import {
  roofCheckpoint,
  rooftopGame,
  ROOF_CHECKPOINT_INTERVAL,
  ROOF_DOWN,
  ROOF_GOLD,
  ROOF_LEFT,
  ROOF_RIGHT,
  ROOF_SKY_BOTTOM,
  ROOF_SKY_TOP,
  ROOF_SWIPE_PX,
  ROOF_TEAL,
  ROOF_UP,
  ROOF_INPUT_SWIPE,
  ROOF_WORLD_H,
  ROOF_WORLD_W,
} from "@/lib/arcade/rooftop";
import { encodeRooftopRun, replayRooftopRun } from "@/lib/duel/rooftop";
import { ROOFTOP_TIME_MS, type RooftopPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: three lanes with a low barrier and a high bar. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 130"
        width={168}
        height={130}
        aria-hidden="true"
        style={{ background: `linear-gradient(${ROOF_SKY_TOP}, ${ROOF_SKY_BOTTOM})`, borderRadius: 10 }}
      >
        <line x1={6} y1={130} x2={74} y2={16} stroke={ROOF_GOLD} strokeWidth={2} />
        <line x1={162} y1={130} x2={94} y2={16} stroke={ROOF_GOLD} strokeWidth={2} />
        <line x1={58} y1={130} x2={80} y2={16} stroke={ROOF_GOLD} strokeOpacity={0.3} />
        <line x1={110} y1={130} x2={88} y2={16} stroke={ROOF_GOLD} strokeOpacity={0.3} />
        <rect x={22} y={76} width={38} height={12} fill={ROOF_TEAL} />
        <rect x={108} y={52} width={38} height={10} fill={ROOF_TEAL} />
        <rect x={108} y={52} width={2} height={36} fill={ROOF_TEAL} opacity={0.5} />
        <rect x={144} y={52} width={2} height={36} fill={ROOF_TEAL} opacity={0.5} />
        <circle cx={84} cy={98} r={5} fill={ROOF_GOLD} />
        <rect x={79} y={104} width={10} height={16} rx={3} fill={ROOF_GOLD} />
        <line x1={79} y1={107} x2={73} y2={116} stroke={ROOF_GOLD} strokeWidth={3} strokeLinecap="round" />
        <line x1={89} y1={107} x2={95} y2={98} stroke={ROOF_GOLD} strokeWidth={3} strokeLinecap="round" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Jump the low barrier, slide the high bar.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RooftopPuzzleData | null = puzzle.type === "rooftop" ? puzzle : null;
  const start = useRef<{ x: number; y: number; done: boolean } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="rooftop"
      label="Rooftop Run"
      background={ROOF_SKY_TOP}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={ROOF_WORLD_W}
      worldH={ROOF_WORLD_H}
      game={rooftopGame}
      checkpoint={roofCheckpoint}
      interval={ROOF_CHECKPOINT_INTERVAL}
      encodeRun={encodeRooftopRun}
      discrete
      inputKind={ROOF_INPUT_SWIPE}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          start.current = { x, y, done: false };
          return null;
        }
        const from = start.current;
        if (!from || from.done) return null;
        const dx = x - from.x;
        const dy = y - from.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < ROOF_SWIPE_PX) return null;
        from.done = true;
        const dir =
          Math.abs(dx) > Math.abs(dy)
            ? dx < 0
              ? ROOF_LEFT
              : ROOF_RIGHT
            : dy < 0
              ? ROOF_UP
              : ROOF_DOWN;
        return { a: dir, b: 0, c: 0 };
      }}
      keys={(kind, key, send, _state, event) => {
        // A swipe's four directions on the arrows or WASD.
        const dir = directionOf(key);
        if (!dir) return false;
        if (kind === "down" && !event.repeat) send({ a: dir === "left" ? ROOF_LEFT : dir === "right" ? ROOF_RIGHT : dir === "up" ? ROOF_UP : ROOF_DOWN, b: 0, c: 0 });
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function rooftopLine(r: { survived: boolean; survivedSeconds: number }): string {
  return r.survived ? "Survived the minute" : `Survived ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "rooftop") return null;
  const result = replayRooftopRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {rooftopLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same course for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const rooftopPuzzle: PuzzleDefinition = {
  key: "rooftop",
  name: "Rooftop Run",
  category: "arcade",
  timeLimitMs: ROOFTOP_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "rooftop", seed: 1 }) satisfies RooftopPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
