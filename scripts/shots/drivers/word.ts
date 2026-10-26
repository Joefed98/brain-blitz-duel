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
    case "wordsmith": {
      // Word depth (wordsmithRev 3): enter the word that uses every tile, so the gold pangram badge shows;
      // then three tiles of the next word.
      const p = puzzle as FullPuzzle & { letters?: string[]; source?: string; words?: { word: string }[] };
      const letters = p.letters ?? [];
      const pangram = p.source ?? p.words?.find((w) => w.word.length >= letters.length)?.word;
      if (pangram) {
        const used: number[] = [];
        for (const ch of pangram) {
          const i = letters.findIndex((l, k) => l === ch && !used.includes(k));
          if (i < 0) break;
          used.push(i);
          await tap(page, `[data-wordsmith-tile="${i}"]`);
        }
        await page.getByRole("button", { name: "Enter" }).click();
        await page.waitForTimeout(900);
      }
      for (const i of [4, 0, 2]) await tap(page, `[data-wordsmith-tile="${i}"]`);
      break;
    }
    case "wordhunt": {
      // Word depth (wordHuntRev 3): trace a long word through the golden tile and submit it, so the counter, the
      // "×2 ★" chip and the best-word line show the multipliers; then start a second trace on the 6×6 board.
      const p = puzzle as FullPuzzle & { golden?: number; words?: { word: string; path: number[] }[] };
      const golden = p.golden;
      const long = (p.words ?? []).find((w) => w.word.length >= 6 && typeof golden === "number" && w.path.includes(golden));
      if (long) {
        for (const cell of long.path) await tap(page, "[data-cell]", cell);
        await page.getByRole("button", { name: "Submit" }).click();
        await page.waitForTimeout(500);
      }
      const next = (p.words ?? []).find((w) => w !== long && w.word.length >= 5);
      for (const cell of (next?.path ?? [0, 1]).slice(0, 3)) await tap(page, "[data-cell]", cell);
      break;
    }
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
      // Drag out the example's first hidden word, then (word depth, wordSearchRev 3) the hidden bonus word, so the
      // gold star chip shows it.
      const drag = async (a: number, b: number) => {
        const from = await centre(page, "[data-game-stage] [data-play-area] > div", a);
        const to = await centre(page, "[data-game-stage] [data-play-area] > div", b);
        if (from && to) {
          await page.mouse.move(from[0], from[1]);
          await page.mouse.down();
          await page.mouse.move(to[0], to[1], { steps: 8 });
          await page.mouse.up();
        }
        await page.waitForTimeout(800);
      };
      const [a, b] = (wordAnswer(puzzle) ?? "").split(",")[0]!.split(".").map(Number);
      await drag(a!, b!);
      const bonus = (puzzle as FullPuzzle & { bonus?: { cells: number[] } }).bonus;
      if (bonus) await drag(bonus.cells[0]!, bonus.cells.at(-1)!);
      break;
    }
    case "letterwheel": {
      // Word depth (wheelRev 2): a bonus word drops into the jar, then the shortest crossword word fills its slot.
      const p = puzzle as FullPuzzle & { letters?: string; words?: string[] };
      const letters = p.letters ?? "";
      const words = p.words ?? [];
      const box = await page.locator("[data-lw-wheel]").first().boundingBox();
      const spell = async (word: string) => {
        if (!box) return;
        const used: number[] = [];
        for (const ch of word) {
          const i = [...letters].findIndex((l, k) => l === ch && !used.includes(k));
          if (i < 0) return;
          used.push(i);
          const a = -Math.PI / 2 + (2 * Math.PI * i) / letters.length;
          await page.mouse.click(box.x + (box.width * (50 + 36 * Math.cos(a))) / 100, box.y + (box.height * (50 + 36 * Math.sin(a))) / 100);
          await page.waitForTimeout(120);
        }
        await page.getByRole("button", { name: "Submit" }).click();
        await page.waitForTimeout(700);
      };
      const { wordsFrom, isWord } = await import("../../../src/lib/duel/dictionary.server");
      const slots = new Set(words);
      const bonus = wordsFrom(letters, 4, true).map((w) => w.toUpperCase()).filter((w) => !slots.has(w) && isWord(w));
      for (const w of bonus.slice(0, 2)) await spell(w);
      const short = [...words].sort((x, y) => x.length - y.length)[0];
      if (short) await spell(short);
      break;
    }
    case "strikeout": {
      // Word depth (strikeoutRev 5): solve the first word early (Solve with its hidden letters typed), so the gold
      // early-solve pill shows; then a few guesses on the second word.
      const p = puzzle as FullPuzzle & { words?: string[]; givens?: string[] };
      const word = p.words?.[0];
      const given = p.givens?.[0];
      if (word && given) {
        await page.getByRole("button", { name: "Solve" }).click();
        await page.waitForTimeout(160);
        for (let i = 0; i < word.length; i++) if (given[i] === "_") await tap(page, `[data-key="${word[i]}"]`);
        await page.getByRole("button", { name: "Solve" }).click();
        await page.waitForTimeout(900);
      }
      for (const k of ["E", "R"]) await tap(page, `[data-key="${k}"]`);
      await page.waitForTimeout(600);
      break;
    }
    case "codeword":
      await tap(page, "[data-cw-cell]", 3);
      break;
    case "swapword":
      // Word depth (swapwordRev 4): one swap so the par pill counts it ("1 used · par N"), then a tile picked up.
      await tap(page, "[data-sw-tile]", 1);
      await tap(page, "[data-sw-tile]", 2);
      await page.waitForTimeout(500);
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
