import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  ALLEYROLL_REV_DEALT, ALLEYROLL_REV_RINGER, AR2_CORE_FULL, AR2_GOLD_Y, AR2_POCKETS, AR2_VMAX, AR2_VMIN, AR_BALLS, AR_CHECKPOINT_INTERVAL, AR_CORE_FULL,
  AR_INPUT_ROLL, AR_RELEASE_MAX, AR_VMAX, AR_VMIN, AR_WAIT, arCheckpoint, arGoldX256, type ArState,
} from "@/lib/arcade/alleyroll";
import {
  AR_BG, AR_LANE_FAR, AR_WORLD_H, AR_WORLD_W, alleyRollArtGame, alleyRollScene, arNewView, drawAlleyRoll, ringerStill,
} from "@/lib/arcade/alleyroll.renderer";
import { arReleaseAt, ringerSwipeInput } from "@/lib/arcade/alleyrollSwipe";
import { encodeAlleyRollRun, replayAlleyRollRun } from "@/lib/duel/alleyroll";
import { ALLEYROLL_TIME_MS, type AlleyRollPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { alleyRollSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still: three balls down (the gold cup, a 50, a pocket), the fourth waiting on the release line. */
function introState(): ArState {
  const s = ringerStill(600);
  const gx = Math.round(arGoldX256(s, 560) / 256);
  return {
    ...s,
    balls: [
      { release: 0, points: 150, x: gx, y: AR2_GOLD_Y },
      { release: 0, points: 50, x: 0, y: 206 },
      { release: 40, points: 100, x: AR2_POCKETS[0]!.x, y: AR2_POCKETS[0]!.y },
    ],
  };
}

function IntroExample() {
  const view = { release: -22 };
  return (
    <CardStill
      width={AR_WORLD_W}
      height={AR_WORLD_H}
      draw={(ctx, size) => drawAlleyRoll(ctx, introState(), size, view)}
      caption="Swipe up the lane: where you start lines it up, the angle aims, a faster swipe rolls further."
    />
  );
}

/** A swipe up starts once the finger has gone this far up from where it went down (world px). */
const SWIPE_START = 12;
/** The swipe's speed is read over its last this many ms. */
const SPEED_MS = 140;

interface Gesture {
  /** Where the swipe started (its release point) and the trail for its speed. */
  x: number;
  y: number;
  swiping: boolean;
  trail: { x: number; y: number; at: number }[];
}

/** The input a swipe makes (rev 1's rounds keep their own speed range and angle scale). */
export function arSwipeInput(startX: number, dx: number, dy: number, ms: number, rev: number = ALLEYROLL_REV_DEALT): PointerPayload | null {
  return ringerSwipeInput(startX, dx, dy, ms, rev);
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: AlleyRollPuzzleData | null = puzzle.type === "alleyroll" ? puzzle : null;
  const rev = data?.alleyRollRev ?? 1;
  const view = useMemo(() => arNewView(), []);
  const game = useMemo(() => alleyRollArtGame(view, rev), [view, rev]);
  const g = useRef<Gesture | null>(null);
  const charge = useRef<{ from: number } | null>(null);

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const now = performance.now();
    if (kind === "down") {
      // Anywhere on the lane: the ball comes to the finger's place across the lane (the release point).
      if (y < AR_LANE_FAR - 20) {
        g.current = null;
        return null;
      }
      view.release = arReleaseAt(x);
      g.current = { x, y, swiping: false, trail: [{ x, y, at: now }] };
      return null;
    }
    const s = g.current;
    if (!s) return null;
    s.trail.push({ x, y, at: now });
    while (s.trail.length > 2 && now - s.trail[0]!.at > SPEED_MS) s.trail.shift();
    if (!s.swiping) {
      if (s.y - y > SWIPE_START) s.swiping = true;
      else {
        // Not yet climbing: the start slides with the finger, so the swipe starts where it really starts.
        s.x = x;
        view.release = arReleaseAt(x);
        if (y > s.y) s.y = y;
      }
    }
    if (kind === "move") return null;
    g.current = null;
    if (!s.swiping) return null;
    // Direction from the whole swipe, power from its speed over the last 140 ms.
    const first = s.trail[0]!;
    const speed = Math.hypot(x - first.x, y - first.y) / Math.max(1, now - first.at);
    const dx = x - s.x;
    const dy = y - s.y;
    return arSwipeInput(s.x, dx, dy, Math.hypot(dx, dy) / Math.max(1e-3, speed), rev);
  };

  const [vMin, vMax] = rev >= ALLEYROLL_REV_RINGER ? [AR2_VMIN, AR2_VMAX] : [AR_VMIN, AR_VMAX];

  return (
    <ArcadeCanvasStage
      diagKey="alleyroll"
      label={`${gameDisplayName("alleyroll")}: swipe up the lane to roll`}
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
        const used = ["ArrowLeft", "ArrowRight", " "].includes(key);
        if (!used) return false;
        const waiting = state.phase === AR_WAIT && state.balls.length < AR_BALLS;
        if (key === " ") {
          // Hold Space to charge, let go to roll straight: the longer the hold (up to 1.2 s), the harder the roll.
          if (kind === "down" && !charge.current && waiting) charge.current = { from: performance.now() };
          if (kind === "up" && charge.current) {
            const power = Math.min(1, (performance.now() - charge.current.from) / 1200);
            charge.current = null;
            const c = Math.round(vMin + power * (vMax - vMin));
            if (waiting) send({ k: AR_INPUT_ROLL, a: Math.round(view.release), b: 0, c });
          }
          return true;
        }
        if (kind !== "down") return true;
        view.release = Math.max(-AR_RELEASE_MAX, Math.min(AR_RELEASE_MAX, view.release + (key === "ArrowLeft" ? -6 : 6)));
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function alleyRollLine(r: { rings: number; pockets: number; gold?: number }, rev = 1): string {
  const pockets = `${r.pockets} pocket${r.pockets === 1 ? "" : "s"}`;
  if (rev >= ALLEYROLL_REV_RINGER) return `${r.rings} ring points (full at ${AR2_CORE_FULL}) · ${r.gold ?? 0} gold · ${pockets}`;
  return `${r.rings} ring points (full at ${AR_CORE_FULL}) · ${pockets}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "alleyroll") return null;
  const result = replayAlleyRollRun(puzzle.seed, myAnswer ?? "", puzzle.alleyRollRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{alleyRollLine(result, puzzle.alleyRollRev ?? 1)}</p>
      {result.parts.map((part) => (
        <p key={part.key} className="shrink-0 text-center font-mono text-sm text-foreground">{`${part.label}: ${part.detail}`}</p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">{result.points.length ? result.points.join(" · ") : "No balls rolled"}</p>
    </div>
  );
}

/** One lane and one gold-cup path for everyone in a room; every run is replayed on the server for scoring. */
export const alleyRollPuzzle: PuzzleDefinition = {
  key: "alleyroll",
  name: gameDisplayName("alleyroll"),
  category: "arcade",
  timeLimitMs: ALLEYROLL_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "alleyroll", seed: 1, alleyRollRev: ALLEYROLL_REV_DEALT }) satisfies AlleyRollPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
