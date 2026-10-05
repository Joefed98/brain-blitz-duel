import { arcadeFeedback } from "@/lib/fx/arcade";
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
  dualCheckpoint,
  dualGame,
  DUAL_BG,
  DUAL_SPIKE,
  DUAL_CHECKPOINT_INTERVAL,
  DUAL_GROUND,
  DUAL_INPUT_JUMP,
  DUAL_RUNNER,
  DUAL_RUN_TICKS,
  type DualState,
} from "@/lib/arcade/dual";
import { decodeDualRun, encodeDualRun, replayDualRun } from "@/lib/duel/dual";
import { ARCADE_CRASH_FREEZE_MS, type DualPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: both runners, one mid-jump over its block. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 180 96"
        width={180}
        height={96}
        aria-hidden="true"
        style={{ background: DUAL_BG, borderRadius: 10 }}
      >
        <rect x="8" y="70" width="74" height="4" fill={DUAL_GROUND} />
        <rect x="98" y="70" width="74" height="4" fill={DUAL_GROUND} />
        <path
          d="M52 69 L41 27 L45 36 L56 69 Z M156 69 L145 27 L149 36 L160 69 Z"
          fill={DUAL_SPIKE}
        />
        <circle cx="30" cy="62" r="9" fill={DUAL_RUNNER} />
        <circle cx="120" cy="40" r="9" fill={DUAL_RUNNER} />
        <line x1="90" y1="10" x2="90" y2="86" stroke="rgba(255,255,255,0.14)" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        One thumb per side - both runners have to clear their blocks.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: DualPuzzleData | null = puzzle.type === "dual" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<DualState>(dualGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof dualCheckpoint>[]>([]);
  const pending = useRef<number[]>([]);
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
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("dual", state.current, dualGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeDualRun({
      seed,
      claimedScore: dualGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = dualGame.init(seed);
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
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;

      if (!dualGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const side = pending.current.shift();
          const applied: ArcadeInputEvent | null =
            side === undefined
              ? null
              : { t: state.current.tick + 1, k: DUAL_INPUT_JUMP, a: side, b: 0, c: 0, d: 0 };
          recordInput(events.current, applied, dualGame.inputRanges);
          state.current = dualGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % DUAL_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(dualCheckpoint(state.current));
          }
          if (dualGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, dualGame.isOver(state.current));
      feedback(state.current, dualGame.isOver(state.current));

      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) dualGame.draw(context, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (dualGame.isOver(state.current) && !submitted.current) {
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
        style={{ background: DUAL_BG }}
        aria-label="Dual"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || dualGame.isOver(state.current)) return;
          const box = event.currentTarget.getBoundingClientRect();
          pending.current.push(event.clientX - box.left < box.width / 2 ? 0 : 1);
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "dual") return null;
  const result = replayDualRun(puzzle.seed, myAnswer ?? "");
  const side = result.crashedSide === 0 ? "left" : "right";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <svg viewBox="0 0 170 40" className="h-auto w-full max-w-[190px] shrink-0" aria-hidden="true">
        <rect x="4" y="30" width="72" height="4" fill={DUAL_GROUND} />
        <rect x="94" y="30" width="72" height="4" fill={DUAL_GROUND} />
        <path d="M58 30 L49 7 L52 13 L62 30 Z M148 30 L139 7 L142 13 L152 30 Z" fill={DUAL_SPIKE} />
        <circle cx="20" cy="24" r="7" fill={DUAL_RUNNER} />
        <circle cx="110" cy="14" r="7" fill={DUAL_RUNNER} />
      </svg>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.survived
          ? "Survived 60.0s"
          : `Survived ${result.endedSeconds.toFixed(1)}s (${side} crashed)`}{" "}
        · {result.passed} passed
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same course for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const dualPuzzle: PuzzleDefinition = {
  key: "dual",
  name: "Dual",
  category: "arcade",
  timeLimitMs: (DUAL_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "dual", seed: 1 }) satisfies DualPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
