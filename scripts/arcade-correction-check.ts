import { strict as assert } from "node:assert";
import { sliceGame, SLICE_INPUT_BEGIN, SLICE_INPUT_END, SLICE_INPUT_SWIPE, SLICE_COMBO_TICKS, type SliceObject } from "../src/lib/arcade/slice";
import { flipGame, flipWarpAt, FLIP_FLOOR_Y, FLIP_CEIL_Y } from "../src/lib/arcade/flip";
import { snipGame, SNIP_CONFIG } from "../src/lib/arcade/snip";
import { matchupDrawSymbol, MATCHUP_BOMB, MATCHUP_CROSS, MATCHUP_STAR } from "../src/lib/arcade/matchup";
import { crossGame, CROSS_KERB_H, CROSS_LANE_H } from "../src/lib/arcade/cross";
import { tiltGame } from "../src/lib/arcade/tilt";

// A C-shaped path whose three segments each cross a different stationary disc.
const objects: SliceObject[] = [[150, 300], [210, 350], [150, 400], [100, 450]].map(([x = 0, y = 0]) => ({
  launchTick: 0, lastTick: 1000, x: x * 256, vx: 0, vy: (y - 640) * 256,
  bomb: false, colour: 0, special: 0, payload: [],
}));
let slice = { ...sliceGame.init(1), objects, slicedAt: [0, 0, 0, 0], available: 4 };
// Reset launch tick per step to make the test's geometry independent of gravity.
function step(k: number, a = 0, b = 0, c = 0, d = 0) {
  slice = { ...slice, objects: slice.objects.map((o) => ({ ...o, launchTick: slice.tick })) };
  slice = sliceGame.step(slice, { t: slice.tick + 1, k, a, b, c, d });
}
step(SLICE_INPUT_BEGIN, 100, 300);
step(SLICE_INPUT_SWIPE, 100, 300, 200, 300);
assert.equal(slice.slices, 1); assert.equal(slice.streak, 0);
// Idle ticks do not break a held finger's swipe.
slice = sliceGame.step(slice, null);
step(SLICE_INPUT_SWIPE, 200, 300, 220, 400);
assert.equal(slice.slices, 2); assert.equal(slice.streak, 0);
step(SLICE_INPUT_SWIPE, 220, 400, 100, 400);
assert.equal(slice.slices, 3); assert.equal(slice.streak, 1);
assert.equal(slice.weighted, 6); assert.equal(slice.bonuses, 1);
assert.equal(slice.comboUntil, slice.tick + SLICE_COMBO_TICKS);
step(SLICE_INPUT_SWIPE, 100, 400, 100, 470);
assert.equal(slice.slices, 4); assert.equal(slice.streak, 1);
step(SLICE_INPUT_END);
assert.equal(slice.strokeCuts, 0);
step(SLICE_INPUT_BEGIN, 100, 470);
assert.equal(slice.strokeLen, 0); assert.equal(slice.streak, 1);
step(SLICE_INPUT_SWIPE, 100, 470, 390, 0);
const cappedLength = slice.strokeLen;
step(SLICE_INPUT_SWIPE, 390, 0, 0, 620);
assert.equal(slice.strokeLen, cappedLength);
console.log("Slice curved C-path: three separate disc hits form exactly one ×2 combo; fourth hit stays in it; up/down resets swipe.");

for (let seed = 1; seed <= 100; seed++) {
  const flip = { ...flipGame.init(seed), tick: 2700 };
  const offsets = [];
  for (let x = 0; x <= 390; x += 10) {
    const floor = flipWarpAt(flip, 0, x * 256);
    const ceil = flipWarpAt(flip, 1, x * 256);
    assert.equal(FLIP_FLOOR_Y + floor - FLIP_CEIL_Y - ceil, 260);
    offsets.push(floor);
  }
  assert.ok(new Set(offsets).size > 1);
}
assert.equal(SNIP_CONFIG.mouthRadius, 32);
for (const direction of [-1, 1]) {
  let s = snipGame.init(1);
  const x = direction < 0 ? 13 : SNIP_CONFIG.worldW - 13;
  s = { ...s, ropes: [], sx: x * 256, sy: 200 * 256, sox: (x - direction * 5) * 256, soy: 200 * 256 };
  const next = snipGame.step(s, null);
  assert.equal(next.sx - next.sox, -direction * 5 * 256);
}

// Draw-command checks only: no browser or other games' replay proofs.
let commands: { method: string; args: unknown[]; fill: unknown }[] = [];
const ctx = new Proxy({ fillStyle: "" } as Record<string, unknown>, {
  get(target, key: string) {
    if (key in target) return target[key];
    return (...args: unknown[]) => { commands.push({ method: key, args, fill: target.fillStyle }); };
  },
  set(target, key: string, value) { target[key] = value; return true; },
}) as unknown as CanvasRenderingContext2D;
for (const kind of [MATCHUP_BOMB, MATCHUP_CROSS, MATCHUP_STAR]) {
  commands = []; matchupDrawSymbol(ctx, kind, 25, 25, 17.5);
  if (kind === MATCHUP_BOMB) assert.ok(commands.some((c) => c.method === "arc"));
  else assert.equal(commands.filter((c) => c.method === "lineTo").length, kind === MATCHUP_CROSS ? 7 : 11);
}
commands = []; crossGame.draw(ctx, crossGame.init(1), { width: 390, height: 620 });
const roadRects = commands.filter((c) => c.method === "fillRect" && c.args[3] === CROSS_KERB_H);
assert.equal(roadRects.length, 2);
const laneRects = commands.filter((c) => c.method === "fillRect" && c.args[3] === CROSS_LANE_H);
assert.ok(laneRects.length > 0 && laneRects.every((c) => c.fill === "#000000"));
commands = []; tiltGame.draw(ctx, tiltGame.init(1), { width: 390, height: 620 });
let vertices = 0;
let redStars = 0;
for (const command of commands) {
  if (command.method === "beginPath") vertices = 0;
  if (command.method === "lineTo") vertices++;
  if (command.method === "fill" && command.fill === "#FF4D5E" && vertices === 11) redStars++;
}
assert.ok(redStars > 0);
console.log("Flip constant-gap curved band, Snip elastic walls/larger mouth, Matchup bomb/four-point/L-T icons, Cross black traffic lanes and Tilt drawing passed.");