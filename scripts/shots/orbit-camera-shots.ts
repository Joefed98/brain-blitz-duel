/**
 * Orbit's still camera and stardust (orbitRev 14, Nov 2026, display only) review frames: the game's own renderer
 * (orbit.renderer.ts, through the art sim so the camera observes every tick) drawing the first fuel-bank course's witness
 * run (src/lib/duel/orbitFuelBank.server.ts) in the play screen's geometry (a 60 px header stand-in, the 450 × 862 drawn
 * world at the largest uniform scale in the 414 × 896 iPhone 11 home-screen box, 2× device pixels):
 *
 *  - `orbit-before-catch.png`: a long flight a few ticks before the catch, the camera where it was when the rocket left;
 *  - `orbit-after-catch.png`: the same catch once its ~0.4 s pan has settled on the new planet's framing;
 *  - `orbit-stardust.png`: a moment after a mote is taken, its sparkle trail streaming after the rocket, other motes'
 *    glittering clusters in view.
 *
 * Every frame is drawn as the stage draws it, one tick after another on one canvas (the ship trail and the sparkle trail
 * are per-canvas memories), on a presentation clock pinned to the sim's ticks. A design tool, not a check.
 *
 *   bun scripts/shots/orbit-camera-shots.ts [--out=screenshots/arcade-batch-nov-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { ORBIT_INPUT_TAP } from "../../src/lib/arcade/orbit";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initFuelFrom, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { orbitCamera, orbitCameraPanning, orbitCameraResetCache } from "../../src/lib/arcade/orbitCamera";
import { orbitRev3ArtGame, ORBIT_XP_DRAW_H } from "../../src/lib/arcade/orbit.renderer";
import { ORBIT_FUEL_BANK } from "../../src/lib/duel/orbitFuelBank.server";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/arcade-batch-nov-2026";
mkdirSync(OUT, { recursive: true });
const DPR = 2;
const W = 450;
const H = ORBIT_XP_DRAW_H;
const VIEW = { w: 414, h: 896, header: 108 };

// The presentation clock (the renderer's pops, sparks and catch glow read performance.now()), pinned to the sim's ticks.
let clock = 0;
Object.defineProperty(globalThis.performance, "now", { value: () => clock, configurable: true, writable: true });
// Cached sprites (the glows) are drawn on OffscreenCanvas in the browser: napi canvases stand in.
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const e = ORBIT_FUEL_BANK[0]!;
orbitCameraResetCache();
const taps = new Set(e.taps);
const states: OrbitRev3State[] = [];
let s = initFuelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras));
states.push(s);
while (!s.ended && s.tick < orbitRev3ArtGame.runTicks) {
  s = orbitRev3ArtGame.step(s, taps.has(s.tick + 1) ? { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null) as OrbitRev3State;
  states.push(s);
}

/** Draws ticks `from`..`to` one after another on a fresh canvas (as the stage does) and saves the last frame. */
function shoot(from: number, to: number, name: string): void {
  const canvas = createCanvas(VIEW.w * DPR, VIEW.h * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const boxH = VIEW.h - VIEW.header - 16;
  const scale = Math.min(VIEW.w / W, boxH / H);
  const aw = W * scale;
  for (let t = Math.max(0, from); t <= to; t++) {
    clock = t * (1000 / 60);
    ctx.save();
    ctx.translate((VIEW.w - aw) / 2, VIEW.header);
    ctx.scale(scale, scale);
    orbitRev3ArtGame.draw(ctx, states[t]!, { width: W, height: H });
    ctx.restore();
  }
  const st = states[to]!;
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, VIEW.w, VIEW.header);
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "700 17px Archivo";
  ctx.textAlign = "left";
  ctx.fillText("Orbit", 16, VIEW.header / 2 + 6);
  ctx.textAlign = "center";
  ctx.font = "700 15px 'JetBrains Mono'";
  ctx.fillText(`${Math.max(0, 90 - Math.floor(st.tick / 60))}`, VIEW.w / 2, VIEW.header / 2 + 6);
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, canvas.toBuffer("image/png"));
  const cam = orbitCamera(st);
  console.log(`${file}: tick ${st.tick}, cur ${st.cur}, flying ${st.flying}, camera ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, panning ${orbitCameraPanning(st)}`);
}

// A long flight (40+ ticks) from the tenth hop on: its last tick in flight and the catch.
let release = -1, landed = -1;
for (let t = 1; t < states.length; t++) {
  const a = states[t - 1]!, b = states[t]!;
  if (a.flying === 0 && b.flying > 0) release = t;
  if (a.flying > 0 && b.flying === 0 && release > 0 && b.cur >= 10 && (b.warp ?? 0) === 0 && t - release >= 40) {
    landed = t;
    break;
  }
}
if (landed < 0) throw new Error("no long flight on the witness");
shoot(landed - 50, landed - 4, "orbit-before-catch");
let settled = landed;
while (settled < states.length - 1 && (orbitCameraPanning(states[settled]!) || states[settled]!.tick - landed < 2)) settled++;
shoot(landed - 50, Math.min(states.length - 1, settled + 6), "orbit-after-catch");

// Stardust: the first mote taken from the fifth planet on, with no SLINGSHOT or THREADED pop on screen and another mote in view; the frame 16 ticks (~0.27 s) on.
let taken = -1;
for (let t = 1; t < states.length; t++) {
  const a = states[t - 1]!, b = states[t]!;
  const quiet = (q: OrbitRev3State) => q.threaded === states[Math.max(0, t - 60)]!.threaded && q.slung === states[Math.max(0, t - 60)]!.slung;
  if ((b.dustGot ?? 0) !== (a.dustGot ?? 0) && b.cur >= 4 && quiet(states[Math.min(states.length - 1, t + 16)]!)) {
    const cam = orbitCamera(b);
    const left = (b.dust ?? []).filter((d, i) => !(((b.dustGot ?? 0) >> i) & 1) && Math.abs(d.x / 256 - cam.x - W / 2) < W / 2 && d.y / 256 - cam.y > 0 && d.y / 256 - cam.y < 782);
    if (left.length) {
      taken = t;
      break;
    }
  }
}
if (taken < 0) throw new Error("no stardust pickup with another mote in view");
shoot(taken - 40, taken + 16, "orbit-stardust");
