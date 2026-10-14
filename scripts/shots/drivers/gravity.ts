import { arrow, type Driver } from "../driver";

const tilts = (full: { solution: string }) => full.solution.split("");

export const driver: Driver = {
  board: "[data-game-arena=\"board\"] > div",
  seedMid: (full) => ({ gravityTilts: tilts(full).slice(0, Math.floor(tilts(full).length / 2)) }),
  seedNearSolved: (full) => ({ gravityTilts: tilts(full).slice(0, -1) }),
  solve: async ({ page, puzzle: full }) => {
    await arrow(page, tilts(full).at(-1)!);
  },
};
