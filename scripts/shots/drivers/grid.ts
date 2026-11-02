/**
 * Screenshot drivers for the four grid puzzles (1 Nov 2026): Fences, Fillomino, Bridges and Kakuro. Each seeds half the
 * solution for the mid-play frame and all but one item for the solve, then plays the last item through the real UI.
 */
import type { Page } from "playwright";

import { bridgePairs } from "../../../src/lib/duel/bridges";
import { edgeDots, fencesEdgeCount, FENCES_LINE } from "../../../src/lib/duel/fences";
import type { Driver, FullPuzzle } from "../driver";

const half = <T,>(items: readonly T[]) => items.slice(0, Math.max(1, Math.floor(items.length / 2)));

async function svgPoint(page: Page, selector: string, vb: number, x: number, y: number) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const s = Math.min(box.width, box.height) / vb;
  return { x: box.x + (box.width - vb * s) / 2 + x * s, y: box.y + (box.height - vb * s) / 2 + y * s };
}

/* Fences: 100 SVG units a cell, 22 round the dots (fences.tsx). */
const FU = 100;
const FPAD = 22;
const fencesStates = (p: FullPuzzle, edges: readonly number[]) => {
  const on = new Set(edges);
  return Array.from({ length: fencesEdgeCount(p.size) }, (_, e) => (on.has(e) ? FENCES_LINE : 0));
};
const fences: Driver = {
  board: "[data-logic-stage='fences'] svg",
  seedMid: (p) => ({ fencesEdges: fencesStates(p, half(p.solution as number[])) }),
  seedNearSolved: (p) => ({ fencesEdges: fencesStates(p, (p.solution as number[]).slice(0, -1)) }),
  solve: async ({ page, puzzle }) => {
    const size = puzzle.size as number;
    const [a, b] = edgeDots(size, (puzzle.solution as number[]).at(-1)!);
    const xy = (d: number) => [FPAD + (d % (size + 1)) * FU, FPAD + Math.floor(d / (size + 1)) * FU];
    const [ax, ay] = xy(a);
    const [bx, by] = xy(b);
    const at = await svgPoint(page, "[data-logic-stage='fences'] svg", size * FU + 2 * FPAD, (ax! + bx!) / 2, (ay! + by!) / 2);
    await page.mouse.click(at.x, at.y);
  },
  solveShotsMs: [120, 450, 850],
};

/* Fillomino: blanks numbered from the solution; the last blank by tap and pad. */
const blanks = (p: FullPuzzle) => (p.givens as number[]).flatMap((g, i) => (g ? [] : [i]));
const fillValues = (p: FullPuzzle, cells: readonly number[]) => {
  const on = new Set(cells);
  return (p.solution as number[]).map((v, i) => (on.has(i) ? v : 0));
};
const fillomino: Driver = {
  board: "[data-logic-stage='fillomino'] [data-cell]",
  seedMid: (p) => ({ fillominoValues: fillValues(p, half(blanks(p))) }),
  seedNearSolved: (p) => ({ fillominoValues: fillValues(p, blanks(p).slice(0, -1)) }),
  solve: async ({ page, puzzle, wait }) => {
    const last = blanks(puzzle).at(-1)!;
    await page.locator(`[data-logic-stage='fillomino'] [data-cell="${last}"]`).first().click();
    await wait(120);
    await page.locator("[data-game-controls] button", { hasText: new RegExp(`^${(puzzle.solution as number[])[last]}$`) }).first().click();
  },
  solveShotsMs: [120, 450, 850],
};

/* Bridges: 100 SVG units a cell (bridges.tsx); the last pair by a drag island to island. */
const built = (p: FullPuzzle, upto: number) => (p.solution as number[]).map((k, i) => (i < upto ? k : 0));
const lastPair = (p: FullPuzzle) => (p.solution as number[]).reduce((last, k, i) => (k ? i : last), -1);
const bridges: Driver = {
  board: "[data-logic-stage='bridges'] svg",
  seedMid: (p) => ({ bridgesCounts: built(p, Math.floor((p.solution as number[]).length / 2)) }),
  seedNearSolved: (p) => {
    const counts = built(p, (p.solution as number[]).length);
    counts[lastPair(p)] = 0;
    return { bridgesCounts: counts };
  },
  solve: async ({ page, puzzle, wait }) => {
    const size = puzzle.size as number;
    const pair = bridgePairs(puzzle.islands, size)[lastPair(puzzle)]!;
    const times = (puzzle.solution as number[])[lastPair(puzzle)]!;
    const centre = (cell: number) => svgPoint(page, "[data-logic-stage='bridges'] svg", size * 100, (cell % size) * 100 + 50, Math.floor(cell / size) * 100 + 50);
    const a = await centre(puzzle.islands[pair.a].cell);
    const b = await centre(puzzle.islands[pair.b].cell);
    for (let i = 0; i < times; i++) {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
      await page.mouse.move(b.x, b.y, { steps: 4 });
      await page.mouse.up();
      await wait(200);
    }
  },
  solveShotsMs: [120, 450, 850],
};

/* Kakuro: white squares from the solution; the last by tap and pad. */
const kakuroValues = (p: FullPuzzle, cells: readonly number[]) => {
  const on = new Set(cells);
  return (p.solution as number[]).map((v, i) => (on.has(i) ? v : 0));
};
const kakuro: Driver = {
  board: "[data-logic-stage='kakuro'] [data-kakuro-cell]",
  seedMid: (p) => ({ kakuroValues: kakuroValues(p, half(p.white as number[])) }),
  seedNearSolved: (p) => ({ kakuroValues: kakuroValues(p, (p.white as number[]).slice(0, -1)) }),
  solve: async ({ page, puzzle, wait }) => {
    const last = (puzzle.white as number[]).at(-1)!;
    await page.locator(`[data-kakuro-cell="${last}"]`).first().click();
    await wait(120);
    await page.locator("[data-game-controls] button", { hasText: new RegExp(`^${(puzzle.solution as number[])[last]}$`) }).first().click();
  },
  solveShotsMs: [120, 450, 850],
};

export const GRID_DRIVERS: Record<string, Driver> = { fences, fillomino, bridges, kakuro };
