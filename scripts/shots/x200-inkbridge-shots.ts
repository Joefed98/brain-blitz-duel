/**
 * Rainbow Bridge inkRev 10 review frames (x200, Oct 2026, docs/expansions/x200-inkbridge.md): the real renderer
 * (@napi-rs/canvas) at the iPhone 11 play box (414 × 716 CSS px, the 390 × 674 world fitted to 414 × 715, 2× pixels),
 * from the oracle's flawless run, on ticks where the features are on screen: a bounce cloud, the ink star with silver coins and
 * the shamrock (in a wind zone on seed index 0), and a taller live level. A design tool, not a check; the game frame's header is
 * not part of it.
 *
 *   bun scripts/shots/x200-inkbridge-shots.ts [--seed-index=0] [--out=screenshots/x200-oct-2026]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: (el: any) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as any).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/x200-oct-2026";
const N = Number(process.argv.find((a) => a.startsWith("--seed-index="))?.slice(13) ?? 0);
mkdirSync(OUT, { recursive: true });
const { roomSeed } = await import("../arcade-skill-bands/games");
const { inkOracleRun } = await import("../ink-x200-oracle");
const ink = await import("../../src/lib/arcade/inkBridge");
const { drawInkBridgeArt } = await import("../../src/lib/arcade/inkBridge.renderer");

/** The 390 × 674 world fitted into the iPhone 11 box (414 × 716): 414 × 715 CSS px. */
const W = 414;
const H = Math.round((W * 674) / 390);
const DPR = 2;

const seed = roomSeed(N);
const run = inkOracleRun(seed);
const game = ink.inkBridgeGameFor(ink.INK_REV_EXPAND);
const byTick = new Map(run.events.map((e: any) => [e.t, e]));
const states: any[] = [];
let s: any = game.init(seed);
while (!game.isOver(s) && s.tick < 7400) {
  s = game.step(s, byTick.get(s.tick + 1) ?? null);
  states.push(s);
}

function shoot(name: string, pick: (s: any, i: number) => boolean): void {
  const found = states.findIndex(pick);
  if (found < 0) {
    console.log(`${name}: no tick matched`);
    return;
  }
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as any;
  for (let i = Math.max(0, found - 90); i <= found; i++) {
    clock += 1000 / 60;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawInkBridgeArt(ctx, states[i], { width: W, height: H } as any);
  }
  const path = `${OUT}/rainbow-bridge-${name}-414x896.png`;
  writeFileSync(path, canvas.toBuffer("image/png"));
  console.log(`${path}: tick ${states[found].tick}, level ${states[found].level + 1}`);
}

const lvl = (st: any) => st.list[st.level];
const inZone = (st: any) => {
  const w = lvl(st).wind;
  return w && st.ball.x >= w.x0 * 256 && st.ball.x <= w.x1 * 256 && st.ball.y >= w.y0 * 256 && st.ball.y <= w.y1 * 256;
};
// A coin just off a bounce cloud (its trick shot).
shoot("cloud", (st) => st.dropping && st.cloudTick >= 0 && st.tick - st.cloudTick === 4);
// The shamrock level mid-flight: the ink star, silver coins and the shamrock ahead of the coin (on this seed, inside
// a wind zone; `inZone` picks a wind frame on seeds where the two are apart).
shoot("star-silver-shamrock", (st) => st.dropping && st.level < 8 && Boolean(lvl(st).shamrock) && (st.ball.y >> 8) > 180 && (st.shamrockGot ?? 0) === 0);
if (!states.some((st) => st.dropping && Boolean(lvl(st).shamrock) && inZone(st))) shoot("wind", (st) => st.dropping && inZone(st));
// A taller live level, the coin falling to the hand-drawn catch ramp.
shoot("live-level", (st, i) => st.dropping && st.level === 9 && (st.ball.y >> 8) > 380 && i > 0);
