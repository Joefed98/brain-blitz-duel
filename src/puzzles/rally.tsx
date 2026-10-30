import { heldHorizontal, useGameKeys } from "@/lib/desktop";
import { rallyAmbient, rallyFill } from "@/lib/arcade/arenaFills.renderer";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { rallyArtGame } from "@/lib/arcade/rally.renderer";
import { rallySounds } from "@/lib/fx/gameSounds";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordInput, inputAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  ARCADE_INPUT_DRAG,
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  rallyCheckpoint,
  rallyGameFor,
  RALLY_BALL,
  RALLY_BG,
  RALLY_CHECKPOINT_INTERVAL,
  RALLY_GOLD,
  RALLY_REV_BAND,
  RALLY_RUN_TICKS,
  RALLY_REV_BONUS,
  RALLY_REV_STD,
  RALLY_V10_BONUS_COUNT,
  rallyBonusCount,
  rallyWorldHFor,
  rallyWorldWFor,
  type RallyState,
} from "@/lib/arcade/rally";
import { decodeRallyRun, encodeRallyRun, replayRallyRun } from "@/lib/duel/rally";
import { ARCADE_CRASH_FREEZE_MS, type RallyPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

/** Fixed intro still (rallyRev 10): the pink pads, a gold bonus target with its countdown ring, a return aimed at it. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 120"
        width={168}
        height={120}
        aria-hidden="true"
        style={{ background: RALLY_BG, borderRadius: 10 }}
      >
        <path d="M120 98 L104 44" stroke={RALLY_GOLD} strokeWidth={1.5} fill="none" strokeDasharray="4 3" />
        <circle cx={120} cy={94} r={6} fill={RALLY_BALL} />
        <rect x={98} y={102} width={44} height={8} rx={3} fill="#3DFFE0" />
        <circle cx={102} cy={38} r={9} fill="#2A1E05" stroke={RALLY_GOLD} strokeWidth={1.5} />
        <circle cx={102} cy={38} r={5} fill="none" stroke={RALLY_GOLD} strokeWidth={1.5} />
        <circle cx={102} cy={38} r={1.8} fill={RALLY_GOLD} />
        <path d="M102 26 A12 12 0 1 1 90 38" stroke={RALLY_GOLD} strokeWidth={1.5} fill="none" />
        <circle cx={48} cy={70} r={6} fill={RALLY_GOLD} />
        <rect x={30} y={6} width={26} height={4} fill="#FF6FD8" />
        <rect x={112} y={6} width={26} height={4} fill="#FF6FD8" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Hit the gold target before its ring runs out; gold balls score on the pink pads.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RallyPuzzleData | null = puzzle.type === "rally" ? puzzle : null;
  const seed = data?.seed ?? 1;
  // The stored revision's game (rallyRev 10 has its own step and its 420-wide court; every earlier one shares rallyGame's).
  const rallyGame = rallyGameFor(data?.rallyRev);
  const RALLY_WORLD_W = rallyWorldWFor(data?.rallyRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<RallyState>(rallyGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof rallyCheckpoint>[]>([]);
  const wanted = useRef<number | null>(null);
  const sent = useRef<number>(state.current.aimX);
  const submitted = useRef(false);
  const deadAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: ←/→ (A/D) slide the paddle's aim, the same absolute x a drag sets, 7 px a tick.
  const keyMove = useRef(heldHorizontal());
  useGameKeys((kind, key) => keyMove.current.key(kind, key));
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("rally", state.current, rallyGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeRallyRun({
      seed,
      claimedScore: rallyGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = rallyGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    wanted.current = null;
    sent.current = state.current.aimX;
    submitted.current = false;
    deadAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed, rallyGame]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "rally" });
    const sounds = rallySounds();

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

      if (!rallyGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const keyDir = keyMove.current.dir();
          if (keyDir !== 0) wanted.current = Math.max(0, Math.min(RALLY_WORLD_W, state.current.aimX + keyDir * 7));
          const target = wanted.current;
          let applied: ArcadeInputEvent | null = null;
          if (target !== null && target !== sent.current) {
            applied = {
              t: state.current.tick + 1,
              k: ARCADE_INPUT_DRAG,
              a: target,
              b: 0,
              c: 0,
              d: 0,
            };
            sent.current = target;
            recordInput(events.current, applied, rallyGame.inputRanges);
          }
          state.current = rallyGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % RALLY_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(rallyCheckpoint(state.current));
          }
          if (rallyGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, rallyGame.isOver(state.current));
      feedback(state.current, rallyGame.isOver(state.current));
      sounds.frame(state.current, !rallyGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) rallyArtGame.draw(context, state.current, size);

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (rallyGame.isOver(state.current) && !submitted.current) {
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

  const worldX = (clientX: number): number => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width < 1) return Math.round(RALLY_WORLD_W / 2);
    return Math.max(0, Math.min(RALLY_WORLD_W, Math.round(((clientX - box.left) / box.width) * RALLY_WORLD_W)));
  };

  if (!data) return null;

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || submitted.current || rallyGame.isOver(state.current)) return;
    wanted.current = worldX(event.clientX);
  };

  return (
    <ArcadeArenaSlot width={RALLY_WORLD_W} height={rallyWorldHFor(data.rallyRev)} scene={rallyFill} ambient={rallyAmbient}>
      <div
        ref={wrap}
        data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
        style={NO_SCROLL_STYLE}
      >
        <canvas
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: RALLY_BG }}
          aria-label={gameDisplayName("rally")}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            track(event);
          }}
          onPointerMove={track}
          onPointerUp={(event) => {
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
  if (puzzle.type !== "rally") return null;
  const result = replayRallyRun(puzzle.seed, myAnswer ?? "", puzzle.rallyRev);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: RALLY_BALL }} />
        <span
          className="h-2 rounded-full"
          style={{ background: RALLY_GOLD, width: result.paddleWidth }}
        />
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {/* The values the scorer uses: band revisions (rallyRev 3+) count 5 a gold hit and 6 a pad on the band curve. */}
        {(puzzle.rallyRev ?? 0) >= RALLY_REV_STD
          ? `${result.goldHits} gold hit${result.goldHits === 1 ? "" : "s"} · ${result.targetHits} pad${result.targetHits === 1 ? "" : "s"} · gold targets ${rallyBonusCount(result.state)}/${RALLY_V10_BONUS_COUNT}`
          : (puzzle.rallyRev ?? 0) >= RALLY_REV_BONUS
          ?`${result.goldHits} gold hit${result.goldHits === 1 ? "" : "s"} × 5 + ${result.targetHits} pad${result.targetHits === 1 ? "" : "s"} × 6 · gold targets ${rallyBonusCount(result.state)}/${RALLY_V10_BONUS_COUNT}`
          : (puzzle.rallyRev ?? 0) >= RALLY_REV_BAND
          ? `${result.goldHits} gold hit${result.goldHits === 1 ? "" : "s"} × 5 + ${result.targetHits} pad${result.targetHits === 1 ? "" : "s"} × 6`
          : `${result.goldHits} gold hit${result.goldHits === 1 ? "" : "s"} × 2.5 (rounded down)${puzzle.rallyRev ? ` + ${result.targetHits} pad${result.targetHits === 1 ? "" : "s"} × 3` : ""}`} ·{" "}
        {result.survived ? "survived" : `lost at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same ball for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const rallyPuzzle: PuzzleDefinition = {
  key: "rally",
  name: gameDisplayName("rally"),
  category: "arcade",
  timeLimitMs: (RALLY_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "rally", seed: 1 }) satisfies RallyPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
