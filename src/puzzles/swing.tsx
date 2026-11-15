import { directionOf } from "@/lib/desktop";
import { swingFillFor } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef } from "react";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { noteSwingPress } from "@/lib/arcade/swingPress";
import { SWING_END_HOLD_MS } from "@/lib/arcade/swingEffects.renderer";
import { traceSwingRun } from "@/lib/duel/swingRunTrace";
import { drawSwingRunPicture, swingRunPictureHeight, SWING_RUN_COLOURS } from "@/lib/arcade/swingReveal.renderer";

import {
  SWING_INPUT_REEL,
  SWING_REEL_DOWN,
  SWING_REEL_UP,
  swingCheckpoint,
  SWING_REV,
  SWING_REV_BAND,
  SWING_REV_TUNED,
  SWING_REV_TUNEC,
  SWING_REV_SPREAD,
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK, SWING_REV_SLIDE, SWING_REV_BIG,
  swingWorldHFor,
  swingWorldWFor,
  SWING_CHECKPOINT_INTERVAL,
  SWING_GOLD,
  SWING_INPUT_HOLD,
  type SwingState,
} from "@/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "@/lib/duel/swing";
import { SWING_TIME_MS, type SwingPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { swingArtGameFor, swingJungleScene, swingJungleSceneKey, type SwingJungleScene } from "@/lib/arcade/swing.renderer";
import { SWING_DEPTH_STEPS } from "@/lib/arcade/swingJungle.renderer";
import { swingSounds } from "@/lib/fx/gameSounds";
import { ArtStill } from "@/components/puzzles/ArtStill";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps, RunPictureProps } from "./types";

/** The intro still's course: the first course rooms deal on swingRev 18 (swingBigDeal.server.ts), built in the sim. */
const SWING_INTRO_SEED = 1560728537;

/**
 * The intro still (the Action overhaul, 15 Nov 2026): swingRev 17's own jungle drawn by the game's renderer on a fixed
 * course a second and a half in, the hero swinging from the first vine (no placeholder drawing). Display only.
 */
function IntroExample() {
  return (
    <ArtStill
      game={swingArtGameFor(SWING_REV_BIG)}
      worldW={swingWorldWFor(SWING_REV_BIG)}
      worldH={swingWorldHFor(SWING_REV_BIG)}
      seed={SWING_INTRO_SEED}
      ticks={90}
      input={null}
      caption="Swing vine to vine over the river: let go to fly, hold to grab the next loop. Tree platforms and squeezes between. Fall in the river: back to your last vine."
    />
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SwingPuzzleData | null = puzzle.type === "swing" ? puzzle : null;
  const start = useRef<{ y: number } | null>(null);
  const spaceHeld = useRef(false);
  // Edge to edge (15 Nov 2026): the screen fill follows the jungle's depth step, a platform run's shade and its dim
  // (sceneKey repaints the static fill only when one changes: a few dozen times a run, never per frame).
  const scene = useRef<SwingJungleScene>({ step: 0, darkRight: false, dim: false });
  return (
    <ArcadeCanvasStage
      diagKey="swing"
      scene={swingFillFor(data?.swingRev, () => ({ depth: scene.current.step / SWING_DEPTH_STEPS, darkRight: scene.current.darkRight, dim: scene.current.dim }))}
      sceneKey={(s: SwingState) => (data?.swingRev === SWING_REV_SLIDE || data?.swingRev === SWING_REV_BIG ? swingJungleSceneKey((scene.current = swingJungleScene(s))) : 0)}
      label={gameDisplayName("swing")}
      background="transparent"
      fitWorld
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      // swingRev 13, 14, 15, 16 and 17: the wider view (450 × 844); 390 wide on every earlier revision.
      worldW={swingWorldWFor(data?.swingRev)}
      // swingRev 9: the taller cavern; every phone draws the stored revision's world.
      worldH={swingWorldHFor(data?.swingRev)}
      game={swingArtGameFor(data?.swingRev)}
      sounds={swingSounds}
      // Stage 2: the end banner and the stretches tallying are seen before the answer goes (the jungle only).
      endHoldMs={(s: SwingState) => (s.slide ? SWING_END_HOLD_MS : 0)}
      checkpoint={swingCheckpoint}
      interval={SWING_CHECKPOINT_INTERVAL}
      encodeRun={encodeSwingRun}
      discrete
      inputKind={SWING_INPUT_HOLD}
      pointer={(kind, _x, y) => {
        if (kind === "down") {
          start.current = { y };
          // Display only: the out-of-reach moment judges this press a few ticks on (swingPress.ts).
          noteSwingPress();
          return { a: 1, b: 0, c: 0 };
        }
        if (kind === "up") {
          start.current = null;
          return { a: 0, b: 0, c: 0 };
        }
        // While holding, a vertical swipe of 24 px reels the rope in (up) or out (down).
        const from = start.current;
        if (!from || Math.abs(y - from.y) < 24) return null;
        const dir = y < from.y ? SWING_REEL_UP : SWING_REEL_DOWN;
        from.y = y;
        return { k: SWING_INPUT_REEL, a: dir, b: 0, c: 0 };
      }}
      keys={(kind, key, send, _state, event) => {
        // Space is the finger: held shoots and swings, let go releases; ↑/↓ while held reel in and out.
        if (key === " ") {
          if (event.repeat) return true;
          if (kind === "down" && !spaceHeld.current) {
            spaceHeld.current = true;
            noteSwingPress();
            send({ a: 1, b: 0, c: 0 });
          } else if (kind === "up" && spaceHeld.current) {
            spaceHeld.current = false;
            send({ a: 0, b: 0, c: 0 });
          }
          return true;
        }
        const dir = directionOf(key);
        if (dir !== "up" && dir !== "down") return false;
        if (kind === "down" && spaceHeld.current) send({ k: SWING_INPUT_REEL, a: dir === "up" ? SWING_REEL_UP : SWING_REEL_DOWN, b: 0, c: 0 });
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function swingLine(r: { metres: number; survived: boolean; survivedSeconds: number; cause?: number; sections?: number; sectionTotal?: number; restarts?: number }): string {
  // swingRev 14 to 17 (the assault and swinging courses): sections cleared and restarts.
  if (r.sectionTotal !== undefined && r.restarts !== undefined) return `Section ${r.sections ?? 0} / ${r.sectionTotal} · ${r.restarts} restart${r.restarts === 1 ? "" : "s"}`;
  if (r.survived) return `${r.metres} m · survived`;
  return r.cause === 1 ? `${r.metres} m · caught by the dragon at ${r.survivedSeconds.toFixed(1)}s` : `${r.metres} m · fell at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "swing") return null;
  const result = replaySwingRun(puzzle.seed, myAnswer ?? "", puzzle.swingRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {swingLine(result)}
      </p>
      {(puzzle.swingRev === SWING_REV || puzzle.swingRev === SWING_REV_BAND || puzzle.swingRev === SWING_REV_TUNED || puzzle.swingRev === SWING_REV_TUNEC || puzzle.swingRev === SWING_REV_SPREAD || puzzle.swingRev === SWING_REV_TALL || puzzle.swingRev === SWING_REV_TARGET || puzzle.swingRev === SWING_REV_STRICT || puzzle.swingRev === SWING_REV_EXPAND) && (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.stars ?? 0} / {result.starTotal ?? 0} stars
        </p>
      )}
      {(puzzle.swingRev === SWING_REV_SLIDE || puzzle.swingRev === SWING_REV_BIG) && "streakPaid" in result && (
        <p className="shrink-0 whitespace-normal break-words text-center font-mono text-sm text-muted-foreground">
          {result.parsBeaten} under par · {result.gates} / {result.gateTotal} gates · streak +{result.streakPoints}
        </p>
      )}
      {(puzzle.swingRev === SWING_REV_ASSAULT || puzzle.swingRev === SWING_REV_REWORK || puzzle.swingRev === SWING_REV_DARK) && "starsBanked" in result && (
        <p className="shrink-0 whitespace-normal break-words text-center font-mono text-sm text-muted-foreground">
          {result.parsBeaten} under par · {result.gates} / {result.gateTotal} gates · {result.gems} / {result.gemTotal} gems · {result.starsBanked} / {result.starTotal} stars
        </p>
      )}
      {puzzle.swingRev === SWING_REV_EXPAND && "gems" in result && (
        <p className="shrink-0 whitespace-normal break-words text-center font-mono text-sm text-muted-foreground">
          {result.gems} / {result.gemTotal} gems · {result.gates} / {result.gateTotal} gates · {result.ledges} / {result.ledgeTotal} ledges · best chain {result.bestChain}
        </p>
      )}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{puzzle.swingRev === SWING_REV_ASSAULT || puzzle.swingRev === SWING_REV_REWORK || puzzle.swingRev === SWING_REV_DARK || puzzle.swingRev === SWING_REV_SLIDE || puzzle.swingRev === SWING_REV_BIG ? "Same course for everyone" : "Same cavern for everyone"}</p>
    </div>
  );
}

/** A big number with its short label (the run picture's key numbers). */
function BigStat({ name, label, value, of, unit }: { name: string; label: string; value: number; of?: number; unit?: string }) {
  return (
    <div data-swing-stat={name} className="flex min-w-0 flex-col items-center rounded-xl bg-white/5 px-1.5 py-2">
      <span className="text-2xl font-extrabold leading-tight tabular-nums text-foreground">
        {value}
        {unit ? <span className="text-base font-bold">{unit}</span> : null}
        {of !== undefined ? <span className="text-base font-bold text-muted-foreground">/{of}</span> : null}
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

function Legend({ colour, label, kind }: { colour: string; label: string; kind: "line" | "drop" | "wedge" | "dash" }) {
  const mark =
    kind === "line" ? (
      <span aria-hidden className="inline-block h-1 w-4 rounded" style={{ background: colour }} />
    ) : kind === "dash" ? (
      <span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: colour }} />
    ) : kind === "drop" ? (
      <span aria-hidden className="inline-block h-2.5 w-2 rounded-full" style={{ background: colour }} />
    ) : (
      <span aria-hidden className="text-sm font-black leading-none" style={{ color: colour }}>▼</span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {mark}
      {label}
    </span>
  );
}

/**
 * The arcade reveal's run picture (PuzzleDefinition.RunPicture; the Action overhaul, stage 2, 15 Nov 2026; display
 * only): the jungle course (swingRev 17+) as a path of its stretches from the stored run replayed by the server's own
 * replay (traceSwingRun), drawn by drawSwingRunPicture, with the four numbers that explain the score big above it and a
 * legend under it. Older stamps draw nothing here.
 */
export function SwingRunPicture({ puzzle, myAnswer }: RunPictureProps) {
  const trace = useMemo(
    () => (puzzle.type === "swing" && (puzzle.swingRev ?? 0) >= SWING_REV_SLIDE && myAnswer ? traceSwingRun(puzzle.seed, myAnswer, puzzle.swingRev) : null),
    [puzzle, myAnswer],
  );
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !trace) return;
    const width = Math.max(240, Math.round(wrap.current?.getBoundingClientRect().width || 340));
    const height = swingRunPictureHeight(width);
    const ratio = arcadeCanvasRatio();
    node.width = Math.round(width * ratio);
    node.height = Math.round(height * ratio);
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawSwingRunPicture(ctx, trace, { width, height });
  }, [trace]);
  if (!trace) return null;
  return (
    <div data-swing-run-picture="" className="flex w-full shrink-0 flex-col items-center gap-3">
      {trace.finished ? <p data-swing-course-cleared="" className="text-xl font-extrabold text-foreground">Course cleared!</p> : null}
      <div className="grid w-full max-w-sm grid-cols-4 gap-2">
        <BigStat name="course" label="Course" value={trace.percent} unit="%" />
        <BigStat name="stretches" label="Stretches" value={trace.cleared} of={trace.total} />
        <BigStat name="pars" label="Under par" value={trace.underPar} />
        <BigStat name="gates" label="Gates" value={trace.gates} of={trace.gateTotal} />
      </div>
      <div ref={wrap} className="w-full">
        <canvas
          ref={canvas}
          role="img"
          data-swing-course-path=""
          className="block w-full"
          aria-label={`The course: ${trace.cleared} of ${trace.total} stretches cleared, ${trace.underPar} under par, ${trace.falls} ${trace.falls === 1 ? "fall" : "falls"}, ${trace.gates} of ${trace.gateTotal} gates`}
        />
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
        <Legend kind="line" colour={SWING_RUN_COLOURS.under} label="Under par" />
        <Legend kind="line" colour={SWING_RUN_COLOURS.cleared} label="Cleared" />
        {trace.finished ? null : <Legend kind="dash" colour={SWING_RUN_COLOURS.current} label="Ended here" />}
        {trace.falls > 0 ? <Legend kind="drop" colour={SWING_RUN_COLOURS.fall} label={trace.falls === 1 ? "Fell once" : `Fell ${trace.falls} times`} /> : null}
        {trace.caught > 0 ? <Legend kind="wedge" colour={SWING_RUN_COLOURS.caught} label="Caught" /> : null}
        <span data-swing-best-streak="" className="whitespace-nowrap">Best streak {trace.bestStreak}</span>
      </div>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const swingPuzzle: PuzzleDefinition = {
  key: "swing",
  name: gameDisplayName("swing"),
  category: "arcade",
  timeLimitMs: SWING_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "swing", seed: 1, swingRev: SWING_REV_STRICT }) satisfies SwingPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
  RunPicture: SwingRunPicture,
};
