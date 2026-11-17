/**
 * The Retro overhaul's stage-3 moments (16 Nov 2026, a design tool, not a check): each drawn by the game's own renderer
 * in Node from a skill-band bot run on the dealt stamp, as retro-frames.ts draws the arenas. The round-end payoffs (Hover's
 * fly-off, WALL CLEARED!, the boss's staged explosion, Pinball's counter roll) are drawn about 0.9 s into their own
 * presentation clock; Meteor's forgiven crash and Pinball's outlane save a few ticks after the sim's counter rises; and
 * Meteor's wormholes close up.
 *
 *   bun scripts/shots/retro-stage3-frames.ts --out=<dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, retroArtFor, retroRun, type RetroType } from "../retro-render-lib";

const args = process.argv.slice(2);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/retro-stage3";
mkdirSync(OUT, { recursive: true });
const W = 390;
const H = 760;
const DPR = 2;

function canvasFor() {
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  return { canvas, ctx };
}
function paint(ctx: CanvasRenderingContext2D, draw: (c: CanvasRenderingContext2D, s: unknown, size: { width: number; height: number }) => void, s: unknown) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W * DPR, H * DPR);
  ctx.scale(DPR, DPR);
  draw(ctx, s, { width: W, height: H });
}
function save(canvas: ReturnType<typeof createCanvas>, name: string, crop?: { x: number; y: number; w: number; h: number }) {
  let out = canvas;
  if (crop) {
    out = createCanvas(crop.w * DPR, crop.h * DPR);
    (out.getContext("2d") as unknown as CanvasRenderingContext2D).drawImage(canvas as never, crop.x * DPR, crop.y * DPR, crop.w * DPR, crop.h * DPR, 0, 0, crop.w * DPR, crop.h * DPR);
  }
  const file = join(OUT, `${name}.webp`);
  writeFileSync(file, out.toBuffer("image/webp", 82));
  console.log(file);
}

/** A run's states drawn one after another on one canvas (the effect logs age by sim ticks), from `from` to `to`. */
async function sequence(type: RetroType, level: string, pick: (states: any[]) => number, after: number, name: string, opts: { seedIndex?: number; hold?: number } = {}) {
  const run = await retroRun(type, { level, every: 1, seedIndex: opts.seedIndex ?? 0 });
  const at = pick(run.states);
  if (at < 0) {
    console.log(`${name}: no moment in this run`);
    return;
  }
  const draw = await retroArtFor(type, run.rev);
  const { canvas, ctx } = canvasFor();
  const end = Math.min(run.states.length - 1, at + after);
  for (let i = Math.max(0, at - 20); i <= end; i++) paint(ctx, draw as never, run.states[i]);
  if (opts.hold) {
    // retro-render-lib pins performance.now at 10 s for identical frames; the payoff's presentation clock is moved on.
    Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 + opts.hold! } });
    paint(ctx, draw as never, run.states[end]);
    Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
  }
  save(canvas, name);
}

const last = (states: any[]) => states.length - 1;
// Round-end payoffs, 0.9 s into the presentation clock.
await sequence("hover", "elite", (st) => (st.at(-1).crashed ? -1 : last(st)), 0, "hover-flyoff", { hold: 900 });
await sequence("breaker", "elite", (st) => (st.at(-1).cleared ? last(st) : -1), 0, "breaker-wall-cleared", { hold: 900 });
await sequence("wavefront", "perfect", (st) => ((st.at(-1).bossKilled ?? 0) > 0 ? last(st) : -1), 0, "wavefront-boss-down", { hold: 900 });
await sequence("pinball", "near", last, 0, "pinball-counter-roll", { hold: 900 });
// Meteor's forgiven crash: 20 ticks after the grace is used (the first seed of the first few with one).
outer: for (const level of ["weak", "average", "good"]) {
  for (let n = 0; n < 6; n++) {
    const run = await retroRun("snake", { level, every: 1, seedIndex: n });
    if (run.states.some((s: any) => (s.graceUsed ?? 0) > 0)) {
      await sequence("snake", level, (st) => st.findIndex((s, i) => i > 0 && (s.graceUsed ?? 0) > (st[i - 1].graceUsed ?? 0)), 20, "snake-saved", { seedIndex: n });
      break outer;
    }
  }
}
// Pinball's outlane save: 10 ticks after the counter rises (the first seed of the first few that has one).
for (let n = 0; n < 6; n++) {
  const run = await retroRun("pinball", { level: "elite", every: 1, seedIndex: n });
  if (run.states.some((s: any, i: number) => i > 0 && (s.outSaves ?? 0) > ((run.states[i - 1] as any).outSaves ?? 0))) {
    await sequence("pinball", "elite", (st) => st.findIndex((s, i) => i > 0 && (s.outSaves ?? 0) > (st[i - 1].outSaves ?? 0)), 10, "pinball-outlane-save", { seedIndex: n });
    break;
  }
}
// Meteor's wormholes, close up (the arena at 40 % of the run).
{
  const run = await retroRun("snake", { level: "near", until: 0.4 });
  const draw = await retroArtFor("snake", run.rev);
  const { canvas, ctx } = canvasFor();
  paint(ctx, draw as never, run.states.at(-1));
  save(canvas, "snake-wormholes-new");
}
