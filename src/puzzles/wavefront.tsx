import {
  wavCheckpoint,
  wavefrontGame,
  WAV_BG,
  WAV_CHECKPOINT_INTERVAL,
  WAV_COLOURS,
  WAV_DRAG_ZONE_TOP,
  WAV_GOLD,
  WAV_WORLD_H,
  WAV_WORLD_W,
} from "@/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "@/lib/duel/wavefront";
import { WAVEFRONT_TIME_MS, type WavefrontPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a 2×3 formation over the ship, with one bolt in flight. */
function IntroExample() {
  const shapes = [
    { kind: "ring", c: 0 },
    { kind: "tri", c: 1 },
    { kind: "hex", c: 2 },
    { kind: "tri", c: 2 },
    { kind: "hex", c: 0 },
    { kind: "ring", c: 1 },
  ];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 130"
        width={168}
        height={130}
        aria-hidden="true"
        style={{ background: WAV_BG, borderRadius: 10 }}
      >
        {shapes.map((shape, i) => {
          const cx = 44 + (i % 3) * 40;
          const cy = 24 + Math.trunc(i / 3) * 30;
          const colour = WAV_COLOURS[shape.c];
          if (shape.kind === "ring")
            return <circle key={i} cx={cx} cy={cy} r={10} fill="none" stroke={colour} strokeWidth={3} />;
          const n = shape.kind === "tri" ? 3 : 6;
          const pts = Array.from({ length: n }, (_, p) => {
            const a = -Math.PI / 2 + (p * Math.PI * 2) / n;
            return `${cx + Math.cos(a) * 11},${cy + Math.sin(a) * 11 + (n === 3 ? 2 : 0)}`;
          }).join(" ");
          return (
            <polygon key={i} points={pts} fill={colour} fillOpacity={0.25} stroke={colour} strokeWidth={3} />
          );
        })}
        <rect x={82} y={78} width={4} height={12} fill={WAV_GOLD} />
        <polygon points="84,100 104,118 84,112 64,118" fill={WAV_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Your ship fires on its own.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: WavefrontPuzzleData | null = puzzle.type === "wavefront" ? puzzle : null;
  return (
    <ArcadeCanvasStage
      diagKey="wavefront"
      label="Wavefront"
      background={WAV_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={WAV_WORLD_W}
      worldH={WAV_WORLD_H}
      game={wavefrontGame}
      checkpoint={wavCheckpoint}
      interval={WAV_CHECKPOINT_INTERVAL}
      encodeRun={encodeWavefrontRun}
      pointer={(kind, x, y) => {
        if (kind === "down" && y < WAV_DRAG_ZONE_TOP) return null;
        return { a: x, b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function wavefrontLine(r: {
  wave: number;
  shapesDown: number;
  saucers: number;
  survived: boolean;
  endedSeconds: number;
}): string {
  const head = `Wave ${r.wave} · ${r.shapesDown} shape${r.shapesDown === 1 ? "" : "s"} · ${r.saucers} saucer${r.saucers === 1 ? "" : "s"}`;
  return r.survived ? `${head} · survived` : `${head} · destroyed at ${r.endedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "wavefront") return null;
  const result = replayWavefrontRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {wavefrontLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.wavesCleared} wave{result.wavesCleared === 1 ? "" : "s"} cleared · {result.armourHits} armour
        hit{result.armourHits === 1 ? "" : "s"} · same formation for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const wavefrontPuzzle: PuzzleDefinition = {
  key: "wavefront",
  name: "Wavefront",
  category: "arcade",
  timeLimitMs: WAVEFRONT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "wavefront", seed: 1 }) satisfies WavefrontPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
