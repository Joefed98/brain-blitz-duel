// Round 2: the chosen direction's tokens and shared pieces (A · Forge's layout, type, radii and buttons; Joulz's own
// black, navy and champagne gold; B · Volt's gloss art). A design sketch for docs/design/style-guide, not app code.
import fs from 'node:fs';
import path from 'node:path';

export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
export const F = (p) => 'file://' + path.join(REPO, p);

export const THEMES = {
  dark: {
    bg: '#06080F', raised: '#0B0F1C', surface: '#0F1424', surface2: '#1E2640', surface3: '#28335A', line: '#1E2640', ledge2: '#03050A',
    text: '#EEF2FF', text2: '#B5C6DD', text3: '#8F9BBF', gold: '#E2C07A', goldInk: '#E2C07A', goldLedge: '#A8843E', onGold: '#06080F',
    live: '#22E4FF', win: '#16C35B', loss: '#FF5A6E', joules: '#C6FF3D', scrim: 'rgba(3,4,8,.72)',
  },
  light: {
    bg: '#F3F4F8', raised: '#FFFFFF', surface: '#FFFFFF', surface2: '#E4E7F0', surface3: '#D6DBE8', line: '#DCE0EA', ledge2: '#BFC6D6',
    text: '#0B1020', text2: '#39425F', text3: '#59617F', gold: '#E2C07A', goldInk: '#7A5C1C', goldLedge: '#A8843E', onGold: '#06080F',
    live: '#006A7A', win: '#0B6F33', loss: '#B81C33', joules: '#456B00', scrim: 'rgba(11,16,32,.45)',
  },
};
export const GOLD_METAL = 'linear-gradient(165deg,#FBEDC4 0%,#E6C67E 34%,#D2AC5E 68%,#EED79C 100%)';
export const CATEGORY = { word: '#4D8CFF', number: '#3DDC84', speed: '#FF8A3D', attention: '#FF6BD6', pattern: '#B26BFF', logic: '#2ED3B7', arcade: '#FF4D4D' };
export const GROUP = { retro: '#36E2F5', sports: '#4CC24A', cards: '#FF5C93', action: '#FF4D4D', strategy: '#8E80FF' };
export const RARITY = { epic: '#E2C07A', elite: '#A99BFF', legendary: '#AEEAF7' };
export const TYPE = [
  ['display', 32, 38, 800, 'Win moment, page heroes'], ['title', 24, 30, 800, 'Screen titles'], ['heading', 20, 26, 800, 'Section and card titles'],
  ['body', 17, 22, 700, 'Buttons, row titles'], ['label', 15, 20, 600, 'Secondary lines'], ['caption', 13, 18, 600, 'Meta and counts (never smaller)'],
];
export const SPACE = [4, 8, 12, 16, 24, 32, 40];
export const RADIUS = { sm: 8, md: 12, lg: 16, btn: 12, pill: 999 };
export const MOTION = [
  ['press', '70 ms', 'ease-out', 'Button sinks onto its ledge (translateY 4 px, ledge to 0)'],
  ['release', '160 ms', 'spring (stiffness 500, damping 30)', 'Button rises back; the action fires on release'],
  ['select', '120 ms', 'ease-out', 'Chips, segmented control, tab change'],
  ['sheet in / out', '280 / 200 ms', 'cubic-bezier(.2,.9,.25,1) / ease-in', 'Bottom sheet slides up with the scrim fading to 72 %'],
  ['page', '220 ms', 'cubic-bezier(.2,.9,.25,1)', 'Push: new page slides 24 px and fades in'],
  ['reward land', '420 ms', 'drop 16 px, squash 1.08 → 1', 'Coins, Joules, stars land where they are counted'],
  ['count up', '600 ms', 'ease-out', 'Scores and ratings count to their value'],
  ['reveal stagger', '60 ms a row', 'ease-out', 'Results rows arrive in order, never longer than 900 ms in all'],
  ['win moment', '900 ms', 'scale 0.9 → 1, fade', 'Over the frozen play area; never covers the score'],
  ['toast', '240 in · 3 s · 200 out', 'ease-out', 'Quiet award toast, bottom left, never over controls'],
  ['physical action', '≤ 900 ms', 'per game', 'The thing happens: a flask lifts, tilts, pours, settles; the next input is accepted at once'],
  ['reduce motion', '120 ms', 'crossfade', 'Every movement becomes a short fade to the final state'],
];

const ICONS = (() => {
  const src = fs.readFileSync(path.join(REPO, 'src/design/icons/icons.data.ts'), 'utf8').split('ICON_LABELS')[0];
  const out = {};
  for (const m of src.matchAll(/^\s+"([a-z-]+)": "(.*)",?$/gm)) out[m[1]] = m[2];
  return out;
})();
export const icon = (n, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none">${ICONS[n] ?? ''}</svg>`;
export const art = (n) => F(`docs/design/style-guide/art/${n}.png`);
export const key = (n) => F(`docs/design/style-guide/art/key-${n}.png`);
export const AV = (n) => F(`docs/art/avatars/svg/${n}.svg`);
export const bolt = (s = 14) => `<svg width="${Math.round(s * 0.62)}" height="${s}" viewBox="0 0 10 16" style="flex:none"><path d="M6 0 0 9h4l-1 7 7-10H6l1-6z" fill="currentColor"/></svg>`;
export const PEOPLE = {
  me: { name: 'Nova', av: 'captain-joulz', col: '#E2C07A', rating: '1,482' },
  sam: { name: 'Sam_Volt', av: 'apex', col: '#4FA3FF', rating: '1,503' },
  kira: { name: 'KiraPlays', av: 'blockzone', col: '#FF6B8B', rating: '1,377' },
  ollie: { name: 'Ollie_K', av: 'breaker', col: '#7ED957', rating: '1,512' },
  mo: { name: 'MoFizz', av: 'blackout', col: '#C084FC', rating: '1,290' },
};
export const avatar = (p, s) => `<span class="av" style="width:${s}px;height:${s}px;background:${p.col};box-shadow:0 0 0 2px ${p.col}"><img src="${AV(p.av)}"></span>`;

export function css(theme = 'dark') {
  const c = THEMES[theme];
  return `
@font-face{font-family:Archivo;src:url(${F('public/fonts/archivo-var-latin.woff2')}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
:root{${Object.entries(c).map(([k, v]) => `--${k}:${v}`).join(';')};--metal:${GOLD_METAL};
--r-sm:${RADIUS.sm}px;--r-md:${RADIUS.md}px;--r-lg:${RADIUS.lg}px;--r-btn:${RADIUS.btn}px;--lh:4px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#000;font-family:Archivo,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
${TYPE.map(([n, s, l, w]) => `.t-${n}{font-size:${s}px;line-height:${l}px;font-weight:${w}}`).join('\n')}
.t-label{color:var(--text2)}.t-caption{color:var(--text3)}
.num{font-variant-numeric:tabular-nums}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;border-radius:var(--r-btn);font-weight:800;font-size:17px;white-space:nowrap;position:relative;color:var(--text)}
.btn-gold{background:var(--metal);color:var(--onGold);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 var(--lh) 0 var(--goldLedge),0 10px 16px rgba(0,0,0,.32)}
.btn-2{background:var(--surface2);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 var(--lh) 0 var(--ledge2)}
.btn-q{background:transparent;color:var(--text2)}
.btn-lg{height:60px;font-size:20px}.btn-md{height:48px}.btn-sm{height:36px;font-size:15px;padding:0 16px}
.pressed{transform:translateY(var(--lh))!important}
.btn-gold.pressed{box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 0 var(--goldLedge)}
.btn-2.pressed{box-shadow:0 0 0 var(--ledge2);background:var(--surface3)}
.focus{outline:3px solid var(--live);outline-offset:3px}
.disabled{background:var(--surface2)!important;color:var(--text3)!important;box-shadow:none!important}
.btn-q.disabled{background:transparent!important}
.panel{background:var(--surface);border-radius:var(--r-lg)}
.sec{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 12px}
.sec a{font-size:15px;font-weight:700;color:var(--text2)}
.av{border-radius:var(--r-sm);overflow:hidden;flex:none;display:block}
.av img{width:100%;height:100%;display:block}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:var(--surface);font-weight:800;font-size:15px;white-space:nowrap}
.joules{color:var(--joules);display:inline-flex;align-items:center;gap:3px;font-weight:800}
.tag{display:inline-block;font-size:13px;font-weight:800;padding:2px 8px;border-radius:6px}
.row{display:flex;align-items:center;gap:14px;min-height:60px;padding:0 16px}
.row+.row{border-top:1px solid var(--line)}
.seg{display:flex;background:var(--raised);border-radius:var(--r-md);padding:4px;gap:4px}
.seg span{flex:1;height:36px;display:grid;place-items:center;border-radius:9px;font-weight:800;font-size:15px;color:var(--text3)}
.seg span.on{background:var(--surface2);color:var(--text)}
.bar{height:8px;border-radius:4px;background:var(--surface2);overflow:hidden}.bar i{display:block;height:100%;border-radius:4px;background:var(--gold)}
.chev{color:var(--text3)}
`;
}

// ---------------------------------------------------------------- chrome
export const statusBar = () => `<div style="height:47px;position:relative;z-index:3;background:var(--bg);display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 34px;font-weight:700;font-size:16px">
 <span class="num">9:41</span><span style="display:flex;gap:6px;align-items:center">
 <svg width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="10" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
 <svg width="25" height="12"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor"/><rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5"/></svg></span></div>`;
export const homeBar = () => `<div style="position:absolute;left:128px;bottom:8px;width:134px;height:5px;border-radius:3px;background:var(--text);opacity:.85;z-index:9"></div>`;

export const TABS = [['home', 'Home'], ['games', 'Games'], ['shop', 'Shop'], ['profile', 'Profile'], ['more', 'More']];
export function tabBar(current) {
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:83px;background:var(--raised);display:flex;padding:7px 4px 0;z-index:5">${TABS.map(([k, l]) => {
    const on = k === current;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
      <img src="${art(k)}" width="32" height="32" style="${on ? '' : 'filter:grayscale(1) brightness(.85);opacity:.6'}">
      <span style="font-size:12px;line-height:15px;font-weight:${on ? 800 : 700};color:${on ? 'var(--text)' : 'var(--text3)'}">${l}</span></div>`;
  }).join('')}</div>`;
}
export const playBar = () => `<div style="position:absolute;left:0;right:0;bottom:83px;padding:14px 16px 14px;background:linear-gradient(to bottom,transparent,var(--bg) 34%);z-index:4"><div class="btn btn-gold btn-lg">Play</div></div>`;
export const topBar = (title, { back, right = '' } = {}) => `<div style="height:52px;position:relative;z-index:3;background:var(--bg);display:flex;align-items:center;padding:0 12px;gap:4px">
  <div style="width:44px;height:44px;display:grid;place-items:center;color:var(--text2)">${back ? icon('back', 24) : ''}</div>
  <div class="t-heading" style="flex:1;text-align:center">${title}</div><div style="width:44px;height:44px;display:grid;place-items:center;color:var(--text2)">${right}</div></div>`;

export function phone(theme, body, { tab, play, overlay = '' } = {}) {
  return `<!doctype html><meta charset="utf-8"><style>${css(theme)}</style>
<div id="frame" style="width:390px;height:844px;background:var(--bg);position:relative;overflow:hidden">
${statusBar()}${body}${play ? playBar() : ''}${tab ? tabBar(tab) : ''}${overlay}${homeBar()}</div>`;
}

// ---------------------------------------------------------------- desktop chrome
const RAIL_MAIN = [['home', 'Home'], ['games', 'Games'], ['shop', 'Shop'], ['profile', 'Profile']];
const RAIL_MORE = [['friends', 'Friends'], ['leaderboards', 'Leaderboards'], ['arena', 'Arena and tournaments'], ['challenges', 'Challenges'], ['plus', 'Joulz Plus']];
export const wordmark = () => `<div style="display:flex;align-items:center;gap:6px;font-weight:900;font-stretch:118%;font-size:26px;letter-spacing:.02em;text-transform:uppercase">Joulz<svg width="16" height="26" viewBox="0 0 10 16"><path d="M6 0 0 9h4l-1 7 7-10H6l1-6z" fill="var(--gold)"/></svg></div>`;
export function rail(current, slim) {
  if (slim) {
    return `<div style="width:76px;flex:none;background:var(--raised);display:flex;flex-direction:column;align-items:center;padding:22px 0;gap:14px">
     <svg width="22" height="34" viewBox="0 0 10 16" style="margin-bottom:8px"><path d="M6 0 0 9h4l-1 7 7-10H6l1-6z" fill="var(--gold)"/></svg>
     ${[...RAIL_MAIN, ...RAIL_MORE].map(([k]) => `<div style="width:52px;height:52px;border-radius:var(--r-md);display:grid;place-items:center;${k === current ? 'background:var(--surface2)' : ''}"><img src="${art(k)}" width="34" height="34"></div>`).join('')}</div>`;
  }
  const item = ([k, l]) => `<div style="height:46px;display:flex;align-items:center;gap:12px;padding:0 10px;border-radius:var(--r-md);font-weight:800;font-size:16px;${k === current ? 'background:var(--surface2)' : 'color:var(--text2)'}"><img src="${art(k)}" width="30" height="30">${l}</div>`;
  return `<div style="width:248px;flex:none;background:var(--raised);padding:22px 14px;display:flex;flex-direction:column;gap:2px">
   <div style="padding:0 8px 18px">${wordmark()}</div>
   <div class="btn btn-gold btn-md" style="margin:0 4px 16px">Play</div>
   ${RAIL_MAIN.map(item).join('')}
   <div class="t-caption" style="padding:16px 10px 6px;font-weight:800">More</div>
   ${RAIL_MORE.map(item).join('')}
   <span style="flex:1"></span>
   ${[['settings', 'Settings'], ['support', 'Support']].map(item).join('')}</div>`;
}
export function desktop(theme, inner, { overlay = '' } = {}) {
  return `<!doctype html><meta charset="utf-8"><style>${css(theme)}</style>
<div id="frame" style="width:1440px;height:900px;background:var(--bg);display:flex;overflow:hidden;position:relative">${inner}${overlay}</div>`;
}
export const contrastScript = (pairs) => `<script>
const L=h=>{const n=parseInt(h.slice(1),16);return [n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)};
window.CR=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
window.__contrast={};for(const [t,f,b,fh,bh] of ${JSON.stringify(pairs)}){window.__contrast[t+': '+f+' on '+b]=CR(fh,bh);}
for(const el of document.querySelectorAll('[data-cr]')){const [f,b]=el.dataset.cr.split('|');el.textContent=CR(f,b).toFixed(1)+':1';}
</script>`;
