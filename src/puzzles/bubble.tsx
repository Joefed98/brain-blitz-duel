import { aimVector, directionOf, useGameKeys } from "@/lib/desktop";
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
  bubColour,
  BUB_BG,
  BUB_CHECKPOINT_INTERVAL,
  BUB_GOLD,
  BUB_INPUT_SHOT,
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

/** Fixed intro still: a shot bouncing off the wall into a matching group. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: BUB_BG, borderRadius: 10 }}
      >
        <circle cx={60} cy={26} r={10} fill={bubColour(1)} />
        <circle cx={82} cy={26} r={10} fill={bubColour(1)} />
        <circle cx={104} cy={26} r={10} fill={bubColour(2)} />
        <path
          d="M84 106 L24 62 L104 38"
          stroke="rgba(255,255,255,0.35)"
          strokeDasharray="4 4"
          fill="none"
        />
        <circle cx={84} cy={106} r={9} fill={bubColour(1)} />
        <g transform="translate(130 96)">
          <circle r={9} fill="#F4F1FF" />
          {["#FF4D4D", "#FFE600", "#3DDC84", "#4D8CFF", "#B26BFF"].map((colour, i) => (
            <path key={colour} d={`M0 0 L${(9 * Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2)).toFixed(2)} ${(9 * Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2)).toFixed(2)} A9 9 0 0 1 ${(9 * Math.cos(((i + 1) * 2 * Math.PI) / 5 - Math.PI / 2)).toFixed(2)} ${(9 * Math.sin(((i + 1) * 2 * Math.PI) / 5 - Math.PI / 2)).toFixed(2)} Z`} fill={colour} opacity={0.75} />
          ))}
          <circle r={5.2} fill="#F4F1FF" />
          <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#5B3FD0" />
        </g>
        <g transform="translate(150 70)">
          <circle r={9} fill="#E0662A" />
          <circle r={4.8} fill="#141519" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle key={i} r={1.1} cx={(6.8 * Math.cos((i * Math.PI) / 4)).toFixed(2)} cy={(6.8 * Math.sin((i * Math.PI) / 4)).toFixed(2)} fill="#141519" />
          ))}
          <circle r={1.6} fill="#FF2E2E" />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Bank off the walls to reach a match. Crown Jokers match any colour; mines blast round them; torpedoes drill where aimed.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BubblePuzzleData | null = puzzle.type === "bubble" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const bubbleGame = bubbleGameFor(data?.bubbleRev);
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
  const aim = useRef<{ vx: number; vy: number } | null>(null);
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
        drawBubbleArt(ctx, state.current, size);
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
        <canvas
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
            aim.current = preview && preview.vy < 0 ? { vx: preview.vx, vy: preview.vy } : null;
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
            pending.current.push({ t: 0, k: BUB_INPUT_SHOT, a: shot.vx, b: shot.vy, c: 0, d: 0 });
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
  const result = replayBubbleRun(puzzle.seed, myAnswer ?? "", puzzle.bubbleRev);
  const shots = decodeBubbleRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 items-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
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
