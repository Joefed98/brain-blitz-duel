/**
 * Roofbound's overhaul frames (15 Nov 2026, docs/design/pages-review/action/GALLERY.md; a design tool, not a check): the
 * Near-perfect skill-band bot plays one dealt course on a stamp, and the game's own renderer (flipArtGameFor) draws its
 * states at chosen ticks with @napi-rs/canvas at 390 × 730 (the world, DPR 2), saving PNGs; `--clip` also saves every
 * 6th tick from 0 s to the end as numbered frames for an animated clip (made with img2webp or Pillow).
 *
 *   bun scripts/shots/flip-overhaul-frames.ts [--rev=13] [--seed=0] [--level=near] [--ticks=600,1800,3300]
 *     [--tag=after] [--out=<dir>] [--clip] [--every=6] [--edge=WxH]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 2,
    getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {},
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const { flipArtGameFor, flipArenaSceneFor } = await import("../../src/lib/arcade/flipArt.renderer");
const { flipGameFor, flipWorldH, FLIP_WORLD_W } = await import("../../src/lib/arcade/flip");

const { FLIP_DEAL } = await import("../../src/lib/duel/flipDeal.server");
const { bot } = await import("../arcade-skill-bands/bots/flip");
const { Human } = await import("../arcade-skill-bands/human");

const rev = Number(opt("rev") ?? 13);
const seed = FLIP_DEAL[Number(opt("seed") ?? 0)]!;
const level = opt("level") ?? "near";
const ticks = (opt("ticks") ?? "600,1800,3300").split(",").map(Number);
const tag = opt("tag") ?? "after";
const out = opt("out") ?? ".shots/flip-overhaul";
const clip = process.argv.includes("--clip");
const every = Number(opt("every") ?? 6);
/** --edge=WxH: also draw each chosen tick edge to edge: the arena scene round the world in a W × H play box (CSS px). */
const edge = opt("edge")?.split("x").map(Number);
mkdirSync(out, { recursive: true });

const game = flipGameFor(rev);
const art = flipArtGameFor(rev);
const run = bot({ game, seed, rev, human: new Human("flip", seed, level as never), fixes: true } as any);
const byTick = new Map((run.events ?? []).map((e: any) => [e.t, e]));
let state = game.init(seed);
const DPR = 2;
const draw = (name: string) => {
  const H = flipWorldH(state);
  const canvas = createCanvas(FLIP_WORLD_W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  art.draw(ctx, state, { width: FLIP_WORLD_W, height: H });
  writeFileSync(`${out}/${name}.png`, canvas.toBuffer("image/png"));
  if (edge && !name.startsWith("clip")) {
    const [bw, bh] = edge as [number, number];
    const scale = Math.min(bw / FLIP_WORLD_W, bh / H);
    const left = -((bw / scale - FLIP_WORLD_W) / 2);
    const view = { worldW: FLIP_WORLD_W, worldH: H, left, top: 0, right: FLIP_WORLD_W - left, bottom: bh / scale, scale };
    const full = createCanvas(bw * DPR, bh * DPR);
    const fctx = full.getContext("2d") as unknown as CanvasRenderingContext2D;
    fctx.scale(DPR * scale, DPR * scale);
    fctx.translate(-left, 0);
    flipArenaSceneFor(rev)(fctx, view);
    fctx.drawImage(canvas as any, 0, 0, FLIP_WORLD_W, H);
    writeFileSync(`${out}/${name}-edge-${bw}x${bh}.png`, full.toBuffer("image/png"));
  }
};
let frame = 0;
for (let t = 1; t <= game.runTicks && !game.isOver(state); t++) {
  state = game.step(state, byTick.get(t) ?? null);
  if (ticks.includes(t)) draw(`flip-${tag}-t${t}`);
  if (clip && t % every === 0) draw(`clip-${tag}-${String(frame++).padStart(4, "0")}`);
}
console.log(`rev ${rev} seed ${seed} ${level}: ended ${state.ended} at ${state.tick}, score ${game.score(state)}; frames in ${out}`);
