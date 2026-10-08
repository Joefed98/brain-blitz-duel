import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { ArrowPad, gridCellCentre, hapticTick, useGridMetrics } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import {
  decodeGravityTilts,
  encodeGravityTilts,
  gravityLocked,
  replayGravity,
  type GravityBalls,
} from "@/lib/duel/gravity";
import { useStageState } from "@/lib/duel/stageState";
import { GRAV_COLS, GRAV_TIME_MS, type GravityDir, type GravityPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playLock, playSound } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Ball colours in fixed order: gold, teal, purple, pink. */
const BALL_COLOURS = [GLYPH_COLOURS.GOLD, "#2FD4C4", GLYPH_COLOURS.PURPLE, GLYPH_COLOURS.PINK];
const ARROWS: Record<GravityDir, string> = { U: "▲", D: "▼", L: "◀", R: "▶", X: "↔", Y: "↕" };

/** The board: dark blocks, four target rings (closed when locked) and four balls. */
function Board({
  data,
  balls,
  lean,
  size,
  cols = GRAV_COLS,
}: {
  data: Pick<GravityPuzzleData, "walls" | "targets">;
  balls: GravityBalls;
  lean?: GravityDir | null;
  size?: number;
  cols?: number;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const metrics = useGridMetrics(gridRef, cols, cols);
  const walls = useMemo(() => new Set(data.walls), [data.walls]);
  const locked = gravityLocked(balls, data.targets);
  const ballSize = metrics ? Math.max(6, Math.min(metrics.cellW, metrics.cellH) * 0.66) : 0;
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
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols * cols }, (_, cell) => {
          const target = data.targets.indexOf(cell);
          const isLocked = target >= 0 && locked[target];
          return (
            <div
              key={cell}
              className={`rounded-[3px] ${walls.has(cell) ? "bg-foreground/80" : "bg-card"}`}
              style={
                target >= 0
                  ? {
                      boxShadow: `inset 0 0 0 ${isLocked ? 4 : 2}px ${BALL_COLOURS[target]}`,
                      borderRadius: "999px",
                      borderStyle: isLocked ? undefined : "dashed",
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {metrics
        ? balls.map((cell, index) => {
            const centre = gridCellCentre(metrics, cell, cols);
            const colour = BALL_COLOURS[index]!;
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
                  backgroundColor: colour,
                  boxShadow: locked[index]
                    ? `0 0 0 3px var(--color-background), 0 0 0 5px ${colour}`
                    : `0 0 10px ${colour}80`,
                  transition: "left 240ms ease, top 240ms ease",
                }}
              />
            );
          })
        : null}
    </div>
  );
}

/** Fixed intro example — never randomised. A 5×5 board, one tilt down. */
function IntroExample() {
  const example = { walls: [12], targets: [20, 21, 7, 24] };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <Board data={example} balls={[0, 1, 2, 4]} size={104} cols={5} />
        <span className="font-mono text-xs text-muted-foreground">▼</span>
        <Board data={example} balls={[20, 21, 7, 24]} size={104} cols={5} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        One tilt down: gold, teal and pink lock on their rings; purple stops on the block - and
        it's locked too.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "gravity" }: PuzzleStageProps) {
  const data = puzzle.type === "gravity" ? puzzle : null;
  const [tilts, setTilts] = useStageState<GravityDir[]>(stateKey, "gravityTilts", () => []);
  const [lean, setLean] = useStageState<GravityDir | null>(stateKey, "gravityLean", () => null);
  const submitted = useRef(false);
  const lockSeen = useRef(0);
  const boardSpaceRef = useRef<HTMLDivElement | null>(null);
  const boardSpace = useGridMetrics(boardSpaceRef, 1, 1);

  const replay = useMemo(
    () => (data ? replayGravity(data.walls, data.starts, data.targets, tilts) : null),
    [data, tilts],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeGravityTilts(tilts));
  }, [tilts, onDraftAnswer]);

  useEffect(() => {
    if (!replay) return;
    if (replay.locked > lockSeen.current && !replay.solved) playLock();
    lockSeen.current = replay.locked;
  }, [replay]);

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
    // A new tilt cuts the previous pull, so long pulls never overlap.
    playSound("pz_gravity_pull");
    setLean(dir);
    setTimeout(() => setLean(null), 200);
    setTilts((current) => [...current, dir]);
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        tilts <span className="text-primary">{replay.tilts}</span> · locked{" "}
        <span className="text-primary">{replay.locked} / 4</span>
      </p>

      <div ref={boardSpaceRef} data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        {boardSpace ? (
          <Board
            data={data}
            balls={replay.balls}
            lean={lean}
            size={Math.max(0, Math.floor(Math.min(boardSpace.width, boardSpace.height)))}
          />
        ) : null}
      </div>

      <div data-game-controls="pad" className="flex shrink-0 flex-col items-center gap-3">
        <ArrowPad onPress={press} disabled={locked || replay.solved} />
        <div data-game-controls="actions" className="flex gap-3 px-2">
          <Button
            type="button"
            variant="outline"
            disabled={locked || !tilts.length}
            onClick={() => setTilts((current) => [...current, "X"])}
            className="h-11 min-w-11 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !tilts.length}
            onClick={() => setTilts((current) => [...current, "Y"])}
            className="h-11 min-w-11 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "gravity") return null;
  const mine = replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, decodeGravityTilts(myAnswer ?? ""));
  const best = decodeGravityTilts(puzzle.solution ?? "");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Board data={puzzle} balls={mine.balls} size={150} />
      {best.length ? (
        <p className="text-center font-display text-lg font-bold tracking-widest text-primary">
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
      <p className="font-mono text-base text-muted-foreground">{mine.locked} / 4 balls locked</p>
      {myCorrect ? (
        <p className="font-mono text-base text-primary">
          {solvedMovesText(mine.tilts, puzzle.minMoves ?? 0, myMsRemaining, timeLimitMs)}
        </p>
      ) : null}
    </div>
  );
}

/** Walls, starts, targets, the searched minimum and one shortest route come from the server. */
export const gravityMazePuzzle: PuzzleDefinition = {
  key: "gravity",
  name: gameDisplayName("gravity"),
  category: "pattern",
  timeLimitMs: GRAV_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "gravity", walls: [], starts: [0, 8, 72, 80], targets: [40, 41, 39, 31] }) satisfies GravityPuzzleData,
  check: () => false,
  revealHeading: "The shortest route",
  IntroExample,
  Stage,
  Reveal,
};
