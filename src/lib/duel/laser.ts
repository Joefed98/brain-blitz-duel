/**
 * Laser and Mirrors rules. One beam tracer, used by the phone (to draw the beam
 * live) and by the server (to re-trace whatever placement a phone sends). Pure
 * logic: no generator and no stored answers.
 */

import {
  LASER_CELLS,
  LASER_COLS as N,
  type BeamDir,
  type MirrorKind,
  type MirrorPlacement,
} from "./types";

export const BEAM_DIRS: BeamDir[] = ["U", "D", "L", "R"];

export function laserRow(cell: number): number {
  return Math.floor(cell / N);
}

export function laserCol(cell: number): number {
  return cell % N;
}

export function laserStep(cell: number, dir: BeamDir): number | null {
  const row = laserRow(cell);
  const col = laserCol(cell);
  if (dir === "U") return row > 0 ? cell - N : null;
  if (dir === "D") return row < N - 1 ? cell + N : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < N - 1 ? cell + 1 : null;
}

/** A "/" mirror sends a beam travelling right upward, and so on. */
export function reflect(dir: BeamDir, kind: MirrorKind): BeamDir {
  if (kind === "/") {
    if (dir === "R") return "U";
    if (dir === "U") return "R";
    if (dir === "L") return "D";
    return "L";
  }
  if (dir === "R") return "D";
  if (dir === "D") return "R";
  if (dir === "L") return "U";
  return "L";
}

export function flipMirror(kind: MirrorKind): MirrorKind {
  return kind === "/" ? "\\" : "/";
}

/** How far apart two cells are, counting a diagonal step as one. */
export function laserChebyshev(a: number, b: number): number {
  return Math.max(Math.abs(laserRow(a) - laserRow(b)), Math.abs(laserCol(a) - laserCol(b)));
}

export interface BeamTrace {
  /** Every cell the beam passes through, from the source onward. */
  cells: number[];
  /** The straight runs of the beam, for drawing: each is a list of cells. */
  segments: number[][];
  /** Where the beam stopped. */
  endCell: number;
  hitTarget: boolean;
}

/**
 * Fires the beam from the source. It travels in straight lines, turns on a
 * mirror, and stops at a block, the target, or the edge of the grid.
 */
export function traceBeam(
  source: number,
  dir: BeamDir,
  mirrors: MirrorPlacement[],
  blocks: number[],
  target: number,
): BeamTrace {
  const mirrorAt = new Map<number, MirrorKind>();
  for (const mirror of mirrors) mirrorAt.set(mirror.cell, mirror.kind);
  const blocked = new Set(blocks);

  const cells: number[] = [];
  const segments: number[][] = [];
  let segment: number[] = [];
  let cell = source;
  let heading = dir;

  if (blocked.has(source)) return { cells: [source], segments: [[source]], endCell: source, hitTarget: false };

  cells.push(cell);
  segment.push(cell);

  for (let guard = 0; guard < LASER_CELLS * 4; guard++) {
    const mirror = mirrorAt.get(cell);
    if (mirror && cell !== source) {
      heading = reflect(heading, mirror);
      segments.push(segment);
      segment = [cell];
    }
    if (cell === target && cells.length > 1) break;

    const next = laserStep(cell, heading);
    if (next === null || blocked.has(next)) break;
    cell = next;
    cells.push(cell);
    segment.push(cell);
    if (cell === target) break;
  }

  segments.push(segment);
  return {
    cells,
    segments: segments.filter((run) => run.length > 0),
    endCell: cell,
    hitTarget: cells.includes(target) && cells.length > 1,
  };
}

/** "12:/,20:\\" — one placed mirror per part. */
export function encodeMirrors(mirrors: MirrorPlacement[]): string {
  return mirrors.map((mirror) => `${mirror.cell}:${mirror.kind}`).join(",");
}

export function decodeMirrors(raw: string, max: number): MirrorPlacement[] {
  const seen = new Set<number>();
  const out: MirrorPlacement[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const [rawCell, rawKind] = part.split(":");
    const cell = Number.parseInt(rawCell ?? "", 10);
    const kind = rawKind === "/" ? "/" : rawKind === "\\" ? "\\" : null;
    if (!Number.isInteger(cell) || cell < 0 || cell >= LASER_CELLS || !kind) continue;
    if (seen.has(cell)) continue;
    seen.add(cell);
    out.push({ cell, kind });
    if (out.length >= max) break;
  }
  return out;
}

export interface LaserVerdict {
  solved: boolean;
  /** The beam stopped within one cell of the target, straight or diagonal. */
  near: boolean;
  mirrorsPlaced: number;
  trace: BeamTrace;
}

/**
 * The single check: mirrors on blocks, on the source or on the target simply do
 * not count, and no more mirrors than the tray holds are honoured.
 */
export function verifyLaser(
  puzzle: {
    source: number;
    dir: BeamDir;
    target: number;
    blocks: number[];
    mirrors: number;
  },
  placements: MirrorPlacement[],
): LaserVerdict {
  const blocked = new Set(puzzle.blocks);
  const legal = placements
    .filter(
      (mirror) =>
        !blocked.has(mirror.cell) && mirror.cell !== puzzle.source && mirror.cell !== puzzle.target,
    )
    .slice(0, puzzle.mirrors);

  const trace = traceBeam(puzzle.source, puzzle.dir, legal, puzzle.blocks, puzzle.target);
  return {
    solved: trace.hitTarget,
    near: !trace.hitTarget && laserChebyshev(trace.endCell, puzzle.target) <= 1,
    mirrorsPlaced: legal.length,
    trace,
  };
}
