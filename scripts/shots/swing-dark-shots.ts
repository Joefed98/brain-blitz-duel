/**
 * Grappler's dark ledge runs (swingRev 16) review frames: the game's own renderer (swing.renderer.ts) drawing states
 * from an elite skill-band run on room seed 3: a ledge run coming up (dark past its first ledge), a ledge section in
 * the air before its landing (dark past the landing ledge), the moment after the landing (the next part lighting up)
 * and the stretch after the run (only its first hook lit). Phone frames in the play screen's geometry (a 60 px header
 * stand-in, the 450 × 844 world at the largest uniform scale in the iPhone 11 home-screen box, 414 × 772), and one
 * computer frame (1366 × 768, the `tall` desktop mode: the world full height in the centred column), at 2× device
 * pixels. A design tool, not a check.
 *
 *   bun scripts/shots/swing-dark-shots.ts [--out=screenshots/arcade-tuning-nov-2026] [--seed=3]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { swingGameFor, swingDarkFrom, SWING_KIND_SWING, SWING_NO_DARK, SWING_REV_DARK, type SwingState } from "../../src/lib/arcade/swing";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { bot } from "../arcade-skill-bands/bots/swing";
import { Human } from "../arcade-skill-bands/human";
import { roomSeed } from "../arcade-skill-bands/games";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg("out") ?? "screenshots/arcade-tuning-nov-2026";
mkdirSync(OUT, { recursive: true });
const DPR = 2;
const art = swingArtGameFor(SWING_REV_DARK);
const game = swingGameFor(SWING_REV_DARK);

function draw(state: SwingState, label: string, file: string, w: number, h: number, header: number, box: number): void {
  const canvas = createCanvas(w * DPR, h * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / 450, box / 844);
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
  console.log(`${OUT}/${file}: tick ${state.tick} · stretch ${(state.sec ?? 0) + 1} · ${label}`);
}
const phone = (state: SwingState, label: string, name: string) => draw(state, label, `grappler-dark-${name}-414x896.png`, 414, 896, 60, 772);

const seed = roomSeed(Number(arg("seed") ?? 3));
const human = new Human("swing", seed, "elite");
const res = bot({ game, seed, rev: SWING_REV_DARK, human });
const by = new Map((res.events ?? []).map((e) => [e.t, e]));
let s: SwingState = game.init(seed);
const states: SwingState[] = [s];
while (!game.isOver(s)) {
  s = game.step(s, by.get(s.tick + 1) ?? null);
  states.push(s);
}
const secOf = (st: SwingState) => st.sections![Math.min(st.sec ?? 0, st.sections!.length - 1)]!;
/** How much of the view (px) is dark. */
const darkShown = (st: SwingState) => (swingDarkFrom(st) === SWING_NO_DARK ? 0 : Math.max(0, st.camX / 256 + 450 - swingDarkFrom(st) / 256));
const most = (pick: (st: SwingState, i: number) => boolean) => {
  let best = -1;
  states.forEach((st, i) => {
    if (pick(st, i) && (best < 0 || darkShown(st) > darkShown(states[best]!))) best = i;
  });
  return best;
};
// A ledge run coming up: on the stretch before it, a hook held, the most dark in view.
const approach = states[most((st) => secOf(st).kind === SWING_KIND_SWING && swingDarkFrom(st) !== SWING_NO_DARK && (secOf(st).from ?? -1) < 0 && st.rope >= 0)]!;
// A ledge section, in the air just before its landing (cleared within 12 ticks), the most dark in view.
const airIdx = most((st, i) => secOf(st).kind !== SWING_KIND_SWING && (st.ledgeOn ?? -1) < 0 && st.rope < 0 && Boolean(states[i + 12]) && (states[i + 12]!.sec ?? 0) > (st.sec ?? 0) && (states[i + 4]!.sec ?? 0) === (st.sec ?? 0));
const air = states[airIdx]!;
// Just after that landing: the next part lighting up, then lit.
const landIdx = states.findIndex((st, i) => i > airIdx && (st.sec ?? 0) > (air.sec ?? 0));
phone(approach, "A ledge run ahead: the cave past its first ledge is dark", "approach");
phone(air, "On a ledge section, before landing: dark past the landing ledge", "before-landing");
phone(states[landIdx + 6]!, "Just landed: the next part lights up", "landing");
phone(states[landIdx + 30]!, "After the landing: lit up to the next ledge", "after-landing");
// The stretch after a run: standing on the run's last ledge, only the next stretch's first hook lit.
const afterRun = states.find((st) => secOf(st).kind === SWING_KIND_SWING && (secOf(st).from ?? -1) >= 0 && (st.ledgeOn ?? -1) >= 0 && st.tick - (st.secStart ?? 0) >= 22) ?? states.find((st) => secOf(st).kind === SWING_KIND_SWING && (secOf(st).from ?? -1) >= 0 && (st.ledgeOn ?? -1) >= 0);
if (afterRun) phone(afterRun, "Landed on the run's last ledge: the light comes up to the next hook", "after-run");
// The computer layout (tall mode): the world full height in a centred column under a 56 px header.
draw(air, "Computer (1366 × 768, tall): dark past the landing ledge", "grappler-dark-before-landing-1366x768.png", 1366, 768, 56, 768 - 56 - 16);
draw(states[landIdx + 30]!, "Computer (1366 × 768, tall): lit to the next ledge", "grappler-dark-after-landing-1366x768.png", 1366, 768, 56, 768 - 56 - 16);
console.log(`elite run on ${seed}: ${game.score(s)}`);
