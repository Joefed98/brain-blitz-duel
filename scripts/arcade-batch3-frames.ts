/**
 * Draws stills of the batch-3 games on their new revisions to PNG files, for a
 * by-eye look at the new art (not a check). Each still is a real state from a
 * bot run on the sim, drawn with the game's art renderer at 390 px wide.
 *
 *   bun scripts/arcade-batch3-frames.ts <out-dir> [wavefront,breaker,burst,swing]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1 },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined")
  Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const out = process.argv[2] ?? "/tmp/batch3-frames";
const only = process.argv[3]?.split(",");
mkdirSync(out, { recursive: true });
const engine = await import("../src/lib/arcade/engine");
const bots = await import("./arcade-batch3-bots");

/** Replays a bot run's events and saves the frames whose tick passes `want`. */
async function stills(name: string, game: any, art: any, seed: number, raw: string, decode: (raw: string) => { events: any[] }, want: (s: any, prev: any) => boolean, max = 6, w = 390, h = 620) {
  const byTick = new Map(decode(raw).events.map((e) => [e.t, e]));
  let s = game.init(seed);
  let prev = s;
  let saved = 0;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  while (!game.isOver(s) && saved < max) {
    prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    clock += 1000 / 60;
    if (s.tick % 2 === 0) art.draw(ctx, s, { width: w, height: h });
    if (want(s, prev)) {
      art.draw(ctx, s, { width: w, height: h });
      writeFileSync(`${out}/${name}-${String(s.tick).padStart(4, "0")}.png`, canvas.toBuffer("image/png"));
      saved++;
    }
  }
}

if (!only || only.includes("wavefront")) {
  const { wavefrontGameFor, WAV_REV } = await import("../src/lib/arcade/wavefront");
  const { wavefrontArtGameFor } = await import("../src/lib/arcade/wavefront.renderer");
  const { decodeWavefrontRun } = await import("../src/lib/duel/wavefront");
  const game = wavefrontGameFor(WAV_REV);
  const run = bots.playWavefront(game, 4242);
  let lastDive = -1000;
  await stills("wavefront", game, wavefrontArtGameFor(WAV_REV), 4242, run.raw, decodeWavefrontRun, (s, p) => {
    if (s.enter === 60) return true; // mid fly-in, banner up
    if ((s.divers?.length ?? 0) > 0 && s.tick - lastDive > 900 && s.divers[0].t === 70) { lastDive = s.tick; return true; }
    if (s.boss && (s.bossHits === 10 || s.bossHits === 30) && s.bossHits !== p.bossHits) return true;
    return false;
  }, 10);
}
if (!only || only.includes("breaker")) {
  const { breakerGameFor, BRK_REV } = await import("../src/lib/arcade/breaker");
  const { breakerArtGameFor } = await import("../src/lib/arcade/breaker.renderer");
  const { decodeBreakerRun } = await import("../src/lib/duel/breaker");
  const game = breakerGameFor(BRK_REV);
  for (const seed of [77, 90210]) {
    const run = bots.playBreaker(game, seed);
    await stills(`breaker-${seed}`, game, breakerArtGameFor(BRK_REV), seed, run.raw, decodeBreakerRun, (s, p) =>
      (s.capsules.length > p.capsules.length) || (s.fire === 240) || (s.beam === 11) || s.tick === 2100 || s.tick === 3700, 8);
  }
}
if (!only || only.includes("burst")) {
  const { burstGameFor, BURST_REV, BURST_FLOOR_Y } = await import("../src/lib/arcade/burst");
  const { burstArtGameFor } = await import("../src/lib/arcade/burst.renderer");
  const { decodeBurstRun } = await import("../src/lib/duel/burst");
  const game = burstGameFor(BURST_REV);
  const run = bots.playBurst(game, 1);
  await stills("burst", game, burstArtGameFor(BURST_REV), 1, run.raw, decodeBurstRun, (s, p) =>
    s.icons.length > p.icons.length || s.freeze === 120, 8, 390, BURST_FLOOR_Y);
}
if (!only || only.includes("swing")) {
  const { swingGameFor, SWING_REV } = await import("../src/lib/arcade/swing");
  const { swingArtGameFor } = await import("../src/lib/arcade/swing.renderer");
  const { proveSwingSeedV4 } = await import("../src/lib/duel/swingProof.server");
  const { SWING_V4_BANK } = await import("../src/lib/duel/swingBankV4.server");
  const game = swingGameFor(SWING_REV);
  const seed = SWING_V4_BANK[0]!.seed;
  const witness = proveSwingSeedV4(seed)!;
  // A slower copy of the witness (every input 40 % later is not valid physics), so instead stall at 300 m to meet the dragon.
  const raw = JSON.stringify({ events: witness.log });
  let jetShots = 0;
  await stills("swing", game, swingArtGameFor(SWING_REV), seed, raw, (r) => JSON.parse(r), (s, p) => {
    if ((s.stars ?? 0) > (p.stars ?? 0) && s.stars % 4 === 1) return true;
    if ((s.rocks ?? []).some((r: any, i: number) => r.phase === 1 && r.t === 30 && Math.abs(r.x - s.x) < 200 * 256)) return true;
    if ((s.rocks ?? []).some((r: any, i: number) => r.phase === 2 && r.t === 12)) return true;
    if (jetShots < 2 && (s.jets ?? []).some((j: any) => Math.abs(j.x - s.x) < 150 * 256 && ((s.tick + j.phase) % j.period) === j.period - 20)) { jetShots++; return true; }
    if (s.chaseX && !p.chaseX) return true;
    return false;
  }, 10);
  // The dragon catching a ninja who stalls just after 200 m.
  let s = game.init(seed);
  const byTick = new Map(witness.log.map((e) => [e.t, e]));
  while (!s.chaseX) s = game.step(s, byTick.get(s.tick + 1) ?? null);
  const canvas = createCanvas(390, 620);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  for (let i = 0; i < 400 && !s.ended; i++) {
    s = game.step(s, null);
    clock += 1000 / 60;
    swingArtGameFor(SWING_REV).draw(ctx, s, { width: 390, height: 620 });
    if (i === 30 || s.ended) writeFileSync(`${out}/swing-stall-${String(s.tick).padStart(4, "0")}.png`, canvas.toBuffer("image/png"));
  }
}
console.log(`stills written to ${out}`);
