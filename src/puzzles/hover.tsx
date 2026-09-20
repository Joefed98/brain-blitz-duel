import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  hoverGame,
  hoverSurvived,
  HOVER_BG,
  HOVER_CRASH_COLOUR,
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
  const pending = useRef(0);
  const submitted = useRef(false);
  const crashedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);

  // One run per seed: a room update mid-round must not restart the sim.
  useEffect(() => {
    state.current = hoverGame.init(seed);
    inputs.current = [];
    pending.current = 0;
    submitted.current = false;
    crashedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    let last = performance.now();
    let accumulator = 0;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      const run = {
        seed,
        claimedScore: hoverGame.score(state.current),
        inputs: inputs.current,
      };
      onSubmit(encodeHoverRun(run));
    };

    const render = () => {
      const size = sizeCanvas();
      if (size) hoverGame.draw(canvasContext()!, state.current, size);
    };

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;

      if (!hoverGame.isOver(state.current) && !locked) {
        accumulator += delta;
        // Whole ticks only, capped so a stall cannot run away with the sim.
        let ticks = Math.floor(accumulator / TICK_MS);
        accumulator -= ticks * TICK_MS;
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        for (let i = 0; i < ticks; i++) {
          // A tap between ticks applies on the next tick.
          const tapped = pending.current > 0;
          if (tapped) pending.current -= 1;
          const next = state.current.tick + 1;
          if (tapped) inputs.current.push(next);
          state.current = hoverGame.step(state.current, tapped);
          if (hoverGame.isOver(state.current)) break;
        }
      }

      render();

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
          finish();
        }
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [data, seed, locked, onSubmit]);

  useEffect(() => {
    onDraftAnswer?.(
      encodeHoverRun({
        seed,
        claimedScore: hoverGame.score(state.current),
        inputs: inputs.current,
      }),
    );
  }, [onDraftAnswer, seed]);

  const canvasContext = () => canvas.current?.getContext("2d") ?? null;

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
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
        className="block h-full w-full rounded-xl"
        style={{ touchAction: "none", background: HOVER_BG }}
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
  category: "speed",
  timeLimitMs: (HOVER_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "hover", seed: 1 }) satisfies HoverPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
