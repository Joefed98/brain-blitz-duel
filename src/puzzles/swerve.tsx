import { useGameKeys, horizontalOf } from "@/lib/desktop";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  swerveCheckpoint,
  swerveGame,
  SWERVE_BG,
  SWERVE_BLOCK_COLOUR,
  SWERVE_CHECKPOINT_INTERVAL,
  SWERVE_CHEV_COLOUR,
  SWERVE_COIN_COLOUR,
  SWERVE_CRASH_COLOUR,
  SWERVE_RUN_TICKS,
  type SwerveInput,
  type SwerveState,
} from "@/lib/arcade/swerve";
import {
  decodeSwerveRun,
  encodeSwerveRun,
  replaySwerveRun,
  type SwerveTap,
} from "@/lib/duel/swerve";
import { ARCADE_CRASH_FREEZE_MS, type SwervePuzzleData } from "@/lib/duel/types";
import { haptic } from "@/lib/haptics";
import { playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

/** Fixed intro still: five lanes, two blocks, one coin and the chevron. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 195 110"
        width={195}
        height={110}
        aria-hidden="true"
        style={{ background: SWERVE_BG, borderRadius: 10 }}
      >
        {[39, 78, 117, 156].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="110" stroke="#F7F7F822" />
        ))}
        <rect x="40" y="18" width="37" height="20" fill={SWERVE_BLOCK_COLOUR} />
        <rect x="118" y="18" width="37" height="20" fill={SWERVE_BLOCK_COLOUR} />
        <circle cx="97" cy="28" r="6" fill={SWERVE_COIN_COLOUR} />
        <polygon points="58,80 68,94 58,90 48,94" fill={SWERVE_CHEV_COLOUR} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Tap the right side to swerve into the coin lane.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SwervePuzzleData | null = puzzle.type === "swerve" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<SwerveState>(swerveGame.init(seed));
  const taps = useRef<SwerveTap[]>([]);
  const checkpoints = useRef<ReturnType<typeof swerveCheckpoint>[]>([]);
  const pending = useRef<SwerveInput[]>([]);
  const submitted = useRef(false);
  const crashedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);

  // Callbacks and the lock live in refs so the loop is never torn down and
  // restarted mid-run, which would lose the accumulator and drop sim ticks.
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: ←/→ (A/D) tap the left or right half.
  useGameKeys((kind, key, event) => {
    const open = () => !lockedRef.current && !submitted.current && !swerveGame.isOver(state.current);
    const side = horizontalOf(key);
    if (side === null) return false;
    if (kind === "down" && !event.repeat && open()) pending.current.push(side);
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("swerve", state.current, swerveGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeSwerveRun({
      seed,
      claimedScore: swerveGame.score(state.current),
      taps: taps.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = swerveGame.init(seed);
    taps.current = [];
    checkpoints.current = [];
    pending.current = [];
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
    const feedback = arcadeFeedback();
    let secondAt = last;
    let ticksThisSecond = 0;

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

      if (!swerveGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        // Capped per frame; the time above the cap stays in the accumulator.
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A tap between ticks applies on the next tick, logged as that sim
          // tick — never a wall-clock reading.
          const queued = pending.current.shift() ?? 0;
          const lastTap = taps.current[taps.current.length - 1];
          if (queued !== 0 && (!lastTap || lastTap.tick < state.current.tick + 1)) {
            taps.current.push({ tick: state.current.tick + 1, dir: queued });
          }
          // The sim reads its move from the recorded log only.
          const logged = taps.current[taps.current.length - 1];
          const move = logged && logged.tick === state.current.tick + 1 ? logged.dir : 0;
          state.current = swerveGame.step(state.current, move);
          if (state.current.tick % SWERVE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(swerveCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (swerveGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, swerveGame.isOver(state.current));
      feedback(state.current, swerveGame.isOver(state.current));

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) swerveGame.draw(context, state.current, size);

      frameTiming.rendered();

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[swerve] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${SWERVE_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (swerveGame.isOver(state.current) && !submitted.current) {
        if (state.current.crashed) {
          if (crashedAt.current === null) {
            crashedAt.current = time;
            // Haptics (lib/haptics.ts): a crash (this retired game has no sound observer to carry it).
            haptic("impact", { inGame: true });
            playWrong();
          } else if (time - crashedAt.current >= ARCADE_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
          finish();
        }
      }
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
    // Capped at 2: a 3× buffer on a tall phone starves the sim loop.
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

  if (!data) return null;

  return (
    <div ref={wrap} className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: SWERVE_BG }}
        aria-label="Swerve"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || swerveGame.isOver(state.current)) return;
          const box = event.currentTarget.getBoundingClientRect();
          const left = event.clientX - box.left < box.width / 2;
          pending.current.push(left ? -1 : 1);
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "swerve") return null;
  const result = replaySwerveRun(puzzle.seed, myAnswer ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.coins} / {result.totalCoins} coins ·{" "}
        {result.survived ? "Survived" : `Crashed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same course for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const swervePuzzle: PuzzleDefinition = {
  key: "swerve",
  name: "Swerve",
  category: "arcade",
  timeLimitMs: (SWERVE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "swerve", seed: 1 }) satisfies SwervePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
