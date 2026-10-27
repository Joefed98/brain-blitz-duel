import { directionOf } from "@/lib/desktop";
import { swingFill } from "@/lib/arcade/arenaFills.renderer";
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
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND,
  swingWorldHFor,
  swingWorldWFor,
  SWING_BG,
  SWING_CHECKPOINT_INTERVAL,
  SWING_GOLD,
  SWING_INPUT_HOLD,
  SWING_RED,
} from "@/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "@/lib/duel/swing";
import { SWING_TIME_MS, type SwingPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { swingArtGameFor } from "@/lib/arcade/swing.renderer";
import { swingSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the figure mid-swing on a rope, the next anchor ahead. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: SWING_BG, borderRadius: 10 }}>
        <polyline points="0,14 20,20 40,10 60,18 80,12 100,22 120,14 140,20 168,12" fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <polyline points="0,116 24,110 48,118 72,112 96,118 120,110 144,116 168,112" fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <polygon points="0,118 8,108 16,118 24,108 32,118 40,108 48,118 56,108 64,118 72,108 80,118 88,108 96,118 104,108 112,118 120,108 128,118 136,108 144,118 152,108 160,118 168,108 168,118" fill={SWING_RED} />
        <circle cx={50} cy={34} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <circle cx={128} cy={38} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <line x1={50} y1={34} x2={78} y2={80} stroke={SWING_GOLD} strokeWidth={2} />
        <rect x={72} y={76} width={12} height={20} rx={6} fill="var(--ice-wall)" stroke="var(--grappler-rim)" strokeWidth={1} />
        <path d="M73 79 H83 M73 79 L69 83 M73 80 L70 87" stroke="var(--ball-pink)" strokeWidth={1.5} fill="none" />
        <path d="M75 82 H80" stroke="var(--foreground)" strokeWidth={1.5} />
        <path d="M 84 82 Q 104 70 118 50" fill="none" stroke={SWING_GOLD} strokeOpacity={0.4} strokeDasharray="3 4" />
        {/* swingRev 13: a high-route gem, a low-route speed gate and a set-route ledge with its flag. */}
        <polygon points="104,26 109,30 107,36 101,36 99,30" fill="#5FDCF0" stroke="#E6FDFF" strokeWidth={0.8} />
        <rect x={146} y={60} width={6} height={14} rx={2} fill="#33262B" />
        <rect x={146} y={92} width={6} height={14} rx={2} fill="#33262B" />
        <line x1={149} y1={74} x2={149} y2={92} stroke="#FFE08A" strokeWidth={1.2} strokeDasharray="3 3" />
        <rect x={10} y={66} width={30} height={6} rx={1} fill="#5A4A50" stroke={SWING_GOLD} strokeWidth={0.8} />
        <line x1={36} y1={66} x2={36} y2={52} stroke="#C9A25A" strokeWidth={1.2} />
        <path d="M36 52 Q31 54 28 55 L36 58 Z" fill={SWING_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swing back for momentum, let go to fly. Fly high for gems, swoop low and fast through gates, land the ledges. From 200 m a dragon chases you.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SwingPuzzleData | null = puzzle.type === "swing" ? puzzle : null;
  const start = useRef<{ y: number } | null>(null);
  const spaceHeld = useRef(false);
  return (
    <ArcadeCanvasStage
      diagKey="swing"
      scene={swingFill}
      label={gameDisplayName("swing")}
      background="transparent"
      fitWorld
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      // swingRev 13: the expansion's wider view (450 × 844); 390 wide on every earlier revision.
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

export function swingLine(r: { metres: number; survived: boolean; survivedSeconds: number; cause?: number }): string {
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
      {puzzle.swingRev === SWING_REV_EXPAND && "gems" in result && (
        <p className="shrink-0 whitespace-normal break-words text-center font-mono text-sm text-muted-foreground">
          {result.gems} / {result.gemTotal} gems · {result.gates} / {result.gateTotal} gates · {result.ledges} / {result.ledgeTotal} ledges · best chain {result.bestChain}
        </p>
      )}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same cavern for everyone</p>
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
