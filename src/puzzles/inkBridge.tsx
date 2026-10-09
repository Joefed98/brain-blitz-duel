import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef } from "react";

import {
  inkCheckpoint,
  INK_CHECKPOINT_INTERVAL,
  INK_INPUT_RELEASE,
  INK_INPUT_UNDO,
  INK_INPUT_RESET,
  INK_INPUT_DROP_AGAIN,
  INK_INPUT_STROKE,
  INK_STEP_PX,
  INK_WORLD_H,
  INK_WORLD_W,
} from "@/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { INKBRIDGE_TIME_MS, type InkBridgePuzzleData } from "@/lib/duel/types";
import { drawInkRainbowExample, inkBridgeArtGameFor, INK_ART_BG } from "@/lib/arcade/inkBridge.renderer";
import { inkBridgeSounds } from "@/lib/fx/gameSounds";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { Button } from "@/components/ui/button";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro shares the rainbow sprites without changing demo inputs. */
function IntroExample() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawInkRainbowExample(ctx);
  }, []);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <canvas ref={canvas} width={336} height={260} className="h-[130px] w-[168px] rounded-lg" aria-hidden="true" />
      <p className="text-center text-xs text-muted-foreground">Draw around the white birds, then RELEASE.</p>
    </div>
  );
}

const artGames = new Map<number, ReturnType<typeof inkBridgeArtGameFor>>();
function inkBirdsArt(rev?: number) {
  const k = rev ?? 0;
  let g = artGames.get(k);
  if (!g) { g = inkBridgeArtGameFor(rev); artGames.set(k, g); }
  return g;
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
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <ArcadeCanvasStage
        diagKey="inkbridge"
        label={gameDisplayName("inkbridge")}
        background={INK_ART_BG}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={INK_WORLD_W}
        worldH={INK_WORLD_H}
        game={inkBirdsArt(data?.inkRev)}
        sounds={inkBridgeSounds}
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
      <div data-game-controls="tools" className="flex h-12 shrink-0 gap-1.5">
        {([ [INK_INPUT_UNDO, "UNDO"], [INK_INPUT_RESET, "RESET"], [INK_INPUT_RELEASE, "RELEASE"], [INK_INPUT_DROP_AGAIN, "DROP AGAIN"] ] as const).map(([k, label]) => (
          <Button key={k} type="button" disabled={locked} variant={k === INK_INPUT_RELEASE ? "default" : "outline"} className="h-12 min-w-0 flex-1 px-1 text-xs font-bold" style={{ touchAction: "none" }} onPointerDown={(e) => {
            e.preventDefault();
            presses.current = (presses.current + 1) % 256;
            pen.current = null;
            queue({ k, a: presses.current, b: 0, c: 0 });
          }}>{label}</Button>
        ))}
      </div>
    </div>
  );
}

export function inkBridgeLine(r: { levels: number; total: number; score: number }): string {
  return r.levels >= r.total ? `All ${r.total} levels` : `Level ${r.levels}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "inkbridge") return null;
  const result = replayInkBridgeRun(puzzle.seed, myAnswer ?? "", puzzle.inkRev);
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
  name: gameDisplayName("inkbridge"),
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
