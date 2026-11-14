// Renders round 2 into docs/design/style-guide: the art kit, the style-guide sheets and every mockup.
// From the repo root: node docs/design/style-guide/source/render2.mjs [--no-art] [--only=<name,…>]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { REPO } from './kit2.mjs';
import { ICONS, KEYART } from './art2.mjs';
import * as P from './screens2.mjs';
const D = await import('./desktop2.mjs').catch(() => ({}));
const G = await import('./sheets2.mjs').catch(() => ({}));
const req = createRequire(fs.existsSync('/opt/node-tools/package.json') ? '/opt/node-tools/x.js' : path.join(REPO, 'package.json'));
const { chromium } = req('playwright');

const OUT = path.join(REPO, 'docs/design/style-guide');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'joulz-sg-'));
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function shoot(html, file, { w, h, dpr = 1 }) {
  const f = path.join(TMP, path.basename(file) + '.html');
  fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  p.on('pageerror', (e) => console.log('pageerror', file, e.message));
  await p.goto('file://' + f);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await (await p.$('#frame')).screenshot({ path: file });
  const c = await p.evaluate(() => window.__contrast);
  await p.close();
  return c;
}

if (!args.includes('--no-art')) {
  const page = await browser.newPage();
  await page.goto('file://' + path.join(REPO, 'docs/design/directions/source/art.html'));
  await page.waitForFunction(() => window.ready);
  fs.mkdirSync(path.join(OUT, 'art'), { recursive: true });
  const jobs = [...Object.entries(ICONS).map(([n, s]) => [n, s, 192, 192]), ...Object.entries(KEYART).map(([n, s]) => ['key-' + n, s, n === 'hero' ? 960 : 640, n === 'hero' ? 600 : 400])];
  for (const [n, s, w, h] of jobs) {
    const cols = [...Array(8)].map((_, i) => s.cols[i] || '#808080');
    const url = await page.evaluate((o) => window.renderArt(o), { ...s, cols, style: 1, w, h });
    fs.writeFileSync(path.join(OUT, 'art', n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('art done');
}

const PHONE = { home: P.home, play: P.play, sheet: P.sheet, puzzle: P.puzzle, arcade: P.arcade, catalogue: P.catalogue, intro: P.intro, challenges: P.challengesList, profile: P.profile, shop: P.shop, more: P.more, list: P.list };
for (const [n, fn] of Object.entries(PHONE)) if (want(n)) await shoot(fn('dark'), path.join(OUT, 'phone', n + '.png'), { w: 390, h: 844, dpr: 1.5 });
if (want('home')) {
  await shoot(P.home('dark', 470), path.join(OUT, 'phone', 'home-scrolled.png'), { w: 390, h: 844, dpr: 1.5 });
  await shoot(P.home('light'), path.join(OUT, 'phone', 'home-light.png'), { w: 390, h: 844, dpr: 1.5 });
}
for (const [n, fn] of Object.entries(D.DESKTOP || {})) if (want(n)) await shoot(fn('dark'), path.join(OUT, 'desktop', n + '.png'), { w: 1440, h: 900, dpr: 0.75 });
for (const [n, fn] of Object.entries(G.SHEETS || {})) if (want(n)) {
  const c = await shoot(fn(), path.join(OUT, n + '.png'), { w: 900, h: 1400, dpr: 1 });
  if (c) { const bad = Object.entries(c).filter(([, r]) => r < 4.5); console.log(n, 'contrast', bad.length ? 'FAIL ' + JSON.stringify(bad) : `all ${Object.keys(c).length} pairs ≥ 4.5`); }
}
console.log('screens done');
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
