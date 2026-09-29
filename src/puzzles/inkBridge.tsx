import { useRef } from "react";

import {
  inkBridgeGame,
  inkCheckpoint,
  INK_BG,
  INK_CHECKPOINT_INTERVAL,
  INK_GOLD,
  INK_INPUT_STROKE,
  INK_STEP_PX,
  INK_TEAL,
  INK_WORLD_H,
  INK_WORLD_W,
} from "@/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { INKBRIDGE_TIME_MS, type InkBridgePuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a ball rolling down a drawn slope toward the bucket. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: INK_BG, borderRadius: 10 }}>
        <rect x={76} y={0} width={16} height={10} fill={INK_GOLD} opacity={0.4} />
        <line x1={70} y1={46} x2={134} y2={78} stroke={INK_GOLD} strokeWidth={8} strokeOpacity={0.25} strokeLinecap="round" />
        <line x1={70} y1={46} x2={134} y2={78} stroke={INK_GOLD} strokeWidth={3} strokeLinecap="round" />
        <circle cx={92} cy={50} r={6} fill={INK_GOLD} />
        <rect x={120} y={104} width={36} height={20} fill={INK_TEAL} opacity={0.3} />
        <rect x={117} y={102} width={42} height={3} fill={INK_TEAL} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Draw a slope to the bucket.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: InkBridgePuzzleData | null = puzzle.type === "inkbridge" ? puzzle : null;
  // Stroke points waiting to be sent, one a tick, and the last point queued.
  const pending = useRef<PointerPayload[]>([]);
  const pen = useRef<{ x: number; y: number } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="inkbridge"
      label="Ink Bridge"
      background={INK_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={INK_WORLD_W}
      worldH={INK_WORLD_H}
      game={inkBridgeGame}
      checkpoint={inkCheckpoint}
      interval={INK_CHECKPOINT_INTERVAL}
      encodeRun={encodeInkBridgeRun}
      inputKind={INK_INPUT_STROKE}
      tickInput={() => pending.current.shift() ?? null}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          pen.current = { x, y };
          const start = { a: x, b: y, c: 1 };
          if (pending.current.length < 90) pending.current.push(start);
          return start;
        }
        const from = pen.current;
        if (!from) return null;
        if (Math.hypot(x - from.x, y - from.y) >= INK_STEP_PX) {
          pen.current = { x, y };
          if (pending.current.length < 90) pending.current.push({ a: x, b: y, c: 0 });
        }
        if (kind === "up") pen.current = null;
        return null;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function inkBridgeLine(r: { caught: number; total: number }): string {
  return `${r.caught} / ${r.total} caught`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "inkbridge") return null;
  const result = replayInkBridgeRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {inkBridgeLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same drops for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const inkBridgePuzzle: PuzzleDefinition = {
  key: "inkbridge",
  name: "Ink Bridge",
  category: "arcade",
  timeLimitMs: INKBRIDGE_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "inkbridge", seed: 1 }) satisfies InkBridgePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
