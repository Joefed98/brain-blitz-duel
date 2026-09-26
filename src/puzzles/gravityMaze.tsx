import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { ArrowPad, gridCellCentre, hapticTick, useGridMetrics } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import {
  decodeGravityTilts,
  encodeGravityTilts,
  replayGravity,
  type GravityBalls,
} from "@/lib/duel/gravity";
import { useStageState } from "@/lib/duel/stageState";
import { GRAV_COLS, GRAV_TIME_MS, type GravityDir, type GravityPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const TEAL = "#2FD4C4";
const GOLD = GLYPH_COLOURS.GOLD;
const ARROWS: Record<GravityDir, string> = { U: "▲", D: "▼", L: "◀", R: "▶" };


/** The board itself: dark blocks, two target rings, and the two balls. */
function Board({
  data,
  balls,
  lean,
  size,
}: {
  data: GravityPuzzleData;
  balls: GravityBalls;
  /** The direction the board leans for 200 ms after a tilt. */
  lean?: GravityDir | null;
  size?: number;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const metrics = useGridMetrics(gridRef, GRAV_COLS, GRAV_COLS);
  const walls = useMemo(() => new Set(data.walls), [data.walls]);
  const ballSize = metrics ? Math.max(6, Math.min(metrics.cellW, metrics.cellH) * 0.74) : 0;

  const tiltStyle =
    lean === "U"
      ? "rotateX(6deg)"
      : lean === "D"
        ? "rotateX(-6deg)"
        : lean === "L"
          ? "rotateY(6deg)"
          : lean === "R"
            ? "rotateY(-6deg)"
            : "none";

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size ?? "100%",
        height: size ?? "auto",
        aspectRatio: "1 / 1",
        transform: tiltStyle,
        transition: "transform 200ms ease",
      }}
    >
      <div
        ref={gridRef}
        className="puzzle-board grid h-full w-full gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${GRAV_COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: GRAV_COLS * GRAV_COLS }, (_, cell) => {
          const isWall = walls.has(cell);
          const isTargetA = cell === data.targetA;
          const isTargetB = cell === data.targetB;
          return (
            <div
              key={cell}
              className={`rounded-[3px] ${isWall ? "bg-foreground/80" : "bg-card"}`}
              style={
                isTargetA || isTargetB
                  ? {
                      boxShadow: `inset 0 0 0 2px ${isTargetA ? GOLD : TEAL}`,
                      borderRadius: "999px",
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {metrics
        ? (
            [
              { cell: balls.a, colour: GOLD },
              { cell: balls.b, colour: TEAL },
            ] as const
          ).map((ball, index) => {
            const centre = gridCellCentre(metrics, ball.cell, GRAV_COLS);
            return (
              <span
                key={index}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: ballSize,
                  height: ballSize,
                  left: centre.x - ballSize / 2,
                  top: centre.y - ballSize / 2,
                  backgroundColor: ball.colour,
                  boxShadow: `0 0 10px ${ball.colour}80`,
                  transition: "left 240ms ease, top 240ms ease",
                }}
              />
            );
          })
        : null}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const example: GravityPuzzleData = {
    type: "gravity",
    walls: [18, 21, 42, 45],
    startA: 0,
    startB: 7,
    targetA: 56,
    targetB: 63,
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <Board data={example} balls={{ a: 8, b: 15 }} size={132} />
      <p className="text-center text-xs text-muted-foreground">
        One tilt down — both balls fall together towards their own rings.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "gravity",
}: PuzzleStageProps) {
  const data = puzzle.type === "gravity" ? puzzle : null;
  const [tilts, setTilts] = useStageState<GravityDir[]>(stateKey, "gravityTilts", () => []);
  const [lean, setLean] = useStageState<GravityDir | null>(stateKey, "gravityLean", () => null);
  const submitted = useRef(false);
  const boardSpaceRef = useRef<HTMLDivElement | null>(null);
  const boardSpace = useGridMetrics(boardSpaceRef, 1, 1);

  const replay = useMemo(
    () =>
      data
        ? replayGravity(
            data.walls,
            { a: data.startA, b: data.startB },
            data.targetA,
            data.targetB,
            tilts,
          )
        : null,
    [data, tilts],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeGravityTilts(tilts));
  }, [tilts, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay?.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeGravityTilts(tilts));
  }, [replay?.solved, tilts, locked, onSubmit]);

  if (!data || !replay) return null;

  const press = (dir: GravityDir) => {
    if (locked || submitted.current || replay.solved) return;
    hapticTick();
    buzz(10);
    setLean(dir);
    setTimeout(() => setLean(null), 200);
    setTilts((current) => [...current, dir]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        tilts <span className="text-primary">{replay.tilts}</span>
      </p>

      <div ref={boardSpaceRef} className="flex min-h-0 flex-1 items-center justify-center">
        {boardSpace ? (
          <Board
            data={data}
            balls={replay.balls}
            lean={lean}
            size={Math.max(0, Math.floor(Math.min(boardSpace.width, boardSpace.height)))}
          />
        ) : null}
      </div>

       <div className="flex shrink-0 flex-col items-center gap-1">
         <ArrowPad onPress={press} disabled={locked || replay.solved} />
         <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={locked || !tilts.length}
            onClick={() => setTilts((current) => [...current, "X"])}
            className="h-10 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !tilts.length}
            onClick={() => setTilts((current) => [...current, "Y"])}
            className="h-10 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "gravity") return null;
  const mine = replayGravity(
    puzzle.walls,
    { a: puzzle.startA, b: puzzle.startB },
    puzzle.targetA,
    puzzle.targetB,
    decodeGravityTilts(myAnswer ?? ""),
  );
  const best = decodeGravityTilts(puzzle.solution ?? "");
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((GRAV_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Board data={puzzle} balls={mine.balls} size={150} />
      {best.length ? (
        <p className="font-display text-lg font-bold tracking-widest text-primary">
          {best.map((dir) => ARROWS[dir]).join(" ")}
        </p>
      ) : null}
      <p className="font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.tilts} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
          tilts{puzzle.minMoves ? ` · min ${puzzle.minMoves}` : ""}
        </span>
      </p>
      {myCorrect ? (
        <p className="font-mono text-base text-primary">
          {solvedMovesText(mine.tilts, puzzle.minMoves ?? 0, myMsRemaining, GRAV_TIME_MS)}
        </p>
      ) : null}
    </div>
  );
}

/** Walls, starts, targets, the searched minimum and one shortest route come from the server. */
export const gravityMazePuzzle: PuzzleDefinition = {
  key: "gravity",
  name: "Gravity Maze",
  category: "pattern",
  timeLimitMs: GRAV_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "gravity",
      walls: [],
      startA: 0,
      startB: 7,
      targetA: 56,
      targetB: 63,
    }) satisfies GravityPuzzleData,
  check: () => false,
  revealHeading: "The shortest route",
  IntroExample,
  Stage,
  Reveal,
};
