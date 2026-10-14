import type { Page } from "playwright";

import { orientationOffsets } from "../../../src/lib/duel/blockParty";
import { BLOCK_COLS as N, type BlockPlacement } from "../../../src/lib/duel/types";
import { drag, type Driver, type FullPuzzle } from "../driver";

const BOARD = '[data-game-arena="fixed"] > div';

const key = (cells: [number, number][]) =>
  [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([r, c]) => `${r},${c}`).join(" ");

/** The tap sequence (rotations, and a flip as a quick double tap) that turns a tray piece into this placement. */
function poseFor(placement: BlockPlacement) {
  const rows = placement.cells.map((cell) => Math.floor(cell / N));
  const cols = placement.cells.map((cell) => cell % N);
  const minR = Math.min(...rows);
  const minC = Math.min(...cols);
  const wanted = key(placement.cells.map((cell) => [Math.floor(cell / N) - minR, (cell % N) - minC]));
  for (const flip of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      if (key(orientationOffsets(placement.piece, rot, flip)) === wanted) return { flip, rot, minR, minC };
    }
  }
  throw new Error(`no pose for piece ${placement.piece}`);
}

/** Centre of glyph cell `index` of a tray piece (container > lift wrapper > glyph > cells). */
async function trayCell(page: Page, piece: number, index: number) {
  const box = await page
    .locator(`[aria-label="Piece ${piece + 1}"] > div > div > div:nth-child(${index + 1})`)
    .first()
    .boundingBox();
  if (!box) throw new Error(`no tray cell ${piece}/${index}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function tap(page: Page, piece: number) {
  const at = await trayCell(page, piece, 0);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
}

/** Places solution pieces 0..count-1 with real taps and drags (state is component-local). */
async function play(page: Page, full: FullPuzzle, count: number) {
  for (const placement of (full.solution as BlockPlacement[]).slice(0, count)) {
    const { flip, rot, minR, minC } = poseFor(placement);
    let current = 0;
    if (flip) {
      await tap(page, placement.piece);
      await page.waitForTimeout(90);
      await tap(page, placement.piece); // double tap: flip (the first tap turned it once)
      current = 1;
      await page.waitForTimeout(380);
    }
    while (current % 4 !== rot) {
      await tap(page, placement.piece);
      current += 1;
      await page.waitForTimeout(380);
    }
    const offsets = orientationOffsets(placement.piece, rot, flip);
    const [grabR, grabC] = offsets[0]!;
    const from = await trayCell(page, placement.piece, 0);
    const box = (await page.locator(BOARD).first().boundingBox())!;
    const cell = box.width / N;
    const to = { x: box.x + (minC + grabC + 0.5) * cell, y: box.y + (minR + grabR + 0.5) * cell };
    await drag(page, [from, to], 12);
    await page.waitForTimeout(280);
  }
}

export const driver: Driver = {
  solveFromStart: true,
  board: BOARD,
  partial: ({ page, puzzle: full }) => play(page, full, 4),
  solve: async ({ page, puzzle: full }) => {
    const all = full.solution as BlockPlacement[];
    await play(page, { ...full, solution: all.slice(0, -1) }, all.length - 1);
    // The last piece: resolve on its release (the solving drop).
    const last = all.at(-1)!;
    const { flip, rot, minR, minC } = poseFor(last);
    let current = 0;
    if (flip) {
      await tap(page, last.piece);
      await page.waitForTimeout(90);
      await tap(page, last.piece);
      current = 1;
      await page.waitForTimeout(380);
    }
    while (current % 4 !== rot) {
      await tap(page, last.piece);
      current += 1;
      await page.waitForTimeout(380);
    }
    const [grabR, grabC] = orientationOffsets(last.piece, rot, flip)[0]!;
    const from = await trayCell(page, last.piece, 0);
    const box = (await page.locator(BOARD).first().boundingBox())!;
    const cell = box.width / N;
    await drag(page, [from, { x: box.x + (minC + grabC + 0.5) * cell, y: box.y + (minR + grabR + 0.5) * cell }], 12);
  },
};
