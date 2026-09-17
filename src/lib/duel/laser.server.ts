/**
 * Server-only Laser and Mirrors generation. The beam route is chosen first and
 * mirrors are placed on its bends, so the stored placement is a solution by
 * construction — and the tracer then proves that all four mirrors are needed,
 * that no three of them will do, and that no one or two mirrors placed anywhere
 * at all reach the target, before the layout is ever stored.
 */

import { laserCol, laserRow, laserStep, traceBeam } from "./laser";
import { shuffled } from "./random";
import {
  LASER_CELLS,
  LASER_COLS as N,
  LASER_MAX_BLOCKS,
  LASER_MAX_MIRRORS,
  LASER_MIN_ADJACENT_BLOCKS,
  LASER_MIN_BLOCKS,
  LASER_MIN_SHORTCUT_BLOCKS,
  type BeamDir,
  type LaserPuzzleData,
  type MirrorKind,
  type MirrorPlacement,
} from "./types";

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

/** Turning from one heading to another needs exactly one of the two mirrors. */
function mirrorFor(incoming: BeamDir, outgoing: BeamDir): MirrorKind | null {
  const slash: Record<BeamDir, BeamDir> = { R: "U", U: "R", L: "D", D: "L" };
  const back: Record<BeamDir, BeamDir> = { R: "D", D: "R", L: "U", U: "L" };
  if (slash[incoming] === outgoing) return "/";
  if (back[incoming] === outgoing) return "\\";
  return null;
}

const PERPENDICULAR: Record<BeamDir, BeamDir[]> = {
  U: ["L", "R"],
  D: ["L", "R"],
  L: ["U", "D"],
  R: ["U", "D"],
};

/** Every edge cell with the direction that fires inward from it. */
function sources(): { cell: number; dir: BeamDir }[] {
  const out: { cell: number; dir: BeamDir }[] = [];
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    const row = laserRow(cell);
    const col = laserCol(cell);
    if (row === 0) out.push({ cell, dir: "D" });
    if (row === N - 1) out.push({ cell, dir: "U" });
    if (col === 0) out.push({ cell, dir: "R" });
    if (col === N - 1) out.push({ cell, dir: "L" });
  }
  return out;
}

interface Route {
  cells: number[];
  bends: MirrorPlacement[];
  target: number;
}

/** Walks a random zig-zag of several bends from the source, never re-using a cell. */
function randomRoute(source: number, dir: BeamDir, bends: number): Route | null {
  const visited = new Set<number>([source]);
  const cells = [source];
  let cell = source;
  let heading = dir;
  const placements: MirrorPlacement[] = [];

  for (let bend = 0; bend <= bends; bend++) {
    const runMax = bend === bends ? 4 : 5;
    const run = 1 + randomInt(runMax);
    let moved = 0;
    for (let step = 0; step < run; step++) {
      const next = laserStep(cell, heading);
      if (next === null || visited.has(next)) break;
      cell = next;
      visited.add(cell);
      cells.push(cell);
      moved += 1;
    }
    if (moved === 0) return null;
    if (bend === bends) break;

    const turn = shuffled(PERPENDICULAR[heading])[0]!;
    const kind = mirrorFor(heading, turn);
    if (!kind) return null;
    // The bend sits on the cell the beam has just reached.
    if (cell === source) return null;
    placements.push({ cell, kind });
    heading = turn;
  }

  const target = cells[cells.length - 1]!;
  if (target === source) return null;
  if (placements.some((mirror) => mirror.cell === target)) return null;
  return { cells, bends: placements, target };
}

/**
 * Every proper subset of the mirrors must miss the target — so all four are
 * needed, and in particular no three of them will do.
 */
function everyMirrorNeeded(
  source: number,
  dir: BeamDir,
  mirrors: MirrorPlacement[],
  blocks: number[],
  target: number,
): boolean {
  const total = mirrors.length;
  for (let mask = 0; mask < 1 << total; mask++) {
    const subset = mirrors.filter((_, index) => mask & (1 << index));
    if (subset.length === total) continue;
    if (traceBeam(source, dir, subset, blocks, target).hitTarget) return false;
  }
  return true;
}

const KINDS: MirrorKind[] = ["/", "\\"];

/**
 * No shorter answer anywhere on the grid: neither a bare beam, nor any single
 * mirror, nor any pair of mirrors placed anywhere at all, may reach the target.
 * Searched exhaustively, so the tray is always needed in full.
 */
function noShortSolution(source: number, dir: BeamDir, blocks: number[], target: number): boolean {
  const blocked = new Set(blocks);
  const open: number[] = [];
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    if (cell === source || cell === target || blocked.has(cell)) continue;
    open.push(cell);
  }

  // The direct line, and every one-bend line.
  if (traceBeam(source, dir, [], blocks, target).hitTarget) return false;
  for (const cell of open) {
    for (const kind of KINDS) {
      if (traceBeam(source, dir, [{ cell, kind }], blocks, target).hitTarget) return false;
    }
  }
  // Every two-mirror placement.
  for (let first = 0; first < open.length; first++) {
    for (let second = first + 1; second < open.length; second++) {
      for (const kindA of KINDS) {
        for (const kindB of KINDS) {
          const trial = [
            { cell: open[first]!, kind: kindA },
            { cell: open[second]!, kind: kindB },
          ];
          if (traceBeam(source, dir, trial, blocks, target).hitTarget) return false;
        }
      }
    }
  }
  return true;
}

/** Cells on the straight line out of the source, or on a line into the target. */
function shortcutLine(source: number, dir: BeamDir, target: number): Set<number> {
  const straight = new Set(traceBeam(source, dir, [], [], target).cells);
  const targetRow = laserRow(target);
  const targetCol = laserCol(target);
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    if (laserRow(cell) === targetRow || laserCol(cell) === targetCol) straight.add(cell);
  }
  straight.delete(source);
  straight.delete(target);
  return straight;
}

/** The four cells touching a cell, inside the grid. */
function around(cell: number): number[] {
  return (["U", "D", "L", "R"] as BeamDir[])
    .map((dir) => laserStep(cell, dir))
    .filter((next): next is number => next !== null);
}

export function generateLaser(): LaserPuzzleData {
  let attempts = 0;
  for (let attempt = 0; attempt < 40_000; attempt++) {
    attempts += 1;
    const { cell: source, dir } = shuffled(sources())[0]!;
    // Always exactly four mirrors, so the route always bends four times.
    const route = randomRoute(source, dir, LASER_MAX_MIRRORS);
    if (!route) continue;
    if (route.bends.length !== LASER_MAX_MIRRORS) continue;
    // Both orientations have to show up, so the tray is never all one way.
    const kinds = new Set(route.bends.map((mirror) => mirror.kind));
    if (kinds.size < 2) continue;

    const onRoute = new Set(route.cells);
    const offRoute = Array.from({ length: LASER_CELLS }, (_, cell) => cell).filter(
      (cell) => !onRoute.has(cell),
    );

    // Blocks are chosen with a job to do: some close the shortcut lines, some
    // hug the route so the corridor is not obvious, the rest fill in around.
    const shortcuts = shortcutLine(source, dir, route.target);
    const beside = new Set<number>();
    for (const cell of route.cells) for (const next of around(cell)) beside.add(next);

    const shortcutPicks = shuffled(offRoute.filter((cell) => shortcuts.has(cell))).slice(
      0,
      LASER_MIN_SHORTCUT_BLOCKS + randomInt(2),
    );
    const asidePicks = shuffled(
      offRoute.filter((cell) => beside.has(cell) && !shortcutPicks.includes(cell)),
    ).slice(0, LASER_MIN_ADJACENT_BLOCKS + randomInt(2));
    const blockCount = LASER_MIN_BLOCKS + randomInt(LASER_MAX_BLOCKS - LASER_MIN_BLOCKS + 1);
    const chosen = [...shortcutPicks, ...asidePicks];
    const filler = shuffled(offRoute.filter((cell) => !chosen.includes(cell))).slice(
      0,
      Math.max(0, blockCount - chosen.length),
    );
    const blocks = [...chosen, ...filler].slice(0, blockCount);
    if (blocks.length < LASER_MIN_BLOCKS) continue;

    // The route must survive the blocks, and the empty grid must not reach the target.
    if (!traceBeam(source, dir, route.bends, blocks, route.target).hitTarget) continue;
    if (traceBeam(source, dir, [], blocks, route.target).hitTarget) continue;

    // Enough blocks doing each job, counted on the set actually used.
    if (blocks.filter((cell) => shortcuts.has(cell)).length < LASER_MIN_SHORTCUT_BLOCKS) continue;
    if (
      blocks.filter((cell) => beside.has(cell) && !onRoute.has(cell)).length <
      LASER_MIN_ADJACENT_BLOCKS
    )
      continue;

    // Nothing short of the whole tray may solve it — neither a subset of these
    // four mirrors, nor any one or two mirrors placed anywhere on the grid.
    if (!everyMirrorNeeded(source, dir, route.bends, blocks, route.target)) continue;
    if (!noShortSolution(source, dir, blocks, route.target)) continue;

    console.log(`[laser] layout accepted after ${attempts} attempt(s)`);
    return {
      type: "laser",
      source,
      dir,
      target: route.target,
      blocks: [...blocks].sort((a, b) => a - b),
      mirrors: route.bends.length,
      solution: route.bends,
    };
  }
  throw new Error("Laser generator could not build a solvable layout");
}
