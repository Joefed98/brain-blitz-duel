import { arrow, type Driver } from "../driver";

const tilts = (full: { solution: string }) => full.solution.split("");

export const driver: Driver = {
  board: "[data-game-arena=\"board\"] > div",
  mid: (full) => ({ gravityTilts: tilts(full).slice(0, Math.floor(tilts(full).length / 2)) }),
  nearSolved: (full) => ({ gravityTilts: tilts(full).slice(0, -1) }),
  finish: async (page, full) => {
    await arrow(page, tilts(full).at(-1)!);
  },
};
