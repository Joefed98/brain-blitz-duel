import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
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
  binTossCheckpoint,
  binTossCentreAt,
  binTossDrag,
  binTossDrawGhost,

  binTossGameFor,
  binTossTransform,
  BINTOSS_AIM,
  BINTOSS_BALL_COLOUR,
  BINTOSS_BG,
  BINTOSS_BIN_COLOUR,
  BINTOSS_CHECKPOINT_INTERVAL,
  BINTOSS_MISS_COLOUR,
  BINTOSS_RUN_TICKS,
  BINTOSS_THROWS,
  BINTOSS_WAIT,
  BINTOSS_WORLD_H,
  BINTOSS_WORLD_W,
  type BinTossState,
  type BinTossGhost,
  type BinTossLandingPresentation,
} from "@/lib/arcade/binToss";
import { decodeBinTossRun, encodeBinTossRun, replayBinTossRun } from "@/lib/duel/binToss";
import { ARCADE_CRASH_FREEZE_MS, type BinTossPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playWrong } from "@/lib/sound";
import { binTossArenaScene, binTossArtGame, binTossArtLanding, binTossArtAim as binTossDrawAim } from "@/lib/arcade/binTossArt.renderer";
import { useFairSceneKey } from "@/components/puzzles/useFairSceneKey";
import { binTossSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

/** Fixed intro still: the ball, the bucket, the bonus hoop, the wind arrow and a flick gesture. */
function IntroExample() {
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
        <g stroke="#F5B82E99" strokeWidth="2" fill="none">
          <line x1="30" y1="86" x2="62" y2="46" />
          <line x1="62" y1="46" x2="54" y2="50" />
          <line x1="62" y1="46" x2="60" y2="56" />
        </g>
        <path
          d="M142 62 L145 92 L171 92 L174 62"
          fill="none"
          stroke={BINTOSS_BIN_COLOUR}
          strokeWidth="2.5"
        />
        <ellipse cx="158" cy="62" rx="16" ry="3" fill="none" stroke={BINTOSS_BIN_COLOUR} />
        <ellipse cx="152" cy="34" rx="10" ry="2.5" fill="none" stroke="#E8384F" strokeWidth="1.6" />
        <circle cx="142" cy="34" r="1.8" fill="#F5B82E" />
        <circle cx="162" cy="34" r="1.8" fill="#F5B82E" />
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
        Touch and drag to aim - the dotted path shows where it will go.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BinTossPuzzleData | null = puzzle.type === "bintoss" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const fairSceneKey = useFairSceneKey();
  const binTossGame = binTossGameFor(data?.binRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const arenaBox = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const cancelZone = useRef<HTMLDivElement | null>(null);
  const state = useRef<BinTossState>(binTossGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof binTossCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const activeLaunch = useRef<BinTossGhost | null>(null);
  const lastGhost = useRef<BinTossGhost | null>(null);
  /** Where the finger went down; the aim vector is measured from here. */
  const anchor = useRef<{ x: number; y: number } | null>(null);
  /** The arc a release right now would produce. Render only. */
  const aim = useRef<BinTossGhost | null>(null);
  const cancelActive = useRef(false);
  const [cancelHighlighted, setCancelHighlighted] = useState(false);
  const landing = useRef<(BinTossLandingPresentation & { startedAt: number; tick: number }) | null>(null);
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
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("bintoss", state.current, binTossGame.score(state.current)),
    );
  const encodeRaw = (): string =>
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
    activeLaunch.current = null;
    lastGhost.current = null;
    anchor.current = null;
    aim.current = null;
    cancelActive.current = false;
    setCancelHighlighted(false);
    landing.current = null;
    submitted.current = false;
    endedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "bintoss" });
    const sounds = binTossSounds();
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
          recordInput(events.current, applied, binTossGame.inputRanges);
          state.current = binTossGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (before.phase !== state.current.phase && state.current.phase === BINTOSS_WAIT) {
            lastGhost.current = activeLaunch.current;
            activeLaunch.current = null;
            if (state.current.results[state.current.results.length - 1] === 1) {
              landing.current = {
                startedAt: time,
                progress: 0,
                binCentre: binTossCentreAt(before, before.throwIndex, state.current.tick),
                binIndex: before.throwIndex,
                rev: before.rev,
                tick: state.current.tick,
              };
            }
          }
          if (state.current.tick % BINTOSS_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(binTossCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (binTossGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, binTossGame.isOver(state.current));
      feedback(state.current, binTossGame.isOver(state.current));
      sounds.frame(state.current, !binTossGame.isOver(state.current));

      frameTiming.draw();
      const size = sizeCanvas();
      if (size) {
        const context = canvas.current?.getContext("2d");
        if (context) {
          const activeLanding = landing.current;
          if (activeLanding) {
            activeLanding.progress = Math.min(1, (time - activeLanding.startedAt) / 350);
            if (activeLanding.progress >= 1) landing.current = null;
          }
          const hideNewBasket = activeLanding && activeLanding.progress < 1;
          binTossArtGame.draw(
            context,
            hideNewBasket
              ? {
                  ...state.current,
                  baskets: Math.max(0, state.current.baskets - 1),
                  throwIndex: activeLanding.binIndex,
                  tick: activeLanding.tick,
                  x: -100_000,
                }
              : state.current,
            size,
          );
          if (lastGhost.current) binTossDrawGhost(context, size, lastGhost.current);
          if (aim.current && state.current.phase === BINTOSS_AIM) {
            binTossDrawAim(context, size, aim.current, cancelActive.current);
          }
          if (activeLanding) binTossArtLanding(context, size, activeLanding);
        }
      }

      frameTiming.rendered();

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
      frameTiming.end();
    };

    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); sounds.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = arenaBox.current?.getBoundingClientRect();
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

  const inCancelZone = (clientY: number): boolean => {
    const box = cancelZone.current?.getBoundingClientRect();
    return Boolean(box && clientY >= box.top && clientY <= box.bottom);
  };

  const setCancelled = (cancelled: boolean) => {
    cancelActive.current = cancelled;
    setCancelHighlighted((current) => (current === cancelled ? current : cancelled));
  };

  if (!data) return null;

  return (
    <div
      ref={wrap}
      className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
    >
      <ArcadeArenaSlot width={BINTOSS_WORLD_W} height={BINTOSS_WORLD_H} scene={binTossArenaScene} sceneKey={fairSceneKey}>
      <div ref={arenaBox} data-game-arena="canvas" className="relative overflow-hidden">
      <canvas
        ref={canvas}
        className="puzzle-board block h-full w-full"
        style={{ background: BINTOSS_BG }}
        aria-label={gameDisplayName("bintoss")}
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || binTossGame.isOver(state.current)) return;
          if (state.current.phase !== BINTOSS_AIM) return;
          // The anchor is wherever the finger went down; the pointer is captured
          // so the drag stays alive wherever the finger travels.
          anchor.current = worldPoint(event);
          aim.current = null;
          setCancelled(false);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = anchor.current;
          if (!start) return;
          const point = worldPoint(event);
          setCancelled(inCancelZone(event.clientY));
          // The aim is the drag vector itself, so the path holds still when the
          // finger does.
          const preview = binTossDrag(point.x - start.x, point.y - start.y);
          aim.current = preview
            ? {
                vx: preview.vx,
                vy: preview.vy,
                wind: state.current.winds[state.current.throwIndex] ?? 0,
              }
            : null;
        }}
        onPointerUp={(event) => {
          const start = anchor.current;
          const cancelled = inCancelZone(event.clientY);
          anchor.current = null;
          aim.current = null;
          setCancelled(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (!start || locked || submitted.current || cancelled) return;
          if (state.current.phase !== BINTOSS_AIM) return;
          const point = worldPoint(event);
          const launch = binTossDrag(point.x - start.x, point.y - start.y);
          if (!launch) return;
          lastGhost.current = null;
          activeLaunch.current = {
            vx: launch.vx,
            vy: launch.vy,
            wind: state.current.winds[state.current.throwIndex] ?? 0,
            index: state.current.throwIndex,
            rev: state.current.rev,
          };
          pending.current.push({ t: 0, k: 1, a: launch.vx, b: launch.vy, c: 0, d: 0 });
        }}
        onPointerCancel={(event) => {
          anchor.current = null;
          aim.current = null;
          setCancelled(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
      </div>
      </ArcadeArenaSlot>
      <div
        ref={cancelZone}
        data-game-controls="cancel"
        // 17 Oct 2026 (display only): the "drag here to cancel" box is gone; its 72px strip still cancels a
        // throw dragged into it (the aim turns to its cancel look), over the fairground scene behind it.
        aria-label="Drag here to cancel"
        data-cancel-active={cancelHighlighted ? "" : undefined}
        className="h-[72px] shrink-0"
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bintoss") return null;
  const result = replayBinTossRun(puzzle.seed, myAnswer ?? "", puzzle.binRev);
  const throws = decodeBinTossRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 justify-center gap-1.5">
        {Array.from({ length: BINTOSS_THROWS }, (_, index) => {
          const scored = result.results[index];
          return (
            <span
              key={index}
              className="font-mono text-base font-bold"
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
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.baskets} / {result.throws} in the bucket
      </p>
      {result.hoops > 0 ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.swishes} / {result.hoops} hoop bonuses
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {throws} throw{throws === 1 ? "" : "s"} taken · same winds for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const binTossPuzzle: PuzzleDefinition = {
  key: "bintoss",
  name: gameDisplayName("bintoss"),
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
