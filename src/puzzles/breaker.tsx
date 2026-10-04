import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordInput, inputAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  ARCADE_INPUT_BUTTON,
  ARCADE_INPUT_DRAG,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  BRK_TAP_MS,
  BRK_TAP_PX,
  brkCheckpoint,
  breakerGame,
  BRK_BG,
  BRK_CHECKPOINT_INTERVAL,
  BRK_GOLD,
  BRK_RUN_TICKS,
  BRK_TEAL,
  BRK_WORLD_H,
  BRK_WORLD_W,
  type BrkState,
} from "@/lib/arcade/breaker";
import { decodeBreakerRun, encodeBreakerRun, replayBreakerRun } from "@/lib/duel/breaker";
import type { BreakerPuzzleData } from "@/lib/duel/types";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a paddle under a wall with a gold brick and a capsule. */
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
              fill={row === 1 && col === 3 ? BRK_GOLD : BRK_TEAL[row % BRK_TEAL.length]}
            />
          )),
        )}
        <rect x={92} y={62} width={12} height={8} rx={2} fill={BRK_GOLD} />
        <circle cx={64} cy={88} r={4} fill="#F7F7F8" />
        <rect x={62} y={102} width={44} height={7} rx={2} fill={BRK_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Catch a power-up brick's capsule, then tap to fire.
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
  /** Button presses waiting for a tick, and the pointer holding the button. */
  const presses = useRef<number[]>([]);
  /** The one pointer in use, where and when it went down, and whether it became a drag. */
  const dragPointer = useRef<number | null>(null);
  const downAt = useRef<{ x: number; y: number; time: number; drag: boolean } | null>(null);
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
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("breaker", state.current, breakerGame.score(state.current)),
    );
  const encodeRaw = (): string =>
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
    presses.current = [];
    dragPointer.current = null;
    submitted.current = false;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
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
          // One event a tick: a waiting button press first, otherwise a drag,
          // and only when the position has changed.
          let applied: ArcadeInputEvent | null = null;
          const press = presses.current.shift();
          if (press !== undefined) {
            applied = {
              t: state.current.tick + 1,
              k: ARCADE_INPUT_BUTTON,
              a: press,
              b: 0,
              c: 0,
              d: 0,
            };
            recordInput(events.current, applied, breakerGame.inputRanges);
          } else {
            const target = wanted.current;
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
              recordInput(events.current, applied, breakerGame.inputRanges);
            }
          }
          state.current = breakerGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % BRK_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(brkCheckpoint(state.current));
          }
          if (breakerGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, breakerGame.isOver(state.current));
      // A held-down touch that has outlasted the tap window becomes a drag.
      const down = downAt.current;
      if (down && !down.drag && time - down.time >= BRK_TAP_MS) {
        down.drag = true;
        wanted.current = worldPoint(down.x, down.y).x;
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

  /** Screen point to world point, matching the full-stage canvas mapping. */
  const worldPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width < 1) return { x: Math.round(BRK_WORLD_W / 2), y: BRK_WORLD_H / 2 };
    return {
      x: Math.max(0, Math.min(BRK_WORLD_W, Math.round(((clientX - box.left) / box.width) * BRK_WORLD_W))),
      y: Math.max(0, Math.min(BRK_WORLD_H, Math.round(((clientY - box.top) / box.height) * BRK_WORLD_H))),
    };
  };

  if (!data) return null;

  /** True when the point lies inside the full canvas play area. */
  const inPlayArea = (clientX: number, clientY: number): boolean => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width < 1) return false;
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  };

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || submitted.current || breakerGame.isOver(state.current)) return;
    if (dragPointer.current !== event.pointerId) return;
    const down = downAt.current;
    if (!down) return;
    if (!down.drag) {
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      if (moved < BRK_TAP_PX && performance.now() - down.time < BRK_TAP_MS) return;
      down.drag = true;
    }
    down.x = event.clientX;
    down.y = event.clientY;
    wanted.current = worldPoint(event.clientX, event.clientY).x;
  };

  const release = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragPointer.current === event.pointerId) {
      const down = downAt.current;
      // A tap (short and still) fires a held power-up; it never moves the paddle.
      if (
        event.type === "pointerup" &&
        down &&
        !down.drag &&
        performance.now() - down.time < BRK_TAP_MS &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < BRK_TAP_PX &&
        !locked &&
        !submitted.current &&
        !breakerGame.isOver(state.current) &&
        state.current.held > 0
      ) {
        presses.current.push(0);
      }
      dragPointer.current = null;
      downAt.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={wrap}
      className="relative min-h-0 w-full flex-1 overflow-hidden"
      style={NO_SCROLL_STYLE}
    >
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: BRK_BG }}
        aria-label="Breaker"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || breakerGame.isOver(state.current)) return;
          // Any touch on the canvas: a tap fires a power-up, anything longer
          // or further is a paddle drag.
          if (!inPlayArea(event.clientX, event.clientY)) return;
          if (dragPointer.current !== null) return;
          dragPointer.current = event.pointerId;
          downAt.current = { x: event.clientX, y: event.clientY, time: performance.now(), drag: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={track}
        onPointerUp={release}
        onPointerCancel={release}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "breaker") return null;
  const result = replayBreakerRun(puzzle.seed, myAnswer ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 flex-wrap justify-center gap-1" style={{ maxWidth: 190 }}>
        {Array.from({ length: Math.min(16, result.bricksLeft) }, (_, index) => (
          <span
            key={index}
            className="h-2.5 w-6 rounded-sm"
            style={{ background: BRK_TEAL[index % BRK_TEAL.length] }}
          />
        ))}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.cleared
          ? `Cleared at ${result.endedSeconds.toFixed(1)}s`
          : `${result.destroyed} / 80 bricks · ${result.hits} hits · ${result.powerUps} power-up${result.powerUps === 1 ? "" : "s"}`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.losses} relaunch{result.losses === 1 ? "" : "es"}
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
