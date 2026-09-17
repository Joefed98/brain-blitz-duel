/**
 * Server-only Laser and Mirrors generation. The beam route is chosen first and
 * mirrors are placed on its bends, so the stored placement is a solution by
 * construction. An EXHAUSTIVE search then tries every placement of one, two or
 * three mirrors, in both orientations, on every free cell: the layout is only
 * accepted when none of them reaches the target, so all four mirrors are always
 * needed. Shortcuts found along the way are closed off with extra blocks.
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
  LASER_MIN_GAP_SEGMENTS,
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

const DIR_INDEX: Record<BeamDir, number> = { U: 0, D: 1, L: 2, R: 3 };
const DIRS: BeamDir[] = ["U", "D", "L", "R"];

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
  /** The straight runs between bends, each with the heading it travelled. */
  segments: { cells: number[]; dir: BeamDir }[];
  target: number;
}

/** Walks a random zig-zag of several bends from the source, never re-using a cell. */
function randomRoute(source: number, dir: BeamDir, bends: number): Route | null {
  const visited = new Set<number>([source]);
  const cells = [source];
  let cell = source;
  let heading = dir;
  const placements: MirrorPlacement[] = [];
  const segments: { cells: number[]; dir: BeamDir }[] = [];

  for (let bend = 0; bend <= bends; bend++) {
    const runMax = bend === bends ? 4 : 5;
    const run = 1 + randomInt(runMax);
    const walked: number[] = [cell];
    let moved = 0;
    for (let step = 0; step < run; step++) {
      const next = laserStep(cell, heading);
      if (next === null || visited.has(next)) break;
      cell = next;
      visited.add(cell);
      cells.push(cell);
      walked.push(cell);
      moved += 1;
    }
    if (moved === 0) return null;
    segments.push({ cells: walked, dir: heading });
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
  return { cells, bends: placements, segments, target };
}

/* -------------------------------------------------------------------------- */
/*  Fast tracer for the exhaustive search                                     */
/* -------------------------------------------------------------------------- */

/** One beam walk over flat arrays: no allocation, so hundreds of thousands run fast. */
function walk(
  source: number,
  dir: BeamDir,
  blocked: Uint8Array,
  mirrors: Int8Array,
  target: number,
  trail: number[] | null,
): boolean {
  let cell = source;
  let heading = DIR_INDEX[dir];
  if (trail) trail.length = 0;
  if (trail) trail.push(cell);
  for (let guard = 0; guard < LASER_CELLS * 4; guard++) {
    const mirror = mirrors[cell];
    if (mirror && cell !== source) {
      // "/" is 1, "\" is 2.
      if (mirror === 1) heading = heading === 3 ? 0 : heading === 0 ? 3 : heading === 2 ? 1 : 2;
      else heading = heading === 3 ? 1 : heading === 1 ? 3 : heading === 2 ? 0 : 2;
    }
    if (cell === target) return true;
    const row = Math.floor(cell / N);
    const col = cell % N;
    let next = -1;
    if (heading === 0) next = row > 0 ? cell - N : -1;
    else if (heading === 1) next = row < N - 1 ? cell + N : -1;
    else if (heading === 2) next = col > 0 ? cell - 1 : -1;
    else next = col < N - 1 ? cell + 1 : -1;
    if (next < 0 || blocked[next]) return false;
    cell = next;
    if (trail) trail.push(cell);
    if (cell === target) return true;
  }
  return false;
}

export interface ShortcutSearch {
  /** The first one-, two- or three-mirror placement that reaches the target. */
  hit: { cells: number[] } | null;
  /** How many placements were traced. */
  tested: number;
}

/**
 * Tries EVERY placement of one, two or three mirrors, both orientations, on the
 * free cells. With `stopOnFirst` it returns the beam path of the first shortcut
 * found (so a block can be dropped on it); otherwise it runs to the end and the
 * tested count is the full number of placements proved to fail.
 */
export function searchShortcuts(
  source: number,
  dir: BeamDir,
  blocks: number[],
  target: number,
  stopOnFirst: boolean,
): ShortcutSearch {
  const blocked = new Uint8Array(LASER_CELLS);
  for (const cell of blocks) blocked[cell] = 1;
  const mirrors = new Int8Array(LASER_CELLS);
  const free: number[] = [];
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    if (cell === source || cell === target || blocked[cell]) continue;
    free.push(cell);
  }

  const trail: number[] = [];
  let tested = 0;
  let hit: { cells: number[] } | null = null;

  const bare = walk(source, dir, blocked, mirrors, target, trail);
  tested += 1;
  if (bare) return { hit: { cells: [...trail] }, tested };

  for (let a = 0; a < free.length; a++) {
    for (let ka = 1 as 1 | 2; ka <= 2; ka++) {
      mirrors[free[a]!] = ka;
      tested += 1;
      if (walk(source, dir, blocked, mirrors, target, trail)) {
        hit ??= { cells: [...trail] };
        if (stopOnFirst) {
          mirrors[free[a]!] = 0;
          return { hit, tested };
        }
      }
      for (let b = a + 1; b < free.length; b++) {
        for (let kb = 1 as 1 | 2; kb <= 2; kb++) {
          mirrors[free[b]!] = kb;
          tested += 1;
          if (walk(source, dir, blocked, mirrors, target, trail)) {
            hit ??= { cells: [...trail] };
            if (stopOnFirst) {
              mirrors[free[a]!] = 0;
              mirrors[free[b]!] = 0;
              return { hit, tested };
            }
          }
          for (let c = b + 1; c < free.length; c++) {
            for (let kc = 1 as 1 | 2; kc <= 2; kc++) {
              mirrors[free[c]!] = kc;
              tested += 1;
              if (walk(source, dir, blocked, mirrors, target, trail)) {
                hit ??= { cells: [...trail] };
                if (stopOnFirst) {
                  mirrors[free[a]!] = 0;
                  mirrors[free[b]!] = 0;
                  mirrors[free[c]!] = 0;
                  return { hit, tested };
                }
              }
            }
            mirrors[free[c]!] = 0;
          }
        }
        mirrors[free[b]!] = 0;
      }
    }
    mirrors[free[a]!] = 0;
  }
  return { hit, tested };
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
  return DIRS.map((dir) => laserStep(cell, dir)).filter((next): next is number => next !== null);
}

/** A straight sightline from a cell, stopping at a block or the edge. */
function seesTarget(from: number, dir: BeamDir, blocked: Set<number>, target: number): boolean {
  let cell = from;
  for (let guard = 0; guard < LASER_CELLS; guard++) {
    const next = laserStep(cell, dir);
    if (next === null || blocked.has(next)) return false;
    cell = next;
    if (cell === target) return true;
  }
  return false;
}

/**
 * The target may not be visible straight down any line from the source, or from
 * any cell sharing the source's row or column.
 */
function targetHidden(source: number, blocks: number[], target: number): boolean {
  const blocked = new Set(blocks);
  const sourceRow = laserRow(source);
  const sourceCol = laserCol(source);
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    if (blocked.has(cell) || cell === target) continue;
    if (laserRow(cell) !== sourceRow && laserCol(cell) !== sourceCol) continue;
    for (const dir of DIRS) if (seesTarget(cell, dir, blocked, target)) return false;
  }
  return true;
}

/** How many route segments squeeze through a one-cell gap between two blocks. */
function gapSegments(route: Route, blocks: number[]): number {
  const blocked = new Set(blocks);
  let count = 0;
  for (const segment of route.segments) {
    const sides: BeamDir[] = PERPENDICULAR[segment.dir];
    const squeezed = segment.cells.some((cell) => {
      const left = laserStep(cell, sides[0]!);
      const right = laserStep(cell, sides[1]!);
      return (
        left !== null && right !== null && blocked.has(left) && blocked.has(right)
      );
    });
    if (squeezed) count += 1;
  }
  return count;
}

export function generateLaser(): LaserPuzzleData {
  for (let attempt = 1; attempt <= 40_000; attempt++) {
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
      LASER_MIN_SHORTCUT_BLOCKS + randomInt(3),
    );
    const asidePicks = shuffled(
      offRoute.filter((cell) => beside.has(cell) && !shortcutPicks.includes(cell)),
    ).slice(0, LASER_MIN_ADJACENT_BLOCKS + randomInt(3));
    const blockCount = LASER_MIN_BLOCKS + randomInt(3);
    const chosen = [...shortcutPicks, ...asidePicks];
    const filler = shuffled(offRoute.filter((cell) => !chosen.includes(cell))).slice(
      0,
      Math.max(0, blockCount - chosen.length),
    );
    const blocks = [...new Set([...chosen, ...filler])].slice(0, blockCount);
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

    // Close off every shorter answer by blocking a cell on its beam path, and
    // keep going until the exhaustive search finds nothing at all.
    const solutionCells = new Set(route.bends.map((mirror) => mirror.cell));
    let tested = 0;
    let necessityPass = false;
    for (let repair = 0; repair <= LASER_MAX_BLOCKS; repair++) {
      const search = searchShortcuts(source, dir, blocks, route.target, true);
      tested = search.tested;
      if (!search.hit) {
        necessityPass = true;
        break;
      }
      if (blocks.length >= LASER_MAX_BLOCKS) break;
      const candidates = shuffled(
        search.hit.cells.filter(
          (cell) =>
            !onRoute.has(cell) &&
            !solutionCells.has(cell) &&
            cell !== source &&
            cell !== route.target &&
            !blocks.includes(cell),
        ),
      );
      const pick = candidates[0];
      if (pick === undefined) break;
      blocks.push(pick);
      if (!traceBeam(source, dir, route.bends, blocks, route.target).hitTarget) break;
    }
    if (!necessityPass) continue;
    if (blocks.length < LASER_MIN_BLOCKS || blocks.length > LASER_MAX_BLOCKS) continue;

    // The target may not simply be in plain sight.
    if (!targetHidden(source, blocks, route.target)) continue;
    // And the beam has to thread at least two one-cell gaps.
    const gaps = gapSegments(route, blocks);
    if (gaps < LASER_MIN_GAP_SEGMENTS) continue;

    // Final proof, run to the end: NO placement of one, two or three mirrors
    // reaches the target, so all four are required.
    const proof = searchShortcuts(source, dir, blocks, route.target, false);
    if (proof.hit) continue;
    if (!traceBeam(source, dir, route.bends, blocks, route.target).hitTarget) continue;

    console.log(
      `[laser] layout accepted after ${attempt} attempt(s): ${blocks.length} blocks, ${proof.tested} placements proved to fail`,
    );
    return {
      type: "laser",
      source,
      dir,
      target: route.target,
      blocks: [...blocks].sort((a, b) => a - b),
      mirrors: route.bends.length,
      stats: {
        blocks: blocks.length,
        mirrors: route.bends.length,
        bends: route.bends.length,
        necessityPass: true,
        subsetsTested: proof.tested,
        gapSegments: gaps,
        attempts: attempt,
      },
      solution: route.bends,
    };
  }
  throw new Error("Laser generator could not build a solvable layout");
}
