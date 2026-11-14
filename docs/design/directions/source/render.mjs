// Renders round 1: the art kit per direction, every mockup and the reference wireframes, into docs/design/directions.
// Run from the repo root: node docs/design/directions/source/render.mjs [forge|volt|studio …] [--no-art]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DIRECTIONS } from './directions.mjs';
import { ICON_SCENES, KEY_SCENES } from './art-scenes.mjs';
import * as S from './screens.mjs';
import { refPage, REFS } from './refs.mjs';
const { chromium } = createRequire(path.join(S.REPO, 'package.json'))('playwright');

const OUT = path.join(S.REPO, 'docs/design/directions');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'joulz-dir-'));
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const dirs = only.length ? only : Object.keys(DIRECTIONS);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));

async function shoot(html, file, { w, h, dpr = 1 }) {
  const f = path.join(TMP, path.basename(file) + '.html');
  fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  p.on('pageerror', (e) => console.log('pageerror', file, e.message));
  await p.goto('file://' + f);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  const el = await p.$('#frame');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await el.screenshot({ path: file });
  const contrast = await p.evaluate(() => window.__contrast);
  await p.close();
  return contrast;
}

const SAT = { 0: 0.92, 1: 1.08, 2: 1.05 };
function saturate(hex, k) {
  if (!hex) return hex;
  const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255];
  const g = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(g + (v - g) * k))).toString(16).padStart(2, '0')).join('');
}

const font = 'file://' + path.join(S.REPO, 'public/fonts/archivo-var-latin.woff2');
for (const k of Object.keys(REFS)) {
  const [w, h] = REFS[k];
  await shoot(refPage(k, font), path.join(OUT, 'reference', `${k}.png`), { w, h, dpr: w > 500 ? 0.75 : 1.5 });
}

for (const dir of dirs) {
  const d = DIRECTIONS[dir];
  if (!args.includes('--no-art')) {
    await page.goto('file://' + path.join(S.REPO, 'docs/design/directions/source/art.html'));
    await page.waitForFunction(() => window.ready);
    const all = [...Object.entries(ICON_SCENES).map(([n, s]) => [n, s, 192, 192]), ...Object.entries(KEY_SCENES).map(([n, s]) => [n, s, n === 'hero' ? 960 : 640, n === 'hero' ? 600 : 400])];
    for (const [n, s, w, h] of all) {
      const cols = [...Array(8)].map((_, i) => saturate(s.cols[i], SAT[d.style]));
      const url = await page.evaluate((o) => window.renderArt(o), { ...s, cols, style: d.style, w, h });
      fs.mkdirSync(path.join(OUT, dir, 'art'), { recursive: true });
      fs.writeFileSync(path.join(OUT, dir, 'art', n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log(dir, 'art done');
  }
  const c = await shoot(S.sheet(d, dir), path.join(OUT, dir, 'palette.png'), { w: 780, h: 1200, dpr: 1 });
  const bad = Object.entries(c || {}).filter(([, r]) => r < 4.5);
  console.log(dir, 'contrast', bad.length ? 'FAIL ' + JSON.stringify(bad) : 'all ≥ 4.5');
  for (const [name, fn] of [['home', S.homePhone], ['play', S.playPhone], ['game', S.gamePhone]]) {
    await shoot(fn(d, dir), path.join(OUT, dir, `${name}-phone.png`), { w: 390, h: 844, dpr: 1.5 });
  }
  await shoot(S.homePhone(d, dir, 'dark', 560), path.join(OUT, dir, 'home-phone-scrolled.png'), { w: 390, h: 844, dpr: 1.5 });
  await shoot(S.homePhone(d, dir, 'light'), path.join(OUT, dir, 'home-phone-light.png'), { w: 390, h: 844, dpr: 1.5 });
  for (const [name, fn] of [['home', S.homeDesktop], ['play', S.playDesktop], ['game', S.gameDesktop]]) {
    await shoot(fn(d, dir), path.join(OUT, dir, `${name}-desktop.png`), { w: 1440, h: 900, dpr: 0.75 });
  }
  console.log(dir, 'screens done');
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
