/**
 * Server-only Laser and Mirrors generation. The beam route is chosen first and
 * mirrors are placed on its bends, so the stored placement is a solution by
 * construction — and the tracer proves it, and proves that no smaller set of
 * those mirrors works, before the layout is ever stored.
 */

import { laserCol, laserRow, laserStep, traceBeam } from "./laser";
import { shuffled } from "./random";
import {
  LASER_CELLS,
  LASER_COLS as N,
  LASER_MAX_BLOCKS,
  LASER_MAX_MIRRORS,
  LASER_MIN_BENDS,
  LASER_MIN_BLOCKS,
  LASER_MIN_MIRRORS,
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

/** Every proper subset of the mirrors must miss the target — all of them are needed. */
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

/**
 * Blocks that sit on a line into the target, or on the laser's own straight
 * line: those are the ones closing off a shorter route.
 */
function shortcutBlocks(source: number, dir: BeamDir, blocks: number[], target: number): number {
  const straight = new Set(traceBeam(source, dir, [], [], target).cells);
  const targetRow = laserRow(target);
  const targetCol = laserCol(target);
  return blocks.filter(
    (cell) => straight.has(cell) || laserRow(cell) === targetRow || laserCol(cell) === targetCol,
  ).length;
}

export function generateLaser(): LaserPuzzleData {
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const { cell: source, dir } = shuffled(sources())[0]!;
    // Always exactly four mirrors, so the route always bends four times.
    const bendCount = LASER_MAX_MIRRORS;
    const route = randomRoute(source, dir, bendCount);
    if (!route) continue;
    if (route.bends.length !== LASER_MAX_MIRRORS) continue;

    const onRoute = new Set(route.cells);
    // Blocks never crowd the route: they sit off it, leaving open space around
    // the beam so wrong-looking placements still look plausible.
    const free = shuffled(
      Array.from({ length: LASER_CELLS }, (_, cell) => cell).filter((cell) => !onRoute.has(cell)),
    );
    const blockCount = LASER_MIN_BLOCKS + randomInt(LASER_MAX_BLOCKS - LASER_MIN_BLOCKS + 1);
    const blocks = free.slice(0, blockCount);

    // The route must survive the blocks, and the empty grid must not reach the
    // target: one of the blocks has to interrupt the unmirrored beam.
    const solved = traceBeam(source, dir, route.bends, blocks, route.target);
    if (!solved.hitTarget) continue;

    let empty = traceBeam(source, dir, [], blocks, route.target);
    if (empty.hitTarget) {
      const between = empty.cells.filter(
        (cell) =>
          cell !== source && cell !== route.target && !route.bends.some((m) => m.cell === cell),
      );
      const stopper = between.find((cell) => !onRoute.has(cell));
      if (stopper === undefined) continue;
      blocks.push(stopper);
      if (!traceBeam(source, dir, route.bends, blocks, route.target).hitTarget) continue;
      empty = traceBeam(source, dir, [], blocks, route.target);
      if (empty.hitTarget) continue;
    }

    // At least two blocks must be closing off a shorter route.
    if (shortcutBlocks(source, dir, blocks, route.target) < 2) continue;

    // Nothing short of the whole tray may solve it — neither a subset of these
    // four mirrors, nor any one or two mirrors placed anywhere on the grid.
    if (!everyMirrorNeeded(source, dir, route.bends, blocks, route.target)) continue;
    if (!noShortSolution(source, dir, blocks, route.target)) continue;

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
