/**
 * Home Run's rev-4 frames (a design tool, not a check; 3 Nov 2026, homerunRev 4): the real renderer (@napi-rs/canvas)
 * draws an elite bot's run on a rev-4 deal seed at four moments side by side in one PNG: a spot chosen before the
 * pitch (the fielders in their catch areas and the lit sign), a curveball in flight with the ring closing, the batted
 * ball landing, and the next pitch's wind-up.
 *
 *   bun scripts/shots/homerun-spot-frames.ts [out.png] [--level=elite] [--n=4]
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { homerunGameFor, homerunPlan, HOMERUN_REV_4, HOMERUN_SWING_TICKS, HOMERUN_WORLD_H, HOMERUN_WORLD_W, PITCH_CURVE } from "../../src/lib/arcade/homerun";
import { drawHomerunArt } from "../../src/lib/arcade/homerun.renderer";
import { HOMERUN_DEAL_V4 } from "../../src/lib/duel/homerunDealV4.server";
import { Human } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/homerun";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) ?? "screenshots/sports-batch-nov-2026/homerun-frames.png";
const level = (args.find((a) => a.startsWith("--level="))?.slice(8) ?? "elite") as "elite";
const n = Number(args.find((a) => a.startsWith("--n="))?.slice(4) ?? 4);
const seed = HOMERUN_DEAL_V4[n]!;
const game = homerunGameFor(HOMERUN_REV_4);
const plan = homerunPlan(seed, HOMERUN_REV_4);
const events = new Map((bot({ game, seed, rev: HOMERUN_REV_4, human: new Human("homerun", seed, level), fixes: true }).events ?? []).map((e) => [e.t, e]));
const curve = Math.max(1, plan.pitches.findIndex((p, i) => i > 0 && p.kind === PITCH_CURVE));
const p = plan.pitches[curve]!;
const ticks = [p.release - 20, p.arrive - HOMERUN_SWING_TICKS - 10, p.arrive + 70, p.arrive + 160];
const W = HOMERUN_WORLD_W;
const H = HOMERUN_WORLD_H;
const canvas = createCanvas(W * ticks.length, H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const frame = createCanvas(W, H);
const fctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = game.init(seed);
ticks.forEach((t, col) => {
  while (s.tick < t) s = game.step(s, events.get(s.tick + 1) ?? null);
  drawHomerunArt(fctx, s, { width: W, height: H });
  ctx.drawImage(frame as unknown as CanvasImageSource, W * col, 0);
});
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`homerun rev-4 frames: ${out} (seed ${seed}, pitch ${curve + 1}, ticks ${ticks.join(", ")})`);
