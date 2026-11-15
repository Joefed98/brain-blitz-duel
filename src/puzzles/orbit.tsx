import { orbitFill } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState } from "react";
import { orbitDevPlanet } from "@/lib/arcade/orbitDevJump";
import { ORBIT_CHECKPOINT_HOLD_MS } from "@/lib/arcade/orbitCheckpointHold";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import {
  orbitBeltPlanets,
  orbitCanSetCheckpoint,
  orbitDevStart,
  orbitCheckpoint,
  ORBIT_BG,
  ORBIT_CHECKPOINT_INTERVAL,
  ORBIT_COLOURS,
  ORBIT_GOLD,
  ORBIT_INPUT_TAP,
  ORBIT_INPUT_CHECKPOINT,
  ORBIT_RED,
  ORBIT_WORLD_W,
} from "@/lib/arcade/orbit";
import { encodeOrbitRun, replayOrbitRun } from "@/lib/duel/orbit";
import { ORBIT_TIME_MS, type OrbitPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { orbitArtGame, orbitDrawHFor, orbitEndHoldMs, orbitRev3ArtGame } from "@/lib/arcade/orbit.renderer";
import { initBandFrom, initRev3From, initRev4From, initSweptFrom, initTallFrom, initTargetFrom, initStrictFrom, initTunedFrom, decodeOrbitHoles, decodeRev3Planets, orbitStartForPuzzle, orbitWorldWFor, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "@/lib/arcade/orbitRev3";
import { ArtStill } from "@/components/puzzles/ArtStill";
import { ORBIT_INTRO_COURSE } from "./orbitIntroCourse.data";
import { ORBIT_REV_BIG, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TARGET, ORBIT_REV_STRICT, ORBIT_REV_TUNED, orbitXpRev } from "@/lib/arcade/orbit";
import { orbitSounds } from "@/lib/fx/gameSounds";
import { FxCountUp } from "@/components/fx/GameFx";
import { preloadOrbitPlanetMaps } from "@/lib/arcade/orbitPlanets.renderer";
import { canvasRatio } from "@/lib/battery";
import { drawOrbitRunMap, ORBIT_MAP_COLOURS } from "@/lib/arcade/orbitReveal.renderer";
import { traceOrbitRun, type OrbitRunTrace } from "@/lib/duel/orbitRunTrace";
import { ORBIT_TOTAL } from "@/lib/arcade/orbit";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps, RunPictureProps } from "./types";

// Stage 2: the planet maps load with the game's chunk (rooms and practice preload it for the intro), so the first frame of
// play draws the Blender planets rather than the fallback.
preloadOrbitPlanetMaps();

/**
 * The intro still (the Action overhaul, 15 Nov 2026): the live renderer on the dealt revision (orbitRev 16), on the fixed
 * intro example's course (ORBIT_INTRO_COURSE), two seconds in: the rendered planets, their orbits, the stardust ahead,
 * the HUD and the fuel meter, as a round opens.
 */
const introGame = (() => {
  const start = orbitStartForPuzzle({ orbitRev: ORBIT_REV_BIG, ...(ORBIT_INTRO_COURSE as unknown as Pick<OrbitPuzzleData, "planets" | "holes" | "extras">) });
  return { ...orbitRev3ArtGame, init: () => start!() } as unknown as typeof orbitRev3ArtGame;
})();

function IntroExample() {
  return (
    <ArtStill
      game={introGame as never}
      worldW={orbitWorldWFor(ORBIT_REV_BIG)}
      worldH={orbitDrawHFor(ORBIT_REV_BIG)}
      ticks={120}
      input={null as never}
      shownW={180}
      caption="Let go on the first lap; collect stardust, sling past moons, thread the rocks."
    />
  );
}

/**
 * SET CHECKPOINT, guarded (the Action overhaul, 15 Nov 2026; input mapping only, every revision): the press must be held
 * ORBIT_CHECKPOINT_HOLD_MS, a gold fill sweeping across the button meanwhile, before its one input is sent, so a tap that
 * lands on the corner by accident can't spend the checkpoint. Let go early and nothing is sent.
 */
function CheckpointHoldButton({ onSet, className }: { onSet: () => void; className?: string }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <ArcadeControlButton
      type="button"
      aria-label="Hold to set checkpoint"
      data-orbit-checkpoint-hold={ORBIT_CHECKPOINT_HOLD_MS}
      className={`relative h-11 overflow-hidden px-3 font-bold ${className ?? ""}`}
      style={{ fontSize: 11 }}
      onPressStart={() => {
        stop();
        setHolding(true);
        timer.current = setTimeout(() => {
          timer.current = null;
          setHolding(false);
          onSet();
        }, ORBIT_CHECKPOINT_HOLD_MS);
      }}
      onPressEnd={() => {
        stop();
        setHolding(false);
      }}
    >
      <span
        data-orbit-checkpoint-fill=""
        className="absolute inset-y-0 left-0 opacity-40"
        style={{ background: "var(--jz-gold)", width: holding ? "100%" : "0%", transition: holding ? `width ${ORBIT_CHECKPOINT_HOLD_MS}ms linear` : "none" }}
      />
      <span className="relative">SET CHECKPOINT</span>
    </ArcadeControlButton>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: OrbitPuzzleData | null = puzzle.type === "orbit" ? puzzle : null;
  const [canSet, setCanSet] = useState(true);
  const availability = useRef(true);
  // Dev-only practice jump (?planet=N with the accepted key); such runs are never graded.
  const [devPlanet] = useState(() => (data ? orbitDevPlanet() : null));
  const game = useMemo(() => {
    if (devPlanet) return { ...orbitArtGame, init: (seed: number) => orbitDevStart(orbitArtGame.init(seed), devPlanet) };
    // orbitRev 12 (world expansion) and 13 (its play on the arcade standard): the bank course, holes and features in the bigger view.
    const xpStart = orbitXpRev(data?.orbitRev) ? orbitStartForPuzzle(data!) : null;
    if (xpStart) return { ...orbitRev3ArtGame, init: xpStart } as unknown as typeof orbitArtGame;
    if ((data?.orbitRev === ORBIT_REV4 || data?.orbitRev === ORBIT_REV_BAND || data?.orbitRev === ORBIT_REV_TUNED || data?.orbitRev === ORBIT_REV_SWEPT || data?.orbitRev === ORBIT_REV_TALL || data?.orbitRev === ORBIT_REV_TARGET || data?.orbitRev === ORBIT_REV_STRICT) && data.planets) {
      const planets = decodeRev3Planets(data.planets);
      const holes = decodeOrbitHoles(data.holes ?? []);
      const start = data.orbitRev === ORBIT_REV_STRICT ? initStrictFrom : data.orbitRev === ORBIT_REV_TARGET ? initTargetFrom : data.orbitRev === ORBIT_REV_TALL ? initTallFrom : data.orbitRev === ORBIT_REV_SWEPT ? initSweptFrom : data.orbitRev === ORBIT_REV_TUNED ? initTunedFrom : data.orbitRev === ORBIT_REV_BAND ? initBandFrom : initRev4From;
      return { ...orbitRev3ArtGame, init: () => start(planets, ORBIT_REV3_WORLD_W, holes) } as unknown as typeof orbitArtGame;
    }
    if (data?.orbitRev === ORBIT_REV3 && data.planets) {
      const planets = decodeRev3Planets(data.planets);
      return { ...orbitRev3ArtGame, init: () => initRev3From(planets, ORBIT_REV3_WORLD_W) } as unknown as typeof orbitArtGame;
    }
    return orbitArtGame;
  }, [devPlanet, data]);
  const xp = orbitXpRev(data?.orbitRev);
  const belts = useMemo(() => (devPlanet && data ? orbitBeltPlanets(orbitArtGame.init(data.seed)) : []), [devPlanet, data]);
  return (
    <>
    {devPlanet && (
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        DEV · start planet {devPlanet} · belts {belts.length ? belts.join(", ") : "none"} · not scored
      </p>
    )}
    <ArcadeCanvasStage
      diagKey="orbit"
      scene={orbitFill}
      label={gameDisplayName("orbit")}
      background="transparent"
      fitWorld
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      // orbitRev 12 and 13: the 450 × 782 view (390 wide on every earlier revision).
      worldW={orbitXpRev(data?.orbitRev) ? orbitWorldWFor(data?.orbitRev) : ORBIT_WORLD_W}
      // orbitRev 8: the taller view (620 on every earlier revision); orbitRev 12 drawn to the screen's bottom (display only).
      worldH={orbitDrawHFor(data?.orbitRev)}
      game={game}
      sounds={orbitSounds}
      checkpoint={orbitCheckpoint}
      interval={ORBIT_CHECKPOINT_INTERVAL}
      encodeRun={encodeOrbitRun}
      discrete
      inputKind={ORBIT_INPUT_TAP}
      tickInput={(state) => {
        const next = orbitCanSetCheckpoint(state);
        if (availability.current !== next) {
          availability.current = next;
          setCanSet(next);
        }
        return null;
      }}
      // orbitRev 12 and 13 (Joe's phone notes, 27 Oct 2026): the world reaches the screen's bottom and SET CHECKPOINT sits in
      // the reserved top-right corner of the rows drawn above the camera's frame (ORBIT_XP_ZONE, orbit.renderer.ts),
      // where nothing in play is ever drawn: 4 px in from the world's top and right edges, 44 px tall, 11 px text and
      // 12 px sides. Only the button takes a touch: a tap beside it reaches the canvas (a release). Earlier revisions
      // keep the 44 px row under the world.
      overlay={xp ? (send) => (
        <div data-game-controls="checkpoint" data-orbit-zone="" className="pointer-events-none absolute right-1 top-1 flex h-11 items-start justify-end">
          {canSet && !locked && (
            <CheckpointHoldButton className="pointer-events-auto" onSet={() => send({ k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0 })} />
          )}
        </div>
      ) : undefined}
      footer={xp ? undefined : (send) => (
        // The 44 px button's row ends 16 px above the bottom of the screen, as every arcade control row; the
        // button is 44 px tall with 11 px text and 12 px sides, narrower than before (15 Oct 2026, display only).
        <div data-game-controls="checkpoint" className="flex h-11 shrink-0 items-center justify-center">
          {canSet && !locked && (
            <CheckpointHoldButton onSet={() => send({ k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0 })} />
          )}
        </div>
      )}
      pointer={(kind) => (kind === "down" ? { a: 0, b: 0, c: 0 } : null)}
      keys={(kind, key, send, state, event) => {
        // Space releases the rocket (a tap); C sets a checkpoint, only while the button shows.
        if (key === " ") {
          if (kind === "down" && !event.repeat) send({ a: 0, b: 0, c: 0 });
          return true;
        }
        if (key === "c") {
          if (kind === "down" && !event.repeat && orbitCanSetCheckpoint(state)) send({ k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0 });
          return true;
        }
        return false;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
      // orbitRev 14: a run that ran dry plays its 0.6 s sputter before it is sent (display only).
      endHoldMs={(state) => orbitEndHoldMs(state as unknown as OrbitRev3State)}
    />
    </>
  );
}

export function orbitLine(r: { passed: number; total: number; survived: boolean; survivedSeconds: number; finished: boolean; secondsLeft: number; jumps?: number; skipped?: number }): string {
  const holes = r.jumps ? ` · ${r.jumps} black hole${r.jumps === 1 ? "" : "s"} (+${r.skipped ?? 0} planets)` : "";
  if (r.finished) return `${r.passed} / ${r.total} · finished with ${r.secondsLeft.toFixed(1)}s left${holes}`;
  const head = `${r.passed} / ${r.total} planets${holes}`;
  return r.survived ? `${head} · survived` : `${head} · lost at ${r.survivedSeconds.toFixed(1)}s`;
}

/** orbitRev 12: the features a run took. */
export function orbitXpLine(x: { dust: number; dustTotal: number; slings: number; slingsTotal: number; threads: number; threadsTotal: number; perfect: number }): string {
  return `Stardust ${x.dust}/${x.dustTotal} · slingshots ${x.slings}/${x.slingsTotal} · fields ${x.threads}/${x.threadsTotal} · ${x.perfect} perfect orbits`;
}

/** The course map's drawing size (CSS px; the canvas scales to the reveal's width, keeping this shape). */
const MAP_W = 360;
const MAP_H = 300;

/**
 * The course map canvas (stage 2): drawn once per size at the device's pixel ratio from the trace (no frame loop).
 */
function RunMap({ trace }: { trace: OrbitRunTrace }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(MAP_W);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const measure = () => setWidth(Math.max(240, Math.min(420, Math.round(c.parentElement?.clientWidth ?? MAP_W))));
    measure();
    if (typeof ResizeObserver === "undefined" || !c.parentElement) return;
    const ro = new ResizeObserver(measure);
    ro.observe(c.parentElement);
    return () => ro.disconnect();
  }, []);
  const height = Math.round((width * MAP_H) / MAP_W);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ratio = canvasRatio();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawOrbitRunMap(ctx, trace, width, height);
  }, [trace, width, height]);
  return (
    <canvas
      ref={ref}
      data-orbit-run-map=""
      role="img"
      aria-label={`Course map: ${trace.finished ? "the sun reached" : `${trace.best} of ${ORBIT_TOTAL} planets reached`}, ${trace.slips.length} slip${trace.slips.length === 1 ? "" : "s"}`}
      style={{ width, height }}
    />
  );
}

/** A big number with its short label (the reveal's key numbers). */
function BigStat({ label, value, of, countUp = false }: { label: string; value: number; of?: number; countUp?: boolean }) {
  return (
    <div data-orbit-stat={label} className="flex min-w-0 flex-col items-center rounded-xl bg-white/5 px-2 py-2">
      <span className="text-2xl font-extrabold leading-tight tabular-nums text-foreground">
        {countUp ? <FxCountUp value={value} silent /> : value}
        {of !== undefined ? <span className="text-base font-bold text-muted-foreground">/{of}</span> : null}
      </span>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

function LegendMark({ kind }: { kind: "flight" | "fuel" | "crash" | "dust" | "moon" }) {
  const colour = ORBIT_MAP_COLOURS[kind];
  const text = { flight: "Flights", fuel: "Out of fuel", crash: "Crash", dust: "Stardust", moon: "Slingshot" }[kind];
  const mark =
    kind === "flight" ? (
      <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: colour }} />
    ) : kind === "fuel" || kind === "crash" ? (
      <span aria-hidden className="text-base font-black leading-none" style={{ color: colour }}>
        {kind === "fuel" ? "✕" : "✶"}
      </span>
    ) : kind === "dust" ? (
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: colour }} />
    ) : (
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: colour }} />
    );
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {mark}
      {text}
    </span>
  );
}

/**
 * Stage 2's reveal (15 Nov 2026): the run as a picture, a course map of the replayed run (folded into four columns, start
 * bottom left, the sun top right), with its key numbers big above it: planets (counting up), stardust, slingshots and
 * slips. The score's parts are the reveal's breakdown just above. Older stamps (no features) draw nothing here.
 */
function RunView({ trace }: { trace: OrbitRunTrace }) {
  const fuel = trace.slips.filter((s) => s.kind === "fuel").length;
  const crashes = trace.slips.length - fuel;
  return (
    <div data-orbit-run-summary="" className="flex w-full shrink-0 flex-col items-center gap-3">
      {trace.finished ? <p data-orbit-all-planets="" className="text-xl font-extrabold text-foreground">All {ORBIT_TOTAL} planets!</p> : null}
      <div className="grid w-full max-w-sm grid-cols-4 gap-2">
        <BigStat label="Planets" value={trace.best} of={ORBIT_TOTAL} countUp />
        <BigStat label="Stardust" value={trace.counts.dust} of={trace.counts.dustTotal} />
        <BigStat label="Slings" value={trace.counts.slings} of={trace.counts.slingsTotal} />
        <BigStat label={trace.slips.length === 1 ? "Slip" : "Slips"} value={trace.slips.length} />
      </div>
      <RunMap trace={trace} />
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
        <LegendMark kind="flight" />
        {fuel ? <LegendMark kind="fuel" /> : null}
        {crashes ? <LegendMark kind="crash" /> : null}
        <LegendMark kind="dust" />
        <LegendMark kind="moon" />
      </div>
    </div>
  );
}

/** The arcade reveal's run picture (PuzzleDefinition.RunPicture): the expansion's view only (orbitRev 12+). */
export function OrbitRunPicture({ puzzle, myAnswer }: RunPictureProps) {
  const trace = useMemo(() => (puzzle.type === "orbit" && orbitXpRev(puzzle.orbitRev) && myAnswer ? traceOrbitRun(puzzle, myAnswer) : null), [puzzle, myAnswer]);
  return trace ? <RunView trace={trace} /> : null;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "orbit") return null;
  // The expansion's view (orbitRev 12+): the run's picture (stage 2), the same the arcade reveal draws, never the old
  // block of text lines (15 Nov 2026). Earlier revisions keep their lines.
  if (orbitXpRev(puzzle.orbitRev)) return myAnswer ? <OrbitRunPicture puzzle={puzzle} myAnswer={myAnswer} /> : null;
  const result = replayOrbitRun(puzzle.seed, myAnswer ?? "", puzzle.orbitRev, puzzle.planets, puzzle.holes, puzzle.extras);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {orbitLine(result)}
      </p>
      {result.xp ? (
        <p className="shrink-0 text-center font-mono text-base text-foreground">
          {orbitXpLine(result.xp)}
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same planets for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const orbitPuzzle: PuzzleDefinition = {
  key: "orbit",
  name: gameDisplayName("orbit"),
  category: "arcade",
  timeLimitMs: ORBIT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "orbit", seed: 1 }) satisfies OrbitPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
  RunPicture: OrbitRunPicture,
};
