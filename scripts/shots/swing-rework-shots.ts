/**
 * Grappler's swinging course (swingRev 15) review frames: the game's own renderer (swing.renderer.ts) drawing states
 * from a recorded run (the best elite skill-band run in scripts/fixtures/swing-rework-runs.json) on a swinging
 * stretch, a ledge stretch and a squeeze, in the play screen's geometry: the 60 px game header (a stand-in for the app's game frame) and the arena
 * box under it, the 450 × 844 world at the largest uniform scale (414 × 896: the iPhone 11 home-screen box,
 * 414 × 772; 375 × 667: 375 × 591), at 2× device pixels, with the app's own fonts. A design tool, not a check.
 *
 *   bun scripts/shots/swing-rework-shots.ts [--out=screenshots/grappler-rework-oct-2026]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { swingGameFor, SWING_KIND_SWING, SWING_REV_REWORK, type SwingState } from "../../src/lib/arcade/swing";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { decodeSwingRun } from "../../src/lib/duel/swing";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/grappler-rework-oct-2026";
mkdirSync(OUT, { recursive: true });
const HEADER = 60;
const DPR = 2;
const SIZES = [
  { w: 414, h: 896, box: 772 },
  { w: 375, h: 667, box: 591 },
];
const art = swingArtGameFor(SWING_REV_REWORK);
const game = swingGameFor(SWING_REV_REWORK);

function frame(state: SwingState, label: string, name: string): void {
  for (const { w, h, box } of SIZES) {
    const canvas = createCanvas(w * DPR, h * DPR);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(DPR, DPR);
    ctx.fillStyle = "#070709";
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / 450, box / 844);
    const aw = 450 * scale;
    const ah = 844 * scale;
    ctx.save();
    ctx.translate((w - aw) / 2, HEADER);
    art.draw(ctx, state, { width: aw, height: ah });
    ctx.restore();
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "700 16px Archivo";
    ctx.textAlign = "left";
    ctx.fillText("Grappler", 14, 30);
    ctx.fillStyle = "#BDBDCC";
    ctx.font = "500 12px Archivo";
    ctx.fillText(label, 14, 48);
    const file = `${OUT}/${name}-${w}x${h}.png`;
    writeFileSync(file, canvas.toBuffer("image/png"));
    console.log(`${file}: tick ${state.tick} · stretch ${(state.sec ?? 0) + 1} · ${label}`);
  }
}

const { runs } = JSON.parse(readFileSync("scripts/fixtures/swing-rework-runs.json", "utf8")) as { runs: { level: string; seed: number; score: number; raw: string }[] };
const run = runs.filter((r) => r.level === "elite").sort((a, b) => b.score - a.score)[0]!;
const decoded = decodeSwingRun(gunzipSync(Buffer.from(run.raw, "base64")).toString());
const by = new Map(decoded.events.map((e) => [e.t, e]));
let s: SwingState = game.init(run.seed);
const states: SwingState[] = [s];
while (!game.isOver(s)) {
  s = game.step(s, by.get(s.tick + 1) ?? null);
  states.push(s);
}
const sectionOf = (st: SwingState) => st.sections![Math.min(st.sec ?? 0, st.sections!.length - 1)]!;
// A swinging stretch: on a rope, the next hooks ahead in view, a feature (gate, gem or star) still to take.
const swinging = states.find((st) => {
  const sec = sectionOf(st);
  const ahead = (x: number) => x > st.x && x < st.x + 300 * 256;
  return (st.sec ?? 0) >= 1 && sec.kind === SWING_KIND_SWING && st.rope >= 0 && st.tick - st.grabTick > 10 && ((st.gates ?? []).some((g) => ahead(g.x)) || (st.gems ?? []).some(([x]) => ahead(x)) || (st.starSpots ?? []).some(([x]) => ahead(x)));
}) ?? states.find((st) => sectionOf(st).kind === SWING_KIND_SWING && st.rope >= 0 && st.tick - st.grabTick > 10)!;
// A ledge stretch: on its one hook, the landing ledge ahead.
const ledge = states.find((st) => sectionOf(st).kind === 0 && st.rope >= 0 && st.tick - st.grabTick > 12)!;
// A squeeze: the hero let go of the near hook, flying at the gap.
const squeeze = states.find((st) => {
  const sec = sectionOf(st);
  if (sec.kind !== 2 || st.rope >= 0 || (st.ledgeOn ?? -1) >= 0) return false;
  const q = st.squeezes![sec.sq]!;
  return st.x > q.x0 - 60 * 256 && st.x < q.x0 - 10 * 256;
}) ?? states.find((st) => sectionOf(st).kind === 2 && st.rope >= 0)!;
frame(swinging, "Swinging: hook to hook, a choice at each grab", "swinging");
frame(ledge, "A ledge stretch: one hook, the landing ledge ahead", "ledge");
frame(squeeze, "A squeeze: through the gap to the far hook", "squeeze");
console.log(`run ${run.seed} (${run.score})`);
