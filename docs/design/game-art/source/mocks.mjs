// Side-by-side mocks for GALLERY.md: the Games catalogue and one game page, today's art (the live board previews,
// public/tiles) beside the new key art. Drawn as HTML in the round-2 style and screenshotted; not app code.
// From the repo root: node docs/design/game-art/source/mocks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GAMES, hueOf } from './games.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const REPO = path.resolve(HERE, '../../../..');
const req = createRequire(fs.existsSync('/opt/node-tools/package.json') ? '/opt/node-tools/x.js' : path.join(REPO, 'package.json'));
const { chromium } = req('playwright');
const FONT = path.join(REPO, 'public/fonts/archivo-var-latin.woff2');
const G = Object.fromEntries(GAMES.map((g) => [g.id, g]));
const cur = (id) => `file://${REPO}/public/tiles/${id}.webp`;
const tileNew = (id) => `file://${OUT}/tile/${id}.webp`;
const heroNew = (id) => `file://${OUT}/hero/${id}.webp`;
const tint = (hex, a = 0.38) => `radial-gradient(110% 120% at 65% 25%,${hex}${Math.round(a * 255).toString(16).padStart(2, '0')} 0%,#0F1424 72%)`;
const CSS = `@font-face{font-family:Archivo;src:url(file://${FONT})}*{box-sizing:border-box}body{margin:0;background:#06080F;font-family:Archivo;color:#EEF2FF}
#frame{display:flex;gap:40px;padding:32px;width:max-content}.col h2{font:800 20px Archivo;margin:0 0 12px}.col h2 span{color:#8F9BBF;font-weight:600;font-size:15px}
.phone{width:390px;height:844px;overflow:hidden;background:#06080F;border-radius:36px;border:1px solid #1E2640;padding:56px 16px 0;position:relative}
.top{display:flex;justify-content:space-between;align-items:center}.top b{font:800 24px Archivo}.top i{font-style:normal;color:#B5C6DD;font:700 15px Archivo}
.chips{display:flex;gap:8px;margin:16px 0}.chip{padding:8px 14px;border-radius:20px;background:#0F1424;font:700 15px Archivo;white-space:nowrap}.chip.on{background:#EEF2FF;color:#06080F}
.hero{height:200px;border-radius:16px;overflow:hidden;position:relative;margin-bottom:12px}.hero img{width:100%;height:100%;object-fit:cover}
.hero .cur{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.hero .cur img{width:150px;height:150px;border-radius:16px}
.hero b{position:absolute;left:16px;bottom:12px;font:800 24px Archivo;text-shadow:0 2px 8px #0008}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.t{position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;background:#0F1424}.t img{width:100%;height:100%;display:block}
.t b{position:absolute;left:10px;bottom:8px;font:700 15px Archivo;text-shadow:0 1px 6px #000c}.t s{position:absolute;right:10px;bottom:9px;text-decoration:none;color:#E2C07A;font-size:12px}
.art{height:240px;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}.art img.icon{width:208px;height:208px;border-radius:16px}.art img.wide{width:100%;height:100%;object-fit:cover}
.back{position:absolute;left:10px;top:10px;width:36px;height:36px;border-radius:18px;background:#06080Fcc;display:flex;align-items:center;justify-content:center;font:800 18px Archivo}
.name{font:800 24px Archivo;margin:16px 0 4px}.meta{color:#B5C6DD;font:600 15px Archivo}.p{color:#B5C6DD;font:600 15px/1.45 Archivo;margin:14px 0}
.play{position:absolute;left:16px;right:16px;bottom:34px;height:60px;background:#E2C07A;color:#06080F;display:flex;align-items:center;justify-content:center;font:800 20px Archivo;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.sec{font:800 17px Archivo;margin:18px 0 8px}.row{background:#0F1424;border-radius:12px;padding:14px;margin-bottom:8px;font:700 15px Archivo}`;
const catalogue = (useNew) => {
  const heroId = 'pool', ids = ['tubes', 'matchup', 'tower', 'blockfall', 'wordsmith', 'racing'];
  const tileImg = (id) => (useNew ? tileNew(id) : cur(id));
  const heroEl = useNew ? `<img src="${heroNew(heroId)}">` : `<div class="cur" style="background:${tint(hueOf(G[heroId]))}"><img src="${cur(heroId)}"></div>`;
  return `<div class="phone"><div class="top"><b>Games</b><i>★ 74 / 249</i></div>
  <div class="chips"><span class="chip on">All</span><span class="chip">Word</span><span class="chip">Number</span><span class="chip">Speed</span></div>
  <div class="hero">${heroEl}<b>${G[heroId].name}</b></div>
  <div class="grid">${ids.map((id) => `<div class="t"><img src="${tileImg(id)}"><b>${G[id].name}</b><s>★★☆</s></div>`).join('')}</div></div>`;
};
const page = (useNew) => {
  const id = 'pool', g = G[id];
  const art = useNew ? `<img class="wide" src="${heroNew(id)}">` : `<img class="icon" src="${cur(id)}">`;
  return `<div class="phone"><div class="art" style="background:${useNew ? '#0F1424' : tint(hueOf(g), 0.45)}">${art}<span class="back">‹</span></div>
  <div class="name">${g.name}</div><div class="meta">Sports · 90 s · Best 162 · ★★☆</div>
  <p class="p">Pot your seven, spots or stripes, then the black, without a miss.</p>
  <div class="sec">Challenges</div><div class="row">Pot all seven in under 60 s</div><div class="row">Win without a foul</div><div class="play">Play</div></div>`;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
fs.mkdirSync(path.join(OUT, 'mocks'), { recursive: true });
for (const [name, fn] of [['catalogue', catalogue], ['game-page', page]]) {
  const html = `<!doctype html><meta charset=utf-8><style>${CSS}</style><div id="frame"><div class="col"><h2>Today <span>live board previews</span></h2>${fn(false)}</div><div class="col"><h2>New <span>3D key art</span></h2>${fn(true)}</div></div>`;
  const f = path.join(OUT, 'mocks', `.${name}.html`); fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: 940, height: 960 }, deviceScaleFactor: 1 });
  await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  const png = path.join(OUT, 'mocks', `.${name}.png`); await (await p.$('#frame')).screenshot({ path: png }); await p.close(); fs.rmSync(f);
  execFileSync('python3', ['-c', `from PIL import Image;Image.open('${png}').convert('RGB').save('${path.join(OUT, 'mocks', name + '.webp')}',quality=82,method=6)`]);
  fs.rmSync(png); console.log('mock', name);
}
await browser.close();
