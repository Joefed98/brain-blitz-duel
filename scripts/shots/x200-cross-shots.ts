/**
 * x200 Jaywalk review frames (crossRev 9, docs/expansions/x200-cross.md): the world drawn by its real renderer
 * (@napi-rs/canvas) into the iPhone 11 play box (414 × 772 CSS px under the 60 px game header, on a 414 × 896
 * screen, 2× pixels), from a near-perfect bot run (the skill-band tool's competent bots), on ticks where the
 * features are on screen. A design tool, not a check: the header strip is left plain (the game frame draws it).
 *
 *   bun scripts/shots/x200-cross-shots.ts [--out=screenshots/x200-oct-2026]
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

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/x200-oct-2026";
mkdirSync(OUT, { recursive: true });
const cross = await import("../../src/lib/arcade/cross");
const { crossArtGameFor } = await import("../../src/lib/arcade/cross.renderer");
const { Human } = await import("../arcade-skill-bands/human");
const { bot } = await import("../arcade-skill-bands/bots/cross");
const { roomSeed } = await import("../arcade-skill-bands/games");
const { px } = await import("../../src/lib/arcade/engine");

const SCREEN_W = 414;
const SCREEN_H = 896;
const HEADER = 60;
const BOX_H = 772;
const DPR = 2;
const game = cross.crossGameFor(cross.CROSS_REV_EXPAND);
const draw = crossArtGameFor(cross.CROSS_REV_EXPAND).draw;

/** True when a vehicle of this kind is well inside the visible road at this state. */
function onBoard(s: any, kind: number): boolean {
  const course = cross.crossCourse(s);
  const rel = s.tick - s.crossStart;
  return course.lanes.some((lane: any) => {
    if (lane.kind !== kind) return false;
    const start = (((lane.dir * lane.speed * rel + lane.phase) % lane.period) + lane.period) % lane.period;
    for (let i = -1; i <= Math.ceil((cross.CROSS_BOARD_W * 256) / lane.period) + 1; i++)
      for (const off of lane.offsets ?? [0]) {
        const x = px(start + i * lane.period + off);
        if (x > cross.CROSS_BOARD_X + 30 && x + px(lane.blockW) < cross.CROSS_BOARD_X + cross.CROSS_BOARD_W - 30) return true;
      }
    return false;
  });
}
const coinsLeft = (s: any) => (cross.crossCourse(s).coins ?? []).filter((_: number, i: number) => !((s.coins ?? 0) & (1 << i))).length;

/** Plays a near-perfect run on seed index n; saves the first frame each pick accepts (drawn after the 90 ticks before it). */
function shoot(n: number, picks: Record<string, (s: any, prev: any) => boolean>): string[] {
  const seed = roomSeed(n);
  const res = bot({ game, seed, rev: cross.CROSS_REV_EXPAND, human: new Human("cross", seed, "near"), fixes: true });
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  const states: any[] = [];
  let s: any = game.init(seed);
  const found: Record<string, number> = {};
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, (byTick.get(s.tick + 1) as any) ?? null);
    states.push(s);
    for (const [name, pick] of Object.entries(picks)) if (found[name] === undefined && pick(s, prev)) found[name] = states.length - 1;
  }
  const saved: string[] = [];
  for (const [name, at] of Object.entries(found)) {
    const canvas = createCanvas(SCREEN_W * DPR, SCREEN_H * DPR);
    const screen = canvas.getContext("2d") as any;
    screen.fillStyle = "#070709";
    screen.fillRect(0, 0, canvas.width, canvas.height);
    const box = createCanvas(SCREEN_W * DPR, BOX_H * DPR);
    const ctx = box.getContext("2d") as any;
    for (let i = Math.max(0, at - 90); i <= at; i++) {
      clock += 1000 / 60;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      draw(ctx, states[i], { width: SCREEN_W, height: BOX_H });
    }
    screen.drawImage(box, 0, HEADER * DPR);
    const file = `${OUT}/jaywalk-${name}-414x896.png`;
    writeFileSync(file, canvas.toBuffer("image/png"));
    console.log(`${file}: seed index ${n}, tick ${states[at].tick}`);
    saved.push(name);
  }
  return saved;
}

const want = ["traffic", "island-coins", "streak-close-call"];
const done = new Set<string>();
for (let n = 0; n < 30 && done.size < want.length; n++) {
  const picks: Record<string, (s: any, prev: any) => boolean> = {};
  // A bus and a motorbike on the road together, the walker in traffic (from crossing 3).
  if (!done.has("traffic")) picks.traffic = (s) => s.crossings >= 2 && s.lane >= 2 && s.hop === 0 && onBoard(s, cross.CROSS_KIND_BUS) && onBoard(s, cross.CROSS_KIND_MOTO);
  // On the island (banked, its flag gold) with coins still waiting above it.
  if (!done.has("island-coins")) picks["island-coins"] = (s) => s.crossings >= 1 && s.lane === cross.CROSS_X_ISLAND && s.hop === 0 && !!s.banked && coinsLeft(s) >= 2;
  // The streak pill at ×3 or more, a close call just made (its pop on screen).
  if (!done.has("streak-close-call")) picks["streak-close-call"] = (s, prev) => cross.crossNextMultiplier(s) >= 3 && (s.closeCalls ?? 0) > (prev.closeCalls ?? 0);
  for (const name of shoot(n, picks)) done.add(name);
}
const missing = want.filter((w) => !done.has(w));
if (missing.length) console.log(`no frame for: ${missing.join(", ")}`);
