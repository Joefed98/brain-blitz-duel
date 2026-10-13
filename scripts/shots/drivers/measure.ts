import type { Page } from "playwright";
import type { Driver } from "../number-drivers";

/*
 * Brimful: the example's `solutions` are comma lists of F<i> (fill), E<i> (empty) and
 * P<i>-<j> (pour). The UI: tap jug i to select it, then Fill / Empty, or tap jug j to pour.
 * Jugs are found by their aria-label ("Jug 1: 0 of 3 litres"), buttons by their text.
 */
const stage = (page: Page) => page.locator("[data-game-stage]");
const jug = (page: Page, i: number) => stage(page).getByRole("button", { name: new RegExp(`^Jug ${i + 1}:`) }).first();

async function move(page: Page, token: string) {
  let m: RegExpExecArray | null;
  if ((m = /^([FE])(\d)$/.exec(token))) {
    await jug(page, Number(m[2])).click();
    await stage(page).getByRole("button", { name: m[1] === "F" ? "Fill" : "Empty", exact: true }).click();
  } else if ((m = /^P(\d)-(\d)$/.exec(token))) {
    await jug(page, Number(m[1])).click();
    await jug(page, Number(m[2])).click();
  } else throw new Error(`Brimful: unknown move ${token}`);
  await page.waitForTimeout(120);
}

const moves = (puzzle: Record<string, any>, board: number): string[] => String(puzzle.solutions[board]).split(",");
/** Plays board `index`'s moves, then (unless it is the last) waits for "Puzzle <next> of 4". */
async function play(page: Page, tokens: string[], index: number, last: boolean) {
  for (const t of tokens) await move(page, t);
  if (last) return;
  await stage(page).getByText(new RegExp(`Puzzle ${index + 2} of`)).first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
}

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    for (const t of moves(puzzle, 0).slice(0, 2)) await move(page, t);
  },
  solve: async ({ page, puzzle }) => {
    await play(page, moves(puzzle, 0).slice(2), 0, false);
    await play(page, moves(puzzle, 1), 1, false);
    await play(page, moves(puzzle, 2), 2, false);
    await play(page, moves(puzzle, 3), 3, true);
  },
  completeShotMs: 380,
};
