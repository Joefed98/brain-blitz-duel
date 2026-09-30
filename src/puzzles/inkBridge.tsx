import { useRef } from "react";

import {
  inkBridgeGame,
  inkCheckpoint,
  INK_BG,
  INK_CHECKPOINT_INTERVAL,
  INK_GOLD,
  INK_GREY,
  INK_INPUT_RELEASE,
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

/** Fixed intro still: a spout, a grey block, a drawn line past it and the bucket. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: INK_BG, borderRadius: 10 }}>
        <rect x={40} y={4} width={16} height={8} fill={INK_GOLD} opacity={0.4} />
        <circle cx={48} cy={18} r={5} fill={INK_GOLD} />
        <rect x={30} y={58} width={40} height={3} fill={INK_GREY} />
        <line x1={36} y1={30} x2={130} y2={86} stroke={INK_GOLD} strokeWidth={8} strokeOpacity={0.25} strokeLinecap="round" />
        <line x1={36} y1={30} x2={130} y2={86} stroke={INK_GOLD} strokeWidth={3} strokeLinecap="round" />
        <rect x={120} y={104} width={36} height={20} fill={INK_TEAL} opacity={0.3} />
        <rect x={117} y={102} width={42} height={3} fill={INK_TEAL} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Draw around the grey block, then RELEASE.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: InkBridgePuzzleData | null = puzzle.type === "inkbridge" ? puzzle : null;
  // Stroke points and RELEASE presses waiting to be sent, one a tick, and the last point queued.
  const pending = useRef<PointerPayload[]>([]);
  const pen = useRef<{ x: number; y: number } | null>(null);
  const presses = useRef(0);
  const queue = (payload: PointerPayload) => {
    if (pending.current.length < 120) pending.current.push(payload);
  };
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
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
          // Every payload carries k = 8 so the recorder files it as a stroke event.
          if (kind === "down") {
            pen.current = { x, y };
            const start = { k: INK_INPUT_STROKE, a: x, b: y, c: 1 };
            queue(start);
            return start;
          }
          const from = pen.current;
          if (!from) return null;
          if (Math.hypot(x - from.x, y - from.y) >= INK_STEP_PX || (kind === "up" && (x !== from.x || y !== from.y))) {
            pen.current = { x, y };
            queue({ k: INK_INPUT_STROKE, a: x, b: y, c: 0 });
          }
          if (kind === "up") pen.current = null;
          return null;
        }}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
      <button
        type="button"
        disabled={locked}
        className="h-12 shrink-0 select-none rounded-xl bg-primary text-base font-bold tracking-wide text-primary-foreground active:opacity-80 disabled:opacity-50"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          presses.current = (presses.current + 1) % 256;
          pen.current = null;
          queue({ k: INK_INPUT_RELEASE, a: presses.current, b: 0, c: 0 });
        }}
      >
        RELEASE
      </button>
    </div>
  );
}

export function inkBridgeLine(r: { levels: number; total: number; score: number }): string {
  return r.levels >= r.total ? `All ${r.total} · ${r.score}` : `Level ${r.levels} · ${r.score} points`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "inkbridge") return null;
  const result = replayInkBridgeRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {inkBridgeLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same levels for everyone</p>
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
