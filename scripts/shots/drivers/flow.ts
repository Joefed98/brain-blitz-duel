import { cellCentre, drag, type Driver } from "../driver";

const BOARD = '[data-polish="flow"] [data-game-arena] > div';
const solution = (full: { solution: number[][] }) => full.solution;

export const driver: Driver = {
  board: BOARD,
  seedMid: (full) => ({ flowPaths: solution(full).map((path, i) => (i % 2 === 0 ? path : [])) }),
  // Every path but the first; the first is drawn for real in `solve`.
  seedNearSolved: (full) => ({ flowPaths: solution(full).map((path, i) => (i === 0 ? [] : path)) }),
  solve: async ({ page, puzzle: full }) => {
    const points = [];
    for (const cell of solution(full)[0]!) points.push(await cellCentre(page, BOARD, cell, 9));
    await drag(page, points);
  },
};
