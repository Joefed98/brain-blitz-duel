// Round-1 mockup screens as HTML strings. A design sketch for docs/design/directions/GALLERY.md, not app code:
// every value comes from directions.mjs, every picture from the art kit (art.html) or the approved avatars.
import fs from 'node:fs';
import path from 'node:path';
import { SHARED, TYPE_SCALE, SPACING } from './directions.mjs';

export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const F = (p) => 'file://' + path.join(REPO, p);

// The approved line icons (docs/icons), for tab bars and small chrome only.
const ICONS = (() => {
  const src = fs.readFileSync(path.join(REPO, 'src/design/icons/icons.data.ts'), 'utf8');
  const out = {};
  for (const m of src.split('ICON_LABELS')[0].matchAll(/^\s+"([a-z-]+)": "(.*)",?$/gm)) out[m[1]] = m[2];
  // Not in the set yet: a home glyph in the same 2 px stroke (flagged in the gallery as a new icon to draw).
  out.home = "<path fill='none' stroke='currentColor' stroke-width='2' stroke-linejoin='round' stroke-linecap='round' d='M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z'></path>";
  out['home-on'] = "<path fill='currentColor' stroke='currentColor' stroke-width='2' stroke-linejoin='round' d='M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z'></path>";
  return out;
})();
const icon = (n, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] ?? ''}</svg>`;

const AV = (n) => F(`docs/art/avatars/svg/${n}.svg`);
const PEOPLE = {
  me: { name: 'Nova', av: 'captain-joulz', col: '#F4B63F', rating: '1,482' },
  sam: { name: 'Sam_Volt', av: 'apex', col: '#4FA3FF', rating: '1,503' },
  kira: { name: 'KiraPlays', av: 'blockzone', col: '#FF6B8B', rating: '1,377' },
  ollie: { name: 'Ollie_K', av: 'breaker', col: '#7ED957', rating: '1,512' },
  mo: { name: 'MoFizz', av: 'blackout', col: '#C084FC', rating: '1,290' },
};

function css(d, theme, extra = '') {
  const c = d[theme];
  const r = d.radius;
  return `
@font-face{font-family:Archivo;src:url(${F('public/fonts/archivo-var-latin.woff2')}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
:root{--bg:${c.bg};--raised:${c.raised};--surface:${c.surface};--surface2:${c.surface2};--line:${c.line};--ledge2:${c.ledge2};
--text:${c.text};--text2:${c.text2};--text3:${c.text3};--accent:${c.accent};--ledge:${c.ledge};--on-accent:${c.onAccent};
--win:${SHARED.win};--loss:${SHARED.loss};--joules:${SHARED.joules};--gold:${SHARED.gold};
--r-sm:${r.sm}px;--r-md:${r.md}px;--r-lg:${r.lg}px;--r-btn:${r.btn}px;--lh:${d.ledgeH}px;
--wd:${d.type.display}%;--wt:${d.type.title}%;--dw:${d.type.dispWeight}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#141210;font-family:Archivo,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
.t-display{font-size:32px;line-height:38px;font-weight:var(--dw);font-stretch:var(--wd);letter-spacing:-.01em}
.t-title{font-size:24px;line-height:30px;font-weight:var(--dw);font-stretch:var(--wt)}
.t-heading{font-size:20px;line-height:26px;font-weight:800;font-stretch:var(--wt)}
.t-body{font-size:17px;line-height:22px;font-weight:700}
.t-label{font-size:15px;line-height:20px;font-weight:600;color:var(--text2)}
.t-cap{font-size:13px;line-height:18px;font-weight:600;color:var(--text3)}
.num{font-variant-numeric:tabular-nums}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;border-radius:var(--r-btn);font-weight:800;font-size:17px;
 position:relative;white-space:nowrap}
.btn-primary{background:var(--accent);color:var(--on-accent);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 var(--lh) 0 var(--ledge),0 calc(var(--lh) + 4px) 10px rgba(0,0,0,.28)}
.btn-secondary{background:var(--surface2);color:var(--text);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 var(--lh) 0 var(--ledge2)}
.btn-lg{height:60px;font-size:20px;font-stretch:var(--wt)}
.btn-md{height:48px}
.btn-sm{height:36px;font-size:15px;padding:0 16px}
.panel{background:var(--surface);border-radius:var(--r-lg)}
.sec{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 12px}
.sec a{font-size:15px;font-weight:700;color:var(--text2)}
.av{border-radius:var(--r-sm);overflow:hidden;flex:none;display:block}
.av img{width:100%;height:100%;display:block}
.dot{width:10px;height:10px;border-radius:50%;background:var(--win);border:2px solid var(--surface)}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:var(--surface);font-weight:800;font-size:15px}
.joules{color:var(--joules);display:inline-flex;align-items:center;gap:3px;font-weight:800}
.tag{display:inline-block;font-size:13px;font-weight:800;padding:2px 8px;border-radius:6px}
${extra}`;
}

// ---------------------------------------------------------------- phone chrome
const statusBar = () => `<div style="height:47px;position:relative;z-index:3;background:var(--bg);display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 34px;font-weight:700;font-size:16px">
 <span class="num">9:41</span><span style="display:flex;gap:6px;align-items:center">
 <svg width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="10" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
 <svg width="25" height="12"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor"/><rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5"/></svg></span></div>`;
const homeBar = () => `<div style="position:absolute;left:128px;bottom:8px;width:134px;height:5px;border-radius:3px;background:var(--text);opacity:.85"></div>`;

const TABS = [['home', 'Home'], ['practice', 'Games'], ['play', 'Play'], ['shop', 'Shop'], ['profile', 'Profile']];
function tabBar(d, current) {
  const items = TABS.map(([ic, label]) => {
    const on = ic === current;
    if (d.nav === 'raised' && ic === 'play') {
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;margin-top:-26px">
       <div class="btn btn-primary" style="width:64px;height:64px;border-radius:50%">${icon('play-on', 30)}</div>
       <span style="font-size:12px;font-weight:800;margin-top:4px;color:var(--text)">Play</span></div>`;
    }
    const n = on && ICONS[ic + '-on'] ? ic + '-on' : ic;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:${on ? 'var(--text)' : 'var(--text3)'}">
      ${icon(n, 26)}<span style="font-size:12px;font-weight:${on ? 800 : 700}">${label}</span></div>`;
  }).join('');
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:83px;background:var(--raised);display:flex;padding:8px 4px 0;border-top:1px solid var(--line)">${items}</div>`;
}

function phone(d, theme, body, { tab, sticky } = {}) {
  return `<!doctype html><meta charset="utf-8"><style>${css(d, theme)}</style>
<div id="frame" style="width:390px;height:844px;background:var(--bg);position:relative;overflow:hidden">
${statusBar()}${body}
${sticky && d.nav !== 'raised' ? `<div style="position:absolute;left:0;right:0;bottom:83px;padding:12px 16px 14px;background:linear-gradient(to bottom,transparent,var(--bg) 30%)"><div class="btn btn-primary btn-lg">Play</div></div>` : ''}
${tab ? tabBar(d, tab) : ''}${homeBar()}</div>`;
}

// ---------------------------------------------------------------- shared pieces
const art = (dir, n) => F(`docs/design/directions/${dir}/art/${n}.png`);
const avatar = (p, s, ring = true) => `<span class="av" style="width:${s}px;height:${s}px;background:${p.col};${ring ? `box-shadow:0 0 0 2px ${p.col}` : ''}"><img src="${AV(p.av)}"></span>`;
const bolt = (s = 14) => `<svg width="${s * 0.62}" height="${s}" viewBox="0 0 10 16"><path d="M6 0 0 9h4l-1 7 7-10H6l1-6z" fill="currentColor"/></svg>`;

function header(d, dir) {
  return `<div style="height:56px;position:relative;z-index:3;background:var(--bg);display:flex;align-items:center;gap:12px;padding:0 16px">
  ${avatar(PEOPLE.me, 36)}
  <span class="chip" style="background:transparent;padding:0 4px;color:var(--text)"><span style="color:var(--accent)">${icon('streak', 20)}</span><span class="num">4</span></span>
  <span style="flex:1"></span>
  <span class="chip num"><img src="${art(dir, 'coins')}" width="26" height="26" style="margin-left:-6px">1,250</span>
  <span style="width:40px;height:40px;display:grid;place-items:center;color:var(--text2)">${icon('friends', 26)}</span></div>`;
}

function heroCard(d, dir, w, pw = 150) {
  const peek = `<div class="panel" style="flex:none;width:${pw}px;height:184px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center">
     <img src="${art(dir, 'arcade')}" width="64" height="64"><div class="t-body">Daily Arcade</div><div class="t-cap">3 games</div></div>`;
  let main;
  if (d.hero === 'bleed') {
    main = `<div style="flex:none;width:${w}px;height:184px;border-radius:var(--r-lg);position:relative;overflow:hidden;background:radial-gradient(120% 120% at 75% 30%,#4A3C55 0%,#2C2530 70%)">
      <img src="${art(dir, 'board')}" style="position:absolute;right:-56px;top:24px;width:240px">
      <div style="position:absolute;left:18px;top:18px" class="t-title">Daily Puzzle</div>
      <div style="position:absolute;left:18px;top:52px" class="t-cap">12,431 played today</div>
      <div class="btn btn-primary btn-sm" style="position:absolute;left:18px;bottom:22px;width:120px">Play</div></div>`;
  } else if (d.hero === 'split') {
    main = `<div class="panel" style="flex:none;width:${w}px;height:184px;display:flex;overflow:hidden">
      <div style="flex:1;padding:18px;display:flex;flex-direction:column"><div class="t-title">Daily Puzzle</div>
      <div class="t-cap" style="margin-top:4px">12,431 played today</div><span style="flex:1"></span>
      <div class="btn btn-primary btn-sm" style="width:110px">Play</div></div>
      <div style="width:150px;background:#3B3030;position:relative"><img src="${art(dir, 'board')}" style="position:absolute;left:-36px;top:-6px;width:220px"></div></div>`;
  } else {
    main = `<div class="panel" style="flex:none;width:${w}px;height:184px;position:relative;overflow:hidden">
      <img src="${art(dir, 'board')}" style="position:absolute;right:-48px;top:28px;width:220px">
      <div style="position:absolute;left:18px;top:16px;display:flex;gap:8px;align-items:center"><img src="${art(dir, 'puzzles')}" width="34" height="34"><span class="t-title">Daily Puzzle</span></div>
      <div class="num" style="position:absolute;left:18px;bottom:62px;font-weight:800;font-size:15px">3 of 5 played</div>
      <div style="position:absolute;left:18px;bottom:46px;width:140px;height:8px;border-radius:4px;background:var(--surface2)"><div style="width:60%;height:100%;border-radius:4px;background:var(--win)"></div></div>
      <div class="btn btn-primary btn-sm" style="position:absolute;right:16px;bottom:18px;width:104px">Play</div></div>`;
  }
  return `<div style="display:flex;gap:12px;overflow:hidden">${main}${peek}</div>`;
}

function recommended(d, dir) {
  const p = PEOPLE.sam;
  return `<div class="sec"><span class="t-heading">Recommended match</span></div>
  <div class="panel" style="display:flex;align-items:center;gap:14px;padding:12px 14px">
    ${avatar(p, 52)}
    <div style="flex:1;min-width:0"><div class="t-body">${p.name}</div>
     <div class="t-cap num" style="margin-top:2px">${p.rating} · Puzzles · Online</div>
     <span class="tag" style="margin-top:6px;background:rgba(87,199,111,.16);color:var(--win)">Friend</span></div>
    <div class="btn btn-primary" style="width:52px;height:48px;border-radius:var(--r-md)">${icon('challenge', 24)}</div></div>`;
}

function ratingTiles(dir, n = 4, w = 112) {
  const tiles = [['joules', '1,482', 'Joulz Rating'], ['puzzles', '1,530', 'Puzzles'], ['arcade', '1,410', 'Arcade'], ['rated', '1,601', 'Logic']].slice(0, n);
  return `<div class="sec"><span class="t-heading">Ratings</span><a>View all</a></div>
  <div style="display:flex;gap:12px;overflow:hidden">${tiles.map(([a, v, l]) => `<div class="panel" style="flex:none;width:${w}px;height:128px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
   <img src="${art(dir, a)}" width="52" height="52"><div class="num" style="font-size:22px;font-weight:800;margin-top:4px">${v}</div><div class="t-cap" style="color:var(--text2)">${l}</div></div>`).join('')}</div>`;
}

const RECENT = [['pool', 'Cue Ball', '#1E4A40'], ['tubes', 'Polypotions', '#3A2F4C'], ['gem', 'Gemstone', '#2F2A4E'], ['board', 'Blockzone', '#4A2F2A']];
function recent(dir, n = 4, s = 72) {
  return `<div class="sec"><span class="t-heading">Recently played</span><a>See all</a></div>
  <div style="display:flex;gap:14px;overflow:hidden">${RECENT.slice(0, n).map(([a, l, bg]) => `<div style="flex:none;width:${s}px;text-align:center">
   <div style="width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle at 40% 35%,${bg},#1d1a17);overflow:hidden;position:relative">
   <img src="${art(dir, a)}" style="position:absolute;width:${s * 1.5}px;left:${-s * 0.25}px;top:${-s * 0.18}px"></div>
   <div class="t-cap" style="color:var(--text2);margin-top:6px;white-space:nowrap">${l}</div></div>`).join('')}</div>`;
}

function quest(dir) {
  const row = (t, n, of, j) => `<div style="padding:12px 0;border-top:1px solid var(--line)">
   <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-body" style="font-size:16px">${t}</span><span class="joules num">${bolt(13)}${j}</span></div>
   <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><div style="flex:1;height:8px;border-radius:4px;background:var(--surface2)"><div style="width:${(n / of) * 100}%;height:100%;border-radius:4px;background:var(--accent)"></div></div>
   <span class="t-cap num" style="color:var(--text2)">${n}/${of}</span></div></div>`;
  return `<div class="panel" style="padding:14px 16px 4px">
   <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><img src="${art(dir, 'quest')}" width="44" height="44">
   <div style="flex:1"><div class="t-heading">Weekly challenges</div><div class="t-cap">New on Monday</div></div></div>
   ${row('Win 3 rated matches', 1, 3, '750')}${row('Play 5 Logic games', 2, 5, '1,000')}</div>`;
}

function friendsRow(n = 3, w = 132) {
  const fr = [[PEOPLE.kira, 'Online'], [PEOPLE.ollie, 'In a room'], [PEOPLE.mo, '2 h ago']].slice(0, n);
  return `<div class="sec"><span class="t-heading">Friends <span class="t-cap" style="background:var(--surface2);padding:1px 8px;border-radius:999px;color:var(--text2)">12</span></span><a>View all</a></div>
  <div style="display:flex;gap:12px;overflow:hidden">${fr.map(([p, s]) => `<div class="panel" style="flex:none;width:${w}px;padding:14px 10px;text-align:center">
   <div style="position:relative;width:64px;margin:0 auto">${avatar(p, 64)}${s !== '2 h ago' ? '<span class="dot" style="position:absolute;right:-4px;bottom:-4px;width:14px;height:14px"></span>' : ''}</div>
   <div class="t-body" style="font-size:15px;margin-top:10px">${p.name}</div><div class="t-cap" style="margin-top:2px">${s}</div></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- Home
export function homePhone(d, dir, theme = 'dark', scroll = 0) {
  const body = `${header(d, dir)}
  <div style="padding:4px 16px 0;display:flex;flex-direction:column;gap:24px;transform:translateY(${-scroll}px);clip-path:inset(${scroll}px 0 0 0)">
   ${heroCard(d, dir, 290)}
   <div>${recommended(d, dir)}</div>
   <div>${ratingTiles(dir)}</div>
   <div>${recent(dir)}</div>
   ${quest(dir)}
   <div>${friendsRow()}</div>
  </div>`;
  return phone(d, theme, body, { tab: 'home', sticky: true });
}

// ---------------------------------------------------------------- Play
const MODES = [['arena', 'Arena', 'Next at 20:00'], ['rooms', 'Rooms', 'Play with friends'], ['practice', 'Practice', '83 games'], ['daily', 'Daily', 'Puzzle and Arcade']];
function playPanel(d, dir, { compact } = {}) {
  const modeBtn = ([a, l, m]) => `<div class="btn btn-secondary" style="height:${compact ? 60 : 64}px;justify-content:flex-start;padding:0 16px;border-radius:var(--r-md);gap:14px">
     <img src="${art(dir, a)}" width="44" height="44" style="margin:-4px 0"><span style="flex:1;text-align:left">${l}</span><span class="t-cap" style="font-weight:600">${m}</span></div>`;
  return `
   <div class="btn btn-secondary" style="height:56px;border-radius:var(--r-md);justify-content:flex-start;padding:0 16px;gap:12px">
     <img src="${art(dir, 'rated')}" width="36" height="36"><span style="flex:1;text-align:left">Rated · Best of 3 · Mixed</span>
     <span style="color:var(--text2)">${icon('chevron-down', 22)}</span></div>
   <div class="btn btn-primary btn-lg" style="margin-top:14px">Find a match</div>
   <div class="t-cap num" style="text-align:center;margin:12px 0 18px">Win <span style="color:var(--win)">+8</span> · Lose <span style="color:var(--loss)">−8</span> · About 6 min</div>
   <div style="display:flex;flex-direction:column;gap:${compact ? 12 : 14}px">${MODES.map(modeBtn).join('')}</div>`;
}
export function playPhone(d, dir, theme = 'dark') {
  const body = `<div style="height:52px;display:flex;align-items:center;justify-content:center" class="t-title">Play</div>
  <div style="height:200px;position:relative;margin:0 0 6px"><img src="${art(dir, 'hero')}" style="position:absolute;left:50%;top:-6px;transform:translateX(-50%);width:330px"></div>
  <div style="padding:0 16px">${playPanel(d, dir, { compact: true })}</div>`;
  return phone(d, theme, body, { tab: 'play' });
}

// ---------------------------------------------------------------- Game (Cue Ball, rated)
const BALLS = `
const COLS={1:'#F2B92E',2:'#2F6BE0',3:'#E0413A',4:'#7E4BC9',5:'#F07A2A',6:'#1E9A5A',7:'#8A2A2A',8:'#141414'};
function ball(ctx,x,y,r,n){const c=COLS[n>8?n-8:n]||'#F4EFE6';
 ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.clip();
 ctx.fillStyle=n===0?'#F4EFE6':(n>8?'#F4EFE6':c);ctx.fillRect(x-r,y-r,2*r,2*r);
 if(n>8){ctx.fillStyle=c;ctx.fillRect(x-r,y-r*.55,2*r,r*1.1);}
 if(n>0){ctx.fillStyle='#F7F3EA';ctx.beginPath();ctx.arc(x,y,r*.48,0,7);ctx.fill();ctx.fillStyle='#1b1b1b';
  ctx.font='800 '+Math.round(r*.62)+'px Archivo';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n,x,y+r*.04);}
 const g=ctx.createRadialGradient(x-r*.4,y-r*.45,r*.05,x,y,r*1.05);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.25,'rgba(255,255,255,.08)');g.addColorStop(.7,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.42)');
 ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();}
function table(cv,felt,landscape){const ctx=cv.getContext('2d');const W=cv.width,H=cv.height;const s=W/(landscape?700:358);
 const rail=24*s,R=18*s;
 ctx.fillStyle='#2B1D14';rr(ctx,0,0,W,H,R);ctx.fill();
 const wg=ctx.createLinearGradient(0,0,0,H);wg.addColorStop(0,'#5A3B26');wg.addColorStop(1,'#3E281A');ctx.fillStyle=wg;rr(ctx,3*s,3*s,W-6*s,H-6*s,R-3*s);ctx.fill();
 ctx.fillStyle='#173F35';rr(ctx,rail-6*s,rail-6*s,W-2*rail+12*s,H-2*rail+12*s,8*s);ctx.fill();
 const fg=ctx.createRadialGradient(W/2,H/2,10,W/2,H/2,Math.max(W,H)*.65);fg.addColorStop(0,shade(felt,18));fg.addColorStop(1,shade(felt,-14));
 ctx.fillStyle=fg;ctx.fillRect(rail,rail,W-2*rail,H-2*rail);
 const pk=landscape?[[rail,rail],[W/2,rail-4*s],[W-rail,rail],[rail,H-rail],[W/2,H-rail+4*s],[W-rail,H-rail]]:[[rail,rail],[W-rail,rail],[rail-4*s,H/2],[W-rail+4*s,H/2],[rail,H-rail],[W-rail,H-rail]];
 for(const [x,y] of pk){ctx.fillStyle='#0d0b09';ctx.beginPath();ctx.arc(x,y,13*s,0,7);ctx.fill();}
 ctx.fillStyle='rgba(255,255,255,.55)';for(let i=1;i<4;i++){const t=i/4;if(landscape){dia(ctx,rail+(W-2*rail)*t,rail/2,s);dia(ctx,rail+(W-2*rail)*t,H-rail/2,s);}else{dia(ctx,rail/2,rail+(H-2*rail)*t,s);dia(ctx,W-rail/2,rail+(H-2*rail)*t,s);}}
 return {ctx,s,rail};}
function dia(ctx,x,y,s){ctx.beginPath();ctx.arc(x,y,2.2*s,0,7);ctx.fill();}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function shade(h,a){const n=parseInt(h.slice(1),16);const f=c=>Math.max(0,Math.min(255,c+a));return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';}
function shadow(ctx,x,y,r){ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(x+r*.35,y+r*.45,r*.95,r*.8,0,0,7);ctx.fill();}
function cue(ctx,x,y,ang,s,pull){const L=330*s;ctx.save();ctx.translate(x,y);ctx.rotate(ang);
 ctx.strokeStyle='rgba(255,255,255,.55)';ctx.setLineDash([6*s,6*s]);ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(-12*s,0);ctx.lineTo(-160*s,0);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.6*s;ctx.beginPath();ctx.arc(-170*s,0,9*s,0,7);ctx.stroke();
 const g=ctx.createLinearGradient(0,-5*s,0,5*s);g.addColorStop(0,'#F2DDB0');g.addColorStop(.5,'#D9B37A');g.addColorStop(1,'#8E6A3C');
 ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect((14+pull)*s,2*s,L,9*s);
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo((12+pull)*s,-2.6*s);ctx.lineTo((12+pull)*s+L,-5.5*s);ctx.lineTo((12+pull)*s+L,5.5*s);ctx.lineTo((12+pull)*s,2.6*s);ctx.fill();
 ctx.fillStyle='#2A2A2A';ctx.fillRect((12+pull)*s+L*.62,-4.6*s,L*.38,9.2*s);ctx.fillStyle='#EDEDED';ctx.fillRect((12+pull)*s,-2.6*s,4*s,5.2*s);ctx.restore();}
`;

function nameplate(p, { align = 'left', tag, you } = {}) {
  const dir = align === 'left' ? 'row' : 'row-reverse';
  return `<div style="display:flex;flex-direction:${dir};align-items:center;gap:10px;min-width:0;flex:1">
   ${avatar(p, 42)}<div style="min-width:0;text-align:${align}"><div class="t-body" style="font-size:16px">${you ? 'You' : p.name}</div>
   <div class="t-cap num">${p.rating}${tag ? ' · ' + tag : ''}</div></div></div>`;
}
const groupRow = (nums, potted, r = 9) => `<div style="display:flex;gap:4px">${nums.map((n) => `<canvas class="mini" data-n="${n}" data-p="${potted.includes(n) ? 1 : 0}" width="${r * 4}" height="${r * 4}" style="width:${r * 2}px;height:${r * 2}px"></canvas>`).join('')}</div>`;
const miniScript = `for(const c of document.querySelectorAll('canvas.mini')){const x=c.getContext('2d');const r=c.width/2;
 if(c.dataset.p==='1'){x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.arc(r,r,r*.92,0,7);x.fill();}else ball(x,r,r,r*.92,+c.dataset.n);}`;

export function gamePhone(d, dir, theme = 'dark') {
  const body = `
  <div style="display:flex;align-items:center;padding:4px 16px 0;gap:8px">
    ${nameplate(PEOPLE.me, { you: true })}
    <div style="text-align:center;flex:none"><div class="t-cap">Game 2 of 3</div>
     <div class="num" style="font-weight:900;font-size:22px;line-height:26px">1 – 0</div></div>
    ${nameplate(PEOPLE.sam, { align: 'right' })}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px 0">
    ${groupRow([9, 10, 11, 12, 13, 14, 15], [10, 13, 14])}${groupRow([1, 2, 3, 4, 5, 6, 7], [2])}</div>
  <div style="margin:10px 16px 0;height:6px;border-radius:3px;background:var(--surface2)"><div style="width:68%;height:100%;border-radius:3px;background:var(--accent)"></div></div>
  <div style="display:flex;justify-content:center;margin-top:8px"><span class="chip num" style="height:28px;font-size:13px">Rated · Win <span style="color:var(--win)">+8</span> · Lose <span style="color:var(--loss)">−8</span></span></div>
  <canvas id="t" width="716" height="1120" style="width:358px;height:560px;margin:12px 16px 0;display:block"></canvas>
  <div style="position:absolute;left:16px;right:16px;bottom:30px;display:flex;align-items:center;justify-content:space-between">
    <div style="color:var(--text2);width:48px;height:48px;display:grid;place-items:center" class="panel">${icon('more', 24)}</div>
    <div class="t-label">Your shot · drag to aim</div>
    <canvas id="spin" width="96" height="96" style="width:48px;height:48px"></canvas></div>
  <script>${BALLS}
  const {ctx,s}=table(document.getElementById('t'),'${d.felt}',false);
  const B=[[0,180,770],[9,250,300],[11,120,240],[12,300,520],[15,150,600],[1,380,330],[3,520,240],[4,560,640],[5,470,840],[6,240,930],[7,560,950],[8,370,470]];
  for(const [n,x,y] of B)shadow(ctx,x,y,22);for(const [n,x,y] of B)ball(ctx,x,y,22,n);
  cue(ctx,180,770,Math.atan2(770-470,180-370),2,10);
  const sp=document.getElementById('spin').getContext('2d');ball(sp,48,48,44,0);sp.fillStyle='#E0413A';sp.beginPath();sp.arc(48,32,8,0,7);sp.fill();
  ${miniScript}</script>`;
  return phone(d, theme, body, {});
}

function history(dir) {
  const rows = [['pool', 'Cue Ball', PEOPLE.sam, 'W', '+8', '2 – 0'], ['tubes', 'Polypotions', PEOPLE.kira, 'W', '+6', '2 – 1'], ['gem', 'Gemstone', PEOPLE.ollie, 'L', '−7', '1 – 2']];
  return `<div class="sec"><span class="t-heading">Match history</span><a>View all</a></div>
  <div class="panel" style="padding:0 16px">${rows.map(([a, g, p, r, c, sc], i) => `<div style="display:flex;align-items:center;gap:14px;height:56px;${i ? 'border-top:1px solid var(--line)' : ''}">
   <img src="${art(dir, a)}" width="36" height="36" style="object-fit:cover"><span class="t-body" style="width:130px;font-size:16px">${g}</span>
   ${avatar(p, 30)}<span class="t-label" style="flex:1">${p.name} <span class="num t-cap">(${p.rating})</span></span>
   <span class="num t-label" style="width:60px">${sc}</span>
   <span class="num" style="width:44px;text-align:right;font-weight:800;color:${r === 'W' ? 'var(--win)' : 'var(--loss)'}">${c}</span>
   <span class="num" style="width:28px;height:28px;border-radius:6px;display:grid;place-items:center;font-weight:800;font-size:14px;background:${r === 'W' ? 'rgba(87,199,111,.18)' : 'rgba(239,91,83,.16)'};color:${r === 'W' ? 'var(--win)' : 'var(--loss)'}">${r}</span></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- desktop
const RAIL = [['home', 'Home', 'joules'], ['play', 'Play', 'rated'], ['practice', 'Games', 'puzzles'], ['daily', 'Daily', 'daily'], ['arena', 'Tournaments', 'trophy'], ['shop', 'Shop', 'coins'], ['friends', 'Friends', 'rooms']];
function rail(d, dir, current, slim) {
  if (slim) {
    return `<div style="width:76px;flex:none;background:var(--raised);display:flex;flex-direction:column;align-items:center;padding:20px 0;gap:18px">
     ${wordmark(true)}${RAIL.map(([k, , a]) => `<div style="width:52px;height:52px;border-radius:var(--r-md);display:grid;place-items:center;${k === current ? 'background:var(--surface2)' : ''}"><img src="${art(dir, a)}" width="36" height="36"></div>`).join('')}</div>`;
  }
  return `<div style="width:240px;flex:none;background:var(--raised);padding:22px 14px;display:flex;flex-direction:column;gap:4px">
   <div style="padding:0 8px 18px">${wordmark()}</div>
   <div class="btn btn-primary btn-md" style="margin:0 4px 16px">Play</div>
   ${RAIL.map(([k, l, a]) => `<div style="height:48px;display:flex;align-items:center;gap:14px;padding:0 10px;border-radius:var(--r-md);font-weight:800;font-size:17px;${k === current ? 'background:var(--surface2)' : 'color:var(--text2)'}">
     <img src="${art(dir, a)}" width="32" height="32">${l}</div>`).join('')}
   <span style="flex:1"></span>
   <div style="height:48px;display:flex;align-items:center;gap:12px;padding:0 10px;font-weight:800;font-size:17px">${avatar(PEOPLE.me, 32)}Nova</div>
   <div style="height:44px;display:flex;align-items:center;gap:14px;padding:0 12px;color:var(--text3);font-weight:700;font-size:15px">${icon('settings', 22)}Settings</div></div>`;
}
const wordmark = (slim) => slim
  ? `<svg width="30" height="40" viewBox="0 0 10 16"><path d="M6 0 0 9h4l-1 7 7-10H6l1-6z" fill="var(--gold)"/></svg>`
  : `<div style="display:flex;align-items:center;gap:6px;font-weight:900;font-stretch:118%;font-size:26px;letter-spacing:.02em">JOULZ<svg width="16" height="26" viewBox="0 0 10 16"><path d="M6 0 0 9h4l-1 7 7-10H6l1-6z" fill="var(--gold)"/></svg></div>`;

function desktop(d, theme, inner) {
  return `<!doctype html><meta charset="utf-8"><style>${css(d, theme)}</style>
<div id="frame" style="width:1440px;height:900px;background:var(--bg);display:flex;overflow:hidden">${inner}</div>`;
}

export function homeDesktop(d, dir, theme = 'dark') {
  const main = `<div style="flex:1;padding:28px 32px;display:flex;gap:28px;overflow:hidden">
   <div style="flex:1;display:flex;flex-direction:column;gap:28px;min-width:0">
     <div style="display:flex;align-items:center;gap:14px">${avatar(PEOPLE.me, 44)}<div><div class="t-title">Good evening, Nova</div><div class="t-cap">4-day streak · Puzzles 1,530</div></div>
       <span style="flex:1"></span><span class="chip num" style="height:40px;font-size:17px"><img src="${art(dir, 'coins')}" width="30" height="30" style="margin-left:-6px">1,250</span></div>
     ${heroCard(d, dir, 540, 210)}
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px"><div>${recommended(d, dir)}</div><div>${recent(dir, 4, 76)}</div></div>
     <div>${ratingTiles(dir, 4, 180)}</div>
     <div>${history(dir)}</div>
   </div>
   <div style="width:340px;flex:none;display:flex;flex-direction:column;gap:24px">${quest(dir)}<div>${friendsRow(2, 162)}</div></div></div>`;
  return desktop(d, theme, rail(d, dir, 'home') + main);
}

export function playDesktop(d, dir, theme = 'dark') {
  const main = `<div style="flex:1;display:flex;gap:32px;padding:32px;overflow:hidden">
   <div class="panel" style="flex:1;position:relative;overflow:hidden;background:radial-gradient(90% 80% at 50% 45%,var(--surface2),var(--surface))">
     <img src="${art(dir, 'hero')}" style="position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:820px">
     <div style="position:absolute;left:32px;top:28px" class="t-display">Play</div></div>
   <div style="width:400px;flex:none;padding-top:12px">${playPanel(d, dir)}</div></div>`;
  return desktop(d, theme, rail(d, dir, 'play') + main);
}

export function gameDesktop(d, dir, theme = 'dark') {
  const main = `<div style="flex:1;display:flex;gap:28px;padding:28px 32px;overflow:hidden">
   <div style="flex:1;display:flex;flex-direction:column;min-width:0">
     <div style="display:flex;align-items:center;gap:16px">
       ${nameplate(PEOPLE.me, { you: true, tag: 'Stripes' })}
       <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="t-cap">Game 2 of 3 · Rated</div>
        <span class="chip num" style="height:30px;font-size:15px">Win <span style="color:var(--win)">+8</span> · Lose <span style="color:var(--loss)">−8</span></span></div>
       ${nameplate(PEOPLE.sam, { align: 'right', tag: 'Solids' })}</div>
     <div style="position:relative;margin-top:18px">
      <canvas id="t" width="1400" height="760" style="width:700px;height:380px;display:block;margin:0 auto;width:100%;height:auto"></canvas>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
        <div style="font-size:64px;line-height:70px;font-weight:900;font-stretch:var(--wd);color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.35)">You win</div>
        <div class="chip num" style="margin-top:12px;height:40px;font-size:18px;background:rgba(20,18,16,.78)">Game 2 · 2 – 0 · Match won</div></div>
     </div>
     <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">
      ${groupRow([9, 10, 11, 12, 13, 14, 15], [9, 10, 11, 12, 13, 14, 15], 11)}${groupRow([1, 2, 3, 4, 5, 6, 7], [2, 5], 11)}</div>
     <span style="flex:1"></span>
     <div class="panel" style="align-self:flex-start;display:flex;align-items:center;gap:12px;padding:10px 16px 10px 10px;border-radius:var(--r-md)">
      <img src="${art(dir, 'quest')}" width="40" height="40"><div><div class="t-body" style="font-size:15px">Challenge complete</div><div class="t-cap">Clear the table in 4 visits</div></div>
      <span class="joules num" style="margin-left:14px">${bolt(14)}100</span></div>
   </div>
   <div class="panel" style="width:360px;flex:none;padding:20px;display:flex;flex-direction:column">
     <div class="t-heading">Rated match</div><div class="t-cap">Best of 3 · Cue Ball, Minefield, Blockzone</div>
     <div style="margin-top:18px;display:flex;flex-direction:column">
      ${[[PEOPLE.me, 'You', ['W', 'W', '–'], '1,482', '+8'], [PEOPLE.sam, 'Sam_Volt', ['L', 'L', '–'], '1,503', '−8']].map(([p, n, g, r, c]) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)">
        ${avatar(p, 40)}<div style="flex:1"><div class="t-body" style="font-size:16px">${n}</div><div class="t-cap num">${r} <span style="color:${c[0] === '+' ? 'var(--win)' : 'var(--loss)'};font-weight:800">${c}</span></div></div>
        ${g.map((x) => `<span class="num" style="width:28px;height:28px;border-radius:6px;display:grid;place-items:center;font-weight:800;font-size:14px;background:${x === 'W' ? 'rgba(87,199,111,.18)' : x === 'L' ? 'rgba(239,91,83,.16)' : 'var(--surface2)'};color:${x === 'W' ? 'var(--win)' : x === 'L' ? 'var(--loss)' : 'var(--text3)'}">${x}</span>`).join('')}</div>`).join('')}
     </div>
     <div style="margin-top:8px;padding:14px;border-radius:var(--r-md);background:var(--surface2);display:flex;align-items:center;gap:12px">
      <img src="${art(dir, 'joules')}" width="40" height="40"><div><div class="t-body num" style="font-size:16px">Joulz Rating 1,490</div><div class="t-cap">Up 8 from 1,482</div></div></div>
     <span style="flex:1"></span>
     <div class="btn btn-primary btn-lg">Next match</div>
     <div style="display:flex;gap:12px;margin-top:16px"><div class="btn btn-secondary btn-md" style="flex:1">Rematch</div><div class="btn btn-secondary btn-md" style="flex:1">Review</div></div>
   </div></div>
  <script>${BALLS}
  const {ctx}=table(document.getElementById('t'),'${d.felt}',true);
  const B=[[0,620,410],[1,980,300],[3,1150,520],[4,410,250],[6,860,600],[7,300,560],[8,1210,200]];
  for(const [n,x,y] of B)shadow(ctx,x,y,24);for(const [n,x,y] of B)ball(ctx,x,y,24,n);
  ${miniScript}</script>`;
  return desktop(d, theme, rail(d, dir, 'play', true) + main);
}

// ---------------------------------------------------------------- palette and type sheet
export function sheet(d, dir) {
  const sw = (theme) => {
    const c = d[theme];
    const rows = [['bg', 'Background'], ['raised', 'Raised (bars)'], ['surface', 'Surface (panels)'], ['surface2', 'Surface 2 (buttons)'], ['line', 'Line'], ['text', 'Text'], ['text2', 'Text 2'], ['text3', 'Text 3'], ['accent', 'Accent (primary)'], ['ledge', 'Accent ledge']];
    return `<div style="flex:1;background:${c.bg};border-radius:12px;padding:14px;color:${c.text}">
     <div style="font-weight:800;font-size:15px;margin-bottom:10px">${theme === 'dark' ? 'Dark (leads)' : 'Light'}</div>
     ${rows.map(([k, l]) => `<div style="display:flex;align-items:center;gap:10px;height:30px"><span style="width:44px;height:22px;border-radius:5px;background:${c[k]};box-shadow:inset 0 0 0 1px rgba(127,127,127,.35)"></span>
       <span style="flex:1;font-size:13px;font-weight:600">${l}</span><code style="font-size:12px;opacity:.85">${c[k]}</code></div>`).join('')}
     <div class="cr" data-theme="${theme}" style="margin-top:8px;font-size:12px;line-height:17px;font-weight:600"></div></div>`;
  };
  const icons = ['joules', 'rated', 'arena', 'rooms', 'practice', 'daily', 'puzzles', 'arcade', 'trophy', 'quest', 'coins', 'gem'];
  const btnStates = (theme) => `<div style="display:flex;gap:10px;align-items:flex-start;margin-top:10px">
    ${['Default', 'Pressed', 'Disabled'].map((s) => `<div style="flex:1;text-align:center"><div class="btn btn-primary btn-md" style="${s === 'Pressed' ? 'transform:translateY(var(--lh));box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 0 0 var(--ledge)' : s === 'Disabled' ? 'background:var(--surface2);color:var(--text3);box-shadow:0 var(--lh) 0 var(--ledge2)' : ''}">Play</div><div class="t-cap" style="margin-top:12px">${s}</div></div>`).join('')}
    <div style="flex:1;text-align:center"><div class="btn btn-secondary btn-md">Rooms</div><div class="t-cap" style="margin-top:12px">Secondary</div></div></div>`;
  return `<!doctype html><meta charset="utf-8"><style>${css(d, 'dark')}</style>
<div id="frame" style="width:780px;background:var(--bg);padding:28px">
 <div style="display:flex;align-items:baseline;gap:12px"><span class="t-display">${d.letter} · ${d.name}</span><span class="t-label">${d.styleName} art · Archivo ${d.type.display}% width</span></div>
 <div class="t-label" style="margin-top:8px;max-width:700px">${d.pitch}</div>
 <div style="display:flex;gap:14px;margin-top:20px">${sw('dark')}${sw('light')}</div>
 <div style="display:flex;gap:24px;margin-top:22px">
  <div style="flex:1">
   <div class="t-cap" style="margin-bottom:8px">TYPE (Archivo, one family)</div>
   ${TYPE_SCALE.map(([n, s, u]) => `<div style="display:flex;align-items:baseline;gap:12px;padding:3px 0"><span style="font-size:${s}px;line-height:1.2;font-weight:${s >= 24 ? 'var(--dw)' : s >= 20 ? 800 : s >= 17 ? 700 : 600};font-stretch:${s >= 20 ? 'var(--wt)' : '100%'}">${n} ${s}</span><span class="t-cap">${u}</span></div>`).join('')}
  </div>
  <div style="width:300px">
   <div class="t-cap" style="margin-bottom:8px">SHAPE</div>
   <div class="t-label">Radii ${d.radius.sm} / ${d.radius.md} / ${d.radius.lg} · buttons ${d.radius.btn === 999 ? 'pill' : d.radius.btn + ' px'}</div>
   <div class="t-label">Ledge ${d.ledgeH} px under every button</div>
   <div class="t-label">Spacing ${SPACING.join(' · ')}</div>
   <div style="display:flex;gap:8px;margin-top:10px">${[d.radius.sm, d.radius.md, d.radius.lg].map((r) => `<span style="width:56px;height:56px;border-radius:${r}px;background:var(--surface)"></span>`).join('')}</div>
  </div></div>
 <div class="t-cap" style="margin:22px 0 0">BUTTON STATES</div>${btnStates()}
 <div class="t-cap" style="margin:26px 0 8px">ART KIT · ${d.styleName.toUpperCase()} · rendered 3D, one key light top left</div>
 <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">${icons.map((n) => `<div style="background:var(--surface);border-radius:var(--r-md);padding:8px;text-align:center"><img src="${art(dir, n)}" width="84" height="84"><div class="t-cap">${n}</div></div>`).join('')}</div>
</div>
<script>
const L=h=>{const n=parseInt(h.slice(1),16);return [n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)};
const CR=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const D=${JSON.stringify({ dark: d.dark, light: d.light })};
window.__contrast={};
for(const el of document.querySelectorAll('.cr')){const c=D[el.dataset.theme];
 const pairs=[['text','surface'],['text2','surface'],['text3','surface'],['text3','bg'],['text2','surface2'],['onAccent','accent']];
 const out=pairs.map(([f,b])=>{const r=CR(c[f],c[b]);window.__contrast[el.dataset.theme+':'+f+'/'+b]=r;return f+' on '+b+' '+r.toFixed(1)+':1'+(r<4.5?' ✗':'')});
 el.innerHTML='Contrast: '+out.join(' · ');}
</script>`;
}
