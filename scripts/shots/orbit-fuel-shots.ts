/**
 * Orbit's fuel meter (orbitRev 14, 1 Nov 2026) review frames: the game's own renderer (orbit.renderer.ts, through the
 * art sim so the camera observes every tick) drawing states from the first fuel-bank course (src/lib/duel/orbitFuelBank.server.ts):
 * mid-flight on the witness run (the meter draining), and a release into empty space just after the tank runs dry
 * ("OUT OF FUEL", after the 0.6 s sputter; and, at 414 × 896, `sputter`: 0.3 s into it), in the play screen's geometry: a 60 px header stand-in and the arena box under it, the 450 × 862
 * drawn world at the largest uniform scale (414 × 896, the iPhone 11 home-screen box: 772 px tall), at 2× device
 * pixels; and the computer layout at 1366 × 768 (`tall` mode: a 56 px header, the world in the ≤ 640 px column, full
 * height to 16 px above the bottom). A design tool, not a check.
 *
 *   bun scripts/shots/orbit-fuel-shots.ts [--out=screenshots/arcade-tuning-nov-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { ORBIT_INPUT_TAP } from "../../src/lib/arcade/orbit";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initFuelFrom, ORBIT_FUEL_MAX, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { orbitCameraResetCache } from "../../src/lib/arcade/orbitCamera";
import { orbitRev3ArtGame, ORBIT_XP_DRAW_H, setOrbitSputterClock } from "../../src/lib/arcade/orbit.renderer";
import { ORBIT_FUEL_BANK } from "../../src/lib/duel/orbitFuelBank.server";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/arcade-tuning-nov-2026";
mkdirSync(OUT, { recursive: true });
const DPR = 2;
const W = 450;
const H = ORBIT_XP_DRAW_H;
const ev = (t: number): ArcadeInputEvent => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
const e = ORBIT_FUEL_BANK[0]!;
const start = () => initFuelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras));

/** Plays `taps` until `until(state)` holds (each tick through the art sim, so the camera observes it). */
function playTo(taps: readonly number[], until: (s: OrbitRev3State) => boolean): OrbitRev3State {
  orbitCameraResetCache();
  const set = new Set(taps);
  let s = start();
  while (!until(s) && !(s.ended && s.tick > 0)) s = orbitRev3ArtGame.step(s, set.has(s.tick + 1) ? ev(s.tick + 1) : null) as OrbitRev3State;
  return s;
}

/** `sputter`: the ms into an out-of-fuel sputter the frame shows (the renderer's sputter clock, pinned). */
function shoot(state: OrbitRev3State, name: string, view: { w: number; h: number; header: number; col: number; label: string }, sputter = 1000): void {
  const canvas = createCanvas(view.w * DPR, view.h * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, view.w, view.h);
  const boxH = view.h - view.header - 16;
  const scale = Math.min(view.col / W, boxH / H);
  const aw = W * scale, ah = H * scale;
  // The header stand-in: name left, the timer centred.
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "700 17px Archivo";
  ctx.textAlign = "left";
  ctx.fillText("Orbit", (view.w - view.col) / 2 + 16, view.header / 2 + 6);
  ctx.textAlign = "center";
  ctx.font = "700 15px 'JetBrains Mono'";
  ctx.fillText(`${Math.max(0, 90 - Math.floor(state.tick / 60))}`, view.w / 2, view.header / 2 + 6);
  ctx.save();
  ctx.translate((view.w - aw) / 2, view.header);
  ctx.scale(scale, scale);
  // Twice on a pinned clock: the first draw is where the canvas first sees the run's end, the second `sputter` ms on.
  setOrbitSputterClock(() => 0);
  orbitRev3ArtGame.draw(ctx, state, { width: W, height: H });
  setOrbitSputterClock(() => sputter);
  orbitRev3ArtGame.draw(ctx, state, { width: W, height: H });
  setOrbitSputterClock(null);
  ctx.restore();
  const file = `${OUT}/orbit-fuel-${name}-${view.label}.png`;
  writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(`${file}: tick ${state.tick}, fuel ${state.fuel}/${ORBIT_FUEL_MAX}, flying ${state.flying}, cur ${state.cur}`);
}

const PHONE = { w: 414, h: 896, header: 108, col: 414, label: "414x896" };
const DESKTOP = { w: 1366, h: 768, header: 56, col: 640, label: "1366x768" };
// Mid-flight: the witness's tenth hop, some way through its flight (the meter part drained).
const tenth = e.taps[9]!;
// The first witness hop from the tenth on whose flight lasts 40+ ticks, two thirds of the way through it.
let flight = playTo(e.taps, (s) => s.tick >= tenth + 34);
for (const tap of e.taps.slice(9)) {
  const landed = playTo(e.taps, (s) => s.tick > tap && s.flying === 0);
  const ticks = landed.tick - tap;
  if (landed.ended || ticks < 40) continue;
  flight = playTo(e.taps, (s) => s.tick >= tap + Math.trunc((ticks * 2) / 3));
  break;
}
// Empty: from the same orbit, a release that flies into empty space, a few ticks after the tank runs dry.
let dryTap = -1;
for (let d = 0; d < 300 && dryTap < 0; d++) {
  const s = playTo([...e.taps.slice(0, 9), tenth + d], (q) => q.ended !== 0 || (q.tick > tenth + d && q.flying === 0 && q.tick > tenth + d + 1));
  if (s.ended === 2 && s.dry === s.endedTick) dryTap = tenth + d;
}
const empty = playTo([...e.taps.slice(0, 9), dryTap], (s) => s.ended !== 0);
// A frame partway through that miss (the meter low and red) as well.
const low = playTo([...e.taps.slice(0, 9), dryTap], (s) => s.tick >= dryTap + Math.trunc(ORBIT_FUEL_MAX * 0.8));
for (const view of [PHONE, DESKTOP]) {
  shoot(flight, "mid-flight", view);
  shoot(low, "low", view);
  shoot(empty, "empty", view);
}
// Mid-sputter: 300 ms after the tank ran dry (smoke, the rocket tumbling away, the meter flashing red).
shoot(empty, "sputter", PHONE, 300);
