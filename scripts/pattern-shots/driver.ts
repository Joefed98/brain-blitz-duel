import type { Page } from "playwright";

/** The full intro example (with its server-side solution), from examples.ts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FullPuzzle = any;

/**
 * How the capture tool plays one game. Stage-state seeds are written with the
 * real `useStageState` hook before Ready (scripts/pattern-shots/seed.tsx), so
 * the Stage starts from that position; `finish` then makes the real inputs
 * that complete the solve. Games with component-local state seed nothing and
 * play every move in `finish`.
 */
export interface Driver {
  /** The drawn board, for the gap measurement. */
  board: string;
  /** Stage-state values for the mid-play shot. */
  mid?: (full: FullPuzzle) => Record<string, unknown>;
  /** Real inputs for the mid-play shot (after any `mid` seed). */
  midPlay?: (page: Page, full: FullPuzzle) => Promise<void>;
  /** Stage-state values one step short of the solve. */
  nearSolved?: (full: FullPuzzle) => Record<string, unknown>;
  /** Real inputs that finish the solve. Resolves on the solving input. */
  finish: (page: Page, full: FullPuzzle) => Promise<void>;
}

/** Presses one ArrowPad direction (the default arrows mode). */
export async function arrow(page: Page, dir: string) {
  const name = { U: "Up", D: "Down", L: "Left", R: "Right" }[dir] ?? dir;
  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Centre of grid cell `cell` inside `selector`'s box, for a cols × rows grid. */
export async function cellCentre(page: Page, selector: string, cell: number, cols: number, rows = cols) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  return { x: box.x + ((col + 0.5) * box.width) / cols, y: box.y + ((row + 0.5) * box.height) / rows };
}

/** A pointer drag through the given points, in small steps. */
export async function drag(page: Page, points: { x: number; y: number }[], stepMs = 16) {
  const [first, ...rest] = points;
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  let at = first;
  for (const next of rest) {
    for (let k = 1; k <= 4; k++) {
      await page.mouse.move(at.x + ((next.x - at.x) * k) / 4, at.y + ((next.y - at.y) * k) / 4);
      if (stepMs) await page.waitForTimeout(stepMs);
    }
    at = next;
  }
  await page.mouse.up();
}
