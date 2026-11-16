/**
 * Top Bins' layered-kick frames (a design tool, not a check; 15 Nov 2026, freekickRev 5): the real renderer
 * (@napi-rs/canvas) draws a bot's run on a rev-5 deal seed at chosen moments side by side in one PNG: a kick being set
 * (wind flag, keeper's lean, the strike chip), a strike in flight, a goal or save, a jumping wall, and the run's end.
 *
 *   bun scripts/shots/freekick-layered-frames.ts [out.png] [--skill=great] [--level=normal] [--n=0] [--ticks=a,b,c]
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { fkLevelOf, freekickGameFor, FK_AIM, FK_FLIGHT, FK_OVER, FK_SETTLE, FREEKICK_REV_5, FREEKICK_WORLD_H, FREEKICK_WORLD_W } from "../../src/lib/arcade/freekick";
import { freekickArtGameFor } from "../../src/lib/arcade/freekick.renderer";
import { freekickDealSeedV5 } from "../../src/lib/duel/freekickDealV5.server";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { botV5 } from "../arcade-skill-bands/bots/freekick";

// The pitch's cached layers use OffscreenCanvas where there is one (Bun has none).
(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const out = args.find((a) => !a.startsWith("--")) ?? ".shots/freekick-layered-frames.png";
const level = fkLevelOf(opt("level"));
const skill = (opt("skill") ?? "great") as SkillLevel;
const seed = freekickDealSeedV5(Number(opt("n") ?? 0), level);
const game = freekickGameFor(FREEKICK_REV_5, level);
const art = freekickArtGameFor(FREEKICK_REV_5, undefined, level);
const events = new Map(botV5({ game, seed, rev: FREEKICK_REV_5, human: new Human("freekick", seed, skill) }).events.map((e) => [e.t, e]));
// Find moments: the second kick being set after its shot is drawn, its flight, its settle, and the end.
let probe = game.init(seed);
const marks: number[] = [];
let lastPhase = -1;
while (!game.isOver(probe)) {
  probe = game.step(probe, events.get(probe.tick + 1) ?? null);
  if (probe.k === 1 && probe.phase === FK_AIM && probe.aimed === 1 && marks.length === 0) marks.push(probe.tick + 2);
  if (probe.k === 1 && probe.phase === FK_FLIGHT && lastPhase !== FK_FLIGHT) marks.push(probe.tick + 14);
  if (probe.k === 1 && probe.phase === FK_SETTLE && lastPhase !== FK_SETTLE) marks.push(probe.tick + 18);
  lastPhase = probe.phase;
}
marks.push(probe.phase === FK_OVER ? probe.tick : probe.tick - 1);
const ticks = opt("ticks")?.split(",").map(Number) ?? marks;
const W = FREEKICK_WORLD_W;
const H = FREEKICK_WORLD_H;
const canvas = createCanvas(W * ticks.length, H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const frame = createCanvas(W, H);
const fctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = game.init(seed);
ticks.forEach((t, col) => {
  while (s.tick < t && !game.isOver(s)) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    // Draw every frame so the renderer's display memory (each kick's crossing) fills as it would live.
    art.draw(fctx, s, { width: W, height: H });
  }
  fctx.clearRect(0, 0, W, H);
  art.draw(fctx, s, { width: W, height: H });
  ctx.drawImage(frame as unknown as CanvasImageSource, W * col, 0);
});
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out} (ticks ${ticks.join(", ")})`);
