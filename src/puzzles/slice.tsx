import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordInput, inputAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  sliceCheckpoint,
  sliceGame,
  SLICE_BG,
  SLICE_CHECKPOINT_INTERVAL,
  SLICE_COLOURS,
  SLICE_GOLD,
  SLICE_INPUT_SWIPE,
  SLICE_INPUT_BEGIN,
  SLICE_INPUT_END,
  SLICE_RUN_TICKS,
  SLICE_WORLD_H,
  SLICE_WORLD_W,
  type SliceState,
} from "@/lib/arcade/slice";
import { decodeSliceRun, encodeSliceRun, replaySliceRun } from "@/lib/duel/slice";
import type { SlicePuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playBlip, playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: one swipe through three discs. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: SLICE_BG, borderRadius: 10 }}
      >
        <circle cx={44} cy={70} r={13} fill={SLICE_COLOURS[0]} />
        <circle cx={84} cy={50} r={13} fill={SLICE_COLOURS[1]} />
        <circle cx={124} cy={72} r={13} fill={SLICE_COLOURS[2]} />
        <path d="M24 92 L146 40" stroke="rgba(255,255,255,0.8)" strokeWidth={3} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Three in one swipe earns a bonus.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SlicePuzzleData | null = puzzle.type === "slice" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<SliceState>(sliceGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof sliceCheckpoint>[]>([]);
  /** Preserve the sampled curve and explicit finger boundaries, not frame chords. */
  const pending = useRef<Omit<ArcadeInputEvent, "t">[]>([]);
  const finger = useRef<{ id: number; x: number; y: number } | null>(null);
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
      arcadeCounters("slice", state.current, sliceGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeSliceRun({
      seed,
      claimedScore: sliceGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = sliceGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    finger.current = null;
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
    let bombs = state.current.bombsHit;
    let slices = state.current.slices;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;

      if (!sliceGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const sample = pending.current.shift();
          if (sample) {
            const applied = { ...sample, t: state.current.tick + 1 };
            // The sim enforces the cumulative path cap and explicit swipe boundaries.
            recordInput(events.current, applied, sliceGame.inputRanges);
          }
          state.current = sliceGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % SLICE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(sliceCheckpoint(state.current));
          }
          if (sliceGame.isOver(state.current)) break;
        }
      }

      if (state.current.bombsHit > bombs) {
        bombs = state.current.bombsHit;
        buzz(40);
        playWrong();
      } else if (state.current.slices > slices) {
        slices = state.current.slices;
        playBlip();
      }

      reportArcadeTick(state.current.tick, sliceGame.isOver(state.current));

      const size = sizeCanvas();
      const ctx = canvas.current?.getContext("2d");
      if (size && ctx) sliceGame.draw(ctx, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (sliceGame.isOver(state.current) && !submitted.current) finish();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

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

  const worldPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SLICE_WORLD_W, Math.round(((event.clientX - box.left) / box.width) * SLICE_WORLD_W))),
      y: Math.max(0, Math.min(SLICE_WORLD_H, Math.round(((event.clientY - box.top) / box.height) * SLICE_WORLD_H))),
    };
  };

  const samplePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = finger.current;
    if (!previous || previous.id !== event.pointerId) return;
    const point = worldPoint(event);
    if (previous.x === point.x && previous.y === point.y) return;
    pending.current.push({ k: SLICE_INPUT_SWIPE, a: previous.x, b: previous.y, c: point.x, d: point.y });
    finger.current = { id: previous.id, ...point };
  };
  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (finger.current?.id !== event.pointerId) return;
    samplePointer(event);
    pending.current.push({ k: SLICE_INPUT_END, a: 0, b: 0, c: 0, d: 0 });
    finger.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!data) return null;

  return (
    <div
      ref={wrap}
      className="min-h-0 w-full flex-1 overflow-hidden"
      style={NO_SCROLL_STYLE}
    >
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: SLICE_BG }}
        aria-label="Slice"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || sliceGame.isOver(state.current)) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          if (finger.current) return;
          const point = worldPoint(event);
          finger.current = { id: event.pointerId, ...point };
          pending.current.push({ k: SLICE_INPUT_BEGIN, a: point.x, b: point.y, c: 0, d: 0 });
        }}
        onPointerMove={samplePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "slice") return null;
  const result = replaySliceRun(puzzle.seed, myAnswer ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 items-center gap-2">
        {SLICE_COLOURS.slice(0, 3).map((colour) => (
          <span key={colour} className="h-4 w-4 rounded-full" style={{ background: colour }} />
        ))}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        Sliced {result.slices} / {result.totalDiscs} · best combo ×{result.bestMult}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.bombsHit === 1 ? "1 bomb" : `${result.bombsHit} bombs`} hit
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const slicePuzzle: PuzzleDefinition = {
  key: "slice",
  name: "Slice",
  category: "arcade",
  timeLimitMs: (SLICE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "slice", seed: 1 }) satisfies SlicePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
