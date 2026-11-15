/**
 * Iron Wall's gallery clip (Action overhaul, docs/design/pages-review/action/GALLERY.md): a Near-perfect skill-band
 * run on bastionRev 3, drawn by the game's own art with the scene beyond the world on a phone-shaped box (375 × 667's
 * arena, so the sides show the scenery carried on), sampled through the whole minute so the setting goes clear →
 * dust → storm. Writes PNG frames to `<out>/frame-NNN.png`; tools/PIL makes the animated WebP.
 *
 *   bun scripts/shots/bastion-overhaul-clip.ts <out dir> [frames=60]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

import { bastionIronGame, BT2_WORLD_H, BT2_WORLD_W, type BastionTankState } from "../../src/lib/arcade/bastionTank";
import { bastionIronArtGame, bastionScene } from "../../src/lib/arcade/bastionTank.renderer";
import { bot } from "../arcade-skill-bands/bots/bastion";
import { Human } from "../arcade-skill-bands/human";

const out = process.argv[2] ?? ".shots/bastion-clip";
const frames = Number(process.argv[3] ?? 60);
mkdirSync(out, { recursive: true });
const seed = 7;
const { events } = bot({ game: bastionIronGame, seed, rev: 3, human: new Human("bastion", seed, "near") });
const at = new Map(events.map((e: { t: number }) => [e.t, e]));
// A 360-wide box with room for the scenery round the world (375 × 667's arena, scaled).
const boxW = 360;
const boxH = 600;
const W = BT2_WORLD_W;
const H = BT2_WORLD_H;
const k = Math.min(boxW / W, boxH / H);
const left = -(boxW / k - W) / 2;
const view = { worldW: W, worldH: H, left, right: W - left, top: 0, bottom: boxH / k, scale: k };
let s: BastionTankState = bastionIronGame.init(seed);
const wanted = Array.from({ length: frames }, (_, i) => Math.round(60 + (i * (3540 - 60)) / (frames - 1)));
let n = 0;
for (const tick of wanted) {
  while (s.tick < tick && !bastionIronGame.isOver(s)) s = bastionIronGame.step(s, (at.get(s.tick + 1) as never) ?? null);
  const c = createCanvas(boxW, boxH);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.setTransform(k, 0, 0, k, -left * k, 0);
  bastionScene(ctx, view, s);
  const wc = createCanvas(Math.round(W * k), Math.round(H * k));
  const wctx = wc.getContext("2d") as unknown as CanvasRenderingContext2D;
  wctx.scale(k, k);
  bastionIronArtGame.draw(wctx, s, { width: W, height: H });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(wc as unknown as CanvasImageSource, Math.round(-left * k), 0);
  writeFileSync(`${out}/frame-${String(n++).padStart(3, "0")}.png`, c.toBuffer("image/png"));
}
console.log(`wrote ${n} frames to ${out} (ended at tick ${s.tick}, score ${bastionIronGame.score(s)})`);
