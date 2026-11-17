/**
 * Crazy Golf golfRev 3's features clip (a design tool, round 2 of the overhaul): four holes drawn by the real renderer in
 * Chromium through the dev server's modules (the redrawn course art loaded), the windmills' sails turning on the sim
 * tick, two seconds, as one animated WebP for the gallery.
 *
 *   bun scripts/shots/crazy-golf-features-clip.ts --url=<origin> [--ids=0,1000,300,100] [--out=<webp>]
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const origin = arg("url")!;
const ROOT = join(import.meta.dir, "../..");
const out = arg("out") ?? join(ROOT, "docs/design/pages-review/crazy-golf/clip-features-after.webp");
const ids = (arg("ids") ?? "0,1000,300,100").split(",").map(Number);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 })).newPage();
await p.goto(`${origin}/practice`, { waitUntil: "domcontentloaded", timeout: 240_000 });
const frames = await p.evaluate(
  async ({ ids }) => {
    const R = await import(/* @vite-ignore */ "/src/lib/arcade/minigolf.renderer.ts");
    const H = await import(/* @vite-ignore */ "/src/lib/arcade/minigolfHolesV3.ts");
    const C = await import(/* @vite-ignore */ "/src/lib/arcade/skins/minigolfCourse.ts");
    for (let i = 0; i < 60 && !C.courseArt(); i++) await new Promise((r) => setTimeout(r, 250));
    const holes = ids.map((id: number) => H.buildHoleV3(id, 0, "normal"));
    const W = 390;
    const Ht = 690;
    const base = holes.map((h: unknown) => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = Ht;
      R.paintMinigolfHole(c.getContext("2d")!, h, 7);
      return c;
    });
    const cv = document.createElement("canvas");
    cv.width = 2 * W;
    cv.height = 2 * Ht;
    const ctx = cv.getContext("2d")!;
    const out: string[] = [];
    for (let t = 0; t < 120; t += 4) {
      holes.forEach((h: { windmills?: unknown[] }, i: number) => {
        ctx.save();
        ctx.translate((i % 2) * W, Math.floor(i / 2) * Ht);
        ctx.drawImage(base[i]!, 0, 0);
        for (const m of h.windmills ?? []) R.drawWindmill(ctx, m, t);
        ctx.restore();
      });
      out.push(cv.toDataURL("image/png"));
    }
    return out;
  },
  { ids },
);
await b.close();
const dir = join("/tmp", `cg-features-${process.pid}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
frames.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(3, "0")}.png`), Buffer.from(f.split(",")[1]!, "base64")));
const r = Bun.spawnSync(["python3", join(ROOT, "scripts/cosmetic-redraws/clip.py"), dir, out, "15", "480"]);
if (r.exitCode !== 0) throw new Error(String(r.stderr));
rmSync(dir, { recursive: true, force: true });
console.log(out);
