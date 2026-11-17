/**
 * The Cards & Board overhaul's effect clips (stage 2, 15 Nov 2026; a tool, not a check): each game's proved flawless
 * line (scripts/cards/flawless.ts, Mahjong's oracle) played through the game's real renderer with its live view (card
 * motion and the effects' timeline) on a virtual clock, the Blender images loaded, at 30 frames a second. Two clips a
 * game: a stretch of play (slides, flips, matches) and the finish (the last moves, then 1.6 s of the payoff).
 *
 *   bun scripts/shots/cards-board-fx-clips.ts --out=<dir>    (PNG frames per clip; cards-board-gallery.py packs them)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, GlobalFonts, Image as NapiImage, Path2D as NapiPath2D } from "@napi-rs/canvas";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/cards-board-fx";
mkdirSync(out, { recursive: true });

// A browser enough for the renderers: images (the real art), offscreen canvases, Path2D, the font.
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.Path2D = NapiPath2D;
g.OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};
g.Image = class extends NapiImage {
  set src(url: string) {
    const file = join(import.meta.dir, "../../public", url);
    const self = this as unknown as { onload?: () => void };
    // napi's Image loads a path or buffer synchronously enough for us; then fire onload.
    super.src = require("node:fs").readFileSync(file);
    queueMicrotask(() => self.onload?.());
  }
  decoding = "async";
};
GlobalFonts.registerFromPath(join(import.meta.dir, "../../public/fonts/archivo-var-latin.woff2"), "Archivo");

const { preloadRealArt } = await import("../../src/lib/arcade/cards/realArt.renderer");
preloadRealArt();
await new Promise((r) => setTimeout(r, 50));

const F = await import("../cards/flawless");
const D = await import("../../src/lib/duel/cards");
const FCR = await import("../../src/lib/arcade/cards/freecell.renderer");
const FC = await import("../../src/lib/arcade/cards/freecell");
const TPR = await import("../../src/lib/arcade/cards/tripeaks.renderer");
const TP = await import("../../src/lib/arcade/cards/tripeaks");
const PYR = await import("../../src/lib/arcade/cards/pyramid.renderer");
const PY = await import("../../src/lib/arcade/cards/pyramid");
const FHR = await import("../../src/lib/arcade/cards/fiveHands.renderer");
const FH = await import("../../src/lib/arcade/cards/fiveHands");
const MJR = await import("../../src/lib/arcade/mahjong.renderer");
const MJ = await import("../../src/lib/arcade/mahjong");
const { mahjongOracle } = await import("../cards-board-oracles");
/** The input on a tick, from a whole log (the engine's inputAt reads only a log being recorded, at its newest event). */
const byTick = new WeakMap<Ev[], Map<number, Ev>>();
function inputAt(events: Ev[], tick: number): Ev | null {
  let m = byTick.get(events);
  if (!m) byTick.set(events, (m = new Map(events.map((e) => [e.t, e]))));
  return m.get(tick) ?? null;
}

type Ev = { t: number; k: number; a: number; b: number; c: number };

interface Game<S, V> {
  name: string;
  w: number;
  h: number;
  init: () => S;
  step: (s: S, e: Ev | null) => S;
  events: Ev[];
  view: () => V;
  draw: (ctx: CanvasRenderingContext2D, s: S, size: { width: number; height: number }, v: V) => void;
  over: (s: S) => boolean;
}

/** Plays a game's line, drawing the ticks in [from, to) and `tail` ms after the end, two ticks a frame. */
function clip<S extends { tick: number }, V extends { fx?: { now: () => number }; motion?: { clock: () => number } }>(game: Game<S, V>, label: string, from: number, to: number, tail = 0): void {
  const dir = join(out, `${game.name}-${label}`);
  mkdirSync(dir, { recursive: true });
  const view = game.view();
  let now = 0;
  if (view.fx) view.fx.now = () => now;
  if (view.motion) view.motion.clock = () => now;
  let s = game.init();
  let frame = 0;
  const canvas = createCanvas(game.w, game.h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const shoot = () => {
    ctx.clearRect(0, 0, game.w, game.h);
    game.draw(ctx, s, { width: game.w, height: game.h }, view);
    writeFileSync(join(dir, `${String(frame++).padStart(3, "0")}.png`), canvas.toBuffer("image/png"));
  };
  while (!game.over(s) && s.tick < to) {
    s = game.step(s, inputAt(game.events, s.tick + 1));
    now = (s.tick * 1000) / 60;
    if (s.tick >= from && s.tick % 2 === 0) shoot();
  }
  for (let ms = 0; ms < tail; ms += 1000 / 30) {
    now += 1000 / 30;
    shoot();
  }
  console.log(`${game.name} ${label}: ${frame} frames`);
}

const decode = (raw: string, d: (r: string) => { events: Ev[] }) => d(raw).events;

const fcLine = F.freecellFlawless(3, 24, 5);
const fc: Game<ReturnType<typeof FC.freecellGameFor>["init"] extends (s: number) => infer S ? S : never, ReturnType<typeof FCR.fcNewView>> = {
  name: "freecell", w: 414, h: 772,
  init: () => FC.freecellGameFor(5).init(3),
  step: (s, e) => FC.freecellGameFor(5).step(s, e as never),
  events: decode(fcLine.raw, D.decodeFreecellRun as never),
  view: () => FCR.fcNewView(),
  draw: (ctx, s, size, v) => FCR.drawFreecell(ctx, s, size, v),
  over: (s) => FC.freecellGameFor(5).isOver(s),
};
const tpLine = F.tripeaksFlawless(3, 18, 3);
const tp = {
  name: "tripeaks", w: 414, h: 772,
  init: () => TP.tripeaksGameFor(3).init(3),
  step: (s: never, e: Ev | null) => TP.tripeaksGameFor(3).step(s, e as never),
  events: decode(tpLine.raw, D.decodeTripeaksRun as never),
  view: () => TPR.tpNewView(),
  draw: (ctx: CanvasRenderingContext2D, s: never, size: { width: number; height: number }, v: ReturnType<typeof TPR.tpNewView>) => TPR.drawTripeaks(ctx, s, size, v),
  over: (s: never) => TP.tripeaksGameFor(3).isOver(s),
} as unknown as Game<{ tick: number }, ReturnType<typeof TPR.tpNewView>>;
const pyLine = F.pyramidFlawless(3, 18, 3);
const py = {
  name: "pyramid", w: 414, h: 772,
  init: () => PY.pyramidGameFor(3).init(3),
  step: (s: never, e: Ev | null) => PY.pyramidGameFor(3).step(s, e as never),
  events: decode(pyLine.raw, D.decodePyramidRun as never),
  view: () => PYR.pyNewView(),
  draw: (ctx: CanvasRenderingContext2D, s: never, size: { width: number; height: number }, v: ReturnType<typeof PYR.pyNewView>) => PYR.drawPyramid(ctx, s, size, v),
  over: (s: never) => PY.pyramidGameFor(3).isOver(s),
} as unknown as Game<{ tick: number }, ReturnType<typeof PYR.pyNewView>>;
const fhLine = F.fiveHandsFlawless(4, 24, 3);
const fh = {
  name: "fivehands", w: 414, h: 772,
  init: () => FH.fiveHandsGameFor(3).init(4),
  step: (s: never, e: Ev | null) => FH.fiveHandsGameFor(3).step(s, e as never),
  events: decode(fhLine.raw, D.decodeFiveHandsRun as never),
  view: () => FHR.fhNewView(),
  draw: (ctx: CanvasRenderingContext2D, s: never, size: { width: number; height: number }, v: ReturnType<typeof FHR.fhNewView>) => FHR.drawFiveHands(ctx, s, size, v),
  over: (s: never) => FH.fiveHandsGameFor(3).isOver(s),
} as unknown as Game<{ tick: number }, ReturnType<typeof FHR.fhNewView>>;
const mj = {
  name: "mahjong", w: MJ.MAHJONG_WORLD_W, h: MJ.MAHJONG_WORLD_H,
  init: () => MJ.mahjongGameFor(2).init(3),
  step: (s: never, e: Ev | null) => MJ.mahjongGameFor(2).step(s, e as never),
  events: mahjongOracle(3, 30, 22) as unknown as Ev[],
  view: () => MJR.mahjongNewView(),
  draw: (ctx: CanvasRenderingContext2D, s: never, size: { width: number; height: number }, v: ReturnType<typeof MJR.mahjongNewView>) => MJR.drawMahjong(ctx, s, size, v),
  over: (s: never) => MJ.mahjongCleared(s as never) || MJ.mahjongGameFor(2).isOver(s),
} as unknown as Game<{ tick: number }, ReturnType<typeof MJR.mahjongNewView>>;

// Each game: a stretch of play, then the finish (the end tick found by a dry run).
for (const game of [fc, tp, py, fh, mj] as Game<{ tick: number }, { fx?: { now: () => number } }>[]) {
  let s = game.init();
  while (!game.over(s) && s.tick < 20_000) s = game.step(s, inputAt(game.events, s.tick + 1));
  const end = s.tick;
  clip(game, "play", 60, 60 + 150);
  clip(game, "finish", Math.max(0, end - 90), end + 1, 1600);
}
