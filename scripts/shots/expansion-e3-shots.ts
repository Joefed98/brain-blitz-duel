/**
 * Expansion E3 review frames (25 Oct 2026, docs/expansions/e3.md): Rally rallyRev 9 and Breaker brkRev 9 drawn by
 * their real renderers (@napi-rs/canvas) at the iPhone 11 play box (414 × 772 CSS px, the 420 × 784 world at
 * its fitted scale, 2× pixels), from bot-played runs, on ticks where the new features are on screen. A design
 * tool, not a check. The world is drawn as the arena draws it; the game frame's header is not part of it.
 *
 *   bun scripts/shots/expansion-e3-shots.ts [--out=screenshots/expansion-e3-oct-2026]
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

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/expansion-e3-oct-2026";
mkdirSync(OUT, { recursive: true });
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { rallyArtGame } = await import("../../src/lib/arcade/rally.renderer");
const { breakerArtGameFor } = await import("../../src/lib/arcade/breaker.renderer");
const rally = await import("../../src/lib/arcade/rally");
const breaker = await import("../../src/lib/arcade/breaker");

/** The 420 × 784 world fitted into the iPhone 11 box, 414 × 772, top-anchored: 412 × 770 CSS px. */
const W = Math.round((772 * 420) / 784);
const H = 772;
const DPR = 2;

/** Plays a bot run; for every tick `pick` may accept, draws the last 90 ticks up to it and saves the frame. */
const BOTS = { rally: await import("../arcade-skill-bands/bots/rally.ts"), breaker: await import("../arcade-skill-bands/bots/breaker.ts") };
function shoot(name: string, type: "rally" | "breaker", level: string, n: number, pick: (s: any) => boolean, draw: (ctx: any, s: any, size: any) => void, skip = 0) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const seed = spec.seedFor(n);
  const game = spec.gameFor(9, seed);
  const { bot } = BOTS[type];
  const res = bot({ game, seed, rev: 9, human: new Human(type, seed, level) });
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  const states: any[] = [];
  let s = game.init(seed);
  let found = -1;
  let seen = 0;
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    states.push(s);
    if (pick(s) && s.tick > 120 && seen++ >= skip) {
      found = states.length - 1;
      break;
    }
  }
  if (found < 0) {
    console.log(`${name}: no tick matched`);
    return;
  }
  const canvas = createCanvas(W * DPR, Math.round(((W * 784) / 420) * DPR));
  const ctx = canvas.getContext("2d") as any;
  for (let i = Math.max(0, found - 90); i <= found; i++) {
    clock += 1000 / 60;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw(ctx, states[i], { width: W, height: Math.round((W * 784) / 420) });
  }
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${name}: tick ${states[found].tick}`);
}

// Rally: the twin ball up with returns doubled, the pads gliding, a spun ball curving.
shoot("rally-twin-spin-414x896", "rally", "near", 7, (s) => !!s.twin && (s.spun === 1 || s.golds.some((g: any) => g.spun)) && s.golds.length > 0, rallyArtGame.draw);
// Rally: a milestone flash and a spin target.
shoot("rally-spin-target-414x896", "rally", "near", 7, (s) => (s.spinHits ?? 0) > 0 && s.tick - (s.struckTick ?? 0) === 6, rallyArtGame.draw);
shoot("rally-multi-pad-414x896", "rally", "near", 7, (s) => !s.twin && (s.multiAt ?? 0) > 0 && s.tick >= (s.multiAt ?? 0) + 30, rallyArtGame.draw);
// Breaker: gold bricks glinting on a direct line, a combo multiplier, a gold brick breaking.
const brkDraw = breakerArtGameFor(breaker.BRK_REV_DEEP).draw;
shoot("breaker-gold-glint-414x896", "breaker", "near", 15, (s) => s.balls.some((b: any) => b.d === 1 && b.vy < 0 && b.y < 400 * 256) && s.tick > 900, brkDraw);
shoot("breaker-combo-414x896", "breaker", "near", 15, (s) => breaker.brkComboMultiplier(s.chain ?? 0) >= 2, brkDraw);
shoot("breaker-gold-break-414x896", "breaker", "near", 15, (s) => (s.goldBroken ?? 0) >= 1, brkDraw);
void rally;
