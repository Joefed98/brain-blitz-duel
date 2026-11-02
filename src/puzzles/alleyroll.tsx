import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  ALLEYROLL_REV, AR_BALLS, AR_CHECKPOINT_INTERVAL, AR_CORE_FULL, AR_INPUT_ROLL, AR_MAX_ANGLE_DEN, AR_MAX_ANGLE_NUM, AR_RELEASE_MAX, AR_VMAX, AR_VMIN,
  AR_WAIT, arCheckpoint, arInit, type ArState,
} from "@/lib/arcade/alleyroll";
import {
  AR_BG, AR_LANE_NEAR, AR_WORLD_H, AR_WORLD_W, alleyRollArtGame, alleyRollScene, arNewView, arReleaseFromScreen, drawAlleyRoll,
} from "@/lib/arcade/alleyroll.renderer";
import { encodeAlleyRollRun, replayAlleyRollRun } from "@/lib/duel/alleyroll";
import { ALLEYROLL_TIME_MS, type AlleyRollPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { alleyRollSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still: three balls down (50, 30, a pocket), the fourth lined up with its preview arrow. */
function introState(): ArState {
  const s = arInit(0);
  return {
    ...s, tick: 600, acted: 1,
    balls: [{ release: 0, points: 50, x: 0, y: 190 }, { release: 20, points: 30, x: 30, y: 230 }, { release: -40, points: 100, x: 112, y: 280 }],
  };
}

function IntroExample() {
  const view = { release: -22, aim: { slope: 0.12, power: 0.6 } };
  return (
    <CardStill
      width={AR_WORLD_W}
      height={AR_WORLD_H}
      draw={(ctx, size) => drawAlleyRoll(ctx, introState(), size, view)}
      caption="Slide the ball along the bottom, then swipe up: faster rolls further, the angle aims it."
    />
  );
}

/** Swipe speed (world px a ms) for the weakest and the strongest roll. */
const SWIPE_SLOW = 0.35;
const SWIPE_FAST = 2.4;
/** The screen's swipe angle is foreshortened on the lane: across ÷ up on the lane is this share of it on screen. */
const SLOPE_SCALE = 0.6;
/** A swipe up starts once the finger has gone this far up from where it went down. */
const SWIPE_START = 24;

interface Gesture {
  x: number;
  y: number;
  /** "slide" moves the release point; "swipe" rolls. */
  mode: "slide" | "swipe" | "none";
  trail: { x: number; y: number; at: number }[];
}

/** The input a swipe makes: release, across and up speeds (1/256 px a tick) from its speed and angle. */
export function arSwipeInput(release: number, dx: number, dy: number, ms: number): PointerPayload | null {
  if (dy >= -8) return null;
  const speed = Math.hypot(dx, dy) / Math.max(1, ms);
  const power = Math.max(0, Math.min(1, (speed - SWIPE_SLOW) / (SWIPE_FAST - SWIPE_SLOW)));
  const c = Math.round(AR_VMIN + power * (AR_VMAX - AR_VMIN));
  const most = Math.floor((c * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);
  const b = Math.max(-most, Math.min(most, Math.round(c * (dx / -dy) * SLOPE_SCALE)));
  return { k: AR_INPUT_ROLL, a: Math.round(release), b, c };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: AlleyRollPuzzleData | null = puzzle.type === "alleyroll" ? puzzle : null;
  const view = useMemo(() => arNewView(), []);
  const game = useMemo(() => alleyRollArtGame(view), [view]);
  const g = useRef<Gesture | null>(null);
  const charge = useRef<{ from: number } | null>(null);
  const keyAim = useRef(0);

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const now = performance.now();
    if (kind === "down") {
      // Anywhere in the lower part of the screen: a slide sets the release point, a swipe up rolls.
      g.current = y > AR_LANE_NEAR - 260 ? { x, y, mode: "none", trail: [{ x, y, at: now }] } : null;
      return null;
    }
    const s = g.current;
    if (!s) return null;
    s.trail.push({ x, y, at: now });
    while (s.trail.length > 2 && now - s.trail[0]!.at > 140) s.trail.shift();
    if (s.mode === "none") {
      if (s.y - y > SWIPE_START) s.mode = "swipe";
      else if (Math.abs(x - s.x) > 8) s.mode = "slide";
    }
    if (s.mode === "slide") {
      view.release = Math.max(-AR_RELEASE_MAX, Math.min(AR_RELEASE_MAX, arReleaseFromScreen(x)));
      if (s.y - y > SWIPE_START * 1.5) {
        // The slide turns into a swipe up from here.
        s.mode = "swipe";
        s.x = x;
        s.y = y;
        s.trail = [{ x, y, at: now }];
      }
    }
    const first = s.trail[0]!;
    const input = s.mode === "swipe" ? arSwipeInput(view.release, x - first.x, y - first.y, now - first.at) : null;
    if (kind === "move") {
      if (input) {
        const most = Math.floor((input.c * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);
        view.aim = { slope: input.b / input.c, power: (input.c - AR_VMIN) / (AR_VMAX - AR_VMIN) };
        if (Math.abs(input.b) >= most) view.aim.slope = Math.sign(input.b) * (most / input.c);
      }
      return null;
    }
    g.current = null;
    view.aim = null;
    return input;
  };

  return (
    <ArcadeCanvasStage
      diagKey="alleyroll"
      label={`${gameDisplayName("alleyroll")}: slide to line up, swipe up to roll`}
      background={AR_BG}
      fitWorld
      scene={alleyRollScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={AR_WORLD_W}
      worldH={AR_WORLD_H}
      game={game}
      sounds={alleyRollSounds}
      checkpoint={arCheckpoint}
      interval={AR_CHECKPOINT_INTERVAL}
      encodeRun={encodeAlleyRollRun}
      discrete
      inputKind={AR_INPUT_ROLL}
      pointer={pointer}
      keys={(kind, key, send, state) => {
        const used = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key);
        if (!used) return false;
        const waiting = state.phase === AR_WAIT && state.balls.length < AR_BALLS;
        if (key === " ") {
          // Hold Space to charge, let go to roll: the longer the hold (up to 1.2 s), the harder the roll.
          if (kind === "down" && !charge.current && waiting) charge.current = { from: performance.now() };
          if (kind === "up" && charge.current) {
            const power = Math.min(1, (performance.now() - charge.current.from) / 1200);
            charge.current = null;
            view.aim = null;
            const c = Math.round(AR_VMIN + power * (AR_VMAX - AR_VMIN));
            if (waiting) send({ k: AR_INPUT_ROLL, a: Math.round(view.release), b: Math.round(c * keyAim.current), c });
          }
          return true;
        }
        if (kind !== "down") return true;
        if (key === "ArrowLeft" || key === "ArrowRight") view.release = Math.max(-AR_RELEASE_MAX, Math.min(AR_RELEASE_MAX, view.release + (key === "ArrowLeft" ? -6 : 6)));
        else keyAim.current = Math.max(-0.3, Math.min(0.3, keyAim.current + (key === "ArrowUp" ? 0.02 : -0.02)));
        view.aim = { slope: keyAim.current, power: 0.5 };
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function alleyRollLine(r: { rings: number; pockets: number }): string {
  return `${r.rings} ring points (full at ${AR_CORE_FULL}) · ${r.pockets} pocket${r.pockets === 1 ? "" : "s"}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "alleyroll") return null;
  const result = replayAlleyRollRun(puzzle.seed, myAnswer ?? "", puzzle.alleyRollRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{alleyRollLine(result)}</p>
      {result.parts.map((part) => (
        <p key={part.key} className="shrink-0 text-center font-mono text-sm text-foreground">{`${part.label}: ${part.detail}`}</p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">{result.points.length ? result.points.join(" · ") : "No balls rolled"}</p>
    </div>
  );
}

/** One lane for everyone; every run is replayed on the server for scoring. */
export const alleyRollPuzzle: PuzzleDefinition = {
  key: "alleyroll",
  name: gameDisplayName("alleyroll"),
  category: "arcade",
  timeLimitMs: ALLEYROLL_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "alleyroll", seed: 1, alleyRollRev: ALLEYROLL_REV }) satisfies AlleyRollPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
