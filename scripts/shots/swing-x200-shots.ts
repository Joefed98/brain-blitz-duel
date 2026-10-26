/**
 * Grappler's 200 expansion (swingRev 13) review frames: the game's own renderer (swing.renderer.ts) drawing states
 * from a recorded strong run (the best stored run in scripts/fixtures/swing-x200-runs.json) at the moments the
 * features show, in the iPhone 11 home-screen play screen's geometry (414 × 896: the 60 px game header, the
 * 414 × 772 arena box under it, the 450 × 844 world at the largest uniform scale), at 2× device pixels, with the
 * app's own fonts. The header is a stand-in for the app's game frame. A design tool, not a check.
 *
 *   bun scripts/shots/swing-x200-shots.ts [--out=screenshots/x200-oct-2026]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { swingGameFor, swingFeatureCounts, swingRunningSection, SWING_REV_EXPAND, type SwingState } from "../../src/lib/arcade/swing";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { decodeSwingRun } from "../../src/lib/duel/swing";

GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/x200-oct-2026";
mkdirSync(OUT, { recursive: true });
const W = 414;
const H = 896;
const HEADER = 60;
const BOX_H = 772;
const DPR = 2;
const art = swingArtGameFor(SWING_REV_EXPAND);
const game = swingGameFor(SWING_REV_EXPAND);

function frame(state: SwingState, label: string, file: string): void {
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  const scale = Math.min(W / 450, BOX_H / 844);
  const aw = 450 * scale;
  const ah = 844 * scale;
  ctx.save();
  ctx.translate((W - aw) / 2, HEADER);
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
  console.log(`${OUT}/${file}: tick ${state.tick} · ${label}`);
}

const { runs } = JSON.parse(readFileSync("scripts/fixtures/swing-x200-runs.json", "utf8")) as { runs: { rev: number; seed: number; score: number; raw: string }[] };
const run = runs.filter((r) => r.rev === SWING_REV_EXPAND).sort((a, b) => b.score - a.score)[0]!;
const decoded = decodeSwingRun(gunzipSync(Buffer.from(run.raw, "base64")).toString());
const by = new Map(decoded.events.map((e) => [e.t, e]));
let s: SwingState = game.init(run.seed);
const states: SwingState[] = [s];
while (!game.isOver(s)) {
  s = game.step(s, by.get(s.tick + 1) ?? null);
  states.push(s);
}
const inView = (st: SwingState, x: number) => x > st.camX + 30 * 256 && x < st.camX + 420 * 256;
const find = (pick: (st: SwingState) => boolean) => states.find(pick) ?? null;
const c = swingFeatureCounts;
// A section running: its clock under the distance, the par on the start ledge behind, the next ledges ahead.
const parShot = find((st) => {
  const r = swingRunningSection(st);
  return r !== null && r.section > 0 && r.elapsed >= 70 && st.rope >= 0;
}) ?? find((st) => (swingRunningSection(st)?.elapsed ?? 0) >= 70);
// An untaken gem and an unlit gate in view together.
const gemGate = find((st) => (st.gems ?? []).some(([gx], i) => !((st.gemsTaken ?? 0) & (1 << i)) && inView(st, gx)) && (st.gates ?? []).some((g, i) => !((st.gatesLit ?? 0) & (1 << i)) && inView(st, g.x)) && !swingRunningSection(st));
// The start ledge with its par, just before the hero lands on it.
const start = find((st) => (st.ledges ?? []).some((l, i) => l.kind === 0 && l.section > 0 && !(st.ledgeTicks?.[i] ?? 0) && inView(st, l.x) && l.x - st.x < 120 * 256 && l.x > st.x));
const shots: [SwingState | null, string, string][] = [
  [parShot, "A set route running against its par", "swing-par-414x896.png"],
  [start, "A route's start ledge with its par time", "swing-par-start-414x896.png"],
  [gemGate, "A high-route gem and a low-route speed gate", "swing-gem-gate-414x896.png"],
];
for (const [state, label, file] of shots) if (state) frame(state, label, file);
console.log(`run ${run.seed} (${run.score}): ${c(states.at(-1)!).parsBeaten} sections under par`);
