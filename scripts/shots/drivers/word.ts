/**
 * The ten Word games (from the Word polish captures, #45): a few honest inputs for
 * mid-play, the completion effect through the dev `duelz-dev-word-finish` event on the
 * board as it stands, and a full answer for the "full" reveal.
 */
import type { Page } from "playwright";

import { wordAnswer } from "../word-answers";
import type { Driver, FullPuzzle } from "../driver";

/** The drawn play area of each game (union of matches). */
const BOARD: Record<string, string> = {
  wordsmith: "[data-game-stage] .wordsmith-ring",
  wordhunt: "[data-game-stage] .puzzle-board",
  tilegrid: '[data-game-stage] [aria-label="Interlock board"]',
  wordslide: '[data-game-stage] [data-game-arena="fixed"]',
  wordsearch: "[data-game-stage] [data-play-area]",
  letterwheel:
    '[data-game-stage] [data-arena-part="letterwheel-board"] > div, [data-game-stage] [data-play-area]',
  strikeout: '[data-game-stage] [data-game-arena="strikeout"] > div',
  codeword: '[data-game-stage] [data-game-arena="codeword"] > div',
  swapword: '[data-game-stage] [aria-label="Swapword board"]',
  wordfall: "[data-game-stage] canvas",
};

async function centre(page: Page, selector: string, index = 0): Promise<[number, number] | null> {
  const box = await page.locator(selector).nth(index).boundingBox();
  return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
}
async function tap(page: Page, selector: string, index = 0) {
  const c = await centre(page, selector, index);
  if (c) await page.mouse.click(c[0], c[1]);
  await page.waitForTimeout(160);
}

/** A few honest inputs so mid-play shows a board in use. */
async function midPlay(page: Page, game: string, puzzle: FullPuzzle) {
  switch (game) {
    case "wordsmith":
      for (const i of [4, 0, 2]) await tap(page, `[data-wordsmith-tile="${i}"]`);
      break;
    case "wordhunt":
      await tap(page, "[data-cell]", 0);
      await tap(page, "[data-cell]", 1);
      break;
    case "tilegrid": {
      // Place the example solution's first across word (a real word, so it can light up).
      const grid = wordAnswer(puzzle) ?? "";
      const rows = grid.match(/.{7}/g) ?? [];
      const row = rows.findIndex((r) => /[A-Z]{3,}/.test(r));
      const m = row >= 0 ? /[A-Z]{3,}/.exec(rows[row]!.replace(/\./g, " ")) : null;
      if (m)
        for (let i = 0; i < m[0].length; i++) {
          await page
            .locator('[data-game-controls="tray"] .word-letter-tile', {
              hasText: new RegExp(`^${m[0][i]}$`),
            })
            .first()
            .click();
          await page.waitForTimeout(120);
          await tap(page, ".interlock-cell", row * 7 + m.index + i);
        }
      await page.waitForTimeout(800);
      break;
    }
    case "wordslide": {
      const c = await centre(page, "[data-cell]", 7);
      if (c) {
        await page.mouse.move(c[0], c[1]);
        await page.mouse.down();
        await page.mouse.move(c[0] + 60, c[1], { steps: 4 });
        await page.mouse.up();
      }
      break;
    }
    case "wordsearch": {
      // Drag out the example's first hidden word.
      const [a, b] = (wordAnswer(puzzle) ?? "").split(",")[0]!.split(".").map(Number);
      const from = await centre(page, "[data-game-stage] [data-play-area] > div", a!);
      const to = await centre(page, "[data-game-stage] [data-play-area] > div", b!);
      if (from && to) {
        await page.mouse.move(from[0], from[1]);
        await page.mouse.down();
        await page.mouse.move(to[0], to[1], { steps: 8 });
        await page.mouse.up();
      }
      await page.waitForTimeout(800);
      break;
    }
    case "letterwheel":
      await tap(page, "[data-play-area]");
      break;
    case "strikeout":
      for (const k of ["E", "A", "R"]) await tap(page, `[data-key="${k}"]`);
      await page.waitForTimeout(600);
      break;
    case "codeword":
      await tap(page, "[data-cw-cell]", 3);
      break;
    case "swapword":
      await tap(page, "[data-sw-tile]", 1);
      break;
    case "wordfall":
      for (const [x, y] of [
        [0.3, 0.85],
        [0.45, 0.85],
        [0.45, 0.75],
      ] as const) {
        const box = await page.locator("[data-game-stage] canvas").boundingBox();
        if (box) await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
        await page.waitForTimeout(200);
      }
      break;
  }
  await page.waitForTimeout(500);
}

function wordDriver(game: string): Driver {
  return {
    board: BOARD[game],
    partial: ({ page, puzzle }) => midPlay(page, game, puzzle),
    fx: async ({ page }) => {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("duelz-dev-word-finish")));
    },
    answer: (puzzle) => wordAnswer(puzzle),
  };
}

export const WORD_DRIVERS = Object.fromEntries(
  Object.keys(BOARD).map((game) => [game, wordDriver(game)]),
) as Record<string, Driver>;
