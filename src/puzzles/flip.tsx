import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  flipCheckpoint,
  FLIP_BG,
  FLIP_CHECKPOINT_INTERVAL,
  FLIP_GOLD,
  FLIP_INPUT_TAP,
  FLIP_RED,
  FLIP_WORLD_H,
  FLIP_WORLD_W,
} from "@/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "@/lib/duel/flip";
import { FLIP_TIME_MS, type FlipPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { flipArenaScene, flipArtGameFor } from "@/lib/arcade/flipArt.renderer";
import { flipSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: floor spikes ahead, the runner arcing to the ceiling. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: FLIP_BG, borderRadius: 10 }}>
        <line x1={0} y1={24} x2={168} y2={24} stroke={FLIP_GOLD} strokeWidth={2} />
        <line x1={0} y1={106} x2={168} y2={106} stroke={FLIP_GOLD} strokeWidth={2} />
        <polygon points="96,106 104,92 112,106 120,92 128,106" fill={FLIP_RED} />
        <path d="M40 96 Q60 64 80 34" fill="none" stroke={FLIP_GOLD} strokeOpacity={0.4} strokeDasharray="3 4" />
        <rect x={18} y={106} width={34} height={6} fill="#7C726A" />
        <path d="M26 106 l2 4 M38 106 l-1 5 M46 106 l2 3" stroke="#FF8C3C" strokeWidth={1.2} />
        <polygon points="132,34 134.4,39 140,39.6 135.8,43.2 137,48.6 132,46 127,48.6 128.2,43.2 124,39.6 129.6,39" fill="#FFE84A" />
        <rect x={72} y={26} width={18} height={22} rx={8} fill={FLIP_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Spikes below? Flip up. Grab the stars; cracked tiles give way.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: FlipPuzzleData | null = puzzle.type === "flip" ? puzzle : null;
  const game = flipArtGameFor(data?.flipRev);
  return (
    <ArcadeCanvasStage
      diagKey="flip"
      label={gameDisplayName("flip")}
      background={FLIP_BG}
      fitWorld
      scene={flipArenaScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={FLIP_WORLD_W}
      worldH={FLIP_WORLD_H}
      game={game}
      sounds={flipSounds}
      checkpoint={flipCheckpoint}
      interval={FLIP_CHECKPOINT_INTERVAL}
      encodeRun={encodeFlipRun}
      discrete
      inputKind={FLIP_INPUT_TAP}
      pointer={(kind) => (kind === "down" ? { a: 0, b: 0, c: 0 } : null)}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function flipLine(r: { survived: boolean; survivedSeconds: number }): string {
  return r.survived ? "Survived the minute" : `Survived ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "flip") return null;
  const result = replayFlipRun(puzzle.seed, myAnswer ?? "", puzzle.flipRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {flipLine(result)}
      </p>
      {result.starsTotal > 0 ? (
        <p className="shrink-0 text-center font-mono text-base text-foreground">
          ★ {result.stars} / {result.starsTotal} stars
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same corridor for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const flipPuzzle: PuzzleDefinition = {
  key: "flip",
  name: gameDisplayName("flip"),
  category: "arcade",
  timeLimitMs: FLIP_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "flip", seed: 1 }) satisfies FlipPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
