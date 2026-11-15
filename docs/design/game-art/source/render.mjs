// Renders the game key art: for every live game a square tile and a wide hero, as WebP, into
// docs/design/game-art/{tile,hero}/<id>.webp. From the repo root:
//   node docs/design/game-art/source/render.mjs [--cat=word,number] [--only=pool,tilt] [--png]
// Needs the pre-installed Chromium (WebGL through SwiftShader). Scenes: ./scenes/<category>.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compile, hullPoints } from './scene.mjs';
import { GAMES, hueOf } from './games.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const req = createRequire(fs.existsSync('/opt/node-tools/package.json') ? '/opt/node-tools/x.js' : path.resolve(HERE, '../../../../package.json'));
const { chromium } = req('playwright');

/** The one camera: 34° above the floor, from the front right; the key light from the top left of the view. */
export const CAMERA = { el: 34, az: 28, focal: 3.2 };
/** Where the subject sits in each frame (y in uv units, up; x as a share of the half width). The tile keeps its lowest
 *  quarter clear for the catalogue's name and stars; the hero sits a little right of centre. */
export const FRAMES = {
  tile: { w: 320, h: 320, ss: 1.5, box: [-0.94, -0.52, 0.94, 0.9] },
  hero: { w: 960, h: 600, ss: 1.25, box: [-0.6, -0.76, 0.92, 0.86] },
};
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function frame(prims, fr, cam = {}) {
  const C = { ...CAMERA, ...cam };
  const el = (C.el * Math.PI) / 180, az = (C.az * Math.PI) / 180;
  const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const pts = prims.flatMap(hullPoints);
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  let T = lo.map((v, i) => (v + hi[i]) / 2);
  const A = fr.w / fr.h, [x0, y0, x1, y1] = fr.box.map((v, i) => (i % 2 === 0 ? v * A : v));
  const ww = dir.map((v) => -v), uu = norm(cross(ww, [0, 1, 0])), vv = cross(uu, ww);
  const proj = (dist, T) => { const ro = T.map((v, i) => v + dir[i] * dist); let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of pts) { const q = p.map((v, i) => v - ro[i]); const z = dot(q, ww); const x = (C.focal * dot(q, uu)) / z, y = (C.focal * dot(q, vv)) / z; a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
    return [a, c, b, d]; };
  // Aim so the scene's 3D centre lands on the box's centre (perspective makes a projected-bounds centre drift
  // towards near corners), then pull back until every hull point is inside the box.
  const centre = T.slice(), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const aim = (dist) => centre.map((v, i) => v - ((uu[i] * cx + vv[i] * cy) * dist) / C.focal);
  let lo2 = 0.5, hi2 = 200;
  for (let k = 0; k < 60; k++) { const m = (lo2 + hi2) / 2; const [a, c, b, d] = proj(m, aim(m)); if (a >= x0 && b <= x1 && c >= y0 && d <= y1) hi2 = m; else lo2 = m; }
  const dist = hi2 * (cam.zoomOut || 1);
  T = aim(dist);
  const ro = T.map((v, i) => v + dir[i] * dist);
  const fu = norm([uu[0], 0, uu[2]]), back = norm([dir[0], 0, dir[2]]);
  const L = norm([0, 1, 2].map((i) => -0.5 * fu[i] + 0.95 * [0, 1, 0][i] + 0.5 * back[i]));
  return { ro, ta: T, L, focal: C.focal, ground: lo[1] };
}

const args = process.argv.slice(2);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3).split(',').filter(Boolean);
const cats = opt('cat'), only = opt('only');
if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
  await page.goto('file://' + path.join(HERE, 'engine.html'));
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => document.fonts.load('800 40px Archivo'));
  for (const sub of ['tile', 'hero', ...(args.includes('--png') ? ['png'] : [])]) fs.mkdirSync(path.join(OUT, sub), { recursive: true });
  for (const g of GAMES) {
    if (cats.length && !cats.includes(g.cat) && !cats.includes(g.group)) continue;
    if (only.length && !only.includes(g.id)) continue;
    const mod = await import(`./scenes/${g.group || g.cat}.mjs`);
    const def = mod.SCENES[g.id];
    if (!def) { console.log('no scene', g.id); continue; }
    const t0 = Date.now();
    for (const [kind, fr] of Object.entries(FRAMES)) {
      const prims = def(kind);
      await page.evaluate((glsl) => window.compile(glsl), compile(prims));
      const f = frame(prims, fr, (mod.CAMERAS || {})[g.id]?.[kind] || (mod.CAMERAS || {})[g.id] || {});
      const png = await page.evaluate((o) => window.renderArt(o), { ...f, w: Math.round(fr.w * fr.ss), h: Math.round(fr.h * fr.ss) });
      if (args.includes('--png')) fs.writeFileSync(path.join(OUT, 'png', `${g.id}-${kind}.png`), Buffer.from(png.split(',')[1], 'base64'));
      const webp = await page.evaluate((o) => window.composite(o), { png, w: fr.w, h: fr.h, hue: hueOf(g), a: 0.42, q: 0.82 });
      fs.writeFileSync(path.join(OUT, kind, `${g.id}.webp`), Buffer.from(webp.split(',')[1], 'base64'));
    }
    console.log(g.id, `${Date.now() - t0} ms`);
  }
  await browser.close();
}
