/**
 * Cue Ball's aim sweep (1 Nov 2026, poolRev 3 tuning): a frame strip of the real renderer (drawPool, the cue, the
 * dotted line to the ghost ball, the object ball's and the cue ball's lines) as the aim turns through a full circle,
 * plus a close-up of a slow turn in 0.25° steps showing the line moving by a fraction of a pixel a step (the aim is a
 * continuous angle: no snapping, rounding or skipped angles). Writes screenshots/cue-ball-aim-nov-2026/.
 *
 *   bun scripts/shots/pool-aim-strip.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined")
  Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const { poolGameFor, POOL_CUE, POOL_W, POOL_H } = await import("../../src/lib/arcade/pool");
const { drawPool } = await import("../../src/lib/arcade/pool.renderer");
const { POOL_BANK_V3 } = await import("../../src/lib/duel/poolBankV3.server");

const out = new URL("../../screenshots/cue-ball-aim-nov-2026/", import.meta.url);
mkdirSync(out, { recursive: true });
const state = poolGameFor(3).init(POOL_BANK_V3[0]!);
const cue = state.balls.find((b) => b.id === POOL_CUE)!;

/** One frame of the table with the aim at `deg` degrees (0 = right, 90 = down). */
function frame(deg: number, scale: number): ReturnType<typeof createCanvas> {
  const c = createCanvas(Math.round(POOL_W * scale), Math.round(POOL_H * scale));
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(scale, scale);
  const a = (deg * Math.PI) / 180;
  drawPool(ctx, state, { dx: Math.cos(a), dy: Math.sin(a), power: 0.45, spinX: 0, spinY: 0 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, 64, 22);
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(`${deg.toFixed(deg % 1 ? 2 : 0)}°`, 6, 16);
  return c;
}

// The full circle: 24 frames, 15° apart, in a 6 × 4 sheet at half size.
const S = 0.5;
const fw = Math.round(POOL_W * S);
const fh = Math.round(POOL_H * S);
const sheet = createCanvas(fw * 6, fh * 4);
const sctx = sheet.getContext("2d");
for (let k = 0; k < 24; k++) sctx.drawImage(frame(k * 15, S), (k % 6) * fw, Math.floor(k / 6) * fh);
writeFileSync(new URL("aim-full-circle.png", out), sheet.toBuffer("image/png"));

// A slow turn: 0.25° a frame round the aim at the nearest ball, a close-up round the cue ball at 2×.
const Z = 2;
const cx = cue.x / 256;
const cy = cue.y / 256;
const box = 200;
const steps = 12;
const strip = createCanvas(box * Z * 6, box * Z * 2);
const tctx = strip.getContext("2d");
const base = -100;
for (let k = 0; k < steps; k++) {
  const f = frame(base + k * 0.25, Z);
  tctx.drawImage(f, (cx - box / 2) * Z, (cy - box + 24) * Z, box * Z, box * Z, (k % 6) * box * Z, Math.floor(k / 6) * box * Z, box * Z, box * Z);
}
writeFileSync(new URL("aim-fine-steps.png", out), strip.toBuffer("image/png"));
console.log("wrote screenshots/cue-ball-aim-nov-2026/aim-full-circle.png and aim-fine-steps.png");
