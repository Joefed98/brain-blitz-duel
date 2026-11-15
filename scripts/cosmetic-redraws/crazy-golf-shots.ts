/**
 * Crazy Golf's default course, today beside the redraw (a design tool, not a check): the real app on a dev server,
 * practice, the first hole at 390 × 844, a still of each and a short clip of a putt. The redraw pass turns
 * `default.crazy-golf.course` on in src/config/cosmeticRedraws.ts for its length and puts the file back as it was.
 *
 *   bun scripts/cosmetic-redraws/crazy-golf-shots.ts [--url=<origin>]
 *
 * Writes docs/design/cosmetics-redraws/samples/crazy-golf/{today,redraw}.png and {today,redraw}.webp.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "playwright";
import sharpless from "@napi-rs/canvas";

import { startServer } from "../arcade-perf";
import { practiceGameUrl } from "../practice-side-lib";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "docs/design/cosmetics-redraws/samples/crazy-golf");
const CONFIG = join(ROOT, "src/config/cosmeticRedraws.ts");
const OFF = `"default.crazy-golf.course": false,`;
const ON = `"default.crazy-golf.course": true,`;
mkdirSync(OUT, { recursive: true });

const url = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
const { origin, proc } = await startServer(url, 5233);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const original = readFileSync(CONFIG, "utf8");

async function open(): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ at: "2026-11-01T00:00:00Z" }));
    } catch {
      /* ignore */
    }
  });
  const page = await ctx.newPage();
  await page.goto(practiceGameUrl(origin, "minigolf"), { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.getByRole("button", { name: /ready/i }).first().click({ timeout: 240_000 });
  await page.locator("[data-game-stage] canvas").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(4500); // the countdown, then the images arriving
  return page;
}

async function putt(page: Page): Promise<Buffer[]> {
  const canvas = page.locator("[data-game-stage] canvas").first();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.62;
  const frames: Buffer[] = [];
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x + i * 2, y + i * 14);
    frames.push(await page.screenshot());
  }
  await page.mouse.up();
  for (let i = 0; i < 26; i++) {
    frames.push(await page.screenshot());
    await page.waitForTimeout(60);
  }
  return frames;
}

async function animated(frames: Buffer[], file: string): Promise<number> {
  const { createCanvas, loadImage } = sharpless;
  // Pillow writes the animated WebP (the frames as PNGs in a temporary folder).
  const dir = join("/tmp", `cg-frames-${process.pid}-${file}`);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames.length; i++) {
    const img = await loadImage(frames[i]!);
    const c = createCanvas(img.width, img.height);
    c.getContext("2d").drawImage(img, 0, 0);
    writeFileSync(join(dir, `${String(i).padStart(3, "0")}.png`), await c.encode("png"));
  }
  const out = join(OUT, file);
  const py = `import glob\nfrom PIL import Image\nfs=sorted(glob.glob("${dir}/*.png"))\nims=[Image.open(f).convert("RGB") for f in fs]\nims[0].save("${out}",save_all=True,append_images=ims[1:],duration=110,loop=0,quality=62,method=6)\n`;
  const r = Bun.spawnSync(["python3", "-c", py]);
  if (r.exitCode !== 0) throw new Error(String(r.stderr));
  return readFileSync(out).length;
}

async function still(page: Page, file: string): Promise<number> {
  const png = await page.screenshot();
  const out = join(OUT, file);
  const py = `import io,sys\nfrom PIL import Image\nim=Image.open("/dev/stdin").convert("RGB").quantize(colors=256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG)\nim.save("${out}",optimize=True)\n`;
  const r = Bun.spawnSync(["python3", "-c", py], { stdin: png });
  if (r.exitCode !== 0) throw new Error(String(r.stderr));
  return readFileSync(out).length;
}

try {
  for (const [tag, on] of [
    ["today", false],
    ["redraw", true],
  ] as const) {
    writeFileSync(CONFIG, on ? original.replace(OFF, ON) : original);
    if (on) await new Promise((r) => setTimeout(r, 3000)); // the dev server picks the change up
    const page = await open();
    const s = await still(page, `${tag}.png`);
    const c = await animated(await putt(page), `${tag}.webp`);
    console.log(`${tag}: still ${(s / 1024).toFixed(0)} KB, clip ${(c / 1024).toFixed(0)} KB`);
    await page.context().close();
  }
} finally {
  writeFileSync(CONFIG, original);
  await browser.close();
  if (proc?.pid) process.kill(-proc.pid);
}
