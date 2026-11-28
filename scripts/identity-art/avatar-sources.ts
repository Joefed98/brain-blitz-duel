/**
 * The 32 avatars' sources for the Blender render (S5 step 2, PR A): what identity_art.py's avatar builder reads.
 *
 *   bun scripts/identity-art/avatar-sources.ts <out dir>
 *
 * Reads the approved drawings exactly as the app holds them (AVATARS in src/design/identity/playerCardArt.data.ts) and
 * writes into <out>:
 *   avatars.json   [{ id, name, defaultMain, figure }]: figure is the drawing's own markup after its wash (the
 *                  elements the 3D figure is built from), its main-colour gradient written as fill="MAIN"
 *   gems.json      the ten gems' stops (GEMS)
 *   scene-<id>.png the avatar's own scene, toned down as Joe approved for Captain Joulz (28 Nov 2026), 1024 px
 *                  square over the 100-unit viewBox, clipped to the well (r 44.5): the well's texture
 * The scenes are rasterised by headless Chromium (they hold text: Nucleus's letter tiles), so the texture is the
 * drawing itself, not a redraw.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { AVATARS, GEMS } from "../../src/design/identity/playerCardArt.data";
import { CHROMIUM_PATHS } from "../theme-screens";

const out = process.argv[2];
if (!out) throw new Error("usage: avatar-sources.ts <out dir>");
mkdirSync(out, { recursive: true });

const WASH = `<circle cx="50" cy="52" r="38" fill="#06080F" opacity="0.25"></circle>`;
/** The well's colour under the toned scene (identity_art.py's well enamel, #0B1026). */
const WELL = "#0B1026";
/** How much of the scene shows through on the well (the approved Captain Joulz stripes: about this strong). */
const SCENE_STRENGTH = 0.2;

const rows = AVATARS.map((a) => {
  const at = a.svg.indexOf(WASH);
  const end = a.svg.lastIndexOf("</g></svg>");
  if (at < 0 || end < at) throw new Error(`${a.id}: no wash or figure`);
  const main = /<linearGradient id="\{\{p\}\}(av\d+m)"/.exec(a.svg)?.[1];
  if (!main) throw new Error(`${a.id}: no main gradient`);
  const figure = a.svg.slice(at + WASH.length, end).replaceAll(`url(#{{p}}${main})`, "MAIN");
  const scene = /<g opacity="0\.42">([\s\S]*?)<\/g><rect width="100" height="100" fill="#06080F" opacity="0\.35"><\/rect>/.exec(a.svg)?.[1];
  if (scene === undefined) throw new Error(`${a.id}: no scene`);
  return { id: a.id, name: a.name, defaultMain: a.defaultMain, figure, scene };
});
writeFileSync(`${out}/avatars.json`, JSON.stringify(rows.map(({ scene: _s, ...r }) => r), null, 1));
writeFileSync(`${out}/gems.json`, JSON.stringify(GEMS, null, 1));

const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) throw new Error("no Chromium");
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
// The scenes' text is set in Archivo (the app's one font): the self-hosted file, inlined.
const archivo = readFileSync("public/fonts/archivo-var-latin.woff2").toString("base64");
const FACE = `<style>@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${archivo}) format("woff2");font-weight:100 900;font-stretch:62% 125%}</style>`;
for (const r of rows) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024"><defs><clipPath id="c"><circle cx="50" cy="50" r="44.5"></circle></clipPath></defs><rect width="100" height="100" fill="${WELL}"></rect><g clip-path="url(#c)"><g opacity="${SCENE_STRENGTH}">${r.scene}</g></g></svg>`;
  await page.setContent(`<!doctype html><html><head>${FACE}</head><body style="margin:0;background:${WELL}">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/scene-${r.id}.png`, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
}
await browser.close();
console.log(`${rows.length} avatars, ${GEMS.length} gems, scenes in ${out}`);
process.exit(0);
