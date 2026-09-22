import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  crossCheckpoint,
  crossGame,
  crossPaused,
  CROSS_BG,
  CROSS_BLOCK,
  CROSS_CHECKPOINT_INTERVAL,
  CROSS_GOAL,
  CROSS_INPUT_MOVE,
  CROSS_PLAYER,
  CROSS_RUN_TICKS,
  CROSS_SWIPE_PX,
  type CrossState,
} from "@/lib/arcade/cross";
import { decodeCrossRun, encodeCrossRun, replayCrossRun } from "@/lib/duel/cross";
import { ARCADE_CRASH_FREEZE_MS, type CrossPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a disc below a lane of traffic with a gap to aim for. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 180 110"
        width={180}
        height={110}
        aria-hidden="true"
        style={{ background: CROSS_BG, borderRadius: 10 }}
      >
        <rect x="10" y="8" width="160" height="14" fill={CROSS_GOAL} />
        <rect x="10" y="30" width="45" height="22" fill={CROSS_BLOCK} />
        <rect x="120" y="30" width="45" height="22" fill={CROSS_BLOCK} />
        <rect x="10" y="60" width="30" height="22" fill={CROSS_BLOCK} />
        <rect x="95" y="60" width="50" height="22" fill={CROSS_BLOCK} />
        <circle cx="86" cy="96" r="10" fill={CROSS_PLAYER} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Swipe up into the gaps until you reach the far kerb.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: CrossPuzzleData | null = puzzle.type === "cross" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<CrossState>(crossGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof crossCheckpoint>[]>([]);
  const pending = useRef<number[]>([]);
  /** Where the finger went down, so a swipe direction can be read off. */
  const from = useRef<{ x: number; y: number } | null>(null);
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
    encodeCrossRun({
      seed,
      claimedScore: crossGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = crossGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
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

      if (!crossGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // Anything queued while the disc waits on the kerb is thrown away and
          // never written to the run log.
          if (crossPaused(state.current)) pending.current = [];
          const move = crossPaused(state.current) ? undefined : pending.current.shift();
          const applied: ArcadeInputEvent | null =
            move === undefined
              ? null
              : { t: state.current.tick + 1, k: CROSS_INPUT_MOVE, a: move, b: 0, c: 0, d: 0 };
          if (applied) events.current.push(applied);
          state.current = crossGame.step(state.current, applied);
          if (state.current.tick % CROSS_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(crossCheckpoint(state.current));
          }
          if (crossGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) crossGame.draw(canvas.current!.getContext("2d")!, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (crossGame.isOver(state.current) && !submitted.current) {
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
        style={{ background: CROSS_BG }}
        aria-label="Cross"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || crossGame.isOver(state.current)) return;
          from.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = from.current;
          from.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (!start || locked || submitted.current || crossGame.isOver(state.current)) return;
          // Nothing swiped on the kerb is kept, so it cannot spill into the
          // crossing that follows.
          if (crossPaused(state.current)) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) < CROSS_SWIPE_PX && Math.abs(dy) < CROSS_SWIPE_PX) return;
          if (Math.abs(dy) >= Math.abs(dx)) pending.current.push(dy < 0 ? 0 : 1);
          else pending.current.push(dx < 0 ? 2 : 3);
        }}
        onPointerCancel={(event) => {
          from.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "cross") return null;
  const result = replayCrossRun(puzzle.seed, myAnswer ?? "");
  const moves = decodeCrossRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <svg viewBox="0 0 160 40" className="h-auto w-full max-w-[190px] shrink-0" aria-hidden="true">
        <rect x="0" y="2" width="160" height="6" fill={CROSS_GOAL} />
        <rect x="10" y="16" width="40" height="10" fill={CROSS_BLOCK} />
        <rect x="100" y="16" width="46" height="10" fill={CROSS_BLOCK} />
        <circle cx="78" cy="34" r="6" fill={CROSS_PLAYER} />
      </svg>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.crossings} crossing{result.crossings === 1 ? "" : "s"} · {result.lanes} lane
        {result.lanes === 1 ? "" : "s"} ·{" "}
        {result.survived ? "survived" : `crashed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {moves} move{moves === 1 ? "" : "s"} · same traffic for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const crossPuzzle: PuzzleDefinition = {
  key: "cross",
  name: "Cross",
  category: "arcade",
  timeLimitMs: (CROSS_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "cross", seed: 1 }) satisfies CrossPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
