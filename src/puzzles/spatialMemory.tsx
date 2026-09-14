import { useEffect, useState } from "react";

import { SequenceGrid } from "@/components/duel/SequenceGrid";
import { shuffled } from "@/lib/duel/random";
import {
  SPATIAL_GRID_COLS,
  SPATIAL_LEAD_IN_MS,
  SPATIAL_PREP_MS,
  SPATIAL_SHOW_MS,
  SPATIAL_TILES,
  type SpatialPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const COLS = SPATIAL_GRID_COLS;

/** Fixed intro example — six tiles of the 5x5 grid, every time. */
const EXAMPLE = [1, 7, 9, 13, 18, 20];

function parseTaps(answer: string): number[] {
  return answer
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
}

function sameTiles(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return set.size === a.length && b.every((v) => set.has(v));
}

/** Tiles all in one row, one column, or a diagonal are too easy. */
function isStraightLine(tiles: number[]): boolean {
  const rows = tiles.map((t) => Math.floor(t / COLS));
  const cols = tiles.map((t) => t % COLS);
  if (new Set(rows).size === 1 || new Set(cols).size === 1) return true;
  const sorted = [...tiles].sort((a, b) => a - b);
  const step = sorted[1]! - sorted[0]!;
  if (step !== COLS + 1 && step !== COLS - 1) return false;
  return sorted.every((t, i) => i === 0 || t - sorted[i - 1]! === step);
}

/** A 2x2 block is too easy as well. */
function isBlock(tiles: number[]): boolean {
  const rows = new Set(tiles.map((t) => Math.floor(t / COLS)));
  const cols = new Set(tiles.map((t) => t % COLS));
  if (rows.size !== 2 || cols.size !== 2) return false;
  const [r1, r2] = [...rows].sort((a, b) => a - b);
  const [c1, c2] = [...cols].sort((a, b) => a - b);
  return r2! - r1! === 1 && c2! - c1! === 1;
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Six tiles light up, then vanish. Tap where they were — any order.
      </p>
      <SequenceGrid order={EXAMPLE} cols={COLS} size="sm" numbered={false} />
      <p className="text-xs text-muted-foreground">Your timer starts after the tiles disappear.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const tiles = puzzle.type === "spatial" ? puzzle.tiles : [];
  const key = tiles.join(",");
  const [taps, setTaps] = useState<number[]>([]);

  useEffect(() => {
    setTaps([]);
  }, [key]);

  const elapsed = now - phaseStartedAt;
  const showing = elapsed >= SPATIAL_LEAD_IN_MS && elapsed < SPATIAL_LEAD_IN_MS + SPATIAL_SHOW_MS;
  const revealing = elapsed < SPATIAL_PREP_MS;

  if (puzzle.type !== "spatial") return null;

  const handleTap = (index: number) => {
    if (revealing || locked || taps.includes(index) || taps.length >= tiles.length) return;
    const next = [...taps, index];
    setTaps(next);
    if (next.length === tiles.length) {
      onSubmit([...next].sort((a, b) => a - b).join(","));
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {revealing ? "Remember the tiles" : "Tap the six tiles"}
      </p>

      <div className="flex gap-2">
        {tiles.map((_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${
              index < taps.length ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: COLS * COLS }, (_, index) => {
          const lit = showing && tiles.includes(index);
          const tapped = taps.includes(index);
          return (
            <button
              key={index}
              type="button"
              aria-label={`Tile ${index + 1}`}
              onClick={() => handleTap(index)}
              disabled={revealing || locked}
              className={`h-[58px] w-[58px] rounded-xl border transition-colors ${
                lit
                  ? "border-primary bg-primary"
                  : tapped
                    ? "border-primary bg-primary/30"
                    : "border-border bg-card"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "spatial") return null;
  const taps = parseTaps(myAnswer ?? "");
  const wrong = taps.filter((t) => !puzzle.tiles.includes(t));

  return (
    <>
      <SequenceGrid order={puzzle.tiles} cols={COLS} numbered={false} wrong={wrong} />
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
        {taps.length === 0 ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <span
            className={`font-display text-3xl font-bold ${
              myCorrect ? "text-primary" : "text-warn"
            }`}
          >
            {myCorrect ? "✓" : "✗"}
          </span>
        )}
      </div>
    </>
  );
}

export function buildSpatial(): SpatialPuzzleData {
  const all = Array.from({ length: COLS * COLS }, (_, i) => i);
  for (let attempt = 0; attempt < 200; attempt++) {
    const tiles = shuffled(all)
      .slice(0, SPATIAL_TILES)
      .sort((a, b) => a - b);
    if (isStraightLine(tiles) || isBlock(tiles)) continue;
    return { type: "spatial", tiles };
  }
  return { type: "spatial", tiles: [1, 7, 9, 13, 18, 20] };
}

export const spatialMemoryPuzzle: PuzzleDefinition = {
  key: "spatial",
  name: "Spatial Memory",
  category: "memory",
  generate: buildSpatial,
  check: (answer, puzzle) => {
    if (puzzle.type !== "spatial") return false;
    return sameTiles(parseTaps(answer), puzzle.tiles);
  },
  prepMs: () => SPATIAL_PREP_MS,
  IntroExample,
  Stage,
  Reveal,
};
