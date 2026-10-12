/** No browser, native raster dependency, simulation replay or identity proof. */
import { canvasStub } from "./canvas-stub";
import assert from "node:assert/strict";
import { burstGame } from "../src/lib/arcade/burst";
import { burstArtGame, BURST_FX_ENEMY_THRESHOLD, BURST_FX_SHOT_THRESHOLD } from "../src/lib/arcade/burst.renderer";
import { FX_PARTICLE_LIMIT } from "../src/lib/fx/limits";

let allocations = 0;
function context() {
  const stats = { rects: 0, blits: 0, liveBlur: 0, depth: 0 };
  const ctx = canvasStub({ getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
    fillRect: () => stats.rects++, drawImage: () => stats.blits++,
    save: () => stats.depth++, restore: () => stats.depth-- },
    (key, value) => { if (key === "shadowBlur" && (value as number) > 0) stats.liveBlur++; });
  return { ctx, stats };
}
class FakeCanvas {
  width: number; height: number;
  constructor(width: number, height: number) { this.width = width; this.height = height; allocations++; }
  getContext() { return context().ctx; }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: FakeCanvas });
const state = burstGame.init(17);
Object.assign(state, { tick: 600, wave: 9, burst: 1, shield: 1, popTick: 598 });
state.balls = Array.from({ length: 40 }, (_, i) => ({ size: i % 4, x: (40 + i % 8 * 43) * 256, y: 300 * 256, vx: 0, vy: 0 }));
state.shots = Array.from({ length: 12 }, (_, i) => ({ short: 1, x: (30 + i * 28) * 256, top: 280 * 256 }));
const { ctx, stats } = context();
const before = JSON.stringify(state);
const draw = (width = 390, height = 560) => burstArtGame.draw(ctx, state, { width, height });
draw();
const warmAllocations = allocations;
for (let frame = 0; frame < 120; frame++) draw();
assert.equal(allocations, warmAllocations, "warm frames must never allocate new raster layers");
assert.equal(stats.liveBlur, 0, "no live object blur");
assert.equal(stats.depth, 0, "balanced canvas save/restore");
assert.equal(JSON.stringify(state), before, "drawing cannot mutate game state");
draw(375, 500);
assert.equal(allocations, warmAllocations + 1, "only scanlines rebuild after canvas size changes");

// Remove objects: particle rectangles are distinguishable from the five world rectangles.
state.balls = []; state.shots = []; state.shield = 0; state.invuln = 0;
state.tick = 1; state.popTick = -100;
let baselineStart = stats.rects;
draw();
const baselineRects = stats.rects - baselineStart;
let maxParticles = 0;
for (let tick = 2; tick < 30; tick++) {
  state.tick = tick; state.popTick = tick;
  const previous = stats.rects;
  draw();
  const particles = stats.rects - previous - baselineRects;
  maxParticles = Math.max(maxParticles, particles);
  assert(particles <= FX_PARTICLE_LIMIT, `particle count ${particles} exceeds shared cap`);
}
assert.equal(maxParticles, FX_PARTICLE_LIMIT);
state.tick = 100;
state.popTick = 100;
state.balls = Array.from({ length: BURST_FX_ENEMY_THRESHOLD + 1 }, () => ({ size: 0, x: 100 * 256, y: 300 * 256, vx: 0, vy: 0 }));
let previous = stats.rects;
draw();
assert.equal(stats.rects - previous, baselineRects, "crowded enemies suppress new particles");
state.balls = []; state.tick++; // Do not spawn a previously suppressed pop after load drops.
previous = stats.rects;
draw();
assert.equal(stats.rects - previous, baselineRects);
state.tick = 130; state.popTick = 130;
state.shots = Array.from({ length: BURST_FX_SHOT_THRESHOLD + 1 }, () => ({ short: 1, x: 100 * 256, top: 280 * 256 }));
previous = stats.rects;
draw();
assert.equal(stats.rects - previous, baselineRects + state.shots.length, "crowded shots suppress new particles");
delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
const fallback = context();
burstArtGame.draw(fallback.ctx, state, { width: 100, height: 100 });
assert.equal(fallback.stats.depth, 0);
console.log(`Burst art checks passed: cached warm frames, zero live blur, resize, immutable state, ${FX_PARTICLE_LIMIT}-particle cap, ${BURST_FX_ENEMY_THRESHOLD}/${BURST_FX_SHOT_THRESHOLD} spawn thresholds and no-canvas fallback.`);