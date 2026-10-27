/**
 * Phone notes review frames (27 Oct 2026, docs/phone-notes-oct-2026/breaker.md and bubble.md; a design tool, not a
 * check): Breaker brkRev 10 and Coral Pop bubbleRev 10 drawn by their real renderers (@napi-rs/canvas), 2× pixels.
 *  - breaker-symbols: the opening wall (laser, ×3, both double-ball bricks with their new symbols, the Fireball).
 *  - breaker-gold-cracks: a bot-played run on the first tick a gold brick has taken 2 or more of its 4 hits.
 *  - bubble-creatures: the reef's opening frame (the smaller creatures).
 *  - bubble-mine-blast: a crafted reef (five full rows) with the mine shot straight up, drawn mid-blast.
 *
 *   bun scripts/shots/phone-notes-brk-bub-shots.ts [--out=.shots/phone-notes]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: (el: any) => el?.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as any).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/phone-notes";
mkdirSync(OUT, { recursive: true });
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const breaker = await import("../../src/lib/arcade/breaker");
const { breakerArtGameFor } = await import("../../src/lib/arcade/breaker.renderer");
const bubble = await import("../../src/lib/arcade/bubble");
const { drawBubbleArt } = await import("../../src/lib/arcade/bubble.renderer");
const DPR = 2;

function save(name: string, w: number, h: number, frames: any[], draw: (ctx: any, s: any, size: any) => void): void {
  const canvas = createCanvas(Math.round(w * DPR), Math.round(h * DPR));
  const ctx = canvas.getContext("2d") as any;
  for (const s of frames) {
    clock += 1000 / 60;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw(ctx, s, { width: w, height: h });
  }
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png`);
}

/* Breaker brkRev 10 */
{
  const rev = breaker.BRK_REV_PHONE;
  const game = breaker.breakerGameFor(rev);
  const draw = breakerArtGameFor(rev).draw;
  const W = 412;
  const H = Math.round((W * breaker.BRK_V9_H) / breaker.BRK_V9_W);
  save("breaker-symbols", W, H, [game.init(GAME_BY_TYPE.get("breaker" as never)!.seedFor(15))], draw);
  const spec = GAME_BY_TYPE.get("breaker" as never)!;
  const { bot } = await import("../arcade-skill-bands/bots/breaker.ts");
  let done = false;
  for (let n = 0; n < 40 && !done; n++) {
    const seed = spec.seedFor(n);
    const res = bot({ game, seed, rev, human: new Human("breaker", seed, "near") });
    const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
    const states: any[] = [];
    let s = game.init(seed);
    while (!game.isOver(s)) {
      s = game.step(s, byTick.get(s.tick + 1) ?? null);
      states.push(s);
      const cracked = s.bricks.some((left: number, i: number) => breaker.brkIsGold(s, i) && left > 0 && left <= breaker.BRK_V10_GOLD_HITS - 2);
      if (cracked) {
        save("breaker-gold-cracks", W, H, states.slice(-90), draw);
        done = true;
        break;
      }
    }
  }
}

/* Coral Pop bubbleRev 10 */
{
  const rev = bubble.BUB_REV_BLAST;
  const game = bubble.bubbleGameFor(rev);
  const W = 390;
  const H = bubble.bubbleWorldHFor(rev);
  const start = game.init(1) as any;
  save("bubble-creatures", W, H, [start], drawBubbleArt);
  const grid = new Array<number>(start.grid.length).fill(0);
  for (let i = 0; i < 5 * bubble.BUB_COLS; i++) grid[i] = 1 + (i % 5);
  const queue = [...start.queue];
  queue[0] = bubble.BUB_BOMB;
  let s: any = { ...start, grid, queue, queueAt: 0, startCount: 5 * bubble.BUB_COLS };
  const states: any[] = [s];
  s = game.step(s, { t: 1, k: bubble.BUB_INPUT_SHOT, a: 100, b: -4096, c: 0, d: 0 });
  states.push(s);
  for (let i = 0; i < 400 && s.flightColour !== 0; i++) states.push((s = game.step(s, null)));
  for (let i = 0; i < 12; i++) states.push((s = game.step(s, null)));
  console.log(`mine cleared ${s.lastSpecialCleared} bubbles`);
  save("bubble-mine-blast", W, H, states, drawBubbleArt);
}
