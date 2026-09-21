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
  binTossCheckpoint,
  binTossDrawAim,
  binTossGame,
  binTossTransform,
  BINTOSS_AIM,
  BINTOSS_BALL_COLOUR,
  BINTOSS_BALL_R,
  BINTOSS_BG,
  BINTOSS_BIN_COLOUR,
  BINTOSS_CHECKPOINT_INTERVAL,
  BINTOSS_MISS_COLOUR,
  BINTOSS_RUN_TICKS,
  BINTOSS_THROWS,
  BINTOSS_VX_MAX,
  BINTOSS_VY_MAX,
  type BinTossState,
} from "@/lib/arcade/binToss";
import { decodeBinTossRun, encodeBinTossRun, replayBinTossRun } from "@/lib/duel/binToss";
import { ARCADE_CRASH_FREEZE_MS, type BinTossPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the ball, the bin, the wind arrow and a dotted arc. */
function IntroExample() {
  const dots = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    return { x: 24 + t * 130, y: 84 - 120 * t * (1 - t) - 6 * t };
  });
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 195 110"
        width={195}
        height={110}
        aria-hidden="true"
        style={{ background: BINTOSS_BG, borderRadius: 10 }}
      >
        <line x1="0" y1="92" x2="195" y2="92" stroke="#F7F7F828" strokeWidth="2" />
        <circle cx="24" cy="84" r="6" fill={BINTOSS_BALL_COLOUR} />
        {dots.map((dot, index) => (
          <circle key={index} cx={dot.x} cy={dot.y} r="1.6" fill="#F5B82E77" />
        ))}
        <path
          d="M142 62 L145 92 L171 92 L174 62"
          fill="none"
          stroke={BINTOSS_BIN_COLOUR}
          strokeWidth="2.5"
        />
        <ellipse cx="158" cy="62" rx="16" ry="3" fill="none" stroke={BINTOSS_BIN_COLOUR} />
        <g stroke={BINTOSS_BIN_COLOUR} strokeWidth="2">
          <line x1="96" y1="22" x2="72" y2="22" />
          <line x1="72" y1="22" x2="79" y2="17" />
          <line x1="72" y1="22" x2="79" y2="27" />
        </g>
        <text x="104" y="26" fill="#F7F7F8" fontSize="11" fontFamily="monospace">
          3
        </text>
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        The dotted arc ignores the wind — judge the wind yourself.
      </p>
    </div>
  );
}

interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  startTime: number;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BinTossPuzzleData | null = puzzle.type === "bintoss" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<BinTossState>(binTossGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof binTossCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const drag = useRef<DragState | null>(null);
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
    encodeBinTossRun({
      seed,
      claimedScore: binTossGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = binTossGame.init(seed);
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

      if (!binTossGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        // Capped per frame; the time above the cap stays in the accumulator.
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A flick between ticks applies on the next tick, logged as that sim
          // tick — never a wall-clock reading.
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          const before = state.current;
          state.current = binTossGame.step(state.current, applied);
          // Logged only when the flick actually launched a ball.
          if (applied && before.phase === BINTOSS_AIM && state.current.phase !== BINTOSS_AIM) {
            events.current.push(applied);
          }
          if (state.current.tick % BINTOSS_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(binTossCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (binTossGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) {
        const ctx = canvas.current!.getContext("2d")!;
        binTossGame.draw(ctx, state.current, size);
        const current = drag.current;
        if (current && state.current.phase === BINTOSS_AIM) {
          const velocity = flickVelocity(current);
          binTossDrawAim(ctx, state.current, size, velocity.vx, velocity.vy);
        }
      }

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[bintoss] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${BINTOSS_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (binTossGame.isOver(state.current) && !submitted.current) {
        if (endedAt.current === null) {
          endedAt.current = time;
          if (state.current.baskets < BINTOSS_THROWS) {
            buzz(20);
            playWrong();
          }
        } else if (time - endedAt.current >= ARCADE_CRASH_FREEZE_MS) {
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

  /**
   * A touchscreen flick: the ball flies the way the finger travelled, and the
   * longer the flick the harder the throw. Fixed divisor, so the dotted preview
   * matches the throw exactly.
   */
  const flickVelocity = (current: DragState): { vx: number; vy: number } => {
    const ticks = 24;
    const vx = Math.round(((current.x - current.startX) * 256) / ticks);
    const vy = Math.round(((current.y - current.startY) * 256) / ticks);
    return {
      vx: clampInt(vx, -BINTOSS_VX_MAX, BINTOSS_VX_MAX),
      vy: clampInt(vy, -BINTOSS_VY_MAX, 0),
    };
  };

  /** Canvas coordinates to world pixels, using the sim's own mapping. */
  const worldPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const { scale, offsetX, offsetY } = binTossTransform({
      width: box.width,
      height: box.height,
    });
    return {
      x: (event.clientX - box.left - offsetX) / Math.max(scale, 0.0001),
      y: (event.clientY - box.top - offsetY) / Math.max(scale, 0.0001),
    };
  };

  if (!data) return null;

  return (
    <div ref={wrap} className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="block h-full w-full rounded-xl"
        style={{ touchAction: "none", background: BINTOSS_BG }}
        aria-label="Bin Toss"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || binTossGame.isOver(state.current)) return;
          if (state.current.phase !== BINTOSS_AIM) return;
          // Flick anywhere on the canvas — no need to find the ball first.
          const point = worldPoint(event);
          drag.current = {
            startX: point.x,
            startY: point.y,
            x: point.x,
            y: point.y,
            startTime: performance.now(),
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const point = worldPoint(event);
          drag.current = { ...drag.current, x: point.x, y: point.y };
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (!current || locked || submitted.current) return;
          if (state.current.phase !== BINTOSS_AIM) return;
          const { vx, vy } = flickVelocity(current);
          if (vy === 0 && vx === 0) return;
          pending.current.push({ t: 0, k: 1, a: vx, b: vy, c: 0, d: 0 });
        }}
        onPointerCancel={(event) => {
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bintoss") return null;
  const result = replayBinTossRun(puzzle.seed, myAnswer ?? "");
  const throws = decodeBinTossRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex shrink-0 justify-center gap-1.5">
        {Array.from({ length: BINTOSS_THROWS }, (_, index) => {
          const scored = result.results[index];
          return (
            <span
              key={index}
              className="font-mono text-sm font-bold"
              style={{
                color:
                  scored === true
                    ? BINTOSS_BALL_COLOUR
                    : scored === false
                      ? BINTOSS_MISS_COLOUR
                      : "#F7F7F844",
              }}
            >
              {scored === true ? "✓" : scored === false ? "✕" : "·"}
            </span>
          );
        })}
      </div>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.baskets} / {result.throws} in
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {throws} throw{throws === 1 ? "" : "s"} taken · same winds for everyone
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
export const binTossPuzzle: PuzzleDefinition = {
  key: "bintoss",
  name: "Bin Toss",
  category: "arcade",
  timeLimitMs: (BINTOSS_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "bintoss", seed: 1 }) satisfies BinTossPuzzleData,
  check: () => false,
  revealHeading: "Your throws",
  IntroExample,
  Stage,
  Reveal,
};
