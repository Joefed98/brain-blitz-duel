/**
 * Labyrinth's keyed level mazes (D3, 22 Nov 2026; mazeKeys.ts): a level maze (generateMazeLevel) with its keys at the
 * tips of dead ends, kept only when the shortest walk from the start through every key to the exit lies in the level's
 * range. Expert puts one key in each quarter of the maze. Server-only (the deal's seeded randomness).
 */
import { mazeCorridorNeighbours } from "./maze";
import { generateMazeLevel, type MazeLevers } from "./maze.server";
import { mazeTourSteps } from "./mazeKeys";
import type { MazePuzzleData } from "./types";

export interface MazeKeyLevers extends MazeLevers {
  keys: number;
  tourMin: number;
  tourMax: number;
  keysByQuarter?: boolean;
}

/** The quarter (0–3: top left, top right, bottom left, bottom right) a cell lies in. */
export function mazeQuarterOf(cell: number, cols: number, rows: number): number {
  return (Math.floor(cell / cols) < rows / 2 ? 0 : 2) + (cell % cols < cols / 2 ? 0 : 1);
}

/** A level maze with `keys` gold keys at dead-end tips, its shortest key walk in [tourMin, tourMax] (stored as `par`). */
export function generateMazeKeysLevel(l: MazeKeyLevers): MazePuzzleData & { keys: number[]; par: number } {
  for (let attempt = 0; attempt < 400; attempt++) {
    const maze = generateMazeLevel(l);
    const cols = l.cols;
    const route = new Set(maze.solution ?? []);
    const tips: number[] = [];
    for (let c = 0; c < maze.cells.length; c++) {
      if (c === maze.start || c === maze.exit || route.has(c)) continue;
      if (mazeCorridorNeighbours(maze.cells, c, cols).length === 1) tips.push(c);
    }
    const byQuarter = [0, 1, 2, 3].map((q) => tips.filter((t) => mazeQuarterOf(t, cols, l.rows) === q));
    if (l.keysByQuarter && byQuarter.some((q) => q.length === 0)) continue;
    if (tips.length < l.keys) continue;
    for (let tries = 0; tries < 300; tries++) {
      const keys: number[] = [];
      if (l.keysByQuarter) for (const q of byQuarter.slice(0, l.keys)) keys.push(q[Math.floor(Math.random() * q.length)]!);
      else while (keys.length < l.keys) {
        const t = tips[Math.floor(Math.random() * tips.length)]!;
        if (!keys.includes(t)) keys.push(t);
      }
      const tour = mazeTourSteps(maze.cells, cols, maze.start, keys, maze.exit);
      if (tour >= l.tourMin && tour <= l.tourMax) return { ...maze, keys: [...keys].sort((a, b) => a - b), par: tour };
    }
  }
  throw new Error("Maze generator could not place the level's keys");
}
