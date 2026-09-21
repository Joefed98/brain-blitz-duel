import { useEffect, useRef, useState } from "react";

import {
  flickWindow,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
  type FlickSample,
} from "@/lib/arcade/engine";
import {
  bullseyeCheckpoint,
  bullseyeDrawAim,
  bullseyeFlick,
  bullseyeGame,
  bullseyeLanding,
  bullseyeScalePct,
  bullseyeTransform,
  BULLSEYE_ARROWS,
  BULLSEYE_BG,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_GOLD,
  BULLSEYE_CHECKPOINT_INTERVAL,
  BULLSEYE_OUTER_R,
  BULLSEYE_RING_COLOURS,
  BULLSEYE_RING_STEP,
  BULLSEYE_RINGS,
  BULLSEYE_RUN_TICKS,
  type BullseyeState,
} from "@/lib/arcade/bullseye";
import { decodeBullseyeRun, encodeBullseyeRun, replayBullseyeRun } from "@/lib/duel/bullseye";
import { ARCADE_CRASH_FREEZE_MS, type BullseyePuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the target, a wind arrow and a flick from the bow. */
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
            cy="46"
            r={ring * 6}
            fill={BULLSEYE_RING_COLOURS[ring - 1]}
            opacity={ring <= 2 ? 0.9 : 0.35}
            stroke="#0B0B0FB0"
          />
        ))}
        <g stroke={BULLSEYE_GOLD} strokeWidth="2">
          <line x1="52" y1="14" x2="28" y2="14" />
          <line x1="28" y1="14" x2="35" y2="9" />
          <line x1="28" y1="14" x2="35" y2="19" />
        </g>
        <text x="58" y="18" fill="#F7F7F8" fontSize="11" fontFamily="monospace">
          2
        </text>
        <g stroke="#F7F7F8A0" strokeWidth="2" fill="none">
          <path d="M84 104 A 16 16 0 0 1 112 104" />
        </g>
        <g stroke={BULLSEYE_GOLD} strokeWidth="2" fill="none">
          <line x1="98" y1="104" x2="98" y2="72" />
          <line x1="93" y1="80" x2="98" y2="70" />
          <line x1="103" y1="80" x2="98" y2="70" />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Flick to shoot — harder flicks land higher. Aim into the wind.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BullseyePuzzleData | null = puzzle.type === "bullseye" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<BullseyeState>(bullseyeGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof bullseyeCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  /** The live swipe, sampled so the shot comes from its last stretch. */
  const swipe = useRef<FlickSample[] | null>(null);
  /** Where a release right now would land. Render only. */
  const aim = useRef<{ x: number; y: number } | null>(null);
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
    swipe.current = null;
    aim.current = null;
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
        const context = canvas.current!.getContext("2d")!;
        bullseyeGame.draw(context, state.current, size);
        if (aim.current && state.current.flightTick === 0) {
          bullseyeDrawAim(context, size, aim.current);
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
      x: (event.clientX - box.left - offsetX) / divisor,
      y: (event.clientY - box.top - offsetY) / divisor,
    };
  };

  if (!data) return null;

  return (
    <div ref={wrap} className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: BULLSEYE_BG }}
        aria-label="Bullseye"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || bullseyeGame.isOver(state.current)) return;
          const point = worldPoint(event);
          swipe.current = [{ x: point.x, y: point.y, time: performance.now() }];
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const samples = swipe.current;
          if (!samples) return;
          const point = worldPoint(event);
          const now = performance.now();
          samples.push({ x: point.x, y: point.y, time: now });
          if (samples.length > 24) samples.splice(0, samples.length - 24);
          // Predict the release from the same window the release itself uses.
          const live = flickWindow(samples, now);
          const preview = live ? bullseyeFlick(live.dx, live.dy, live.dtMs) : null;
          aim.current = preview ? bullseyeLanding(preview.vx, preview.vy) : null;
        }}
        onPointerUp={(event) => {
          const samples = swipe.current;
          swipe.current = null;
          aim.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (!samples || locked || submitted.current) return;
          const point = worldPoint(event);
          const now = performance.now();
          samples.push({ x: point.x, y: point.y, time: now });
          const window = flickWindow(samples, now);
          if (!window) return;
          const launch = bullseyeFlick(window.dx, window.dy, window.dtMs);
          if (!launch) return;
          pending.current.push({ t: 0, k: 2, a: launch.vx, b: launch.vy, c: 0, d: 0 });
        }}
        onPointerCancel={(event) => {
          swipe.current = null;
          aim.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
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
