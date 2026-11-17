/**
 * Retro overhaul play clips (15 Nov 2026, a design tool, not a check): a few seconds of each Retro game drawn by its own
 * renderer in Node from the skill-band bot's Near-perfect run at the room-dealt stamp (scripts/retro-render-lib.ts, the
 * same runs as the gallery's frames), saved as an animated WebP for docs/design/pages-review/retro/GALLERY.md.
 *
 *   bun scripts/shots/retro-clips.ts --out=<dir> [--from=0.4] [--seconds=3] [--fps=12] [--width=240] [games…]
 *
 * The frames are written as PNGs, then packed by Python's Pillow (python3 -c, no file of its own); with RETRO_PIXEL_FONT
 * set (retro-render-lib.ts) the HUD draws in the app's pixel font.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createCanvas, retroArtFor, retroRun, RETRO_TYPES, type RetroType } from "../retro-render-lib";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? ".shots/retro-clips";
const FROM = Number(opt("from") ?? 0.4);
const SECONDS = Number(opt("seconds") ?? 3);
const FPS = Number(opt("fps") ?? 12);
const WIDTH = Number(opt("width") ?? 240);
const LEVEL: Record<string, string> = { hover: "elite" };
/** Where a clip starts, as a share of the run (Breaker's wall is fullest early). */
const START: Record<string, number> = { breaker: 0.1, hover: 0.3 };
const games = args.filter((a) => !a.startsWith("--")) as RetroType[];
const list = games.length ? games : [...RETRO_TYPES];

mkdirSync(OUT, { recursive: true });
for (const type of list) {
  const run = await retroRun(type, { level: LEVEL[type] ?? "near", every: Math.max(1, Math.round(60 / FPS)) });
  const draw = await retroArtFor(type, run.rev);
  const from = Math.round(run.runTicks * (START[type] ?? FROM));
  const frames = run.states.filter((s) => s.tick >= from).slice(0, Math.round(SECONDS * FPS));
  const tmp = join(OUT, `${type}-frames`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const H = Math.round((WIDTH * 760) / 390);
  // One canvas for the whole clip (stage 2 of the Retro overhaul): the in-world effects are logged per canvas and aged
  // by the sim tick (retroFx.renderer.ts), so a fresh canvas each frame would draw none. The state just before the clip
  // is drawn first (not saved), so the effects' counters start from the run as it was.
  const canvas = createCanvas(WIDTH, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const paint = (s: { tick: number }) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#070709";
    ctx.fillRect(0, 0, WIDTH, H);
    ctx.scale(WIDTH / 390, H / 760);
    draw(ctx, s, { width: 390, height: 760 });
  };
  const before = run.states.filter((s) => s.tick < from).at(-1);
  if (before) paint(before);
  frames.forEach((s, i) => {
    paint(s);
    writeFileSync(join(tmp, `${String(i).padStart(4, "0")}.png`), canvas.toBuffer("image/png"));
  });
  const file = join(OUT, `${type}-clip.webp`);
  const pack = [
    "import glob,sys",
    "from PIL import Image",
    "fs=sorted(glob.glob(sys.argv[1]+'/*.png'))",
    "ims=[Image.open(f).convert('RGB') for f in fs]",
    "ims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=int(sys.argv[3]),loop=0,quality=70,method=6)",
  ].join("\n");
  execFileSync("python3", ["-c", pack, tmp, file, String(Math.round(1000 / FPS))]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${type} rev ${run.rev}: ${frames.length} frames → ${file}`);
}
