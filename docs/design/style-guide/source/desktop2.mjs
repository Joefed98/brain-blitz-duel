// Round 2 desktop screens (1440 × 900): the left rail with labels, content in a centred column, an aside where it earns
// its place. Pieces come from screens2.mjs so phone and desktop say the same thing.
import { desktop, rail, icon, art, key, avatar, bolt, PEOPLE, CATEGORY } from './kit2.mjs';
import * as P from './screens2.mjs';

const page = (current, main, opts = {}) => desktop('dark', rail(current, opts.slim) + main, opts);
const title = (t, right = '') => `<div style="display:flex;align-items:center;gap:14px;margin-bottom:24px"><span class="t-title" style="flex:1;font-size:28px;line-height:34px">${t}</span>${right}</div>`;
const coins = `<span class="chip num" style="height:40px;font-size:17px"><img src="${art('coins')}" width="30" height="30" style="margin-left:-6px">1,250</span>`;

function home() {
  return page('home', `<div style="flex:1;padding:28px 32px;display:flex;gap:32px;overflow:hidden">
   <div style="flex:1;display:flex;flex-direction:column;gap:30px;min-width:0">
     <div style="display:flex;align-items:center;gap:14px">${avatar(PEOPLE.me, 44)}<div><div class="t-title">Good evening, Nova</div><div class="t-caption">4-day streak</div></div><span style="flex:1"></span>${coins}</div>
     ${P.dailyHero(540, 220, 196)}
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px"><div>${P.recommended()}</div><div>${P.recent(4, 76)}</div></div>
     <div>${P.ratingTiles(4, 182)}</div>
   </div>
   <div style="width:340px;flex:none;display:flex;flex-direction:column;gap:28px">${P.weekly()}<div>${P.friendsOnline(2, 164)}</div></div></div>`);
}

function play(withSheet) {
  const overlay = withSheet ? `<div style="position:absolute;inset:0;background:var(--scrim);z-index:6"></div>
   <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;background:var(--raised);border-radius:20px;padding:4px 24px 26px;z-index:7;box-shadow:0 16px 48px rgba(0,0,0,.6)">${P.sheetBody().replace(/<div style="height:5px;width:40px[^>]*><\/div>/, '')}</div>` : '';
  return page('', `<div style="flex:1;display:flex;gap:32px;padding:32px;overflow:hidden">
   <div class="panel" style="flex:1;position:relative;overflow:hidden;background:radial-gradient(90% 80% at 50% 45%,#1E2640,#0F1424)">
     <img src="${key('hero')}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:840px">
     <div style="position:absolute;left:32px;top:28px" class="t-display">Play</div></div>
   <div style="width:400px;flex:none;padding-top:12px">${P.playPanel(false)}</div></div>`, { overlay });
}

function sidePanel(rows, extra = '') {
  return `<div class="panel" style="width:360px;flex:none;padding:20px;display:flex;flex-direction:column">
   <div class="t-heading">Rated match</div><div class="t-caption">Best of 3 · Polypotions, Cue Ball, Minefield</div>
   <div style="margin-top:18px">${rows.map(([p, n, g, r, c]) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)">
     ${avatar(p, 40)}<div style="flex:1"><div class="t-body" style="font-size:16px">${n}</div><div class="t-caption num">${r} ${c ? `<span style="color:${c[0] === '+' ? 'var(--win)' : 'var(--loss)'};font-weight:800">${c}</span>` : ''}</div></div>
     ${g.map((x) => `<span class="num" style="width:28px;height:28px;border-radius:6px;display:grid;place-items:center;font-weight:800;font-size:14px;background:${x === 'W' ? 'rgba(22,195,91,.18)' : x === 'L' ? 'rgba(255,90,110,.16)' : 'var(--surface2)'};color:${x === 'W' ? 'var(--win)' : x === 'L' ? 'var(--loss)' : 'var(--text3)'}">${x}</span>`).join('')}</div>`).join('')}</div>${extra}</div>`;
}

function puzzle() {
  return page('', `<div style="flex:1;display:flex;gap:28px;padding:28px 32px;overflow:hidden">
   <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0">
    <div style="width:100%">${P.matchHeader({ centre: '<div class="t-caption">Game 1 of 3 · 0:52</div><span class="chip num" style="height:30px;font-size:14px;margin-top:4px">Win <span style="color:var(--win)">+8</span> · Lose <span style="color:var(--loss)">−8</span></span>' }).replace('padding:4px 16px 0', 'padding:0')}</div>
    <div style="display:flex;gap:8px;margin-top:14px"><span class="chip num" style="background:var(--surface2)">Moves 7</span><span class="chip num" style="background:var(--surface2)">Par 9</span></div>
    <canvas id="b" width="716" height="1000" style="width:430px;height:600px;margin-top:6px"></canvas>
    <div style="display:flex;gap:12px;width:430px"><div class="btn btn-2 btn-md" style="flex:1">${icon('rematch', 20)}Undo</div><div class="btn btn-2 btn-md" style="flex:1">Reset</div></div></div>
   ${sidePanel([[PEOPLE.me, 'You', ['–', '–', '–'], '1,482'], [PEOPLE.sam, 'Sam_Volt', ['–', '–', '–'], '1,503']], `<span style="flex:1"></span><div class="t-caption" style="text-align:center">Their score shows at the end of the game.</div>`)}</div>
  <script>${P.FLASKS}const ctx=document.getElementById('b').getContext('2d');const P={o:'#FF8A3D',b:'#4D8CFF',g:'#3DDC84',p:'#FF6BD6'};const W=96,H=300;${P.POUR}</script>`, { slim: true });
}

function arcade() {
  return page('', `<div style="flex:1;display:flex;gap:28px;padding:28px 32px;overflow:hidden">
   <div style="flex:1;display:flex;flex-direction:column;min-width:0">
     ${P.matchHeader({ centre: '<div class="t-caption">Game 2 of 3 · Rated</div><span class="chip num" style="height:30px;font-size:14px;margin-top:4px">Win <span style="color:var(--win)">+8</span> · Lose <span style="color:var(--loss)">−8</span></span>', mySub: '1,482 · Stripes', theirSub: '1,503 · Solids' }).replace('padding:4px 16px 0', 'padding:0')}
     <div style="position:relative;margin-top:18px">
      <canvas id="t" width="1400" height="760" style="display:block;width:100%;height:auto"></canvas>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div style="font-size:64px;line-height:70px;font-weight:900;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.4)">You win</div>
        <div class="chip num" style="margin-top:12px;height:40px;font-size:18px;background:rgba(6,8,15,.82)">Match won · 2 – 0</div></div></div>
     <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">${P.groupRow([9, 10, 11, 12, 13, 14, 15], [9, 10, 11, 12, 13, 14, 15], 11)}${P.groupRow([1, 2, 3, 4, 5, 6, 7], [2, 5], 11)}</div>
     <span style="flex:1"></span>
     <div class="panel" style="align-self:flex-start;display:flex;align-items:center;gap:12px;padding:10px 16px 10px 10px;border-radius:var(--r-md)">
      <img src="${art('challenges')}" width="40" height="40"><div><div class="t-body" style="font-size:15px">Challenge done</div><div class="t-caption">Pot 3 in one visit</div></div><span class="joules num" style="margin-left:14px">${bolt(14)}100</span></div>
   </div>
   ${sidePanel([[PEOPLE.me, 'You', ['W', 'W', '–'], '1,490', '+8'], [PEOPLE.sam, 'Sam_Volt', ['L', 'L', '–'], '1,495', '−8']], `<span style="flex:1"></span><div class="btn btn-gold btn-lg">Next match</div>
     <div style="display:flex;gap:12px;margin-top:16px"><div class="btn btn-2 btn-md" style="flex:1">Rematch</div><div class="btn btn-2 btn-md" style="flex:1">Review</div></div>`)}</div>
  <script>${P.TABLE}const {ctx}=table(document.getElementById('t'),'#1C5C8A',true);
  const B=[[0,620,410],[1,980,300],[3,1150,520],[4,410,250],[6,860,600],[7,300,560],[8,1210,200]];
  for(const [n,x,y] of B)shadow(ctx,x,y,24);for(const [n,x,y] of B)ball(ctx,x,y,24,n);${P.miniScript}</script>`, { slim: true });
}

function catalogue() {
  return page('games', `<div style="flex:1;padding:28px 40px;overflow:hidden">
   ${title('Games', `<span class="t-label num" style="display:flex;align-items:center;gap:6px">${P.STAR(18)} 74 / 249 stars</span><span class="chip" style="height:40px;width:280px;color:var(--text3);font-weight:600">${icon('search', 20)}Search games</span>`)}
   ${P.chips()}
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:22px">
    <div style="grid-column:span 2;grid-row:span 2">${P.tile('pool', 552, 376, { big: true })}</div>
    ${['tubes', 'gemstone', 'hanoi', 'blockzone', 'minefield', 'tilt', 'curling', 'tubes'].map((g) => P.tile(g, 268, 180)).join('')}
   </div></div>`);
}

function intro() {
  return page('games', `<div style="flex:1;padding:28px 40px;display:flex;gap:32px;overflow:hidden">
   <div style="flex:1;min-width:0">
    <div style="color:var(--text2);display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:16px">${icon('back', 22)}Games</div>
    <div style="height:400px;border-radius:var(--r-lg);overflow:hidden;position:relative;background:${P.tint(CATEGORY.logic, 0.5)}"><img src="${key('tubes')}" style="position:absolute;left:50%;top:-30px;transform:translateX(-50%);width:760px"></div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:22px"><span class="t-display" style="flex:1">Polypotions</span>${P.STARS(2, 24)}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><span class="tag" style="background:rgba(46,211,183,.16);color:${CATEGORY.logic}">Logic</span><span class="tag" style="background:var(--surface2);color:var(--text2)">90 s</span><span class="tag num" style="background:var(--surface2);color:var(--text2)">Best 182</span></div>
    <div class="t-body" style="margin-top:18px">Sort the potions so each flask is one colour.</div>
    <div class="t-label" style="margin-top:6px">Tap a flask to lift it, then tap where to pour. Up to 200 for finishing fast and under par.</div>
   </div>
   <div style="width:420px;flex:none;padding-top:40px;display:flex;flex-direction:column">
    <div class="sec"><span class="t-heading">Challenges</span><span class="t-caption num">1 of 3 done</span></div>
    <div class="panel" style="padding:0 16px">${P.CH_POLY.map(P.challengeRow).join('')}</div>
    <div class="btn btn-gold btn-lg" style="margin-top:28px">Play</div>
    <div class="btn btn-2 btn-md" style="margin-top:16px">Challenge a friend</div></div></div>`);
}

function challenges() {
  return page('challenges', `<div style="flex:1;padding:28px 40px;display:flex;gap:32px;overflow:hidden">
   <div style="width:340px;flex:none">${title('Challenges')}
    <div class="panel" style="padding:20px;text-align:center"><img src="${art('challenges')}" width="96" height="96">
     <div class="t-title num" style="margin-top:8px">61 of 217</div><div class="bar" style="margin-top:12px"><i style="width:28%"></i></div>
     <div class="t-caption" style="margin-top:10px">Every challenge counts towards your Challenger badges.</div></div>
    <div class="seg" style="margin-top:20px"><span class="on">In progress</span><span>New</span><span>Done</span></div></div>
   <div style="flex:1;columns:2;column-gap:24px;padding-top:58px">${P.CH_ALL.concat([['hanoi', [['Finish in the fewest moves', '17 best', 15, 17, '100']]], ['blockzone', [['Clear 4 lines at once', 'Not yet', 0, 1, '100']]]]).map(([g, rows]) => `<div style="break-inside:avoid;margin-bottom:22px">
     <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:32px;height:32px;border-radius:8px;overflow:hidden;background:${P.tint(P.GAMES[g].bg, 0.6)};position:relative"><img src="${key(g)}" style="position:absolute;width:60px;left:-14px;top:-6px"></span><span class="t-body" style="flex:1">${P.GAMES[g].name}</span></div>
     <div class="panel" style="padding:0 16px">${rows.map(P.challengeRow).join('')}</div></div>`).join('')}</div></div>`);
}

function profile() {
  return page('profile', `<div style="flex:1;padding:28px 40px;display:flex;gap:32px;overflow:hidden">
   <div style="width:400px;flex:none">${title('Profile')}${P.playerCard(400)}<div class="btn btn-2 btn-md" style="margin-top:16px">${icon('edit', 20)}Customise card</div></div>
   <div style="flex:1;padding-top:58px;display:flex;flex-direction:column;gap:28px;min-width:0">
    <div>${P.ratingTiles(4, 168)}</div>
    <div><div class="sec"><span class="t-heading">Mastery</span><a>Games</a></div><div class="panel" style="padding:16px;display:flex;align-items:center;gap:14px">${P.STAR(36)}<div style="flex:1"><div class="t-body num">74 of 249 stars</div><div class="bar" style="margin-top:8px"><i style="width:30%"></i></div></div><img src="${art('gem')}" width="44" height="44"></div></div>
    <div><div class="sec"><span class="t-heading">Recent matches</span><a>History</a></div><div class="panel">${[[PEOPLE.sam, 'Cue Ball', 'W', '+8'], [PEOPLE.kira, 'Polypotions', 'W', '+6'], [PEOPLE.ollie, 'Gemstone', 'L', '−7']].map(([p, g, r, c]) => `<div class="row">${avatar(p, 32)}<div style="flex:1"><div class="t-body" style="font-size:16px">${p.name}</div><div class="t-caption">${g} · Best of 3</div></div><span class="num" style="font-weight:800;color:${r === 'W' ? 'var(--win)' : 'var(--loss)'}">${c}</span><span class="tag" style="background:${r === 'W' ? 'rgba(22,195,91,.16)' : 'rgba(255,90,110,.16)'};color:${r === 'W' ? 'var(--win)' : 'var(--loss)'}">${r}</span></div>`).join('')}</div></div>
   </div></div>`);
}

function shop() {
  const pack = (n, c, p) => `<div class="panel" style="flex:1;padding:16px;text-align:center"><div style="height:86px;display:flex;justify-content:center;align-items:flex-end">${Array.from({ length: c }, (_, i) => `<img src="${art('coins')}" width="64" height="64" style="margin:0 -14px ${i % 2 ? 10 : 0}px">`).join('')}</div><div class="t-heading num" style="margin-top:8px">${n} coins</div><div class="btn btn-2 btn-sm" style="margin-top:12px">${p}</div></div>`;
  return page('shop', `<div style="flex:1;padding:28px 40px;overflow:hidden">
   ${title('Shop', coins)}
   <div class="seg" style="width:420px"><span class="on">Shop</span><span>Pass</span><span>Plus</span></div>
   <div style="display:flex;gap:24px;margin-top:22px">
    <div style="flex:1">${P.shop().match(/<div style="margin-top:16px;border-radius:var\(--r-lg\)[\s\S]*?2,400<\/div><\/div>/)[0].replace('margin-top:16px;', '').replace('height:168px', 'height:250px')}</div>
    <div style="width:420px"><div class="sec"><span class="t-heading">Today</span><span class="t-caption">Changes daily</span></div>
     <div style="display:flex;gap:16px">${P.item('frame', 'Champagne frame', 'epic', '800', 202)}${P.item('avatar', 'Pixel Kira', 'epic', '600', 202)}</div></div></div>
   <div class="sec" style="margin-top:28px"><span class="t-heading">Coins</span></div>
   <div style="display:flex;gap:16px">${pack('500', 1, '£0.99')}${pack('1,200', 2, '£1.99')}${pack('3,000', 3, '£4.99')}${pack('6,500', 4, '£9.99')}</div></div>`);
}

function more() {
  return page('', `<div style="flex:1;padding:28px 40px;overflow:hidden">${title('More')}
   <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">${P.MORE.map(([g, rows]) => `<div><div class="t-caption" style="font-weight:800;margin:0 4px 8px">${g}</div><div class="panel">${rows.map(P.moreRow).join('')}</div></div>`).join('')}</div>
   <div class="t-label" style="margin-top:28px">On a computer every item here is also in the rail, under More.</div></div>`);
}

function list() {
  return page('arena', `<div style="flex:1;padding:28px 40px;overflow:hidden">${title('Arena and tournaments')}
   <div class="seg" style="width:420px"><span class="on">Upcoming</span><span>Your results</span></div>
   ${P.EVENTS.map(([g, rows]) => `<div class="t-caption" style="font-weight:800;margin:24px 4px 8px">${g}</div><div class="panel">${rows.map(P.eventRow).join('')}</div>`).join('')}</div>`);
}

export const DESKTOP = { home, play: () => play(false), sheet: () => play(true), puzzle, arcade, catalogue, intro, challenges, profile, shop, more, list };
