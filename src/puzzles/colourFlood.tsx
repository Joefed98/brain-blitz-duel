import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { decodeFloodMoves, encodeFloodMoves, regionCells, replayFlood } from "@/lib/duel/flood";
import { useStageState } from "@/lib/duel/stageState";
import {
  FLOOD_CELLS,
  FLOOD_COLOURS,
  FLOOD_SIZE,
  FLOOD_TIME_MS,
  type FloodPuzzleData,
} from "@/lib/duel/types";
import { playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Wet-paint display colours for stored indices 0–4 (red, blue, green, yellow, orange), chosen to stay distinct with red-green colour blindness. */
const FLOOD_FILLS = ["var(--flood-a)", "var(--flood-b)", "var(--flood-c)", "var(--flood-d)", "var(--flood-e)"];
const FLOOD_NAMES = ["Magenta", "Blue", "Mint", "Yellow", "Orange"];

function fillOf(colour: number): string {
  return FLOOD_FILLS[colour % FLOOD_FILLS.length]!;
}

/** The board, with one white outline around the player's region boundary. */
function Board({
  grid,
  size = FLOOD_SIZE,
  cell = 26,
  fluid = false,
  ripple,
}: {
  grid: number[];
  size?: number;
  cell?: number;
  fluid?: boolean;
  /** Cells that just joined the region, keyed by move count so each move replays it. */
  ripple?: { cells: Set<number>; key: number } | undefined;
}) {
  const region = new Set(regionCells(grid, size));
  const edge = (index: number, neighbour: number | null) =>
    neighbour === null || !region.has(neighbour);

  return (
    <div
      className={`puzzle-board grid gap-0 ${fluid ? "w-full aspect-square" : ""}`}
      style={{ gridTemplateColumns: `repeat(${size}, ${fluid ? "minmax(0, 1fr)" : `${cell}px`})` }}
      aria-label={`${gameDisplayName("flood")} board`}
    >
      {grid.map((colour, index) => {
        const row = Math.floor(index / size);
        const col = index % size;
        const mine = region.has(index);
        const nb = [row > 0 ? index - size : null, col < size - 1 ? index + 1 : null, row < size - 1 ? index + size : null, col > 0 ? index - 1 : null];
        // A side is an edge where the colour changes (or the board ends); same-colour cells join seamlessly.
        const side = nb.map((n) => n === null || grid[n] !== colour);
        const line = nb.map((n) => n !== null && grid[n] !== colour);
        const wet = mine ? nb.map((n) => edge(index, n)) : [false, false, false, false];
        const shadows: string[] = [];
        const push = (on: boolean, x: number, y: number, c: string) => { if (on) shadows.push(`inset ${x}px ${y}px 0 0 ${c}`); };
        const w = (i: number) => (wet[i] ? 2 : 1);
        const c = (i: number) => (wet[i] ? "var(--tally-white)" : "var(--flood-edge)");
        push(line[0] || wet[0], 0, w(0), c(0));
        push(line[1] || wet[1], -w(1), 0, c(1));
        push(line[2] || wet[2], 0, -w(2), c(2));
        push(line[3] || wet[3], w(3), 0, c(3));
        const r = (a: number, b2: number) => (side[a] && side[b2] ? "28%" : "0");
        return (
          <span
            key={ripple?.cells.has(index) ? `${index}-${ripple.key}` : index}
            className={`flood-tile ${mine ? "flood-wet" : ""} ${ripple?.cells.has(index) ? "flood-ripple" : ""}`}
            style={{
              animationDelay: ripple?.cells.has(index) ? `${Math.min(80, (row + col) * 6)}ms` : undefined,
              animationDuration: "220ms",
              width: fluid ? "100%" : cell,
              height: fluid ? "100%" : cell,
              backgroundColor: fillOf(colour),
              borderRadius: `${r(0, 3)} ${r(0, 1)} ${r(2, 1)} ${r(2, 3)}`,
              boxShadow: shadows.length ? shadows.join(", ") : undefined,
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
        Two taps, and the wet paint from the top-left has swallowed its neighbours.
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
  // Presentation only: which cells the last move swallowed, for the wet-paint ripple.
  const ripple = useMemo(() => {
    if (!data || !moves.length) return undefined;
    const before = new Set(regionCells(replayFlood(data.grid, moves.slice(0, -1)).grid, FLOOD_SIZE));
    const after = regionCells(replayFlood(data.grid, moves).grid, FLOOD_SIZE);
    return { cells: new Set(after.filter((cell) => !before.has(cell))), key: moves.length };
  }, [data, moves]);

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
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 px-3">
      <Board grid={replay.grid} fluid ripple={ripple} />
      <div data-after-arena data-game-controls="colours" className="flex shrink-0 items-center gap-2">
        {Array.from({ length: FLOOD_COLOURS }, (_, colour) => (
          <button
            key={colour}
            type="button"
            aria-label={FLOOD_NAMES[colour]}
            onPointerDown={() => tap(colour)}
            className="flood-tile rounded-lg border-2 border-border"
            style={{ width: 52, height: 52, backgroundColor: fillOf(colour), borderRadius: 10 }}
          />
        ))}
      </div>
      <div data-game-controls="status" className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          Moves: {replay.moves}
        </span>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "flood") return null;
  const replay = replayFlood(puzzle.grid, decodeFloodMoves(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <Board grid={replay.grid} cell={20} />
       <p className="text-center font-mono text-base text-muted-foreground">Par {puzzle.par} — you used {replay.moves}</p>
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
         {replay.solved
           ? solvedMovesText(replay.moves, puzzle.par, myMsRemaining, timeLimitMs, "C")
          : `${replay.region} / ${FLOOD_CELLS} cells`}
      </p>
    </div>
  );
}

/** The grid and par are public; one par-length route stays in the secrets row. */
export const colourFloodPuzzle: PuzzleDefinition = {
  key: "flood",
  name: gameDisplayName("flood"),
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
