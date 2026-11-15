/**
 * Clip frames for the Home Run and Top Bins gallery (a design tool, not a check; 15 Nov 2026): the real renderers
 * (@napi-rs/canvas) draw a great-level bot's run on a rev-5 deal seed over a tick range, every `step` ticks, into
 * PNGs in `--out`; `python3 scripts/shots/clip-webp.py <dir> <out.webp>` joins them into an animated WebP.
 *
 *   bun scripts/shots/sports-overhaul-clip.ts --game=homerun|freekick --from=<tick> --to=<tick> [--step=3] [--out=dir]
 *     [--moment=hit|homer|goal] (picks the range round that moment instead of from / to)
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { homerunGameFor, homerunViewHFor, HOMERUN_REV_5, HOMERUN_WORLD_W } from "../../src/lib/arcade/homerun";
import { drawHomerunArt } from "../../src/lib/arcade/homerun.renderer";
import { freekickGameFor, FK_FLIGHT, FREEKICK_REV_5, FREEKICK_WORLD_H, FREEKICK_WORLD_W } from "../../src/lib/arcade/freekick";
import { freekickArtGameFor } from "../../src/lib/arcade/freekick.renderer";
import { homerunDealSeedV5 } from "../../src/lib/duel/homerunDealV5.server";
import { freekickDealSeedV5 } from "../../src/lib/duel/freekickDealV5.server";
import { HR5_DOUBLE, HR5_HOMER, HR5_SINGLE } from "../../src/lib/arcade/homerunInnings";
import { Human } from "../arcade-skill-bands/human";
import { botV5 as hrBot } from "../arcade-skill-bands/bots/homerun";
import { botV5 as fkBot } from "../arcade-skill-bands/bots/freekick";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const gameId = opt("game") ?? "homerun";
const step = Number(opt("step") ?? 3);
const out = opt("out") ?? `.shots/clip-${gameId}`;
mkdirSync(out, { recursive: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
let game: any;
let draw: (ctx: CanvasRenderingContext2D, s: any, size: { width: number; height: number }) => void;
let seed: number;
let W: number;
let H: number;
if (gameId === "homerun") {
  seed = homerunDealSeedV5(Number(opt("n") ?? 0));
  game = homerunGameFor(HOMERUN_REV_5);
  draw = drawHomerunArt as any;
  W = HOMERUN_WORLD_W;
  H = homerunViewHFor(HOMERUN_REV_5);
} else {
  seed = freekickDealSeedV5(Number(opt("n") ?? 0));
  game = freekickGameFor(FREEKICK_REV_5);
  draw = freekickArtGameFor(FREEKICK_REV_5).draw as any;
  W = FREEKICK_WORLD_W;
  H = FREEKICK_WORLD_H;
}
const human = new Human(gameId, seed, "great");
const events = new Map((gameId === "homerun" ? hrBot : fkBot)({ game, seed, rev: 5, human }).events.map((e) => [e.t, e]));
let from = Number(opt("from") ?? 0);
let to = Number(opt("to") ?? 300);
const moment = opt("moment");
if (moment) {
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    if (gameId === "homerun") {
      const h = s.inn.hits[s.inn.hits.length - 1];
      const want = moment === "homer" ? [HR5_HOMER] : [HR5_SINGLE, HR5_DOUBLE];
      if (h && h.at === s.tick && want.includes(h.out) && (moment === "homer" || s.inn.hits.length > 2)) {
        from = h.rel - 70;
        to = h.at + 100;
        break;
      }
    } else if (s.phase === FK_FLIGHT && s.k >= 1 && s.tick === s.kickTick + 1) {
      from = s.kickTick - 70;
      to = s.kickTick + 90;
      break;
    }
  }
}
const frame = createCanvas(W, H);
const ctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = game.init(seed);
let n = 0;
while (!game.isOver(s) && s.tick < to) {
  s = game.step(s, events.get(s.tick + 1) ?? null);
  if (s.tick >= from && (s.tick - from) % step === 0) {
    ctx.clearRect(0, 0, W, H);
    draw(ctx, s, { width: W, height: H });
    writeFileSync(`${out}/f${String(n++).padStart(4, "0")}.png`, frame.toBuffer("image/png"));
  } else if (gameId === "freekick") draw(ctx, s, { width: W, height: H });
}
console.log(`wrote ${n} frames (ticks ${from}–${to}) to ${out}`);
