/**
 * Grappler's Action overhaul frames (15 Nov 2026; a design tool, not a check): the game's own renderer drawing a dealt
 * course (swingRev 17) played by its oracle's stored witness (scripts/fixtures/swing-slide-deal-witness.json.gz), in
 * the play screen's geometry at 390 × 844 (a 60 px header stand-in, the world at the largest uniform scale in the box
 * above a 16 px strip), at the start, a third, two thirds and near the end of the course, plus `--clip` frames for an
 * animated strip of the setting deepening. `--root=<checkout>` draws another tree (e.g. main) for a before → after pair.
 *
 *   bun scripts/shots/swing-overhaul-frames.ts [--root=<checkout>] [--tag=after] [--out=<dir>] [--clip]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROOT = resolve(arg("root") ?? ".");
const TAG = arg("tag") ?? "after";
const OUT = arg("out") ?? ".shots/swing-overhaul";
const CLIP = process.argv.includes("--clip");
mkdirSync(OUT, { recursive: true });
const [W, H] = (arg("size") ?? "390x844").split("x").map(Number) as [number, number];
const HEADER = 52, BOX = H - HEADER - 16;
const SIZE_TAG = W === 390 && H === 844 ? "" : `-${W}x${H}`;

const S = await import(`${ROOT}/src/lib/arcade/swing.ts`);
const SR = await import(`${ROOT}/src/lib/arcade/swing.renderer.ts`);
const F = await import(`${ROOT}/src/lib/arcade/arenaFills.renderer.ts`);
const J = await import(`${ROOT}/src/lib/arcade/swingJungle.renderer.ts`);
type Ev = { t: number };
const witnesses = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/swing-slide-deal-witness.json.gz")).toString()) as { witnesses: { seed: number; events: Ev[] }[] }).witnesses;
const w = witnesses[Number(arg("course") ?? 2)]!;
const rev = S.SWING_REV_SLIDE;
const game = S.swingGameFor(rev);
const art = SR.swingArtGameFor(rev);
const by = new Map(w.events.map((e) => [e.t, e]));

function frame(state: unknown, dpr: number, title: boolean): ReturnType<typeof createCanvas> {
  const worldW = S.swingWorldW(state), worldH = S.swingWorldH(state);
  const scale = Math.min(W / worldW, BOX / worldH);
  const aw = worldW * scale, ah = worldH * scale;
  const canvas = createCanvas(W * dpr, H * dpr);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  // The screen fill (the play screen's scene canvas) out to the screen's edges, in world units, then the world.
  const ax = (W - aw) / 2;
  ctx.save();
  ctx.translate(ax, HEADER);
  ctx.scale(scale, scale);
  const view = { worldW, worldH, left: -ax / scale, top: 0, right: (W - ax) / scale, bottom: (H - HEADER) / scale, scale };
  const sceneOf = SR.swingJungleScene ? SR.swingJungleScene(state) : null;
  const fill = F.swingFillFor(rev, () => (sceneOf ? { depth: sceneOf.step / J.SWING_DEPTH_STEPS, darkRight: sceneOf.darkRight, dim: sceneOf.dim } : { depth: 0 }));
  fill(ctx, view);
  ctx.restore();
  ctx.save();
  ctx.translate(ax, HEADER);
  art.draw(ctx, state, { width: aw, height: ah });
  ctx.restore();
  if (title) {
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "700 16px Archivo";
    ctx.fillText("Grappler", 14, 30);
    ctx.fillStyle = "#BDBDCC";
    ctx.font = "500 12px Archivo";
    ctx.fillText(TAG === "before" ? "Before (main)" : "After", 14, 48);
  }
  return canvas;
}

let s = game.init(w.seed);
const total = s.sections.length;
const stills: [string, (st: typeof s) => boolean][] = [
  ["start", (st) => st.tick >= 240 && st.rope >= 0],
  ["third", (st) => (st.sec ?? 0) >= Math.round(total / 3) && st.rope >= 0],
  ["two-thirds", (st) => (st.sec ?? 0) >= Math.round((2 * total) / 3) && st.rope >= 0],
  ["late", (st) => (st.sec ?? 0) >= total - 4 && st.rope >= 0],
];
// The clip: four 1.5 s windows (start, a third, two thirds, late), 12 frames a second.
const windows = stills.map(() => -1);
let clipN = 0;
while (!game.isOver(s)) {
  s = game.step(s, by.get(s.tick + 1) ?? null);
  clock += 1000 / 60;
  stills.forEach(([name, pick], i) => {
    if (windows[i] === -1 && pick(s)) {
      windows[i] = s.tick;
      writeFileSync(`${OUT}/swing-${name}${SIZE_TAG}-${TAG}.png`, frame(s, 2, true).toBuffer("image/png"));
      console.log(`${OUT}/swing-${name}${SIZE_TAG}-${TAG}.png (tick ${s.tick}, stretch ${s.sec}/${total})`);
    }
  });
  if (CLIP && windows.some((t) => t >= 0 && s.tick >= t && s.tick < t + 90 && (s.tick - t) % 5 === 0)) {
    writeFileSync(`${OUT}/clip-${String(clipN++).padStart(3, "0")}.png`, frame(s, 1, false).toBuffer("image/png"));
  }
}
console.log(`run ended at tick ${s.tick}, stretch ${s.sec}/${total}, score ${game.score(s)}`);
