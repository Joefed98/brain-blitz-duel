import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { BonkIcon } from "@/components/puzzles/BonkIcon";
import { bonkArenaScene, drawBonkFinale, whackArtGame } from "@/lib/arcade/whack.renderer";
import { END_OF_RUN_FX_SCORE, playOverlayFx, registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  inputAt,
  MAX_CATCH_UP_TICKS,
  recordInput,
  TICK_MS,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";
import {
  whackCheckpoint,
  whackGame,
  whackRule,
  WHACK_CHECKPOINT_INTERVAL,
  WHACK_COLS,
  WHACK_GAP_PX,
  WHACK_INPUT_TAP,
  WHACK_RED,
  type WhackState,
  WHACK_STATUS_RETIRED,
} from "@/lib/arcade/whack";
import { encodeWhackRun, replayWhackRun } from "@/lib/duel/whack";
import { WHACK_TIME_MS, type WhackPuzzleData } from "@/lib/duel/types";
import { playCorrect, playTick, playWrong } from "@/lib/sound";
import { momentFrame } from "@/lib/fx/momentCues";
import { gridCellAt } from "@/components/puzzles/GridDrag";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The rule box. Live (14 Oct 2026): a bigger box, outlined in the rule's colour; the intro still keeps the small pill. */
function Banner({ red, flash, small = false }: { red: boolean; flash: boolean; small?: boolean }) {
  return (
    <div
      data-bonk-banner={small ? "small" : "large"}
      className={`mx-auto text-center font-display tracking-widest transition-transform duration-150 ${
        small
          ? "rounded-full bg-card px-6 py-2 text-2xl font-bold"
          : "bonk-banner-large w-full max-w-[20rem] rounded-2xl border-2 border-current bg-card px-6 py-2.5 text-4xl font-black"
      } ${red ? "bonk-banner-red" : "bonk-banner-gold"} ${flash ? "scale-110 ring-2 ring-current" : ""}`}
    >
      {red ? "TAP RED" : "TAP GOLD"}
    </div>
  );
}

/** Fixed intro still: gold ticked, red crossed. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Banner red={false} flash={false} small />
      <div className="bonk-example grid h-[120px] w-[120px] grid-cols-2 gap-1">
        <div className="bonk-burrow"><BonkIcon/></div><div className="bonk-burrow"/>
        <div className="bonk-burrow"><BonkIcon hedgehog/></div><div className="bonk-burrow"><BonkIcon red/></div>
      </div>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: WhackPuzzleData | null = puzzle.type === "whack" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<WhackState>(whackGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof whackCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const submitted = useRef(false);
  const [hud, setHud] = useState({ hits: 0, wrong: 0, next: 0, red: false, flash: false });
  useNoTouchScroll(wrap);

  /** End-of-run finale over the board (presentation only; never delays the submit). */
  const fireFinale = () => {
    const node = board.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    if (box.width < 1) return;
    const lift = Math.round(box.height * 0.22);
    soundCue("whack.finale");
    playOverlayFx({
      rect: new DOMRect(box.left, box.top - lift, box.width, box.height + lift),
      ms: 1100,
      draw: ({ ctx, ms, reduced }) => drawBonkFinale(ctx, ms, box.width, box.height, lift, reduced),
    });
  };
  useEffect(() => registerFxPreview("whack", fireFinale), []);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encodeRaw = (): string =>
    encodeWhackRun({
      seed,
      claimedScore: whackGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });
  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("whack", state.current, whackGame.score(state.current)),
    );

  useEffect(() => {
    state.current = whackGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    submitted.current = false;
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({
      game: "whack",
      completeCue: (s) =>
        whackGame.score(s as WhackState) >= END_OF_RUN_FX_SCORE ? "whack.finale" : null,
    });
    let hits = state.current.hits;
    let wrong = state.current.wrong;
    let bombs = state.current.bombs;
    let popped = state.current.next;
    let sunk = 0;
    let flashUntil = 0;
    let shown = { hits: -1, wrong: -1, next: -1, red: false, flash: false };

    const loop = (time: number) => {
      frameTiming.begin(time);
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;
      if (!whackGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          recordInput(events.current, applied, whackGame.inputRanges);
          state.current = whackGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % WHACK_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(whackCheckpoint(state.current));
          }
          if (state.current.schedule.flips.includes(state.current.tick)) {
            playTick();
            flashUntil = time + 400;
          }
          if (whackGame.isOver(state.current)) break;
        }
      }
      // Success-effect cues (bonks streak, twenty clean); their own file stands in for the chime.
      const quiet = momentFrame("whack", state.current);
      if (state.current.hits > hits) {
        hits = state.current.hits;
        if (!quiet.has("correct")) playCorrect();
      }
      // A bomb tapped flashes its hole red (it was silent: wrong taps play their own sound).
      if (state.current.bombs > bombs) {
        bombs = state.current.bombs;
        soundCue("whack.bomb");
      }
      // A gopher rises; one left unbonked sinks away.
      if (state.current.next > popped) {
        popped = state.current.next;
        if (!whackGame.isOver(state.current)) soundCue("whack.popUp");
      }
      const retired = state.current.status.filter((status) => status === WHACK_STATUS_RETIRED).length;
      if (retired > sunk) soundCue("whack.sink");
      sunk = retired;
      if (state.current.wrong > wrong) {
        wrong = state.current.wrong;
        playWrong();
      }
      const next = {
        hits,
        wrong,
        next: state.current.next,
        red: whackRule(state.current.schedule.flips, state.current.tick) === WHACK_RED,
        flash: time < flashUntil,
      };
      if (
        next.hits !== shown.hits ||
        next.wrong !== shown.wrong ||
        next.next !== shown.next ||
        next.red !== shown.red ||
        next.flash !== shown.flash
      ) {
        shown = next;
        setHud(next);
      }

      reportArcadeTick(state.current.tick, whackGame.isOver(state.current));
      feedback(state.current, whackGame.isOver(state.current));
      frameTiming.draw();
      const node = canvas.current;
      const box = board.current?.getBoundingClientRect();
      if (node && box && box.width > 1) {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(box.width);
        const height = Math.round(box.height);
        if (node.width !== width * ratio || node.height !== height * ratio) {
          node.width = width * ratio;
          node.height = height * ratio;
        }
        const ctx = node.getContext("2d");
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          whackArtGame.draw(ctx, state.current, { width, height });
        }
      }

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (whackGame.isOver(state.current) && !submitted.current) {
        submitted.current = true;
        submitRef.current(encode());
        if (whackGame.score(state.current) >= END_OF_RUN_FX_SCORE) fireFinale();
      }
      frameTiming.end();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

  if (!data) return null;
  const total = state.current.schedule.total;

  return (
    <div ref={wrap} data-stage-column="2" data-polish="whack" className="flex min-h-0 w-full flex-1 flex-col gap-2" style={NO_SCROLL_STYLE}>
      <Banner red={hud.red} flash={hud.flash} />
      <p className="text-center font-mono text-sm text-muted-foreground">
        Hits <span className="text-primary">{hud.hits}</span> / {total} · Wrong{" "}
        <span className="text-destructive">{hud.wrong}</span>
      </p>
      {/* The square board at the largest fit, top-anchored (15 Oct 2026, display only; gridCellAt maps through the board). */}
      <ArcadeArenaSlot width={1} height={1} scene={bonkArenaScene}>
      <div data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={board}
          className="puzzle-board relative grid aspect-square max-h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${WHACK_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${WHACK_COLS}, minmax(0, 1fr))`,
            gap: WHACK_GAP_PX,
            minWidth: 4 * 72 + 3 * WHACK_GAP_PX,
          }}
          aria-label={`${gameDisplayName("whack")} board`}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || whackGame.isOver(state.current)) return;
            const hole = gridCellAt(
              board.current,
              event.clientX,
              event.clientY,
              WHACK_COLS,
              WHACK_COLS,
            );
            if (hole === null) return;
            pending.current.push({ t: 0, k: WHACK_INPUT_TAP, a: hole, b: 0, c: 0, d: 0 });
          }}
        >
          <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </div>
      </ArcadeArenaSlot>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "whack") return null;
  const result = replayWhackRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        Hits {result.hits} / {result.totalTargets} · Wrong {result.wrong}
      </p>
      <p className="text-center text-base text-muted-foreground">Same targets for everyone</p>
    </div>
  );
}

/** The schedule comes from the round's seed; the run is replayed on the server. */
export const whackPuzzle: PuzzleDefinition = {
  key: "whack",
  name: gameDisplayName("whack"),
  category: "speed",
  arcadeRun: true,
  timeLimitMs: WHACK_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "whack", seed: 1 }) satisfies WhackPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
