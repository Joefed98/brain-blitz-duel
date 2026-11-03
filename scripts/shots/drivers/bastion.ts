/**
 * Screenshot driver for Iron Wall (id bastion; bastionRev 2 and 3). Mid-play: wave 1 rolls in, then three aimed drags
 * and lifts at the tanks' lanes (through the canvas, a mouse as the capture tool's pointer, so the crosshair sits on
 * it); on bastionRev 3 it then waits for the first drone to cross the sky and holds the crosshair just ahead of it, so
 * the frame shows the drone, the scenery, tanks, shells and landings. The "full" reveal swaps in the oracle's run (a 200)
 * on the puzzle's own stamp.
 */
import type { Driver, DriverCtx } from "../driver";
import { BT2_CHECKPOINT_INTERVAL, BT2_WORLD_H, BT2_WORLD_W, bastionDronePos, bastionDrones, bastionTankCheckpoint, bastionTankGameFor, BASTION_REV_IRON } from "../../../src/lib/arcade/bastionTank";
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
    await ctx.wait(4800);
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
    const rev = (ctx.puzzle.bastionRev as number | undefined) ?? 2;
    if (rev >= BASTION_REV_IRON) {
      // The first drone, about a third of the way across: the crosshair just ahead of it.
      // Synced to the round's timer ring (it reads about 2.4 s ahead of the sim's clock, in whole seconds).
      const d = bastionDrones(ctx.puzzle.seed as number)[0]!;
      const tick = d.at + 40;
      const want = Math.ceil(63 - 2.4 - tick / 60);
      await ctx.page.waitForFunction((w) => {
        const el = document.querySelector("[aria-label$='seconds remaining']");
        const n = el ? Number.parseInt(el.getAttribute("aria-label") ?? "", 10) : NaN;
        return Number.isFinite(n) && n <= w;
      }, want, { timeout: 30_000, polling: 50 });
      const pos = bastionDronePos(d, Math.round((63 - 2.4 - want) * 60) + 30)!;
      const p = await at(ctx, pos.x, pos.y);
      await ctx.page.mouse.move(p.x, p.y, { steps: 3 });
      await ctx.wait(60);
      return;
    }
    const p = await at(ctx, 200, 400);
    await ctx.page.mouse.move(p.x, p.y, { steps: 4 });
    await ctx.wait(150);
  },
  answer: (puzzle) => {
    const seed = puzzle.seed as number;
    const rev = (puzzle.bastionRev as number | undefined) ?? 2;
    const game = bastionTankGameFor(rev);
    const events = bastionOracleRun(seed, rev);
    const s = bastionPlayLog(seed, events, rev);
    const at = new Map(events.map((e) => [e.t, e]));
    const checkpoints = [];
    for (let r = game.init(seed); !game.isOver(r); ) {
      r = game.step(r, at.get(r.tick + 1) ?? null);
      if (r.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(r));
    }
    return encodeBastionTankRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  },
};
