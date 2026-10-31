import { devWarp } from "@/lib/arcade/devWarp";
import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  homerunCheckpoint,
  homerunGameFor,
  HOMERUN_BG,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_INPUT_SWING,
  homerunSwingStartPx,
  HOMERUN_WORLD_H,
  HOMERUN_WORLD_W,
} from "@/lib/arcade/homerun";
import { drawHomerunArt, homerunScene } from "@/lib/arcade/homerun.renderer";
import { encodeHomerunRun, replayHomerunRun } from "@/lib/duel/homerun";
import { HOMERUN_TIME_MS, type HomerunPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { homerunSounds } from "@/lib/fx/homerunSounds";
import { useMemo, useRef } from "react";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the night park from behind the plate, the batter in his stance, a pitch on its way. */
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
        <ellipse cx="104" cy="74" rx="34" ry="4" fill="#7A5638" />
        <path d="M103 72 l-2 -11 l3 -2 l3 2 l-2 11 Z" fill="#8C2C36" />
        <circle cx="104" cy="57" r="2.2" fill="#C69C7A" />
        <path d="M0 110 Q100 92 200 110 L200 150 L0 150 Z" fill="#7A5638" />
        <rect x="112" y="96" width="30" height="32" fill="none" stroke="#fff" strokeOpacity="0.35" strokeDasharray="3 3" />
        <circle cx="126" cy="106" r="2.6" fill="#F4F3EE" />
        <path d="M120 140 L134 140 L137 146 L127 150 L117 146 Z" fill="#F5F6F2" />
        <path d="M48 148 L56 120 L52 104 L66 104 L70 120 L74 148 L66 148 L62 124 L58 148 Z" fill="#E7E9EF" />
        <path d="M50 104 L48 82 Q60 76 72 82 L70 104 Z" fill="#17244A" />
        <circle cx="61" cy="74" r="7" fill="#2C4282" />
        <ellipse cx="68" cy="74" rx="4" ry="1.2" fill="#0C1430" />
        <circle cx="70" cy="84" r="2.6" fill="#F2C75C" />
        <path d="M70 84 L84 44 L87 45 L73 85 Z" fill="#C08A52" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Read the pitch, then swipe through the ball as it arrives: your swipe's height meets the pitch, its angle sends it left, centre or right.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HomerunPuzzleData | null = puzzle.type === "homerun" ? puzzle : null;
  // devWarp: development review shots only (scripts/shots/homerun-tuning-shots.ts); production returns the game as is.
  const game = useMemo(() => ({ ...devWarp("homerun", homerunGameFor(data?.homerunRev)), draw: drawHomerunArt }), [data?.homerunRev]);
  // The swipe: where the finger went down, and whether this swipe has already started the swing.
  const start = useRef<{ x: number; y: number; sent: boolean } | null>(null);
  // homerunRev 2 reads the swipe over a longer chord (18 px, rev 1 12 px) so its angle, the aim, is steadier.
  const startPx = homerunSwingStartPx(data?.homerunRev);
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
        if (dx * dx + dy * dy < startPx * startPx) return null;
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
  // What the run did, part by part (the points are the stored score's, shown by the arcade reveal above).
  const lines = result.parts.map((part) => `${part.label}: ${part.detail}`);
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
  generate: () => ({ type: "homerun", seed: 1, homerunRev: 2 }) satisfies HomerunPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
