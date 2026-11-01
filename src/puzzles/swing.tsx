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
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK,
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

/** Fixed intro still (swingRev 15): hook-to-hook swinging with a gate and a star on the way, then a short ledge run with a squeeze. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: SWING_BG, borderRadius: 10 }}>
        <polyline points="0,14 20,20 40,10 60,18 80,12 100,22 120,14 140,20 168,12" fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <polygon points="0,118 8,108 16,118 24,108 32,118 40,108 48,118 56,108 64,118 72,108 80,118 88,108 96,118 104,108 112,118 120,108 128,118 136,108 144,118 152,108 160,118 168,108 168,130 0,130" fill={SWING_RED} />
        {/* Swinging: the hero on the first hook, the flight to the next (through a speed gate), a star on the tighter swing. */}
        <circle cx={22} cy={34} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <line x1={22} y1={34} x2={34} y2={76} stroke={SWING_GOLD} strokeWidth={2} />
        <rect x={28} y={72} width={12} height={20} rx={6} fill="var(--ice-wall)" stroke="var(--grappler-rim)" strokeWidth={1} />
        <path d="M 40 76 Q 56 44 72 58" fill="none" stroke={SWING_GOLD} strokeOpacity={0.45} strokeDasharray="3 4" />
        <line x1={52} y1={46} x2={52} y2={66} stroke="#FFE08A" strokeWidth={1.2} strokeDasharray="3 3" />
        <circle cx={78} cy={30} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <circle cx={92} cy={70} r={3.5} fill={SWING_GOLD} />
        <circle cx={112} cy={36} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        {/* A short ledge run: a landing ledge, then a squeeze's gap. */}
        <rect x={120} y={84} width={24} height={6} rx={1} fill="#5A4A50" stroke={SWING_GOLD} strokeWidth={0.8} />
        <rect x={152} y={14} width={10} height={40} fill="#3A2B31" />
        <rect x={152} y={80} width={10} height={32} fill="#3A2B31" />
        <rect x={152} y={52} width={10} height={2} fill="rgba(255,150,90,0.8)" />
        <rect x={152} y={80} width={10} height={2} fill="rgba(255,150,90,0.8)" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swing hook to hook: let go to fly, hold to grab the next. Short ledge runs and squeezes between. Miss: back to your last hook.</p>
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
      // swingRev 13, 14, 15 and 16: the wider view (450 × 844); 390 wide on every earlier revision.
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
  // swingRev 14 and 15 (the assault and swinging courses): sections cleared and restarts.
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
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{puzzle.swingRev === SWING_REV_ASSAULT || puzzle.swingRev === SWING_REV_REWORK || puzzle.swingRev === SWING_REV_DARK ? "Same course for everyone" : "Same cavern for everyone"}</p>
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
