/**
 * Grappler's expansion (swingRev 12) review frames: the game's own renderer (swing.renderer.ts, through
 * the shared success layer) drawing states from a recorded strong run (scripts/fixtures/swing-rev12-witness.json)
 * at the moments each new feature shows, in the iPhone 11 play screen's geometry (414 × 896: the 60 px
 * game header, the 414 × 772 arena box under it), at 2× device pixels. A design tool, not a check.
 *
 *   bun scripts/shots/swing-expand-shots.ts [--out=screenshots/e7-oct-2026]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import { decodeInputEvents } from "../../src/lib/arcade/engine";
import { swingGameFor, swingFeatureCounts, SWING_REV_EXPAND, type SwingState } from "../../src/lib/arcade/swing";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { decodeSwingRun } from "../../src/lib/duel/swing";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/e7-oct-2026";
mkdirSync(OUT, { recursive: true });
const W = 414;
const H = 896;
const HEADER = 60;
const BOX_H = 772;
const DPR = 2;
const art = swingArtGameFor(SWING_REV_EXPAND);
const game = swingGameFor(SWING_REV_EXPAND);
void decodeInputEvents;

function frame(state: SwingState, label: string, file: string): void {
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  // The arena box under the header: the world at the largest uniform scale, top-anchored.
  const scale = Math.min(W / 450, BOX_H / 844);
  const aw = 450 * scale;
  const ah = 844 * scale;
  ctx.save();
  ctx.translate((W - aw) / 2, HEADER);
  art.draw(ctx, state, { width: aw, height: ah });
  ctx.restore();
  // A stand-in for the game frame's header (the app draws its own): the name and what the frame shows.
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "700 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Grappler", 14, 30);
  ctx.fillStyle = "#BDBDCC";
  ctx.font = "500 12px sans-serif";
  ctx.fillText(label, 14, 48);
  writeFileSync(`${OUT}/${file}`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${file}: tick ${state.tick} · ${label}`);
}

const { runs } = JSON.parse(readFileSync("scripts/fixtures/swing-rev12-witness.json", "utf8")) as { runs: { seed: number; raw: string }[] };
const run = runs[0]!;
const decoded = decodeSwingRun(gunzipSync(Buffer.from(run.raw, "base64")).toString());
const by = new Map(decoded.events.map((e) => [e.t, e]));
let s: SwingState = game.init(run.seed);
const states: SwingState[] = [s];
while (!game.isOver(s)) {
  s = game.step(s, by.get(s.tick + 1) ?? null);
  states.push(s);
}
const at = (pick: (p: SwingState, n: SwingState) => boolean, after = 8, from = 0) => {
  for (let i = Math.max(1, from); i < states.length; i++) if (pick(states[i - 1]!, states[i]!)) return states[Math.min(states.length - 1, i + after)]!;
  return null;
};
const c = swingFeatureCounts;
const shots: [SwingState | null, string, string][] = [
  [at((p, n) => (p.ledgeOn ?? -1) < 0 && (n.ledgeOn ?? -1) >= 0 && n.ledges![n.ledgeOn!]!.kind === 0, 4), "Set route: landed on the start ledge", "swing-section-start.png"],
  [at((p, n) => (n.ledgeOn ?? -1) >= 0 && n.ledges![n.ledgeOn!]!.crumble === 1 && (p.ledgeOn ?? -1) < 0, 10), "A collapsing ledge, cracked and shaking", "swing-collapsing-ledge.png"],
  [at((p, n) => (n.ledgeOn ?? -1) >= 0 && n.ledges![n.ledgeOn!]!.kind === 2 && (p.ledgeOn ?? -1) < 0, 6), "The finish-flag ledge: section clear", "swing-section-flag.png"],
  [at((p, n) => c(n).gems > c(p).gems, -6), "High route: about to take a gem", "swing-gem.png"],
  [at((p, n) => c(n).gates > c(p).gates, 3), "Low route: swooping through a speed gate", "swing-speed-gate.png"],
  [at((p, n) => (n.chain ?? 0) >= 5 && (p.chain ?? 0) < 5, 4), "Swing combo: a fast chain of grabs", "swing-combo.png"],
  [states[Math.trunc(states.length * 0.7)]!, "Late run: the wider, deeper cave", "swing-late-run.png"],
];
for (const [state, label, file] of shots) if (state) frame(state, label, file);
