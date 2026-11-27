import { shownPar, usesParMoves } from "@/lib/duel/parMoves";
import { HudPills } from "@/components/puzzles/HudPills";
import "@/polish-layout/polish-nov3-speedatt.css";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { memo, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

import { registerFxPreview } from "@/components/puzzles/speedFx";

import { ArrowPad, gridCellAt } from "@/components/puzzles/GridDrag";
import { attentionArt } from "@/components/puzzles/attention/attentionArt";
import { RevealLegend, RevealStats } from "@/components/puzzles/attention/RevealParts";
import { attnSound } from "@/components/puzzles/attention/attentionFx";
import { gameFx } from "@/lib/fx/kit";

import {
  MAZE_E,
  MAZE_N,
  MAZE_S,
  MAZE_W,
  decodeMazePath,
  encodeMazePath,
  mazeOpen,
  verifyMazePath,
} from "@/lib/duel/maze";
import { useStageState } from "@/lib/duel/stageState";
import {
  LAB_STARS,
  LAB_TRAIL_MAX,
  decodeMazeTrail,
  encodeMazeTrail,
  mazeStarsTaken,
  mazeTrailBacktracks,
  mazeTrailRoute,
  mazeTrailWalk,
  usesMazeDepth,
} from "@/lib/duel/depth/labyrinth";
import { mazeColsOf, mazeStraightFill } from "@/lib/duel/maze";
import { mazeExitShown } from "@/lib/duel/attentionLevels";
import { mazeKeysOf, mazeKeysTaken, mazeKeysWalk } from "@/lib/duel/mazeKeys";
import { MazeKeysLayer } from "./attentionLevelArt";
import { MAZE_CELLS, MAZE_COLS, MAZE_TIME_MS, type MazePuzzleData } from "@/lib/duel/types";
import { playCorrect, playSound } from "@/lib/sound";
import { mazeStandard } from "@/lib/duel/standard/attention";

import { playMazeTrace } from "./labyrinthArt";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

/** Five-point star polygon centred at (cx, cy), in SVG grid units. */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
}

type Wall = { x1: number; y1: number; x2: number; y2: number };

/**
 * The maze itself, memoised so a route step never redraws it: a flagstone floor
 * (pattern, deterministic), then every wall three times for depth — a drop shadow,
 * the stone body and a thin lit top edge. Walls sit on the same grid lines as before.
 */
const MazeWalls = memo(function MazeWalls({ cells, cols, rows, k = 1 }: { cells: number[]; cols: number; rows: number; k?: number }) {
  const id = useId().replace(/:/g, "");
  const walls: Wall[] = [];
  cells.forEach((mask, cell) => {
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    if (!(mask & MAZE_N)) walls.push({ x1: col, y1: row * k, x2: col + 1, y2: row * k });
    if (!(mask & MAZE_W)) walls.push({ x1: col, y1: row * k, x2: col, y2: (row + 1) * k });
    if (!(mask & MAZE_S) && row === rows - 1)
      walls.push({ x1: col, y1: (row + 1) * k, x2: col + 1, y2: (row + 1) * k });
    if (!(mask & MAZE_E) && col === cols - 1)
      walls.push({ x1: col + 1, y1: row * k, x2: col + 1, y2: (row + 1) * k });
  });
  const d = walls.map((w) => `M${w.x1} ${w.y1}L${w.x2} ${w.y2}`).join("");
  return (
    <g>
      <defs>
        <pattern id={`maze-floor-${id}`} width="2" height={2 * k} patternUnits="userSpaceOnUse">
          <rect width="2" height={2 * k} fill="var(--maze-floor)" />
          <rect width="1" height={k} fill="var(--maze-floor-alt)" />
          <rect x="1" y={k} width="1" height={k} fill="var(--maze-floor-alt)" />
          <circle cx="0.3" cy={0.7 * k} r="0.05" fill="var(--maze-floor-speck)" />
          <circle cx="1.65" cy={0.35 * k} r="0.06" fill="var(--maze-floor-speck)" />
          <circle cx="1.2" cy={1.6 * k} r="0.04" fill="var(--maze-floor-speck)" />
        </pattern>
      </defs>
      <rect width={cols} height={rows * k} fill={`url(#maze-floor-${id})`} />
      {/* The Attention overhaul (15 Nov 2026): a Blender-rendered dark flagstone floor over the drawn one. */}
      <image href={attentionArt("maze", "floor")} x={0} y={0} width={cols} height={rows * k} preserveAspectRatio="xMidYMid slice" data-maze-floor="" />
      {/* Polish batch S: a wide, faint ambient shadow under every wall for depth (display only). */}
      <path d={d} transform="translate(0.09 0.13)" stroke="rgba(0,0,0,0.28)" strokeWidth={0.3} strokeLinecap="round" fill="none" />
      <path d={d} transform="translate(0.05 0.07)" stroke="var(--maze-wall-shadow)" strokeWidth={0.2} strokeLinecap="square" fill="none" />
      {/* The Attention overhaul (15 Nov 2026, concept A): raised satin-metal walls: a darker metal body, a sheen down
          its middle and a crisp lit edge on the top-left side (light, never a glow). */}
      <path d={d} stroke="var(--maze-wall)" strokeWidth={0.17} strokeLinecap="square" fill="none" />
      <path d={d} stroke="var(--maze-wall-sheen, var(--maze-wall))" strokeWidth={0.07} strokeLinecap="square" fill="none" />
      <path d={d} transform="translate(-0.03 -0.035)" stroke="var(--maze-wall-top)" strokeWidth={0.035} strokeLinecap="square" fill="none" />
    </g>
  );
});

/** Stone walls on a flagstone floor, with the drawn route over the top. */
export function MazeBoard({
  cells,
  cols = MAZE_COLS,
  start,
  exit,
  path,
  ghost,
  onCell,
  onRelease,
  k = 1,
  stars,
  taken,
  exitShown = true,
  overlay,
}: {
  /** Expert (stage 3 of the Attention overhaul): false until the trail's head is near the exit (display only). */
  exitShown?: boolean;
  /** D3 (levelRev 2's Hard and Expert): the keys layer, drawn in the board's SVG under the ball (attentionLevelArt.tsx). */
  overlay?: ReactNode;
  /** mazeRev 1: the detour stars' cells, and those the ball has taken (drawn as a faint outline). */
  stars?: readonly number[] | undefined;
  taken?: readonly number[] | undefined;
  /**
   * Polish batch S (display only): each cell's height over its width. A live round's frame passes more
   * than 1 where the arena has spare height, so the maze grows taller; touches map through the board's
   * own box (gridCellAt), so the same cells answer the same touches. Circles stay round.
   */
  k?: number;
  cells: number[];
  cols?: number;
  start: number;
  exit: number;
  path: number[];
  /** A second, grey route drawn underneath — the solution, on the reveal. */
  ghost?: number[] | undefined;
  onCell?: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
}) {
  const rows = Math.ceil(cells.length / cols) || cols;
  const box = useRef<HTMLDivElement | null>(null);
  const gid = useId().replace(/:/g, "");

  // Measured from the live board on every event, so the finger tracks the corridor.
  const cellAt = (clientX: number, clientY: number): number | null =>
    gridCellAt(box.current, clientX, clientY, cols, rows);

  const cx = (cell: number) => (cell % cols) + 0.5;
  const cy = (cell: number) => (Math.floor(cell / cols) + 0.5) * k;
  const centre = (cell: number) => `${cx(cell)},${cy(cell)}`;

  return (
    <div
      ref={box}
      className="maze-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full touch-none select-none rounded-lg bg-card p-1"
      data-maze-board=""
      style={k === 1 && rows === cols ? { touchAction: "none" } : { touchAction: "none", aspectRatio: `${cols} / ${rows * k}` }}
      onPointerDown={(event) => {
        if (!onCell) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety; the drag still works without it.
        }
        const cell = cellAt(event.clientX, event.clientY);
        if (cell !== null) onCell(cell);
      }}
      onPointerMove={(event) => {
        if (!onCell || event.buttons === 0) return;
        const cell = cellAt(event.clientX, event.clientY);
        if (cell !== null) onCell(cell);
      }}
      onPointerUp={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
    >
      <svg viewBox={`0 0 ${cols} ${rows * k}`} className="h-full w-full" aria-hidden="true">
        {/* Polish batch S (display only): the glossy ball, the exit's glow and the star's light. */}
        <defs>
          <radialGradient id={`maze-ball-${gid}`} cx="0.36" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#FFF6D8" />
            <stop offset="0.35" stopColor="var(--primary)" />
            <stop offset="1" stopColor="#9A6508" />
          </radialGradient>
          <radialGradient id={`maze-halo-${gid}`}>
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`maze-star-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF1C2" />
            <stop offset="0.55" stopColor="var(--primary)" />
            <stop offset="1" stopColor="#C98A12" />
          </linearGradient>
        </defs>
        <MazeWalls cells={cells} cols={cols} rows={rows} k={k} />
        {/* Start pad and exit tile: clear ends, drawn on the floor under the route. */}
        <rect x={(start % cols) + 0.08} y={Math.floor(start / cols) * k + 0.08} width={0.84} height={k - 0.16} rx={0.16} fill="var(--maze-start-floor)" stroke="var(--maze-start)" strokeWidth={0.05} />
        {exitShown && <rect className="maze-exit-glow" x={(exit % cols) + 0.08} y={Math.floor(exit / cols) * k + 0.08} width={0.84} height={k - 0.16} rx={0.16} fill="var(--maze-exit-floor)" stroke={GOLD} strokeWidth={0.05} />}
        {ghost && ghost.length > 1 && (
          <polyline
            points={ghost.map(centre).join(" ")}
            fill="none"
            stroke="var(--maze-start)"
            strokeWidth={0.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.35 0.25"
            opacity={0.75}
          />
        )}
        {path.length > 1 && (
          // The trail as a polished gold thread: a darker gold edge, the gold, and a bright core along its crown.
          <g data-maze-trail="">
            <polyline points={path.map(centre).join(" ")} fill="none" stroke="var(--maze-trail-edge, #7A5410)" strokeWidth={0.34} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={path.map(centre).join(" ")} fill="none" stroke={GOLD} strokeWidth={0.26} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={path.map(centre).join(" ")} fill="none" stroke="var(--maze-trail-core, #FFF0C2)" strokeWidth={0.07} strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.025 -0.035)" opacity={0.85} />
          </g>
        )}
        <circle
          cx={cx(start)}
          cy={cy(start)}
          r={0.18}
          fill="var(--maze-start)"
        />
        {/* mazeRev 1 detour stars: the exit star's gold look, smaller, with a slow shimmer; a taken star pops and
            leaves a faint gold outline (display only; the server counts the stars from the trail). */}
        {stars?.map((cell) => {
          const got = taken?.includes(cell) ?? false;
          return (
            <g key={`star-${cell}`} data-maze-star={got ? "taken" : "waiting"}>
              {got ? (
                <>
                  <polygon className="maze-star-pop" points={starPoints(cx(cell), cy(cell), 0.3, 0.13)} fill={`url(#maze-star-${gid})`} />
                  <polygon points={starPoints(cx(cell), cy(cell), 0.3, 0.13)} fill="none" stroke="var(--primary)" strokeWidth={0.04} strokeLinejoin="round" opacity={0.5} />
                </>
              ) : (
                <>
                  <circle className="maze-star-glow" cx={cx(cell)} cy={cy(cell)} r={0.5} fill={`url(#maze-halo-${gid})`} />
                  <polygon
                    points={starPoints(cx(cell), cy(cell), 0.34, 0.15)}
                    fill={`url(#maze-star-${gid})`}
                    stroke="#7A4E06"
                    strokeWidth={0.025}
                    strokeLinejoin="round"
                    style={{ filter: "drop-shadow(0 0 0.1px var(--primary))" }}
                  />
                </>
              )}
            </g>
          );
        })}
        {/* Goal: a gold star flag marking the exit cell, lit by a soft halo inside its cell. */}
        {exitShown && <g data-maze-exit="">
        <circle
          className="maze-exit-glow"
          cx={cx(exit)}
          cy={cy(exit)}
          r={0.5}
          fill={`url(#maze-halo-${gid})`}
        />
        <polygon
          points={starPoints(cx(exit), cy(exit), 0.32, 0.14)}
          fill={`url(#maze-star-${gid})`}
          stroke="#7A4E06"
          strokeWidth={0.025}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 0.12px var(--primary))" }}
        />
        </g>}
        {overlay}
        {/* Player: current route head, a larger glowing gold dot. */}
        {(() => {
          const head = path.length ? path[path.length - 1]! : start;
          return (
            <g data-maze-ball="">
              <circle cx={cx(head)} cy={cy(head)} r={0.42} fill={`url(#maze-halo-${gid})`} />
              <ellipse cx={cx(head) + 0.03} cy={cy(head) + 0.2} rx={0.2} ry={0.07} fill="rgba(0,0,0,0.45)" />
              <circle
                cx={cx(head)}
                cy={cy(head)}
                r={0.24}
                fill={`url(#maze-ball-${gid})`}
                stroke="rgba(90,55,0,0.6)"
                strokeWidth={0.02}
                style={{ filter: "drop-shadow(0 0 0.14px var(--primary)) drop-shadow(0 0 0.28px var(--primary))" }}
              />
              <ellipse cx={cx(head) - 0.07} cy={cy(head) - 0.09} rx={0.08} ry={0.05} fill="rgba(255,255,255,0.85)" />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const cells = [
    MAZE_E | MAZE_S,
    MAZE_W | MAZE_E,
    MAZE_W | MAZE_S,
    MAZE_N | MAZE_E,
    MAZE_W | MAZE_S,
    MAZE_N | MAZE_S,
    MAZE_E,
    MAZE_W | MAZE_N,
    MAZE_N,
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Draw your way from the start to the exit as fast as you can.
      </p>
      <div style={{ width: 120 }}>
        <MazeBoard cells={cells} cols={3} start={0} exit={8} path={[0, 3, 4]} />
      </div>
      <p className="text-xs text-muted-foreground">
        Every step counts, back steps too. Finish close to par for a bonus.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "maze" }: PuzzleStageProps) {
  const isMaze = puzzle.type === "maze";
  const cells = isMaze ? puzzle.cells : [];
  const start = isMaze ? puzzle.start : 0;
  const exit = isMaze ? puzzle.exit : MAZE_CELLS - 1;
  // mazeRev 1 (depth/labyrinth.ts): a 19 × 23 board, detour stars and the whole trail as the answer; the drawn route
  // is the trail with its backtracks folded away. Older mazes keep the 19 × 19 board and the path answer.
  const depth = usesMazeDepth(puzzle);
  const cols = isMaze ? mazeColsOf(puzzle) : MAZE_COLS;
  const rows = Math.ceil(cells.length / cols) || cols;
  // mazeRev 4 (the puzzle batch of 3 Nov 2026, parMoves.ts): no stars, so no star counter.
  const stars = depth && !usesParMoves(puzzle) ? (puzzle.stars ?? []) : undefined;
  const [classicPath, setPath] = useStageState<number[]>(stateKey, "mazePath", () => [start]);
  const [trail, setTrail] = useStageState<number[]>(stateKey, "mazeTrail", () => [start]);
  // D3 (levelRev 2's Hard and Expert, mazeKeys.ts): with keys the trail walks on through the exit until every key is taken.
  const keys = useMemo(() => (isMaze ? mazeKeysOf(puzzle) : []), [isMaze, puzzle]);
  const walkOf = (t: number[]) => (keys.length ? mazeKeysWalk(cells, start, exit, t, cols, keys) : mazeTrailWalk(cells, start, exit, t, cols));
  const path = useMemo(() => (depth ? mazeTrailRoute(walkOf(trail)) : classicPath), [depth, classicPath, trail, cells, start, exit, cols, keys]); // eslint-disable-line react-hooks/exhaustive-deps
  const keysTaken = useMemo(() => (keys.length ? mazeKeysTaken(walkOf(trail), keys).map((i) => keys[i]!) : []), [keys, trail]); // eslint-disable-line react-hooks/exhaustive-deps
  const takenIdx = useMemo(() => (stars ? mazeStarsTaken(trail, stars) : []), [stars, trail]);
  const taken = useMemo(() => takenIdx.map((i) => stars![i]!), [takenIdx, stars]);
  const submitted = useRef(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  // Polish batch S: on a live round the arena takes the spare height (batch-s.css) and the maze grows
  // into it with taller cells, measured before the first paint so nothing moves (display only).
  const framed = useContext(GoalLineContext) !== null;
  const [k, setK] = useState(1);
  useBeforePaint(() => {
    const arena = arenaRef.current;
    if (!framed || !arena) return;
    const read = () => {
      const w = arena.clientWidth;
      const h = arena.clientHeight;
      if (w < 1 || h < 1) return;
      setK(Math.round(Math.min(1.32, Math.max(1, h / w)) * 1000) / 1000);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(arena);
    return () => observer.disconnect();
  }, [framed]);
  const trace = useRef<(route: number[]) => void>(() => undefined);
  trace.current = (route) => {
    const board = arenaRef.current?.querySelector("[data-maze-board]");
    if (board) playMazeTrace(board, route, cols, rows);
  };
  useEffect(() => registerFxPreview("maze", () => trace.current(path.length > 1 ? path : (puzzle.type === "maze" ? puzzle.solution ?? [] : []))), [path, puzzle]);

  const solved = path[path.length - 1] === exit && keysTaken.length === keys.length;
  const wasted = useMemo(() => {
    if (depth) return mazeTrailBacktracks(trail);
    const seen = new Set<number>();
    let repeats = 0;
    for (const cell of path) {
      if (seen.has(cell)) repeats += 1;
      seen.add(cell);
    }
    return repeats;
  }, [path, depth, trail]);

  // Puzzle polish (3 Nov 2026): on a stamp that stores its par (shownPar), "Moves n" counts every step of the trail
  // walked, steps back included: the server's `walked` (standard/attention.server.ts mazeRun), from the same walk.
  const par = shownPar(puzzle);
  const walked = useMemo(
    () => (par !== null && depth ? Math.max(0, walkOf(trail).length - 1) : 0),
    [par, depth, cells, start, exit, trail, cols, keys], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The Attention overhaul (stage 2): each step a soft tick, a little higher for every junction passed; a step back a
  // lighter tick as the trail retracts; the tip of a dead end a short falling note (a cue to turn back).
  const stepsSeen = useRef(path.length);
  useEffect(() => {
    const before = stepsSeen.current;
    stepsSeen.current = path.length;
    if (path.length === before || before === 0) return;
    if (path.length < before) {
      attnSound("maze.back", { volume: 0.4 });
      return;
    }
    const open = (cell: number) => [MAZE_N, MAZE_E, MAZE_S, MAZE_W].filter((side) => ((cells[cell] ?? 0) & side) !== 0).length;
    const junctions = path.filter((cell) => open(cell) >= 3).length;
    attnSound("maze.step", { volume: 0.4, rate: 1 + Math.min(junctions, 12) * 0.025 });
    const head = path[path.length - 1]!;
    if (head !== exit && head !== start && open(head) === 1) attnSound("maze.deadEnd", { volume: 0.55 });
  }, [path.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const answerNow = depth ? encodeMazeTrail(trail, cols) : encodeMazePath(path);
  useEffect(() => {
    onDraftAnswer?.(answerNow);
  }, [answerNow, onDraftAnswer]);

  // A star taken: its pop (CSS) and the chime pitched up (mute and the Effects slider apply). A reload that restores
  // stars already taken plays nothing.
  const starsSeen = useRef(taken.length);
  useEffect(() => {
    if (taken.length > starsSeen.current) playSound("correct", 0.7, 1.45);
    starsSeen.current = taken.length;
  }, [taken.length]);

  useEffect(() => {
    if (locked || submitted.current || !solved) return;
    submitted.current = true;
    playCorrect();
    // Finish effect: a glowing line traces the route (display only, never awaited).
    trace.current(path);
    onSubmit(answerNow);
  }, [solved, path, locked, onSubmit, answerNow]);

  /**
   * The Attention overhaul (stage 2): a wall stops the route with a dull bump and the trail's end flashes; the board
   * never shakes. Throttled so a held arrow against a wall stays quiet.
   */
  const lastBump = useRef(0);
  const bump = () => {
    const now = performance.now();
    if (now - lastBump.current < 300) return;
    lastBump.current = now;
    attnSound("maze.bump", { volume: 0.55 });
    gameFx("wrong", arenaRef.current?.querySelector("[data-maze-ball] circle:nth-of-type(2)"), { silent: true });
  };

  /**
   * One cell touched by the finger: the route grows only into a cell next to its
   * end with no wall between, and retraces when the finger goes back. Anything
   * else is ignored — the route is never reset by a stray touch.
   */
  const touch = (cell: number) => {
    if (locked || submitted.current || solved) return;
    // A fast drag that jumped squares along a straight line fills them in, one step each (attention review fixes,
    // 15 Nov 2026), stopping at the first wall; anything else is the single (refused) step it always was.
    const lastOf = (route: number[]) => route[route.length - 1] ?? start;
    if (depth) {
      // Every step is kept, backtracks included (the server counts the stars from the trail).
      setTrail((current) => {
        const steps = mazeStraightFill(lastOf(mazeTrailRoute(current)), cell, cols) ?? [cell];
        let next = current;
        for (const target of steps) {
          const last = lastOf(mazeTrailRoute(next));
          if (target === last || next.length > LAB_TRAIL_MAX) break;
          if (!mazeOpen(cells, last, target, cols)) {
            bump();
            break;
          }
          next = [...next, target];
        }
        return next;
      });
      return;
    }
    setPath((current) => {
      const steps = mazeStraightFill(lastOf(current), cell, cols) ?? [cell];
      let next = current;
      for (const target of steps) {
        const last = lastOf(next);
        if (target === last) break;
        // Retracing one step backwards undoes a wrong turn.
        if (next.length > 1 && target === next[next.length - 2]) { next = next.slice(0, -1); continue; }
        if (!mazeOpen(cells, last, target)) { bump(); break; }
        next = [...next, target];
      }
      return next;
    });
  };

  /** The arrows drive the very same route as the finger does. */
  const step = (dir: "U" | "D" | "L" | "R") => {
    const last = path[path.length - 1] ?? start;
    const col = last % cols;
    const row = Math.floor(last / cols);
    if (dir === "U" && row === 0) return bump();
    if (dir === "D" && row >= Math.floor((cells.length - 1) / cols)) return bump();
    if (dir === "L" && col === 0) return bump();
    if (dir === "R" && col === cols - 1) return bump();
    const next =
      dir === "U"
        ? last - cols
        : dir === "D"
          ? last + cols
          : dir === "L"
            ? last - 1
            : last + 1;
    touch(next);
  };

  if (!isMaze) return null;

  return (
    <div data-stage-column="1" data-polish="maze" className="flex min-h-0 flex-1 flex-col gap-1">
      <HudPills
        testId="maze"
        items={
          par !== null
            ? [
                { id: "moves", label: "Steps", value: walked, ...(walked > par ? { tone: "warn" as const } : {}) },
                { id: "par", label: "Par", value: par, tone: "gold" },
              ]
            : [
                { id: "squares", label: "Squares", value: path.length, tone: "gold" },
                { id: "wasted", label: "Wasted", value: wasted },
                stars ? { id: "stars", label: "Stars", value: <span data-maze-stars="">{taken.length}/{LAB_STARS}</span>, tone: "gold" } : null,
              ]
        }
      />

      <div ref={arenaRef} data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        {/* mazeRev 1: the same board box as before (taller-than-square by k), split into 23 rows. */}
        <MazeBoard cells={cells} cols={cols} start={start} exit={exit} path={path} onCell={touch} k={(k * cols) / rows} stars={stars} taken={taken} exitShown={!isMaze || solved || mazeExitShown(puzzle, path[path.length - 1] ?? start, cols)} overlay={keys.length ? <MazeKeysLayer keys={keys} taken={keysTaken} exit={exit} cols={cols} k={(k * cols) / rows} /> : undefined} />
      </div>

       <div data-game-controls="pad" data-maze-pad="" className="flex shrink-0 flex-col items-center justify-center">
        <ArrowPad
          onPress={step}
          disabled={locked || solved}
          repeatMs={240}
          expanded
          menuSwitch
        />
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "maze") return null;
  const depth = usesMazeDepth(puzzle);
  const cols = mazeColsOf(puzzle);
  const rows = Math.ceil(puzzle.cells.length / cols) || cols;
  // D3: a keyed maze's walk goes on through the exit until every key is taken (mazeKeys.ts).
  const revealKeys = mazeKeysOf(puzzle);
  const revealTrail = decodeMazeTrail(myAnswer ?? "", puzzle.start, cols, puzzle.cells.length);
  const walk = depth ? (revealKeys.length ? mazeKeysWalk(puzzle.cells, puzzle.start, puzzle.exit, revealTrail, cols, revealKeys) : mazeTrailWalk(puzzle.cells, puzzle.start, puzzle.exit, revealTrail, cols)) : null;
  const mine = walk ? mazeTrailRoute(walk) : decodeMazePath(myAnswer ?? "");
  const verdict = verifyMazePath(
    puzzle.cells,
    puzzle.start,
    puzzle.exit,
    puzzle.solution ?? [],
    mine,
    cols,
  );
  const parMoves = usesParMoves(puzzle);
  const stars = depth && !parMoves ? (puzzle.stars ?? []) : undefined;
  const taken = walk && stars ? mazeStarsTaken(walk, stars).map((i) => stars[i]!) : undefined;
  // The stored star points (a finish only), never recomputed here.
  const starBonus = Number(myExtra?.["starBonus"] ?? 0);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  const walked = walk ? Math.max(0, walk.length - 1) : Math.max(0, mine.length - 1);
  const shortest = Math.max(0, (puzzle.solution ?? []).length - 1);
  // The Attention overhaul's reveal (15 Nov 2026): the maze large, your trail in gold over the shortest route (dashed),
  // and the numbers that explain the score as tiles: how far you got, the steps you walked (backtracks count) and par.
  return (
    <div className="attn-rv" data-attn-reveal="maze">
      <div className="maze-reveal-board">
        <MazeBoard
          cells={puzzle.cells}
          start={puzzle.start}
          exit={puzzle.exit}
          path={mine.length > 1 ? mine : []}
          ghost={puzzle.solution ?? []}
          cols={cols}
          k={cols / rows}
          stars={stars}
          taken={taken}
        />
      </div>
      <RevealLegend
        items={[
          { mark: "trail", label: "Your trail" },
          { mark: "route", label: "Shortest route" },
        ]}
      />
      <RevealStats
        game="maze"
        items={[
          { id: "far", label: myCorrect ? "Reached" : "How far", value: myCorrect ? "Exit" : `${Math.round(verdict.progress * 100)} %`, tone: myCorrect ? "good" : undefined },
          // mazeRev 4: the steps taken against par (the stored figures on a finish).
          { id: "steps", label: "Steps walked", value: parMoves && myCorrect && typeof myExtra?.["steps"] === "number" ? (myExtra["steps"] as number) : walked },
          { id: "par", label: parMoves ? "Par" : "Shortest", value: parMoves && myCorrect && typeof myExtra?.["parSteps"] === "number" ? (myExtra["parSteps"] as number) : shortest },
          // The scoring standard (mazeRev 3): stars count finished or not.
          taken ? { id: "stars", label: "Stars", value: `${taken.length} of ${LAB_STARS}${(myCorrect || mazeStandard(puzzle)) && starBonus > 0 ? ` +${starBonus}` : ""}` } : null,
        ]}
      />
      {myCorrect && elapsed !== null ? <p className="text-center text-sm font-semibold text-muted-foreground">Finished in {elapsed.toFixed(1)} s</p> : null}
    </div>
  );
}

/** The maze and its one route are built server-side and stay there. */
export const mazeDashPuzzle: PuzzleDefinition = {
  key: "maze",
  name: gameDisplayName("maze"),
  category: "attention",
  timeLimitMs: MAZE_TIME_MS,
  revealMs: 5_000,
  generate: () =>
    ({
      type: "maze",
      cells: new Array<number>(MAZE_CELLS).fill(0),
      start: 0,
      exit: MAZE_CELLS - 1,
    }) satisfies MazePuzzleData,
  check: () => false,
  revealHeading: "The route",
  IntroExample,
  Stage,
  Reveal,
};
