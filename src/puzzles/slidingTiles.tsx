import { puzzleReject } from "@/lib/fx/puzzleReject";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef } from "react";

import { hapticTick, pointerElementIndex } from "@/components/puzzles/GridDrag";
import { useNoTouchScroll } from "@/components/puzzles/noScroll";
import {
  decodeTileMoves,
  encodeTileMoves,
  replayTiles,
  solvedFrame,
  TILES_RESET,
  TILES_UNDO,
} from "@/lib/duel/tiles";
import { useStageState } from "@/lib/duel/stageState";
import {
  TILES_COUNT,
  TILES_SIZE,
  TILES_SLIDE_MS,
  TILES_TIME_MS,
  type TilesPuzzleData,
} from "@/lib/duel/types";
import { playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * A soft, continuous hue ramp from tile 1 through 8, so finished order reads
 * at a glance without the louder flat glyph colours.
 */
const TILE_GRADIENT_STOPS = 8;

function tileFill(value: number): string {
  const step = (value - 1) % TILE_GRADIENT_STOPS;
  const hue = 215 - (step / (TILE_GRADIENT_STOPS - 1)) * 175;
  return `hsl(${hue.toFixed(0)} 52% 58%)`;
}

function Frame({
  frame,
  cell,
  onTile,
}: {
  frame: number[];
  cell: number;
  onTile?: ((tile: number) => void) | undefined;
}) {
  const board = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(board);
  return (
    <div
      ref={board}
      className="puzzle-board grid gap-1.5 rounded-xl border-2 border-border bg-card p-1.5"
      style={{ gridTemplateColumns: `repeat(${TILES_SIZE}, ${cell}px)` }}
      aria-label={`${gameDisplayName("tiles")} frame`}
    >
      {frame.map((value, index) =>
        value === 0 ? (
          <span key={index} className="rounded-lg bg-background/40" style={{ height: cell }} />
        ) : (
          <button
            key={index}
            type="button"
            data-pointer-index={value}
            disabled={!onTile}
            aria-label={`Tile ${value}`}
            onPointerDown={(event) => {
              if (!onTile) return;
              event.preventDefault();
              const hit = pointerElementIndex(event.currentTarget);
              if (hit !== null) onTile(hit);
            }}
            className="flex items-center justify-center rounded-lg font-display font-bold text-white"
            style={{
              height: cell,
              background: tileFill(value),
              ["--tile-fill" as string]: tileFill(value),
              fontSize: Math.round(cell * 0.42),
              transition: `transform ${TILES_SLIDE_MS}ms ease-out`,
            }}
          >
            {value}
          </button>
        ),
      )}
    </div>
  );
}

const EXAMPLE_FRAME = [1, 2, 3, 0];

/** Fixed intro example — a 2×2 frame with one slide shown. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <div
          className="grid gap-1 rounded-lg border-2 border-border bg-card p-1"
          style={{ gridTemplateColumns: "repeat(2, 26px)" }}
        >
          {[1, 0, 3, 2].map((value, index) =>
            value === 0 ? (
              <span key={index} className="h-[26px] rounded bg-background/40" />
            ) : (
              <span
                key={index}
                className="flex h-[26px] items-center justify-center rounded font-display text-xs font-bold text-white"
                style={{ background: tileFill(value) }}
              >
                {value}
              </span>
            ),
          )}
        </div>
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <div
          className="grid gap-1 rounded-lg border-2 border-border bg-card p-1"
          style={{ gridTemplateColumns: "repeat(2, 26px)" }}
        >
          {EXAMPLE_FRAME.map((value, index) =>
            value === 0 ? (
              <span key={index} className="h-[26px] rounded bg-background/40" />
            ) : (
              <span
                key={index}
                className="flex h-[26px] items-center justify-center rounded font-display text-xs font-bold text-white"
                style={{ background: tileFill(value) }}
              >
                {value}
              </span>
            ),
          )}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tapping the 2 slid it into the gap, finishing the order.
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
  stateKey = "tiles",
}: PuzzleStageProps) {
  const data: TilesPuzzleData | null = puzzle.type === "tiles" ? puzzle : null;
  const [moves, setMoves] = useStageState<number[]>(stateKey, "tileMoves", () => []);
  const submitted = useRef(false);
  const replay = useMemo(() => (data ? replayTiles(data.frame, moves) : null), [data, moves]);

  useEffect(() => {
    onDraftAnswer?.(encodeTileMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + TILES_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeTileMoves(moves));
  }, [now, phaseStartedAt, locked, data, moves, onSubmit]);

  if (!data || !replay) return null;

  const slide = (tile: number) => {
    if (locked || submitted.current || replay.solved) return;
    const next = [...moves, tile];
    const after = replayTiles(data.frame, next);
    if (after.moves === replay.moves) return puzzleReject();
    hapticTick();
    setMoves(next);
    if (after.solved) {
      submitted.current = true;
      playLock();
      onSubmit(encodeTileMoves(next));
      return;
    }
  };

  const log = (marker: number) => {
    if (locked || submitted.current || replay.solved || replay.moves === 0) return;
    hapticTick();
    setMoves([...moves, marker]);
  };

  return (
    <div data-stage-column="3" data-polish="tiles" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <Frame frame={replay.frame} cell={86} onTile={slide} />
      <p data-after-arena data-game-controls="status" className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span>
      </p>
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2">
        <button
          type="button"
          onPointerDown={() => log(TILES_UNDO)}
          className="h-11 w-24 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground"
        >
          Undo
        </button>
        <button
          type="button"
          onPointerDown={() => log(TILES_RESET)}
          className="h-11 w-24 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tiles") return null;
  const replay = replayTiles(puzzle.frame, decodeTileMoves(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  const min = puzzle.minMoves ?? 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <Frame frame={solvedFrame()} cell={56} />
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.solved
          ? solvedMovesText(replay.moves, min, myMsRemaining, timeLimitMs)
          : `${replay.inPlace} / ${TILES_COUNT} in place`}
      </p>
    </div>
  );
}

/** The frame is public; the minimum and one shortest route stay private. */
export const slidingTilesPuzzle: PuzzleDefinition = {
  key: "tiles",
  name: gameDisplayName("tiles"),
  category: "pattern",
  timeLimitMs: TILES_TIME_MS,
  revealMs: 5_000,
  generate: () => ({ type: "tiles", frame: solvedFrame() }) satisfies TilesPuzzleData,
  check: () => false,
  revealHeading: "In order",
  IntroExample,
  Stage,
  Reveal,
};
