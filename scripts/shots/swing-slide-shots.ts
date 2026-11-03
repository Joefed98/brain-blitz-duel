/**
 * Grappler's sliding hooks and clean-swing streak (swingRev 17) review frames: the game's own renderer
 * (swing.renderer.ts) drawing states from an elite skill-band run on a room seed: a sliding hook on its rail coming up
 * (at either end of its travel), the moment it is grabbed (it stops where it was caught), the streak in the HUD
 * ("STREAK ×n", gold from a whole block on), and the streak starting again after a miss. Phone frames in the play
 * screen's geometry (a 60 px header stand-in, the 450 × 844 world at the largest uniform scale in the iPhone 11
 * home-screen box, 414 × 772), at 2× device pixels. A design tool, not a check.
 *
 *   bun scripts/shots/swing-slide-shots.ts [--out=screenshots/grappler-slide-nov-2026] [--seed=3]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { swingGameFor, swingAnchorAt, swingStreakNow, SWING_REV_SLIDE, type SwingState } from "../../src/lib/arcade/swing";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { bot } from "../arcade-skill-bands/bots/swing";
import { Human } from "../arcade-skill-bands/human";
import { roomSeed } from "../arcade-skill-bands/games";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg("out") ?? "screenshots/grappler-slide-nov-2026";
mkdirSync(OUT, { recursive: true });
const DPR = 2;
const art = swingArtGameFor(SWING_REV_SLIDE);
const game = swingGameFor(SWING_REV_SLIDE);

function draw(state: SwingState, label: string, file: string): void {
  const w = 414;
  const h = 896;
  const header = 60;
  const canvas = createCanvas(w * DPR, h * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / 450, 772 / 844);
  const aw = 450 * scale;
  const ah = 844 * scale;
  ctx.save();
  ctx.translate((w - aw) / 2, header);
  art.draw(ctx, state, { width: aw, height: ah });
  ctx.restore();
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "700 16px Archivo";
  ctx.textAlign = "left";
  ctx.fillText("Grappler", 14, 30);
  ctx.fillStyle = "#BDBDCC";
  ctx.font = "500 12px Archivo";
  ctx.fillText(label, 14, 48);
  writeFileSync(`${OUT}/${file}`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${file}: tick ${state.tick} · stretch ${(state.sec ?? 0) + 1} · streak ${swingStreakNow(state)} · ${label}`);
}

const seed = roomSeed(Number(arg("seed") ?? 3));
const human = new Human("swing", seed, (arg("level") ?? "elite") as never);
const res = bot({ game, seed, rev: SWING_REV_SLIDE, human });
const by = new Map((res.events ?? []).map((e) => [e.t, e]));
let s: SwingState = game.init(seed);
const states: SwingState[] = [s];
while (!game.isOver(s)) {
  s = game.step(s, by.get(s.tick + 1) ?? null);
  states.push(s);
}
const sliders = s.sliders ?? [];
const inView = (st: SwingState, i: number) => {
  const x = swingAnchorAt(st, i, st.tick).x / 256 - st.camX / 256;
  return x > 60 && x < 420;
};
// The first sliding hook the run grabs: a frame as it comes into view near one end of its rail, one near the other end,
// and one just after the grab (stopped where it was caught).
const grabIdx = states.findIndex((st) => sliders.some((sl) => sl.i === st.rope) && st.tick === st.grabTick + 4);
const grabbed = states[grabIdx];
if (grabbed) {
  const sl = sliders.find((x) => x.i === grabbed.rope)!;
  const before = states.slice(Math.max(0, grabIdx - 120), grabIdx).filter((st) => inView(st, sl.i));
  const far = (sign: number) => before.reduce<SwingState | null>((best, st) => (!best || sign * (swingAnchorAt(st, sl.i, st.tick).x - sl.x) > sign * (swingAnchorAt(best, sl.i, best.tick).x - sl.x) ? st : best), null);
  const left = far(-1);
  const right = far(1);
  if (left) draw(left, "A sliding hook ahead on its rail (its slot drawn end to end)", "grappler-slide-left-414x896.png");
  if (right) draw(right, "The same hook moments later, further along: time the grab", "grappler-slide-right-414x896.png");
  draw(grabbed, "Grabbed: the hook stops where it was caught", "grappler-slide-grabbed-414x896.png");
}
// The streak: the longest run of clean grabs at its height (gold from a whole block on).
const top = states.reduce((best, st) => (swingStreakNow(st) > swingStreakNow(best) ? st : best), states[0]!);
draw(top, `Clean-swing streak ×${swingStreakNow(top)}`, "grappler-slide-streak-414x896.png");
// A streak building early in the run (white until the first block of 8).
const early = states.find((st) => swingStreakNow(st) === 5 && st.rope >= 0);
if (early) draw(early, "A streak building (gold from 8 in a row)", "grappler-slide-streak-early-414x896.png");
console.log(`elite run on ${seed}: ${game.score(s)}`);
