import { useGameKeys, directionOf } from "@/lib/desktop";
import { snakeAmbient, snakeFill } from "@/lib/arcade/arenaFills.renderer";
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
  snakeCheckpoint,
  snakeGameFor,
  SNAKE_BG,
  SNAKE_BODY,
  SNAKE_CHECKPOINT_INTERVAL,
  SNAKE_HEAD,
  SNAKE_INPUT_TURN,
  SNAKE_RUN_TICKS,
  SNAKE_SWIPE_PX,
  type SnakeState,
  snakeWorldHForRev,
  SNAKE_WORLD_W,
} from "@/lib/arcade/snake";
import { decodeSnakeRun, encodeSnakeRun, replaySnakeRun } from "@/lib/duel/snake";
import { ARCADE_CRASH_FREEZE_MS, type SnakePuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { snakeArtGame } from "@/lib/arcade/snake.renderer";
import { snakeSounds } from "@/lib/fx/gameSounds";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

/** Fixed intro still: a short trail about to reach the star, and a rock's shadow. */
function IntroExample() {
  const body = [
    [3, 2],
    [3, 3],
    [3, 4],
  ];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: SNAKE_BG, borderRadius: 10 }}
      >
        {Array.from({ length: 7 }, (_, col) =>
          Array.from({ length: 5 }, (_, row) => (
            <rect
              key={`${col}-${row}`}
              x={col * 24}
              y={row * 24}
              width={24}
              height={24}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
            />
          )),
        )}
        {body.map(([col, row], index) => (
          <rect
            key={index}
            x={(col ?? 0) * 24 + 3}
            y={(row ?? 0) * 24 + 3}
            width={18}
            height={18}
            fill={index === 0 ? SNAKE_HEAD : SNAKE_BODY}
          />
        ))}
        <path d="M84 30 L86 34 L91 36 L86 38 L84 42 L82 38 L77 36 L82 34 Z" fill="#FFD84A" />
        <rect x={5 * 24 + 3} y={2 * 24 + 3} width={18} height={18} rx={4} fill="rgba(255,77,77,0.28)" stroke="rgba(255,77,77,0.7)" strokeDasharray="3 2" />
        <rect x={5 * 24 + 2} y={4 * 24 + 2} width={20} height={20} rx={6} fill="#4A4750" stroke="#77747B" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Swipe up for the star. Keep your head off the red shadows: a rock lands there.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SnakePuzzleData | null = puzzle.type === "snake" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const snakeGame = snakeGameFor(data?.snakeRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<SnakeState>(snakeGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof snakeCheckpoint>[]>([]);
  const pending = useRef<number[]>([]);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const submitted = useRef(false);
  const deadAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: the arrows (WASD) are the four swipe turns.
  useGameKeys((kind, key, event) => {
    const open = () => !lockedRef.current && !submitted.current && !snakeGame.isOver(state.current);
    const dir = directionOf(key);
    if (!dir) return false;
    if (kind === "down" && !event.repeat && open()) pending.current.push(dir === "up" ? 0 : dir === "right" ? 1 : dir === "down" ? 2 : 3);
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("snake", state.current, snakeGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeSnakeRun({
      seed,
      claimedScore: snakeGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = snakeGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    anchor.current = null;
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
    const feedback = arcadeFeedback({ game: "snake" });
    const sounds = snakeSounds();

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

      if (!snakeGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const turn = pending.current.shift();
          const applied: ArcadeInputEvent | null =
            turn === undefined
              ? null
              : { t: state.current.tick + 1, k: SNAKE_INPUT_TURN, a: turn, b: 0, c: 0, d: 0 };
          recordInput(events.current, applied, snakeGame.inputRanges);
          state.current = snakeGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % SNAKE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(snakeCheckpoint(state.current));
          }
          if (snakeGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, snakeGame.isOver(state.current));
      feedback(state.current, snakeGame.isOver(state.current));
      sounds.frame(state.current, !snakeGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) snakeArtGame.draw(context, state.current, size);

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (snakeGame.isOver(state.current) && !submitted.current) {
        if (state.current.dead) {
          if (deadAt.current === null) {
            deadAt.current = time;
            buzz(40);
          } else if (time - deadAt.current >= ARCADE_CRASH_FREEZE_MS) {
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

  /**
   * The canvas fills its world box to whole CSS pixels, never past it (16 Oct 2026, display only).
   * The box is the world's aspect at the slot's scale, so it is often a fractional height (768.55 px
   * at 414 px wide). Rounding to the nearest pixel made the canvas 769 px: it overran the box's clip
   * part-way through a device row, with a part-covered edge row the scanlines flickered. Whole CSS
   * pixels are whole device pixels at any integer pixel ratio, and engines snap a canvas's displayed
   * size to them, so its backing store maps 1:1; the sliver under it (under 1 px) is the same gap
   * black as below the world. The box itself (the world's place and scale, and what swipes measure)
   * is unchanged.
   */
  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    const ratio = arcadeCanvasRatio();
    const width = Math.floor(box.width + 0.01);
    const height = Math.floor(box.height + 0.01);
    const pw = Math.round(width * ratio);
    const ph = Math.round(height * ratio);
    if (node.width !== pw || node.height !== ph) {
      node.width = pw;
      node.height = ph;
    }
    if (node.style.width !== `${width}px` || node.style.height !== `${height}px`) {
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }
    const ctx = node.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(pw / width, 0, 0, ph / height, 0, 0);
    return { width, height };
  };

  if (!data) return null;

  return (
    <ArcadeArenaSlot width={SNAKE_WORLD_W} height={snakeWorldHForRev(data.snakeRev)} scene={snakeFill} ambient={snakeAmbient} playCentre>
      <div
        ref={wrap}
        data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
        // The canvas is whole CSS pixels inside this box (#101); the sub-pixel strip under it stays the screen
        // edge's black over the fill-ins' starfield (17 Oct 2026), as arcade-device-bottom-check expects.
        style={{ ...NO_SCROLL_STYLE, background: "var(--screen-edge)" }}
      >
        <canvas
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: SNAKE_BG }}
          aria-label={gameDisplayName("snake")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || snakeGame.isOver(state.current)) return;
            anchor.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const from = anchor.current;
            if (!from || locked || submitted.current || snakeGame.isOver(state.current)) return;
            const dx = event.clientX - from.x;
            const dy = event.clientY - from.y;
            if (Math.abs(dx) < SNAKE_SWIPE_PX && Math.abs(dy) < SNAKE_SWIPE_PX) return;
            const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
            pending.current.push(dir);
            anchor.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            anchor.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            anchor.current = null;
          }}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "snake") return null;
  const result = replaySnakeRun(puzzle.seed, myAnswer ?? "", puzzle.snakeRev);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.pellets} star{result.pellets === 1 ? "" : "s"} ·{" "}
        {result.survived ? "survived" : result.rockHit ? `hit a rock at ${result.endedSeconds.toFixed(1)}s` : `crashed at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {puzzle.snakeRev ? `Same stars and rocks for everyone${result.rocks > 0 ? ` · ${result.rocks} rock${result.rocks === 1 ? "" : "s"} landed` : ""}` : "Same stars for everyone"}
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const snakePuzzle: PuzzleDefinition = {
  key: "snake",
  name: gameDisplayName("snake"),
  category: "arcade",
  timeLimitMs: (SNAKE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "snake", seed: 1 }) satisfies SnakePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
