/**
 * The Word games' step players for the intro-demo save (scripts/word-demos-save.ts): each turns one recorded move of a
 * fixture run (scripts/fixtures/word-demos.json, the phone's answer after that move) into the taps and drags a player
 * makes on the real stage, so the app's own demo recorder (DemoRecorder, practice's dev mode) records them as touches.
 * A player gets the answer before and after the move and the page; it never reads the solution.
 */
import type { Page } from "playwright";

import { stripTimeline } from "../src/lib/duel/standard/timeline";

type Pt = { x: number; y: number };

async function centreOf(page: Page, selector: string, index = 0): Promise<Pt> {
  const box = await page.locator(selector).nth(index).boundingBox();
  if (!box) throw new Error(`nothing at ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function tapAt(page: Page, p: Pt): Promise<void> {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await page.waitForTimeout(60);
}

async function tap(page: Page, selector: string, index = 0): Promise<void> {
  await tapAt(page, await centreOf(page, selector, index));
}

/** A drag through the points, a few small moves between each. */
async function dragThrough(page: Page, points: Pt[]): Promise<void> {
  const [first, ...rest] = points;
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  let at = first;
  for (const p of rest) {
    for (let k = 1; k <= 4; k++) {
      await page.mouse.move(at.x + ((p.x - at.x) * k) / 4, at.y + ((p.y - at.y) * k) / 4);
      await page.waitForTimeout(16);
    }
    at = p;
  }
  await page.waitForTimeout(40);
  await page.mouse.up();
  await page.waitForTimeout(80);
}

const STAGE = "[data-game-stage]";
const key = (letter: string) => `${STAGE} [data-key="${letter}"]`;
const button = (page: Page, name: string) => page.locator(STAGE).getByRole("button", { name, exact: true }).first();

/** The new tokens after a move (answers that grow by comma-separated tokens). */
function added(before: string, after: string): string[] {
  const a = before ? before.split(",") : [];
  const b = after ? after.split(",") : [];
  return b.slice(a.length);
}

export type StepPlayer = (page: Page, before: string, after: string) => Promise<void>;

/** Nucleus: each new word is tapped letter by letter on the ring, then Enter. */
const wordsmith: StepPlayer = async (page, before, after) => {
  for (const word of added(before, after)) {
    const used = new Set<number>();
    for (const letter of word) {
      const index = await page.evaluate(
        ({ letter, used }) => {
          const tiles = [...document.querySelectorAll<HTMLElement>("[data-game-stage] [data-wordsmith-tile]")];
          const t = tiles.find((el) => !used.includes(Number(el.dataset.wordsmithTile)) && el.textContent?.trim().toUpperCase() === letter);
          return t ? Number(t.dataset.wordsmithTile) : -1;
        },
        { letter, used: [...used] },
      );
      if (index < 0) throw new Error(`Nucleus: no free tile ${letter} for ${word}`);
      used.add(index);
      await tap(page, `${STAGE} [data-wordsmith-tile="${index}"]`);
    }
    await button(page, "Enter").click();
    await page.waitForTimeout(500);
  }
};

/** Interlock: each move places one tile: tap a tray tile with the letter, then the square. */
const tilegrid: StepPlayer = async (page, before, after) => {
  const a = [...before.padEnd(after.length, ".")];
  const b = [...after];
  for (let cell = 0; cell < b.length; cell++) {
    if (b[cell] === "." || b[cell] === a[cell]) continue;
    const letter = b[cell]!;
    const tray = page.locator(`${STAGE} [data-game-controls="tray"] [data-wa="tile"]`).filter({ hasText: new RegExp(`^${letter}$`) }).first();
    const box = await tray.boundingBox();
    if (!box) throw new Error(`Interlock: no tray tile ${letter}`);
    await tapAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await tap(page, `${STAGE} [data-tg-cell="${cell}"]`);
  }
};

/** Interlock's finish: Done once all fifteen tiles are down. */
const tilegridDone = async (page: Page) => {
  await button(page, "Done").click();
};

/** Slider: r<i>± slides row i, c<i>± column i, a drag of two squares along it. */
const wordslide: StepPlayer = async (page, before, after) => {
  for (const token of added(before, after)) {
    const m = /^([rc])(\d)([+-])$/.exec(token);
    if (!m) throw new Error(`Slider: can't play ${token}`);
    const board = await page.locator(`${STAGE} [aria-label$="board"]`).first().boundingBox();
    if (!board) throw new Error("Slider: no board");
    const size = 5;
    const cell = board.width / size;
    const i = Number(m[2]);
    const dir = m[3] === "+" ? 1 : -1;
    const start = m[1] === "r" ? { x: board.x + cell * 2.5, y: board.y + cell * (i + 0.5) } : { x: board.x + cell * (i + 0.5), y: board.y + cell * 2.5 };
    const end = m[1] === "r" ? { x: start.x + dir * cell * 1.2, y: start.y } : { x: start.x, y: start.y + dir * cell * 1.2 };
    await dragThrough(page, [start, end]);
    await page.waitForTimeout(250);
  }
};

/** Forage: each new word (WORD:cells) is traced through its squares; a miss (!cells) the same. */
const wordhunt: StepPlayer = async (page, before, after) => {
  for (const token of added(before, after)) {
    const path = (token.startsWith("!") ? token.slice(1) : token.split(":")[1] ?? "").split("-").map(Number);
    const points: Pt[] = [];
    for (const cell of path) points.push(await centreOf(page, `${STAGE} [data-cell="${cell}"]`));
    await dragThrough(page, points);
    await page.waitForTimeout(350);
  }
};

/** Lookout: each find (start.end) is a drag from its first square to its last. */
const wordsearch: StepPlayer = async (page, before, after) => {
  for (const token of added(before, after)) {
    const [from, to] = token.split(".").map(Number);
    await dragThrough(page, [await centreOf(page, `${STAGE} [data-ws-cell="${from}"]`), await centreOf(page, `${STAGE} [data-ws-cell="${to}"]`)]);
    await page.waitForTimeout(400);
  }
};

/** Roundabout: each new word is traced round the wheel's letters, then released inside the wheel. */
const letterwheel: StepPlayer = async (page, before, after) => {
  for (const word of added(before, after)) {
    const points = await page.evaluate((word) => {
      const discs = [...document.querySelectorAll<HTMLElement>('[data-game-stage] [data-lw-wheel] [data-wa="disc"]')];
      const used = new Set<number>();
      const out: { x: number; y: number }[] = [];
      for (const letter of word) {
        const i = discs.findIndex((d, k) => !used.has(k) && d.textContent?.trim().toUpperCase() === letter);
        if (i < 0) return null;
        used.add(i);
        const b = discs[i]!.getBoundingClientRect();
        out.push({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
      }
      return out;
    }, word);
    if (!points) throw new Error(`Roundabout: can't trace ${word}`);
    await dragThrough(page, points);
    await page.waitForTimeout(500);
  }
};

/** Strikeout: a guess presses its key; a solve presses Solve, types the hidden letters, then Solve. */
const strikeout: StepPlayer = async (page, before, after) => {
  for (const token of added(before, after)) {
    const word = Number(token[0]);
    const rest = token.slice(1);
    if (rest.length === 1) {
      await tap(page, key(rest));
    } else {
      await button(page, "Solve").click();
      await page.waitForTimeout(120);
      const holes = await page.evaluate(
        (word) => [...document.querySelectorAll<HTMLElement>(`[data-game-stage] [data-so-tile^="${word}-"]`)]
          .map((el) => (el.dataset.soLook === "hidden" ? Number(el.dataset.soTile!.split("-")[1]) : -1))
          .filter((i) => i >= 0),
        word,
      );
      for (const i of holes) await tap(page, key(rest[i]!));
      await button(page, "Solve").click();
    }
    await page.waitForTimeout(450);
  }
};

/** Cryptogrid: each move taps a square of its number, then the letter. */
const codeword: StepPlayer = async (page, before, after) => {
  for (const token of added(before, after)) {
    const m = /^(\d+)([A-Z]|-)$/.exec(token);
    if (!m) throw new Error(`Cryptogrid: can't play ${token}`);
    await tap(page, `${STAGE} [data-cw-cell="${m[1]}"]`);
    if (m[2] === "-") await button(page, "Clear").click();
    else await tap(page, key(m[2]!));
    await page.waitForTimeout(150);
  }
};

/** Swapword: each swap taps one tile, then the other. */
const swapword: StepPlayer = async (page, before, after) => {
  for (const token of added(before, after)) {
    const [i, j] = token.split("-").map(Number);
    await tap(page, `${STAGE} [data-sw-tile="${i}"]`);
    await tap(page, `${STAGE} [data-sw-tile="${j}"]`);
    await page.waitForTimeout(250);
  }
};

export const STEP_PLAYERS: Record<string, { step: StepPlayer; finish?: (page: Page) => Promise<void> }> = {
  wordsmith: { step: wordsmith },
  tilegrid: { step: tilegrid, finish: tilegridDone },
  wordslide: { step: wordslide },
  wordhunt: { step: wordhunt },
  wordsearch: { step: wordsearch },
  letterwheel: { step: letterwheel },
  strikeout: { step: strikeout },
  codeword: { step: codeword },
  swapword: { step: swapword },
};

/** The answer a phone sent, without its draft timeline. */
export function sentBody(answer: string): string {
  return stripTimeline(answer);
}
