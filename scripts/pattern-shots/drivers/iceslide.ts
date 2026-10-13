import { arrow, type Driver } from "../driver";

const moves = (full: { solution: string }) => full.solution.split("");
const half = (full: { solution: string }) => Number(process.env.ICE_FROM ?? Math.floor(moves(full).length / 2));

export const driver: Driver = {
  board: ".ice-board",
  mid: (full) => ({ slideMoves: moves(full).slice(0, half(full)) }),
  // ICE_FRAMES=<dir> plays a few more moves and saves frames of the slides (portals, cracks).
  midPlay: process.env.ICE_FRAMES
    ? async (page, full) => {
        let n = 0;
        const clip = (await page.locator("[data-game-stage] .ice-board").first().boundingBox()) ?? undefined;
        for (const dir of moves(full).slice(half(full), half(full) + 6)) {
          await arrow(page, dir);
          for (let i = 0; i < 8; i++) {
            await page.screenshot({ path: `${process.env.ICE_FRAMES}/f${String(n++).padStart(3, "0")}.png`, clip });
            await page.waitForTimeout(60);
          }
          await page.waitForTimeout(900);
        }
      }
    : undefined,
  nearSolved: (full) => ({ slideMoves: moves(full).slice(0, -1) }),
  finish: async (page, full) => {
    await arrow(page, moves(full).at(-1)!);
    // The submission waits for the slide animation to reach the exit.
    await page.waitForTimeout(700);
  },
};
