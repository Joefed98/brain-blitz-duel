import { arrow, type Driver } from "../driver";

// gravityRev 3 (the remodel): the tilt list runs across the three boards; `boardSolutions` holds each board's
// shortest all-stars route (server-only, read here from the full example).
const routes = (full: { boardSolutions?: string[]; solution: string }) => full.boardSolutions ?? [full.solution];
const all = (full: { boardSolutions?: string[]; solution: string }) => routes(full).join("").split("");

export const driver: Driver = {
  board: "[data-topsy-board]",
  // Mid-play: board 1 cleared, board 2 half played (the rings part filled).
  seedMid: (full) => {
    const [first = "", second = ""] = routes(full);
    return { topsyTilts: [...first.split(""), ...second.split("").slice(0, Math.floor(second.length / 2))] };
  },
  seedNearSolved: (full) => ({ topsyTilts: all(full).slice(0, -1) }),
  solve: async ({ page, puzzle: full }) => {
    // The last board shows after the cleared one's hold.
    await page.waitForTimeout(1100);
    await arrow(page, all(full).at(-1)!);
  },
};
