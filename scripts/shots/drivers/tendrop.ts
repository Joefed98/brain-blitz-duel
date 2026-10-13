import type { Page } from "playwright";
import type { Driver } from "../number-drivers";

/**
 * Tenfall: reads the live sim state through the arcade test hook (window.__arcadeProbe,
 * the same one arcade-play-check uses) and plays the proof solver's rule online: walk
 * the tiles in spawn order, tap a digit or a ×2 when it does not overshoot the target,
 * skip everything else. Taps are real mouse clicks on the board ([data-play-area], whose
 * box is the 360 × 520 world before and after the polish).
 */
const W = 360;
const H = 520;
const TILE_H = 64;

async function hook(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __arcadeProbe?: (s: object) => void; __tdState?: object; __tdDrv?: { stage: number; last: number } };
    w.__tdDrv = w.__tdDrv ?? { stage: -1, last: -1 };
    w.__arcadeProbe = (s: object) => { w.__tdState = s; };
  });
}

type Step = { kind: "wait" } | { kind: "tap"; x: number; y: number } | { kind: "state"; cleared: number; taps: number; over: boolean };

/** One decision in the page: the next tile to tap (world px), or wait. */
async function decide(page: Page): Promise<{ step: Step; cleared: number; tick: number }> {
  return page.evaluate(({ H, TILE_H }) => {
    type T = { id: number; col: number; y: number; tile: number };
    const w = window as unknown as { __tdState?: { tick: number; stage: number; cleared: number; total: number; nextId: number; queueIndex: number; tiles: T[]; plan: { targets: number[] } }; __tdDrv: { stage: number; last: number } };
    const s = w.__tdState;
    if (!s) return { step: { kind: "wait" as const }, cleared: 0, tick: 0 };
    const d = w.__tdDrv;
    const out = (step: { kind: "wait" } | { kind: "tap"; x: number; y: number }) => ({ step, cleared: s.cleared, tick: s.tick });
    if (s.cleared > s.stage || s.cleared >= 10) return out({ kind: "wait" });
    if (d.stage !== s.stage) { d.stage = s.stage; d.last = -1; }
    const target = s.plan.targets[s.stage]!;
    const base = s.nextId - s.queueIndex;
    for (const t of [...s.tiles].sort((a, b) => a.id - b.id)) {
      const pos = t.id - base;
      if (pos <= d.last) continue;
      const y = t.y / 256;
      if (y < 0) return out({ kind: "wait" });
      if (y > H - TILE_H - 24) { d.last = pos; continue; }
      const kind = t.tile >> 4;
      const v = t.tile & 15;
      const take = (kind === 0 && s.total + v <= target) || (kind === 1 && s.total > 0 && s.total * 2 <= target);
      d.last = pos;
      if (take) return out({ kind: "tap", x: t.col * 90 + 45, y: y + TILE_H / 2 + 6 });
    }
    return out({ kind: "wait" });
  }, { H, TILE_H });
}

async function play(page: Page, until: (cleared: number, taps: number) => boolean, limitMs: number) {
  await hook(page);
  const board = page.locator("[data-game-stage] [data-play-area]").first();
  const started = Date.now();
  let taps = 0;
  while (Date.now() - started < limitMs) {
    const { step, cleared } = await decide(page);
    if (until(cleared, taps)) return;
    if (step.kind === "tap") {
      const box = await board.boundingBox();
      if (!box) throw new Error("Tenfall: no board");
      await page.mouse.click(box.x + (step.x / W) * box.width, box.y + (step.y / H) * box.height);
      taps++;
    } else await page.waitForTimeout(30);
  }
  throw new Error("Tenfall: driver ran out of time");
}

export const driver: Driver = {
  /* Clear the first target, then a couple of taps into the second. */
  partial: async ({ page }) => {
    let clearedAt = -1;
    await play(page, (cleared, taps) => {
      if (cleared >= 1 && clearedAt < 0) clearedAt = taps;
      return clearedAt >= 0 && taps >= clearedAt + 2;
    }, 30_000);
  },
  /* Clear all ten; returns the moment the last target is seen cleared. */
  solve: async ({ page }) => {
    await play(page, (cleared) => cleared >= 10, 100_000);
  },
  completeShotMs: 300,
};
