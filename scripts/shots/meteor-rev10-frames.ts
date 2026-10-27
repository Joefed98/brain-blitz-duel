/**
 * Meteor snakeRev 10 review frames (docs/phone-notes-oct-2026/snake.md): the real renderer (@napi-rs/canvas) at the
 * iPhone 11 home-screen app's arena box (414 × 772; 2× pixels), from elite bot runs, at moments showing the comet,
 * the three wormhole pairs, both vertical lanes, a gold star and a 2 × 2 rock (landed, and its shadow falling).
 * A design tool, not a check.
 *
 *   bun scripts/shots/meteor-rev10-frames.ts [--out=screenshots/phone-notes-oct-2026]
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

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/phone-notes-oct-2026";
mkdirSync(OUT, { recursive: true });
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { snakeArtGame } = await import("../../src/lib/arcade/snake.renderer");
const { SNAKE_REV_10, snakeRockBig } = await import("../../src/lib/arcade/snake");

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const spec = GAME_BY_TYPE.get("snake" as never)!;
const bot = (await import("../arcade-skill-bands/bots/snake")).bot;
function states(n: number): Any[] {
  const seed = spec.seedFor(n);
  const game = spec.gameFor(SNAKE_REV_10, seed);
  const out = bot({ game, seed, rev: SNAKE_REV_10, human: new Human("snake", seed, "elite") } as Any);
  const by = new Map((out.events ?? []).map((e: Any) => [e.t, e]));
  let s = game.init(seed);
  const all = [s];
  while (!game.isOver(s)) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    all.push(s);
  }
  return all;
}
function shoot(name: string, frames: Any[], pick: number): void {
  const canvas = createCanvas(414 * 2, 772 * 2);
  const ctx = canvas.getContext("2d") as Any;
  for (let i = Math.max(0, pick - 30); i <= pick; i++) {
    clockMs = 10_000 + i * (1000 / 60);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    snakeArtGame.draw(ctx, frames[i], { width: 414, height: 772 });
  }
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png (seed index ${name}, tick ${frames[pick].tick})`);
}

for (let n = 0; n < 30; n++) {
  const frames = states(n);
  const landed = frames.findIndex((s) => !s.dead && (s.rocks ?? []).some((r: number) => snakeRockBig(s, r)) && s.gold >= 0);
  const falling = frames.findIndex((s) => !s.dead && s.rockWarn >= 0 && snakeRockBig(s, s.rockWarn) && s.rockLandTick - s.tick < 50);
  if (landed < 0 || falling < 0) continue;
  shoot(`meteor-rev10-start`, frames, 40);
  shoot(`meteor-rev10-big-rock`, frames, landed);
  shoot(`meteor-rev10-big-shadow`, frames, falling);
  console.log(`room seed index ${n} (seed ${spec.seedFor(n)})`);
  break;
}
