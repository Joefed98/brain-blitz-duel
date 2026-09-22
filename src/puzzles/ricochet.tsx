import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  ricoCheckpoint,
  ricoGame,
  RICO_BALL,
  RICO_BG,
  RICO_CHECKPOINT_INTERVAL,
  RICO_RUN_TICKS,
  RICO_SPIKE,
  RICO_WALL,
  type RicoState,
} from "@/lib/arcade/ricochet";
import { decodeRicoRun, encodeRicoRun, replayRicoRun } from "@/lib/duel/ricochet";
import { ARCADE_CRASH_FREEZE_MS, type RicoPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the ball leaping from one wall to the other. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 140 120"
        width={140}
        height={120}
        aria-hidden="true"
        style={{ background: RICO_BG, borderRadius: 10 }}
      >
        <rect x="18" y="0" width="12" height="120" fill={RICO_WALL} />
        <rect x="110" y="0" width="12" height="120" fill={RICO_WALL} />
        <polygon points="30,60 44,67 30,74" fill={RICO_SPIKE} />
        <polygon points="110,24 96,31 110,38" fill={RICO_SPIKE} />
        <circle cx="102" cy="88" r="9" fill={RICO_BALL} />
        <path
          d="M102 88 C 80 74, 60 66, 40 58"
          stroke={RICO_BALL}
          strokeDasharray="4 4"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Each leap lands you higher — but never on a spike.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RicoPuzzleData | null = puzzle.type === "ricochet" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<RicoState>(ricoGame.init(seed));
  const inputs = useRef<number[]>([]);
  const checkpoints = useRef<ReturnType<typeof ricoCheckpoint>[]>([]);
  const pending = useRef(0);
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
    encodeRicoRun({
      seed,
      claimedScore: ricoGame.score(state.current),
      inputs: inputs.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = ricoGame.init(seed);
    inputs.current = [];
    checkpoints.current = [];
    pending.current = 0;
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

      if (!ricoGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const tapped = pending.current > 0;
          if (tapped) {
            pending.current -= 1;
            inputs.current.push(state.current.tick + 1);
          }
          state.current = ricoGame.step(state.current, tapped);
          if (state.current.tick % RICO_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(ricoCheckpoint(state.current));
          }
          if (ricoGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) ricoGame.draw(canvas.current!.getContext("2d")!, state.current, size);

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (ricoGame.isOver(state.current) && !submitted.current) {
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
        style={{ background: RICO_BG }}
        aria-label="Ricochet"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || ricoGame.isOver(state.current)) return;
          pending.current += 1;
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "ricochet") return null;
  const result = replayRicoRun(puzzle.seed, myAnswer ?? "");
  const leaps = decodeRicoRun(myAnswer ?? "").inputs.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <svg viewBox="0 0 120 60" className="h-auto w-full max-w-[150px] shrink-0" aria-hidden="true">
        <rect x="14" y="0" width="8" height="60" fill={RICO_WALL} />
        <rect x="98" y="0" width="8" height="60" fill={RICO_WALL} />
        <polygon points="22,34 32,39 22,44" fill={RICO_SPIKE} />
        <circle cx="94" cy="20" r="7" fill={RICO_BALL} />
      </svg>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.heightPx.toLocaleString("en-GB")} px ·{" "}
        {result.survived
          ? "survived"
          : result.spiked
            ? `hit a spike at ${result.endedSeconds.toFixed(1)}s`
            : `slid down at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {leaps} leap{leaps === 1 ? "" : "s"} · same shaft for everyone
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
export const ricochetPuzzle: PuzzleDefinition = {
  key: "ricochet",
  name: "Ricochet",
  category: "arcade",
  timeLimitMs: (RICO_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "ricochet", seed: 1 }) satisfies RicoPuzzleData,
  check: () => false,
  revealHeading: "Your climb",
  IntroExample,
  Stage,
  Reveal,
};
