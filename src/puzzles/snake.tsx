import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  snakeCheckpoint,
  snakeGame,
  SNAKE_BG,
  SNAKE_BODY,
  SNAKE_CHECKPOINT_INTERVAL,
  SNAKE_HEAD,
  SNAKE_INPUT_TURN,
  SNAKE_PELLET,
  SNAKE_RUN_TICKS,
  SNAKE_SWIPE_PX,
  type SnakeState,
} from "@/lib/arcade/snake";
import { decodeSnakeRun, encodeSnakeRun, replaySnakeRun } from "@/lib/duel/snake";
import { ARCADE_CRASH_FREEZE_MS, type SnakePuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a short snake about to reach the pellet. */
function IntroExample() {
  const body = [
    [3, 2],
    [3, 3],
    [3, 4],
  ];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: SNAKE_BG, borderRadius: 10 }}
      >
        {Array.from({ length: 7 }, (_, col) =>
          Array.from({ length: 5 }, (_, row) => (
            <rect
              key={`${col}-${row}`}
              x={col * 24}
              y={row * 24}
              width={24}
              height={24}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
            />
          )),
        )}
        {body.map(([col, row], index) => (
          <rect
            key={index}
            x={(col ?? 0) * 24 + 3}
            y={(row ?? 0) * 24 + 3}
            width={18}
            height={18}
            fill={index === 0 ? SNAKE_HEAD : SNAKE_BODY}
          />
        ))}
        <circle cx={3 * 24 + 12} cy={24 + 12} r={7} fill={SNAKE_PELLET} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Swipe up and the head takes the pellet.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SnakePuzzleData | null = puzzle.type === "snake" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<SnakeState>(snakeGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof snakeCheckpoint>[]>([]);
  const pending = useRef<number[]>([]);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const submitted = useRef(false);
  const deadAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    encodeSnakeRun({
      seed,
      claimedScore: snakeGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = snakeGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    anchor.current = null;
    submitted.current = false;
    deadAt.current = null;
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

      if (!snakeGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const turn = pending.current.shift();
          const applied: ArcadeInputEvent | null =
            turn === undefined
              ? null
              : { t: state.current.tick + 1, k: SNAKE_INPUT_TURN, a: turn, b: 0, c: 0, d: 0 };
          if (applied) events.current.push(applied);
          state.current = snakeGame.step(state.current, applied);
          if (state.current.tick % SNAKE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(snakeCheckpoint(state.current));
          }
          if (snakeGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) snakeGame.draw(canvas.current!.getContext("2d")!, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (snakeGame.isOver(state.current) && !submitted.current) {
        if (state.current.dead) {
          if (deadAt.current === null) {
            deadAt.current = time;
            buzz(40);
            playWrong();
          } else if (time - deadAt.current >= ARCADE_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
          finish();
        }
      }
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

  if (!data) return null;

  return (
    <div
      ref={wrap}
      className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
      style={NO_SCROLL_STYLE}
    >
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: SNAKE_BG }}
        aria-label="Snake"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || snakeGame.isOver(state.current)) return;
          anchor.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const from = anchor.current;
          if (!from || locked || submitted.current || snakeGame.isOver(state.current)) return;
          const dx = event.clientX - from.x;
          const dy = event.clientY - from.y;
          if (Math.abs(dx) < SNAKE_SWIPE_PX && Math.abs(dy) < SNAKE_SWIPE_PX) return;
          const dir =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
          pending.current.push(dir);
          anchor.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          anchor.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          anchor.current = null;
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "snake") return null;
  const result = replaySnakeRun(puzzle.seed, myAnswer ?? "");
  const turns = decodeSnakeRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center gap-1">
        {Array.from({ length: Math.min(12, Math.max(3, result.length)) }, (_, index) => (
          <span
            key={index}
            className="h-3 w-3 rounded-sm"
            style={{ background: index === 0 ? SNAKE_HEAD : SNAKE_BODY }}
          />
        ))}
        <span className="ml-1 h-3 w-3 rounded-full" style={{ background: SNAKE_PELLET }} />
      </div>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.pellets} pellet{result.pellets === 1 ? "" : "s"} ·{" "}
        {result.survived ? "survived" : `crashed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {turns} turn{turns === 1 ? "" : "s"} · same food for everyone
      </p>
      {result.desyncTick !== null && (
        <p className="shrink-0 font-mono text-xs font-bold text-destructive">
          desync at tick {result.desyncTick}
        </p>
      )}
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const snakePuzzle: PuzzleDefinition = {
  key: "snake",
  name: "Snake",
  category: "arcade",
  timeLimitMs: (SNAKE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "snake", seed: 1 }) satisfies SnakePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
