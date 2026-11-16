/**
 * Attention overhaul art (phase 2 step 4, 15 Nov 2026): exports each game piece's outlines from the app's own drawing
 * code, so the Blender renders (docs/design/attention-overhaul/source/) keep every silhouette, turn and facing exactly.
 *
 * Each piece is drawn by its React component into an SVG, loaded in headless Chromium, and every filled or stroked
 * shape is sampled into polylines in the piece's own units (transforms applied). Translucent gloss and shade layers
 * are left out: Blender's light does that job. Output: one JSON file for the Blender scripts.
 *
 *   bun scripts/attention-art/outlines.tsx [--out=<file>]   (default $JZ_TMP/attention-outlines.json)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { pieces } from "./pieces";
import { PAIR_ENAMEL, SPOT_ENAMEL, TALLY_ENAMEL } from "../../src/lib/duel/attentionPalette.data";

const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const out = outArg ?? join(process.env.JZ_TMP ?? "/tmp/jz-attention", "attention-outlines.json");

// Every custom property the app defines (last definition wins), so var(--x) resolves as on a phone.
function cssVars(): string {
  const found = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".css")) {
        for (const m of readFileSync(p, "utf8").matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) if (!found.has(m[1]!)) found.set(m[1]!, m[2]!.trim());
      }
    }
  };
  walk(new URL("../../src", import.meta.url).pathname);
  return `:root{${[...found].map(([k, v]) => `${k}:${v}`).join(";")}}`;
}

const body = pieces()
  .map((p) => `<svg data-piece="${p.name}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w * 8}" height="${p.h * 8}" style="color:${p.color ?? "#fff"}">${renderToStaticMarkup(React.createElement(React.Fragment, null, p.node))}</svg>`)
  .join("\n");
const html = `<!doctype html><html><head><style>${cssVars()} body{margin:0;background:#000}</style></head><body>${body}</body></html>`;

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage();
await page.setContent(html);
const result = await page.evaluate(() => {
  const outp: Record<string, unknown> = {};
  for (const svg of Array.from(document.querySelectorAll("svg[data-piece]")) as SVGSVGElement[]) {
    const items: unknown[] = [];
    const vb = svg.viewBox.baseVal;
    const root = svg.getScreenCTM()!.inverse();
    let order = 0;
    for (const el of Array.from(svg.querySelectorAll("path,circle,ellipse,rect,polygon,polyline,line")) as SVGGeometryElement[]) {
      if (el.closest("defs,clipPath,mask")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      let op = Number(cs.opacity) * Number(cs.fillOpacity);
      for (let g = el.parentElement; g && g !== (svg as Element); g = g.parentElement) op *= Number(getComputedStyle(g).opacity);
      const fill = cs.fill;
      const stroke = cs.stroke;
      const sw = Number.parseFloat(cs.strokeWidth) || 0;
      const sop = Number(cs.strokeOpacity) * Number(cs.opacity);
      const wantFill = fill !== "none" && !fill.startsWith("url") && op > 0.6;
      const wantStroke = stroke !== "none" && !stroke.startsWith("url") && sw > 0 && sop > 0.6;
      if (!wantFill && !wantStroke) continue;
      const m = root.multiply(el.getScreenCTM()!);
      const len = el.getTotalLength();
      if (!(len > 0)) continue;
      const step = Math.max(0.05, Math.min(0.25, len / 400));
      const subs: number[][][] = [];
      let cur: number[][] = [];
      let last: DOMPoint | null = null;
      for (let s = 0; s <= len + 1e-6; s += step) {
        const q = el.getPointAtLength(Math.min(s, len));
        if (last && Math.hypot(q.x - last.x, q.y - last.y) > step * 3) {
          if (cur.length > 2) subs.push(cur);
          cur = [];
        }
        const t = new DOMPoint(q.x, q.y).matrixTransform(m);
        cur.push([+t.x.toFixed(3), +t.y.toFixed(3)]);
        last = q;
      }
      if (cur.length > 2) subs.push(cur);
      const scale = Math.hypot(m.a, m.b);
      const tag = el.tagName;
      const closed = tag !== "line" && tag !== "polyline" && (tag !== "path" || /z\s*$/i.test(el.getAttribute("d") ?? ""));
      items.push({ order: order++, subs, closed, fill: wantFill ? fill : null, stroke: wantStroke ? stroke : null, sw: sw * scale, role: el.getAttribute("data-role") });
    }
    outp[svg.dataset.piece!] = { w: vb.width, h: vb.height, items };
  }
  return outp;
});
await browser.close();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ pieces: result, palettes: { spot: SPOT_ENAMEL, tally: TALLY_ENAMEL, pair: PAIR_ENAMEL } }));
console.log(`wrote ${out}: ${Object.keys(result).length} pieces`);
