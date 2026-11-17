/**
 * Crazy Golf golfRev 3's course sheet (a design tool): every hole template (its first variant) drawn by the real renderer
 * in Chromium through the dev server's modules, the redrawn course art loaded, in a grid; and the same for any ids.
 *
 *   bun scripts/shots/crazy-golf-sheet.ts --url=<origin> [--out=<png>] [--ids=0,100,…] [--scale=1] [--v2=<seed>] [--level=normal]
 *
 * `--v2=<seed>` draws today's five golfRev 2 holes of that bank course instead (the comparison).
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const origin = arg("url")!;
const out = arg("out") ?? "/tmp/crazy-golf-sheet.png";
const ids = (arg("ids") ?? Array.from({ length: 20 }, (_, i) => String(i * 100)).join(",")).split(",").map(Number);
const scale = Number(arg("scale") ?? "1");
const v2 = arg("v2");
const level = arg("level") ?? "normal";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 })).newPage();
await p.goto(`${origin}/practice`, { waitUntil: "domcontentloaded", timeout: 240_000 });
const data = await p.evaluate(
  async ({ ids, scale, v2, level }) => {
    const R = await import(/* @vite-ignore */ "/src/lib/arcade/minigolf.renderer.ts");
    const H = await import(/* @vite-ignore */ "/src/lib/arcade/minigolfHolesV3.ts");
    const C = await import(/* @vite-ignore */ "/src/lib/arcade/skins/minigolfCourse.ts");
    const M = await import(/* @vite-ignore */ "/src/lib/arcade/minigolf.ts");
    const holes = v2 ? M.minigolfCourseV2(Number(v2)) : ids.map((id: number) => H.buildHoleV3(id, 0, level));
    // Ask for the course art and wait for it to arrive.
    for (let i = 0; i < 60 && !C.courseArt(); i++) await new Promise((r) => setTimeout(r, 250));
    const cols = Math.min(5, holes.length);
    const W = 390 * scale;
    const Ht = 690 * scale;
    const cv = document.createElement("canvas");
    cv.width = cols * W;
    cv.height = Math.ceil(holes.length / cols) * Ht;
    const ctx = cv.getContext("2d")!;
    holes.forEach((h: { holeId?: number }, i: number) => {
      const id = h.holeId ?? i;
      ctx.save();
      ctx.translate((i % cols) * W, Math.floor(i / cols) * Ht);
      ctx.scale(scale, scale);
      R.paintMinigolfHole(ctx, h, 7);
      // The sails (drawn every frame in play) at a moment they stand clear of the doorway.
      for (const m of (h as { windmills?: unknown[] }).windmills ?? []) R.drawWindmill(ctx, m, 8);
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px sans-serif";
      ctx.fillText(v2 ? `Today: hole ${i + 1}` : `${H.HOLE_TEMPLATES[Math.floor(id / 100)].name}`, 24, 26);
      ctx.restore();
    });
    return cv.toDataURL("image/png");
  },
  { ids, scale, v2, level },
);
writeFileSync(out, Buffer.from(data.split(",")[1]!, "base64"));
await b.close();
console.log(out);
