import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  homerunCheckpoint,
  homerunGameFor,
  HOMERUN_BG,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_INPUT_SWING,
  HOMERUN_SWING_START_PX,
  HOMERUN_WORLD_H,
  HOMERUN_WORLD_W,
} from "@/lib/arcade/homerun";
import { drawHomerunArt, homerunScene } from "@/lib/arcade/homerun.renderer";
import { stdLines } from "@/lib/arcade/arcadeStandard";
import { encodeHomerunRun, replayHomerunRun } from "@/lib/duel/homerun";
import { HOMERUN_TIME_MS, type HomerunPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { homerunSounds } from "@/lib/fx/homerunSounds";
import { useMemo, useRef } from "react";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the night park from the plate, a pitch on its way, the bat cocked at the right. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 200 150" width={200} height={150} aria-hidden="true" style={{ background: HOMERUN_BG, borderRadius: 10 }}>
        <defs>
          <linearGradient id="hr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#03050C" />
            <stop offset="1" stopColor="#111A33" />
          </linearGradient>
          <radialGradient id="hr-bloom">
            <stop offset="0" stopColor="#FFF6DC" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFE6B4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="60" fill="url(#hr-sky)" />
        <circle cx="40" cy="14" r="18" fill="url(#hr-bloom)" />
        <circle cx="160" cy="14" r="18" fill="url(#hr-bloom)" />
        <rect x="30" y="10" width="20" height="7" fill="#FFF8E6" />
        <rect x="150" y="10" width="20" height="7" fill="#FFF8E6" />
        <rect y="30" width="200" height="28" fill="#141A2A" />
        <rect y="40" width="200" height="2" fill="#2B6CD8" />
        <rect x="70" y="47" width="26" height="7" fill="#1A160C" stroke="#F2C75C" strokeWidth="0.8" />
        <rect y="57" width="200" height="7" fill="#1F4A33" />
        <rect y="57" width="200" height="1" fill="#E8C547" />
        <rect x="8" y="34" width="1.6" height="30" fill="#FFE15A" />
        <rect x="190" y="34" width="1.6" height="30" fill="#FFE15A" />
        <rect y="64" width="200" height="86" fill="#245C33" />
        <ellipse cx="96" cy="72" rx="40" ry="4" fill="#7A5638" />
        <path d="M94 70 l-2 -12 l4 -2 l4 2 l-2 12 Z" fill="#1B2232" />
        <circle cx="96" cy="54" r="2.4" fill="#1B2232" />
        <rect x="110" y="88" width="36" height="40" fill="none" stroke="#fff" strokeOpacity="0.35" strokeDasharray="3 3" />
        <circle cx="122" cy="98" r="3.4" fill="#F4F3EE" />
        <path d="M200 146 L156 92 L160 88 L200 136 Z" fill="#2A170C" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Swipe through the ball as it arrives: your swipe's height meets the pitch, its angle sends it left, centre or right.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HomerunPuzzleData | null = puzzle.type === "homerun" ? puzzle : null;
  const game = useMemo(() => ({ ...homerunGameFor(data?.homerunRev), draw: drawHomerunArt }), [data?.homerunRev]);
  // The swipe: where the finger went down, and whether this swipe has already started the swing.
  const start = useRef<{ x: number; y: number; sent: boolean } | null>(null);
  return (
    <ArcadeCanvasStage
      diagKey="homerun"
      label={gameDisplayName("homerun")}
      background={HOMERUN_BG}
      fitWorld
      scene={homerunScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={HOMERUN_WORLD_W}
      worldH={HOMERUN_WORLD_H}
      game={game}
      sounds={homerunSounds}
      checkpoint={homerunCheckpoint}
      interval={HOMERUN_CHECKPOINT_INTERVAL}
      encodeRun={encodeHomerunRun}
      discrete
      inputKind={HOMERUN_INPUT_SWING}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          start.current = { x, y, sent: false };
          return null;
        }
        const s = start.current;
        if (kind === "up") {
          start.current = null;
          return null;
        }
        if (!s || s.sent) return null;
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy < HOMERUN_SWING_START_PX * HOMERUN_SWING_START_PX) return null;
        // The swing starts now: height from where the swipe began, angle from its direction (0 = level toward the
        // pitcher's side, + = upward = pulled to left field); a swipe the wrong way is a foul.
        s.sent = true;
        const angle = Math.round((Math.atan2(-dy, -dx) * 1800) / Math.PI);
        return { k: HOMERUN_INPUT_SWING, a: Math.round(s.y), b: Math.max(-900, Math.min(900, angle)), c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "homerun") return null;
  const result = replayHomerunRun(puzzle.seed, myAnswer ?? "", puzzle.homerunRev);
  const lines = stdLines(result.parts, result.score, result.state.acted > 0);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.homers} home run{result.homers === 1 ? "" : "s"} · longest {result.longest} ft
      </p>
      {lines.map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same ten pitches for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server from the proved deal; every run is replayed there for scoring. */
export const homerunPuzzle: PuzzleDefinition = {
  key: "homerun",
  name: gameDisplayName("homerun"),
  category: "arcade",
  timeLimitMs: HOMERUN_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "homerun", seed: 1, homerunRev: 1 }) satisfies HomerunPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
