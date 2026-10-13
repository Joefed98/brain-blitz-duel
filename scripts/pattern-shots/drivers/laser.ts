import type { Driver } from "../driver";
import { traceBeam } from "../../../src/lib/duel/laser";
import { LASER_BEAM_MS } from "../../../src/lib/duel/types";

type Piece = { cell: number; kind: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pieces = (full: any): Piece[] => full.solution;

/** How long the Stage's travelling beam takes before it submits (mirrors laser.tsx's timing). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function beamMs(full: any): number {
  const paths = traceBeam(full.source, full.dir, full.solution, full.blocks, full.bombs, full.gems, full.splitters ?? [], full.directionalGems ?? []).paths;
  const offsets: number[] = [];
  paths.forEach((path, index) => {
    if (index === 0) return void offsets.push(0);
    for (let parent = index - 1; parent >= 0; parent--) {
      const position = paths[parent]?.indexOf(path[0]!) ?? -1;
      if (position >= 0) return void offsets.push(offsets[parent]! + position);
    }
    offsets.push(0);
  });
  const lastStep = Math.max(0, ...paths.map((path, i) => (offsets[i] ?? 0) + path.length - 1));
  const per = 2 * Math.max(30, Math.round((LASER_BEAM_MS * 1.25) / Math.max(1, lastStep)));
  return per * Math.max(1, lastStep);
}

export const driver: Driver = {
  board: '[data-polish="laser"] [data-game-arena] > div',
  mid: (full) => {
    const some = pieces(full).slice(0, Math.ceil(pieces(full).length / 2));
    return { mirrors: some, history: some.map((p) => p.cell), fires: 0 };
  },
  nearSolved: (full) => ({ mirrors: pieces(full), history: pieces(full).map((p) => p.cell), fires: 0 }),
  finish: async (page, full) => {
    await page.getByRole("button", { name: "Fire", exact: true }).first().click();
    // Pressing Fire starts the travelling beam; the solve lands when it reaches its last cell.
    await page.waitForTimeout(beamMs(full) + 30);
  },
};
