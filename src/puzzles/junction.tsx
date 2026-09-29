import {
  juncApproachAt,
  juncCheckpoint,
  junctionGame,
  JUNC_BG,
  JUNC_CAR_COLOURS,
  JUNC_CHECKPOINT_INTERVAL,
  JUNC_GOLD,
  JUNC_INPUT_TAP,
  JUNC_RED,
  JUNC_ROAD,
  JUNC_WORLD_H,
  JUNC_WORLD_W,
} from "@/lib/arcade/junction";
import { encodeJunctionRun, replayJunctionRun } from "@/lib/duel/junction";
import { JUNCTION_TIME_MS, type JunctionPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a crossroads, one road green and one red with a queue. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: JUNC_BG, borderRadius: 10 }}>
        <rect x={70} y={0} width={28} height={130} fill={JUNC_ROAD} />
        <rect x={0} y={51} width={168} height={28} fill={JUNC_ROAD} />
        <rect x={72} y={14} width={10} height={18} rx={3} fill={JUNC_CAR_COLOURS[1]} />
        <rect x={34} y={66} width={18} height={10} rx={3} fill={JUNC_CAR_COLOURS[0]} />
        <rect x={12} y={66} width={18} height={10} rx={3} fill={JUNC_CAR_COLOURS[2]} />
        <circle cx={62} cy={44} r={4} fill={JUNC_GOLD} />
        <circle cx={58} cy={88} r={4} fill={JUNC_RED} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Tap a road to switch its light.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: JunctionPuzzleData | null = puzzle.type === "junction" ? puzzle : null;
  return (
    <ArcadeCanvasStage
      diagKey="junction"
      label="Junction"
      background={JUNC_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={JUNC_WORLD_W}
      worldH={JUNC_WORLD_H}
      game={junctionGame}
      checkpoint={juncCheckpoint}
      interval={JUNC_CHECKPOINT_INTERVAL}
      encodeRun={encodeJunctionRun}
      discrete
      inputKind={JUNC_INPUT_TAP}
      pointer={(kind, x, y) => (kind === "down" ? { a: juncApproachAt(x, y), b: 0, c: 0 } : null)}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function junctionLine(r: { cleared: number; gaveUp: number; survived: boolean; survivedSeconds: number }): string {
  const head = `${r.cleared} cleared · ${r.gaveUp} drove off`;
  return r.survived ? `${head} · survived` : `${head} · crash at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "junction") return null;
  const result = replayJunctionRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {junctionLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.total} cars scheduled · same traffic for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const junctionPuzzle: PuzzleDefinition = {
  key: "junction",
  name: "Junction",
  category: "arcade",
  timeLimitMs: JUNCTION_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "junction", seed: 1 }) satisfies JunctionPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
