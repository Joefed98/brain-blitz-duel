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
  SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK, SWING_REV_SLIDE,
  swingWorldHFor,
  swingWorldWFor,
  SWING_CHECKPOINT_INTERVAL,
  SWING_GOLD,
  SWING_INPUT_HOLD,
} from "@/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "@/lib/duel/swing";
import { SWING_TIME_MS, type SwingPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { swingArtGameFor } from "@/lib/arcade/swing.renderer";
import { swingSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * Fixed intro still (the jungle canopy of swingRev 17, 3 Nov 2026): vine-to-vine swinging over the river with a speed
 * gate on the way, then a short platform run with a squeeze between a trunk and a rock.
 */
function IntroExample() {
  const vine = "#5E8F33";
  const loop = "#CDEB7A";
  const knot = "#F2C75C";
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: "linear-gradient(#0E2A1C, #24604A)", borderRadius: 10 }}>
        <defs>
          <radialGradient id="swing-intro-glow">
            <stop offset="0" stopColor="rgba(255,236,140,0.75)" />
            <stop offset="1" stopColor="rgba(220,255,130,0)" />
          </radialGradient>
        </defs>
        {/* Distant crowns, the canopy overhead and the river below. */}
        <circle cx={30} cy={78} r={22} fill="#1E5440" />
        <circle cx={96} cy={72} r={26} fill="#1E5440" />
        <circle cx={150} cy={80} r={20} fill="#1E5440" />
        <path d="M0 0 H168 V12 Q150 22 132 14 Q112 22 94 13 Q74 22 56 14 Q36 22 18 13 Q8 18 0 14 Z" fill="#1C4A2A" />
        <path d="M0 14 Q8 18 18 13 Q36 22 56 14 Q74 22 94 13 Q112 22 132 14 Q150 22 168 12" fill="none" stroke="#8FD15A" strokeWidth={1.2} />
        <path d="M0 116 Q20 112 42 116 T84 116 T126 116 T168 116 V130 H0 Z" fill="#2F9FB0" />
        <path d="M0 116 Q20 112 42 116 T84 116 T126 116 T168 116" fill="none" stroke="#D8F6F2" strokeWidth={1.4} />
        {/* Swinging: the hero on the first vine, the flight to the next (through a speed gate). */}
        {([[22, 36], [78, 32], [112, 38]] as const).map(([x, y]) => (
          <g key={x}>
            <line x1={x} y1={16} x2={x} y2={y - 6} stroke={vine} strokeWidth={2} />
            <circle cx={x} cy={y} r={10} fill="url(#swing-intro-glow)" />
            <circle cx={x} cy={y} r={5} fill="none" stroke={loop} strokeWidth={2.2} />
            <circle cx={x} cy={y - 5} r={2} fill={knot} />
          </g>
        ))}
        <line x1={22} y1={36} x2={34} y2={76} stroke="#A7DB6A" strokeWidth={2.4} />
        <rect x={28} y={72} width={12} height={20} rx={6} fill="var(--ice-wall)" stroke="var(--grappler-rim)" strokeWidth={1} />
        <path d="M 40 76 Q 56 44 72 58" fill="none" stroke={knot} strokeOpacity={0.5} strokeDasharray="3 4" />
        <line x1={52} y1={46} x2={52} y2={66} stroke="#FFE08A" strokeWidth={1.2} strokeDasharray="3 3" />
        <rect x={50} y={34} width={4} height={12} fill="#7E8E3A" />
        <rect x={50} y={66} width={4} height={12} fill="#7E8E3A" />
        {/* A short platform run: a tree platform, then a squeeze between a hanging trunk and a rock. */}
        <rect x={129} y={90} width={6} height={26} fill="#4A3322" />
        <rect x={120} y={84} width={24} height={6} rx={1} fill="#A47A4C" stroke={knot} strokeWidth={0.8} />
        <rect x={152} y={14} width={10} height={40} fill="#4A3322" />
        <rect x={152} y={80} width={10} height={36} fill="#5B5E52" />
        <rect x={152} y={80} width={10} height={3} fill="#4D7A2E" />
        <rect x={152} y={52} width={10} height={2} fill="rgba(200,240,140,0.8)" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Swing vine to vine: let go to fly, hold to grab the next. Tree platforms and squeezes between. Miss: back to your last vine.</p>
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
