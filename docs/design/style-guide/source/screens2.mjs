// Round 2 phone screens. Every value from kit2.mjs; every picture from the art kit or the approved avatars.
import { phone, topBar, icon, art, key, avatar, bolt, PEOPLE, CATEGORY, GROUP, RARITY, AV } from './kit2.mjs';

// ---------------------------------------------------------------- shared sections
export const STARS = (n, s = 14) => `<span style="display:inline-flex;gap:2px">${[0, 1, 2].map((i) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z" fill="${i < n ? 'var(--gold)' : 'rgba(255,255,255,.22)'}" stroke="rgba(0,0,0,.35)" stroke-width="1"/></svg>`).join('')}</span>`;

export const STAR = (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="flex:none"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z" fill="var(--gold)"/></svg>`;

export function header() {
  return `<div style="height:56px;position:relative;z-index:3;background:var(--bg);display:flex;align-items:center;gap:12px;padding:0 16px">
  ${avatar(PEOPLE.me, 36)}
  <span class="chip" style="background:transparent;padding:0 4px"><span style="color:var(--goldInk)">${icon('streak', 20)}</span><span class="num">4</span></span>
  <span style="flex:1"></span>
  <span class="chip num"><img src="${art('coins')}" width="26" height="26" style="margin-left:-6px">1,250</span>
  <span style="width:40px;height:40px;display:grid;place-items:center;color:var(--text2)">${icon('notifications', 24)}</span></div>`;
}

export function dailyHero(w = 290, pw = 150, h = 184) {
  const main = `<div style="flex:none;width:${w}px;height:${h}px;border-radius:var(--r-lg);position:relative;overflow:hidden;background:radial-gradient(120% 130% at 80% 20%,#25306A 0%,#141B3D 55%,#0F1424 100%)">
      <img src="${key('board')}" style="position:absolute;right:${-w * 0.2}px;top:${h * 0.1}px;width:${Math.round(w * 0.85)}px">
      <div style="position:absolute;left:18px;top:18px;color:#EEF2FF" class="t-title">Daily Puzzle</div>
      <div style="position:absolute;left:18px;top:52px;color:#B5C6DD" class="t-caption num">12,431 played today</div>
      <div class="btn btn-gold btn-sm" style="position:absolute;left:18px;bottom:22px;width:120px">Play</div></div>`;
  const peek = `<div class="panel" style="flex:none;width:${pw}px;height:${h}px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center">
     <img src="${art('arcade')}" width="64" height="64"><div class="t-body">Daily Arcade</div><div class="t-caption num">8,902 played today</div></div>`;
  return `<div style="display:flex;gap:12px;overflow:hidden">${main}${peek}</div>`;
}

export function recommended() {
  const p = PEOPLE.sam;
  return `<div class="sec"><span class="t-heading">Your next match</span></div>
  <div class="panel" style="display:flex;align-items:center;gap:14px;padding:12px 14px">
    ${avatar(p, 52)}
    <div style="flex:1;min-width:0"><div class="t-body">${p.name}</div>
     <div class="t-caption num" style="margin-top:2px">${p.rating} · Online now</div>
     <span class="tag" style="margin-top:6px;background:rgba(22,195,91,.16);color:var(--win)">Friend</span></div>
    <div class="btn btn-2" style="width:52px;height:48px;border-radius:var(--r-md);color:var(--goldInk)">${icon('challenge', 24)}</div></div>`;
}

export function ratingTiles(n = 3, w = 112) {
  const tiles = [['joules', '1,482', 'Joulz Rating'], ['puzzles', '1,530', 'Puzzles'], ['arcade', '1,410', 'Arcade'], ['rated', '1,601', 'Logic']].slice(0, n);
  return `<div class="sec"><span class="t-heading">Ratings</span><a>All ratings</a></div>
  <div style="display:flex;gap:12px;overflow:hidden">${tiles.map(([a, v, l]) => `<div class="panel" style="flex:none;width:${w}px;height:128px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
   <img src="${art(a)}" width="52" height="52"><div class="num" style="font-size:22px;font-weight:800;margin-top:4px">${v}</div><div class="t-caption" style="color:var(--text2)">${l}</div></div>`).join('')}</div>`;
}

export const GAMES = {
  pool: { name: 'Cue Ball', bg: GROUP.sports, stars: 2 }, tubes: { name: 'Polypotions', bg: CATEGORY.logic, stars: 2 },
  gemstone: { name: 'Gemstone', bg: GROUP.strategy, stars: 1 }, blockzone: { name: 'Blockzone', bg: GROUP.retro, stars: 3 },
  minefield: { name: 'Minefield', bg: CATEGORY.logic, stars: 0 }, hanoi: { name: 'Hanoi', bg: CATEGORY.logic, stars: 3 },
  tilt: { name: 'Tilt', bg: GROUP.strategy, stars: 1 }, curling: { name: 'Curl Champ', bg: GROUP.sports, stars: 0 },
};
// Key art sits on a deep tint of the game's own category or group colour.
export const tint = (hex, a = 0.38) => `radial-gradient(110% 120% at 65% 25%,${hex}${Math.round(a * 255).toString(16).padStart(2, '0')} 0%,#0F1424 72%)`;

export function recent(n = 4, s = 72) {
  return `<div class="sec"><span class="t-heading">Recently played</span><a>All games</a></div>
  <div style="display:flex;gap:14px;overflow:hidden">${['pool', 'tubes', 'gemstone', 'blockzone', 'hanoi'].slice(0, n).map((g) => `<div style="flex:none;width:${s}px;text-align:center">
   <div style="width:${s}px;height:${s}px;border-radius:50%;background:${tint(GAMES[g].bg, 0.55)};overflow:hidden;position:relative">
   <img src="${key(g)}" style="position:absolute;width:${s * 1.7}px;left:${-s * 0.35}px;top:${-s * 0.2}px"></div>
   <div class="t-caption" style="color:var(--text2);margin-top:6px;white-space:nowrap">${GAMES[g].name}</div></div>`).join('')}</div>`;
}

export function weekly() {
  const row = (t, n, of, j) => `<div style="padding:12px 0;border-top:1px solid var(--line)">
   <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-body" style="font-size:16px">${t}</span><span class="joules num">${bolt(13)}${j}</span></div>
   <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><div class="bar" style="flex:1"><i style="width:${(n / of) * 100}%"></i></div>
   <span class="t-caption num" style="color:var(--text2)">${n}/${of}</span></div></div>`;
  return `<div class="panel" style="padding:14px 16px 4px">
   <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><img src="${art('quest')}" width="44" height="44">
   <div style="flex:1"><div class="t-heading">This week</div><div class="t-caption">New challenges on Monday</div></div></div>
   ${row('Win 3 rated matches', 1, 3, '750')}${row('Play 5 Logic games', 2, 5, '1,000')}</div>`;
}

export function friendsOnline(n = 3, w = 112) {
  const fr = [PEOPLE.kira, PEOPLE.ollie, PEOPLE.mo].slice(0, n);
  return `<div class="sec"><span class="t-heading">Friends online</span><a>Friends</a></div>
  <div style="display:flex;gap:12px;overflow:hidden">${fr.map((p) => `<div class="panel" style="flex:none;width:${w}px;padding:14px 8px;text-align:center">
   <div style="position:relative;width:56px;margin:0 auto">${avatar(p, 56)}<span style="position:absolute;right:-5px;bottom:-5px;width:16px;height:16px;border-radius:50%;background:var(--win);border:3px solid var(--surface)"></span></div>
   <div class="t-body" style="font-size:15px;margin-top:10px">${p.name}</div><div class="btn btn-2 btn-sm" style="margin-top:10px;height:32px;font-size:14px">Invite</div></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- 1 Home
export function home(theme = 'dark', scroll = 0) {
  const body = `${header()}
  <div style="padding:4px 16px 0;display:flex;flex-direction:column;gap:28px;transform:translateY(${-scroll}px);clip-path:inset(${scroll}px 0 0 0)">
   ${dailyHero()}<div>${recommended()}</div><div>${ratingTiles()}</div><div>${recent()}</div>${weekly()}<div>${friendsOnline()}</div></div>`;
  return phone(theme, body, { tab: 'home', play: true });
}

// ---------------------------------------------------------------- 2 Play and 3 its sheet
const MODES = [['arena', 'Arena', 'Next at 20:00'], ['rooms', 'Rooms', 'With friends'], ['practice', 'Practice', '83 games'], ['daily', 'Daily', 'Puzzle and Arcade']];
export function playPanel(compact) {
  return `
   <div class="btn btn-2" style="height:56px;border-radius:var(--r-md);justify-content:flex-start;padding:0 16px;gap:12px">
     <img src="${art('rated')}" width="36" height="36"><span style="flex:1;text-align:left">Rated · Best of 3 · Mixed</span>
     <span style="color:var(--text2)">${icon('chevron-down', 22)}</span></div>
   <div class="btn btn-gold btn-lg" style="margin-top:16px">Find a match</div>
   <div class="t-caption num" style="text-align:center;margin:12px 0 22px">Win <span style="color:var(--win);font-weight:800">+8</span> · Lose <span style="color:var(--loss);font-weight:800">−8</span> · About 6 min</div>
   <div style="display:flex;flex-direction:column;gap:${compact ? 12 : 14}px">${MODES.map(([a, l, m]) => `<div class="btn btn-2" style="height:${compact ? 60 : 64}px;justify-content:flex-start;padding:0 16px;border-radius:var(--r-md);gap:14px">
     <img src="${art(a)}" width="44" height="44" style="margin:-4px 0"><span style="flex:1;text-align:left">${l}</span><span class="t-caption" style="font-weight:600">${m}</span><span class="chev">${icon('chevron-right', 20)}</span></div>`).join('')}</div>`;
}
export function play(theme = 'dark') {
  const body = `${topBar('Play', { back: true })}
  <div style="height:206px;position:relative"><img src="${key('hero')}" style="position:absolute;left:50%;top:-14px;transform:translateX(-50%);width:350px"></div>
  <div style="padding:0 16px">${playPanel(true)}</div>`;
  return phone(theme, body, {});
}
export function sheetBody() {
  const opt = (l, on, sub, off) => `<div class="btn btn-2 ${off ? 'disabled' : ''}" style="flex:1;height:64px;flex-direction:column;gap:2px;border-radius:var(--r-md);${on ? 'box-shadow:inset 0 0 0 2px var(--gold),0 var(--lh) 0 var(--ledge2)' : ''}">
     <span style="font-size:16px">${l}</span><span class="t-caption" style="font-weight:600">${sub}</span></div>`;
  const group = (ic, t, opts) => `<div style="display:flex;align-items:center;gap:10px;margin:22px 0 12px"><img src="${art(ic)}" width="30" height="30"><span class="t-body" style="color:var(--text2)">${t}</span></div>
     <div style="display:flex;gap:10px">${opts}</div>`;
  return `<div style="height:5px;width:40px;border-radius:3px;background:var(--surface3);margin:8px auto 0"></div>
    <div style="display:flex;align-items:center;height:52px"><span style="width:44px;height:44px;display:grid;place-items:center;color:var(--text2)">${icon('close', 24)}</span><span class="t-heading" style="flex:1;text-align:center;margin-right:44px">Choose a match</span></div>
    ${group('rated', 'Format', opt('1 v 1', true, 'Best of 3') + opt('4 players', false, 'Soon', true) + opt('8 players', false, 'Soon', true))}
    ${group('puzzles', 'Games', opt('Mixed', true, 'All kinds') + opt('Puzzles', false, '6 categories') + opt('Arcade', false, '5 groups'))}
    <div class="t-caption" style="margin-top:22px;text-align:center">Your choice is saved for next time.</div>`;
}
export function sheet(theme = 'dark') {
  const overlay = `<div style="position:absolute;inset:0;background:var(--scrim);z-index:6"></div>
   <div style="position:absolute;left:0;right:0;bottom:0;height:470px;background:var(--raised);border-radius:20px 20px 0 0;padding:0 16px;z-index:7;box-shadow:0 -8px 32px rgba(0,0,0,.5)">${sheetBody()}</div>`;
  return play(theme).replace(/<div style="position:absolute;left:128px;bottom:8px/, overlay + '<div style="position:absolute;left:128px;bottom:8px');
}

// ---------------------------------------------------------------- match header (puzzle and arcade)
function plate(p, { right, you, sub } = {}) {
  return `<div style="display:flex;flex-direction:${right ? 'row-reverse' : 'row'};align-items:center;gap:10px;min-width:0;flex:1">
   ${avatar(p, 42)}<div style="min-width:0;text-align:${right ? 'right' : 'left'}"><div class="t-body" style="font-size:16px">${you ? 'You' : p.name}</div>
   <div class="t-caption num">${sub ?? p.rating}</div></div></div>`;
}
export function matchHeader({ centre, mySub, theirSub } = {}) {
  return `<div style="display:flex;align-items:center;padding:4px 16px 0;gap:8px">
    ${plate(PEOPLE.me, { you: true, sub: mySub })}<div style="text-align:center;flex:none">${centre}</div>${plate(PEOPLE.sam, { right: true, sub: theirSub })}</div>`;
}
const stakes = `<span class="chip num" style="height:28px;font-size:13px">Rated · Win <span style="color:var(--win)">+8</span> · Lose <span style="color:var(--loss)">−8</span></span>`;

// ---------------------------------------------------------------- 4 puzzle: Polypotions mid-pour
export const FLASKS = `
function flask(ctx,x,y,w,h,layers,glow){const r=w/2;ctx.save();ctx.translate(x,y);
 ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(-r,h-r);ctx.arc(0,h-r,r,Math.PI,0,true);ctx.lineTo(r,0);ctx.closePath();
 ctx.save();ctx.clip();ctx.fillStyle='rgba(180,200,255,.07)';ctx.fillRect(-r,0,w,h);
 const seg=(h-10)/4;layers.forEach((c,i)=>{const yy=h-seg*(i+1);ctx.fillStyle=c;ctx.fillRect(-r,yy,w,seg+1);
  const g=ctx.createLinearGradient(-r,0,r,0);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(.35,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=g;ctx.fillRect(-r,yy,w,seg+1);
  ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(-r,yy,w,2);});
 ctx.restore();
 ctx.lineWidth=3;ctx.strokeStyle=glow?'#E2C07A':'rgba(220,230,255,.55)';ctx.stroke();
 ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(-r+6,8,4,h-r-10);
 ctx.strokeStyle='rgba(220,230,255,.7)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r-5,1);ctx.lineTo(r+5,1);ctx.stroke();ctx.restore();}
`;
// Two rows of three flasks; the right flask of the bottom row is lifted, tilted and pouring into the middle top flask.
export const POUR = `
  flask(ctx,120,300,W,H,[P.o,P.g]);flask(ctx,358,300,W,H,[P.p,P.b,P.p]);flask(ctx,596,300,W,H,[P.g,P.b,P.o,P.g]);
  flask(ctx,120,660,W,H,[P.b,P.g,P.o,P.b]);flask(ctx,358,660,W,H,[P.o,P.b,P.o]);
  ctx.save();ctx.setLineDash([10,10]);ctx.strokeStyle='rgba(220,230,255,.22)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(548,660);ctx.lineTo(548,912);ctx.arc(596,912,48,Math.PI,0,true);ctx.lineTo(644,660);ctx.stroke();ctx.restore();
  ctx.save();ctx.translate(420,200);ctx.rotate(-2.2);flask(ctx,0,0,W,H,[P.g,P.o,P.p,P.p],true);ctx.restore();
  ctx.strokeStyle=P.p;ctx.lineCap='round';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(452,236);ctx.bezierCurveTo(440,262,380,262,362,330);ctx.stroke();
  ctx.lineWidth=4;ctx.strokeStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.moveTo(448,238);ctx.bezierCurveTo(436,262,378,262,358,326);ctx.stroke();
  ctx.fillStyle='rgba(255,180,235,.85)';for(const [dx,dy,r] of [[-24,-6,6],[22,-10,5],[-10,-18,4],[16,-2,4]]){ctx.beginPath();ctx.arc(358+dx,388+dy,r,0,7);ctx.fill();}
`;
export function puzzle(theme = 'dark') {
  const body = `${matchHeader({ centre: '<div class="t-caption">Game 1 of 3</div><div class="num" style="font-weight:900;font-size:22px;line-height:26px">0 – 0</div>' })}
   <div style="display:flex;justify-content:center;gap:8px;margin-top:12px">${stakes}</div>
   <div style="margin:12px 16px 0;height:6px;border-radius:3px;background:var(--surface2)"><div style="width:58%;height:100%;border-radius:3px;background:var(--text2)"></div></div>
   <div style="display:flex;justify-content:center;gap:8px;margin-top:14px"><span class="chip num" style="background:var(--surface2)">Moves 7</span><span class="chip num" style="background:var(--surface2)">Par 9</span></div>
   <canvas id="b" width="716" height="1000" style="width:358px;height:500px;margin:6px 16px 0;display:block"></canvas>
   <div style="position:absolute;left:16px;right:16px;bottom:34px;display:flex;gap:12px">
    <div class="btn btn-2 btn-md" style="width:56px">${icon('more', 24)}</div>
    <div class="btn btn-2 btn-md" style="flex:1">${icon('rematch', 20)}Undo</div><div class="btn btn-2 btn-md" style="flex:1">Reset</div></div>
  <script>${FLASKS}
  const ctx=document.getElementById('b').getContext('2d');
  const P={o:'#FF8A3D',b:'#4D8CFF',g:'#3DDC84',p:'#FF6BD6'};
  const W=96,H=300;
  ${POUR}
  </script>`;
  return phone(theme, body, {});
}

// ---------------------------------------------------------------- 5 arcade: Cue Ball
export const TABLE = `
const COLS={1:'#F2B92E',2:'#2F6BE0',3:'#E0413A',4:'#7E4BC9',5:'#F07A2A',6:'#1E9A5A',7:'#8A2A2A',8:'#141414'};
function ball(ctx,x,y,r,n){const c=COLS[n>8?n-8:n]||'#F4EFE6';
 ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.clip();
 ctx.fillStyle=n===0?'#F4EFE6':(n>8?'#F4EFE6':c);ctx.fillRect(x-r,y-r,2*r,2*r);
 if(n>8){ctx.fillStyle=c;ctx.fillRect(x-r,y-r*.55,2*r,r*1.1);}
 if(n>0){ctx.fillStyle='#F7F3EA';ctx.beginPath();ctx.arc(x,y,r*.48,0,7);ctx.fill();ctx.fillStyle='#1b1b1b';
  ctx.font='800 '+Math.round(r*.62)+'px Archivo';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n,x,y+r*.04);}
 const g=ctx.createRadialGradient(x-r*.4,y-r*.45,r*.05,x,y,r*1.05);g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(.25,'rgba(255,255,255,.08)');g.addColorStop(.7,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.45)');
 ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function shade(h,a){const n=parseInt(h.slice(1),16);const f=c=>Math.max(0,Math.min(255,c+a));return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';}
function table(cv,felt,land){const ctx=cv.getContext('2d');const W=cv.width,H=cv.height;const s=W/(land?700:358);const rail=24*s,R=18*s;
 ctx.fillStyle='#0B0F1C';rr(ctx,0,0,W,H,R);ctx.fill();
 const wg=ctx.createLinearGradient(0,0,0,H);wg.addColorStop(0,'#2A3558');wg.addColorStop(1,'#161D36');ctx.fillStyle=wg;rr(ctx,3*s,3*s,W-6*s,H-6*s,R-3*s);ctx.fill();
 ctx.strokeStyle='rgba(226,192,122,.55)';ctx.lineWidth=1.5*s;rr(ctx,7*s,7*s,W-14*s,H-14*s,R-6*s);ctx.stroke();
 const fg=ctx.createRadialGradient(W/2,H/2,10,W/2,H/2,Math.max(W,H)*.65);fg.addColorStop(0,shade(felt,16));fg.addColorStop(1,shade(felt,-16));
 ctx.fillStyle=fg;ctx.fillRect(rail,rail,W-2*rail,H-2*rail);
 const pk=land?[[rail,rail],[W/2,rail-4*s],[W-rail,rail],[rail,H-rail],[W/2,H-rail+4*s],[W-rail,H-rail]]:[[rail,rail],[W-rail,rail],[rail-4*s,H/2],[W-rail+4*s,H/2],[rail,H-rail],[W-rail,H-rail]];
 for(const [x,y] of pk){ctx.fillStyle='#03050A';ctx.beginPath();ctx.arc(x,y,13*s,0,7);ctx.fill();}
 ctx.fillStyle='rgba(226,192,122,.8)';for(let i=1;i<4;i++){const t=i/4;const d=(x,y)=>{ctx.beginPath();ctx.arc(x,y,2.2*s,0,7);ctx.fill();};if(land){d(rail+(W-2*rail)*t,rail/2);d(rail+(W-2*rail)*t,H-rail/2);}else{d(rail/2,rail+(H-2*rail)*t);d(W-rail/2,rail+(H-2*rail)*t);}}
 return {ctx,s};}
function shadow(ctx,x,y,r){ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(x+r*.35,y+r*.45,r*.95,r*.8,0,0,7);ctx.fill();}
function cue(ctx,x,y,ang,s,pull){const L=330*s;ctx.save();ctx.translate(x,y);ctx.rotate(ang);
 ctx.strokeStyle='rgba(255,255,255,.55)';ctx.setLineDash([6*s,6*s]);ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(-12*s,0);ctx.lineTo(-150*s,0);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.6*s;ctx.beginPath();ctx.arc(-161*s,0,11*s,0,7);ctx.stroke();
 const g=ctx.createLinearGradient(0,-5*s,0,5*s);g.addColorStop(0,'#F2DDB0');g.addColorStop(.5,'#D9B37A');g.addColorStop(1,'#8E6A3C');
 ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect((14+pull)*s,2*s,L,9*s);
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo((12+pull)*s,-2.6*s);ctx.lineTo((12+pull)*s+L,-5.5*s);ctx.lineTo((12+pull)*s+L,5.5*s);ctx.lineTo((12+pull)*s,2.6*s);ctx.fill();
 ctx.fillStyle='#141A30';ctx.fillRect((12+pull)*s+L*.62,-4.6*s,L*.38,9.2*s);ctx.fillStyle='#E2C07A';ctx.fillRect((12+pull)*s+L*.6,-4.4*s,4*s,8.8*s);ctx.fillStyle='#EDEDED';ctx.fillRect((12+pull)*s,-2.6*s,4*s,5.2*s);ctx.restore();}
`;
export const groupRow = (nums, potted, r = 9) => `<div style="display:flex;gap:4px">${nums.map((n) => `<canvas class="mini" data-n="${n}" data-p="${potted.includes(n) ? 1 : 0}" width="${r * 4}" height="${r * 4}" style="width:${r * 2}px;height:${r * 2}px"></canvas>`).join('')}</div>`;
export const miniScript = `for(const c of document.querySelectorAll('canvas.mini')){const x=c.getContext('2d');const r=c.width/2;
 if(c.dataset.p==='1'){x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.arc(r,r,r*.92,0,7);x.fill();}else ball(x,r,r,r*.92,+c.dataset.n);}`;
export function arcade(theme = 'dark') {
  const body = `${matchHeader({ centre: '<div class="t-caption">Game 2 of 3</div><div class="num" style="font-weight:900;font-size:22px;line-height:26px">1 – 0</div>' })}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px 0">${groupRow([9, 10, 11, 12, 13, 14, 15], [10, 13, 14])}${groupRow([1, 2, 3, 4, 5, 6, 7], [2])}</div>
  <div style="margin:10px 16px 0;height:6px;border-radius:3px;background:var(--surface2)"><div style="width:68%;height:100%;border-radius:3px;background:var(--text2)"></div></div>
  <div style="display:flex;justify-content:center;margin-top:8px">${stakes}</div>
  <canvas id="t" width="716" height="1120" style="width:358px;height:560px;margin:12px 16px 0;display:block"></canvas>
  <div style="position:absolute;left:16px;right:16px;bottom:30px;display:flex;align-items:center;justify-content:space-between">
    <div class="btn btn-2 btn-md" style="width:56px">${icon('more', 24)}</div>
    <div class="t-label">Your shot · drag to aim</div>
    <canvas id="spin" width="96" height="96" style="width:48px;height:48px"></canvas></div>
  <script>${TABLE}
  const {ctx}=table(document.getElementById('t'),'#1C5C8A',false);
  const B=[[0,180,770],[9,250,300],[11,120,240],[12,300,520],[15,150,600],[1,380,330],[3,520,240],[4,560,640],[5,470,840],[6,240,930],[7,560,950],[8,370,470]];
  for(const [n,x,y] of B)shadow(ctx,x,y,22);for(const [n,x,y] of B)ball(ctx,x,y,22,n);
  cue(ctx,180,770,Math.atan2(770-470,180-370),2,10);
  const sp=document.getElementById('spin').getContext('2d');ball(sp,48,48,44,0);sp.fillStyle='#E0413A';sp.beginPath();sp.arc(48,32,8,0,7);sp.fill();
  ${miniScript}</script>`;
  return phone(theme, body, {});
}

// ---------------------------------------------------------------- 6 catalogue (Games tab)
export const CHIPS = [['All', null], ['Word', CATEGORY.word], ['Number', CATEGORY.number], ['Speed', CATEGORY.speed], ['Attention', CATEGORY.attention], ['Pattern', CATEGORY.pattern], ['Logic', CATEGORY.logic], ['Arcade', CATEGORY.arcade]];
export const chips = (on = 'All') => `<div style="display:flex;gap:8px;overflow:hidden">${CHIPS.map(([l, c]) => `<span class="chip" style="height:36px;flex:none;${l === on ? 'background:var(--text);color:var(--bg)' : 'background:var(--surface)'}">${c ? `<span style="width:8px;height:8px;border-radius:50%;background:${c}"></span>` : ''}${l}</span>`).join('')}</div>`;
export function tile(g, w, h, { big } = {}) {
  const G = GAMES[g];
  return `<div style="width:${w}px;height:${h}px;border-radius:var(--r-lg);position:relative;overflow:hidden;background:${tint(G.bg, big ? 0.5 : 0.45)};flex:none">
    <img src="${key(g)}" style="position:absolute;left:50%;top:${big ? -8 : -4}%;transform:translateX(-50%);width:${big ? 115 : 130}%">
    <div style="position:absolute;left:0;right:0;bottom:0;height:${big ? 70 : 54}px;background:linear-gradient(transparent,rgba(6,8,15,.85))"></div>
    <div style="position:absolute;left:12px;bottom:${big ? 14 : 10}px;font-weight:800;font-size:${big ? 24 : 17}px;color:#EEF2FF">${G.name}</div>
    ${big ? `<div class="tag" style="position:absolute;left:12px;top:12px;background:rgba(6,8,15,.7);color:#EEF2FF">New season</div>` : ''}
    <div style="position:absolute;right:10px;bottom:${big ? 16 : 12}px">${STARS(G.stars, big ? 16 : 13)}</div></div>`;
}
export function catalogue(theme = 'dark') {
  const body = `<div style="height:52px;display:flex;align-items:center;padding:0 16px;gap:10px"><span class="t-title" style="flex:1">Games</span>
     <span class="t-caption num" style="display:flex;align-items:center;gap:4px">${STAR(16)} 74 / 249</span>
     <span style="width:40px;height:40px;display:grid;place-items:center;color:var(--text2)">${icon('search', 24)}</span></div>
   <div style="padding:2px 16px 0">${chips()}</div>
   <div style="padding:16px 16px 0;display:flex;flex-direction:column;gap:12px">
    ${tile('pool', 358, 176, { big: true })}
    <div style="display:grid;grid-template-columns:173px 173px;gap:12px">${['tubes', 'gemstone', 'hanoi', 'blockzone', 'minefield', 'tilt'].map((g) => tile(g, 173, 128)).join('')}</div></div>`;
  return phone(theme, body, { tab: 'games', play: true });
}

// ---------------------------------------------------------------- 7 game intro page with its challenges
export const CH_POLY = [
  ['Finish under par', 'Done', 1, 1, '100'], ['Finish with 40 s left', '28 s best', 28, 40, '100'], ['Finish without Undo', 'Not yet', 0, 1, '100'],
];
export function challengeRow([t, sub, n, of, j]) {
  const done = n >= of;
  return `<div class="row" style="min-height:64px;padding:0">
   <span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;flex:none;${done ? 'background:var(--win);color:#06080F' : 'border:2px solid var(--surface3);color:transparent'}">${icon('check', 18)}</span>
   <div style="flex:1;min-width:0"><div class="t-body" style="font-size:16px">${t}</div>
    ${done ? `<div class="t-caption">Done</div>` : `<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div class="bar" style="flex:1;height:6px"><i style="width:${(n / of) * 100}%"></i></div><span class="t-caption num">${sub}</span></div>`}</div>
   <span class="joules num" style="${done ? 'opacity:.5' : ''}">${bolt(13)}${j}</span></div>`;
}
export function intro(theme = 'dark') {
  const body = `<div style="position:absolute;left:0;right:0;top:0;height:300px;background:${tint(CATEGORY.logic, 0.5)}"><img src="${key('tubes')}" style="position:absolute;left:50%;top:44px;transform:translateX(-50%);width:400px"></div>
   <div style="position:relative;z-index:2;height:52px;display:flex;align-items:center;padding:0 12px;color:var(--text)">${icon('back', 26)}</div>
   <div style="position:absolute;left:0;right:0;top:268px;bottom:0;background:var(--bg);border-radius:20px 20px 0 0;padding:20px 16px 0">
    <div style="display:flex;align-items:center;gap:10px"><span class="t-title" style="flex:1">Polypotions</span>${STARS(2, 20)}</div>
    <div style="display:flex;gap:8px;margin-top:8px"><span class="tag" style="background:rgba(46,211,183,.16);color:${CATEGORY.logic}">Logic</span><span class="tag" style="background:var(--surface2);color:var(--text2)">90 s</span><span class="tag num" style="background:var(--surface2);color:var(--text2)">Best 182</span></div>
    <div class="panel" style="padding:14px 16px;margin-top:16px">
     <div class="t-body">Sort the potions so each flask is one colour.</div>
     <div class="t-label" style="margin-top:6px">Tap a flask to lift it, then tap where to pour. Up to 200 for finishing fast and under par.</div></div>
    <div class="sec" style="margin-top:22px"><span class="t-heading">Challenges</span><span class="t-caption num">1 of 3 done</span></div>
    <div class="panel" style="padding:0 16px">${CH_POLY.map(challengeRow).join('')}</div>
   </div>
   <div style="position:absolute;left:0;right:0;bottom:0;padding:14px 16px 34px;background:var(--bg);z-index:4"><div class="btn btn-gold btn-lg">Play</div></div>`;
  return phone(theme, body, {});
}

// ---------------------------------------------------------------- 8 every challenge (More → Challenges)
export const CH_ALL = [
  ['tubes', [['Finish with 40 s left', '28 s best', 28, 40, '100'], ['Finish without Undo', 'Not yet', 0, 1, '100']]],
  ['pool', [['Pot 3 in one visit', '2 best', 2, 3, '100'], ['Clear your set with 30 s left', '12 s best', 12, 30, '100']]],
  ['gemstone', [['Free all six treasures', '4 best', 4, 6, '100']]],
];
export function challengesList(theme = 'dark') {
  const body = `${topBar('Challenges', { back: true })}
   <div style="padding:4px 16px 0">
    <div class="panel" style="padding:16px;display:flex;align-items:center;gap:14px"><img src="${art('challenges')}" width="56" height="56">
     <div style="flex:1"><div class="t-heading num">61 of 217 done</div><div class="bar" style="margin-top:8px"><i style="width:28%"></i></div>
     <div class="t-caption" style="margin-top:6px">Every challenge counts towards your Challenger badges.</div></div></div>
    <div class="seg" style="margin-top:16px"><span class="on">In progress</span><span>New</span><span>Done</span></div>
    ${CH_ALL.map(([g, rows]) => `<div style="display:flex;align-items:center;gap:10px;margin:20px 0 8px">
      <span style="width:32px;height:32px;border-radius:8px;overflow:hidden;background:${tint(GAMES[g].bg, 0.6)};position:relative"><img src="${key(g)}" style="position:absolute;width:60px;left:-14px;top:-6px"></span>
      <span class="t-body" style="flex:1">${GAMES[g].name}</span><span class="chev">${icon('chevron-right', 20)}</span></div>
      <div class="panel" style="padding:0 16px">${rows.map(challengeRow).join('')}</div>`).join('')}
   </div>`;
  return phone(theme, body, {});
}

// ---------------------------------------------------------------- 9 Profile
export function playerCard(w = 358) {
  return `<div style="width:${w}px;border-radius:var(--r-lg);overflow:hidden;background:var(--surface);position:relative">
   <div style="height:86px;background:linear-gradient(120deg,#1B2350,#2A3558 50%,#121830);position:relative">
    <svg width="100%" height="86" style="position:absolute;inset:0;opacity:.35"><defs><pattern id="pc" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M14 2 6 13h5l-2 9 9-12h-5l1-8z" fill="none" stroke="#E2C07A" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#pc)"/></svg></div>
   <div style="position:absolute;left:16px;top:42px;border-radius:14px;box-shadow:0 0 0 4px var(--surface)">${avatar(PEOPLE.me, 84)}</div>
   <div style="padding:10px 16px 16px 116px;min-height:60px"><div style="display:flex;align-items:center;gap:8px"><span class="t-title">Nova</span><span class="tag num" style="background:var(--surface2);color:var(--text2)">#0412</span></div>
    <div class="t-label">Rookie · Founding Player</div></div>
   <div style="display:flex;gap:8px;padding:0 16px 16px;align-items:center">
    <span class="chip num" style="background:var(--surface2)"><img src="${art('joules')}" width="22" height="22">Volt · 1,482</span>
    <span style="flex:1"></span>${['trophy', 'quest', 'challenges'].map((b) => `<img src="${art(b)}" width="34" height="34">`).join('')}</div></div>`;
}
export function profile(theme = 'dark') {
  const body = `<div style="height:52px;display:flex;align-items:center;padding:0 16px"><span class="t-title" style="flex:1">Profile</span><span style="color:var(--text2)">${icon('share', 24)}</span></div>
   <div style="padding:4px 16px 0;display:flex;flex-direction:column;gap:24px">
    <div>${playerCard()}<div class="btn btn-2 btn-md" style="margin-top:14px">${icon('edit', 20)}Customise card</div></div>
    <div>${ratingTiles(3, 112)}</div>
    <div><div class="sec"><span class="t-heading">Mastery</span><a>Games</a></div>
     <div class="panel" style="padding:14px 16px;display:flex;align-items:center;gap:14px">${STAR(36)}
      <div style="flex:1"><div class="t-body num">74 of 249 stars</div><div class="bar" style="margin-top:8px"><i style="width:30%"></i></div></div>
      <img src="${art('gem')}" width="40" height="40"></div></div>
    <div><div class="sec"><span class="t-heading">Recent matches</span><a>History</a></div>
     <div class="panel">${[[PEOPLE.sam, 'Cue Ball', 'W', '+8'], [PEOPLE.kira, 'Polypotions', 'W', '+6']].map(([p, g, r, c]) => `<div class="row">${avatar(p, 32)}<div style="flex:1"><div class="t-body" style="font-size:16px">${p.name}</div><div class="t-caption">${g} · Best of 3</div></div>
       <span class="num" style="font-weight:800;color:var(--win)">${c}</span><span class="tag" style="background:rgba(22,195,91,.16);color:var(--win)">${r}</span></div>`).join('')}</div></div>
   </div>`;
  return phone(theme, body, { tab: 'profile' });
}

// ---------------------------------------------------------------- 10 Shop
export function item(kind, name, rarity, price, w = 173) {
  const col = RARITY[rarity];
  const previews = {
    card: `<div style="width:120px;height:72px;border-radius:10px;background:linear-gradient(130deg,#3A1E5C,#7A3FB0 55%,#2A1747);box-shadow:inset 0 0 0 2px rgba(255,255,255,.18);position:relative"><span class="av" style="position:absolute;left:10px;top:14px;width:40px;height:40px;background:#C084FC;border-radius:8px"><img src="${AV('blackout')}"></span><span style="position:absolute;left:58px;top:22px;width:50px;height:8px;border-radius:4px;background:rgba(255,255,255,.75)"></span><span style="position:absolute;left:58px;top:36px;width:34px;height:6px;border-radius:3px;background:rgba(255,255,255,.4)"></span></div>`,
    frame: `<div style="width:84px;height:84px;border-radius:14px;padding:6px;background:conic-gradient(from 200deg,#FBEDC4,#D2AC5E,#EED79C,#A8843E,#FBEDC4)"><span class="av" style="width:72px;height:72px;background:#4FA3FF;border-radius:10px"><img src="${AV('apex')}"></span></div>`,
    avatar: `<span class="av" style="width:84px;height:84px;background:#FF6B8B;border-radius:42px"><img src="${AV('blockzone')}"></span>`,
    name: `<div style="font-weight:900;font-size:26px;background:linear-gradient(90deg,#22E4FF,#AEEAF7,#FFFFFF);-webkit-background-clip:text;color:transparent">Nova</div>`,
  };
  return `<div class="panel" style="width:${w}px;padding:12px;display:flex;flex-direction:column;align-items:center">
   <div style="height:96px;display:grid;place-items:center">${previews[kind]}</div>
   <div class="t-body" style="font-size:15px;margin-top:6px;text-align:center">${name}</div>
   <div class="t-caption" style="color:${col};font-weight:800">${rarity[0].toUpperCase() + rarity.slice(1)}</div>
   <div class="btn btn-2 btn-sm" style="margin-top:10px;width:100%"><img src="${art('coins')}" width="22" height="22" style="margin:-4px 0 -4px -6px">${price}</div></div>`;
}
export function shop(theme = 'dark') {
  const body = `<div style="height:52px;display:flex;align-items:center;padding:0 16px"><span class="t-title" style="flex:1">Shop</span><span class="chip num"><img src="${art('coins')}" width="26" height="26" style="margin-left:-6px">1,250</span></div>
   <div style="padding:4px 16px 0">
    <div class="seg"><span class="on">Shop</span><span>Pass</span><span>Plus</span></div>
    <div style="margin-top:16px;border-radius:var(--r-lg);overflow:hidden;position:relative;height:168px;background:radial-gradient(120% 130% at 80% 20%,#2A1F4D,#121830 70%)">
     <div style="position:absolute;right:18px;top:24px;transform:rotate(-6deg)">${item('card', '', 'elite', '').match(/<div style="width:120px[\s\S]*?<\/span><\/div>/)[0]}</div>
     <div style="position:absolute;right:96px;top:70px;transform:rotate(5deg)"><div style="width:76px;height:76px;border-radius:12px;padding:5px;background:conic-gradient(from 200deg,#C084FC,#7A3FB0,#E9D5FF,#7A3FB0,#C084FC)"><span class="av" style="width:66px;height:66px;background:#C084FC;border-radius:9px"><img src="${AV('blackout')}"></span></div></div>
     <div style="position:absolute;left:16px;top:16px"><div class="tag" style="background:rgba(169,155,255,.18);color:${RARITY.elite}">This week’s bundle</div>
      <div class="t-heading" style="margin-top:8px;width:150px">Neon Night</div><div class="t-caption">Card art, frame, avatar</div></div>
     <div class="btn btn-2 btn-sm" style="position:absolute;left:16px;bottom:16px;width:130px"><img src="${art('coins')}" width="22" height="22" style="margin:-4px 0 -4px -6px">2,400</div></div>
    <div class="sec" style="margin-top:24px"><span class="t-heading">Today</span><span class="t-caption">Changes daily</span></div>
    <div style="display:grid;grid-template-columns:173px 173px;gap:12px">${item('frame', 'Champagne frame', 'epic', '800')}${item('avatar', 'Pixel Kira', 'epic', '600')}</div>
   </div>`;
  return phone(theme, body, { tab: 'shop' });
}

// ---------------------------------------------------------------- 11 More
export const MORE = [
  ['Friends and rivals', [['friends', 'Friends', '<span class="tag" style="background:var(--gold);color:var(--onGold)">2</span>'], ['leaderboards', 'Leaderboards', '']]],
  ['Compete', [['arena', 'Arena and tournaments', '<span class="t-caption">Next 20:00</span>'], ['challenges', 'Challenges', '<span class="t-caption num">61 / 217</span>']]],
  ['Joulz', [['plus', 'Joulz Plus', ''], ['settings', 'Settings', ''], ['support', 'Support', '']]],
];
export const moreRow = ([a, l, meta]) => `<div class="row" style="min-height:62px"><img src="${art(a)}" width="40" height="40"><span class="t-body" style="flex:1">${l}</span>${meta}<span class="chev">${icon('chevron-right', 20)}</span></div>`;
export function more(theme = 'dark') {
  const body = `<div style="height:52px;display:flex;align-items:center;padding:0 16px"><span class="t-title">More</span></div>
   <div style="padding:4px 16px 0">${MORE.map(([g, rows]) => `<div class="t-caption" style="font-weight:800;margin:18px 4px 8px">${g}</div><div class="panel">${rows.map(moreRow).join('')}</div>`).join('')}</div>`;
  return phone(theme, body, { tab: 'more' });
}

// ---------------------------------------------------------------- 12 list: Arena and tournaments
export const EVENTS = [
  ['Today', [['arena', 'Evening Arena', 'Mixed · 45 min · 124 entered', 'Starts 20:00', true], ['quest', 'Score Attack', 'Logic · 5 games · 50 coins', 'Until midnight']]],
  ['This week', [['trophy', 'Category Cup', 'Word · Saturday 19:00 · 150 coins', 'Sat'], ['leaderboards', 'Joulz Championship', 'Top 64 of the month', '30 Nov']]],
];
export const eventRow = ([a, t, sub, when, live]) => `<div class="row" style="min-height:72px"><img src="${art(a)}" width="42" height="42">
  <div style="flex:1;min-width:0"><div class="t-body">${t}</div><div class="t-caption num" style="margin-top:2px">${sub}</div></div>
  <span class="t-label num" style="${live ? 'color:var(--live);font-weight:800' : ''}">${when}</span><span class="chev">${icon('chevron-right', 20)}</span></div>`;
export function list(theme = 'dark') {
  const body = `${topBar('Arena and tournaments', { back: true })}
   <div style="padding:4px 16px 0"><div class="seg"><span class="on">Upcoming</span><span>Your results</span></div>
   ${EVENTS.map(([g, rows]) => `<div class="t-caption" style="font-weight:800;margin:20px 4px 8px">${g}</div><div class="panel">${rows.map(eventRow).join('')}</div>`).join('')}</div>`;
  return phone(theme, body, {});
}
