import {
  hotfloorCheckpoint,
  hotFloorGame,
  hotfloorHit,
  HOT_BG,
  HOT_GOLD,
  HOT_INPUT_TILE,
  HOT_RED,
  HOT_WORLD_H,
  HOT_WORLD_W,
  HOTFLOOR_CHECKPOINT_INTERVAL,
} from "@/lib/arcade/hotFloor";
import { encodeHotFloorRun, replayHotFloorRun } from "@/lib/duel/hotFloor";
import { HOTFLOOR_TIME_MS, type HotFloorPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed worked example: numbers are hops each tile lasts; the gold route holds. */
function IntroExample() {
  // Row-major 3×3; start bottom-left (6), exit top-right (2).
  const values: (number | string)[] = [2, 1, "EXIT", 1, 2, 3, "START", 2, 3];
  const route = [6, 7, 8, 5, 2];
  const hopOf = new Map(route.map((cell, i) => [cell, i]));
  const at = (cell: number) => ({ x: 24 + (cell % 3) * 40, y: 24 + Math.trunc(cell / 3) * 40 });
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 132 132" width={132} height={132} aria-hidden="true" style={{ background: HOT_BG, borderRadius: 10 }}>
        {values.map((value, cell) => {
          const p = at(cell);
          const exit = value === "EXIT";
          return (
            <g key={cell}>
              <rect x={p.x - 18} y={p.y - 18} width={36} height={36} rx={6} fill={exit ? HOT_GOLD : "#1A1A24"} />
              <text x={p.x} y={p.y + 4} fill={exit ? HOT_BG : value === 1 ? HOT_RED : "#E8E8ED"} textAnchor="middle" fontFamily="monospace" fontSize={typeof value === "string" ? 8 : 13} fontWeight="700">{value}</text>
            </g>
          );
        })}
        <polyline points={route.map((cell) => `${at(cell).x},${at(cell).y}`).join(" ")} fill="none" stroke={HOT_GOLD} strokeWidth={3} strokeOpacity={0.85} strokeLinejoin="round" />
        {route.slice(1).map((cell) => (
          <g key={`h${cell}`}>
            <circle cx={at(cell).x - 11} cy={at(cell).y - 11} r={6} fill={HOT_GOLD} />
            <text x={at(cell).x - 11} y={at(cell).y - 8.5} fill={HOT_BG} textAnchor="middle" fontFamily="monospace" fontSize="8" fontWeight="700">{hopOf.get(cell)}</text>
          </g>
        ))}
      </svg>
      <p className="text-center text-xs text-muted-foreground">Every tile must last until its hop number. The left route falls at hop 3.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HotFloorPuzzleData | null = puzzle.type === "hotfloor" ? puzzle : null;
  return (
    <ArcadeCanvasStage
      diagKey="hotfloor"
      label="Hot Floor"
      background={HOT_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={HOT_WORLD_W}
      worldH={HOT_WORLD_H}
      game={hotFloorGame}
      checkpoint={hotfloorCheckpoint}
      interval={HOTFLOOR_CHECKPOINT_INTERVAL}
      encodeRun={encodeHotFloorRun}
      discrete
      inputKind={HOT_INPUT_TILE}
      pointer={(kind, x, y) => {
        if (kind !== "down") return null;
        const hit = hotfloorHit(x, y);
        return hit ? { k: hit.k, a: hit.a, b: 0, c: 0 } : null;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function hotFloorLine(r: { stages: number; livesLost: number; completedSeconds: number }): string {
  return r.stages >= 10
    ? `10 stages · ${r.completedSeconds.toFixed(1)}s`
    : `${r.stages} stages · ${r.livesLost} ${r.livesLost === 1 ? "life" : "lives"} lost`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "hotfloor") return null;
  const result = replayHotFloorRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {hotFloorLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same routes for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const hotFloorPuzzle: PuzzleDefinition = {
  key: "hotfloor",
  name: "Hot Floor",
  category: "arcade",
  timeLimitMs: HOTFLOOR_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "hotfloor", seed: 1 }) satisfies HotFloorPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
