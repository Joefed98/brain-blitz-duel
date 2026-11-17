/**
 * Home Run's innings frames (a design tool, not a check; 15 Nov 2026, homerunRev 5): the real renderer (@napi-rs/canvas)
 * draws a bot's innings on a rev-5 deal seed at chosen moments side by side in one PNG: a wind-up, a pitch in flight,
 * a hit with runners going, a call, and the innings summary at the end.
 *
 *   bun scripts/shots/homerun-innings-frames.ts [out.png] [--skill=great] [--level=normal] [--n=0] [--ticks=a,b,c]
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { homerunGameFor, homerunViewHFor, HOMERUN_REV_5, HOMERUN_WORLD_W } from "../../src/lib/arcade/homerun";
import { drawHomerunArt } from "../../src/lib/arcade/homerun.renderer";
import { homerunDealSeedV5 } from "../../src/lib/duel/homerunDealV5.server";
import { hrLevelOf, HR5_HOMER, HR5_SINGLE, HR5_DOUBLE } from "../../src/lib/arcade/homerunInnings";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { botV5 } from "../arcade-skill-bands/bots/homerun";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const out = args.find((a) => !a.startsWith("--")) ?? ".shots/homerun-innings-frames.png";
const level = hrLevelOf(opt("level"));
const skill = (opt("skill") ?? "great") as SkillLevel;
const seed = homerunDealSeedV5(Number(opt("n") ?? 0), level);
const game = homerunGameFor(HOMERUN_REV_5, level);
const events = new Map(botV5({ game, seed, rev: HOMERUN_REV_5, human: new Human("homerun", seed, skill) }).events.map((e) => [e.t, e]));
// Play once to find good moments.
let probe = game.init(seed);
while (!game.isOver(probe)) probe = game.step(probe, events.get(probe.tick + 1) ?? null);
const hits = probe.inn!.hits;
const hitWithRunner = hits.find((h, i) => i > 0 && (h.out === HR5_SINGLE || h.out === HR5_DOUBLE) && hits[i - 1]!.bases !== 0) ?? hits.find((h) => h.out >= HR5_SINGLE);
const homer = hits.find((h) => h.out === HR5_HOMER);
const second = hits[1]!;
const auto = [second.rel - 30, second.rel + 20, (hitWithRunner?.at ?? 400) + 30, (homer?.at ?? 600) + 60, probe.tick - 2];
const ticks = opt("ticks")?.split(",").map(Number) ?? auto;
const W = HOMERUN_WORLD_W;
const H = homerunViewHFor(HOMERUN_REV_5);
const canvas = createCanvas(W * ticks.length, H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const frame = createCanvas(W, H);
const fctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = game.init(seed);
ticks.forEach((t, col) => {
  while (s.tick < t && !game.isOver(s)) s = game.step(s, events.get(s.tick + 1) ?? null);
  fctx.clearRect(0, 0, W, H);
  drawHomerunArt(fctx, s, { width: W, height: H });
  ctx.drawImage(frame as unknown as CanvasImageSource, W * col, 0);
});
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out} (ticks ${ticks.join(", ")})`);
