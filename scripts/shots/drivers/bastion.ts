/**
 * Screenshot driver for Bastion (bastionRev 2). Mid-play: wave 1 rolls in, then three aimed drags and lifts at the
 * tanks' lanes (through the canvas, a mouse as the capture tool's pointer, so the crosshair sits on it), the last one
 * held so the frame shows the crosshair, shells and landings. The "full" reveal swaps in the oracle's run (a 200).
 */
import type { Driver, DriverCtx } from "../driver";
import { BT2_CHECKPOINT_INTERVAL, BT2_WORLD_H, BT2_WORLD_W, bastionTankCheckpoint, bastionTankGame } from "../../../src/lib/arcade/bastionTank";
import { encodeBastionTankRun } from "../../../src/lib/duel/bastion";
import { bastionOracleRun, bastionPlayLog } from "../../bastion-oracle";

const CANVAS = "[data-game-arena='canvas'] canvas";

async function at(ctx: DriverCtx, wx: number, wy: number) {
  const box = await ctx.page.locator(CANVAS).first().boundingBox();
  if (!box) throw new Error("no arena canvas");
  return { x: box.x + (wx / BT2_WORLD_W) * box.width, y: box.y + (wy / BT2_WORLD_H) * box.height };
}

export const bastionDriver: Driver = {
  board: CANVAS,
  partial: async (ctx) => {
    await ctx.wait(5200);
    for (const [x, y] of [
      [100, 380],
      [195, 360],
      [290, 370],
    ] as const) {
      const p = await at(ctx, x, y);
      await ctx.page.mouse.move(p.x - 30, p.y + 40);
      await ctx.page.mouse.down();
      await ctx.page.mouse.move(p.x, p.y, { steps: 6 });
      await ctx.page.mouse.up();
      await ctx.wait(330);
    }
    const p = await at(ctx, 200, 400);
    await ctx.page.mouse.move(p.x, p.y, { steps: 4 });
    await ctx.wait(150);
  },
  answer: (puzzle) => {
    const seed = puzzle.seed as number;
    const events = bastionOracleRun(seed);
    const s = bastionPlayLog(seed, events);
    const at = new Map(events.map((e) => [e.t, e]));
    const checkpoints = [];
    for (let r = bastionTankGame.init(seed); !bastionTankGame.isOver(r); ) {
      r = bastionTankGame.step(r, at.get(r.tick + 1) ?? null);
      if (r.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(r));
    }
    return encodeBastionTankRun({ seed, claimedScore: bastionTankGame.score(s), events, endTick: s.tick, checkpoints });
  },
};
