/**
 * Expansion E9 review frames (26 Oct 2026, docs/expansions/e9.md): Rally rallyRev 10, Fission burstRev 8 and
 * Flightpath bullRev 8 drawn by their real renderers (@napi-rs/canvas) at the iPhone 11 home-screen app's arena
 * width (414 CSS px, 2× pixels), from elite skill-band runs, at moments that show the new features mid-round. A
 * design tool, not a check. The world is drawn as the arena draws it; the game frame's header is not part of it
 * (scripts/shots/e9-page.ts photographs the real page).
 *
 *   bun scripts/shots/e9-shots.ts [--out=screenshots/expansion-e9-oct-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clockMs = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clockMs } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/expansion-e9-oct-2026";
mkdirSync(OUT, { recursive: true });
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { rallyArtGame } = await import("../../src/lib/arcade/rally.renderer");
const { burstArtGameFor } = await import("../../src/lib/arcade/burst.renderer");
const { drawBullseye } = await import("../../src/lib/arcade/bullseye.renderer");
const rally = await import("../../src/lib/arcade/rally");
const burst = await import("../../src/lib/arcade/burst");
const bull = await import("../../src/lib/arcade/bullseye");

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
async function states(type: string, rev: number, n: number, level = "elite"): Promise<Any[]> {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const bot = (await import(`../arcade-skill-bands/bots/${type}.ts`)).bot;
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, level) });
  const by = new Map((out.events ?? []).map((e: Any) => [e.t, e]));
  let s = game.init(seed);
  const all = [s];
  while (!game.isOver(s)) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    all.push(s);
  }
  return all;
}

function shoot(name: string, w: number, h: number, draw: (ctx: Any, s: Any, size: { width: number; height: number }) => void, frames: Any[], pick: number): void {
  if (pick < 0) return void console.log(`${name}: no frame matched`);
  const canvas = createCanvas(w * 2, h * 2);
  const ctx = canvas.getContext("2d") as Any;
  // Warm the renderer's memories (pops, pulses, trails) over the second before the frame.
  for (let i = Math.max(0, pick - 60); i <= pick; i++) {
    clockMs = 10_000 + i * (1000 / 60);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    draw(ctx, frames[i], { width: w, height: h });
  }
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png (tick ${frames[pick].tick})`);
}

// Rally: a gold target up, its ring counting down, gold balls in play, TARGET n/6 in the HUD; then a strike.
{
  let frames: Any[] = [];
  let pick = -1;
  let struck = -1;
  for (let n = 0; n < 20 && (pick < 0 || struck < 0); n++) {
    frames = await states("rally", rally.RALLY_REV_BONUS, n);
    pick = frames.findIndex((s) => s.tick > 1300 && rally.rallyBonusNow(s, s.tick + 1) >= 0 && s.tick - s.bonus[rally.rallyBonusNow(s, s.tick + 1)].tick > 60 && s.golds.length >= 1 && rally.rallyBonusCount(s) >= 2 && !s.dead);
    struck = frames.findIndex((s, i) => i > 0 && rally.rallyBonusCount(s) > rally.rallyBonusCount(frames[i - 1]) && rally.rallyBonusCount(s) >= 2);
  }
  shoot("rally-gold-target-414x896", 414, 772, (ctx, s, size) => rallyArtGame.draw(ctx, s, size), frames, pick);
  shoot("rally-target-struck-414x896", 414, 772, (ctx, s, size) => rallyArtGame.draw(ctx, s, size), frames, struck >= 0 ? struck + 8 : -1);
}
// Fission: a golden atom up with its ring, the CLEAN counter running, a double beam or freeze if one is on.
{
  let frames: Any[] = [];
  let pick = -1;
  for (let n = 0; n < 20 && pick < 0; n++) {
    frames = await states("burst", burst.BURST_REV_CLEAN, n);
    pick = frames.findIndex((s) => s.tick > 600 && burst.burstGoldenNow(s, s.tick + 1) >= 0 && (s.fired ?? 0) >= 4 && !s.missed && s.balls.length >= 3 && s.shots.length > 0);
  }
  const h = Math.round((414 * burst.BURST_TALL_H) / burst.BURST_WORLD_W);
  shoot("fission-clean-golden-414x896", 414, h, (ctx, s, size) => burstArtGameFor(burst.BURST_REV_CLEAN).draw(ctx, s, size), frames, pick);
}
// Flightpath: a dead-centre dart just landed, the streak running, the HUD line.
{
  let frames: Any[] = [];
  let pick = -1;
  for (let n = 0; n < 30 && pick < 0; n++) {
    frames = await states("bullseye", bull.BULLSEYE_REV_EXPAND, n);
    pick = frames.findIndex((s) => s.flightTick === 0 && s.hits.length >= 4 && s.hits.length <= 5 && s.hits.at(-1)?.dc === 1 && (s.streak ?? 0) >= 3);
  }
  const h = Math.round((414 * bull.BULLSEYE_V8_WORLD_H) / bull.BULLSEYE_WORLD_W);
  shoot("flightpath-dead-centre-414x896", 414, h, (ctx, s, size) => drawBullseye(ctx, s, size), frames, pick >= 0 ? pick + 4 : -1);
}
