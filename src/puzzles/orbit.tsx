import { orbitFill } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useMemo, useRef, useState } from "react";
import { orbitDevPlanet } from "@/lib/arcade/orbitDevJump";
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
import { orbitArtGame, orbitRev3ArtGame } from "@/lib/arcade/orbit.renderer";
import { initBandFrom, initRev3From, initRev4From, initSweptFrom, initTallFrom, initTunedFrom, decodeOrbitHoles, decodeRev3Planets, orbitWorldHFor, ORBIT_REV3_WORLD_W } from "@/lib/arcade/orbitRev3";
import { ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TUNED } from "@/lib/arcade/orbit";
import { orbitSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the ship leaving one orbit toward the next planet. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 150" width={168} height={150} aria-hidden="true" style={{ background: ORBIT_BG, borderRadius: 10 }}>
        <circle cx={50} cy={110} r={30} fill="none" stroke={ORBIT_COLOURS[0]} strokeOpacity={0.25} />
        <circle cx={50} cy={110} r={12} fill="none" stroke={ORBIT_COLOURS[0]} strokeWidth={4} />
        <circle cx={120} cy={42} r={28} fill="none" stroke={ORBIT_COLOURS[1]} strokeOpacity={0.25} />
        <circle cx={120} cy={42} r={11} fill="none" stroke={ORBIT_COLOURS[1]} strokeWidth={4} />
        <path d="M 120 14 A 28 28 0 0 1 148 42" fill="none" stroke={ORBIT_RED} strokeWidth={4} />
        <line x1={50} y1={80} x2={104} y2={64} stroke={ORBIT_GOLD} strokeOpacity={0.4} strokeDasharray="3 4" />
        <polygon points="80,71 68,70 72,80" fill={ORBIT_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Let go so the next orbit catches you.</p>
    </div>
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
    if ((data?.orbitRev === ORBIT_REV4 || data?.orbitRev === ORBIT_REV_BAND || data?.orbitRev === ORBIT_REV_TUNED || data?.orbitRev === ORBIT_REV_SWEPT || data?.orbitRev === ORBIT_REV_TALL) && data.planets) {
      const planets = decodeRev3Planets(data.planets);
      const holes = decodeOrbitHoles(data.holes ?? []);
      const start = data.orbitRev === ORBIT_REV_TALL ? initTallFrom : data.orbitRev === ORBIT_REV_SWEPT ? initSweptFrom : data.orbitRev === ORBIT_REV_TUNED ? initTunedFrom : data.orbitRev === ORBIT_REV_BAND ? initBandFrom : initRev4From;
      return { ...orbitRev3ArtGame, init: () => start(planets, ORBIT_REV3_WORLD_W, holes) } as unknown as typeof orbitArtGame;
    }
    if (data?.orbitRev === ORBIT_REV3 && data.planets) {
      const planets = decodeRev3Planets(data.planets);
      return { ...orbitRev3ArtGame, init: () => initRev3From(planets, ORBIT_REV3_WORLD_W) } as unknown as typeof orbitArtGame;
    }
    return orbitArtGame;
  }, [devPlanet, data]);
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
      worldW={ORBIT_WORLD_W}
      // orbitRev 8: the taller view (620 on every earlier revision).
      worldH={orbitWorldHFor(data?.orbitRev)}
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
      footer={(send) => (
        // The 44 px button's row ends 16 px above the bottom of the screen, as every arcade control row; the
        // button is 44 px tall with 11 px text and 12 px sides, narrower than before (15 Oct 2026, display only).
        <div data-game-controls="checkpoint" className="flex h-11 shrink-0 items-center justify-center">
          {canSet && !locked && (
            <ArcadeControlButton
              type="button"
              aria-label="Set checkpoint"
              className="h-11 px-3 text-[11px] font-bold before:content-['SET_CHECKPOINT']"
              onPressStart={() => send({ k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0 })}
            />
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

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "orbit") return null;
  const result = replayOrbitRun(puzzle.seed, myAnswer ?? "", puzzle.orbitRev, puzzle.planets, puzzle.holes);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {orbitLine(result)}
      </p>
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
};
