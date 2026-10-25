/**
 * Review screenshots for expansion E5 (docs/expansions/e5.md): Swish binRev 7, Flightpath bullRev 7 and
 * Slice sliceRev 9 mid-play at 414×896 (DPR 2), each showing its new features. Not a check.
 *
 * Each frame is the game's own renderer (the same art the phone draws) on a state reached by the skill-band
 * bot playing the new stamp, at a moment the features are on screen; the world sits where the play screen
 * puts it (a 60 px game-frame header, then the arena box, top-anchored, the arena scene round it). The header
 * here is a plain stand-in for the game frame's.
 *
 *   bun scripts/shots/e5-shots.ts [--out=screenshots/expansion-e5]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/expansion-e5";
let clock = 50_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }), devicePixelRatio: 2 } });
Object.defineProperty(globalThis, "Path2D", { configurable: true, value: Path2D });
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: class { constructor(w: number, h: number) { return createCanvas(w, h); } } });
for (const f of ["archivo-var-latin.woff2", "jetbrains-mono-600-700-latin.woff2", "manrope-500-800-latin.woff2"]) {
  try {
    GlobalFonts.registerFromPath(`public/fonts/${f}`);
  } catch {
    /* a missing font falls back */
  }
}
GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");

const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { drawBullseye, bullseyeArenaSceneV7 } = await import("../../src/lib/arcade/bullseye.renderer");
const { binTossArtGame, binTossArenaSceneV7 } = await import("../../src/lib/arcade/binTossArt.renderer");
const { drawSliceArt } = await import("../../src/lib/arcade/slice.renderer");
const { sliceFill } = await import("../../src/lib/arcade/arenaFills.renderer");
const { BULLSEYE_REV_EXPAND } = await import("../../src/lib/arcade/bullseye");
const { BINTOSS_REV_EXPAND, BINTOSS_FLY } = await import("../../src/lib/arcade/binToss");
const { SLICE_REV_EXPAND, sliceTicketAt } = await import("../../src/lib/arcade/slice");
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const W = 414;
const H = 896;
const HEADER = 60;

/** Plays the near-perfect bot on the new stamp and returns the states tick by tick until `stop` says so. */
async function playTo(type: string, rev: number, pick: (s: Any, prev: Any[]) => boolean, seeds = 60): Promise<{ state: Any; frames: Any[] } | null> {
  const spec = GAMES.find((g: Any) => g.type === type)!;
  const { bot } = await import(`../arcade-skill-bands/bots/${type}.ts`);
  for (let n = 0; n < seeds; n++) {
    const seed = spec.seedFor(500 + n);
    const game = spec.gameFor(rev, seed);
    const out = bot({ game, seed, rev, human: new Human(type, seed, "near") });
    const by = new Map((out.events ?? []).map((e: Any) => [e.t, e]));
    let s = game.init(seed);
    const frames: Any[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null);
      frames.push(s);
      if (frames.length > 40) frames.shift();
      if (pick(s, frames)) return { state: s, frames };
    }
  }
  return null;
}

function frame(name: string, sub: string, world: { w: number; h: number }, boxH: number, draw: (ctx: Any, size: { width: number; height: number }) => void, scene: (ctx: Any, view: Any) => void, frames: Any[], file: string): void {
  const canvas = createCanvas(W * 2, H * 2);
  const ctx = canvas.getContext("2d") as Any;
  ctx.scale(2, 2);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  const scale = Math.min(W / world.w, boxH / world.h);
  const ox = (W - world.w * scale) / 2;
  // The arena scene round the world (out to the screen's edges and bottom), then the world.
  ctx.save();
  ctx.translate(ox, HEADER);
  ctx.scale(scale, scale);
  scene(ctx, { worldW: world.w, worldH: world.h, left: -ox / scale, top: 0, right: (W - ox) / scale, bottom: (H - HEADER) / scale, scale, boxTop: 0 });
  ctx.restore();
  ctx.save();
  ctx.translate(ox, HEADER);
  // A few frames before the moment, so the renderers' own presentation memories (pops, glints) are live.
  for (const s of frames) {
    clock += 1000 / 60;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, world.w * scale, world.h * scale);
    ctx.clip();
    draw(ctx, { width: world.w * scale, height: world.h * scale });
    void s;
    ctx.restore();
  }
  ctx.restore();
  // Stand-in for the game frame's header.
  ctx.fillStyle = "#0B0B10";
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "800 20px Archivo";
  ctx.fillText(name, 16, 27);
  ctx.fillStyle = "#BDBDCC";
  ctx.font = "600 13px Archivo";
  ctx.fillText(sub, 16, 47);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${file}`, canvas.toBuffer("image/png"));
  console.log(`  ${OUT}/${file}`);
}

/* Flightpath: a streak of three or more bulls just landed, on a far (high, small) board. */
{
  const hit = await playTo("bullseye", BULLSEYE_REV_EXPAND, (s, prev) => s.flightTick === 0 && (s.streak ?? 0) >= 3 && prev.length > 30 && prev[prev.length - 12]?.flightTick > 0 && (s.targets?.[Math.min(9, s.arrowIndex)]?.dist ?? 0) >= 2);
  if (hit) {
    const frames = hit.frames;
    frame("Flightpath", "Arcade · Practice · bullRev 7", { w: 390, h: 728 }, 772, (ctx, size) => drawBullseye(ctx, frames.shift() ?? hit.state, size), bullseyeArenaSceneV7, [...frames], "flightpath-414x896-streak.png");
  } else console.log("  flightpath: no moment found");
}

/* Swish: the ball on its way to the far bucket, a far basket already made, a hoop over it. */
{
  const hit = await playTo("bintoss", BINTOSS_REV_EXPAND, (s) => s.phase === BINTOSS_FLY && (s.farIn ?? 0) >= 1 && (s.fars?.[s.throwIndex] ?? 0) > 0 && Boolean(s.hoops?.[s.throwIndex]) && s.vx > 450 && s.y < 330 * 256 && s.x > 140 * 256);
  if (hit) {
    const frames = hit.frames;
    frame("Swish", "Arcade · Practice · binRev 7", { w: 430, h: 728 }, 700, (ctx, size) => binTossArtGame.draw(ctx, frames.shift() ?? hit.state, size), binTossArenaSceneV7, [...frames], "swish-414x896-far-bucket.png");
  } else console.log("  swish: no moment found");
}

/* Slice: a ticket open, a golden fruit in the air, a bonus and a dodge streak running. */
{
  const hit = await playTo("slice", SLICE_REV_EXPAND, (s) => {
    if (sliceTicketAt(s, s.tick) < 0 || (s.dodgeStreak ?? 0) < 1 || (s.goldPts ?? 0) < 3) return false;
    return s.objects.some((o: Any, i: number) => o.colour === 4 && !o.special && !s.slicedAt[i] && s.tick > o.launchTick + 20 && s.tick < o.lastTick - 20);
  }, 200);
  if (hit) {
    const frames = hit.frames;
    frame("Slice", "Arcade · Practice · sliceRev 9", { w: 430, h: 805 }, 772, (ctx, size) => drawSliceArt(ctx, frames.shift() ?? hit.state, size), sliceFill, [...frames], "slice-414x896-features.png");
  } else console.log("  slice: no moment found");
}
