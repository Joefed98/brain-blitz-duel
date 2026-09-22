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
  rallyCheckpoint,
  rallyGame,
  RALLY_BALL,
  RALLY_BG,
  RALLY_CHECKPOINT_INTERVAL,
  RALLY_GOLD,
  RALLY_RUN_TICKS,
  RALLY_WORLD_H,
  RALLY_WORLD_W,
  type RallyState,
} from "@/lib/arcade/rally";
import { decodeRallyRun, encodeRallyRun, replayRallyRun } from "@/lib/duel/rally";
import { ARCADE_CRASH_FREEZE_MS, type RallyPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the ball dropping onto the paddle. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: RALLY_BG, borderRadius: 10 }}
      >
        <path d="M40 16 L120 70" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
        <circle cx={120} cy={74} r={6} fill={RALLY_BALL} />
        <rect x={96} y={100} width={50} height={8} rx={3} fill={RALLY_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Gold balls join every ten seconds and score double.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RallyPuzzleData | null = puzzle.type === "rally" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<RallyState>(rallyGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof rallyCheckpoint>[]>([]);
  const wanted = useRef<number | null>(null);
  const sent = useRef<number>(state.current.aimX);
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
    encodeRallyRun({
      seed,
      claimedScore: rallyGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = rallyGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    wanted.current = null;
    sent.current = state.current.aimX;
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

      if (!rallyGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
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
          state.current = rallyGame.step(state.current, applied);
          if (state.current.tick % RALLY_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(rallyCheckpoint(state.current));
          }
          if (rallyGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) rallyGame.draw(canvas.current!.getContext("2d")!, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (rallyGame.isOver(state.current) && !submitted.current) {
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

  const worldX = (clientX: number): number => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width < 1) return Math.round(RALLY_WORLD_W / 2);
    const scale = Math.min(box.width / RALLY_WORLD_W, box.height / RALLY_WORLD_H);
    const left = box.left + (box.width - RALLY_WORLD_W * scale) / 2;
    return Math.max(0, Math.min(RALLY_WORLD_W, Math.round((clientX - left) / scale)));
  };

  if (!data) return null;

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || submitted.current || rallyGame.isOver(state.current)) return;
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
        style={{ background: RALLY_BG }}
        aria-label="Rally"
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
  if (puzzle.type !== "rally") return null;
  const result = replayRallyRun(puzzle.seed, myAnswer ?? "");
  const drags = decodeRallyRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: RALLY_BALL }} />
        <span
          className="h-2 rounded-full"
          style={{ background: RALLY_GOLD, width: result.paddleWidth }}
        />
      </div>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.hits} hit{result.hits === 1 ? "" : "s"} · {result.goldHits} gold hit
        {result.goldHits === 1 ? "" : "s"} ·{" "}
        {result.survived ? "survived" : `lost at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {drags} paddle moves · same ball for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const rallyPuzzle: PuzzleDefinition = {
  key: "rally",
  name: "Rally",
  category: "arcade",
  timeLimitMs: (RALLY_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "rally", seed: 1 }) satisfies RallyPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
