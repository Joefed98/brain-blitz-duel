/**
 * Home Run's tells (a design tool, not a check; 1 Nov 2026, homerunRev 3): the real renderer (@napi-rs/canvas) draws,
 * for one pitch of each kind on a rev-3 deal seed, the frame 6 ticks before the release (the tell at full strength:
 * the arm slot, the colour at the glove and the grip bubble) with Power chosen, then a 3× close-up of the pitcher and
 * the bubble under each, side by side in one PNG.
 *
 *   bun scripts/shots/homerun-tell-frames.ts [out.png]
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { homerunGameFor, homerunPlan, HOMERUN_PITCH_NAMES, HOMERUN_REV_3, HOMERUN_WORLD_H, HOMERUN_WORLD_W } from "../../src/lib/arcade/homerun";
import { drawHomerunArt } from "../../src/lib/arcade/homerun.renderer";
import { HOMERUN_DEAL_V3 } from "../../src/lib/duel/homerunDealV3.server";
import { oracleRun } from "../homerun-oracle";

const out = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "screenshots/sports-prepare-nov-2026/homerun-tells.png";
const seed = HOMERUN_DEAL_V3[11]!;
const game = homerunGameFor(HOMERUN_REV_3);
const plan = homerunPlan(seed);
const kinds = [0, 1, 2, 3].map((k) => plan.pitches.findIndex((p) => p.kind === k)).sort((x, y) => x - y);
const events = new Map(oracleRun(seed, HOMERUN_REV_3).map((e) => [e.t, e]));
const W = HOMERUN_WORLD_W;
const H = HOMERUN_WORLD_H;
const ZOOM = { x: 110, y: 170, w: 130, h: 110, k: 3 };
const canvas = createCanvas(W * 4, H + ZOOM.h * ZOOM.k + 30);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
ctx.fillStyle = "#000";
ctx.fillRect(0, 0, canvas.width, canvas.height);
const frame = createCanvas(W, H);
const fctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = game.init(seed);
kinds.forEach((index, col) => {
  const p = plan.pitches[index]!;
  while (s.tick < p.release - 6) s = game.step(s, events.get(s.tick + 1) ?? null);
  drawHomerunArt(fctx, s, { width: W, height: H });
  ctx.drawImage(frame as unknown as CanvasImageSource, W * col, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(frame as unknown as CanvasImageSource, ZOOM.x, ZOOM.y, ZOOM.w, ZOOM.h, W * col, H, ZOOM.w * ZOOM.k, ZOOM.h * ZOOM.k);
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "700 18px sans-serif";
  ctx.fillText(`${HOMERUN_PITCH_NAMES[p.kind]} (pitch ${index + 1})`, W * col + 12, H + ZOOM.h * ZOOM.k + 22);
});
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`homerun tell frames: ${out} (seed ${seed}, pitches ${kinds.map((i) => i + 1).join(", ")})`);
