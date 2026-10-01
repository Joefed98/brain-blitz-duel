/**
 * Laser and Mirrors rules. One beam tracer, used by the phone (to animate a
 * fired shot) and by the server (to re-trace whatever placement a phone sends).
 * The beam passes THROUGH gems and lights them; it stops dead on a bomb, on a
 * block or at the edge. Splitters create two independent right-angle branches.
 * Pure logic: no generator and no stored answers.
 */

import {
  LASER_CELLS,
  LASER_COLS as N,
  LASER_MAX_FIRES,
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

export interface BeamTrace {
  /** Every cell the beam passes through, from the source onward. */
  cells: number[];
  /** Separate branch trails, used by the renderer after a splitter. */
  paths: number[][];
  /** Where the beam stopped. */
  endCell: number;
  /** Which gems the shot lit, in the order the beam met them. */
  gemsLit: number[];
  /** True when the shot ended on a bomb. */
  hitBomb: boolean;
  /** True when this one shot lit every gem without touching a bomb. */
  litAll: boolean;
}

/**
 * Fires the beam once. It travels in straight lines, turns on a mirror, passes
 * through gems, and stops at a block, a bomb, or the edge of the grid.
 */
export function traceBeam(
  source: number,
  dir: BeamDir,
  mirrors: MirrorPlacement[],
  blocks: number[],
  bombs: number[],
  gems: number[],
  splitters: number[] = [],
  directionalGems: { cell: number; from: BeamDir }[] = [],
): BeamTrace {
  const mirrorAt = new Map<number, MirrorKind>();
  for (const mirror of mirrors) mirrorAt.set(mirror.cell, mirror.kind);
  const blocked = new Set(blocks);
  const bombAt = new Set(bombs);
  const gemAt = new Set(gems);

  const cells: number[] = [source];
  const paths: number[][] = [];
  const gemsLit: number[] = [];
  let hitBomb = false;
  const splitterAt = new Set(splitters);
  const required = new Map(directionalGems.map((gem) => [gem.cell, gem.from]));
  const queue: { cell: number; heading: BeamDir; path: number[] }[] = [{ cell: source, heading: dir, path: [source] }];
  const seen = new Set<string>();
  while (queue.length) {
    const beam = queue.shift()!; let cell = beam.cell; let heading = beam.heading; const path = beam.path;
    for (let guard = 0; guard < LASER_CELLS * 4; guard++) {
      const key = `${cell}:${heading}`; if (seen.has(key)) break; seen.add(key);
      const mirror = mirrorAt.get(cell); if (mirror && cell !== source) heading = reflect(heading, mirror);
      const next = laserStep(cell, heading); if (next === null || blocked.has(next)) break;
      cell = next; path.push(cell); cells.push(cell);
      if (bombAt.has(cell)) { hitBomb = true; break; }
      if (gemAt.has(cell) && !gemsLit.includes(cell) && (!required.has(cell) || required.get(cell) === heading)) gemsLit.push(cell);
      if (splitterAt.has(cell)) {
        const turns: BeamDir[] = heading === "U" || heading === "D" ? ["L", "R"] : ["U", "D"];
        queue.push({ cell, heading: turns[1]!, path: [cell] }); heading = turns[0]!;
      }
    }
    paths.push(path);
  }

  return {
    cells,
    paths,
    endCell: paths.at(-1)?.at(-1) ?? source,
    gemsLit,
    hitBomb,
    litAll: !hitBomb && gems.length > 0 && gems.every((gem) => gemsLit.includes(gem)),
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

/** "2|12:/,20:\\" — the shot number, then the placement fired on it. */
export function encodeLaserAnswer(mirrors: MirrorPlacement[], fires: number): string {
  return `${Math.max(0, Math.min(LASER_MAX_FIRES, Math.round(fires)))}|${encodeMirrors(mirrors)}`;
}

export function decodeLaserAnswer(
  raw: string,
  max: number,
): { mirrors: MirrorPlacement[]; fires: number } {
  const text = String(raw ?? "");
  const bar = text.indexOf("|");
  if (bar === -1) return { mirrors: decodeMirrors(text, max), fires: LASER_MAX_FIRES };
  const fires = Number.parseInt(text.slice(0, bar), 10);
  return {
    mirrors: decodeMirrors(text.slice(bar + 1), max),
    fires: Number.isInteger(fires)
      ? Math.max(0, Math.min(LASER_MAX_FIRES, fires))
      : LASER_MAX_FIRES,
  };
}

export interface LaserVerdict {
  /** Every gem lit by the one shot, without touching a bomb. */
  solved: boolean;
  /** How many gems that shot lit. */
  gemsLit: number;
  mirrorsPlaced: number;
  /** Which shot this was, 1 to 3. */
  fires: number;
  trace: BeamTrace;
}

/**
 * The single check: mirrors on blocks, bombs, gems or the source simply do not
 * count, and no more mirrors than the tray holds are honoured.
 */
export function verifyLaser(
  puzzle: {
    source: number;
    dir: BeamDir;
    gems: number[];
    bombs: number[];
    blocks: number[];
    splitters?: number[];
    directionalGems?: { cell: number; from: BeamDir }[];
    mirrors: number;
  },
  placements: MirrorPlacement[],
  fires = LASER_MAX_FIRES,
): LaserVerdict {
  const taken = new Set([...puzzle.blocks, ...puzzle.bombs, ...puzzle.gems, ...(puzzle.splitters ?? []), puzzle.source]);
  const legal = placements.filter((mirror) => !taken.has(mirror.cell)).slice(0, puzzle.mirrors);

  const trace = traceBeam(
    puzzle.source,
    puzzle.dir,
    legal,
    puzzle.blocks,
    puzzle.bombs,
    puzzle.gems,
    puzzle.splitters,
    puzzle.directionalGems,
  );
  const shot = Math.max(1, Math.min(LASER_MAX_FIRES, Math.round(fires) || LASER_MAX_FIRES));
  return {
    solved: trace.litAll,
    gemsLit: trace.gemsLit.length,
    mirrorsPlaced: legal.length,
    fires: shot,
    trace,
  };
}
