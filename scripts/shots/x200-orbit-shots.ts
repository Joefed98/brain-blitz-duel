/**
 * Orbit orbitRev 12 review frames (docs/expansions/x200-orbit.md): the real renderer (@napi-rs/canvas) at the
 * iPhone 11 play box (414 × 772 CSS px; the 450 × 782 view at its fitted scale, 414 × 719, 2× pixels), from a
 * feature-bank course's witness run (every feature taken), on the ticks where a stardust trail, a slingshot moon,
 * an asteroid field, a perfect orbit's first-lap arc and a black hole are on screen. A design tool, not a check;
 * the game frame's header is not part of the arena. @napi-rs/canvas has no retro font, so HUD text is plain.
 *
 *   bun scripts/shots/x200-orbit-shots.ts [--out=screenshots/x200-oct-2026] [--seed=<room seed>]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: (el: any) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as any).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = arg("out") ?? "screenshots/x200-oct-2026";
const ROOM_SEED = Number(arg("seed") ?? 12345);
mkdirSync(OUT, { recursive: true });
const { orbitRev3ArtGame } = await import("../../src/lib/arcade/orbit.renderer");
const { orbitStartForPuzzle } = await import("../../src/lib/arcade/orbitRev3");
const { ORBIT_INPUT_TAP, ORBIT_REV_XP } = await import("../../src/lib/arcade/orbit");
const { orbitXpCourseForSeed } = await import("../../src/lib/duel/orbitRev3Course.server");
const { ORBIT_XP_BANK } = await import("../../src/lib/duel/orbitXpBank.server");

const course = orbitXpCourseForSeed(ROOM_SEED)!;
const entry = ORBIT_XP_BANK.find((e) => JSON.stringify(e.extras) === JSON.stringify(course.extras))!;
const start = orbitStartForPuzzle({ orbitRev: ORBIT_REV_XP, planets: course.planets, holes: course.holes, extras: course.extras })!;
const taps = new Set(entry.taps);

/** The 450 × 782 view fitted into the 414 × 772 box: 414 × 719 CSS px. */
const W = 414;
const H = Math.round((782 * W) / 450);
const DPR = 2;

// Play the witness through the art game (camera and effects observe every tick) and keep every state.
const states: any[] = [];
let s: any = start();
while (!s.ended && s.tick < orbitRev3ArtGame.runTicks) {
  s = orbitRev3ArtGame.step(s, taps.has(s.tick + 1) ? { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
  states.push(s);
}
const near = (st: any, x: number, y: number, r: number) => Math.hypot(st.x - x, st.y - y) < r * 256;
const bits = (n: number) => n.toString(2).replace(/0/g, "").length;
/** The first tick each moment shows, plus a few ticks to let it play. */
const moments: [string, (st: any, prev: any) => boolean, number][] = [
  ["stardust", (st, prev) => bits(st.dustGot ?? 0) === 3 && bits(prev.dustGot ?? 0) === 2, 0],
  ["slingshot", (st) => st.flying && (st.moons ?? []).some((m: any) => near(st, m.x, m.y, 30)), 0],
  ["asteroid-field", (st) => st.flying && (st.fields ?? []).some((f: any) => near(st, (f.ax + f.bx) / 2, (f.ay + f.by) / 2, 26)), 0],
  ["perfect-orbit", (st, prev) => (st.perfect ?? 0) > (prev.perfect ?? 0) && (st.perfect ?? 0) >= 3, 14],
  ["black-hole", (st) => st.cur > 8 && !st.flying && (st.holes ?? []).some((h: any) => h.from === st.cur && h.to > st.cur), 20],
];
const canvas = createCanvas(W * DPR, H * DPR);
const ctx = canvas.getContext("2d") as any;
for (const [name, pick, after] of moments) {
  let found = -1;
  for (let i = 1; i < states.length && found < 0; i++) if (pick(states[i], states[i - 1])) found = Math.min(states.length - 1, i + after);
  if (found < 0) {
    console.log(`${name}: not on this run`);
    continue;
  }
  for (let i = Math.max(0, found - 90); i <= found; i++) {
    clock += 1000 / 60;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    orbitRev3ArtGame.draw(ctx, states[i], { width: W, height: H });
  }
  const file = `${OUT}/orbit-${name}-414x896.png`;
  writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(`${file}: tick ${states[found].tick}`);
}
