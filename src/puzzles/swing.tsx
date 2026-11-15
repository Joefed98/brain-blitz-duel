import { directionOf } from "@/lib/desktop";
import { swingFillFor } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useRef } from "react";

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
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK, SWING_REV_SLIDE,
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

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still's course: the first course rooms deal on swingRev 17 (swingSlideDeal.server.ts), built in the sim. */
const SWING_INTRO_SEED = 80672385;

/**
 * The intro still (the Action overhaul, 15 Nov 2026): swingRev 17's own jungle drawn by the game's renderer on a fixed
 * course a second and a half in, the hero swinging from the first vine (no placeholder drawing). Display only.
 */
function IntroExample() {
  return (
    <ArtStill
      game={swingArtGameFor(SWING_REV_SLIDE)}
      worldW={swingWorldWFor(SWING_REV_SLIDE)}
      worldH={swingWorldHFor(SWING_REV_SLIDE)}
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
      sceneKey={(s: SwingState) => (data?.swingRev === SWING_REV_SLIDE ? swingJungleSceneKey((scene.current = swingJungleScene(s))) : 0)}
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
      checkpoint={swingCheckpoint}
      interval={SWING_CHECKPOINT_INTERVAL}
      encodeRun={encodeSwingRun}
      discrete
      inputKind={SWING_INPUT_HOLD}
      pointer={(kind, _x, y) => {
        if (kind === "down") {
          start.current = { y };
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
      {puzzle.swingRev === SWING_REV_SLIDE && "streakPaid" in result && (
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
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{puzzle.swingRev === SWING_REV_ASSAULT || puzzle.swingRev === SWING_REV_REWORK || puzzle.swingRev === SWING_REV_DARK || puzzle.swingRev === SWING_REV_SLIDE ? "Same course for everyone" : "Same cavern for everyone"}</p>
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
};
