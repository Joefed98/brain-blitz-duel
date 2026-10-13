import type { Page } from "playwright";
import { numlineShare, numlineValue } from "@/lib/duel/numline";
import type { Driver } from "../number-drivers";

const stage = (page: Page) => page.locator("[data-game-stage]");
/** Matches the Stage's SIDE inset: shares map onto the arena width minus 22 px each side. */
const SIDE = 22;

/* Ballpark: touch the line at the value's true share (the arena maps clientX to a share), then Place. */
async function placeAt(page: Page, share: number) {
  const arena = stage(page).locator('[data-game-arena="board"]').first();
  const box = await arena.boundingBox();
  if (!box) throw new Error("Ballpark: no arena");
  const x = box.x + SIDE + share * (box.width - 2 * SIDE);
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 0.4, y);
  await page.mouse.move(x, y);
  await page.mouse.up();
  await page.waitForTimeout(120);
  await stage(page).getByRole("button", { name: /^place$/i }).click();
  await page.waitForTimeout(260);
}

/** True shares in play order, from the full example (values are server-only in the app). */
function shares(puzzle: Record<string, any>): number[] {
  const out: number[] = [];
  puzzle.stages.forEach((s: { lo: number; hi: number }, i: number) => {
    for (const v of puzzle.values[i]) out.push(numlineShare(s, numlineValue(v)));
  });
  return out;
}

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    for (const s of shares(puzzle).slice(0, 3)) await placeAt(page, s);
  },
  solve: async ({ page, puzzle }) => {
    for (const s of shares(puzzle).slice(3)) await placeAt(page, s);
  },
  completeShotMs: 450,
};
