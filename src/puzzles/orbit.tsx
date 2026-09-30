import {
  orbitCheckpoint,
  orbitGame,
  ORBIT_BG,
  ORBIT_CHECKPOINT_INTERVAL,
  ORBIT_COLOURS,
  ORBIT_GOLD,
  ORBIT_INPUT_TAP,
  ORBIT_RED,
  ORBIT_WORLD_H,
  ORBIT_WORLD_W,
} from "@/lib/arcade/orbit";
import { encodeOrbitRun, replayOrbitRun } from "@/lib/duel/orbit";
import { ORBIT_TIME_MS, type OrbitPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the ship leaving one orbit toward the next planet. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 150" width={168} height={150} aria-hidden="true" style={{ background: ORBIT_BG, borderRadius: 10 }}>
        <circle cx={50} cy={110} r={30} fill="none" stroke={ORBIT_COLOURS[0]} strokeOpacity={0.25} />
        <circle cx={50} cy={110} r={12} fill="none" stroke={ORBIT_COLOURS[0]} strokeWidth={4} />
        <circle cx={120} cy={42} r={28} fill="none" stroke={ORBIT_COLOURS[1]} strokeOpacity={0.25} />
        <circle cx={120} cy={42} r={11} fill="none" stroke={ORBIT_COLOURS[1]} strokeWidth={4} />
        <path d="M 120 14 A 28 28 0 0 1 148 42" fill="none" stroke={ORBIT_RED} strokeWidth={4} />
        <line x1={50} y1={80} x2={104} y2={64} stroke={ORBIT_GOLD} strokeOpacity={0.4} strokeDasharray="3 4" />
        <polygon points="80,71 68,70 72,80" fill={ORBIT_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Let go so the next orbit catches you.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: OrbitPuzzleData | null = puzzle.type === "orbit" ? puzzle : null;
  return (
    <ArcadeCanvasStage
      diagKey="orbit"
      label="Orbit"
      background={ORBIT_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={ORBIT_WORLD_W}
      worldH={ORBIT_WORLD_H}
      game={orbitGame}
      checkpoint={orbitCheckpoint}
      interval={ORBIT_CHECKPOINT_INTERVAL}
      encodeRun={encodeOrbitRun}
      discrete
      inputKind={ORBIT_INPUT_TAP}
      pointer={(kind) => (kind === "down" ? { a: 0, b: 0, c: 0 } : null)}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function orbitLine(r: { passed: number; total: number; survived: boolean; survivedSeconds: number; finished: boolean; secondsLeft: number }): string {
  if (r.finished) return `${r.passed} / ${r.total} · finished with ${r.secondsLeft.toFixed(1)}s left`;
  const head = `${r.passed} / ${r.total} planets`;
  return r.survived ? `${head} · survived` : `${head} · lost at ${r.survivedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "orbit") return null;
  const result = replayOrbitRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {orbitLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same planets for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const orbitPuzzle: PuzzleDefinition = {
  key: "orbit",
  name: "Orbit",
  category: "arcade",
  timeLimitMs: ORBIT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "orbit", seed: 1 }) satisfies OrbitPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
