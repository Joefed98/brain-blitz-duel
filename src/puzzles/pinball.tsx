import { pinball4Ambient, pinballAmbient } from "@/lib/arcade/arenaFills.renderer";
import { puzzleLevel } from "@/lib/levels/levels";
import { RETRO_PAYOFF_MS } from "@/lib/arcade/retroFx.renderer";
import { ArtStill } from "@/components/puzzles/ArtStill";
import { auditEventAt } from "@/lib/arcade/auditInput";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { pinballGlowFill, PIN_COLOURS } from "@/lib/arcade/pinball.renderer";
import { pinball4GlowFill, pinballArtGameForAny, pinballWorldHFor } from "@/lib/arcade/pinball4.renderer";
import { pinballGameForAny, pinCheckpointAny, PIN_REV_SAVE, type Pin4State } from "@/lib/arcade/pinball4";
import { pinballSounds } from "@/lib/fx/gameSounds";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { inputAt, recordInput } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState, useMemo } from "react";

import { MAX_CATCH_UP_TICKS, TICK_MS, TICKS_PER_SECOND, type ArcadeInputEvent, type CanvasSize } from "@/lib/arcade/engine";
import {
  PIN_BALLS,
  PIN_CHECKPOINT_INTERVAL,
  PIN_INPUT_FLIPPERS,
  pinIsExpanded,
  PIN_V5_RUN_TICKS,
  PIN_WORLD_W,
  type PinState,
} from "@/lib/arcade/pinball";
import { replayPinballRun, encodePinballRun } from "@/lib/duel/pinball";
import { pinHeldTracker, pinSideOf } from "@/lib/arcade/pinballInput";
import type { PinballPuzzleData } from "@/lib/duel/types";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

/** Fixed intro still: two flippers under a bumper, a drop target row and a ball. */
/**
 * The intro still (the Retro overhaul, 15 Nov 2026: a real frame of today's game, not an old drawing): the dealt
 * stamp's own renderer a few seconds into a fixed seed's run, the table before the launch.
 */
function IntroExample() {
  return (
    <ArtStill
      game={pinballArtGameForAny(PIN_REV_SAVE)}
      worldW={PIN_WORLD_W}
      worldH={pinballWorldHFor(PIN_REV_SAVE)}
      ticks={30}
      input={null}
      caption="Hold either side to flip. Light J-O-U-L-Z, lock balls on the ramps, start multiball."
    />
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: PinballPuzzleData | null = puzzle.type === "pinball" ? puzzle : null;
  const seed = data?.seed ?? 1;
  // One game object per stamp and level (stage 3 of the Retro overhaul: a level wraps init).
  const level = puzzleLevel(data);
  const game = useMemo(() => pinballGameForAny(data?.pinRev, level), [data?.pinRev, level]);
  const art = useMemo(() => pinballArtGameForAny(data?.pinRev, level), [data?.pinRev, level]);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<PinState>(game.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof pinCheckpointAny>[]>([]);
  /** Fingers (and keys) down, each holding its own side; several at once (pinballInput.ts). */
  const thumbs = useRef(pinHeldTracker());
  /** The held set the sim was last told about. */
  const sent = useRef(0);
  const submitted = useRef(false);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string => appendClientCounters(encodeRaw(), arcadeCounters("pinball", state.current, game.score(state.current)));
  const encodeRaw = (): string =>
    encodePinballRun({
      seed,
      claimedScore: game.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = game.init(seed);
    events.current = [];
    checkpoints.current = [];
    thumbs.current.clear();
    sent.current = 0;
    submitted.current = false;
    forceRedraw((n) => n + 1);
  }, [seed, game]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "pinball" });
    const sounds = pinballSounds();

    let endedAt: number | null = null;
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

      if (!game.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // One event a tick, only when the held set changes; logged on the tick it applies.
          const mask = thumbs.current.takeTick();
          if (mask !== sent.current) {
            const event = { t: state.current.tick + 1, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 };
            if (recordInput(events.current, event, game.inputRanges)) sent.current = mask;
          }
          // The dev audit's bot log (auditInput.ts; never in a production build).
          { const audit = auditEventAt(state.current.tick + 1); if (audit) recordInput(events.current, audit, game.inputRanges); }
          state.current = game.step(state.current, inputAt(events.current, state.current.tick + 1));
          if (state.current.tick % PIN_CHECKPOINT_INTERVAL === 0) checkpoints.current.push(pinCheckpointAny(state.current));
          if (game.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, game.isOver(state.current));
      feedback(state.current, game.isOver(state.current));
      sounds.frame(state.current, !game.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) art.draw(context, state.current, size);
      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      // Stage 3 of the Retro overhaul: the round-end payoff plays before the run is sent (its answer is fixed now and
      // sent as the draft at once; display only).
      if (game.isOver(state.current)) {
        if (endedAt === null) {
          endedAt = time;
          if (!submitted.current) draftRef.current?.(encode());
        }
        if (time - endedAt >= RETRO_PAYOFF_MS) finish();
      }
      frameTiming.end();
    };

    // Keyboard flippers for laptops: left/right arrows or Z and M.
    const keySide = (key: string): number | null => (key === "ArrowLeft" || key === "z" || key === "Z" ? 0 : key === "ArrowRight" || key === "m" || key === "M" ? 1 : null);
    const onKey = (down: boolean) => (event: KeyboardEvent) => {
      const side = keySide(event.key);
      if (side === null) return;
      event.preventDefault();
      if (down) {
        if (lockedRef.current || submitted.current) return;
        thumbs.current.down(`key${side}`, side);
      } else thumbs.current.up(`key${side}`);
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    frame = arenaFrame(loop);
    return () => {
      cancelArenaFrame(loop, frame);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
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

  if (!data) return null;

  const press = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (locked || submitted.current || game.isOver(state.current)) return;
    // Each finger holds the half it went down on until it lifts: two fingers, two flippers.
    thumbs.current.down(event.pointerId, pinSideOf(wrap.current?.getBoundingClientRect(), event.clientX));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const release = (event: React.PointerEvent<HTMLCanvasElement>) => {
    thumbs.current.up(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <ArcadeArenaSlot width={PIN_WORLD_W} height={pinballWorldHFor(data.pinRev)} scene={pinIsExpanded(data.pinRev) ? pinball4GlowFill : pinballGlowFill} ambient={pinIsExpanded(data.pinRev) ? pinball4Ambient : pinballAmbient} playCentre>
      <div ref={wrap} data-game-arena="canvas" className="relative min-h-0 w-full flex-1 overflow-hidden" style={NO_SCROLL_STYLE}>
        <canvas role="img"
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: "#000000", ...NO_SCROLL_STYLE }}
          aria-label={`${gameDisplayName("pinball")}: hold the left or right half to flip`}
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={release}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "pinball") return null;
  const result = replayPinballRun(puzzle.seed, myAnswer ?? "", puzzle.pinRev, puzzleLevel(puzzle));
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.points.toLocaleString("en-GB")} table points{(result.state as Partial<Pin4State>).rev6 ? "" : ` · ×${result.mult}`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.bumps} bumper hits · {result.drops} targets · {result.spins} spins
      </p>
      {pinIsExpanded(puzzle.pinRev) ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.ramps} ramps · {(result.state as Partial<Pin4State>).rev6 ? `${result.combos} combos · ` : ""}{result.multiballs} multiball · {result.jackpots} jackpots · {result.skills} skill shots
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.ballsLeft > 0 ? `${result.ballsLeft} of ${PIN_BALLS} balls left at the buzzer` : `All ${PIN_BALLS} balls drained at ${result.endedSeconds.toFixed(1)}s`}
      </p>
    </div>
  );
}

/** The table is fixed; every run is replayed on the server for scoring. */
export const pinballPuzzle: PuzzleDefinition = {
  key: "pinball",
  name: gameDisplayName("pinball"),
  category: "arcade",
  // pinRev 5's 90 s run (older rounds run 60 s and end there; their clock shows the extra 30 s unused, as Tempo's beatRev 9).
  timeLimitMs: (PIN_V5_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "pinball", seed: 1, pinRev: PIN_REV_SAVE }) satisfies PinballPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
