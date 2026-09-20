import { useEffect, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import { decodeFloodMoves, encodeFloodMoves, regionCells, replayFlood } from "@/lib/duel/flood";
import { useStageState } from "@/lib/duel/stageState";
import {
  FLOOD_CELLS,
  FLOOD_COLOURS,
  FLOOD_SIZE,
  FLOOD_TIME_MS,
  type FloodPuzzleData,
  type StroopColour,
} from "@/lib/duel/types";
import { playCorrect, playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The five board colours, in index order. */
const FLOOD_PALETTE: StroopColour[] = ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE"];

function fillOf(colour: number): string {
  return GLYPH_COLOURS[FLOOD_PALETTE[colour % FLOOD_PALETTE.length]!];
}

/** The board, with the player's region ringed in faint gold. */
function Board({
  grid,
  size = FLOOD_SIZE,
  cell = 26,
}: {
  grid: number[];
  size?: number;
  cell?: number;
}) {
  const region = new Set(regionCells(grid, size));
  const edge = (index: number, neighbour: number | null) =>
    neighbour === null || !region.has(neighbour);

  return (
    <div
      className="grid gap-0"
      style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}
      aria-label="Colour Flood board"
    >
      {grid.map((colour, index) => {
        const row = Math.floor(index / size);
        const col = index % size;
        const mine = region.has(index);
        const border = mine
          ? [
              edge(index, row > 0 ? index - size : null),
              edge(index, col < size - 1 ? index + 1 : null),
              edge(index, row < size - 1 ? index + size : null),
              edge(index, col > 0 ? index - 1 : null),
            ]
          : [false, false, false, false];
        return (
          <span
            key={index}
            style={{
              width: cell,
              height: cell,
              background: fillOf(colour),
              boxShadow: mine
                ? `inset 0 ${border[0] ? 2 : 0}px 0 0 ${"#FFFFFF"}, inset ${
                    border[1] ? -2 : 0
                  }px 0 0 0 ${"#FFFFFF"}, inset 0 ${border[2] ? -2 : 0}px 0 0 ${
                    "#FFFFFF"
                  }, inset ${border[3] ? 2 : 0}px 0 0 0 ${"#FFFFFF"}`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

const EXAMPLE_GRID = [0, 1, 1, 2, 0, 1, 3, 2, 3, 3, 1, 1, 2, 2, 1, 1];

/** Fixed intro example — a 4×4 board after two taps. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <Board grid={EXAMPLE_GRID} size={4} cell={22} />
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <Board grid={replayFlood(EXAMPLE_GRID, [1, 3], 4).grid} size={4} cell={22} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Two taps, and the top-left region has swallowed its neighbours.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "flood",
}: PuzzleStageProps) {
  const data: FloodPuzzleData | null = puzzle.type === "flood" ? puzzle : null;
  const [moves, setMoves] = useStageState<number[]>(stateKey, "floodMoves", () => []);
  const submitted = useRef(false);

  const replay = data ? replayFlood(data.grid, moves) : null;

  useEffect(() => {
    onDraftAnswer?.(encodeFloodMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + FLOOD_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeFloodMoves(moves));
  }, [now, phaseStartedAt, locked, data, moves, onSubmit]);

  if (!data || !replay) return null;

  const tap = (colour: number) => {
    if (locked || submitted.current || replay.solved) return;
    if (replay.grid[0] === colour) return;
    hapticTick();
    const next = [...moves, colour];
    setMoves(next);
    const after = replayFlood(data.grid, next);
    if (after.solved) {
      submitted.current = true;
      playLock();
      onSubmit(encodeFloodMoves(next));
      return;
    }
    playCorrect();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <Board grid={replay.grid} />
      <div className="flex shrink-0 items-center gap-2">
        {Array.from({ length: FLOOD_COLOURS }, (_, colour) => (
          <button
            key={colour}
            type="button"
            aria-label={FLOOD_PALETTE[colour]}
            onPointerDown={() => tap(colour)}
            className="rounded-lg border-2 border-border"
            style={{ width: 52, height: 52, background: fillOf(colour) }}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          Moves: {replay.moves} (par {data.par})
        </span>
        <button
          type="button"
          onPointerDown={() => (moves.length ? setMoves(moves.slice(0, -1)) : undefined)}
          className="rounded-md border border-border px-3 py-1 font-display text-xs uppercase tracking-wide text-muted-foreground"
        >
          Undo
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "flood") return null;
  const replay = replayFlood(puzzle.grid, decodeFloodMoves(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((FLOOD_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <Board grid={replay.grid} cell={20} />
      <p
        className={`shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.solved
          ? `Solved · ${replay.moves} moves (par ${puzzle.par})${
              elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""
            }`
          : `${replay.region} / ${FLOOD_CELLS} cells`}
      </p>
    </div>
  );
}

/** The grid and par are public; one par-length route stays in the secrets row. */
export const colourFloodPuzzle: PuzzleDefinition = {
  key: "flood",
  name: "Colour Flood",
  category: "logic",
  timeLimitMs: FLOOD_TIME_MS,
  revealMs: 5_000,
  generate: () => ({ type: "flood", grid: [], par: 0 }) satisfies FloodPuzzleData,
  check: () => false,
  revealHeading: "The board",
  IntroExample,
  Stage,
  Reveal,
};
