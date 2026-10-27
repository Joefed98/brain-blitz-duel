import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { decodeFloodMoves, encodeFloodMoves, regionCells, replayFlood } from "@/lib/duel/flood";
import { floodMoveLimit, limitText } from "@/lib/duel/moveLimits";
import { useStageState } from "@/lib/duel/stageState";
import {
  FLOOD_CELLS,
  FLOOD_COLOURS,
  FLOOD_SIZE,
  FLOOD_TIME_MS,
  type FloodPuzzleData,
} from "@/lib/duel/types";
import { playLock } from "@/lib/sound";
import { useGameKeys } from "@/lib/desktop";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { wrongMoveFlash } from "@/lib/fx/gameToolkit";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Wet-paint display colours for stored indices 0–4 (red, blue, green, yellow, orange), chosen to stay distinct with red-green colour blindness. */
const FLOOD_FILLS = ["var(--flood-a)", "var(--flood-b)", "var(--flood-c)", "var(--flood-d)", "var(--flood-e)"];
const FLOOD_NAMES = ["Magenta", "Blue", "Mint", "Yellow", "Orange"];

function fillOf(colour: number): string {
  return FLOOD_FILLS[colour % FLOOD_FILLS.length]!;
}

/** The board, with one white outline around the player's region boundary. */
export function Board({
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
      className={`puzzle-board logic-flood relative grid gap-0 ${fluid ? "w-full aspect-square" : ""}`}
      style={{ gridTemplateColumns: `repeat(${size}, ${fluid ? "minmax(0, 1fr)" : `${cell}px`})` }}
      aria-label={`${gameDisplayName("flood")} board`}
    >
      <span aria-hidden="true" className="logic-flood-sheen" />
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
        const push = (on: boolean | undefined, x: number, y: number, c: string) => { if (on) shadows.push(`inset ${x}px ${y}px 0 0 ${c}`); };
        const w = (i: number) => (wet[i] ? 2 : 1);
        const c = (i: number) => (wet[i] ? "var(--tally-white)" : "var(--flood-edge)");
        push(line[0] || wet[0], 0, w(0), c(0));
        push(line[1] || wet[1], -w(1), 0, c(1));
        push(line[2] || wet[2], 0, -w(2), c(2));
        push(line[3] || wet[3], w(3), 0, c(3));
        const r = (a: number, b2: number) => (side[a] && side[b2] ? "20%" : "0");
        return (
          <span
            key={ripple?.cells.has(index) ? `${index}-${ripple.key}` : index}
            className={`flood-tile ${mine ? "flood-wet" : ""} ${ripple?.cells.has(index) ? "flood-ripple" : ""}`}
            style={{
              "--logic-diag": row + col,
              animationDelay: ripple?.cells.has(index) ? `${Math.min(80, (row + col) * 6)}ms` : undefined,
              animationDuration: "220ms",
              width: fluid ? "100%" : cell,
              height: fluid ? "100%" : cell,
              backgroundColor: fillOf(colour),
              borderRadius: `${r(0, 3)} ${r(0, 1)} ${r(2, 1)} ${r(2, 3)}`,
              boxShadow: shadows.length ? shadows.join(", ") : undefined,
            } as CSSProperties}
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

  // floodRev 1: a visible move limit; the last allowed tap ends the board (moveLimits.ts).
  const moveLimit = data ? floodMoveLimit(data) : null;
  const replay = data ? replayFlood(data.grid, moves, undefined, moveLimit) : null;
  const solving = useSolveFx("flood", Boolean(replay?.solved && moves.length));
  const inFrame = useFrameProgress(replay?.region ?? 0, FLOOD_CELLS, "flooded");
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

  // Desktop keys: 1–5 tap the colour pot in that place, left to right.
  useGameKeys((kind, key, event) => {
    if (!data || !replay) return false;
    const colour = /^[1-9]$/.test(key) && Number(key) <= FLOOD_COLOURS ? Number(key) - 1 : null;
    if (colour === null) return false;
    if (kind === "down" && !event.repeat) tap(colour);
    return true;
  });

  if (!data || !replay) return null;

  const tap = (colour: number) => {
    if (locked || submitted.current || replay.solved || replay.outOfMoves) return;
    if (replay.grid[0] === colour) {
      // Batch P (display only): the pot already in use shakes, so a tap that changes nothing still answers.
      wrongMoveFlash(document.querySelector(`[data-game-stage] [aria-label="${FLOOD_NAMES[colour]}"]`));
      return;
    }
    hapticTick();
    soundCue("flood.spread");
    const next = [...moves, colour];
    setMoves(next);
    const after = replayFlood(data.grid, next, undefined, moveLimit);
    if (after.solved) {
      submitted.current = true;
      playLock();
      onSubmit(encodeFloodMoves(next));
      return;
    }
    // Out of moves: the board ends unfinished and goes in now.
    if (after.outOfMoves) {
      submitted.current = true;
      onSubmit(encodeFloodMoves(next));
    }
  };

  return (
    <div data-logic-stage="flood" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 w-full flex-1 flex-col items-center gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        <div className="logic-square-bare logic-flood-frame">
          <Board grid={replay.grid} fluid ripple={ripple} />
        </div>
      </div>
      {/* The moves line sits above the colours and the colours are lifted off the bottom edge (14 Oct 2026), so nothing is cut off. */}
      {inFrame ? (
        <LiveSummary
          items={[
            <SummaryItem
              key="moves"
              label="Moves"
              value={<span data-move-limit={moveLimit ?? undefined}>{moveLimit !== null ? limitText(replay.moves, moveLimit) : replay.moves}</span>}
              warn={replay.outOfMoves}
            />,
            data.par ? <SummaryItem key="par" label="Par" value={data.par} /> : null,
          ]}
        />
      ) : (
        <div data-game-controls="status" className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground" data-move-limit={moveLimit ?? undefined}>
            {moveLimit !== null
              ? <>Moves <span className={replay.outOfMoves ? "text-warn" : undefined}>{limitText(replay.moves, moveLimit)}</span></>
              : <>Moves: {replay.moves}</>}
          </span>
        </div>
      )}
      <div data-game-controls="colours" className="flood-colours flex shrink-0 items-center gap-2">
        {Array.from({ length: FLOOD_COLOURS }, (_, colour) => (
          <button
            key={colour}
            type="button"
            aria-label={FLOOD_NAMES[colour]}
            onPointerDown={() => tap(colour)}
            className={`flood-tile logic-paint-pot ${replay.grid[0] === colour ? "logic-paint-pot-current" : ""}`}
            style={{ width: 52, height: 52, backgroundColor: fillOf(colour) }}
          />
        ))}
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, scoreParts }: PuzzleRevealProps) {
  if (puzzle.type !== "flood") return null;
  const moveLimit = floodMoveLimit(puzzle);
  const replay = replayFlood(puzzle.grid, decodeFloodMoves(myAnswer ?? ""), undefined, moveLimit);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-square-bare logic-flood-frame" style={{ maxWidth: 300 }}>
          <Board grid={replay.grid} fluid />
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono text-muted-foreground">
        Par {puzzle.par} – you used {replay.moves}{moveLimit !== null ? ` of ${moveLimit}` : ""}
      </p>
      <p
        className={`logic-reveal-text whitespace-normal break-words text-center font-mono font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
         {replay.solved
           ? solvedMovesText(replay.moves, puzzle.par, myMsRemaining, timeLimitMs, "C", scoreParts)
          : `${replay.region} / ${FLOOD_CELLS} cells${replay.outOfMoves ? " · out of moves" : ""}`}
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
