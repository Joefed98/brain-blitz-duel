import { useEffect, useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { stdLines } from "@/lib/arcade/arcadeStandard";
import {
  racingCheckpoint,
  racingGameFor,
  RACING_BG,
  RACING_CHECKPOINT_INTERVAL,
  RACING_INPUT_STICK,
  RACING_STICK_MAX,
  RACING_WORLD_H,
  RACING_WORLD_W,
  type RacingState,
} from "@/lib/arcade/racing";
import {
  drawRacingArt,
  paintRacingTile,
  racingScene,
  RACING_STICK_R,
  RACING_STICK_TOP,
  setRacingGhosts,
  setRacingStick,
} from "@/lib/arcade/racing.renderer";
import { encodeRacingRun, replayRacingRun } from "@/lib/duel/racing";
import { publishRaceGhost, useRaceGhosts } from "@/lib/duel/raceGhosts";
import { RACING_TIME_MS, type RacingPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { racingSounds } from "@/lib/fx/racingSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const STILL = 200;

/** Fixed intro still: the chase view at sunset, the car on the start straight. */
function IntroExample() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const ratio = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);
    node.width = STILL * ratio;
    node.height = STILL * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintRacingTile(ctx, STILL);
  }, []);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <canvas ref={ref} width={STILL} height={STILL} aria-hidden="true" style={{ width: STILL, height: STILL, background: RACING_BG, borderRadius: 10 }} />
      <p className="text-center text-xs text-muted-foreground">
        Thumb stick: up to accelerate, down to brake, left and right to steer. Two laps; keep off the grass.
      </p>
    </div>
  );
}

/** A stick offset (world px) to a joystick payload: −100…100 each way, in steps of 5, with a small dead zone. */
function stickValue(d: number): number {
  const v = Math.max(-RACING_STICK_MAX, Math.min(RACING_STICK_MAX, (d / RACING_STICK_R) * RACING_STICK_MAX));
  if (Math.abs(v) < 8) return 0;
  return Math.round(v / 5) * 5;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: RacingPuzzleData | null = puzzle.type === "racing" ? puzzle : null;
  const game = useMemo(() => ({ ...racingGameFor(data?.racingRev), draw: drawRacingArt }), [data?.racingRev]);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef(new Set<string>());
  const ghosts = useRaceGhosts();
  useEffect(() => {
    setRacingGhosts(ghosts);
  }, [ghosts]);
  useEffect(
    () => () => {
      setRacingGhosts(null);
      setRacingStick(null);
    },
    [],
  );
  // The sound observer also publishes this car for the other players' ghosts (display only, throttled inside).
  const sounds = useMemo(
    () => () => {
      const inner = racingSounds();
      return {
        frame: (state: RacingState, running: boolean) => {
          if (running) publishRaceGhost(state.s, state.x);
          inner.frame(state, running);
        },
        stop: () => inner.stop(),
      };
    },
    [],
  );
  const keyPayload = (): PointerPayload => {
    const k = keys.current;
    const a = (k.has("right") ? RACING_STICK_MAX : 0) - (k.has("left") ? RACING_STICK_MAX : 0);
    const b = (k.has("up") ? RACING_STICK_MAX : 0) - (k.has("down") ? RACING_STICK_MAX : 0);
    return { k: RACING_INPUT_STICK, a, b, c: 0 };
  };
  return (
    <ArcadeCanvasStage
      diagKey="racing"
      label={gameDisplayName("racing")}
      background={RACING_BG}
      fitWorld
      scene={racingScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={RACING_WORLD_W}
      worldH={RACING_WORLD_H}
      game={game}
      sounds={sounds}
      checkpoint={racingCheckpoint}
      interval={RACING_CHECKPOINT_INTERVAL}
      encodeRun={encodeRacingRun}
      inputKind={RACING_INPUT_STICK}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          if (y < RACING_STICK_TOP) return null;
          // The stick's base appears under the thumb (kept inside the world).
          const o = {
            x: Math.max(RACING_STICK_R, Math.min(RACING_WORLD_W - RACING_STICK_R, x)),
            y: Math.max(RACING_STICK_TOP, Math.min(RACING_WORLD_H - RACING_STICK_R / 2, y)),
          };
          origin.current = o;
          setRacingStick(o);
          return { k: RACING_INPUT_STICK, a: stickValue(x - o.x), b: stickValue(o.y - y), c: 0 };
        }
        const o = origin.current;
        if (kind === "up" || !o) {
          origin.current = null;
          setRacingStick(null);
          return { k: RACING_INPUT_STICK, a: 0, b: 0, c: 0 };
        }
        return { k: RACING_INPUT_STICK, a: stickValue(x - o.x), b: stickValue(o.y - y), c: 0 };
      }}
      keys={(kind, key, send) => {
        const name =
          key === "ArrowLeft" || key === "a" || key === "A"
            ? "left"
            : key === "ArrowRight" || key === "d" || key === "D"
              ? "right"
              : key === "ArrowUp" || key === "w" || key === "W"
                ? "up"
                : key === "ArrowDown" || key === "s" || key === "S"
                  ? "down"
                  : null;
        if (!name) return false;
        if (kind === "down") keys.current.add(name);
        else keys.current.delete(name);
        send(keyPayload());
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "racing") return null;
  const result = replayRacingRun(puzzle.seed, myAnswer ?? "", puzzle.racingRev);
  const lines = stdLines(result.parts, result.score, result.state.acted > 0);
  const headline = result.finished
    ? `Finished in ${(result.finishTick / 60).toFixed(1)} s`
    : `${(result.distancePermille / 10).toFixed(1)}% of the race`;
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {headline} · {result.clean} of {result.sectors} sectors clean
      </p>
      {lines.map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same circuit for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server from the proved deal (racingDeal.server.ts); every run is replayed there for scoring. */
export const racingPuzzle: PuzzleDefinition = {
  key: "racing",
  name: gameDisplayName("racing"),
  category: "arcade",
  timeLimitMs: RACING_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "racing", seed: 1, racingRev: 1 }) satisfies RacingPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
