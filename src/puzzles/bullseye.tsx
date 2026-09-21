import { useEffect, useRef, useState } from "react";

import {
  clampInt,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  bullseyeDrawAim,
  bullseyeCheckpoint,
  bullseyeGame,
  bullseyeScalePct,
  bullseyeTransform,
  BULLSEYE_ARROWS,
  BULLSEYE_BG,
  BULLSEYE_BOW_X,
  BULLSEYE_BOW_Y,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_GOLD,
  BULLSEYE_CHECKPOINT_INTERVAL,
  BULLSEYE_OUTER_R,
  BULLSEYE_RING_COLOURS,
  BULLSEYE_RING_STEP,
  BULLSEYE_RINGS,
  BULLSEYE_RUN_TICKS,
  BULLSEYE_WORLD_H,
  BULLSEYE_WORLD_W,
  type BullseyeState,
} from "@/lib/arcade/bullseye";
import { decodeBullseyeRun, encodeBullseyeRun, replayBullseyeRun } from "@/lib/duel/bullseye";
import { ARCADE_CRASH_FREEZE_MS, type BullseyePuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the target, a wind arrow and a reticle offset into it. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 195 110"
        width={195}
        height={110}
        aria-hidden="true"
        style={{ background: BULLSEYE_BG, borderRadius: 10 }}
      >
        {[6, 5, 4, 3, 2, 1].map((ring) => (
          <circle
            key={ring}
            cx="98"
            cy="62"
            r={ring * 7}
            fill={BULLSEYE_RING_COLOURS[ring - 1]}
            opacity={ring <= 2 ? 0.9 : 0.35}
            stroke="#0B0B0FB0"
          />
        ))}
        <g stroke={BULLSEYE_GOLD} strokeWidth="2">
          <line x1="60" y1="16" x2="36" y2="16" />
          <line x1="36" y1="16" x2="43" y2="11" />
          <line x1="36" y1="16" x2="43" y2="21" />
        </g>
        <text x="66" y="20" fill="#F7F7F8" fontSize="11" fontFamily="monospace">
          2
        </text>
        <g stroke={BULLSEYE_GOLD} strokeWidth="1.8" fill="none">
          <circle cx="118" cy="62" r="7" />
          <line x1="106" y1="62" x2="113" y2="62" />
          <line x1="123" y1="62" x2="130" y2="62" />
          <line x1="118" y1="50" x2="118" y2="57" />
          <line x1="118" y1="67" x2="118" y2="74" />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Flick up the screen to shoot — aim into the wind.
      </p>
    </div>
  );
}

interface FlickSample {
  x: number;
  y: number;
  time: number;
}

/** The movement window a flick is read from. */
const FLICK_WINDOW_MS = 120;
/** Slower than this (world px a tick) is not a shot. */
const FLICK_MIN_SPEED = 0.5;
/** World pixels of range per px-a-tick of flick. */
const FLICK_GAIN = 34;
const FLICK_MIN_RANGE = 30;
const FLICK_MAX_RANGE = 560;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BullseyePuzzleData | null = puzzle.type === "bullseye" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<BullseyeState>(bullseyeGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof bullseyeCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const drag = useRef<FlickSample[] | null>(null);
  const submitted = useRef(false);
  const endedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);


  // Callbacks and the lock live in refs so the loop is never torn down and
  // restarted mid-run, which would lose the accumulator and drop sim ticks.
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    encodeBullseyeRun({
      seed,
      claimedScore: bullseyeGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = bullseyeGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    drag.current = null;
    submitted.current = false;
    endedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
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

      if (!bullseyeGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        // Capped per frame; the time above the cap stays in the accumulator.
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A release between ticks applies on the next tick, logged as that
          // sim tick — never a wall-clock reading.
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          const before = state.current;
          state.current = bullseyeGame.step(state.current, applied);
          if (applied && state.current.arrowIndex > before.arrowIndex) {
            events.current.push(applied);
          }
          if (state.current.tick % BULLSEYE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(bullseyeCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (bullseyeGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) {
        const ctx = canvas.current?.getContext("2d");
        if (ctx) {
          bullseyeGame.draw(ctx, state.current, size);
          const samples = drag.current;
          const aim = samples ? flickReticle(samples, time) : null;
          if (aim && !bullseyeGame.isOver(state.current)) {
            bullseyeDrawAim(ctx, size, aim.x, aim.y);
          }
        }
      }


      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[bullseye] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${BULLSEYE_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (bullseyeGame.isOver(state.current) && !submitted.current) {
        if (endedAt.current === null) endedAt.current = time;
        else if (time - endedAt.current >= ARCADE_CRASH_FREEZE_MS) finish();
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
    // Capped at 2: a 3× buffer on a tall phone starves the sim loop.
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

  /** Canvas coordinates to world pixels, using the sim's own mapping. */
  const worldPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const { scale, offsetX, offsetY } = bullseyeTransform({
      width: box.width,
      height: box.height,
    });
    const divisor = Math.max(scale, 0.0001);
    return {
      x: clampInt(Math.round((event.clientX - box.left - offsetX) / divisor), 0, BULLSEYE_WORLD_W),
      y: clampInt(Math.round((event.clientY - box.top - offsetY) / divisor), 0, BULLSEYE_WORLD_H),
    };
  };

  const pushSample = (point: { x: number; y: number }, time: number) => {
    const samples = drag.current;
    if (!samples) return;
    drag.current = [...samples, { ...point, time }].filter(
      (sample, index, all) => time - sample.time <= FLICK_WINDOW_MS * 2 || index === all.length - 1,
    );
  };

  /**
   * The flick towards the target: its direction points the arrow and its speed
   * sets the range, so the reticle is where that shot would land. Render and
   * input only — the sim is handed the reticle, exactly as before.
   */
  const flickReticle = (
    samples: readonly FlickSample[],
    time: number,
  ): { x: number; y: number } | null => {
    const latest = samples[samples.length - 1];
    if (!latest) return null;
    let first = latest;
    for (const sample of samples) {
      if (time - sample.time <= FLICK_WINDOW_MS) {
        first = sample;
        break;
      }
    }
    const ticks = Math.max(1, (latest.time - first.time) / TICK_MS);
    const dx = (latest.x - first.x) / ticks;
    const dy = (latest.y - first.y) / ticks;
    const speed = Math.hypot(dx, dy);
    // Only a flick up the screen looses an arrow.
    if (speed < FLICK_MIN_SPEED || dy >= 0) return null;
    const range = Math.min(FLICK_MAX_RANGE, Math.max(FLICK_MIN_RANGE, speed * FLICK_GAIN));
    return {
      x: clampInt(Math.round(BULLSEYE_BOW_X + (dx / speed) * range), 0, BULLSEYE_WORLD_W),
      y: clampInt(Math.round(BULLSEYE_BOW_Y + (dy / speed) * range), 0, BULLSEYE_WORLD_H),
    };
  };


  if (!data) return null;

  return (
    <div ref={wrap} className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="block h-full w-full rounded-xl"
        style={{ touchAction: "none", background: BULLSEYE_BG }}
        aria-label="Bullseye"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || bullseyeGame.isOver(state.current)) return;
          const point = worldPoint(event);
          drag.current = [{ ...point, time: performance.now() }];
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          pushSample(worldPoint(event), performance.now());
        }}
        onPointerUp={(event) => {
          const now = performance.now();
          if (drag.current) pushSample(worldPoint(event), now);
          const samples = drag.current;
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (!samples || locked || submitted.current) return;
          const aim = flickReticle(samples, now);
          if (!aim) return;
          pending.current.push({ t: 0, k: 2, a: aim.x, b: aim.y, c: 0, d: 0 });
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}

      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bullseye") return null;
  const result = replayBullseyeRun(puzzle.seed, myAnswer ?? "");
  const shots = decodeBullseyeRun(myAnswer ?? "").events.length;
  const size = BULLSEYE_OUTER_R * 2 + 12;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full max-w-[180px] shrink-0"
        aria-hidden="true"
      >
        {Array.from({ length: BULLSEYE_RINGS }, (_, index) => BULLSEYE_RINGS - index).map(
          (ring) => (
            <circle
              key={ring}
              cx={size / 2}
              cy={size / 2}
              r={ring * BULLSEYE_RING_STEP}
              fill={BULLSEYE_RING_COLOURS[ring - 1]}
              opacity={ring <= 2 ? 0.9 : 0.3}
              stroke="#0B0B0FB0"
            />
          ),
        )}
        {result.hits.map((hit, index) => {
          // Each hit is shown where it fell relative to the target it hit, so
          // every arrow is comparable on one full-size ring set.
          const scale = bullseyeScalePct(hit.arrow);
          const x = size / 2 + ((hit.x - BULLSEYE_CX) * 100) / scale;
          const y = size / 2 + ((hit.y - BULLSEYE_CY) * 100) / scale;
          return <circle key={index} cx={x} cy={y} r={5} fill={BULLSEYE_GOLD} stroke="#0B0B0F" />;
        })}
      </svg>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.total} pts → {result.score}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {shots} of {BULLSEYE_ARROWS} arrows · {result.inner} in the gold/red
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
export const bullseyePuzzle: PuzzleDefinition = {
  key: "bullseye",
  name: "Bullseye",
  category: "arcade",
  timeLimitMs: (BULLSEYE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "bullseye", seed: 1 }) satisfies BullseyePuzzleData,
  check: () => false,
  revealHeading: "Your arrows",
  IntroExample,
  Stage,
  Reveal,
};
