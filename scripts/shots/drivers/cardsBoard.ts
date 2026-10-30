/**
 * Screenshot drivers for Arcade's Cards & Board games (30 Oct 2026). Mid-play: the start of the deal's own perfect
 * order (scripts/cards-board-oracles.ts) tapped through the canvas, so the frame shows a real run; Minesweeper also
 * flags a mine with the Flag switch. The "full" reveal swaps in the whole oracle run (a 200) for the breakdown lines.
 */
import type { Driver, DriverCtx } from "../driver";
import { encodeOracle, mahjongOracle, minesOracle } from "../../cards-board-oracles";
import { minesBoard, minesCellX, minesCellY, MINES_CELL, MINES_WORLD_H, MINES_WORLD_W, MINES_HIDDEN, minesweeperGame } from "../../../src/lib/arcade/minesweeper";
import { mahjongSlotRect, MAHJONG_WORLD_H, MAHJONG_WORLD_W } from "../../../src/lib/arcade/mahjong";

const CANVAS = "[data-game-arena='canvas'] canvas";

async function tapWorld(ctx: DriverCtx, wx: number, wy: number, worldW: number, worldH: number): Promise<void> {
  const box = await ctx.page.locator(CANVAS).first().boundingBox();
  if (!box) throw new Error("no arena canvas");
  await ctx.page.mouse.click(box.x + (wx / worldW) * box.width, box.y + (wy / worldH) * box.height);
  await ctx.wait(90);
}

/** Presses an arena control button by its name (a pointer press at its centre, as a thumb does). */
async function pressButton(ctx: DriverCtx, name: string): Promise<void> {
  const box = await ctx.page.getByRole("button", { name, exact: true }).first().boundingBox();
  if (!box) throw new Error(`no ${name} button`);
  await ctx.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await ctx.wait(120);
}

export const minesweeperDriver: Driver = {
  board: CANVAS,
  partial: async (ctx) => {
    const seed = ctx.puzzle.seed as number;
    for (const e of minesOracle(seed).slice(0, 14)) await tapWorld(ctx, minesCellX(e.a) + MINES_CELL / 2, minesCellY(e.a) + MINES_CELL / 2, MINES_WORLD_W, MINES_WORLD_H);
    // A flag on a mine next to the opened area, with the Flag switch.
    const board = minesBoard(seed);
    const s = minesweeperGame.init(seed);
    const mine = board.mines.findIndex((m, c) => m && s.open[c] === MINES_HIDDEN && c > board.start);
    await pressButton(ctx, "Flag");
    await tapWorld(ctx, minesCellX(mine) + MINES_CELL / 2, minesCellY(mine) + MINES_CELL / 2, MINES_WORLD_W, MINES_WORLD_H);
    await pressButton(ctx, "Reveal");
    await ctx.wait(250);
  },
  answer: (puzzle) => encodeOracle(puzzle.seed, minesOracle(puzzle.seed, 1, 20), "minesweeper"),
};

export const mahjongDriver: Driver = {
  board: CANVAS,
  partial: async (ctx) => {
    const seed = ctx.puzzle.seed as number;
    for (const e of mahjongOracle(seed).slice(0, 17)) {
      const r = mahjongSlotRect(e.a);
      await tapWorld(ctx, r.x + r.w / 2, r.y + r.h / 2, MAHJONG_WORLD_W, MAHJONG_WORLD_H);
    }
    await ctx.wait(250);
  },
  answer: (puzzle) => encodeOracle(puzzle.seed, mahjongOracle(puzzle.seed, 1, 50), "mahjong"),
};
