/**
 * Cue Ball's effects at phone size (the Sports overhaul, stage 3's first item; a design tool, not a check): the strike,
 * a ball meeting a ball, a jaw rattle and a pot flying to the rack, each found in a good-level skill-band bot's run on a
 * scanned seed, drawn by the real renderer with the rendered images loaded.
 *
 *   bun scripts/shots/pool-fx-clips.ts <out dir> [--from=1] [--to=60]
 *
 * For each moment: a still of the whole table at phone scale (the 390-wide world at 2×, as a 390 × 844 phone draws it at
 * DPR 2) and a short clip (animated WebP, 30 fps, about 2.5 s, cropped to the action at the same scale, 340 px wide).
 * Prints each moment's seed and tick.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};
(globalThis as unknown as { document: unknown }).document = { createElement: () => createCanvas(1, 1), documentElement: { dataset: {} } };

const { setSportsSpriteForShots } = await import("../../src/lib/arcade/sportsSprites");
const P = await import("../../src/lib/arcade/pool");
const { drawPool, poolScene, poolRattleNow } = await import("../../src/lib/arcade/pool.renderer");
const fx = await import("../../src/lib/arcade/poolFx");
const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { bot } = await import("../arcade-skill-bands/bots/pool");

const out = process.argv[2] ?? ".shots/pool-fx";
const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
mkdirSync(out, { recursive: true });
for (const f of readdirSync("public/sports/pool").filter((x) => x.endsWith(".webp"))) {
  setSportsSpriteForShots("pool", f.replace(/\.webp$/, ""), await loadImage(readFileSync(join("public/sports/pool", f))));
}
const spec = GAMES.find((g) => g.type === "pool")!;
const rev = P.POOL_REV;
const SCALE = 2;

function playRun(seed: number) {
  const game = spec.gameFor(rev, seed) as any;
  const res = bot({ game, seed, rev, human: new Human("pool", seed, "good"), fixes: true });
  const events = new Map<number, any>((res.events ?? []).map((e: any) => [e.t, e]));
  const states: any[] = [];
  let s = game.init(seed);
  states.push(s);
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    states.push(s);
  }
  return { seed, states, events };
}

/** The aim the player is lining up (the next shot's direction) while the balls rest, as the stage draws it. */
function aimAt(run: ReturnType<typeof playRun>, s: any) {
  if (s.phase !== 0) return null;
  const next = [...run.events.values()].filter((e) => e.t > s.tick).sort((x, y) => x.t - y.t)[0];
  if (!next) return null;
  const l = Math.hypot(next.a, next.b);
  return { dx: next.a / l, dy: next.b / l, power: Math.min(1, Math.max(0.1, 1 - (next.t - s.tick) / 50)) * 0.7, spinX: 0, spinY: 0 };
}

function table(run: ReturnType<typeof playRun>, s: any) {
  const c = createCanvas(P.POOL_W * SCALE, P.POOL_H * SCALE);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(SCALE, SCALE);
  poolScene(ctx, { worldW: P.POOL_W, worldH: P.POOL_H, left: 0, right: P.POOL_W, top: 0, bottom: P.POOL_H, scale: SCALE, boxTop: 0 } as never);
  drawPool(ctx, s, aimAt(run, s) as never);
  return c;
}

/** A crop of `size` world px round (cx, cy), kept on the table, at phone scale (size 0: the whole table). */
function crop(c: ReturnType<typeof createCanvas>, cx: number, cy: number, size: number): Buffer {
  if (size === 0) return c.toBuffer("image/png");
  const half = size / 2;
  const x0 = Math.max(0, Math.min(P.POOL_W - size, cx - half)) * SCALE;
  const y0 = Math.max(0, Math.min(P.POOL_H - size, cy - half)) * SCALE;
  const o = createCanvas(size * SCALE, size * SCALE);
  o.getContext("2d").drawImage(c as never, x0, y0, size * SCALE, size * SCALE, 0, 0, size * SCALE, size * SCALE);
  return o.toBuffer("image/png");
}

interface Moment {
  name: string;
  run: ReturnType<typeof playRun>;
  index: number;
  x: number;
  y: number;
  before: number;
  after: number;
  size: number;
}

// Scan seeds for each moment (the first seed that has it).
const found = new Map<string, Moment>();
for (let seed = arg("from", 1); seed <= arg("to", 60) && found.size < 4; seed++) {
  const run = playRun(seed);
  const S = run.states;
  for (let i = 1; i < S.length; i++) {
    const s = S[i];
    // The renderer's rattle observer reads every tick (as the stage's every frame does).
    const r = poolRattleNow(s);
    if (!found.has("strike")) {
      const st = fx.poolStrikePoint(s);
      if (st?.age === 0) found.set("strike", { name: "strike", run, index: i, x: st.x, y: st.y, before: 40, after: 40, size: 240 });
    }
    if (!found.has("contact")) {
      const c = fx.poolContactPoint(s);
      if (c?.age === 0) found.set("contact", { name: "contact", run, index: i, x: c.x, y: c.y, before: 30, after: 45, size: 200 });
    }
    if (!found.has("rattle") && r?.age === 0 && S.slice(i, i + fx.POOL_FX_SHIVER_TICKS + 1).every((t: any) => t.balls.some((x: any) => x.id === r.id && !x.down))) found.set("rattle", { name: "rattle", run, index: i, x: r.jx, y: r.jy, before: 30, after: 45, size: 180 });
    if (!found.has("pot")) {
      const b = s.balls.find((x: any) => x.down && x.downAt === s.tick && x.id >= 1 && x.id <= P.POOL_SPOTS);
      if (b) found.set("pot", { name: "pot", run, index: i, x: P.POOL_W / 2, y: 140, before: 20, after: fx.POOL_FX_DROP_TICKS + fx.POOL_FX_FLIGHT_TICKS + 24, size: 0 });
    }
  }
}

for (const name of ["strike", "contact", "rattle", "pot"]) {
  const m = found.get(name);
  if (!m) {
    console.log(`  ${name}: not found in the seeds scanned`);
    continue;
  }
  const S = m.run.states;
  // Re-feed the rattle observer from the moment's start (every tick), then draw every second tick (30 fps).
  const a = Math.max(0, m.index - m.before);
  const b = Math.min(S.length - 1, m.index + m.after);
  for (let i = Math.max(0, a - 20); i < a; i++) poolRattleNow(S[i]);
  const dir = mkdtempSync(join(tmpdir(), `pool-${name}-`));
  let n = 0;
  const stillAt = m.index + (name === "pot" ? fx.POOL_FX_DROP_TICKS + 10 : name === "strike" ? 3 : 2);
  for (let i = a; i <= b; i++) {
    const s = S[i];
    poolRattleNow(s);
    if (i === stillAt || (i - a) % 2 === 0) {
      const c = table(m.run, s);
      if (i === stillAt) writeFileSync(join(out, `${name}.png`), c.toBuffer("image/png"));
      if ((i - a) % 2 === 0) writeFileSync(join(dir, `f${String(n++).padStart(4, "0")}.png`), crop(c, m.x, m.y, m.size));
    }
  }
  const path = join(out, `clip-${name}.webp`);
  const w = 340;
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", join(dir, "f%04d.png"), "-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "58", "-compression_level", "6", "-loop", "0", path]);
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  console.log(`  ${name}: seed ${m.run.seed}, tick ${S[m.index].tick}; ${name}.png (tick ${S[Math.min(stillAt, S.length - 1)].tick}), clip-${name}.webp ${n} frames, ${(statSync(path).size / 1024).toFixed(0)} KB`);
}
