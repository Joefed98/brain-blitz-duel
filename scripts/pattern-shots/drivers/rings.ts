import type { Driver } from "../driver";

// `ringTaps` stores encoded taps: ring * 2 + (clockwise ? 0 : 1); ring 0 is the innermost.
// The final tap is played for real: tap the ring on the deck to select it, then the turn button.
const taps = (full: { solution: number[] }) => full.solution;

/** Share of the deck's half-width at the middle of each ring's band (record = 0.86 of half). */
const BAND = [0.25, 0.42, 0.58, 0.74, 0.9].map((r) => r * 0.86);

export const driver: Driver = {
  board: '[data-game-arena="board"] svg',
  mid: (full) => ({ ringTaps: taps(full).slice(0, Math.floor(taps(full).length / 2)) }),
  nearSolved: (full) => ({ ringTaps: taps(full).slice(0, -1) }),
  finish: async (page, full) => {
    const last = taps(full).at(-1)!;
    const ring = Math.floor(last / 2);
    const clockwise = last % 2 === 0;
    const box = await page
      .locator('[data-game-stage] [data-game-arena="board"] svg')
      .first()
      .boundingBox();
    if (!box) throw new Error("no deck");
    const half = box.width / 2;
    // Tap straight below the centre (clear of the tonearm in the top-right corner).
    await page.mouse.click(box.x + half, box.y + box.height / 2 + half * BAND[ring]!);
    await page.waitForTimeout(80);
    await page
      .getByRole("button", {
        name: clockwise ? "Rotate selected ring clockwise" : "Rotate selected ring anticlockwise",
        exact: true,
      })
      .first()
      .click();
  },
};
