/**
 * The skins against their approved art (a tool, not a check; wave 2, E1): each skin that draws the same object as its
 * swatch (the balls, stones, card backs and felts) is painted by the game's own skin painter at the swatch's exact
 * size and place over its approved PNG (docs/art/wave-2/items/game-skin/*.png, 2× captures of the .html sources), and
 * compared pixel by pixel inside the object. The car paints and world themes are drawn from a different view (a car
 * from above in the swatch, from behind in the game; a mock scene in the theme board), so they are compared by
 * palette: every colour the source names is checked against the colours the skin's painter uses.
 *
 *   bun scripts/skins/compare-art.ts [--out=<dir>]     (writes art | ours | difference sheets per item)
 */
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
if (out) mkdirSync(out, { recursive: true });

const B = await import("../../src/lib/arcade/skins/ballArt");
const P = await import("../../src/lib/arcade/skins/pool.skins");
const C = await import("../../src/lib/arcade/skins/curling.skins");
const K = await import("../../src/lib/arcade/skins/cards.skins");

type Ctx = CanvasRenderingContext2D;
interface Item {
  file: string;
  /** The art's folder under docs/art/wave-2/items (game-skin unless given). */
  dir?: string;
  w: number;
  h: number;
  paint: (ctx: Ctx) => void;
  /** Inside the object (svg units). */
  inside: (x: number, y: number) => boolean;
  note?: string;
}
const circle = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) <= r - 1;
const any = (...fs: ((x: number, y: number) => boolean)[]) => (x: number, y: number) => fs.some((f) => f(x, y));
const ellipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 0.92;

const items: Item[] = [];
for (const [name, art] of [
  ["crazy-golf--watermelon", "watermelon"],
  ["crazy-golf--disco", "disco"],
  ["crazy-golf--neon-glow", "neon-glow"],
  ["crazy-golf--plasma", "plasma"],
  ["top-bins--comet", "comet"],
  ["top-bins--retro-leather", "retro-leather"],
  ["top-bins--neon-football", "neon-football"],
] as const)
  items.push({ file: name, w: 72, h: 72, paint: (ctx) => B.paintBallArt(ctx, art, 36, 36, 30), inside: circle(36, 36, 30) });
const poolBalls: Record<string, [P.PoolBallKind, number, number][]> = {
  "cue-ball--pixel-pool": [["pixel", 0, 22], ["pixel", 8, 62], ["pixel", 3, 102]],
  "cue-ball--galaxy-set": [["galaxy", 0, 22], ["galaxy", 8, 62], ["galaxy", 3, 102]],
  "cue-ball--neon-8-ball": [["neon8", 8, 62]],
  "cue-ball--neon-ball-set": [["neon", 0, 22], ["neon", 8, 62], ["neon", 5, 102]],
};
for (const [name, balls] of Object.entries(poolBalls))
  items.push({
    file: name,
    w: 124,
    h: 52,
    paint: (ctx) => {
      for (const [kind, id, x] of balls) P.paintPoolSkinBall(ctx, kind, id, x, 26, 19, 0, false);
    },
    inside: any(...balls.map(([, , x]) => circle(x, 26, 19))),
    note: "the art's green table under the balls is the swatch's, not the skin",
  });
const stones: Record<string, string> = { "curl-champ--glacier": "game-skin.curl-champ.glacier", "curl-champ--aurora": "game-skin.curl-champ.aurora", "curl-champ--neon-stones": "game-skin.curl-champ.neon-stones" };
for (const [name, id] of Object.entries(stones))
  items.push({
    file: name,
    w: 96,
    h: 72,
    paint: (ctx) => C.paintSkinStone(ctx, C.curlStoneSkin({ skin: id, world: null }, true)!, 48, 46, 42, 22, 6, 1, false),
    inside: any(ellipse(48, 40, 42, 22), ellipse(48, 46, 42, 22)),
  });
for (const [name, back] of [["royal-damask", "royal-damask"], ["holo-foil", "holo-foil"], ["neon", "neon"]] as const)
  items.push({ file: name, dir: "card-back", w: 84, h: 118, paint: (ctx) => K.paintSkinBack(ctx, back, 84, 118), inside: (x, y) => x > 3 && x < 81 && y > 3 && y < 115 });
for (const [name, felt] of [["full-house--midnight-felt", "midnight"], ["full-house--crimson-velvet", "crimson"], ["full-house--neon-felt", "neon"]] as const)
  items.push({
    file: name,
    w: 130,
    h: 86,
    paint: (ctx) => K.paintSkinFelt(ctx, felt, 130, 86),
    // The felt and rail, not the swatch's sample card and chip.
    inside: (x, y) => x > 1 && x < 129 && y > 1 && y < 85 && !(x > 34 && x < 68 && y > 20 && y < 64) && Math.hypot(x - 86, y - 48) > 13,
    note: "the swatch's sample card and chip are left out",
  });

/** The swatch card's box in the PNG: the run of the card colour (#0F1424) round the centre. */
function cardBox(img: Uint8ClampedArray, w: number, h: number) {
  const isCard = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return Math.abs(img[i]! - 15) < 3 && Math.abs(img[i + 1]! - 20) < 3 && Math.abs(img[i + 2]! - 36) < 3;
  };
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isCard(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { x0, y0, x1, y1 };
}

const rows: string[] = [];
for (const it of items) {
  const png = await loadImage(readFileSync(`docs/art/wave-2/items/${it.dir ?? "game-skin"}/${it.file}.png`));
  const W = png.width;
  const H = png.height;
  const base = createCanvas(W, H);
  const bctx = base.getContext("2d");
  bctx.drawImage(png, 0, 0);
  const art = bctx.getImageData(0, 0, W, H).data;
  const box = cardBox(art as unknown as Uint8ClampedArray, W, H);
  const ox = Math.round((box.x0 + box.x1 + 1) / 2 - it.w);
  const oy = Math.round((box.y0 + box.y1 + 1) / 2 - it.h);
  const ours = createCanvas(W, H);
  const octx = ours.getContext("2d") as unknown as Ctx;
  octx.drawImage(png as never, 0, 0);
  octx.save();
  octx.translate(ox, oy);
  octx.scale(2, 2);
  it.paint(octx);
  octx.restore();
  const mine = ours.getContext("2d").getImageData(0, 0, W, H).data;
  let n = 0, close = 0, sum = 0;
  const diff = createCanvas(W, H);
  const dctx = diff.getContext("2d");
  const dimg = dctx.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      dimg.data[i + 3] = 255;
      if (!it.inside((x - ox + 0.5) / 2, (y - oy + 0.5) / 2)) continue;
      const d = Math.max(Math.abs(art[i]! - mine[i]!), Math.abs(art[i + 1]! - mine[i + 1]!), Math.abs(art[i + 2]! - mine[i + 2]!));
      n++;
      sum += d;
      if (d <= 32) close++;
      dimg.data[i] = dimg.data[i + 1] = dimg.data[i + 2] = Math.min(255, d * 2);
    }
  dctx.putImageData(dimg, 0, 0);
  const pct = (100 * close) / Math.max(1, n);
  rows.push(`${it.file.padEnd(28)} ${String(n).padStart(6)} px  ${pct.toFixed(1).padStart(5)} % within 32 levels  mean difference ${(sum / Math.max(1, n)).toFixed(1).padStart(5)}${it.note ? `  (${it.note})` : ""}`);
  if (out) {
    const sheet = createCanvas(W * 3, H);
    const s = sheet.getContext("2d");
    s.drawImage(base, 0, 0);
    s.drawImage(ours, W, 0);
    s.drawImage(diff, W * 2, 0);
    writeFileSync(`${out}/${it.dir === "card-back" ? "card-back--" : ""}${it.file}.png`, sheet.toBuffer("image/png"));
  }
}
console.log("Object against its approved PNG (inside the object only; 2× pixels):");
for (const r of rows) console.log("  " + r);

// Palette: the car paints and world themes (a different view from their swatch).
const hexes = (s: string) => new Set([...s.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()));
const palette: [string, string, string][] = [
  ["game-skin/apex--racing-stripes", "src/lib/arcade/skins/racing.skins.ts", "stripes"],
  ["game-skin/apex--molten-gold", "src/lib/arcade/skins/racing.skins.ts", "gold"],
  ["game-skin/apex--neon-paint", "src/lib/arcade/skins/racing.skins.ts", "neon"],
  ["world-theme/apex--neon-night", "src/lib/arcade/skins/racing.skins.ts", "theme"],
  ["world-theme/crazy-golf--neon-course", "src/lib/arcade/skins/minigolf.skins.ts", "theme"],
  ["world-theme/curl-champ--neon-rink", "src/lib/arcade/skins/curling.skins.ts", "theme"],
  ["world-theme/cue-ball--neon-table", "src/lib/arcade/skins/pool.skins.ts", "theme"],
];
console.log("\nPalette (source colours found among the painter's colours):");
for (const [src, mod] of palette) {
  const html = readFileSync(`docs/art/wave-2/items/${src}.html`, "utf8");
  const body = html.slice(html.indexOf("<body>"));
  const want = [...hexes(body)].filter((c) => c !== "#0F1424" && c !== "#1E2640");
  const have = hexes(readFileSync(mod, "utf8"));
  const missing = want.filter((c) => !have.has(c));
  console.log(`  ${src.padEnd(40)} ${want.length - missing.length}/${want.length}${missing.length ? `  not used: ${missing.join(" ")}` : ""}`);
}
