import { useEffect, useRef, useState } from "react";

import {
  ARCADE_INPUT_DRAG,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  brkCheckpoint,
  breakerGame,
  BRK_BG,
  BRK_CHECKPOINT_INTERVAL,
  BRK_GOLD,
  BRK_RUN_TICKS,
  BRK_TEAL,
  BRK_WORLD_W,
  type BrkState,
} from "@/lib/arcade/breaker";
import { decodeBreakerRun, encodeBreakerRun, replayBreakerRun } from "@/lib/duel/breaker";
import type { BreakerPuzzleData } from "@/lib/duel/types";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a paddle under a wall of bricks. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: BRK_BG, borderRadius: 10 }}
      >
        {Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 6 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={12 + col * 24}
              y={14 + row * 14}
              width={22}
              height={10}
              fill={BRK_TEAL[row % BRK_TEAL.length]}
            />
          )),
        )}
        <circle cx={84} cy={88} r={4} fill="#F7F7F8" />
        <rect x={62} y={102} width={44} height={7} rx={2} fill={BRK_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Drag the paddle; the ball clears the wall.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BreakerPuzzleData | null = puzzle.type === "breaker" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<BrkState>(breakerGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof brkCheckpoint>[]>([]);
  /** The latest finger position, and the last one the sim was told about. */
  const wanted = useRef<number | null>(null);
  const sent = useRef<number>(state.current.aimX);
  const submitted = useRef(false);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    encodeBreakerRun({
      seed,
      claimedScore: breakerGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = breakerGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    wanted.current = null;
    sent.current = state.current.aimX;
    submitted.current = false;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;

      if (!breakerGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // One drag event a tick, and only when the position has changed.
          const target = wanted.current;
          let applied: ArcadeInputEvent | null = null;
          if (target !== null && target !== sent.current) {
            applied = {
              t: state.current.tick + 1,
              k: ARCADE_INPUT_DRAG,
              a: target,
              b: 0,
              c: 0,
              d: 0,
            };
            sent.current = target;
            events.current.push(applied);
          }
          state.current = breakerGame.step(state.current, applied);
          if (state.current.tick % BRK_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(brkCheckpoint(state.current));
          }
          if (breakerGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) breakerGame.draw(canvas.current!.getContext("2d")!, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (breakerGame.isOver(state.current)) finish();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (node.width !== width * ratio || node.height !== height * ratio) {
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }
    const ctx = node.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  };

  /** Screen x to world x, matching the canvas letterboxing. */
  const worldX = (clientX: number): number => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width < 1) return Math.round(BRK_WORLD_W / 2);
    const scale = Math.min(box.width / BRK_WORLD_W, box.height / 620);
    const left = box.left + (box.width - BRK_WORLD_W * scale) / 2;
    return Math.max(0, Math.min(BRK_WORLD_W, Math.round((clientX - left) / scale)));
  };

  if (!data) return null;

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || submitted.current || breakerGame.isOver(state.current)) return;
    wanted.current = worldX(event.clientX);
  };

  return (
    <div
      ref={wrap}
      className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
      style={NO_SCROLL_STYLE}
    >
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: BRK_BG }}
        aria-label="Breaker"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          track(event);
        }}
        onPointerMove={track}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "breaker") return null;
  const result = replayBreakerRun(puzzle.seed, myAnswer ?? "");
  const drags = decodeBreakerRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap justify-center gap-1" style={{ maxWidth: 190 }}>
        {Array.from({ length: Math.min(16, result.bricksLeft) }, (_, index) => (
          <span
            key={index}
            className="h-2.5 w-6 rounded-sm"
            style={{ background: BRK_TEAL[index % BRK_TEAL.length] }}
          />
        ))}
      </div>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.cleared
          ? `Cleared at ${result.endedSeconds.toFixed(1)}s`
          : `${result.hits} hits · ${result.bricksLeft} brick${result.bricksLeft === 1 ? "" : "s"} left`}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {result.losses} relaunch{result.losses === 1 ? "" : "es"} · {drags} paddle moves
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const breakerPuzzle: PuzzleDefinition = {
  key: "breaker",
  name: "Breaker",
  category: "arcade",
  timeLimitMs: (BRK_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "breaker", seed: 1 }) satisfies BreakerPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
