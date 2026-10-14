/**
 * The eleven Logic games (from the Logic polish captures, #47): each solution becomes one
 * input step per entry; mid-play plays the first half, the solve plays the rest.
 */
import type { Page } from "playwright";

import type { PuzzleType } from "../../../src/lib/duel/types";
import { click, press, STAGE, type Driver, type FullPuzzle } from "../driver";

type Step = (page: Page) => Promise<void>;

function gridPoint(page: Page, board: string, size: number, cell: number) {
  return page
    .locator(`${STAGE} ${board}`)
    .first()
    .boundingBox()
    .then((box) => {
      if (!box) throw new Error(`no ${board}`);
      return {
        x: box.x + ((cell % size) + 0.5) * (box.width / size),
        y: box.y + (Math.floor(cell / size) + 0.5) * (box.height / size),
      };
    });
}

/** One input step per entry; the last step solves the puzzle. */
function steps(type: PuzzleType, p: FullPuzzle): Step[] {
  const tap =
    (selector: string, nth = 0): Step =>
    (page) =>
      click(page, `${STAGE} ${selector}`, nth);
  const hold =
    (selector: string, nth = 0): Step =>
    (page) =>
      press(page, `${STAGE} ${selector}`, nth);
  switch (type) {
    case "lightsout":
      return (p.solution as number[]).map((cell) => tap(".lightsout-bulb", cell));
    case "sudoku":
      return (p.givens as number[]).flatMap((given, cell) =>
        given
          ? []
          : [
              async (page: Page) => {
                await tap(".sudoku-grid > button", cell)(page);
                await page
                  .locator(`${STAGE} [data-game-controls="numbers"] .grid-cols-6 > button`)
                  .nth(((p.solution as number[])[cell] ?? 1) - 1)
                  .click();
                await page.waitForTimeout(80);
              },
            ],
      );
    case "tower":
    case "tubes": {
      const label = type === "tower" ? "Post" : "Flask";
      return String(p.solution)
        .split(",")
        .map((move) => async (page: Page) => {
          const [from, to] = move.split(">").map(Number);
          await tap(`button[aria-label="${label} ${from! + 1}"]`)(page);
          await tap(`button[aria-label="${label} ${to! + 1}"]`)(page);
        });
    }
    case "safe":
      return [
        ...(p.combination as number[]).flatMap((digit, dial) =>
          Array.from({ length: digit }, () => hold('button[aria-label="Up"]', dial)),
        ),
        tap("button:has-text('Try')"),
      ];
    case "bomb":
      return [
        ...String(p.sequence ?? p.required)
          .split(",")
          .map((action) =>
            action.startsWith("w")
              ? tap(`button[aria-label="Wire ${Number(action.slice(1)) + 1}"]`)
              : tap(`button[aria-label="Button ${action.slice(1)}"]`),
          ),
        tap("button:has-text('Defuse')"),
      ];
    case "nonogram": {
      const pattern = p.pattern as boolean[];
      const size = Math.round(Math.sqrt(pattern.length));
      return pattern.flatMap((on, cell) =>
        on
          ? [
              hold(
                `button[aria-label="Row ${Math.floor(cell / size) + 1} column ${(cell % size) + 1}"]`,
              ),
            ]
          : [],
      );
    }
    case "flood": {
      const names = ["Magenta", "Blue", "Mint", "Yellow", "Orange"];
      return (p.solution as number[]).map((colour) =>
        hold(`button[aria-label="${names[colour]}"]`),
      );
    }
    case "tents":
      // Buttons follow the cell order (trees are disabled buttons in place).
      return (p.solution as number[]).map((cell) => tap("[data-game-arena] button", cell));
    case "shikaku": {
      const size = p.size as number;
      return (p.solution as { r0: number; c0: number; r1: number; c1: number }[]).map(
        (r) => async (page: Page) => {
          const a = await gridPoint(page, ".shikaku-board", size, r.r0 * size + r.c0);
          const b = await gridPoint(page, ".shikaku-board", size, r.r1 * size + r.c1);
          await page.mouse.move(a.x, a.y);
          await page.mouse.down();
          await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
          await page.mouse.move(b.x, b.y, { steps: 3 });
          await page.mouse.up();
          await page.waitForTimeout(160);
        },
      );
    }
    case "lightup": {
      const size = p.size as number;
      return (p.solution as number[]).map((cell) => async (page: Page) => {
        const at = await gridPoint(page, "[data-game-arena] > div", size, cell);
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(140);
      });
    }
    default:
      return [];
  }
}

const half = (n: number) => Math.max(1, Math.floor(n / 2));

function logicDriver(type: PuzzleType): Driver {
  return {
    partial: async ({ page, puzzle }) => {
      for (const step of steps(type, puzzle).slice(0, half(steps(type, puzzle).length)))
        await step(page);
    },
    solve: async ({ page, puzzle, wait }) => {
      const plan = steps(type, puzzle);
      for (const step of plan.slice(half(plan.length), -1)) await step(page);
      await wait(300);
      await plan.at(-1)?.(page);
    },
    solveShotsMs: [120, 450, 850],
  };
}

export const LOGIC_DRIVERS = Object.fromEntries(
  (
    [
      "lightsout",
      "sudoku",
      "tower",
      "tubes",
      "safe",
      "bomb",
      "nonogram",
      "flood",
      "tents",
      "shikaku",
      "lightup",
    ] as const
  ).map((type) => [type, logicDriver(type)]),
) as Record<string, Driver>;
