import json, html
R='/home/user/brain-blitz-duel/docs/polish-plan-final/'
E=html.escape
def img(path,cap,cls=''):
    return f'<figure class="shot {cls}"><img loading="lazy" src="direction/{path}.webp" alt="{E(cap)}"><figcaption>{E(cap)}</figcaption></figure>'
def strip(items,cls=''):
    return f'<div class="strip {cls}">'+''.join(img(p,c,k) for p,c,k in items)+'</div>'
G=[('wordhunt','Forage · Word'),('sudoku','Box Six · Logic'),('pipes','Pipeline · Pattern'),('matchup','Gemstone · Strategy'),('breaker','Breaker · Retro'),('freekick','Top Bins · Sports'),('tripeaks','Summit · Cards')]
DIRS=[('floodlit','1','Floodlit','Same games, lights on.','Every near-black stage becomes its category’s deep colour, colours a quarter stronger, chrome turned to satin colour.','Works on all 83 games, smallest build, sits naturally in the frame.','Pieces stay dark-bodied, so the puzzles change least where they need it most.'),
('neon','2','Neon Arena','Keep the dark, make every piece glow.','Saturation up, glow on anything coloured, a faint floor grid, chrome tinted neon.','The most “esports”. Superb on Retro and on Pipeline.','Still dark, and glow is another kind of shiny. Tiring on reading puzzles.'),
('twotone','3','Two-Tone Worlds','Each world floods with a bold two-colour gradient.','The stage becomes the colour: blue to violet, teal to blue, violet to pink.','The most colourful of the four.','Fights the frame, boards lose contrast, reads casual.'),
('spotlight','4','Spotlight','A bright table in a dark arena.','Floodlit’s lit stage, plus light matte pieces on the board puzzles. Worlds, sports and cards get Floodlit’s treatment (they have no dark pieces to flip).','The biggest gain where the complaint is: black tiles, chrome pipes, brushed metal. It is chess.com’s formula, and the one Joulz’s own card and sports games already use.','The largest art job: each puzzle family’s piece set is re-rendered.')]
dec=[
 ('look','Page look',[('E','E · Esports, refined'),('F','F · Esports, colour-charged'),('A','A · Bright Spark')],'E','Today’s style kept; structure, size and words improved. F if E reads too quiet. A is a different product.'),
 ('games','Game art direction',[('1','1 · Floodlit'),('2','2 · Neon Arena'),('3','3 · Two-Tone Worlds'),('4','4 · Spotlight')],'4','Spotlight, with Retro kept dark on Neon’s glow. Floodlit is the same plan without the new piece sets and can ship first.'),
 ('nav','Navigation',[('N1','N1 · Five tabs, Home’s hero is the play button'),('N2','N2 · Centre Play button')],'N1','Home · Games · Compete · Shop · You. The floating Play bar goes; More becomes You.'),
 ('first','A new phone’s first open goes straight into a first game',[('yes','Yes'),('no','No')],'yes','Ascend on Easy: the first tap is the game’s first tap. Then a win screen, then Home.'),
 ('gamespage','Games page on a phone',[('G1','G1 · Category shelves'),('G2','G2 · Three-across grid')],'G1','Larger tiles and every category on the first screen. The grid stays as each category’s “All” page.'),
 ('levels','The level picker lives on each game’s page only',[('yes','Yes'),('no','No')],'yes','It leaves the catalogue, and the “Difficulty levels” explainer goes.'),
 ('intro','Round intro: demo, one-line goal and Ready',[('yes','Yes'),('no','No')],'yes','How and Score move behind “?”. Rooms and the Daily keep the Ready tap.'),
 ('ratings','Ratings tiles leave Home',[('yes','Yes'),('keep','Keep them on Home')],'yes','The hero shows your rating; all three live on You. This reverses the 14 Nov choice.'),
 ('terms','Beta terms cut to about 60 words and a link',[('yes','Yes, subject to the adviser'),('no','No')],'yes','On the Daily the page shows first and the terms come at the first Play tap.'),
 ('hard4','A new Hard for Counterweight, Brimful, Checkout and Kakuro',[('yes','Yes'),('no','Keep the older game as Hard')],'yes','The older game as Hard looks and scores like Normal. This reverses the 15 Nov choice.'),
 ('ironwall','Iron Wall’s Expert becomes four lanes',[('yes','Yes'),('no','Keep Expert as it is')],'yes','The fourth lane arrives at Hard (8 tanks a wave), Expert has 9.'),
 ('reach200','Fix scoring on level deals so 200 is reachable under the human limits',[('yes','Yes'),('no','No')],'yes','Flash, Bonk, Home Run, Matchmaker, Tenfall’s Easy, Nucleus, Forage, Five Hands. Normal untouched.'),
 ('proofs','Every difficulty session builds its proof tool first',[('yes','Yes'),('no','No')],'yes','No oracle applies the human limits today; four Retro games have none.'),
 ('mines','Minefield’s Expert goes back to 10 × 16 (36 mines)',[('yes','Yes'),('no','No')],'yes','Today’s 12 × 18 draws squares at about 31 px on a phone.'),
 ('bestvalue','Drop “best value” from the coin packs',[('yes','Yes, drop it'),('no','Keep it')],'yes','The style guide’s own rule is no pressure labels.'),
 ('avatars','Leave the avatars’ backing disc and their art as they are',[('yes','Yes, leave them'),('no','Remove the disc')],'yes','The new header and VS screens make the disc a non-issue.'),
]
allg=[]
for f in ['word','number','speed-attention','pattern-logic','retro-action','strategy-sports-cards']:
    allg+=json.load(open(R+f'difficulty/{f}.json'))
order=['Word','Number','Speed','Attention','Pattern','Logic','Retro','Action','Strategy','Sports','Cards & Board']
def levels():
    out=[]
    for grp in order:
        gs=[g for g in allg if g['group']==grp]
        out.append(f'<h3 class="fam">{E(grp)} <span>{len(gs)}</span></h3>')
        for g in gs:
            ch={'keep':'kept','retune':'retuned','redesign':'redesigned'}[g['change']]
            new=f'<p class="newm"><b>New:</b> {E(g["newMechanic"])}</p>' if g.get('newMechanic') else ''
            out.append(f'''<details class="lv"><summary><b>{E(g["name"])}</b><span class="lever">{E(g["lever"])}</span><i class="tag {g["change"]}">{ch}</i></summary>
<div class="ladder"><div class="e"><em>Easy</em>{E(g["glance"]["easy"])}</div><div class="n"><em>Normal · today</em>{E(g["today"]["normal"])}</div><div class="h"><em>Hard</em>{E(g["glance"]["hard"])}</div><div class="x"><em>Expert</em>{E(g["glance"]["expert"])}</div></div>
<p class="why">{E(g["why"])}</p>{new}</details>''')
    return '\n'.join(out)
def decisions():
    out=[]
    for i,(k,q,opts,rec,note) in enumerate(dec,1):
        o=''.join(f'<label class="opt{" rec" if v==rec else ""}"><input type="radio" name="d-{k}" id="d-{k}-{v}" value="{E(lab)}"{" checked" if v==rec else ""}><span>{E(lab)}{" <small>recommended</small>" if v==rec else ""}</span></label>' for v,lab in opts)
        out.append(f'<fieldset class="dec" data-q="{E(q)}"><legend><b>{i}.</b> {E(q)}</legend><p>{E(note)}</p><div class="opts">{o}</div></fieldset>')
    return '\n'.join(out)
dirsec=[]
for key,num,name,idea,what,pro,con in DIRS:
    rec=' <span class="recbadge">Recommended</span>' if key=='spotlight' else ''
    dirsec.append(f'''<article class="dir" id="dir-{key}"><h3><span class="num">{num}</span>{E(name)}{rec}</h3><p class="idea">{E(idea)}</p><p>{E(what)}</p>
{strip([(f"games/{g}-{key}",n,'') for g,n in G])}
<p class="pc"><b>For:</b> {E(pro)}</p><p class="pc"><b>Against:</b> {E(con)}</p></article>''')
compare=[]
for g,n in [('wordhunt','Forage'),('pipes','Pipeline'),('matchup','Gemstone'),('tripeaks','Summit')]:
    compare.append(f'<h4>{E(n)}: today, then directions 1 to 4</h4>'+strip([(f'games/{g}-now','Today','now')]+[(f'games/{g}-{k}',f'{num} · {nm}','') for k,num,nm,*_ in DIRS]))
def pair(title,note,items):
    return f'<article class="pg"><h3>{E(title)}</h3><p>{E(note)}</p>{strip(items)}</article>'
pages=[
 pair('Home','One hero and one gold button. Dailies side by side, each with a visible Play. Create and Join on Home. No floating bar, nothing pops in.',[('pages/home-now-phone','Today','now'),('pages/home-e-phone','E · Esports, refined',''),('pages/home-f-phone','F · Colour-charged',''),('pages/home-a-phone','A · Bright Spark','')]),
 pair('Games','One control, the game of the day, then a shelf per category with larger tiles. The level switch and the explainer leave this page.',[('pages/games-now-phone','Today','now'),('pages/games-e-phone','E · shelves (G1)',''),('pages/games-e2-phone','E · grid (G2)',''),('pages/games-a-phone','A · Bright Spark','')]),
 pair('A game’s page','A one-line goal, the four levels as steps, one large Play. Forty words at most.',[('pages/gamepage-now-phone','Today','now'),('pages/gamepage-e-phone','E',''),('pages/gamepage-a-phone','A','')]),
 pair('VS','Full-bleed: each half lit in its player’s colour, the card drawn large, the first game and the stakes at the foot.',[('pages/vs-now-phone','Today','now'),('pages/vs-e-phone','E',''),('pages/vs-f-phone','F',''),('pages/vs-a-phone','A','')]),
 pair('Rated result','The win reads as a win, and there is a way home. (The built title stays “You win”, without the exclamation mark.)',[('pages/result-now-phone','Today','now'),('pages/result-e-phone','E',''),('pages/result-a-phone','A','')]),
 pair('You (Profile and More in one)','The card, the rating, three stats, then rows for Friends, Challenges, Badges and Settings.',[('pages/profile-now-phone','Today: Profile','now'),('pages/more-now-phone','Today: More','now'),('pages/profile-e-phone','E',''),('pages/profile-a-phone','A','')]),
 pair('Shop','The bundle as a hero with its items large, the still filling each card’s top half. No pressure labels.',[('pages/shop-now-phone','Today','now'),('pages/shop-e-phone','E',''),('pages/shop-f-phone','F',''),('pages/shop-a-phone','A','')]),
]
desk=[
 pair('Desktop Home','The hero across two columns, three feature cards, six tiles, an aside that is never empty.',[('pages/home-now-desktop','Today','now wide'),('pages/home-e-desktop','E','wide'),('pages/home-f-desktop','F','wide'),('pages/home-a-desktop','A','wide')]),
 pair('Desktop Games','The hero across the top, shelves of seven tiles.',[('pages/games-now-desktop','Today','now wide'),('pages/games-e-desktop','E','wide'),('pages/games-a-desktop','A','wide')]),
 pair('Desktop VS','The two halves side by side on a slanted gold seam.',[('pages/vs-now-desktop','Today','now wide'),('pages/vs-e-desktop','E','wide'),('pages/vs-a-desktop','A','wide')]),
 pair('Desktop game: the Cabinet','The identical world in the middle, score and run on the left, goal and controls on the right. The skeleton is already built, behind a switch that is off. Layout study; the panels are painted in the esports style when built.',[('pages/play-a-desktop','The Cabinet on Breaker','wide')]),
]
page=f'''<title>Joulz Design Direction</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&display=swap">
<style>
/* Layout: one phone-width column of sections; pictures in sideways strips; choices as tappable rows that copy out as text.
   A single dark look on purpose: the page wears Joulz's own navy and champagne so the screenshots sit in their own world. */
:root {{ color-scheme: dark;
  --bg:#04060C; --panel:#0D152B; --panel2:#17233F; --line:#223058; --text:#EEF2FF; --text2:#B5C6DD; --text3:#8F9BBF;
  --gold:#E2C07A; --gold-ink:#06080F; --cyan:#22E4FF; --green:#3EDB72; --amber:#FFB35C; --red:#FF6B7E; --blue:#6FA2FF;
  --font:"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }}
*{{box-sizing:border-box}} [hidden]{{display:none!important}}
body{{background:var(--bg);color:var(--text);font:400 16px/1.55 var(--font);margin:0}}
.wrap{{max-width:980px;margin:0 auto;padding-block:20px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
h1{{font:900 34px/1.05 var(--font);font-stretch:118%;margin:10px 0 8px;text-wrap:balance}}
h1 b{{color:var(--gold)}}
h2{{font:900 25px/1.1 var(--font);font-stretch:112%;margin:54px 0 10px;padding-top:18px;border-top:2px solid var(--line);text-wrap:balance}}
h3{{font:800 20px/1.2 var(--font);margin:26px 0 6px;text-wrap:balance}}
h4{{font:700 15px/1.3 var(--font);color:var(--text2);margin:20px 0 6px}}
p{{margin:0 0 10px;max-width:68ch}} .lede{{color:var(--text2);font-size:17px}}
a{{color:var(--cyan)}} code{{font:500 13px var(--mono);color:var(--text2);overflow-wrap:anywhere}}
.eyebrow{{font:800 12px var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}}
nav.toc{{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px}}
nav.toc a{{text-decoration:none;color:var(--text);background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 13px;font:700 14px var(--font)}}
.short{{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:18px 0}}
.short ul{{margin:0;padding-left:18px}} .short li{{margin:7px 0}}
.strip{{display:flex;gap:12px;overflow-x:auto;padding:6px 2px 14px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}}
.shot{{flex:none;margin:0;width:228px;scroll-snap-align:start}} .shot.wide{{width:min(86vw,640px)}}
.shot img{{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:#000;cursor:zoom-in}}
.shot.now img{{border-color:#4A5E9E}} .shot figcaption{{font:700 13px var(--font);color:var(--text2);margin-top:6px}}
.shot.now figcaption{{color:var(--text3)}}
.dir{{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:4px 16px 12px;margin:18px 0}}
.dir h3{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}}
.num{{display:inline-flex;width:30px;height:30px;border-radius:8px;background:var(--panel2);align-items:center;justify-content:center;font:900 16px var(--font);color:var(--gold)}}
.idea{{font:800 17px var(--font);color:var(--text)}} .pc{{color:var(--text2);font-size:15px;margin:4px 0}}
.recbadge,.opt small{{font:800 11px var(--font);letter-spacing:.08em;text-transform:uppercase;background:var(--gold);color:var(--gold-ink);border-radius:6px;padding:3px 7px}}
.rec-box{{border:2px solid var(--gold);border-radius:16px;padding:14px 16px;margin:18px 0;background:linear-gradient(135deg,#1A2038,#0B1022)}}
.pg{{margin:22px 0}}
table{{border-collapse:collapse;width:100%;font-size:15px}} .tbl{{overflow-x:auto;margin:10px 0 16px}}
th,td{{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}} th{{color:var(--text3);font:800 12px var(--font);letter-spacing:.08em;text-transform:uppercase}}
td b{{color:var(--gold)}} .tnum{{font-variant-numeric:tabular-nums}}
.fam{{margin-top:28px;display:flex;align-items:baseline;gap:8px}} .fam span{{font:800 13px var(--font);color:var(--text3)}}
details.lv{{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:8px 0}}
details.lv summary{{list-style:none;cursor:pointer;padding:12px 14px;display:flex;gap:8px 10px;align-items:baseline;flex-wrap:wrap}}
details.lv summary::-webkit-details-marker{{display:none}}
details.lv summary b{{font:800 16px var(--font)}} .lever{{color:var(--text2);font-size:14px;flex:1;min-width:140px}}
.tag{{font:800 11px var(--font);font-style:normal;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;padding:3px 7px;background:var(--panel2);color:var(--text2)}}
.tag.redesign{{color:var(--amber)}} .tag.keep{{color:var(--green)}}
.ladder{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 14px 6px}}
.ladder div{{background:var(--panel2);border-radius:10px;padding:9px 10px;font-size:14px;line-height:1.35;border-top:3px solid var(--line);min-width:0;overflow-wrap:anywhere}}
.ladder em{{display:block;font:800 11px var(--font);font-style:normal;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}}
.ladder .e{{border-color:var(--green)}} .ladder .e em{{color:var(--green)}} .ladder .n{{border-color:var(--blue)}} .ladder .n em{{color:var(--blue)}}
.ladder .h{{border-color:var(--amber)}} .ladder .h em{{color:var(--amber)}} .ladder .x{{border-color:var(--red)}} .ladder .x em{{color:var(--red)}}
.why,.newm{{padding:0 14px;color:var(--text2);font-size:14px}} .newm b{{color:var(--gold)}}
#lvfind{{width:100%;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--text);font:600 16px var(--font);padding:0 14px;margin:10px 0}}
fieldset.dec{{border:1px solid var(--line);border-radius:14px;background:var(--panel);margin:12px 0;padding:10px 14px 12px;min-width:0}}
fieldset.dec legend{{font:800 16px var(--font);padding:0 6px}} fieldset.dec legend b{{color:var(--gold)}}
fieldset.dec p{{color:var(--text2);font-size:14px;margin:2px 0 8px}}
.opts{{display:flex;flex-direction:column;gap:8px}}
.opt{{display:flex;align-items:center;gap:10px;min-height:46px;padding:8px 12px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);cursor:pointer;font:700 15px var(--font)}}
.opt input{{width:20px;height:20px;accent-color:var(--gold);flex:none}} .opt:has(input:checked){{border-color:var(--gold)}}
.opt span{{display:flex;gap:8px;align-items:center;flex-wrap:wrap}}
.copybar{{margin-top:16px}}
button.gold{{width:100%;height:56px;border:0;border-radius:12px;background:linear-gradient(165deg,#FBEDC4,#E6C67E 34%,#D2AC5E 68%,#EED79C);color:var(--gold-ink);font:800 18px var(--font);box-shadow:0 4px 0 #A8843E,0 10px 24px rgba(0,0,0,.5);cursor:pointer}}
button.gold:focus-visible,.opt:focus-within,nav.toc a:focus-visible,summary:focus-visible{{outline:2px solid var(--cyan);outline-offset:2px}}
#answers{{width:100%;min-height:150px;margin-top:10px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--text);font:500 13px/1.5 var(--mono);padding:10px}}
.files li{{margin:6px 0}} .muted{{color:var(--text3);font-size:14px}}
#zoom{{position:fixed;inset:0;background:rgba(2,3,8,.94);display:flex;align-items:center;justify-content:center;z-index:50;padding:env(safe-area-inset-top,0px) 8px env(safe-area-inset-bottom,0px);cursor:zoom-out}}
#zoom img{{max-width:100%;max-height:100%;border-radius:12px}}
@media (max-width:640px){{ .ladder{{grid-template-columns:1fr 1fr}} h1{{font-size:29px}} .shot{{width:200px}} }}
@media (prefers-reduced-motion:no-preference){{ html{{scroll-behavior:smooth}} }}
</style>
<div class="wrap">
<div class="eyebrow">Joulz · design direction · 20 Nov 2026</div>
<h1>Vivid games in a <b>sleek frame</b></h1>
<p class="lede">The pages keep today’s esports look and get a better structure. The games get brighter. Everything here is a plan and mockups: nothing is built. Tap any picture to enlarge it. Your choices at the bottom copy out as text to paste back to me.</p>
<nav class="toc"><a href="#games">Game art</a><a href="#pages">Pages</a><a href="#flow">Flow</a><a href="#levels">Difficulty</a><a href="#decide">Decide</a><a href="#files">Files</a></nav>

<div class="short"><div class="eyebrow">The short version</div><ul>
<li><b>Games:</b> I recommend direction 4, <b>Spotlight</b>: a lit stage in each category’s deep colour and light matte pieces on the board puzzles. Retro stays dark and glows.</li>
<li><b>Pages:</b> today’s style, refined (look E). One hero and one gold button a page, larger type and tiles, far fewer words.</li>
<li><b>Flow:</b> a new phone’s first tap is inside a game. Tabs become Home · Games · Compete · Shop · You.</li>
<li><b>Difficulty:</b> every game gets one lever you can see in the first seconds, as a four-step ladder. Normal never changes.</li>
<li><b>Your three built items</b> (Apex’s steering, the reveal template, the desktop Cabinet skeleton) all still fit.</li>
</ul></div>

<h2 id="games">Games: four art directions</h2>
<p>Each direction is shown on the same seven real screenshots, with today’s header left untouched so you can see how the game sits in the frame. These are quick studies made by re-treating the real picture. The build draws each game properly.</p>
<h4>Today</h4>
{strip([(f"games/{g}-now",n,'now') for g,n in G])}
{''.join(dirsec)}
<div class="rec-box"><div class="eyebrow">My recommendation</div><p><b>Direction 4, Spotlight.</b> The games you like least are the ones with dark pieces on a dark board. The ones that already read well (the card games, Top Bins) have light pieces on a coloured surface, and so does chess.com. Spotlight brings the puzzles into line with them and leaves the frame alone.</p><p>Two exceptions are part of it. Retro keeps its dark screen and takes direction 2’s glow, because neon on black is what Retro is. Games about light on dark (Lamplighter, Lightbender, Chroma Lines) keep a deep-coloured board.</p><p>If you want a smaller first step, pick direction 1. Spotlight is Floodlit plus the new piece sets, so nothing is wasted.</p></div>
<h3>Spotlight, drawn rather than filtered</h3>
<p>Five games with the pieces redrawn in the direction, under today’s real header. This is closer to what a build session would produce.</p>
{strip([('games/wordhunt-now','Forage today','now'),('games/wordhunt-drawn','Forage, drawn',''),('games/sudoku-now','Box Six today','now'),('games/sudoku-drawn','Box Six, drawn',''),('games/target-now','Exact today','now'),('games/target-drawn','Exact, drawn',''),('games/flow-now','Chroma Lines today','now'),('games/flow-drawn','Chroma Lines, drawn',''),('games/matchup-now','Gemstone today','now'),('games/matchup-drawn','Gemstone, drawn','')])}
<h3>One game across all four</h3>
{''.join(compare)}

<h2 id="pages">Pages: today’s style, refined</h2>
<p>Three looks on the same new layouts. <b>E “Esports, refined”</b> is today’s navy, champagne gold and angled cuts, with feature cards taking colour as an edge light. <b>F “colour-charged”</b> lets the feature cards carry full colour. <b>A “Bright Spark”</b> is the bolder redesign I made before your correction. I recommend E.</p>
{''.join(pages)}
<h3>Two open layout choices</h3>
{strip([('pages/home-e-phone','N1 · five tabs, the hero plays',''),('pages/home-e2-phone','N2 · centre Play button',''),('pages/games-e-phone','G1 · shelves',''),('pages/games-e2-phone','G2 · three-across grid','')])}
<h3>On a computer</h3>
{''.join(desk)}

<h2 id="flow">Flow: a first game in seconds</h2>
<p>Today a new player sees Home, a loading screen and a full intro before the first tap inside a game. In the plan the splash leads straight to a first game, and the first tap is the game’s first tap.</p>
{strip([('pages/first1-e-phone','1 · The bolt charges',''),('pages/first2-a-phone','2 · The first game: tap 1, 2, 3…',''),('pages/first3-a-phone','3 · A first win, then Home',''),('pages/intro-now-phone','Today’s intro, for contrast','now')])}
<p class="muted">Frames 2 and 3 are flow sketches. The game itself is drawn in the art direction you pick.</p>
<div class="tbl"><table><tr><th>Journey</th><th>Today</th><th>Plan</th></tr>
<tr><td>Taps before the first tap inside a game (new phone)</td><td class="tnum">2</td><td class="tnum"><b>0</b></td></tr>
<tr><td>Home to a game</td><td class="tnum">2</td><td class="tnum"><b>1</b></td></tr>
<tr><td>Join a friend’s room with a code</td><td class="tnum">3</td><td class="tnum"><b>1</b></td></tr>
<tr><td>Round intro, words to read</td><td class="tnum">59 average</td><td class="tnum"><b>15</b></td></tr>
<tr><td>A game’s page, words</td><td class="tnum">90–130</td><td class="tnum"><b>40</b></td></tr>
<tr><td>Help sheet, words</td><td class="tnum">252 average</td><td class="tnum"><b>120</b></td></tr>
<tr><td>Ways home from the rated result and the Daily result</td><td class="tnum">none</td><td><b>a Home button</b></td></tr>
<tr><td>Tabs with nothing to do for most players</td><td>Tournaments</td><td><b>none</b></td></tr></table></div>
<p>Tabs: <b>Home · Games · Compete · Shop · You.</b> Compete holds your rating, tournaments, leaderboards and the Daily top 100, so it is never empty. You is Profile and More in one. The floating Play bar goes, because Home’s hero does its job.</p>

<h2 id="levels">Difficulty: one lever you can see</h2>
<p>Every game gets one headline lever a player sees in the first three seconds, and Easy, Normal, Hard and Expert sit on it as one ladder. Normal is today’s game and never changes. Hard and Expert never add an aid. Expert is proven reachable at 200 by the best humans.</p>
<p class="muted">Of 83 games: 1 kept, 48 retuned, 34 redesigned, 5 with one new mechanic. The commonest fault today is that Hard looks the same as Normal. Tap a game for its ladder; the full numbers, proofs and files are in the spec.</p>
<input id="lvfind" type="search" placeholder="Find a game" aria-label="Find a game">
<div id="lvlist">
{levels()}
</div>

<h2 id="decide">Decide</h2>
<p>My recommendation is selected on each. Change any you disagree with, then copy your answers and paste them back to me.</p>
{decisions()}
<div class="copybar"><button class="gold" id="copy" type="button">Copy my answers</button></div>
<textarea id="answers" readonly aria-label="Your answers as text" hidden></textarea>
<p class="muted" id="copied" hidden>Copied. Paste it into the chat.</p>

<h2 id="files">What was written, and where</h2>
<ul class="files">
<li><b>The plan</b>: <code>docs/polish-plan-final.md</code> (the direction, every page and game, the flow map, the sessions).</li>
<li><b>The difficulty spec</b>: <code>docs/polish-plan-final/difficulty-spec.md</code> and its data in <code>difficulty/</code>.</li>
<li><b>Check assertions the plan would change</b>, with exact lines: <code>docs/polish-plan-final/assertions.md</code>. You approve each one in the session that builds it.</li>
<li><b>Thirteen build prompts</b>, paste-ready, each with the standing rules: <code>docs/polish-plan-final/prompts/</code>.</li>
<li><b>Today’s pages and flows, read from the code</b>: <code>direction/pages-flow-today.md</code>.</li>
<li><b>The earlier plan</b>, kept because its rows are carried by id: <code>earlier-plan.md</code>.</li>
</ul>
<h3>Your three built items</h3>
<div class="tbl"><table><tr><th>Item</th><th>Still fits?</th></tr>
<tr><td>Apex’s steering fix</td><td><b>Yes, unchanged.</b> A plain bug fix.</td></tr>
<tr><td>The reveal template</td><td><b>Yes.</b> One layout to repaint is exactly what the direction needs. Its paint changes, its layout does not.</td></tr>
<tr><td>The desktop Cabinet skeleton</td><td><b>Yes.</b> Still the desktop answer for arcade games. It stays switched off until the desktop session fills it.</td></tr></table></div>
</div>
<div id="zoom" hidden><img alt=""></div>
<script>
(function(){{
  var zoom=document.getElementById('zoom'), zi=zoom.querySelector('img');
  document.addEventListener('click',function(e){{
    var t=e.target;
    if(t.tagName==='IMG'&&t.closest('.shot')){{zi.src=t.src;zi.alt=t.alt;zoom.hidden=false;}}
    else if(t===zoom||t===zi){{zoom.hidden=true;}}
  }});
  document.addEventListener('keydown',function(e){{if(e.key==='Escape')zoom.hidden=true;}});
  var find=document.getElementById('lvfind');
  find.addEventListener('input',function(){{
    var q=find.value.trim().toLowerCase();
    document.querySelectorAll('#lvlist details').forEach(function(d){{d.hidden=q!==''&&d.querySelector('summary').textContent.toLowerCase().indexOf(q)<0;}});
    document.querySelectorAll('#lvlist .fam').forEach(function(h){{h.hidden=q!=='';}});
  }});
  var KEY='joulz-direction-answers';
  try{{var saved=JSON.parse(localStorage.getItem(KEY)||'{{}}');Object.keys(saved).forEach(function(id){{var el=document.getElementById(id);if(el)el.checked=true;}});}}catch(e){{}}
  document.querySelectorAll('.dec input').forEach(function(i){{i.addEventListener('change',function(){{
    try{{var s={{}};document.querySelectorAll('.dec input:checked').forEach(function(c){{s[c.id]=1;}});localStorage.setItem(KEY,JSON.stringify(s));}}catch(e){{}}
  }});}});
  document.getElementById('copy').addEventListener('click',function(){{
    var lines=['My answers on the Joulz design direction:'];
    document.querySelectorAll('.dec').forEach(function(f,i){{var c=f.querySelector('input:checked');lines.push((i+1)+'. '+f.dataset.q+': '+(c?c.value:'no answer'));}});
    var text=lines.join('\\n'), box=document.getElementById('answers'), note=document.getElementById('copied');
    box.value=text;box.hidden=false;
    function done(){{note.hidden=false;}}
    function fallback(){{box.focus();box.select();note.textContent='Select the text above and copy it.';note.hidden=false;}}
    if(navigator.clipboard&&navigator.clipboard.writeText){{navigator.clipboard.writeText(text).then(done,fallback);}}else{{fallback();}}
  }});
}})();
</script>
'''
open(R+'review.html','w').write(page)
print(len(page)//1000,'KB')
