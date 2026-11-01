import type { Page } from "playwright";
import type { Driver, DriverCtx } from "../driver";

/**
 * Cards & Board (Free Cell, Summit, Full House, Five Hands, Pyramid, Golf Solitaire, Muggins): a few real taps on the board for the mid-play frame. The board
 * ([data-play-area]) is the 414 × 772 world at a uniform scale, so world points map straight onto its box.
 */
const W = 414;
const H = 772;

async function tapWorld(page: Page, x: number, y: number) {
  const box = await page.locator("[data-play-area]").first().boundingBox();
  if (!box) throw new Error("no play area");
  await page.mouse.click(box.x + (x / W) * box.width, box.y + (y / H) * box.height);
}

async function taps({ page, wait }: DriverCtx, points: readonly (readonly [number, number])[], gapMs = 450) {
  for (const [x, y] of points) {
    await tapWorld(page, x, y);
    await wait(gapMs);
  }
}

/** FreeCell: the top cards of each column in turn (each tap sends a card to its best spot). */
const freecell: Driver = {
  board: "[data-play-area]",
  // Columns 48 wide on a 3.3 gap from y 126, 40 a card: the top card of a 7-card column at 366, of a 6-card one at 326.
  partial: (ctx) => taps(ctx, [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 4, 6].map((c, k) => [3.33 + c * 51.33 + 24, k < 4 && c < 4 ? 400 : 360] as const)),
};

/** TriPeaks: across the face-up bottom row, then the stock, twice. */
const tripeaks: Driver = {
  board: "[data-play-area]",
  // The bottom row's ten cards (39 × 70, 40.8 apart from x 4, at y 346) and the stock (74 × 104 at 84, 636).
  partial: (ctx) => taps(ctx, [...Array.from({ length: 10 }, (_, j) => [4 + j * 40.78 + 19.5, 380] as const), [121, 688], ...Array.from({ length: 10 }, (_, j) => [4 + j * 40.78 + 19.5, 380] as const), [121, 688]], 350),
};

/** Poker Squares: twelve cards placed across the top rows. */
const pokersquares: Driver = {
  board: "[data-play-area]",
  partial: (ctx) => taps(ctx, Array.from({ length: 12 }, (_, sq) => [8 + (sq % 5) * 68 + 31, 44 + Math.floor(sq / 5) * 92 + 43] as const), 400),
};

/** Five Hands: nine cards, each tapped onto the first open row (rows 86 apart from y 44; a tap mid-row). */
const fivehands: Driver = {
  board: "[data-play-area]",
  partial: (ctx) => taps(ctx, [0, 1, 2, 3, 4, 2, 0, 4, 1].map((r) => [160, 44 + r * 86 + 40] as const), 450),
};

/** Pyramid: across the bottom row (cards 54 × 78, 57 apart, centred, at y 346), then the stock (84 × 120 at 64, 520). */
const pyramid: Driver = {
  board: "[data-play-area]",
  partial: (ctx) => taps(ctx, [...Array.from({ length: 7 }, (_, j) => [207 - 199.5 + j * 57 + 27, 400] as const), [106, 580], ...Array.from({ length: 7 }, (_, j) => [207 - 199.5 + j * 57 + 27, 400] as const)], 380),
};

/** Golf Solitaire: each column's bottom card (55 × 80, 57 apart from x 8.5, the fifth at y 230), the stock, again. */
const golfsol: Driver = {
  board: "[data-play-area]",
  partial: (ctx) => taps(ctx, [...Array.from({ length: 7 }, (_, c) => [8.5 + c * 57 + 27, 290] as const), [102, 550], ...Array.from({ length: 7 }, (_, c) => [8.5 + c * 57 + 27, 290] as const)], 380),
};

/** Muggins: pick each hand tile in turn and press Play (on its better end); Draw when nothing fits. */
const muggins: Driver = {
  board: "[data-play-area]",
  partial: (ctx) => taps(ctx, [0, 1, 2, 3, 4, 5, 6].flatMap((k) => [[207 - 3.5 * 54 + k * 54 + 22, 535] as const, [326, 725] as const, [110, 725] as const]), 380),
};

export const CARD_DRIVERS: Record<string, Driver> = { freecell, tripeaks, pokersquares, fivehands, pyramid, golfsol, muggins };
