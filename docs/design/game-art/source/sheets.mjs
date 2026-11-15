// Contact sheets for GALLERY.md: one per category (tiles at catalogue size, heroes small, names under each), into
// docs/design/game-art/sheets/<category>.webp. From the repo root: node docs/design/game-art/source/sheets.mjs [cat…]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GAMES, ORDER, hueOf } from './games.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const req = createRequire(fs.existsSync('/opt/node-tools/package.json') ? '/opt/node-tools/x.js' : path.resolve(HERE, '../../../../package.json'));
const { chromium } = req('playwright');
const FONT = path.resolve(HERE, '../../../../public/fonts/archivo-var-latin.woff2');
const LABEL = { word: 'Word', number: 'Number', speed: 'Speed', attention: 'Attention', pattern: 'Pattern', logic: 'Logic', retro: 'Arcade · Retro', sports: 'Arcade · Sports', cards: 'Arcade · Cards & Board', action: 'Arcade · Action', strategy: 'Arcade · Strategy' };
const want = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
for (const cat of ORDER) {
  if (want.length && !want.includes(cat)) continue;
  const games = GAMES.filter((g) => (g.group || g.cat) === cat && fs.existsSync(path.join(OUT, 'tile', g.id + '.webp')));
  if (!games.length) continue;
  const hue = hueOf(games[0]);
  const cell = (g) => `<figure><div class="pair"><img class="t" src="file://${OUT}/tile/${g.id}.webp"><img class="h" src="file://${OUT}/hero/${g.id}.webp"></div><figcaption>${g.name} <span>${g.id}</span></figcaption></figure>`;
  const html = `<!doctype html><meta charset=utf-8><style>@font-face{font-family:Archivo;src:url(file://${FONT})}
  body{margin:0;background:#06080F;font-family:Archivo;color:#EEF2FF}#frame{padding:28px;width:1064px}
  h1{font:800 26px Archivo;margin:0 0 4px;display:flex;align-items:center;gap:10px}h1 i{width:14px;height:14px;border-radius:7px;background:${hue}}
  p{margin:0 0 18px;color:#8F9BBF;font:600 14px Archivo}.g{display:grid;grid-template-columns:repeat(3,max-content);gap:18px 24px}
  .pair{display:flex;gap:10px}.t{width:120px;height:120px;border-radius:12px}.h{width:192px;height:120px;border-radius:12px}
  figure{margin:0}figcaption{font:700 15px Archivo;margin-top:6px}figcaption span{color:#8F9BBF;font-weight:600;font-size:13px}</style>
  <div id="frame"><h1><i></i>${LABEL[cat]}</h1><p>${games.length} games · tile 320 × 320 and hero 960 × 600, shown small</p><div class="g">${games.map(cell).join('')}</div></div>`;
  const f = path.join(OUT, 'sheets', `.${cat}.html`); fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 1 });
  await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(100);
  const png = path.join(OUT, 'sheets', `.${cat}.png`);
  await (await p.$('#frame')).screenshot({ path: png }); await p.close(); fs.rmSync(f);
  execFileSync('python3', ['-c', `from PIL import Image;Image.open('${png}').convert('RGB').save('${path.join(OUT, 'sheets', cat + '.webp')}',quality=80,method=6)`]);
  fs.rmSync(png); console.log('sheet', cat);
}
await browser.close();
