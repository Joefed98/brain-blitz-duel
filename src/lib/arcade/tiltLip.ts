/**
 * Tilt's pit lip (the Strategy overhaul, stage 2; display and sound only): whether a marble's centre is on a black
 * hole's edge without falling in, read from the maze's own pit squares (each a quarter-cell square round its cell's
 * centre, as drawPits draws and the sim tests). The renderer wobbles the marble there; the sound observer plays the
 * wobble once as it arrives. Nothing here writes a sim.
 */
import type { Maze } from "./tilt";

const FP = 256;

/** The pit whose lip the point (maze px, centred on the maze) is on, or -1. */
export function tiltPitLip(m: Maze, x: number, y: number, marbleR: number): number {
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  const pr = cs / 4;
  for (const p of m.pits) {
    const px = (p % m.n) * cs + cs / 2 - o;
    const py = Math.trunc(p / m.n) * cs + cs / 2 - o;
    const d = Math.max(Math.abs(x - px), Math.abs(y - py));
    if (d >= pr && d < pr + marbleR * 0.9) return p;
  }
  return -1;
}
