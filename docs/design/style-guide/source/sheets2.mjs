// The style guide's reference sheets: tokens, components, motion and the art kit (900 px wide PNGs).
import { css, THEMES, GOLD_METAL, TYPE, SPACE, RADIUS, MOTION, icon, art, key, avatar, bolt, PEOPLE, contrastScript, CATEGORY, GROUP, RARITY } from './kit2.mjs';
import { STARS, STAR, tile, challengeRow, FLASKS } from './screens2.mjs';
import { ICONS, KEYART } from './art2.mjs';

const sheet = (title, sub, body, script = '') => `<!doctype html><meta charset="utf-8"><style>${css('dark')}
h2{font-size:13px;line-height:18px;font-weight:800;color:var(--text3);margin:30px 0 12px;letter-spacing:.06em;text-transform:uppercase}
td,th{padding:6px 10px;text-align:left;font-size:14px;line-height:19px;vertical-align:middle}th{color:var(--text3);font-weight:800;font-size:13px}
tr+tr td{border-top:1px solid var(--line)} code{font-size:13px;color:var(--text2)}</style>
<div id="frame" style="width:900px;background:var(--bg);padding:32px">
 <div class="t-display">${title}</div><div class="t-label" style="margin-top:6px;max-width:780px">${sub}</div>${body}</div>${script}`;

// ---------------------------------------------------------------- tokens
const COLOUR_ROWS = [
  ['bg', 'Page background'], ['raised', 'Tab bar, rail, sheets'], ['surface', 'Panels, rows, tiles'], ['surface2', 'Secondary buttons, tracks'], ['surface3', 'Pressed and selected'],
  ['line', 'Hairlines between rows'], ['text', 'Text'], ['text2', 'Secondary text'], ['text3', 'Captions'], ['gold', 'Act, you, first place'], ['goldInk', 'Gold as text or icon'],
  ['goldLedge', 'Gold button ledge'], ['live', 'Live, focus ring'], ['win', 'Wins, +rating'], ['loss', 'Losses, −rating'], ['joules', 'Joules (with the bolt)'],
];
function tokens() {
  const pairs = [];
  const swatch = (t) => {
    const c = THEMES[t];
    const onWhat = (k) => (['text', 'text2', 'text3', 'goldInk', 'live', 'win', 'loss', 'joules'].includes(k) ? 'surface' : null);
    for (const f of ['text', 'text2', 'text3', 'goldInk', 'live', 'win', 'loss', 'joules']) for (const b of ['bg', 'surface', 'surface2']) pairs.push([t, f, b, c[f], c[b]]);
    pairs.push([t, 'onGold', 'gold metal (darkest stop)', c.onGold, '#D2AC5E']);
    return `<div style="flex:1;background:${c.bg};color:${c.text};border-radius:14px;padding:14px">
     <div style="font-weight:800;font-size:15px;margin-bottom:8px">${t === 'dark' ? 'Dark (leads)' : 'Light'}</div>
     ${COLOUR_ROWS.map(([k, l]) => `<div style="display:flex;align-items:center;gap:10px;height:28px"><span style="width:40px;height:20px;border-radius:5px;background:${c[k]};box-shadow:inset 0 0 0 1px rgba(127,127,127,.35)"></span>
      <span style="flex:1;font-size:13px;font-weight:600">${l}</span><code style="color:${c.text2}">${c[k]}</code>
      <span style="width:52px;text-align:right;font-size:12px;font-weight:700;color:${c.text2}" ${onWhat(k) ? `data-cr="${c[k]}|${c.surface}"` : ''}></span></div>`).join('')}</div>`;
  };
  const body = `
  <h2>Colour · Joulz black, navy and champagne gold</h2>
  <div style="display:flex;gap:14px">${swatch('dark')}${swatch('light')}</div>
  <div class="t-caption" style="margin-top:10px">The figure on the right is the colour’s contrast on that theme’s surface. Every text colour (text, text 2, captions, gold ink, live, win, loss, Joules) is at least 4.5 : 1 on the background, surface and surface 2 in both themes, and the button text is at least 4.5 : 1 on the gold metal’s darkest stop, all 50 pairs checked by the renderer.</div>
  <div style="display:flex;gap:14px;margin-top:16px;align-items:stretch">
   <div style="flex:1;height:64px;border-radius:12px;background:${GOLD_METAL};display:grid;place-items:center;color:#06080F;font-weight:800">Gold metal · buttons, medals, emblems only</div>
   <div style="width:260px;border-radius:12px;background:var(--surface);padding:10px 14px"><div class="t-caption" style="font-weight:800">Categories and groups (unchanged)</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${[...Object.values(CATEGORY), ...Object.values(GROUP)].map((h) => `<span style="width:20px;height:20px;border-radius:5px;background:${h}"></span>`).join('')}</div></div></div>
  <div class="t-caption" style="margin-top:8px">Changed from today’s tokens: <b>loss</b> text is <code>#FF5A6E</code> (today’s <code>#E5243F</code> is 4.2 : 1 on the surface), a new <b>surface 3</b> <code>#28335A</code> for pressed and selected, and the light theme is new.</div>

  <h2>Type · Archivo, one family, six sizes</h2>
  <table style="border-collapse:collapse;width:100%">${TYPE.map(([n, s, l, w, u]) => `<tr><td style="width:430px"><span style="font-size:${s}px;line-height:${l}px;font-weight:${w}">${n[0].toUpperCase() + n.slice(1)}</span></td><td><code>${s} / ${l} · ${w}</code></td><td class="t-caption">${u}</td></tr>`).join('')}</table>
  <div class="t-caption" style="margin-top:6px">Numbers are tabular. Sentence case everywhere; capitals only for the JOULZ wordmark and room codes.</div>

  <div style="display:flex;gap:28px">
   <div style="flex:1"><h2>Spacing</h2>${SPACE.map((s) => `<div style="display:flex;align-items:center;gap:12px;height:24px"><span style="width:${s * 4}px;height:12px;background:var(--gold);border-radius:3px"></span><code>${s}</code></div>`).join('')}
    <div class="t-caption" style="margin-top:8px">16 phone gutter · 24 between sections on a phone · 32 on a computer · 12 between cards.</div></div>
   <div style="flex:1"><h2>Radii</h2><div style="display:flex;gap:12px">${[['sm', RADIUS.sm, 'avatars, tags'], ['md', RADIUS.md, 'rows, mode buttons'], ['lg', RADIUS.lg, 'panels, tiles'], ['btn', RADIUS.btn, 'buttons']].map(([n, r, u]) => `<div style="text-align:center"><span style="display:block;width:64px;height:64px;border-radius:${r}px;background:var(--surface2)"></span><div class="t-caption" style="margin-top:6px">${n} ${r}</div><div class="t-caption" style="font-size:13px">${u}</div></div>`).join('')}</div>
    <div class="t-caption" style="margin-top:8px">Sheets 20 on their top corners.</div></div></div>

  <h2>Elevation · three levels, no glows</h2>
  <div style="display:flex;gap:16px;padding:14px;background:var(--bg)">
   <div class="panel" style="flex:1;height:96px;padding:14px"><div class="t-body">0 · Panel</div><div class="t-caption">Surface on the page. No shadow, no border.</div></div>
   <div style="flex:1"><div class="btn btn-2 btn-md">1 · Raised</div><div class="t-caption" style="margin-top:12px">Buttons: a 4 px solid ledge under the face, 1 px top highlight.</div></div>
   <div style="flex:1;height:96px;border-radius:16px;background:var(--raised);box-shadow:0 -8px 32px rgba(0,0,0,.5),0 16px 48px rgba(0,0,0,.6);padding:14px"><div class="t-body">2 · Overlay</div><div class="t-caption">Sheets, dialogs, toasts over a 72 % scrim.</div></div></div>`;
  return sheet('Tokens', 'Every value the screens use. The app’s current black, navy and champagne gold, laid out with chess.com’s chunky structure.', body, contrastScript(pairs));
}

// ---------------------------------------------------------------- components
function components() {
  const st = ['Default', 'Pressed', 'Focus', 'Disabled'];
  const cls = { Default: '', Pressed: 'pressed', Focus: 'focus', Disabled: 'disabled' };
  const btnRow = (name, base, label) => `<tr><td class="t-label" style="width:110px">${name}</td>${st.map((s) => `<td style="padding:14px 8px"><div class="btn ${base} btn-md ${cls[s]}">${label}</div></td>`).join('')}</tr>`;
  const body = `
  <h2>Buttons · one style, every state</h2>
  <table style="border-collapse:collapse;width:100%"><tr><th></th>${st.map((s) => `<th>${s}</th>`).join('')}</tr>
   ${btnRow('Gold (one a screen)', 'btn-gold', 'Find a match')}${btnRow('Secondary', 'btn-2', 'Rematch')}${btnRow('Quiet', 'btn-q', 'See all')}
   <tr><td class="t-label">Icon</td>${st.map((s) => `<td style="padding:14px 8px"><div class="btn btn-2 ${cls[s]}" style="width:52px;height:48px">${icon('challenge', 24)}</div></td>`).join('')}</tr></table>
  <div class="t-caption">Pressed: the face sinks 4 px onto its ledge (70 ms) and the action fires on release. Focus: a 3 px live ring 3 px outside. Disabled: no ledge, captions colour. Sizes: 60 (the one big action), 48, 36. Every target at least 44 × 44.</div>

  <div style="display:flex;gap:24px">
  <div style="flex:1"><h2>Mode button</h2>
   <div class="btn btn-2" style="height:64px;justify-content:flex-start;padding:0 16px;border-radius:var(--r-md);gap:14px"><img src="${art('arena')}" width="44" height="44"><span style="flex:1;text-align:left">Arena</span><span class="t-caption">Next at 20:00</span><span class="chev">${icon('chevron-right', 20)}</span></div>
   <h2>Segmented control</h2><div class="seg"><span class="on">In progress</span><span>New</span><span>Done</span></div>
   <h2>Chips</h2><div style="display:flex;gap:8px"><span class="chip" style="height:36px;background:var(--text);color:var(--bg)">All</span><span class="chip" style="height:36px"><span style="width:8px;height:8px;border-radius:50%;background:${CATEGORY.logic}"></span>Logic</span><span class="chip" style="height:36px"><span style="width:8px;height:8px;border-radius:50%;background:${CATEGORY.word}"></span>Word</span></div>
   <h2>Input</h2>
   <div style="height:48px;border-radius:12px;background:var(--bg);box-shadow:inset 0 2px 3px rgba(0,0,0,.55);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--text3)">${icon('search', 20)}Search games</div>
   <div style="height:48px;margin-top:10px;border-radius:12px;background:var(--bg);box-shadow:inset 0 2px 3px rgba(0,0,0,.55),0 0 0 2px var(--live);display:flex;align-items:center;padding:0 14px">Nova_<span style="color:var(--text3)">|</span></div>
   <div style="height:48px;margin-top:10px;border-radius:12px;background:var(--bg);box-shadow:inset 0 2px 3px rgba(0,0,0,.55),0 0 0 2px var(--loss);display:flex;align-items:center;padding:0 14px">Joulz</div><div class="t-caption" style="color:var(--loss);margin-top:6px">That name is taken.</div>
  </div>
  <div style="flex:1"><h2>List row (chess.com’s clean rows)</h2>
   <div class="panel"><div class="row">${avatar(PEOPLE.sam, 36)}<div style="flex:1"><div class="t-body" style="font-size:16px">Sam_Volt</div><div class="t-caption num">1,503 · Online</div></div><span class="chev">${icon('chevron-right', 20)}</span></div>
    <div class="row" style="background:var(--surface3)">${avatar(PEOPLE.kira, 36)}<div style="flex:1"><div class="t-body" style="font-size:16px">KiraPlays</div><div class="t-caption">Pressed</div></div><span class="chev">${icon('chevron-right', 20)}</span></div></div>
   <h2>Challenge row</h2><div class="panel" style="padding:0 16px">${challengeRow(['Finish with 40 s left', '28 s best', 28, 40, '100'])}</div>
   <h2>Game tile · stars bottom right</h2>${tile('tubes', 200, 148)}
   <h2>Progress, stars, Joules</h2><div style="display:flex;align-items:center;gap:16px"><div class="bar" style="flex:1"><i style="width:60%"></i></div>${STARS(2, 18)}<span class="joules">${bolt(14)}750</span></div>
  </div></div>

  <div style="display:flex;gap:24px">
   <div style="flex:1"><h2>Rating tile</h2><div class="panel" style="width:128px;height:128px;display:flex;flex-direction:column;align-items:center;justify-content:center"><img src="${art('puzzles')}" width="52" height="52"><div class="num" style="font-size:22px;font-weight:800">1,530</div><div class="t-caption" style="color:var(--text2)">Puzzles</div></div></div>
   <div style="flex:1"><h2>Award toast</h2><div class="panel" style="display:inline-flex;align-items:center;gap:12px;padding:10px 16px 10px 10px;border-radius:var(--r-md);box-shadow:0 16px 48px rgba(0,0,0,.6)"><img src="${art('challenges')}" width="40" height="40"><div><div class="t-body" style="font-size:15px">Challenge done</div><div class="t-caption">Pot 3 in one visit</div></div><span class="joules" style="margin-left:12px">${bolt(14)}100</span></div></div>
   <div style="flex:1"><h2>Sheet header</h2><div style="background:var(--raised);border-radius:20px 20px 0 0;padding:0 12px 10px"><div style="height:5px;width:40px;border-radius:3px;background:var(--surface3);margin:8px auto 0"></div><div style="display:flex;align-items:center;height:48px"><span style="color:var(--text2)">${icon('close', 24)}</span><span class="t-heading" style="flex:1;text-align:center;margin-right:24px">Choose a match</span></div></div></div></div>

  <h2>Tab bar · art-kit icons, the current tab in colour</h2>
  <div style="display:flex;background:var(--raised);border-radius:14px;padding:8px 4px">${[['home', 'Home'], ['games', 'Games'], ['shop', 'Shop'], ['profile', 'Profile'], ['more', 'More']].map(([k, l], i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px"><img src="${art(k)}" width="34" height="34" style="${i ? 'filter:grayscale(1) brightness(.85);opacity:.6' : ''}"><span style="font-size:12px;font-weight:${i ? 700 : 800};color:${i ? 'var(--text3)' : 'var(--text)'}">${l}</span></div>`).join('')}</div>
  <div class="t-caption" style="margin-top:8px">No Play tab: the full-width gold Play bar sits above the tabs on Home and Games. The current tab is never shown by colour alone: its label turns bold and white.</div>

  <h2>Nameplate (kept: NameplateStrip and PlayerCard)</h2>
  <div class="panel" style="display:flex;align-items:center;gap:12px;padding:12px 16px;width:420px">${avatar(PEOPLE.me, 42)}<div style="flex:1"><div class="t-body">Nova</div><div class="t-caption num">1,482 · Volt</div></div><span class="tag num" style="background:var(--surface2);color:var(--text2)">#0412</span></div>`;
  return sheet('Components', 'One component for each job. Never a card inside a card, never a one-off button, never helper text where a label will do.', body);
}

// ---------------------------------------------------------------- motion
function motion() {
  const pour = `<canvas id="pour" width="1640" height="400" style="width:820px;height:200px;background:var(--surface);border-radius:16px"></canvas>`;
  const press = [0, 1, 2].map((i) => `<div style="flex:1;text-align:center"><div class="btn btn-gold btn-md ${i === 1 ? 'pressed' : ''}" style="${i === 2 ? 'transform:translateY(-1px)' : ''}">Play</div><div class="t-caption" style="margin-top:12px">${['0 ms rest', '70 ms down', '230 ms back up · fires'][i]}</div></div>`).join('');
  const land = [0, 1, 2, 3].map((i) => `<div style="flex:1;height:120px;position:relative;background:var(--surface);border-radius:12px">
    <span class="chip num" style="position:absolute;right:10px;bottom:10px;${i === 3 ? 'box-shadow:0 0 0 2px var(--gold)' : ''}"><img src="${art('coins')}" width="22" height="22" style="margin-left:-6px">${['1,250', '1,250', '1,250', '1,350'][i]}</span>
    ${i < 3 ? `<img src="${art('coins')}" width="${[44, 40, 30][i]}" height="${[44, 40, 30][i]}" style="position:absolute;left:${[30, 90, 140][i]}px;top:${[10, 38, 70][i]}px;transform:scaleY(${[1, 1, 0.92][i]})">` : ''}
    <div class="t-caption" style="position:absolute;left:10px;bottom:10px">${['0 ms', '140 ms', '300 ms', '420 ms'][i]}</div></div>`).join('');
  const body = `
  <h2>Timings</h2>
  <table style="border-collapse:collapse;width:100%">${MOTION.map(([n, t, e, u]) => `<tr><td style="width:150px;font-weight:800">${n}</td><td style="width:150px"><code>${t}</code></td><td style="width:220px" class="t-caption">${e}</td><td class="t-label" style="font-size:14px">${u}</td></tr>`).join('')}</table>
  <h2>Show the action physically · Polypotions’ pour, 0.9 s</h2>${pour}
  <div class="t-caption" style="margin-top:8px">Lift 120 ms · tilt 160 ms · pour 300–500 ms by amount · settle 220 ms · return 180 ms. The next tap is taken at once (a queued pour starts as soon as the flask is back), so the effect never costs time and never hides a colour.</div>
  <h2>Buttons press</h2><div style="display:flex;gap:16px">${press}</div>
  <h2>Rewards land where they are counted</h2><div style="display:flex;gap:12px">${land}</div>
  <h2>Reduce motion</h2><div class="t-label">Every movement above becomes a 120 ms crossfade to its final state. Sounds and haptics stay. Nothing ends hidden.</div>
  <h2>Never</h2><div class="t-label">No looping decoration, no glows or neon, no shake on the page, no effect over the board while a game is running, no countdown pressure in the shop.</div>`;
  const script = `<script>${FLASKS}
  const ctx=document.getElementById('pour').getContext('2d');const P={o:'#FF8A3D',b:'#4D8CFF',g:'#3DDC84',p:'#FF6BD6'};const W=56,H=170;
  const frames=[[0,0,'Rest'],[0,-40,'Lift'],[-1.1,-46,'Tilt'],[-2.1,-50,'Pour'],[0,0,'Settle']];
  frames.forEach(([a,dy,l],i)=>{const ox=40+i*322;
   const tgt=i===4?[P.p,P.b,P.p,P.p]:(i===3?[P.p,P.b,P.p,P.p]:[P.p,P.b,P.p]);
   flask(ctx,ox+200,170,W,H,tgt,false);
   const src=i>=3?[P.g,P.o]:[P.g,P.o,P.p];
   if(i===4){flask(ctx,ox+70,170,W,H,src,false);}
   else{ctx.save();ctx.translate(ox+(i>=2?150:70),130+dy);ctx.rotate(a);flask(ctx,0,0,W,H,src,i>0);ctx.restore();}
   if(i===3){ctx.strokeStyle=P.p;ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(ox+170,96);ctx.quadraticCurveTo(ox+196,110,ox+200,190);ctx.stroke();}
   ctx.fillStyle='#B5C6DD';ctx.font='700 26px Archivo';ctx.fillText(l,ox+20,385);});
  </script>`;
  return sheet('Motion', 'Every player action looks like the physical thing happening; rewards land, buttons press, results reveal. Effects never cost time or hide information.', body, script);
}

// ---------------------------------------------------------------- art kit
function artkit() {
  const names = Object.keys(ICONS);
  const body = `
  <h2>The rules</h2>
  <div class="t-label" style="font-size:15px;line-height:22px">Every icon and piece of key art is a small 3D scene rendered in code (<code>docs/design/directions/source/art.html</code>, scenes in <code>art2.mjs</code>): soft rounded shapes, one gloss material (a broad diffuse, one tight white highlight, a soft rim), one key light from the top left, a soft contact shadow to the bottom right. Colours come from one list: the categories’ and groups’ hues, cream, navy, ink and a richer art gold (<code>#EDB43E</code>, so metal reads as gold under the gloss; the interface keeps champagne). The Joulz coin keeps its black bolt.</div>
  <h2>Icons · ${names.length}</h2>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">${names.map((n) => `<div style="background:var(--surface);border-radius:12px;padding:8px 4px;text-align:center"><img src="${art(n)}" width="80" height="80"><div class="t-caption" style="font-size:13px">${n}</div></div>`).join('')}</div>
  <h2>Key art · tiles crop it, the backdrop is the game’s own colour</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${['pool', 'tubes', 'hanoi', 'minefield', 'tilt', 'curling'].map((g) => `<div style="border-radius:14px;overflow:hidden;background:radial-gradient(110% 120% at 65% 25%,#2A3558,#0F1424 72%)"><img src="${key(g)}" style="width:100%;display:block"></div>`).join('')}</div>
  <h2>Don’t</h2><div class="t-label">No emoji as icons. No flat SVG for anything the kit can render. No glow, neon or outline. No second light. No one-off art outside the kit: a new icon is a new scene in art.html, rendered at 192 px (icons) or 640 × 400 (key art).</div>`;
  return sheet('Art kit', 'One artist, one light, one material: gloss.', body);
}

export const SHEETS = { tokens, components, motion, artkit };
