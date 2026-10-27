/**
 * Grappler's assault course (swingRev 14) review frames: the game's own renderer (swing.renderer.ts) drawing states
 * from a recorded run (the elite skill-band run in scripts/fixtures/swing-assault-runs.json) at a ledge section and
 * a squeeze, in the play screen's geometry: the 60 px game header (a stand-in for the app's game frame) and the arena
 * box under it, the 450 × 844 world at the largest uniform scale (414 × 896: the iPhone 11 home-screen box,
 * 414 × 772; 375 × 667: 375 × 591), at 2× device pixels, with the app's own fonts. A design tool, not a check.
 *
 *   bun scripts/shots/swing-assault-shots.ts [--out=screenshots/grappler-assault-oct-2026]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { swingGameFor, SWING_REV_ASSAULT, type SwingState } from "../../src/lib/arcade/swing";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { decodeSwingRun } from "../../src/lib/duel/swing";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/grappler-assault-oct-2026";
mkdirSync(OUT, { recursive: true });
const HEADER = 60;
const DPR = 2;
const SIZES = [
  { w: 414, h: 896, box: 772 },
  { w: 375, h: 667, box: 591 },
];
const art = swingArtGameFor(SWING_REV_ASSAULT);
const game = swingGameFor(SWING_REV_ASSAULT);

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
    console.log(`${file}: tick ${state.tick} · section ${(state.sec ?? 0) + 1} · ${label}`);
  }
}

const { runs } = JSON.parse(readFileSync("scripts/fixtures/swing-assault-runs.json", "utf8")) as { runs: { level: string; seed: number; score: number; raw: string }[] };
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
// A ledge section: one hook, a feature ahead in it, the hero swinging under the hook.
const ledge = states.find((st) => {
  const k = st.sec ?? 0;
  const to = st.ledges![k + 1];
  return k >= 2 && sectionOf(st).kind === 0 && st.rope >= 0 && to !== undefined && (st.gates ?? []).some((g) => g.x > st.x && g.x < to.x) && st.tick - st.grabTick > 12;
}) ?? states.find((st) => (st.sec ?? 0) >= 2 && sectionOf(st).kind === 0 && st.rope >= 0 && st.tick - st.grabTick > 12)!;
// A squeeze: the hero let go of the near hook, flying at the gap.
const squeeze = states.find((st) => {
  const sec = sectionOf(st);
  if (sec.kind !== 2 || st.rope >= 0 || (st.ledgeOn ?? -1) >= 0) return false;
  const q = st.squeezes![sec.sq]!;
  return st.x > q.x0 - 60 * 256 && st.x < q.x0 - 10 * 256;
}) ?? states.find((st) => sectionOf(st).kind === 2 && st.rope >= 0)!;
frame(ledge, "A ledge section: one hook, the landing ledge ahead", "ledge");
frame(squeeze, "A squeeze: through the gap to the far hook", "squeeze");
console.log(`run ${run.seed} (${run.score})`);
