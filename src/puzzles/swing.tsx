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
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT,
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

/** Fixed intro still (swingRev 14): a start ledge, a hook and the landing ledge, a squeeze's gap with its far hook. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: SWING_BG, borderRadius: 10 }}>
        <polyline points="0,14 20,20 40,10 60,18 80,12 100,22 120,14 140,20 168,12" fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <polygon points="0,118 8,108 16,118 24,108 32,118 40,108 48,118 56,108 64,118 72,108 80,118 88,108 96,118 104,108 112,118 120,108 128,118 136,108 144,118 152,108 160,118 168,108 168,130 0,130" fill={SWING_RED} />
        {/* The start ledge (gold arrow), the hook, the rope and the flight on to the landing ledge. */}
        <rect x={6} y={80} width={30} height={6} rx={1} fill="#5A4A50" stroke={SWING_GOLD} strokeWidth={0.8} />
        <path d="M17 81 L22 83 L17 85 Z" fill={SWING_GOLD} />
        <circle cx={46} cy={30} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
        <line x1={46} y1={30} x2={52} y2={70} stroke={SWING_GOLD} strokeWidth={2} />
        <rect x={46} y={66} width={12} height={20} rx={6} fill="var(--ice-wall)" stroke="var(--grappler-rim)" strokeWidth={1} />
        <path d="M 58 70 Q 74 48 88 70" fill="none" stroke={SWING_GOLD} strokeOpacity={0.45} strokeDasharray="3 4" />
        <rect x={76} y={74} width={28} height={6} rx={1} fill="#5A4A50" stroke="rgba(255,190,140,0.6)" strokeWidth={0.8} />
        {/* A squeeze: roof and floor closing to a gap, a gem on the line, the far hook behind it. */}
        <rect x={122} y={14} width={12} height={36} fill="#3A2B31" />
        <rect x={122} y={78} width={12} height={34} fill="#3A2B31" />
        <rect x={122} y={48} width={12} height={2} fill="rgba(255,150,90,0.8)" />
        <rect x={122} y={78} width={12} height={2} fill="rgba(255,150,90,0.8)" />
        <polygon points="113,58 117,61 116,66 110,66 109,61" fill="#5FDCF0" stroke="#E6FDFF" strokeWidth={0.8} />
        <circle cx={154} cy={34} r={5} fill="none" stroke={SWING_GOLD} strokeWidth={2} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Kick off the ledge, swing, let go and land the next one. Two hooks? Catch the far one in the air. Squeezes: fly through the gap. Miss and you restart the section.</p>
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
      // swingRev 13 and 14: the wider view (450 × 844); 390 wide on every earlier revision.
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
  // swingRev 14 (the assault course): sections cleared and restarts.
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
      {puzzle.swingRev === SWING_REV_ASSAULT && "starsBanked" in result && (
        <p className="shrink-0 whitespace-normal break-words text-center font-mono text-sm text-muted-foreground">
          {result.parsBeaten} under par · {result.gates} / {result.gateTotal} gates · {result.gems} / {result.gemTotal} gems · {result.starsBanked} / {result.starTotal} stars
        </p>
      )}
      {puzzle.swingRev === SWING_REV_EXPAND && "gems" in result && (
        <p className="shrink-0 whitespace-normal break-words text-center font-mono text-sm text-muted-foreground">
          {result.gems} / {result.gemTotal} gems · {result.gates} / {result.gateTotal} gates · {result.ledges} / {result.ledgeTotal} ledges · best chain {result.bestChain}
        </p>
      )}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{puzzle.swingRev === SWING_REV_ASSAULT ? "Same course for everyone" : "Same cavern for everyone"}</p>
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
