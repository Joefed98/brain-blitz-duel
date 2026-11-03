/**
 * Wavefront's enemy ships (3 Nov 2026, display only; Joe's mockups: gunmetal hulls, magenta neon, orange furnace seams,
 * side cannons, fire exhaust with a blue-hot core). The hit boxes are unchanged (no stamp), so the art must stay on them
 * (CLAUDE.md rule 3, within 2 px):
 *  1. every enemy hull (Dart, Raptor, Bulwark; every finish and tint; exhaust at several moments) draws only inside its
 *     28 px cell, recorded on a fake context (fills, paths, arcs, ellipses, images);
 *  2. the three kinds have clearly different silhouettes (their drawn point clouds differ);
 *  3. the UFO draws inside the saucer's hit box (12 px either side, 16 up and down).
 *
 *   bun scripts/wavefront-ships-check.ts
 */
import { drawHull, drawWavefrontSaucer, wavHullTint } from "../src/lib/arcade/wavefront.renderer";
import { WAV_CELL, WAV_COLOURS, WAV_SAUCER_R } from "../src/lib/arcade/wavefront";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

/** A fake 2D context recording every point drawn (after the current translate/scale, which these painters don't use). */
function recorder(): { ctx: CanvasRenderingContext2D; pts: [number, number][] } {
  const pts: [number, number][] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_, k) {
      if (k === "fillRect" || k === "strokeRect" || k === "drawImage") {
        return (...a: number[]) => {
          const [x, y, w, h] = k === "drawImage" ? [a[1]!, a[2]!, a[3]!, a[4]!] : [a[0]!, a[1]!, a[2]!, a[3]!];
          pts.push([x, y], [x + w, y + h]);
        };
      }
      if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => pts.push([x, y]);
      if (k === "quadraticCurveTo") return (cx: number, cy: number, x: number, y: number) => pts.push([cx, cy], [x, y]);
      if (k === "arc") return (x: number, y: number, r: number) => pts.push([x - r, y - r], [x + r, y + r]);
      if (k === "ellipse") return (x: number, y: number, rx: number, ry: number) => pts.push([x - rx, y - ry], [x + rx, y + ry]);
      if (k === "rect") return () => {};
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k in target) return target[k as string];
      return () => {};
    },
    set(_, k, v) {
      target[k as string] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, pts };
}

/* 1–2. Hulls in their cell. */
const clouds: string[] = [];
const finishes = [...WAV_COLOURS, "maroon", "navy", "darkred"];
for (const kind of [0, 1, 2]) {
  let cloud = "";
  for (const colour of finishes)
    for (const t of [0, 0.37, 1.9, 7.25]) {
      const x = 101;
      const y = 57;
      const { ctx, pts } = recorder();
      drawHull(ctx, kind, colour, x, y, WAV_CELL, t);
      const out = pts.filter(([px, py]) => px < x - 2 || px > x + WAV_CELL + 2 || py < y - 2 || py > y + WAV_CELL + 2);
      ok(out.length === 0, `kind ${kind} (${colour}, t ${t}): ${out.length} drawn points outside its 28 px cell (${JSON.stringify(out.slice(0, 3))})`);
      ok(pts.length > 20, `kind ${kind} (${colour}): it draws (${pts.length} points)`);
      if (colour === WAV_COLOURS[0] && t === 0) cloud = pts.map(([px, py]) => `${Math.round(px - x)},${Math.round(py - y)}`).join(" ");
    }
  clouds.push(cloud);
}
ok(new Set(clouds).size === 3, "the Dart, Raptor and Bulwark draw three different silhouettes");
ok([...Array(64).keys()].some((c) => wavHullTint(c, 3) !== null), "a few ships carry a tint");

/* 3. The UFO in its hit box. */
for (const t of [0, 0.5, 2.3]) {
  const x = 180;
  const y = 62;
  const { ctx, pts } = recorder();
  drawWavefrontSaucer(ctx, x, t);
  const out = pts.filter(([px, py]) => px < x - (WAV_SAUCER_R + 2) - 2 || px > x + WAV_SAUCER_R + 2 + 2 || py < y - (WAV_SAUCER_R + 6) - 2 || py > y + WAV_SAUCER_R + 6 + 2);
  ok(out.length === 0, `the UFO (t ${t}): ${out.length} drawn points outside its hit box`);
}

if (failures.length) {
  console.log(`FAIL wavefront-ships-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS wavefront-ships-check: ${checks} checks — every enemy hull inside its 28 px cell (exhaust included), three distinct silhouettes, the UFO inside its hit box`);
