import { useGameKeys } from "@/lib/desktop";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordTap, tapAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  hoverGameFor,
  hoverCheckpoint,
  hoverFeatureTotals,
  hoverSurvived,
  HOVER_BG,
  HOVER_CRASH_COLOUR,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_DISC_COLOUR,
  HOVER_PILLAR_COLOUR,
  HOVER_REV_EXPAND,
  hoverWorldHFor,
  HOVER_RUN_TICKS,
  type HoverState,
  HOVER_WORLD_W,
} from "@/lib/arcade/hover";
import { decodeHoverRun, encodeHoverRun, replayHoverRun } from "@/lib/duel/hover";
import { HOVER_CRASH_FREEZE_MS, type HoverPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { hoverArtGame, hoverNightFill } from "@/lib/arcade/hover.renderer";
import { hoverSounds } from "@/lib/fx/gameSounds";
import { playSound } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

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
        <defs>
          <pattern id="hover-energy-blocks" width="20" height="8" patternUnits="userSpaceOnUse">
            <rect width="20" height="8" fill="#39114F" />
            <rect width="20" height="7" fill="#C642CE" />
            <path d="M2 2 H18" stroke="#F6ADFF" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="95" y="0" width="20" height="30" fill="url(#hover-energy-blocks)" />
        <rect x="95" y="78" width="20" height="32" fill="url(#hover-energy-blocks)" />
        <rect x="155" y="0" width="20" height="18" fill="url(#hover-energy-blocks)" />
        <rect x="155" y="44" width="20" height="26" fill="url(#hover-energy-blocks)" />
        <rect x="155" y="94" width="20" height="16" fill="url(#hover-energy-blocks)" />
        <path d="M95 29.5 H115 M95 78.5 H115 M155 17.5 H175 M155 69.5 H175" stroke="#F6ADFF" strokeWidth="1" />
        {/* hoverRev 8: the second barrier's lower gap is a gold-rimmed tight gate. */}
        <path d="M155 44 H175 M155 95 H175" stroke="#FFD84A" strokeWidth="3" />
        <path d="M105 37 L107 41 L111 41.5 L108 44 L109 48 L105 46 L101 48 L102 44 L99 41.5 L103 41 Z" fill="#FFD84A" />
        {/* A star chain on one flap's arc, and a shield bubble. */}
        {[[121, 64], [129, 55], [137, 51], [145, 55]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="2.6" fill="#FFD84A" />
        ))}
        <circle cx="30" cy="88" r="7" fill="none" stroke="#5CD0FF" strokeWidth="1.6" opacity="0.9" />
        <circle cx="55" cy="55" r="12.5" fill="none" stroke="#5CD0FF" strokeWidth="1.4" opacity="0.75" />
        <circle cx="55" cy="55" r="9" fill={HOVER_DISC_COLOUR} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Tap to lift the saucer through the gaps. Thread gold-rimmed tight gates and sweep star chains for a bonus; a shield bubble takes one crash.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HoverPuzzleData | null = puzzle.type === "hover" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const hoverGame = hoverGameFor(data?.hoverRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
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
  // Desktop keys: Space, ↑ or W flaps (a tap).
  useGameKeys((kind, key, event) => {
    if (![" ", "ArrowUp", "w"].includes(key)) return false;
    if (kind === "down" && !event.repeat && !lockedRef.current && !submitted.current && !hoverGame.isOver(state.current)) pending.current += 1;
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("hover", state.current, hoverGame.score(state.current)),
    );
  const encodeRaw = (): string =>
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
    const feedback = arcadeFeedback({ game: "hover" });
    const sounds = hoverSounds();
    // Dev-only tick-rate probe.
    let secondAt = last;
    let ticksThisSecond = 0;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frameTiming.begin(time);
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
          if (tapped) recordTap(inputs.current, state.current.tick + 1);
          // Played at the applied tap itself; a retrigger cuts the previous instance.
          if (tapped && !lockedRef.current) playSound("arc_hover_tap", 0.7);
          state.current = hoverGame.step(
            state.current,
            tapAt(inputs.current, state.current.tick + 1),
          );
          if (state.current.tick % HOVER_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(hoverCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (hoverGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, hoverGame.isOver(state.current));
      feedback(state.current, hoverGame.isOver(state.current));
      sounds.frame(state.current, !hoverGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvasContext();
      if (size && context) hoverArtGame.draw(context, state.current, size);

      frameTiming.rendered();

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
          } else if (time - crashedAt.current >= HOVER_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
          // The sim reached tick 3600: submit at once, whatever the clock says.
          finish();
        }
      }
      frameTiming.end();
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      sounds.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const canvasContext = () => canvas.current?.getContext("2d") ?? null;

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    // Capped at 2: a 3× buffer on a tall phone is over two million pixels a
    // frame and starves the sim loop.
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
    <ArcadeArenaSlot width={HOVER_WORLD_W} height={hoverWorldHFor(data.hoverRev)} scene={hoverNightFill}>
      <div ref={wrap} data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
        <canvas
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: "#000000" }}
          aria-label={gameDisplayName("hover")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || hoverGame.isOver(state.current)) return;
            pending.current += 1;
          }}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "hover") return null;
  const result = replayHoverRun(puzzle.seed, myAnswer ?? "", puzzle.hoverRev);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.gates} / {result.totalGates} barriers ·{" "}
        {result.survived ? "Survived" : `Crashed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      {result.totalStars > 0 && (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.stars} / {result.totalStars} gold stars
        </p>
      )}
      {result.state.xp ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.state.tight ?? 0} / {hoverFeatureTotals(result.state).tight} tight gates · {result.state.chainsDone ?? 0} / {hoverFeatureTotals(result.state).chains} star chains
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same course for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const hoverPuzzle: PuzzleDefinition = {
  key: "hover",
  name: gameDisplayName("hover"),
  category: "arcade",
  timeLimitMs: (HOVER_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "hover", seed: 1, hoverRev: HOVER_REV_EXPAND }) satisfies HoverPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
