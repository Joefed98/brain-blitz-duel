/**
 * Server-only Laser and Mirrors generation. A beam route is chosen first and a
 * mirror is put on each of its four bends, so the stored placement is a solution
 * by construction; the two gems are picked off that route, so one shot passes
 * through both. Blocks then obstruct the middle of the board and hide the
 * corridor, bombs go where a plausible wrong route runs — cells crossed by
 * several near-miss beams — and an EXHAUSTIVE search tries every placement of
 * one, two or three mirrors in both orientations: the layout is only accepted
 * when none of them lights both gems, so all four mirrors are always needed.
 */

import { laserCol, laserRow, laserStep, traceBeam } from "./laser";
import { shuffled } from "./random";
import {
  LASER_BOMBS,
  LASER_CELLS,
  LASER_CENTRAL_FROM,
  LASER_CENTRAL_TO,
  LASER_COLS as N,
  LASER_GEMS,
  LASER_MAX_BLOCKS,
  LASER_MAX_MIRRORS,
  LASER_MIN_ADJACENT_BLOCKS,
  LASER_MIN_BLOCKS,
  LASER_MIN_BOMB_CROSSINGS,
  LASER_MIN_CENTRAL_BLOCKS,
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

    const turn = shuffled(PERPENDICULAR[heading])[0]!;
    const kind = mirrorFor(heading, turn);
    if (!kind) return null;
    if (cell === source) return null;
    placements.push({ cell, kind });
    heading = turn;
  }

  if (placements.length !== bends) return null;
  return { cells, bends: placements, segments };
}

/* -------------------------------------------------------------------------- */
/*  Fast tracer for the exhaustive search                                     */
/* -------------------------------------------------------------------------- */

/**
 * One beam walk over flat arrays: no allocation, so hundreds of thousands run
 * fast. Fills `trail` with the path and returns how many gems the shot lit; a
 * bomb, a block or the edge ends the walk.
 */
function walkPath(
  source: number,
  dir: BeamDir,
  blocked: Uint8Array,
  bomb: Uint8Array,
  gem: Uint8Array,
  mirrors: Int8Array,
  trail: number[] | null,
): number {
  let cell = source;
  let heading = DIR_INDEX[dir];
  let lit = 0;
  const seen = new Set<number>();
  if (trail) {
    trail.length = 0;
    trail.push(cell);
  }
  if (gem[cell]) {
    lit += 1;
    seen.add(cell);
  }
  for (let guard = 0; guard < LASER_CELLS * 4; guard++) {
    const mirror = mirrors[cell];
    if (mirror && cell !== source) {
      // "/" is 1, "\" is 2.
      if (mirror === 1) heading = heading === 3 ? 0 : heading === 0 ? 3 : heading === 2 ? 1 : 2;
      else heading = heading === 3 ? 1 : heading === 1 ? 3 : heading === 2 ? 0 : 2;
    }
    const row = Math.floor(cell / N);
    const col = cell % N;
    let next = -1;
    if (heading === 0) next = row > 0 ? cell - N : -1;
    else if (heading === 1) next = row < N - 1 ? cell + N : -1;
    else if (heading === 2) next = col > 0 ? cell - 1 : -1;
    else next = col < N - 1 ? cell + 1 : -1;
    if (next < 0 || blocked[next]) return lit;
    cell = next;
    if (trail) trail.push(cell);
    if (bomb[cell]) return lit;
    if (gem[cell] && !seen.has(cell)) {
      seen.add(cell);
      lit += 1;
    }
  }
  return lit;
}

export interface ShortcutSearch {
  /** The first one-, two- or three-mirror placement that lights both gems. */
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
  bombs: number[],
  gems: number[],
  stopOnFirst: boolean,
): ShortcutSearch {
  const blocked = new Uint8Array(LASER_CELLS);
  for (const cell of blocks) blocked[cell] = 1;
  const bomb = new Uint8Array(LASER_CELLS);
  for (const cell of bombs) bomb[cell] = 1;
  const gem = new Uint8Array(LASER_CELLS);
  for (const cell of gems) gem[cell] = 1;
  const mirrors = new Int8Array(LASER_CELLS);
  const free: number[] = [];
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    if (cell === source || blocked[cell] || bomb[cell] || gem[cell]) continue;
    free.push(cell);
  }

  const trail: number[] = [];
  let tested = 0;
  let hit: { cells: number[] } | null = null;
  const fire = () =>
    walkPath(source, dir, blocked, bomb, gem, mirrors, trail) >= gems.length;

  tested += 1;
  if (fire()) return { hit: { cells: [...trail] }, tested };

  for (let a = 0; a < free.length; a++) {
    for (let ka = 1 as 1 | 2; ka <= 2; ka++) {
      mirrors[free[a]!] = ka;
      tested += 1;
      if (fire()) {
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
          if (fire()) {
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
              if (fire()) {
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

/**
 * Where the plausible wrong routes go. Every three-mirror placement is traced
 * exhaustively and a large sample of four-mirror placements on top, and each
 * beam that lights exactly one gem — or comes within one cell of the second —
 * has its path counted. The result is how many near-miss beams cross each cell,
 * which is where a bomb belongs.
 */
export function nearMissCrossings(
  source: number,
  dir: BeamDir,
  blocks: number[],
  gems: number[],
  exclude: Set<number>,
): Map<number, number> {
  const blocked = new Uint8Array(LASER_CELLS);
  for (const cell of blocks) blocked[cell] = 1;
  const bomb = new Uint8Array(LASER_CELLS);
  const gem = new Uint8Array(LASER_CELLS);
  for (const cell of gems) gem[cell] = 1;
  const mirrors = new Int8Array(LASER_CELLS);
  const free: number[] = [];
  for (let cell = 0; cell < LASER_CELLS; cell++) {
    if (cell === source || blocked[cell] || gem[cell]) continue;
    free.push(cell);
  }

  const counts = new Map<number, number>();
  const trail: number[] = [];
  const record = () => {
    for (const cell of trail) {
      if (exclude.has(cell)) continue;
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
  };
  /** A near miss lights one gem, or passes within one cell of a gem it missed. */
  const nearMiss = (lit: number): boolean => {
    if (lit === 1) return true;
    if (lit !== 0) return false;
    return gems.some((target) =>
      trail.some(
        (cell) =>
          Math.abs(laserRow(cell) - laserRow(target)) +
            Math.abs(laserCol(cell) - laserCol(target)) <=
          1,
      ),
    );
  };

  // Every three-mirror placement.
  for (let a = 0; a < free.length; a++) {
    for (let ka = 1 as 1 | 2; ka <= 2; ka++) {
      mirrors[free[a]!] = ka;
      for (let b = a + 1; b < free.length; b++) {
        for (let kb = 1 as 1 | 2; kb <= 2; kb++) {
          mirrors[free[b]!] = kb;
          for (let c = b + 1; c < free.length; c++) {
            for (let kc = 1 as 1 | 2; kc <= 2; kc++) {
              mirrors[free[c]!] = kc;
              if (nearMiss(walkPath(source, dir, blocked, bomb, gem, mirrors, trail))) record();
            }
            mirrors[free[c]!] = 0;
          }
        }
        mirrors[free[b]!] = 0;
      }
    }
    mirrors[free[a]!] = 0;
  }

  // A sample of four-mirror placements, which no exhaustive pass could cover.
  for (let sample = 0; sample < 40_000; sample++) {
    const picked: number[] = [];
    for (let index = 0; index < 4; index++) {
      const cell = free[randomInt(free.length)]!;
      if (mirrors[cell]) continue;
      mirrors[cell] = randomInt(2) === 0 ? 1 : 2;
      picked.push(cell);
    }
    if (picked.length === 4) {
      if (nearMiss(walkPath(source, dir, blocked, bomb, gem, mirrors, trail))) record();
    }
    for (const cell of picked) mirrors[cell] = 0;
  }

  return counts;
}

/** The four cells touching a cell, inside the grid. */
function around(cell: number): number[] {
  return DIRS.map((dir) => laserStep(cell, dir)).filter((next): next is number => next !== null);
}

/**
 * The tempting lines: straight out of the source, straight into either gem, and
 * straight between the two gems. Blocks sit here, so the obvious shot fails.
 */
function shortcutLines(source: number, dir: BeamDir, gems: number[]): Set<number> {
  const cells = new Set(traceBeam(source, dir, [], [], [], []).cells);
  const sourceRow = laserRow(source);
  const sourceCol = laserCol(source);
  for (const gem of gems) {
    const gemRow = laserRow(gem);
    const gemCol = laserCol(gem);
    for (let cell = 0; cell < LASER_CELLS; cell++) {
      const row = laserRow(cell);
      const col = laserCol(cell);
      if (row === gemRow || col === gemCol) cells.add(cell);
      if (row === sourceRow || col === sourceCol) cells.add(cell);
    }
  }
  cells.delete(source);
  for (const gem of gems) cells.delete(gem);
  return cells;
}

export function generateLaser(): LaserPuzzleData {
  for (let attempt = 1; attempt <= 40_000; attempt++) {
    const { cell: source, dir } = shuffled(sources())[0]!;
    // Always exactly four mirrors, so the route always bends four times.
    const route = randomRoute(source, dir, LASER_MAX_MIRRORS);
    if (!route) continue;
    // Both orientations have to show up, so the tray is never all one way.
    if (new Set(route.bends.map((mirror) => mirror.kind)).size < 2) continue;

    const bendCells = new Set(route.bends.map((mirror) => mirror.cell));
    const bendIndex = route.bends.map((mirror) => route.cells.indexOf(mirror.cell));
    const gemPool = route.cells
      .map((cell, index) => ({ cell, index }))
      .filter((spot) => spot.cell !== source && !bendCells.has(spot.cell));

    // One gem past the first bend, the other past the third, so a short answer
    // cannot reach both.
    const early = shuffled(gemPool.filter((spot) => spot.index > bendIndex[0]!));
    const late = shuffled(gemPool.filter((spot) => spot.index > bendIndex[2]!));
    let gems: number[] | null = null;
    for (const first of early) {
      const partner = late.find(
        (spot) =>
          spot.cell !== first.cell &&
          Math.max(
            Math.abs(laserRow(spot.cell) - laserRow(first.cell)),
            Math.abs(laserCol(spot.cell) - laserCol(first.cell)),
          ) >= 3,
      );
      if (partner) {
        gems = [first.cell, partner.cell];
        break;
      }
    }
    if (!gems || gems.length !== LASER_GEMS) continue;

    const onRoute = new Set(route.cells);
    const offRoute = Array.from({ length: LASER_CELLS }, (_, cell) => cell).filter(
      (cell) => !onRoute.has(cell),
    );

    // Blocks are chosen with a job to do: some obstruct the middle of the board,
    // some close the shortcut lines, some hug the route so the corridor is not
    // obvious, the rest fill in around.
    const shortcuts = shortcutLines(source, dir, gems);
    const beside = new Set<number>();
    for (const cell of route.cells) for (const next of around(cell)) beside.add(next);

    const centralPicks = shuffled(offRoute.filter(isCentral)).slice(
      0,
      LASER_MIN_CENTRAL_BLOCKS + randomInt(3),
    );
    if (centralPicks.length < LASER_MIN_CENTRAL_BLOCKS) continue;
    const shortcutPicks = shuffled(
      offRoute.filter((cell) => shortcuts.has(cell) && !centralPicks.includes(cell)),
    ).slice(0, LASER_MIN_SHORTCUT_BLOCKS + randomInt(3));
    const chosen = [...centralPicks, ...shortcutPicks];
    const asidePicks = shuffled(
      offRoute.filter((cell) => beside.has(cell) && !chosen.includes(cell)),
    ).slice(0, LASER_MIN_ADJACENT_BLOCKS + randomInt(3));
    const wanted = [...chosen, ...asidePicks];
    const blockCount = LASER_MIN_BLOCKS + randomInt(3);
    const filler = shuffled(offRoute.filter((cell) => !wanted.includes(cell))).slice(
      0,
      Math.max(0, blockCount - wanted.length),
    );
    const blocks = [...new Set([...wanted, ...filler])].slice(
      0,
      Math.max(blockCount, wanted.length),
    );
    if (blocks.length < LASER_MIN_BLOCKS || blocks.length > LASER_MAX_BLOCKS) continue;

    // Enough blocks doing each job, counted on the set actually used.
    if (blocks.filter(isCentral).length < LASER_MIN_CENTRAL_BLOCKS) continue;
    if (blocks.filter((cell) => shortcuts.has(cell)).length < LASER_MIN_SHORTCUT_BLOCKS) continue;
    if (blocks.filter((cell) => beside.has(cell)).length < LASER_MIN_ADJACENT_BLOCKS) continue;

    // The empty grid must light no gem at all, and the stored route must survive
    // the blocks.
    if (!traceBeam(source, dir, route.bends, blocks, [], gems).litAll) continue;
    if (traceBeam(source, dir, [], blocks, [], gems).gemsLit.length > 0) continue;

    // Bombs go where a plausible wrong route runs: on cells crossed by at least
    // two near-miss beams, never on the solution's own path, and never next to a
    // gem or the source.
    const forbidden = new Set<number>([source, ...gems, ...blocks, ...route.cells]);
    for (const cell of [source, ...gems]) for (const next of around(cell)) forbidden.add(next);
    const crossings = nearMissCrossings(source, dir, blocks, gems, forbidden);
    const bombCandidates = [...crossings.entries()]
      .filter(([, count]) => count >= LASER_MIN_BOMB_CROSSINGS)
      .sort((a, b) => b[1] - a[1])
      .map(([cell]) => cell);
    if (bombCandidates.length < LASER_BOMBS) continue;
    const bombs = shuffled(bombCandidates.slice(0, Math.max(LASER_BOMBS, 8))).slice(0, LASER_BOMBS);
    if (bombs.length !== LASER_BOMBS) continue;

    const litByRoute = () => traceBeam(source, dir, route.bends, blocks, bombs, gems!).litAll;
    if (!litByRoute()) continue;

    // Close off every shorter answer by blocking a cell on its beam path, and
    // keep going until the exhaustive search finds nothing at all.
    let necessityPass = false;
    for (let repair = 0; repair <= LASER_MAX_BLOCKS; repair++) {
      const search = searchShortcuts(source, dir, blocks, bombs, gems, true);
      if (!search.hit) {
        necessityPass = true;
        break;
      }
      if (blocks.length >= LASER_MAX_BLOCKS) break;
      const pick = shuffled(
        search.hit.cells.filter(
          (cell) =>
            !onRoute.has(cell) &&
            !bombs.includes(cell) &&
            !gems!.includes(cell) &&
            cell !== source &&
            !blocks.includes(cell),
        ),
      )[0];
      if (pick === undefined) break;
      blocks.push(pick);
      if (!litByRoute()) break;
    }
    if (!necessityPass) continue;
    if (blocks.length < LASER_MIN_BLOCKS || blocks.length > LASER_MAX_BLOCKS) continue;
    if (blocks.filter(isCentral).length < LASER_MIN_CENTRAL_BLOCKS) continue;
    if (!litByRoute()) continue;

    // Final proof, run to the end with the blocks and bombs final: NO placement
    // of one, two or three mirrors lights both gems, so all four are required.
    const proof = searchShortcuts(source, dir, blocks, bombs, gems, false);
    if (proof.hit) continue;

    const solutionTrace = traceBeam(source, dir, route.bends, blocks, bombs, gems);
    if (!solutionTrace.litAll || solutionTrace.hitBomb) continue;

    console.log(
      `[laser] layout accepted after ${attempt} attempt(s): ${blocks.length} blocks (${blocks.filter(isCentral).length} central), 2 bombs on near-miss routes, ${proof.tested} placements proved to fail`,
    );
    return {
      type: "laser",
      source,
      dir,
      gems: [...gems],
      bombs: [...bombs].sort((a, b) => a - b),
      blocks: [...blocks].sort((a, b) => a - b),
      mirrors: route.bends.length,
      stats: {
        blocks: blocks.length,
        mirrors: route.bends.length,
        bends: route.bends.length,
        gems: gems.length,
        bombs: bombs.length,
        necessityPass: true,
        subsetsTested: proof.tested,
        attempts: attempt,
      },
      solution: route.bends,
    };
  }
  throw new Error("Laser generator could not build a solvable layout");
}
