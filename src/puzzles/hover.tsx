import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  hoverGame,
  hoverCheckpoint,
  hoverSurvived,
  HOVER_BG,
  HOVER_CRASH_COLOUR,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_DISC_COLOUR,
  HOVER_PILLAR_COLOUR,
  HOVER_RUN_TICKS,
  type HoverState,
} from "@/lib/arcade/hover";
import { decodeHoverRun, encodeHoverRun, replayHoverRun } from "@/lib/duel/hover";
import { HOVER_CRASH_FREEZE_MS, type HoverPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the disc and two pillars with a gap. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 195 110"
        width={195}
        height={110}
        aria-hidden="true"
        style={{ background: HOVER_BG, borderRadius: 10 }}
      >
        <rect x="95" y="0" width="20" height="30" fill={HOVER_PILLAR_COLOUR} />
        <rect x="95" y="78" width="20" height="32" fill={HOVER_PILLAR_COLOUR} />
        <rect x="155" y="0" width="20" height="46" fill={HOVER_PILLAR_COLOUR} />
        <rect x="155" y="90" width="20" height="20" fill={HOVER_PILLAR_COLOUR} />
        <circle cx="55" cy="55" r="9" fill={HOVER_DISC_COLOUR} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Tap to lift the disc through the gap.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HoverPuzzleData | null = puzzle.type === "hover" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<HoverState>(hoverGame.init(seed));
  const inputs = useRef<number[]>([]);
  const checkpoints = useRef<ReturnType<typeof hoverCheckpoint>[]>([]);
  const pending = useRef(0);
  const submitted = useRef(false);
  const crashedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);

  // Callbacks and the lock live in refs so the loop is never torn down and
  // restarted mid-run: a restart used to reset the accumulator and drop the
  // elapsed time with it, which is how the sim fell behind the wall clock.
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    encodeHoverRun({
      seed,
      claimedScore: hoverGame.score(state.current),
      inputs: inputs.current,
      // The tick the sim actually reached: the server ends the run here.
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  // One run per seed: a room update mid-round must not restart the sim.
  useEffect(() => {
    state.current = hoverGame.init(seed);
    inputs.current = [];
    checkpoints.current = [];
    pending.current = 0;
    submitted.current = false;
    crashedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    // Dev-only tick-rate probe.
    let secondAt = last;
    let ticksThisSecond = 0;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;

      if (!hoverGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        // Capped per frame, but the time above the cap stays in the accumulator
        // and is spent on the following frames.
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A tap between ticks applies on the next tick, logged as that sim
          // tick — never a wall-clock reading.
          const tapped = pending.current > 0;
          if (tapped) pending.current -= 1;
          if (tapped) inputs.current.push(state.current.tick + 1);
          state.current = hoverGame.step(state.current, tapped);
          if (state.current.tick % HOVER_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(hoverCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (hoverGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, hoverGame.isOver(state.current));

      const size = sizeCanvas();
      if (size) hoverGame.draw(canvasContext()!, state.current, size);

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[hover] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${HOVER_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      // Keep a draft on the server side twice a second, so a phase timeout
      // submits the taps and the tick reached so far.
      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (hoverGame.isOver(state.current) && !submitted.current) {
        if (state.current.crashed) {
          if (crashedAt.current === null) {
            crashedAt.current = time;
            buzz(40);
            playWrong();
          } else if (time - crashedAt.current >= HOVER_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
          // The sim reached tick 3600: submit at once, whatever the clock says.
          finish();
        }
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const canvasContext = () => canvas.current?.getContext("2d") ?? null;

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    // Capped at 2: a 3× buffer on a tall phone is over two million pixels a
    // frame and starves the sim loop.
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
    <div ref={wrap} className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: HOVER_BG }}
        aria-label="Hover"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || hoverGame.isOver(state.current)) return;
          pending.current += 1;
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "hover") return null;
  const result = replayHoverRun(puzzle.seed, myAnswer ?? "");
  const taps = decodeHoverRun(myAnswer ?? "").inputs.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex w-full max-w-[260px] shrink-0 flex-wrap justify-center gap-1">
        {Array.from({ length: Math.max(1, result.totalGates) }, (_, index) => (
          <span
            key={index}
            className="h-3 w-3 rounded-sm"
            style={{
              background:
                index < result.gates
                  ? HOVER_PILLAR_COLOUR
                  : result.survived
                    ? "transparent"
                    : HOVER_CRASH_COLOUR + "33",
              border: `1px solid ${HOVER_PILLAR_COLOUR}55`,
            }}
          />
        ))}
      </div>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.gates} / {result.totalGates} gates ·{" "}
        {result.survived ? "survived" : `crashed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {taps} tap{taps === 1 ? "" : "s"} · same course for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const hoverPuzzle: PuzzleDefinition = {
  key: "hover",
  name: "Hover",
  category: "arcade",
  timeLimitMs: (HOVER_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "hover", seed: 1 }) satisfies HoverPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
