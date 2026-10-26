/**
 * Expansion E2 review frames (docs/expansions/e2.md): Meteor and Tempo's new revisions drawn by their
 * real renderers (@napi-rs/canvas) at the iPhone 11 home-screen app's arena box (414 × 772; 2× pixels), from near-perfect bot runs using the features, at moments that
 * show every new feature. A design tool, not a check.
 *
 *   bun scripts/shots/e2-frames.ts [--out=screenshots/expansion-e2-oct-2026]
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

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/expansion-e2-oct-2026";
mkdirSync(OUT, { recursive: true });
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { snakeArtGame } = await import("../../src/lib/arcade/snake.renderer");
const { beatArtGame } = await import("../../src/lib/arcade/beat.renderer");
const { SNAKE_REV_200 } = await import("../../src/lib/arcade/snake");
const { BEAT_REV_200 } = await import("../../src/lib/arcade/beat");

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Plays the bot run and returns every state, so a frame can be picked by what it shows. */
async function states(type: string, rev: number, n: number): Promise<Any[]> {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const bot = (await import(`../arcade-skill-bands/bots/${type}.ts`)).bot;
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, "near") });
  const by = new Map((out.events ?? []).map((e: Any) => [e.t, e]));
  let s = game.init(seed);
  const all = [s];
  while (!game.isOver(s)) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    all.push(s);
  }
  return all;
}

function shoot(name: string, w: number, h: number, draw: (ctx: Any, size: { width: number; height: number }) => void, frames: Any[], pick: number): void {
  const canvas = createCanvas(w * 2, h * 2);
  const ctx = canvas.getContext("2d") as Any;
  // Warm the renderer's memories (pops, pulses) over the half second before the frame.
  for (let i = Math.max(0, pick - 30); i <= pick; i++) {
    clockMs = 10_000 + i * (1000 / 60);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    draw(ctx, frames[i]);
  }
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png (tick ${frames[pick].tick})`);
}

// Meteor: a gold star out, a combo running, the meteor on a speed lane, wormholes on the board.
{
  let frames: Any[] = [];
  let pick = -1;
  for (let n = 0; n < 12 && pick < 0; n++) {
    frames = await states("snake", SNAKE_REV_200, n);
    pick = frames.findIndex((s) => s.tick > 900 && s.gold >= 0 && (s.combo ?? 0) >= 2 && (s.laneRun ?? 0) >= 3 && !s.dead);
    if (pick < 0) pick = frames.findIndex((s) => s.tick > 900 && s.gold >= 0 && (s.laneRun ?? 0) >= 2 && !s.dead);
  }
  shoot("meteor-features", 414, 772, (ctx, s) => snakeArtGame.draw(ctx, s, { width: 414, height: 772 }), frames, pick);
  const warp = frames.findIndex((s, i) => i > 0 && (s.warpsUsed ?? 0) > (frames[i - 1].warpsUsed ?? 0));
  if (warp > 0) shoot("meteor-warp", 414, 772, (ctx, s) => snakeArtGame.draw(ctx, s, { width: 414, height: 772 }), frames, warp + 4);
}
// Tempo: five lanes, fever on, a golden note and a double tap in view.
{
  const visible = (s: Any, test: (i: number) => boolean) => s.chart.ticks.some((t: number, i: number) => t - s.tick > 10 && t - s.tick < 80 && test(i));
  let frames: Any[] = [];
  let pick = -1;
  for (let n = 0; n < 12 && pick < 0; n++) {
    frames = await states("beat", BEAT_REV_200, n);
    pick = frames.findIndex((s) => s.tick > 2500 && (s.fever ?? 0) > 60 && visible(s, (i) => s.chart.golds[i]) && visible(s, (i) => s.chart.pairs[i] >= 0));
  }
  if (pick < 0) frames = await states("beat", BEAT_REV_200, 0);
  if (pick < 0) pick = frames.findIndex((s) => s.tick > 2500 && (s.fever ?? 0) > 60 && visible(s, (i) => s.chart.golds[i] || s.chart.pairs[i] >= 0));
  if (pick < 0) pick = frames.findIndex((s) => s.tick > 2500 && (s.fever ?? 0) > 60);
  shoot("tempo-features", 414, 772, (ctx, s) => beatArtGame.draw(ctx, s, { width: 414, height: 772 }), frames, pick);
  const meter = frames.findIndex((s) => (s.meter ?? 0) >= 60 && s.tick < 2300);
  if (meter > 0) shoot("tempo-meter-full", 414, 772, (ctx, s) => beatArtGame.draw(ctx, s, { width: 414, height: 772 }), frames, meter + 5);
  shoot("tempo-five-lanes-break", 414, 772, (ctx, s) => beatArtGame.draw(ctx, s, { width: 414, height: 772 }), frames, 2380);
}
