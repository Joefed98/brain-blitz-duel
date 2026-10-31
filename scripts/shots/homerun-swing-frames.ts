/**
 * Home Run's swing, frame by frame (a design tool, not a check; 31 Oct 2026): the real renderer (@napi-rs/canvas) draws
 * eight frames of one homerunRev 2 pitch on a rev-2 deal seed, the stance, the pitch on its way, the load, the lag, contact
 * (a square, on-time swing at the ball's height), follow-through, finish and the call, side by side in one PNG.
 *
 *   bun scripts/shots/homerun-swing-frames.ts [out.png] [--early=<ticks>]
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { homerunGameFor, homerunPlan, HOMERUN_INPUT_SWING, HOMERUN_REV_2, HOMERUN_SWING_TICKS, HOMERUN_WORLD_H, HOMERUN_WORLD_W } from "../../src/lib/arcade/homerun";
import { drawHomerunArt } from "../../src/lib/arcade/homerun.renderer";
import { HOMERUN_DEAL_V2 } from "../../src/lib/duel/homerunDealV2.server";

const out = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "screenshots/sports-tuning-oct-2026/homerun-swing-frames.png";
const early = Number(process.argv.find((a) => a.startsWith("--early="))?.slice(8) ?? 0);
const seed = HOMERUN_DEAL_V2[11]!;
const game = homerunGameFor(HOMERUN_REV_2);
const p = homerunPlan(seed).pitches[0]!;
const swingAt = p.arrive - HOMERUN_SWING_TICKS - early;
const ticks = [p.release - 20, p.release + 24, swingAt + 2, swingAt + 4, swingAt + 6, swingAt + 9, swingAt + 16, swingAt + 40];
const canvas = createCanvas(HOMERUN_WORLD_W * ticks.length, HOMERUN_WORLD_H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = game.init(seed);
for (let i = 0; i < ticks.length; ) {
  s = game.step(s, s.tick + 1 === swingAt ? { t: swingAt, k: HOMERUN_INPUT_SWING, a: p.plateY, b: 200, c: 0, d: 0 } : null);
  if (s.tick !== ticks[i]) continue;
  ctx.save();
  ctx.translate(HOMERUN_WORLD_W * i, 0);
  ctx.beginPath();
  ctx.rect(0, 0, HOMERUN_WORLD_W, HOMERUN_WORLD_H);
  ctx.clip();
  drawHomerunArt(ctx, s, { width: HOMERUN_WORLD_W, height: HOMERUN_WORLD_H });
  ctx.restore();
  i++;
}
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`homerun swing frames: ${out} (seed ${seed}, pitch 1: ${JSON.stringify(s.hits[0])})`);
