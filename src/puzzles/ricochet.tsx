import { useGameKeys } from "@/lib/desktop";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordTap, tapAt } from "@/lib/arcade/engine";
import { auditTapAt } from "@/lib/arcade/auditInput";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  ricoCheckpoint,
  ricoGame,
  RICO_BALL,
  RICO_BG,
  RICO_CHECKPOINT_INTERVAL,
  RICO_RUN_TICKS,
  RICO_SPIKE,
  RICO_WALL,
  type RicoState,
} from "@/lib/arcade/ricochet";
import { decodeRicoRun, encodeRicoRun, replayRicoRun } from "@/lib/duel/ricochet";
import { ARCADE_CRASH_FREEZE_MS, type RicoPuzzleData } from "@/lib/duel/types";
import { haptic } from "@/lib/haptics";
import { playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps, RunPictureProps } from "./types";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { encodeMoonRun, encodeNinjaRun, isMoonRev, isNinjaRev, replayNinjaRun } from "@/lib/duel/ricochet";
import { puzzleLevel } from "@/lib/levels/levels";
import {
  ninjaCheckpoint,
  ninjaDeal,
  ninjaGame,
  NINJA_CHECKPOINT_INTERVAL,
  NINJA_INPUT_TAP,
  NINJA_RUN_TICKS,
  NINJA_WORLD_H,
  NINJA_WORLD_W,
  moonCheckpoint,
  moonDeal,
  moonGameFor,
  MODE_RIDE,
  MOON_MID_REV,
  MOON_SCROLLS,
  MOON_SKY,
  type MoonState,
  type NinjaState,
} from "@/lib/arcade/ricochetNinja";
import { drawMoonRunPicture, drawNinjaFrame, moonArtGameFor, MOON_RUN_COLOURS, ninjaArtGame, NINJA_BG } from "@/lib/arcade/ricochetNinja.renderer";
import { moonRunSummary } from "@/lib/duel/moonSummary";
import { ninjaScene } from "@/lib/arcade/ricochetNinjaScene.renderer";
import { ninjaSounds } from "@/lib/fx/gameSounds";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

/** Fixed intro still (unstamped Ricochet): the ball leaping from one wall to the other. */
export function RicoV1IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 140 120"
        width={140}
        height={120}
        aria-hidden="true"
        style={{ background: RICO_BG, borderRadius: 10 }}
      >
        <rect x="18" y="0" width="12" height="120" fill={RICO_WALL} />
        <rect x="110" y="0" width="12" height="120" fill={RICO_WALL} />
        <polygon points="30,60 44,67 30,74" fill={RICO_SPIKE} />
        <polygon points="110,24 96,31 110,38" fill={RICO_SPIKE} />
        <circle cx="102" cy="88" r="9" fill={RICO_BALL} />
        <path
          d="M102 88 C 80 74, 60 66, 40 58"
          stroke={RICO_BALL}
          strokeDasharray="4 4"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Each leap lands you higher - but never on a spike.
      </p>
    </div>
  );
}

/** The original ball-and-spikes stage (unstamped Ricochet puzzles only; rooms and practice deal ricoRev 2). */
function RicoV1Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RicoPuzzleData | null = puzzle.type === "ricochet" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<RicoState>(ricoGame.init(seed));
  const inputs = useRef<number[]>([]);
  const checkpoints = useRef<ReturnType<typeof ricoCheckpoint>[]>([]);
  const pending = useRef(0);
  const submitted = useRef(false);
  const deadAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: Space, ↑ or W leaps (a tap).
  useGameKeys((kind, key, event) => {
    if (![" ", "ArrowUp", "w"].includes(key)) return false;
    if (kind === "down" && !event.repeat && !lockedRef.current && !submitted.current && !ricoGame.isOver(state.current)) pending.current += 1;
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("ricochet", state.current, ricoGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeRicoRun({
      seed,
      claimedScore: ricoGame.score(state.current),
      inputs: inputs.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = ricoGame.init(seed);
    inputs.current = [];
    checkpoints.current = [];
    pending.current = 0;
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
    const feedback = arcadeFeedback();

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

      if (!ricoGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // The dev audit's bot log (auditInput.ts; never in a production build) taps like a player.
          if (auditTapAt(state.current.tick + 1)) pending.current = Math.max(pending.current, 1);
          const tapped = pending.current > 0;
          if (tapped) {
            pending.current -= 1;
            recordTap(inputs.current, state.current.tick + 1);
          }
          state.current = ricoGame.step(
            state.current,
            tapAt(inputs.current, state.current.tick + 1),
          );
          if (state.current.tick % RICO_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(ricoCheckpoint(state.current));
          }
          if (ricoGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, ricoGame.isOver(state.current));
      feedback(state.current, ricoGame.isOver(state.current));

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) ricoGame.draw(context, state.current, size);

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (ricoGame.isOver(state.current) && !submitted.current) {
        if (state.current.dead) {
          if (deadAt.current === null) {
            deadAt.current = time;
            // Haptics (lib/haptics.ts): a crash (this retired game has no sound observer to carry it).
            haptic("impact", { inGame: true });
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
    return () => cancelArenaFrame(loop, frame);
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

  return (
    <div
      ref={wrap}
      className="min-h-0 w-full flex-1 overflow-hidden rounded-xl"
      style={NO_SCROLL_STYLE}
    >
      <canvas role="img"
        ref={canvas}
        className="puzzle-board block h-full w-full rounded-xl"
        style={{ background: RICO_BG }}
        aria-label={gameDisplayName("ricochet")}
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || ricoGame.isOver(state.current)) return;
          pending.current += 1;
        }}
      />
    </div>
  );
}

function RicoV1Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "ricochet") return null;
  const result = replayRicoRun(puzzle.seed, myAnswer ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <svg viewBox="0 0 120 60" className="h-auto w-full max-w-[150px] shrink-0" aria-hidden="true">
        <rect x="14" y="0" width="8" height="60" fill={RICO_WALL} />
        <rect x="98" y="0" width="8" height="60" fill={RICO_WALL} />
        <polygon points="22,34 32,39 22,44" fill={RICO_SPIKE} />
        <circle cx="94" cy="20" r="7" fill={RICO_BALL} />
      </svg>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {Math.trunc(result.heightPx / 40).toLocaleString("en-GB")} m ·{" "}
        {result.survived
          ? "survived"
          : result.spiked
            ? `hit a spike at ${result.endedSeconds.toFixed(1)}s`
            : `slid down at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same shaft for everyone
      </p>
    </div>
  );
}

/* ===================== ricoRev 2: the ninja wall-climb ===================== */

/** The intro still (ricoRev 2): seed 0's tower a few seconds into its witness's climb, a leap under way. */
export function ninjaIntroState(): NinjaState {
  const taps = new Set(ninjaDeal(0).witnessTaps);
  let s = ninjaGame.init(0);
  while (s.tick < 260 || s.mode !== 1) s = ninjaGame.step(s, taps.has(s.tick + 1) ? { t: s.tick + 1, k: NINJA_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
  return { ...s, hitTick: -999, pickTick: -999 };
}

/** Moon Climb's intro still (the live ricoRev 5, the 30 × 60 ninja): seed 0's tower, its witness riding the first sky lantern. */
export function moonIntroState(): MoonState {
  const moonGame = moonGameFor(MOON_MID_REV);
  const at = new Map(moonDeal(0, MOON_MID_REV).witness.map((e) => [e.t, e.a]));
  let s = moonGame.init(0);
  while (!(s.mode === MODE_RIDE && s.ride < 80) && !s.ended) {
    const a = at.get(s.tick + 1);
    s = moonGame.step(s, a === undefined ? null : { t: s.tick + 1, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });
  }
  return { ...s, hitTick: -999, pickTick: -999, grabTick: -999, flowTick: -999 };
}

function IntroExample() {
  return (
    <CardStill
      width={NINJA_WORLD_W}
      height={NINJA_WORLD_H}
      draw={(ctx, size) => drawNinjaFrame(ctx, moonIntroState(), size)}
      caption="Tap to leap wall to wall, again in the air to double jump. Ride sky lanterns up; rides and scrolls count at the top."
    />
  );
}

function NinjaStage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RicoPuzzleData | null = puzzle.type === "ricochet" ? puzzle : null;
  const moon = isMoonRev(data?.ricoRev);
  return (
    <ArcadeCanvasStage
      diagKey="ricochet"
      label={
        moon
          ? `${gameDisplayName("ricochet")}: tap to leap, tap again in the air to double jump; on a lantern, tap the side to leap towards`
          : `${gameDisplayName("ricochet")}: tap to leap, tap again in the air to double jump`
      }
      background={NINJA_BG}
      fitWorld
      scene={ninjaScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={NINJA_WORLD_W}
      worldH={NINJA_WORLD_H}
      game={(moon ? moonArtGameFor(data?.ricoRev, puzzleLevel(puzzle)) : ninjaArtGame) as typeof ninjaArtGame}
      sounds={ninjaSounds}
      checkpoint={(moon ? moonCheckpoint : ninjaCheckpoint) as typeof ninjaCheckpoint}
      interval={NINJA_CHECKPOINT_INTERVAL}
      encodeRun={(moon ? encodeMoonRun : encodeNinjaRun) as typeof encodeNinjaRun}
      discrete
      inputKind={NINJA_INPUT_TAP}
      // Moon Climb: a tap's side picks the wall to leap towards from a sky lantern (left half −1, right half 1).
      pointer={(kind, x) => (kind === "down" ? { a: moon ? (x < NINJA_WORLD_W / 2 ? -1 : 1) : 0, b: 0, c: 0 } : null)}
      keys={(kind, key, send, _state, event) => {
        const left = moon && (key === "ArrowLeft" || key === "a");
        const right = moon && (key === "ArrowRight" || key === "d");
        if (key !== " " && key !== "ArrowUp" && key !== "w" && !left && !right) return false;
        if (kind === "down" && !event.repeat) send({ a: left ? -1 : right ? 1 : 0, b: 0, c: 0 });
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function ninjaLine(r: { metres: number; coins: number; lanterns: number; scrolls: number }): string {
  return `${r.metres} m climbed · ${r.coins} coins, ${r.lanterns} lanterns, ${r.scrolls} scrolls`;
}

export function moonLine(r: { metres: number; rides: number; bestFlow: number; scrolls: number }): string {
  return `${r.metres} m climbed · ${r.rides} of ${MOON_SKY} lantern rides, best flow ${r.bestFlow}, ${r.scrolls} of ${MOON_SCROLLS} scrolls`;
}

function NinjaReveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "ricochet") return null;
  // Moon Climb: the climb's picture (stage 2), the same the arcade reveal draws.
  if (isMoonRev(puzzle.ricoRev)) return myAnswer ? <RunPicture puzzle={puzzle} myAnswer={myAnswer} /> : null;
  const r = replayNinjaRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{ninjaLine(r)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{r.hits === 1 ? "1 hit" : `${r.hits} hits`} · {r.djs} double jumps</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same tower for everyone</p>
    </div>
  );
}

/* ===================== The answer reveal's run picture (stage 2) ===================== */

/** The run picture's canvas height (CSS px): the shaft drawn tall. */
const MOON_PICTURE_H = 360;

/** One big number with its short label. */
function MoonStat({ value, label, name }: { value: string; label: string; name: string }) {
  return (
    <div data-moon-stat={name} className="flex min-w-0 flex-1 flex-col items-center">
      <span className="text-3xl font-extrabold leading-none tabular-nums text-foreground">{value}</span>
      <span className="mt-1 whitespace-nowrap text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

/** A legend entry: its mark and a short plain label. */
function MoonLegend({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <span data-moon-legend={name} className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-foreground">
      <span aria-hidden="true" className="inline-flex h-4 w-5 items-center justify-center">
        {children}
      </span>
      {label}
    </span>
  );
}

/**
 * The answer reveal's picture of the climb (the Action overhaul, stage 2, 15 Nov 2026; display only): the stored log
 * replayed through the real sim (moonRunSummary), drawn as the shaft with the route, the hits and what was taken
 * (drawMoonRunPicture), with the four numbers that explain the score big above it and a legend under it. Never a
 * grade: the score is the stored one. ricoRev 2 rounds show their four numbers alone; the original shaft nothing.
 */
export function RunPicture({ puzzle, myAnswer }: RunPictureProps) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const moon = puzzle.type === "ricochet" && isMoonRev(puzzle.ricoRev);
  const summary = useMemo(() => (puzzle.type === "ricochet" && moon ? moonRunSummary(puzzle.seed, myAnswer, puzzle.ricoRev, puzzleLevel(puzzle)) : null), [puzzle, myAnswer, moon]);
  const ninja = useMemo(() => (puzzle.type === "ricochet" && !moon && isNinjaRev(puzzle.ricoRev) ? replayNinjaRun(puzzle.seed, myAnswer) : null), [puzzle, myAnswer, moon]);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !summary) return;
    const width = Math.max(220, Math.min(380, Math.round(wrap.current?.getBoundingClientRect().width || 320)));
    const ratio = arcadeCanvasRatio();
    node.width = Math.round(width * ratio);
    node.height = Math.round(MOON_PICTURE_H * ratio);
    node.style.width = `${width}px`;
    node.style.height = `${MOON_PICTURE_H}px`;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawMoonRunPicture(ctx, summary, { width, height: MOON_PICTURE_H });
  }, [summary]);
  if (ninja) {
    return (
      <div data-moon-run-picture="rev2" className="flex w-full shrink-0 items-start justify-center gap-2">
        <MoonStat name="height" value={`${ninja.metres} m`} label="Height" />
        <MoonStat name="coins" value={String(ninja.coins)} label="Coins" />
        <MoonStat name="lanterns" value={String(ninja.lanterns)} label="Lanterns" />
        <MoonStat name="scrolls" value={String(ninja.scrolls)} label="Scrolls" />
      </div>
    );
  }
  if (!summary) return null;
  return (
    <div data-moon-run-picture="" className="flex w-full shrink-0 flex-col items-center gap-3">
      <div className="flex w-full items-start justify-center gap-1">
        <MoonStat name="height" value={`${summary.metres} m`} label="Height" />
        <MoonStat name="flow" value={String(summary.bestStreak)} label="Best flow" />
        <MoonStat name="rides" value={`${summary.rideCount}/${summary.rideTotal}`} label={summary.rideTotal === 1 ? "Ride" : "Rides"} />
        <MoonStat name="scrolls" value={`${summary.scrollCount}/${summary.scrollTotal}`} label="Scrolls" />
      </div>
      <div ref={wrap} className="flex w-full justify-center">
        <canvas
          ref={canvas}
          role="img"
          data-moon-shaft
          className="block rounded-xl"
          style={{ height: MOON_PICTURE_H, width: "100%", maxWidth: 380 }}
          aria-label={`Your climb: ${summary.metres} metres, ${summary.hitCount} ${summary.hitCount === 1 ? "hit" : "hits"}, ${summary.rideCount} lantern ${summary.rideCount === 1 ? "ride" : "rides"}, ${summary.scrollCount} ${summary.scrollCount === 1 ? "scroll" : "scrolls"}`}
        />
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <MoonLegend name="flow" label="Best flow">
          <span className="block h-[3px] w-5 rounded" style={{ background: MOON_RUN_COLOURS.flow }} />
        </MoonLegend>
        {summary.hitCount > 0 ? (
          <MoonLegend name="hit" label={summary.hitCount === 1 ? "1 hit" : `${summary.hitCount} hits`}>
            <span className="block h-2.5 w-2.5 rounded-full" style={{ background: MOON_RUN_COLOURS.hit }} />
          </MoonLegend>
        ) : null}
        <MoonLegend name="full" label={`Full height ${summary.fullM} m`}>
          <span className="block w-5 border-t-2 border-dashed" style={{ borderColor: MOON_RUN_COLOURS.full }} />
        </MoonLegend>
      </div>
    </div>
  );
}

function Stage(props: PuzzleStageProps) {
  const rev = props.puzzle.type === "ricochet" ? props.puzzle.ricoRev : undefined;
  return isNinjaRev(rev) ? <NinjaStage {...props} /> : <RicoV1Stage {...props} />;
}

function Reveal(props: PuzzleRevealProps) {
  const rev = props.puzzle.type === "ricochet" ? props.puzzle.ricoRev : undefined;
  return isNinjaRev(rev) ? <NinjaReveal {...props} /> : <RicoV1Reveal {...props} />;
}

/** The seed is generated on the server; every run is replayed there for scoring. Rooms and practice deal ricoRev 5 (Moon Climb, the 30 × 60 ninja). */
export const ricochetPuzzle: PuzzleDefinition = {
  key: "ricochet",
  name: gameDisplayName("ricochet"),
  category: "arcade",
  timeLimitMs: (NINJA_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "ricochet", seed: 1, ricoRev: MOON_MID_REV }) satisfies RicoPuzzleData,
  check: () => false,
  revealHeading: "Your climb",
  IntroExample,
  Stage,
  Reveal,
  RunPicture,
};
