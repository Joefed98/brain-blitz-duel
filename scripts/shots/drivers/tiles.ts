import type { Driver } from "../driver";

// tilesRev 3 (the remodel): `jumbledMoves` stores slides as { kind, index, shift }; the stored route is numbers
// (index × 10 + shift, negative for a column), as jumbledSolutionMoves reads them.
type Move = { kind: "R" | "C"; index: number; shift: number };
const route = (full: { solution: number[] }): Move[] =>
  full.solution.map((n) => ({ kind: n < 0 ? "C" : "R", index: Math.floor(Math.abs(n) / 10), shift: Math.abs(n) % 10 }));
const lineLength = (m: Move) => (m.index === 0 || m.index === 4 ? 3 : 5);

export const driver: Driver = {
  board: "[data-jumbled-board]",
  seedMid: (full) => ({ jumbledMoves: route(full).slice(0, Math.floor(route(full).length / 2)) }),
  seedNearSolved: (full) => ({ jumbledMoves: route(full).slice(0, -1) }),
  solve: async ({ page, puzzle: full }) => {
    const last = route(full).at(-1)!;
    const box = (await page.locator("[data-game-stage] [data-jumbled-board]").first().boundingBox())!;
    const step = box.width / 5;
    // Grab the line at its middle tile (column / row 2 is in every line) and drag the shorter way round.
    const len = lineLength(last);
    const steps = last.shift <= len / 2 ? last.shift : last.shift - len;
    const x = box.x + (last.kind === "R" ? 2.5 : last.index + 0.5) * step;
    const y = box.y + (last.kind === "R" ? last.index + 0.5 : 2.5) * step;
    await page.mouse.move(x, y);
    await page.mouse.down();
    const dx = last.kind === "R" ? steps * step : 0;
    const dy = last.kind === "C" ? steps * step : 0;
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  },
};
