import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { ARCADE_ARENA_FILL } from "@/lib/arcade/arenaFill.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { beatLaneAt } from "@/components/puzzles/tapMapping";
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
  beatCheckpoint,
  beatGameFor,
  BEAT_INPUT_SWIPE,
  BEAT_EIGHTH_TICKS,
  BEAT_BG,
  BEAT_CHECKPOINT_INTERVAL,
  BEAT_FIRST_BEAT,
  BEAT_GOLD,
  BEAT_INPUT_RELEASE,
  BEAT_INPUT_TAP,
  BEAT_LANE_COLOURS,
  BEAT_RUN_TICKS,
  BEAT_WORLD_H,
  BEAT_WORLD_W,
  type BeatState,
} from "@/lib/arcade/beat";
import { decodeBeatRun, encodeBeatRun, replayBeatRun } from "@/lib/duel/beat";
import type { BeatPuzzleData } from "@/lib/duel/types";
import { playBeatStep } from "@/lib/sound";
import { beatArtGame } from "@/lib/arcade/beat.renderer";
import { beatSounds } from "@/lib/fx/gameSounds";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a note arriving at the hit line. */
/** Rev 2: the sideways finger travel (screen px) that counts as a swipe. */
const SWIPE_MIN_PX = 24;

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: BEAT_BG, borderRadius: 10 }}
      >
        {[0, 1, 2, 3].map((lane) => (
          <rect
            key={lane}
            x={12 + lane * 36}
            y={6}
            width={32}
            height={108}
            fill="rgba(255,255,255,0.04)"
            rx={4}
          />
        ))}
        <line x1={8} y1={92} x2={160} y2={92} stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
        <rect x={48} y={86} width={32} height={12} rx={4} fill={BEAT_LANE_COLOURS[1]} />
        <rect x={120} y={40} width={32} height={12} rx={4} fill={BEAT_LANE_COLOURS[3]} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Tap the lane as its note meets the line; arrow notes are swipes.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BeatPuzzleData | null = puzzle.type === "beat" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const beatGame = beatGameFor(data?.beatRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<BeatState>(beatGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof beatCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  /** Which lane each finger went down in, so its release is sent for that lane. */
  const fingers = useRef(new Map<number, number>());
  /** Rev 2: where each finger went down (screen px) and whether it has already swiped. */
  const swipeStarts = useRef(new Map<number, { x: number; done: boolean }>());
  const submitted = useRef(false);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("beat", state.current, beatGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeBeatRun({
      seed,
      claimedScore: beatGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = beatGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    submitted.current = false;
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
    const sounds = beatSounds();

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

      if (!beatGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A tap between ticks applies on the next sim tick, logged as that tick.
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          recordInput(events.current, applied, beatGame.inputRanges);
          state.current = beatGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % BEAT_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(beatCheckpoint(state.current));
          }
          // Sound is feedback only: a synthesised bass + hat loop, never required to play.
          if (
            state.current.tick >= BEAT_FIRST_BEAT &&
            (state.current.tick - BEAT_FIRST_BEAT) % BEAT_EIGHTH_TICKS === 0
          ) {
            playBeatStep((state.current.tick - BEAT_FIRST_BEAT) / BEAT_EIGHTH_TICKS);
          }
          if (beatGame.isOver(state.current)) break;
        }
      }


      reportArcadeTick(state.current.tick, beatGame.isOver(state.current));
      feedback(state.current, beatGame.isOver(state.current));
      sounds.frame(state.current, !beatGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) beatArtGame.draw(context, state.current, size);

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (beatGame.isOver(state.current) && !submitted.current) finish();
      frameTiming.end();
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      sounds.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

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

  /** Which lane the finger is in, from the sim's own mapping. */
  const laneAt = (event: React.PointerEvent<HTMLCanvasElement>): number => {
    return beatLaneAt(event.currentTarget.getBoundingClientRect(), event.clientX);
  };

  const liftFinger = (pointerId: number) => {
    const lane = fingers.current.get(pointerId);
    fingers.current.delete(pointerId);
    swipeStarts.current.delete(pointerId);
    if (lane === undefined || submitted.current) return;
    pending.current.push({ t: 0, k: BEAT_INPUT_RELEASE, a: lane, b: 0, c: 0, d: 0 });
  };

  if (!data) return null;

  return (
    <ArcadeArenaSlot width={BEAT_WORLD_W} height={BEAT_WORLD_H} background={ARCADE_ARENA_FILL.beat}>
      <div
        ref={wrap}
        data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
        style={NO_SCROLL_STYLE}
      >
        <canvas
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ ...NO_SCROLL_STYLE, background: BEAT_BG }}
          aria-label={gameDisplayName("beat")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || beatGame.isOver(state.current)) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const lane = laneAt(event);
            fingers.current.set(event.pointerId, lane);
            swipeStarts.current.set(event.pointerId, { x: event.clientX, done: false });
            pending.current.push({ t: 0, k: BEAT_INPUT_TAP, a: lane, b: 0, c: 0, d: 0 });
          }}
          onPointerMove={(event) => {
            // Rev 2: a sideways flick of at least 24 px is one swipe, in the lane the finger went down in.
            if (!data?.beatRev) return;
            const start = swipeStarts.current.get(event.pointerId);
            const lane = fingers.current.get(event.pointerId);
            if (!start || start.done || lane === undefined || submitted.current) return;
            const dx = event.clientX - start.x;
            if (Math.abs(dx) < SWIPE_MIN_PX) return;
            start.done = true;
            pending.current.push({ t: 0, k: BEAT_INPUT_SWIPE, a: lane, b: dx > 0 ? 1 : 0, c: 0, d: 0 });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            liftFinger(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            liftFinger(event.pointerId);
          }}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "beat") return null;
  const result = replayBeatRun(puzzle.seed, myAnswer ?? "", puzzle.beatRev);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 items-end gap-1">
        {BEAT_LANE_COLOURS.map((colour, lane) => (
          <span
            key={colour}
            className="w-5 rounded-sm"
            style={{ background: colour, height: 10 + lane * 4 }}
          />
        ))}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.hits} / {result.noteCount} · {result.perfect} perfect · {result.misses} miss
        {result.misses === 1 ? "" : "es"}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        best combo {result.maxCombo} · {result.holdsDone} / {result.holds} holds
        {result.swipes > 0 ? ` · ${result.swipesHit} / ${result.swipes} swipes` : ""}
      </p>
    </div>
  );
}

/** The chart comes from the round's seed; the run is replayed on the server. */
export const beatPuzzle: PuzzleDefinition = {
  key: "beat",
  name: gameDisplayName("beat"),
  category: "arcade",
  timeLimitMs: (BEAT_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "beat", seed: 1 }) satisfies BeatPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
