import { heldHorizontal, useGameKeys } from "@/lib/desktop";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordInput, inputAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
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
  stdCheckpoint,
  steadyGame,
  STD_BG,
  STD_CHECKPOINT_INTERVAL,
  STD_DOT,
  STD_GOLD,
  STD_RUN_TICKS,
  STD_WORLD_H,
  STD_WORLD_W,
  type StdState,
} from "@/lib/arcade/steady";
import { decodeSteadyRun, encodeSteadyRun, replaySteadyRun } from "@/lib/duel/steady";
import type { SteadyPuzzleData } from "@/lib/duel/types";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

/** Fixed intro still: the ball on its line inside a winding track. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: STD_BG, borderRadius: 10 }}
      >
        <path
          d="M64 118 C64 90 96 84 96 56 C96 30 72 22 72 2"
          stroke={STD_GOLD}
          strokeWidth={2}
          fill="none"
        />
        <path
          d="M90 118 C90 90 122 84 122 56 C122 30 98 22 98 2"
          stroke={STD_GOLD}
          strokeWidth={2}
          fill="none"
        />
        <circle cx={77} cy={104} r={7} fill={STD_DOT} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Slide the ball left and right to stay inside.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SteadyPuzzleData | null = puzzle.type === "steady" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<StdState>(steadyGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof stdCheckpoint>[]>([]);
  const wanted = useRef<{ x: number; down: boolean } | null>(null);
  const sent = useRef<{ x: number; down: boolean }>({ x: state.current.aimX, down: false });
  const submitted = useRef(false);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: holding ←/→ (A/D) is a held finger sliding 4 px a tick; letting go lifts it.
  const keyMove = useRef(heldHorizontal());
  const keyHeld = useRef(false);
  useGameKeys((kind, key) => keyMove.current.key(kind, key));
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("steady", state.current, steadyGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeSteadyRun({
      seed,
      claimedScore: steadyGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = steadyGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    wanted.current = null;
    sent.current = { x: state.current.aimX, down: false };
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
    const feedback = arcadeFeedback();

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frameTiming.begin(time);
      frame = arenaFrame(loop);
      const delta = time - last;
      last = time;

      if (!steadyGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const keyDir = keyMove.current.dir();
          if (keyDir !== 0) {
            keyHeld.current = true;
            wanted.current = { x: Math.max(0, Math.min(STD_WORLD_W, (wanted.current?.x ?? state.current.aimX) + keyDir * 4)), down: true };
          } else if (keyHeld.current) {
            keyHeld.current = false;
            if (wanted.current) wanted.current = { ...wanted.current, down: false };
          }
          // One drag event a tick, and only when the position has changed.
          const target = wanted.current;
          let applied: ArcadeInputEvent | null = null;
          if (
            target !== null &&
            (target.x !== sent.current.x || target.down !== sent.current.down)
          ) {
            applied = {
              t: state.current.tick + 1,
              k: ARCADE_INPUT_DRAG,
              a: target.x,
              b: target.down ? 1 : 0,
              c: 0,
              d: 0,
            };
            sent.current = target;
            recordInput(events.current, applied, steadyGame.inputRanges);
          }
          state.current = steadyGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % STD_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(stdCheckpoint(state.current));
          }
          if (steadyGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, steadyGame.isOver(state.current));
      feedback(state.current, steadyGame.isOver(state.current));

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) steadyGame.draw(context, state.current, size);

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (steadyGame.isOver(state.current)) finish();
      frameTiming.end();
    };

    frame = arenaFrame(loop);
    return () => cancelArenaFrame(loop, frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    const ratio = arcadeCanvasRatio();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
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

  /** Screen x to world x, matching the full-stage canvas mapping. */
  const worldX = (clientX: number): number => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width < 1) return Math.round(STD_WORLD_W / 2);
    return Math.max(0, Math.min(STD_WORLD_W, Math.round(((clientX - box.left) / box.width) * STD_WORLD_W)));
  };

  if (!data) return null;

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || submitted.current || steadyGame.isOver(state.current)) return;
    wanted.current = { x: worldX(event.clientX), down: true };
  };
  const lift = () => {
    if (wanted.current) wanted.current = { ...wanted.current, down: false };
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
        style={{ background: STD_BG }}
        aria-label="Steady"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          track(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 0 || event.pointerType !== "mouse") track(event);
        }}
        onPointerCancel={lift}
        onPointerUp={(event) => {
          lift();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "steady") return null;
  const result = replaySteadyRun(puzzle.seed, myAnswer ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 items-center gap-2">
        <span className="h-8 w-1 rounded" style={{ background: STD_GOLD }} />
        <span className="h-3 w-3 rounded-full" style={{ background: STD_DOT }} />
        <span className="h-8 w-1 rounded" style={{ background: STD_GOLD }} />
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.metres} m · {result.touches} touch{result.touches === 1 ? "" : "es"}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same track for everyone
        {result.clean ? " · no touches" : ""}
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const steadyPuzzle: PuzzleDefinition = {
  key: "steady",
  name: "Steady",
  category: "arcade",
  timeLimitMs: (STD_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "steady", seed: 1 }) satisfies SteadyPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
