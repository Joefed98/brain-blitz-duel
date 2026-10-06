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
  skylineCheckpoint,
  skylineGame,
  SKYLINE_BG,
  SKYLINE_CHECKPOINT_INTERVAL,
  SKYLINE_COLOURS,
  SKYLINE_FLASH,
  SKYLINE_RUN_TICKS,
  type SkylineState,
} from "@/lib/arcade/skyline";
import { decodeSkylineRun, encodeSkylineRun, replaySkylineRun } from "@/lib/duel/skyline";
import { ARCADE_CRASH_FREEZE_MS, type SkylinePuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { drawSkylineArt, SKYLINE_ART_BG } from "@/lib/arcade/skyline.renderer";
import { skylineSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a three-block tower with one overhang. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 195 110"
        width={195}
        height={110}
        aria-hidden="true"
        style={{ background: SKYLINE_BG, borderRadius: 10 }}
      >
        <rect x="55" y="86" width="85" height="20" fill={SKYLINE_COLOURS[0]} />
        <rect x="62" y="64" width="78" height="20" fill={SKYLINE_COLOURS[1]} />
        <rect x="76" y="42" width="78" height="20" fill={SKYLINE_COLOURS[2]} />
        <rect x="140" y="42" width="14" height="20" fill={SKYLINE_FLASH} opacity="0.35" />
        <rect x="30" y="14" width="64" height="20" fill={SKYLINE_COLOURS[3]} opacity="0.8" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        The part hanging over the edge is cut away.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SkylinePuzzleData | null = puzzle.type === "skyline" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<SkylineState>(skylineGame.init(seed));
  const inputs = useRef<number[]>([]);
  const checkpoints = useRef<ReturnType<typeof skylineCheckpoint>[]>([]);
  const pending = useRef(0);
  const submitted = useRef(false);
  const missedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("skyline", state.current, skylineGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeSkylineRun({
      seed,
      claimedScore: skylineGame.score(state.current),
      inputs: inputs.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = skylineGame.init(seed);
    inputs.current = [];
    checkpoints.current = [];
    pending.current = 0;
    submitted.current = false;
    missedAt.current = null;
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
    const sounds = skylineSounds();
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

      if (!skylineGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const tapped = pending.current > 0;
          if (tapped) {
            pending.current -= 1;
            recordTap(inputs.current, state.current.tick + 1);
          }
          state.current = skylineGame.step(
            state.current,
            tapAt(inputs.current, state.current.tick + 1),
          );
          if (state.current.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(skylineCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (skylineGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, skylineGame.isOver(state.current));
      feedback(state.current, skylineGame.isOver(state.current));
      sounds.frame(state.current, !skylineGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) drawSkylineArt(context, state.current, size);

      frameTiming.rendered();

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[skyline] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${SKYLINE_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (skylineGame.isOver(state.current) && !submitted.current) {
        if (state.current.missed) {
          if (missedAt.current === null) {
            missedAt.current = time;
            buzz(40);
          } else if (time - missedAt.current >= ARCADE_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
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
    <div ref={wrap} data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: SKYLINE_ART_BG }}
        aria-label="Skyline"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || skylineGame.isOver(state.current)) return;
          pending.current += 1;
        }}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "skyline") return null;
  const result = replaySkylineRun(puzzle.seed, myAnswer ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex w-full max-w-[200px] shrink-0 flex-col-reverse items-center gap-[2px]">
        {result.state.blocks.slice(-14).map((block, index) => (
          <span
            key={index}
            className="h-2 rounded-sm"
            style={{
              width: `${Math.max(6, Math.round((block.w / 51_200) * 160))}px`,
              background: SKYLINE_COLOURS[index % SKYLINE_COLOURS.length],
            }}
          />
        ))}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.blocks} blocks · {result.perfects} perfect ·{" "}
        {result.survived ? "survived" : `missed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same tower for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const skylinePuzzle: PuzzleDefinition = {
  key: "skyline",
  name: "Skyline",
  category: "arcade",
  timeLimitMs: (SKYLINE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "skyline", seed: 1 }) satisfies SkylinePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
