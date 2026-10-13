/** Server-only exact-piece branching Laser generation. */

import { ACTION_LOG_REV } from "./actionLog";
import { laserCol, laserRow, laserStep, verifyLaser } from "./laser";
import { shuffled } from "./random";
import {
  LASER_MAX_BOMBS,
  LASER_CELLS,
  LASER_CENTRAL_FROM,
  LASER_CENTRAL_TO,
  LASER_COLS as N,
  LASER_GEMS,
  LASER_MAX_BLOCKS,
  LASER_MIN_BOMBS,
  LASER_MAX_MIRRORS,
  LASER_MIN_MIRRORS,
  LASER_MIN_BLOCKS,
  LASER_MIN_CENTRAL_BLOCKS,
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


/** True for the middle 6x6 of the board. */
function isCentral(cell: number): boolean {
  const row = laserRow(cell);
  const col = laserCol(cell);
  return (
    row >= LASER_CENTRAL_FROM &&
    row <= LASER_CENTRAL_TO &&
    col >= LASER_CENTRAL_FROM &&
    col <= LASER_CENTRAL_TO
  );
}

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
  segments: { cells: number[]; dir: BeamDir }[];
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
    const run = 2 + randomInt(bend === bends ? 4 : 5);
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

    const turn = shuffled(PERPENDICULAR[heading])[0];
    if (!turn) return null;
    const kind = mirrorFor(heading, turn);
    if (!kind) return null;
    if (cell === source) return null;
    placements.push({ cell, kind });
    heading = turn;
  }

  if (placements.length !== bends) return null;
  return { cells, bends: placements, segments };
}

/** Build an exact-piece witness, then verify it with the shared server tracer.
 * Two outward-facing edge gems terminate the two branches: a non-branching
 * beam cannot light both, regardless of where mirrors are placed.
 */
export function generateLaser(): LaserPuzzleData {
  const started = performance.now();
  for (let attempt = 1; attempt <= 100_000; attempt++) {
    const entry = shuffled(sources())[0];
    if (!entry) continue;
    const { cell: source, dir } = entry;
    const mirrorCount = LASER_MIN_MIRRORS + randomInt(LASER_MAX_MIRRORS - LASER_MIN_MIRRORS + 1);
    const route = randomRoute(source, dir, mirrorCount + 1);
    if (!route) continue;
    // Continue the final leg to its edge; a terminal gem consumes the beam.
    const last = route.segments.at(-1);
    let end = route.cells.at(-1);
    if (!last || end === undefined) continue;
    let next = laserStep(end, last.dir);
    let invalid = false;
    while (next !== null) {
      if (route.cells.includes(next)) { invalid = true; break; }
      route.cells.push(next); last.cells.push(next); end = next;
      next = laserStep(end, last.dir);
    }
    if (invalid || route.bends.some((piece) => piece.cell === end)) continue;
    const forkIndex = 1 + randomInt(route.bends.length - 2);
    const fork = route.bends[forkIndex];
    const incoming = route.segments[forkIndex]?.dir;
    const outgoing = route.segments[forkIndex + 1]?.dir;
    if (!fork || !incoming || !outgoing) continue;
    const opposite: Record<BeamDir, BeamDir> = { U: "D", D: "U", L: "R", R: "L" };
    const branchDir = opposite[outgoing];
    const branch: number[] = [];
    let cursor = laserStep(fork.cell, branchDir);
    while (cursor !== null && !route.cells.includes(cursor)) {
      branch.push(cursor); cursor = laserStep(cursor, branchDir);
    }
    const branchEnd = branch.at(-1);
    if (cursor !== null || branch.length < 2 || branchEnd === undefined || branchEnd === source) continue;
    const solution: MirrorPlacement[] = route.bends.map((piece, index) => index === forkIndex
      ? { cell: piece.cell, kind: incoming === "U" || incoming === "D" ? "S|" : "S-" }
      : piece);
    const bends = new Set(solution.map((piece) => piece.cell));
    const pool = shuffled(route.cells.filter((cell) => cell !== source && cell !== end && !bends.has(cell)
      && !route.segments[0]?.cells.includes(cell)));
    const gems = [end, branchEnd, ...pool.slice(0, LASER_GEMS - 2)];
    if (new Set(gems).size !== LASER_GEMS) continue;
    const directionalGems = [{ cell: end, from: last.dir }, { cell: branchEnd, from: branchDir }];
    const onRoute = new Set([...route.cells, ...branch]);
    const offRoute = Array.from({ length: LASER_CELLS }, (_, cell) => cell).filter((cell) => !onRoute.has(cell));
    const central = shuffled(offRoute.filter(isCentral)).slice(0, LASER_MIN_CENTRAL_BLOCKS);
    if (central.length < LASER_MIN_CENTRAL_BLOCKS) continue;
    const blockCount = LASER_MIN_BLOCKS + randomInt(LASER_MAX_BLOCKS - LASER_MIN_BLOCKS + 1);
    const blocks = [...central, ...shuffled(offRoute.filter((cell) => !central.includes(cell))).slice(0, blockCount - central.length)];
    const bombCount = LASER_MIN_BOMBS + randomInt(LASER_MAX_BOMBS - LASER_MIN_BOMBS + 1);
    const bombs = shuffled(offRoute.filter((cell) => !blocks.includes(cell))).slice(0, bombCount);
    if (bombs.length !== bombCount) continue;
    const puzzle: LaserPuzzleData = { type: "laser", source, dir, gems, directionalGems,
      bombs, blocks, mirrors: mirrorCount, splitterPieces: 1, solution };
    if (!verifyLaser(puzzle, solution, 1).solved || verifyLaser(puzzle, [], 1).gemsLit > 0) continue;
    // Exhaust every subset of the supplied witness, not a heuristic shortcut search.
    const fullMask = (1 << solution.length) - 1;
    let tested = 0; let redundant = false;
    for (let mask = 0; mask < fullMask; mask++) {
      tested++;
      const subset = solution.filter((_, index) => (mask & (1 << index)) !== 0);
      if (verifyLaser(puzzle, subset, 1).solved) { redundant = true; break; }
    }
    if (redundant) continue;
    puzzle.stats = { blocks: blocks.length, mirrors: mirrorCount, bends: mirrorCount,
      gems: gems.length, bombs: bombs.length, necessityPass: true, subsetsTested: tested,
      attempts: attempt, splitters: 1, directionalGems: 2, splitRequired: true,
      generationMs: performance.now() - started };
    // New rounds are answered with the action log (laserLog.ts).
    puzzle.alogRev = ACTION_LOG_REV;
    return puzzle;
  }
  throw new Error("Laser generator could not build a verified exact-piece layout");
}
