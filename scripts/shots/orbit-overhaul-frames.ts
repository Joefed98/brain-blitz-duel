/**
 * Orbit's Action-overhaul review frames (a design tool, not a check; docs/design/pages-review/action/GALLERY.md). Draws the
 * play screen below the game header as the arcade stage composes it (the screen fill round the world, then the world
 * scaled to the screen's width, top-anchored) from a browser bundle of a tree's own sim, renderer and fill (build one per
 * tree: `bun build <entry> --target=browser`, the entry putting { r3: orbitRev3, art: orbit.renderer, fills:
 * arenaFills.renderer } on window.__orbit), stepping the sim in the page on the fixed intro example with the skill-band
 * bot's log (elite), so "before" (main's bundle) and "after" draw the same run. Writes <out>/<tag>/orbit-t<tick>.png at
 * the ticks asked, and with --clip every --clip-every ticks.
 *
 *   bun scripts/shots/orbit-overhaul-frames.ts --bundle=<file.js> --tag=after --rev=15 [--out=.shots/orbit-overhaul]
 *       [--ticks=60,1200,2400,3300] [--size=390x844] [--clip --clip-every=45]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

import { orbitRev3Game, orbitStartForPuzzle, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { bot } from "../arcade-skill-bands/bots/orbit";
import { Human } from "../arcade-skill-bands/human";
import { exampleFor } from "./examples";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const BUNDLE = opt("bundle") ?? ".shots/orbit-after.js";
const TAG = opt("tag") ?? "after";
const REV = Number(opt("rev") ?? 15);
const OUT = join(opt("out") ?? ".shots/orbit-overhaul", TAG);
const [W, H] = (opt("size") ?? "390x844").split("x").map(Number) as [number, number];
const CLIP = args.includes("--clip");
const CLIP_EVERY = Number(opt("clip-every") ?? 45);
const HEADER = 60;

mkdirSync(OUT, { recursive: true });
const puzzle = { ...(exampleFor("orbit" as never) as unknown as Record<string, unknown>) } as { seed: number; orbitRev: number };
const start = orbitStartForPuzzle(puzzle as never)!;
const game = { ...orbitRev3Game, init: start } as never;
const out = bot({ game, seed: puzzle.seed, rev: puzzle.orbitRev, human: new Human("orbit", puzzle.seed, "elite"), fixes: true } as never);
let s = start() as OrbitRev3State;
const at = new Map((out.events ?? []).map((e) => [e.t, e]));
while (!s.ended && s.tick < orbitRev3Game.runTicks) s = orbitRev3Game.step(s, at.get(s.tick + 1) ?? null) as OrbitRev3State;
const endTick = s.tick;
const ticks = CLIP
  ? Array.from({ length: Math.floor(endTick / CLIP_EVERY) + 1 }, (_, i) => Math.min(endTick, i * CLIP_EVERY + 1))
  : (opt("ticks") ?? "60,1200,2400,3300").split(",").map(Number).map((t) => Math.min(t, endTick));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const font = readFileSync("public/fonts/archivo-var-latin.woff2").toString("base64");
await page.setContent(`<!doctype html><html><head><style>@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}</style></head><body></body></html>`);
await page.addScriptTag({ content: `window.process={env:{}};` });
await page.addScriptTag({ content: readFileSync(BUNDLE, "utf8") });
await page.evaluate(async ({ puzzle, rev, events, W, H, HEADER }) => {
  const { r3, art, fills } = (window as unknown as { __orbit: Record<string, any> }).__orbit; // eslint-disable-line @typescript-eslint/no-explicit-any
  await document.fonts.load("800 18px Archivo").catch(() => undefined);
  const start = r3.orbitStartForPuzzle({ ...puzzle, orbitRev: rev });
  const drawH = art.orbitDrawHFor(rev);
  const worldW = r3.orbitWorldWFor(rev);
  const box = { w: W, h: H - HEADER };
  const scale = Math.min(box.w / worldW, box.h / drawH);
  const side = (box.w / scale - worldW) / 2;
  const view = { worldW, worldH: drawH, left: -side, right: worldW + side, top: 0, bottom: box.h / scale, scale, boxTop: 0 };
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.background = "#070709";
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.style.display = "block";
  document.body.appendChild(c);
  const at = new Map(events.map((e: { t: number }) => [e.t, e]));
  let s = start();
  const w = window as unknown as { __frame: (tick: number) => void };
  w.__frame = (tick: number) => {
    while (s.tick < tick && !s.ended) s = r3.orbitRev3Game.step(s, at.get(s.tick + 1) ?? null);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#070709";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(side * scale, HEADER);
    ctx.scale(scale, scale);
    fills.orbitFill(ctx, view);
    ctx.restore();
    const world = document.createElement("canvas");
    world.width = Math.round(worldW * scale);
    world.height = Math.round(drawH * scale);
    art.orbitRev3ArtGame.draw(world.getContext("2d")!, s, { width: world.width, height: world.height });
    ctx.drawImage(world, Math.round(side * scale), HEADER);
    ctx.fillStyle = "#070709";
    ctx.fillRect(0, 0, W, HEADER);
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "800 19px Archivo, system-ui";
    ctx.fillText("Orbit", 14, 30);
    ctx.fillStyle = "#BDBDCC";
    ctx.font = "600 12px Archivo, system-ui";
    ctx.fillText("Action · Practice", 14, 48);
  };
}, { puzzle, rev: REV, events: out.events ?? [], W, H, HEADER });
for (const t of ticks) {
  await page.evaluate((tick) => (window as unknown as { __frame: (t: number) => void }).__frame(tick), t);
  await page.waitForTimeout(80);
  const buf = await page.screenshot();
  writeFileSync(join(OUT, `orbit-t${String(t).padStart(4, "0")}.png`), buf);
}
console.log(`${ticks.length} frames in ${OUT} (run ends at tick ${endTick})`);
await browser.close();
