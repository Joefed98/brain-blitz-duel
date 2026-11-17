/**
 * The Sports overhaul's gallery clips (phase 2 step 4; a design tool, not a check): a few seconds of Cue Ball, Curl Champ
 * and Apex as the phone draws them once the rendered images have loaded, through each game's real renderer and sim,
 * played by the game's own skill-band bot at the "good" level on a dealt seed. Frames at 15 fps, encoded by ffmpeg to
 * animated WebP at 300 px wide (docs/design/pages-review/sports/clip-<game>.webp).
 *
 *   bun scripts/shots/sports-clips.ts [pool|curling|racing …] [--out=docs/design/pages-review/sports]
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
const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { LIVE_BANDS } = await import("../../src/lib/arcade/liveBands");

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/design/pages-review/sports";
const which = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const games = which.length ? which : ["pool", "curling", "racing"];
mkdirSync(out, { recursive: true });

async function loadDir(game: string): Promise<void> {
  const dir = join("public/sports", game);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".webp"))) {
    setSportsSpriteForShots(game, f.replace(/\.webp$/, ""), await loadImage(readFileSync(join(dir, f))));
  }
}

/** Plays the game's bot at "good" on room seed `seed` and returns its game, rev and events by tick. */
async function botRun(type: string, seed: number) {
  const spec = GAMES.find((g) => g.type === type)!;
  const field = (LIVE_BANDS as Record<string, { field: string; rev?: number } | undefined>)[type];
  const rev = (field as { rev?: number } | undefined)?.rev ?? null;
  const game = spec.gameFor(rev, seed) as any;
  const { bot } = (await import(`../arcade-skill-bands/bots/${type}.ts`)) as { bot: any };
  const outRun = bot({ game, seed, rev, human: new Human(type, seed, "good"), fixes: true });
  return { game, rev, events: new Map<number, any>((outRun.events ?? []).map((e: any) => [e.t, e])) };
}

function encode(name: string, frames: Buffer[], w: number): void {
  const dir = mkdtempSync(join(tmpdir(), "sports-clip-"));
  frames.forEach((b, i) => writeFileSync(join(dir, `f${String(i).padStart(4, "0")}.png`), b));
  const path = join(out, `clip-${name}.webp`);
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "15", "-i", join(dir, "f%04d.png"), "-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "62", "-compression_level", "6", "-loop", "0", path]);
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${r.stderr}`);
  console.log(`  ${path}: ${frames.length} frames, ${(statSync(path).size / 1024).toFixed(0)} KB`);
}

/** Every 4th tick (15 fps) from tick `from` for `seconds`, drawn by `draw` after stepping the sim. */
function film(game: any, seed: number, events: Map<number, any>, from: number, seconds: number, draw: (s: any, next: any) => Buffer): Buffer[] {
  let s = game.init(seed);
  const frames: Buffer[] = [];
  const end = from + seconds * 60;
  while (!game.isOver(s) && s.tick < end) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    if (s.tick >= from && s.tick % 4 === 0) {
      // The next input ahead (for the aim the player is lining up).
      let next = null;
      for (let t = s.tick + 1; t < s.tick + 240; t++) if (events.has(t)) { next = events.get(t); break; }
      frames.push(draw(s, next));
    }
  }
  return frames;
}

if (games.includes("pool")) {
  await loadDir("pool");
  const P = await import("../../src/lib/arcade/pool");
  const { drawPool, poolScene } = await import("../../src/lib/arcade/pool.renderer");
  const seed = 2;
  const { game, events } = await botRun("pool", seed);
  const frames = film(game, seed, events, 60, 8, (s, next) => {
    const c = createCanvas(P.POOL_W * 2, P.POOL_H * 2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    poolScene(ctx, { worldW: P.POOL_W, worldH: P.POOL_H, left: 0, right: P.POOL_W, top: 0, bottom: P.POOL_H, scale: 2, boxTop: 0 } as never);
    // Lining up: the next shot's aim, drawn back as the moment nears (the balls at rest only, as the stage shows it).
    const resting = !(s.balls as any[]).some((b) => b.vx || b.vy);
    let aim = null;
    if (next && next.k === P.POOL_INPUT_SHOT && resting) {
      const len = Math.hypot(next.a, next.b) || 1;
      const pull = Math.min(1, Math.max(0, 1 - (next.t - s.tick) / 50));
      aim = { dx: next.a / len, dy: next.b / len, power: 0.15 + 0.6 * pull, spinX: 0, spinY: 0 };
    }
    drawPool(ctx, s, aim as never);
    return c.toBuffer("image/png");
  });
  encode("pool", frames, 300);
}

if (games.includes("curling")) {
  await loadDir("curling");
  const C = await import("../../src/lib/arcade/curling");
  const { drawCurling, curlingScene } = await import("../../src/lib/arcade/curling.renderer");
  const seed = 3;
  const { game, rev, events } = await botRun("curling", seed);
  const H = C.curlingWorldHFor(rev ?? C.CURLING_REV);
  const R = rev ?? C.CURLING_REV;
  const frames = film(game, seed, events, 30, 9, (s, next) => {
    const c = createCanvas(C.CURLING_W * 2, H * 2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    curlingScene(ctx, { worldW: C.CURLING_W, worldH: H, left: 0, right: C.CURLING_W, top: 0, bottom: H, scale: 2, boxTop: 0 } as never, R);
    // Aiming: the coming throw's start, target, turn and weight (as the stage holds them), so the Captain and the aim show.
    let aim = null;
    if (next && next.k === C.CURL_INPUT_THROW && s.phase === C.CURL_AIM) {
      const turn = next.c & 1;
      const zone = C.curlDrawZone(next.d, next.a, next.b, turn, R);
      aim = { broomX: next.a, broomY: next.b, startX: next.d, turn, swipe: null, keyWeight: next.c >> 1, zone, path: C.curlAimPath(s, next.d, next.a, next.b, zone?.tee ?? 316, turn), lastRelease: null };
    }
    drawCurling(ctx, s, aim as never);
    return c.toBuffer("image/png");
  });
  encode("curling", frames, 300);
}

if (games.includes("racing")) {
  await loadDir("racing");
  const R = await import("../../src/lib/arcade/racing");
  const { drawRacingPlay } = await import("../../src/lib/arcade/racing.renderer");
  const seed = 4;
  const { game, events } = await botRun("racing", seed);
  const frames = film(game, seed, events, 1500, 6, (s) => {
    const c = createCanvas(R.RACING_WORLD_W * 2, R.RACING_WORLD_H * 2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    drawRacingPlay(ctx, s, { width: R.RACING_WORLD_W, height: R.RACING_WORLD_H, scale: 2 } as never);
    return c.toBuffer("image/png");
  });
  encode("racing", frames, 300);
}
