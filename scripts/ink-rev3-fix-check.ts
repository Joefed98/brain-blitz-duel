/**
 * Rainbow Bridge inkRev 3 fix check: every round draws white birds (no red blocks), live rounds 9–10
 * carry hardest-layout birds plus the shield row in both the sim and the drawn frame, the fallback
 * layout is rare, and Undo before release refunds the capped first line so it can be redrawn.
 * Usage: bun scripts/ink-rev3-fix-check.ts [seeds=40]
 */
import {
  inkBridgeGameFor,
  INK_REV3,
  INK_INPUT_STROKE,
  INK_INPUT_UNDO,
  INK_LIVE_PRE_CAP,
  type InkState,
} from "../src/lib/arcade/inkBridge";

let drawnBirds = 0;
let currentBlocks: { x0: number; x1: number; y: number }[] = [];
const ctxStub: any = new Proxy(
  {},
  {
    get(_t, key) {
      if (key === "drawImage")
        return (_img: unknown, x: number, y: number) => {
          if (currentBlocks.some((b) => x >= b.x0 - 0.5 && x <= b.x1 && Math.abs(y - b.y) < 0.5)) drawnBirds++;
        };
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      if (key === "measureText") return () => ({ width: 10 });
      return () => {};
    },
    set() {
      return true;
    },
  },
);
(globalThis as any).OffscreenCanvas = class {
  constructor(public width: number, public height: number) {}
  getContext() {
    return ctxStub;
  }
};
const { drawInkBridgeArt } = await import("../src/lib/arcade/inkBridge.renderer");

const seeds = Number(process.argv[2] ?? 40);
const fails: string[] = [];
let fallbacks = 0;
let liveLevels = 0;
const t0 = Date.now();
const game = inkBridgeGameFor(INK_REV3);
for (let n = 0; n < seeds; n++) {
  const seed = 9001 + n * 7919;
  const st = game.init(seed) as InkState;
  st.list.forEach((lvl, i) => {
    if (lvl.blocks.length === 0) fails.push(`seed ${seed} round ${i + 1}: no obstacles`);
    if (lvl.blocks.some((b) => !b.h)) fails.push(`seed ${seed} round ${i + 1}: red block (no bird h)`);
    if (i >= 8) {
      liveLevels++;
      const shield = lvl.blocks.some((b) => b.x0 <= lvl.spoutX && b.x1 >= lvl.spoutX && b.x1 - b.x0 >= 100);
      if (!shield) fails.push(`seed ${seed} round ${i + 1}: no shield row`);
      const fb = lvl.spoutX === 120 && lvl.bucketX === 300 && lvl.blocks.length === 1;
      if (fb) fallbacks++;
      if (!fb && lvl.blocks.length < 3) fails.push(`seed ${seed} round ${i + 1}: only ${lvl.blocks.length} obstacles`);
    }
    // Drawn frame: every obstacle gets bird sprites at its own box.
    drawnBirds = 0;
    currentBlocks = lvl.blocks;
    drawInkBridgeArt(ctxStub, { ...st, level: i }, { width: 390, height: 620 });
    if (drawnBirds < lvl.blocks.length) fails.push(`seed ${seed} round ${i + 1}: drew ${drawnBirds} bird sprites for ${lvl.blocks.length} obstacles`);
  });
}

// Undo before release on a live round refunds the capped line.
{
  let s = game.init(424242) as InkState;
  s = { ...s, level: 8, ink: 2000 * 256, preInkUsed: 0, list: s.list };
  const stroke = (a: number, b: number, c: number) => (s = game.step(s, { k: INK_INPUT_STROKE, a, b, c }) as InkState);
  stroke(100, 60, 1);
  for (let y = 70; y <= 600; y += 10) stroke(100, y, 0);
  const capped = s.preInkUsed;
  if (Math.abs(capped - INK_LIVE_PRE_CAP * 256) > 256 * 2) fails.push(`pre-line cap not reached: ${capped / 256}px`);
  const inkBefore = s.ink;
  s = game.step(s, { k: INK_INPUT_UNDO, a: 1, b: 0, c: 0 }) as InkState;
  if (s.segs.length !== 0) fails.push("undo left segments");
  if (s.preInkUsed !== 0) fails.push(`undo kept cap usage ${s.preInkUsed}`);
  if (s.ink - inkBefore !== capped) fails.push("undo did not refund ink");
  stroke(100, 60, 1);
  stroke(100, 160, 0);
  if (s.segs.length === 0) fails.push("could not redraw after undo");
}

console.log(`seeds ${seeds}, live levels ${liveLevels}, fallback layouts ${fallbacks} (${((100 * fallbacks) / liveLevels).toFixed(1)}%), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (fails.length) {
  console.log(`FAIL ${fails.length}\n` + fails.slice(0, 30).join("\n"));
  process.exit(1);
}
console.log("PASS");
