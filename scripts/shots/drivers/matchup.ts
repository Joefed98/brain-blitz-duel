/**
 * Screenshot driver for Gemstone (`matchup`, Nov 2026): the mid-play frame plays real swaps through the canvas, so the
 * goals panel under the board shows goals part-way (and some met) on the stamp the practice round deals. The driver
 * keeps a copy of the run in the sim (the board only depends on the swaps, not their ticks), taps the game's own hint
 * swap (two taps: select, then the neighbour) and waits for the board to settle before the next.
 */
import type { Driver, DriverCtx } from "../driver";
import { matchupGameFor, matchupHintSwap, matchupTransform, matchupWorldH, MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_CELL_PX, MATCHUP_INPUT_SWAP, type MatchupState } from "../../../src/lib/arcade/matchup";

const CANVAS = "[data-game-arena='canvas'] canvas";
/** Swaps played before the mid-play frame. */
const SWAPS = 26;

async function tapCell(ctx: DriverCtx, row: number, col: number, worldH: number): Promise<void> {
  const box = await ctx.page.locator(CANVAS).first().boundingBox();
  if (!box) throw new Error("no arena canvas");
  const t = matchupTransform({ width: box.width, height: box.height }, worldH);
  const x = box.x + t.offsetX + (MATCHUP_BOARD_X + (col + 0.5) * MATCHUP_CELL_PX) * t.scale;
  const y = box.y + t.offsetY + (MATCHUP_BOARD_Y + (row + 0.5) * MATCHUP_CELL_PX) * t.scale;
  await ctx.page.mouse.click(x, y);
  await ctx.wait(60);
}

export const matchupDriver: Driver = {
  board: CANVAS,
  partial: async (ctx) => {
    const game = matchupGameFor(ctx.puzzle.matchupRev);
    let s = game.init(ctx.puzzle.seed) as MatchupState;
    const worldH = matchupWorldH(s);
    for (let k = 0; k < SWAPS; k++) {
      const h = matchupHintSwap(s);
      if (!h) break;
      await tapCell(ctx, h.row1, h.col1, worldH);
      await tapCell(ctx, h.row2, h.col2, worldH);
      s = game.step(s, { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: h.row1, b: h.col1, c: h.row2, d: h.col2 }) as MatchupState;
      const wait = Math.max(0, (s.busyUntil ?? s.tick) - s.tick);
      s = { ...s, tick: s.tick + wait };
      // The phone's own wait for the gems to fall, and a little more.
      await ctx.wait(Math.round((wait * 1000) / 60) + 250);
    }
    await ctx.wait(400);
  },
};
