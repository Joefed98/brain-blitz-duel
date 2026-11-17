/**
 * Cue Ball's stage-2 effects for the gallery (the Sports overhaul; a design tool, not a check): frames of each effect
 * drawn by the real renderer with the rendered images loaded, on a good-level skill-band bot's run, plus a short clip
 * (a strike, a pot flying to the rack, a foul) as an animated WebP (ffmpeg).
 *
 *   bun scripts/shots/pool-effects-shots.ts <out dir> [--seed=N]
 *
 * Writes aim-spin.png, strike.png, flash.png, rattle.png (if the run has one), flight.png, foul.png, streak.png,
 * clear.png (if the run clears) and clip-pool-effects.webp, at 2×.
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
const { drawPool, poolScene } = await import("../../src/lib/arcade/pool.renderer");
const fx = await import("../../src/lib/arcade/poolFx");
const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { bot } = await import("../arcade-skill-bands/bots/pool");

const out = process.argv[2] ?? ".shots/pool-effects";
const seedArg = process.argv.find((a) => a.startsWith("--seed="));
mkdirSync(out, { recursive: true });
for (const f of readdirSync("public/sports/pool").filter((x) => x.endsWith(".webp"))) {
  setSportsSpriteForShots("pool", f.replace(/\.webp$/, ""), await loadImage(readFileSync(join("public/sports/pool", f))));
}

const spec = GAMES.find((g) => g.type === "pool")!;
const rev = P.POOL_REV;

function frame(s: any, aim: any = null): Buffer {
  const c = createCanvas(P.POOL_W * 2, P.POOL_H * 2);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  poolScene(ctx, { worldW: P.POOL_W, worldH: P.POOL_H, left: 0, right: P.POOL_W, top: 0, bottom: P.POOL_H, scale: 2, boxTop: 0 } as never);
  drawPool(ctx, s, aim);
  return c.toBuffer("image/png");
}

/** A run with a foul, a pot and a streak (tries seeds until one has all three). */
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
  return { states, events };
}

let run: ReturnType<typeof playRun> | null = null;
let seed = seedArg ? Number(seedArg.slice(7)) : 1;
for (let tries = 0; tries < 40; tries++, seed++) {
  const r = playRun(seed);
  const last = r.states[r.states.length - 1];
  if (seedArg || (last.fouls > 0 && last.pots >= 3 && last.streakBest >= 2)) {
    run = r;
    break;
  }
}
if (!run) throw new Error("no run with a foul, pots and a streak");
console.log(`  seed ${seed}: ${run.states.length} ticks`);
const S = run.states;
const write = (name: string, buf: Buffer) => {
  writeFileSync(join(out, name), buf);
  console.log(`  ${name}`);
};
const find = (pred: (s: any, i: number) => boolean) => S.find(pred);

// The aim with side spin on the dot (the spun bounce, gold), before the first shot.
{
  const first = [...run.events.values()].sort((a, b) => a.t - b.t)[2];
  const s = S[Math.max(0, first.t - 30)];
  const l = Math.hypot(first.a, first.b);
  write("aim-spin.png", frame(s, { dx: first.a / l, dy: first.b / l, power: 0.55, spinX: 85, spinY: 0 }));
}
const strike = find((s) => fx.poolStrikePoint(s)?.age === 3);
if (strike) write("strike.png", frame(strike));
const flash = find((s) => fx.poolContactPoint(s)?.age === 1);
if (flash) write("flash.png", frame(flash));
const rattle = find((s) => fx.poolJawContact(s) !== null);
if (rattle) write("rattle.png", frame(S[S.indexOf(rattle) + 4] ?? rattle));
const flight = find((s) => s.balls.some((b: any) => (fx.poolFlight(s, b) ?? 0) > 0.5));
if (flight) write("flight.png", frame(flight));
const foul = find((s) => fx.poolFoulLabel(s)?.age === 10);
if (foul) write("foul.png", frame(foul));
const streak = find((s, i) => i > 0 && s.streak >= 2 && s.streak > S[i - 1].streak);
if (streak) write("streak.png", frame(S[S.indexOf(streak) + 5] ?? streak));
const clear = find((s) => s.black === 1);
if (clear) write("clear.png", frame(S[Math.min(S.length - 1, S.indexOf(clear) + 30)]));

// The clip: from a strike that pots a ball, through its flight, and the first foul (15 fps, 300 px wide).
{
  const potIdx = S.findIndex((s: any, i: number) => i > 0 && s.pots > S[i - 1].pots && s.balls.some((b: any) => b.down && b.id >= 1 && b.id <= P.POOL_SPOTS && b.downAt === s.tick));
  const foulIdx = S.findIndex((s: any, i: number) => i > 0 && s.fouls > S[i - 1].fouls);
  const shotBefore = (i: number) => {
    let j = i;
    while (j > 0 && S[j].phase !== 0) j--;
    return Math.max(0, j - 40);
  };
  const windows: [number, number][] = [];
  if (potIdx > 0) windows.push([shotBefore(potIdx), potIdx + fx.POOL_FX_DROP_TICKS + fx.POOL_FX_FLIGHT_TICKS + 15]);
  if (foulIdx > 0) windows.push([shotBefore(foulIdx), foulIdx + 70]);
  const dir = mkdtempSync(join(tmpdir(), "pool-fx-"));
  let n = 0;
  for (const [a, b] of windows) {
    // The aim the player lines up before the strike (the next shot's direction), drawn while the balls rest.
    for (let i = a; i < Math.min(b, S.length); i += 4) {
      const s = S[i];
      let aim = null;
      if (s.phase === 0) {
        const next = [...run.events.values()].filter((e) => e.t > s.tick).sort((x, y) => x.t - y.t)[0];
        if (next) {
          const l = Math.hypot(next.a, next.b);
          aim = { dx: next.a / l, dy: next.b / l, power: Math.min(1, Math.max(0.1, 1 - (next.t - s.tick) / 50)) * 0.7, spinX: 0, spinY: 0 };
        }
      }
      writeFileSync(join(dir, `f${String(n++).padStart(4, "0")}.png`), frame(s, aim));
    }
  }
  const path = join(out, "clip-pool-effects.webp");
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "15", "-i", join(dir, "f%04d.png"), "-vf", "scale=300:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "60", "-compression_level", "6", "-loop", "0", path]);
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  console.log(`  clip-pool-effects.webp: ${n} frames, ${(statSync(path).size / 1024).toFixed(0)} KB`);
}
