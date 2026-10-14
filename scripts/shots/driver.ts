/**
 * Game drivers for the screenshot tool (scripts/shots/capture.ts). A driver is optional:
 * a game without one still gets its intro, an untouched mid-play frame, its completion
 * effect through the dev preview hooks, and a timed-out reveal. With one, the tool plays
 * it for real through the UI:
 *
 *   mid-play  seedMid (stage state written before Ready), then partial (real inputs);
 *   solve     solve finishes the fixed intro example and resolves on the solving input.
 *             It continues the mid-play run, unless the driver sets seedNearSolved (a
 *             fresh run seeded one step short) or solveFromStart (a fresh run that plays
 *             every move inside solve).
 *
 * Stage-state seeds go through the real `useStageState` hook (scripts/shots/seed.tsx),
 * so only games that keep their position there can be seeded.
 */
import type { Page } from "playwright";

/** The full intro example, solution included (built by examples.ts, never sent by the app). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FullPuzzle = any;

export interface DriverCtx {
  page: Page;
  puzzle: FullPuzzle;
  wait: (ms: number) => Promise<void>;
}

export interface Driver {
  /** The drawn board, for the board-gap measurement (the nearest thing above it and the first control below). */
  board?: string;
  /** Stage-state values for the mid-play frame, written before Ready. */
  seedMid?: (puzzle: FullPuzzle) => Record<string, unknown>;
  /** Real inputs for the mid-play frame (after any seedMid). */
  partial?: (ctx: DriverCtx) => Promise<void>;
  /** Stage-state values one step short of the solve; the solve then runs in a fresh, seeded run. */
  seedNearSolved?: (puzzle: FullPuzzle) => Record<string, unknown>;
  /** The solve plays every move itself, in a fresh run. */
  solveFromStart?: boolean;
  /** Real inputs that finish the puzzle; resolves on the solving input. */
  solve?: (ctx: DriverCtx) => Promise<void>;
  /** Completion frames, ms after the solving input (default 150, 500, 900). */
  solveShotsMs?: number[];
  /** Plays the completion effect on the board as it stands (games the tool cannot solve). */
  fx?: (ctx: DriverCtx) => Promise<void>;
  /** A full answer swapped into the practice grade request, for the "full" reveal (layout stress test). */
  answer?: (puzzle: FullPuzzle) => string | null;
}

export const STAGE = "[data-game-stage]";

/** Presses one ArrowPad direction (the default arrows mode). */
export async function arrow(page: Page, dir: string) {
  const name = { U: "Up", D: "Down", L: "Left", R: "Right" }[dir] ?? dir;
  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Centre of grid cell `cell` inside `selector`'s box, for a cols × rows grid. */
export async function cellCentre(
  page: Page,
  selector: string,
  cell: number,
  cols: number,
  rows = cols,
) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  return {
    x: box.x + ((col + 0.5) * box.width) / cols,
    y: box.y + ((row + 0.5) * box.height) / rows,
  };
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

/** A press and release at the centre of the nth match (pointer handlers that act on pointerdown). */
export async function press(page: Page, selector: string, nth = 0, settle = 140) {
  const box = await page.locator(selector).nth(nth).boundingBox();
  if (!box) throw new Error(`no ${selector} #${nth}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(settle);
}

/** A real click on the nth match, then a short settle. */
export async function click(page: Page, selector: string, nth = 0, settle = 140) {
  await page.locator(selector).nth(nth).click();
  await page.waitForTimeout(settle);
}
