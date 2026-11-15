/**
 * Before and after pictures of the 20 redrawn in-game looks (phase 2 step 4, docs/design/cosmetics-redraws/): a review
 * tool, not a check. Each picture is 360 px wide: on the left a close-up of the skinned object drawn by its own painter
 * (a ball, the cue-ball set, a stone, a card back) or a crop of the table, on the right the game's real frame through
 * scripts/skins/frames.ts (the very functions the live stage calls). "before" is today's art with the item equipped;
 * "after" forces the redraw on (setRedrawPreview, script only; the switches in src/config/cosmeticRedraws.ts are not
 * touched). Each pass runs in its own process, so no renderer cache carries one pass's drawing into the other.
 *
 *   bun scripts/cosmetic-redraws/game-looks-shots.ts [item…]      writes docs/design/cosmetics-redraws/gallery/game-looks/
 */
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { drawFrames, type Frame, type SkinGame } from "../skins/frames";
import { setSkinReducedMotion } from "../../src/lib/arcade/skins/motion.renderer";
import { setRedrawPreview } from "../../src/lib/arcade/skins/redrawPreview";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "docs/design/cosmetics-redraws/gallery/game-looks");

type Look = { skin: string | null; world: string | null; back?: string | null };
interface Item {
  id: string;
  game: SkinGame;
  frame: string;
  look: Look;
  closeUp: (ctx: SKRSContext2D, w: number, h: number) => Promise<void>;
}

const C = (ctx: SKRSContext2D) => ctx as unknown as CanvasRenderingContext2D;

async function golfBall(id: string, art: string) {
  return async (ctx: SKRSContext2D, w: number, h: number) => {
    const { paintBallArt } = await import("../../src/lib/arcade/skins/ballArt");
    ctx.fillStyle = "#2F7A3A";
    ctx.fillRect(0, 0, w, h);
    paintBallArt(C(ctx), art as never, w / 2, h * 0.32, 58);
    // In play: the ball at its live size (the game's draw radius at 2×).
    paintBallArt(C(ctx), art as never, w / 2, h * 0.78, 10);
    void id;
  };
}
async function poolSet(kind: string) {
  return async (ctx: SKRSContext2D, w: number, h: number) => {
    const { paintPoolSkinBall } = await import("../../src/lib/arcade/skins/pool.skins");
    ctx.fillStyle = "#1F6B45";
    ctx.fillRect(0, 0, w, h);
    const ids = kind === "neon8" ? [8] : [0, 8, 3, 11, 5, 14];
    if (kind === "neon8") paintPoolSkinBall(C(ctx), kind as never, 8, w / 2, h * 0.4, 62, 0, false);
    else ids.forEach((id, i) => paintPoolSkinBall(C(ctx), kind as never, id, w * (i % 2 ? 0.7 : 0.3), 50 + Math.floor(i / 2) * 92, 38, 0, false));
  };
}
async function stone(id: string) {
  return async (ctx: SKRSContext2D, w: number, h: number) => {
    const { curlStoneSkin, paintSkinStone } = await import("../../src/lib/arcade/skins/curling.skins");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#B9C9D6");
    g.addColorStop(1, "#E9F1F6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const skin = curlStoneSkin({ skin: id, world: null }, true)!;
    paintSkinStone(C(ctx), skin, w / 2, h * 0.4, 70, 38, 22, 7, false);
    paintSkinStone(C(ctx), skin, w / 2, h * 0.82, 22, 12, 7, 9, false);
  };
}
async function back(back: string) {
  return async (ctx: SKRSContext2D, w: number, h: number) => {
    const { paintSkinBack } = await import("../../src/lib/arcade/skins/cards.skins");
    ctx.fillStyle = "#0E2A57";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate((w - 126) / 2, 30);
    paintSkinBack(C(ctx), back as never, 126, 177);
    ctx.restore();
    ctx.save();
    ctx.translate((w - 42) / 2, 236);
    paintSkinBack(C(ctx), back as never, 42, 59);
    ctx.restore();
  };
}
const noCloseUp = async () => {};

async function items(): Promise<Item[]> {
  const golf = (n: string, art: string) => ({ id: `game-skin.crazy-golf.${n}`, game: "minigolf" as const, frame: "r2-s5-t0@2", look: { skin: `game-skin.crazy-golf.${n}`, world: null }, art });
  const out: Item[] = [];
  for (const g of [golf("watermelon", "watermelon"), golf("disco", "disco"), golf("neon-glow", "neon-glow"), golf("plasma", "plasma")]) out.push({ ...g, closeUp: await golfBall(g.id, g.art) });
  for (const [n, kind] of [["pixel-pool", "pixel"], ["galaxy-set", "galaxy"], ["neon-8-ball", "neon8"], ["neon-ball-set", "neon"]] as const)
    out.push({ id: `game-skin.cue-ball.${n}`, game: "pool", frame: "r4-s3-t0@2", look: { skin: `game-skin.cue-ball.${n}`, world: null }, closeUp: await poolSet(kind) });
  for (const n of ["glacier", "aurora", "neon-stones"])
    out.push({ id: `game-skin.curl-champ.${n}`, game: "curling", frame: "r4-s8-t260@2", look: { skin: `game-skin.curl-champ.${n}`, world: null }, closeUp: await stone(`game-skin.curl-champ.${n}`) });
  for (const n of ["midnight-felt", "crimson-velvet", "neon-felt"])
    out.push({ id: `game-skin.full-house.${n}`, game: "pokersquares", frame: "r2-s21-t150@2", look: { skin: `game-skin.full-house.${n}`, world: null }, closeUp: noCloseUp });
  for (const n of ["royal-damask", "holo-foil", "neon"])
    out.push({ id: `card-back.${n}`, game: "tripeaks", frame: "r3-s0-t0@2", look: { skin: null, world: null, back: `card-back.${n}` }, closeUp: await back(n) });
  out.push({ id: "world-theme.apex.neon-night", game: "racing", frame: "r3-s6-t900", look: { skin: null, world: "world-theme.apex.neon-night" }, closeUp: noCloseUp });
  out.push({ id: "world-theme.crazy-golf.neon-course", game: "minigolf", frame: "r2-s9-t300@2", look: { skin: null, world: "world-theme.crazy-golf.neon-course" }, closeUp: noCloseUp });
  out.push({ id: "world-theme.curl-champ.neon-rink", game: "curling", frame: "r4-s8-t260@2", look: { skin: null, world: "world-theme.curl-champ.neon-rink" }, closeUp: noCloseUp });
  return out;
}

function frameCanvas(f: Frame) {
  const c = createCanvas(f.w, f.h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(f.w, f.h);
  img.data.set(f.data);
  ctx.putImageData(img, 0, 0);
  return c;
}

async function pass(tag: "before" | "after", only: string[]): Promise<void> {
  setSkinReducedMotion(true);
  if (tag === "after") setRedrawPreview("all");
  mkdirSync(OUT, { recursive: true });
  for (const it of await items()) {
    if (only.length && !only.includes(it.id)) continue;
    const frames = await drawFrames(it.game, it.look as never);
    const f = frames.find((x) => x.name === it.frame) ?? frames[0]!;
    const fc = frameCanvas(f);
    const W = 360;
    const H = 340;
    const c = createCanvas(W, H);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#06080F";
    ctx.fillRect(0, 0, W, H);
    const half = 178;
    // Right: the whole frame, fitted.
    const s = Math.min(half / f.w, H / f.h);
    ctx.drawImage(fc, W - half + (half - f.w * s) / 2, (H - f.h * s) / 2, f.w * s, f.h * s);
    // Left: the close-up, or a crop of the frame's middle at its own scale.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, half, H);
    ctx.clip();
    if (it.closeUp === noCloseUp) {
      const cw = Math.min(f.w, half * 1.6);
      const ch = Math.min(f.h, H * 1.6);
      ctx.drawImage(fc, (f.w - cw) / 2, (f.h - ch) / 2, cw, ch, 0, 0, half, H);
    } else await it.closeUp(ctx, half, H);
    ctx.restore();
    const file = join(OUT, `${it.id}--${tag}.png`);
    writeFileSync(file, c.toBuffer("image/png"));
  }
}

const tagArg = process.argv.find((a) => a.startsWith("--pass="))?.slice(7) as "before" | "after" | undefined;
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (tagArg) await pass(tagArg, only);
else {
  for (const t of ["before", "after"]) {
    const r = spawnSync("bun", [import.meta.path, `--pass=${t}`, ...only], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  // Smaller files: a 256-colour palette (the pictures are for review).
  try {
    execFileSync("python3", ["-c", `import glob\nfrom PIL import Image\nfor f in glob.glob(${JSON.stringify(OUT)}+'/*.png'):\n  Image.open(f).convert('RGB').quantize(256,method=2,dither=1).save(f,optimize=True)`]);
  } catch {
    console.log("(PIL not available: pictures left as full-colour PNG)");
  }
  console.log(`wrote ${OUT}`);
}
