import { aimVector, directionOf, useGameKeys } from "@/lib/desktop";
import { FrameStill } from "@/components/puzzles/FrameStill";
import { auditEventAt } from "@/lib/arcade/auditInput";
import { bubbleFill } from "@/lib/arcade/arenaFills.renderer";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordInput, inputAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  dragLaunch,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  bubCheckpoint,
  bubbleGameFor,
  bubColoursOf,
  bubColour,
  BUB_BG,
  BUB_CHECKPOINT_INTERVAL,
  BUB_GOLD,
  BUB_INPUT_SHOT,
  BUB_REV_FAST,
  bubFastLevel,
  BUB_R,
  BUB_RUN_TICKS,
  BUB_SHOOTER_X,
  BUB_SHOOTER_Y,
  BUB_SPEED,
  BUB_WALL,
  BUB_WORLD_W,
  bubbleWorldHFor,
  type BubState,
} from "@/lib/arcade/bubble";
import { drawBubbleArt, drawBubbleAimTrail } from "@/lib/arcade/bubble.renderer";
import { bubbleSounds } from "@/lib/fx/gameSounds";
import { decodeBubbleRun, encodeBubbleRun, replayBubbleRun } from "@/lib/duel/bubble";
import { ARCADE_CRASH_FREEZE_MS, type BubblePuzzleData } from "@/lib/duel/types";
import { playSound, playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";
import { useArenaHudDraw } from "@/lib/gameFrame/arenaHud";

/** Fixed intro still: a shot bouncing off the wall into a matching group. */
function IntroExample() {
  // The Strategy overhaul (15 Nov 2026): a real frame of today's game (scripts/shots/strategy-stills.ts).
  return <FrameStill type="bubble" ratio={1.8714} caption="Pop threes to clear the reef; drag further for a faster shot." />;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const hudDraw = useArenaHudDraw();
  const data: BubblePuzzleData | null = puzzle.type === "bubble" ? puzzle : null;
  const seed = data?.seed ?? 1;
  // Levels (stage 3): the stored puzzle's level picks bubbleRev 12's reef, colours and descent cadence.
  const bubbleGame = bubbleGameFor(data?.bubbleRev, (data as { level?: unknown } | null)?.level);
  // bubbleRev 5: the deeper tank; every phone draws the stored revision's world.
  const BUB_WORLD_H = bubbleWorldHFor(data?.bubbleRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<BubState>(bubbleGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof bubCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  /** Where the finger went down; the aim is measured from there. */
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const aim = useRef<{ vx: number; vy: number; fast?: number } | null>(null);
  // bubbleRev 12: dragging further down the aim line shoots faster (the same path, only quicker).
  const fastShots = data?.bubbleRev === BUB_REV_FAST;
  const submitted = useRef(false);
  const deadAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: the arrows (WASD) aim a virtual drag (its trail drawn as a drag's is), Space or Enter shoots it
  // through the same launch as a finger lifted.
  const keyAim = useRef(aimVector());
  const keyShot = () => {
    const v = keyAim.current.show();
    const preview = dragLaunch(v.dx, v.dy, BUB_SPEED);
    return preview && preview.vy < 0 ? { vx: preview.vx, vy: preview.vy } : null;
  };
  useGameKeys((kind, key, event) => {
    const open = !lockedRef.current && !submitted.current && !bubbleGame.isOver(state.current) && !anchor.current;
    if (key === " " || key === "Enter") {
      if (kind === "down" && !event.repeat && open) {
        const shot = keyShot();
        aim.current = null;
        if (shot) pending.current.push({ t: 0, k: BUB_INPUT_SHOT, a: shot.vx, b: shot.vy, c: 0, d: 0 });
      }
      return true;
    }
    if (directionOf(key) === null) return false;
    if (kind === "down" && open) {
      keyAim.current.nudge(key, event.shiftKey);
      aim.current = keyShot();
    }
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("bubble", state.current, bubbleGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeBubbleRun({
      seed,
      claimedScore: bubbleGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = bubbleGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    anchor.current = null;
    aim.current = null;
    submitted.current = false;
    deadAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "bubble" });
    const sounds = bubbleSounds();
    let popped = state.current.popped;
    // bubbleRev 8: the skill features sound from the shared set (a chest's chime, a bank shot's zap, a combo's tick or ding).
    let reefSeen = { chests: state.current.chests ?? 0, banks: state.current.banks ?? 0, combos: state.current.combos ?? 0 };

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

      if (!bubbleGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A release between ticks applies on the next sim tick.
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          recordInput(events.current, applied, bubbleGame.inputRanges);
          // The dev audit's bot log (auditInput.ts; never in a production build).
          { const audit = auditEventAt(state.current.tick + 1); if (audit) recordInput(events.current, audit, bubbleGame.inputRanges); }
          state.current = bubbleGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % BUB_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(bubCheckpoint(state.current));
          }
          if (bubbleGame.isOver(state.current)) break;
        }
      }

      if (state.current.popped > popped) {
        popped = state.current.popped;
      }
      if (state.current.reef) {
        const now = state.current;
        if ((now.chests ?? 0) > reefSeen.chests) playSound("shared.celebrate.chime", 0.7);
        if ((now.banks ?? 0) > reefSeen.banks) playSound("shared.celebrate.zap", 0.45);
        if ((now.combos ?? 0) > reefSeen.combos) playSound((now.streak ?? 0) >= 4 ? "shared.celebrate.countDing" : "shared.celebrate.countTick", 0.6);
        reefSeen = { chests: now.chests ?? 0, banks: now.banks ?? 0, combos: now.combos ?? 0 };
      }

      reportArcadeTick(state.current.tick, bubbleGame.isOver(state.current));
      feedback(state.current, bubbleGame.isOver(state.current));
      sounds.frame(state.current, !bubbleGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const ctx = canvas.current?.getContext("2d");
      if (size && ctx) {
        hudDraw(() => drawBubbleArt(ctx, state.current, size));
        drawBubbleAimTrail(ctx, size, aim.current, state.current);
      }

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (bubbleGame.isOver(state.current) && !submitted.current) {
        if (state.current.dead) {
          if (deadAt.current === null) {
            deadAt.current = time;
            playWrong();
          } else if (time - deadAt.current >= ARCADE_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
          finish();
        }
      }
      frameTiming.end();
    };

    frame = arenaFrame(loop);
    return () => {
      cancelArenaFrame(loop, frame);
      sounds.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
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

  const worldPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * BUB_WORLD_W,
      y: ((event.clientY - box.top) / box.height) * BUB_WORLD_H,
    };
  };

  if (!data) return null;

  return (
    <ArcadeArenaSlot width={BUB_WORLD_W} height={BUB_WORLD_H} scene={bubbleFill}>
      <div
        ref={wrap}
        data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
        style={NO_SCROLL_STYLE}
      >
        <canvas role="img"
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: BUB_BG }}
          aria-label={gameDisplayName("bubble")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || bubbleGame.isOver(state.current)) return;
            anchor.current = worldPoint(event);
            aim.current = null;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = anchor.current;
            if (!start) return;
            const point = worldPoint(event);
            const preview = dragLaunch(point.x - start.x, point.y - start.y, BUB_SPEED);
            const fast = fastShots ? bubFastLevel(Math.hypot(point.x - start.x, point.y - start.y)) : 0;
            aim.current = preview && preview.vy < 0 ? { vx: preview.vx, vy: preview.vy, fast } : null;
          }}
          onPointerUp={(event) => {
            const start = anchor.current;
            anchor.current = null;
            const shot = aim.current;
            aim.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            if (!start || !shot || locked || submitted.current) return;
            pending.current.push({ t: 0, k: BUB_INPUT_SHOT, a: shot.vx, b: shot.vy, c: shot.fast ?? 0, d: 0 });
          }}
          onPointerCancel={(event) => {
            anchor.current = null;
            aim.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bubble") return null;
  const result = replayBubbleRun(puzzle.seed, myAnswer ?? "", puzzle.bubbleRev, (puzzle as { level?: unknown }).level);
  const shots = decodeBubbleRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 items-center gap-2">
        {bubColoursOf(result.state).map((value) => (
          <span
            key={value}
            className="h-4 w-4 rounded-full"
            style={{ background: bubColour(value) }}
          />
        ))}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.cleared
          ? `Cleared at ${result.endedSeconds.toFixed(1)}s`
          : `Popped ${result.popped} · dropped ${result.dropped}`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {shots} shot{shots === 1 ? "" : "s"} · {result.bubblesLeft} left
        {!result.survived && !result.cleared
          ? ` · reached the line at ${result.endedSeconds.toFixed(1)}s`
          : ""}
      </p>
      {puzzle.bubbleRev ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          Jokers {result.jokers} · bombs {result.bombs} · torpedoes {result.lines}
        </p>
      ) : null}
      {result.state.reef ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          Chests {result.state.chests ?? 0} · banks {result.state.banks ?? 0} · combos {result.state.combos ?? 0}
        </p>
      ) : null}
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const bubblePuzzle: PuzzleDefinition = {
  key: "bubble",
  name: gameDisplayName("bubble"),
  category: "arcade",
  timeLimitMs: (BUB_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "bubble", seed: 1 }) satisfies BubblePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
